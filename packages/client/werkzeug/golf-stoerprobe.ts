/**
 * Was machen die Golf-Bots mit Störschlägen? — Messung über den Katalog
 * (Fun-Modus, Teil 3/3, seit dem 23.09.2026).
 *
 *   npx tsx packages/client/werkzeug/golf-stoerprobe.ts
 *   npx tsx packages/client/werkzeug/golf-stoerprobe.ts --saaten 40 --stufe genie,standard --loecher 9
 *
 * WARUM EIN EIGENES WERKZEUG: Ein Störschlag misst sich erst über mehrere
 * Löcher — wer führt, steht erst nach dem ersten fest (stoerschlag.ts), und
 * das Gummiband zeigt sich erst am Abstand zwischen Erstem und Letztem am
 * Ende. Die Power-up-Probe misst ein Loch, die Botprobe einen Ball.
 *
 * GEMESSEN: vier Bots derselben Stufe, ein ganzes Fun-Match (Roulette und
 * Felder wie im Spiel), in drei Fassungen derselben Partie:
 *
 *   - OHNE Störfelder (die drei Störfelder werden am Lochbeginn aus den
 *     Feldern genommen),
 *   - MIT Störfeldern, wie im Spiel,
 *   - NUR UMWEG (seit dem 23.09.2026, bot-stoer.ts): mit Störfeldern, aber
 *     ein eingesammelter Störschlag verfällt sofort (als genutzt). Die Bots
 *     laufen also dieselben Umwege zu den Feldern, niemand stört. Der
 *     Unterschied zu OHNE ist, was die Umwege die Bots SELBST kosten — die
 *     Grenze dafür ist 0,1 Schläge je Ball und Loch.
 *
 * Je Stufe:
 *
 *   - Schläge je Ball und Loch in allen drei Fassungen
 *   - Abstand Erster–Letzter am Matchende, ohne und mit (das Gummiband), dazu
 *     der Standardfehler des Mittels — erst ein Unterschied von zwei, drei
 *     Standardfehlern ist mehr als Rauschen
 *   - ausgelöste Störschläge je Loch, nach Art, und je Loch ab dem zweiten
 *     (im ersten führen alle, dort fällt keiner), und wie viele ein Schild fing
 *   - Störfelder je Loch: gelegt, eingesammelt, verfallen (am Lochende noch
 *     im Halt — eingelocht, ohne auszulösen)
 *   - Kosten: `botStoerschlag` je Aufruf und ein ganzer Takt, in dem ein Bot
 *     auslöst, gegen einen Takt, in dem er schlägt (Median, p90, p99, max in ms)
 */
import { readdirSync } from 'node:fs';

import { botStoerschlag } from '../src/minispiele/golf/bot-stoer';
import type { Karte } from '../src/minispiele/golf/karte';
import { type Botstufe, type Partiezustand, neuePartie, schritt } from '../src/minispiele/golf/physik';
import { type Powerupart, felderVon } from '../src/minispiele/golf/powerup';
import { ausloesenErlaubt, istStoerart } from '../src/minispiele/golf/stoerschlag';

const KARTEN_ORDNER = new URL('../src/minispiele/golf/karten/', import.meta.url);
const KARTEN: Karte[] = [];
for (const datei of readdirSync(KARTEN_ORDNER)
  .filter((d) => /^k\d\d-.*\.ts$/.test(d) && !d.endsWith('.test.ts'))
  .sort()) {
  const modul = (await import(new URL(datei, KARTEN_ORDNER).href)) as { bahn?: Karte };
  if (modul.bahn !== undefined) KARTEN.push(modul.bahn);
}

const args = process.argv.slice(2);
function schalter(name: string, vorgabe: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : vorgabe;
}
const saaten = Number(schalter('saaten', '30'));
const loecher = Number(schalter('loecher', '6'));
const stufen = schalter('stufe', 'genie,experte,standard,anfaenger').split(',') as Botstufe[];
const SITZE = 4;

function perzentil(sortiert: readonly number[], anteil: number): number {
  if (sortiert.length === 0) return 0;
  return sortiert[Math.min(sortiert.length - 1, Math.floor(anteil * sortiert.length))];
}
function zeitenText(z: number[]): string {
  z.sort((a, b) => a - b);
  const f = (x: number): string => x.toFixed(3).padStart(6);
  return `${f(perzentil(z, 0.5))} ${f(perzentil(z, 0.9))} ${f(perzentil(z, 0.99))} ${f(z[z.length - 1] ?? 0)}  (n=${z.length})`;
}

type Fassung = 'ohne' | 'mit' | 'umweg';

interface Messung {
  schlaege: number;
  abstaende: number[];
  ausgeloest: Record<string, number>;
  abgewehrt: number;
  gelegt: number;
  eingesammelt: number;
  verfallen: number;
  zeitStoer: number[];
  taktStoer: number[];
  taktSchlag: number[];
}

function spiele(saat: number, stufe: Botstufe, fassung: Fassung, m: Messung): void {
  const mitStoer = fassung !== 'ohne';
  const karten: Karte[] = [];
  for (let i = 0; i < loecher; i += 1) karten.push(KARTEN[(saat * 7 + i * 11) % KARTEN.length]);
  const z: Partiezustand = neuePartie({
    saat,
    sitze: SITZE,
    botSitze: [0, 1, 2, 3],
    loecher,
    botStufe: stufe,
    karten,
    modus: 'fun',
  });
  let loch = -1;
  let deckel = 0;
  // Was jeder Ball zuletzt hielt — steht am Lochwechsel noch ein Störschlag
  // darin, ist er verfallen.
  let zuletzt: (Powerupart | null)[] = new Array<Powerupart | null>(SITZE).fill(null);
  while (!z.fertig && deckel < 200_000) {
    deckel += 1;
    if (z.baelle.length > 0 && z.aktuell.loch !== loch && z.takt === z.aktuell.startTakt) {
      for (const h of zuletzt) if (istStoerart(h)) m.verfallen += 1;
      zuletzt = new Array<Powerupart | null>(SITZE).fill(null);
      loch = z.aktuell.loch;
      const felder = felderVon(z.aktuell.mod);
      if (!mitStoer) {
        z.aktuell.mod = Object.freeze({ ...z.aktuell.mod, powerups: felder.filter((f) => !istStoerart(f.powerup)) });
      } else {
        m.gelegt += felder.filter((f) => istStoerart(f.powerup)).length;
      }
    }
    // Was ein Bot jetzt auslösen WÜRDE — `botStoerschlag` ist rein, der Aufruf ändert nichts.
    const wollen: number[] = [];
    if (fassung === 'mit' && z.baelle.length > 0) {
      for (let s = 0; s < SITZE; s += 1) {
        if (!istStoerart(z.baelle[s].halt) || !ausloesenErlaubt(z, s)) continue;
        const t0 = performance.now();
        const wahl = botStoerschlag(z, s, karten[z.aktuell.karte]);
        m.zeitStoer.push(performance.now() - t0);
        if (wahl !== null) wollen.push(s);
      }
    }
    const haltVorher = z.baelle.map((b) => b.halt);
    const genutztVorher = z.aktuell.stoerGenutzt ?? 0;
    const schlaegeVorher = z.baelle.map((b) => b.schlaege);
    const lochVorher = z.aktuell.loch;
    const t0 = performance.now();
    schritt(z, [], karten);
    const dauer = performance.now() - t0;
    const genutzt = z.aktuell.stoerGenutzt ?? 0;
    let geschlagen = false;
    for (let s = 0; s < SITZE && s < z.baelle.length; s += 1) {
      if (z.baelle[s].schlaege > (schlaegeVorher[s] ?? 0)) geschlagen = true;
      if ((genutzt & ~genutztVorher & (1 << s)) !== 0) {
        const art = haltVorher[s] ?? '?';
        m.ausgeloest[art] = (m.ausgeloest[art] ?? 0) + 1;
      }
      if (mitStoer && istStoerart(z.baelle[s].halt) && haltVorher[s] !== z.baelle[s].halt) {
        m.eingesammelt += 1;
        if (fassung === 'umweg') {
          z.baelle[s].halt = null;
          z.aktuell.stoerGenutzt = (z.aktuell.stoerGenutzt ?? 0) | (1 << s);
        }
      }
      if (z.aktuell.loch === lochVorher) zuletzt[s] = z.baelle[s].halt;
    }
    const stoerTakt = genutzt !== genutztVorher || z.letzteEreignisse.some((e) => e.art === 'bombe');
    if (fassung === 'mit' && stoerTakt) {
      m.abgewehrt += z.letzteEreignisse.filter((e) => e.art === 'schild').length;
      if (wollen.length > 0) m.taktStoer.push(dauer);
    } else if (geschlagen) {
      m.taktSchlag.push(dauer);
    }
  }
  for (const h of zuletzt) if (istStoerart(h)) m.verfallen += 1;
  const summe = new Array<number>(SITZE).fill(0);
  for (const reihe of z.ergebnis) for (let s = 0; s < SITZE; s += 1) summe[s] += reihe?.[s] ?? 0;
  for (const s of summe) m.schlaege += s;
  m.abstaende.push(Math.max(...summe) - Math.min(...summe));
}

function leer(): Messung {
  return {
    schlaege: 0,
    abstaende: [],
    ausgeloest: {},
    abgewehrt: 0,
    gelegt: 0,
    eingesammelt: 0,
    verfallen: 0,
    zeitStoer: [],
    taktStoer: [],
    taktSchlag: [],
  };
}

/** Mittel und Standardfehler des Mittels. */
function mittelFehler(werte: readonly number[]): { mittel: number; fehler: number } {
  const n = werte.length;
  if (n === 0) return { mittel: 0, fehler: 0 };
  const mittel = werte.reduce((a, b) => a + b, 0) / n;
  const varianz = n > 1 ? werte.reduce((a, b) => a + (b - mittel) * (b - mittel), 0) / (n - 1) : 0;
  return { mittel, fehler: Math.sqrt(varianz / n) };
}

console.log(`=== Störschläge: ${SITZE} Bots, ${loecher} Löcher Fun-Modus, ${saaten} Saaten je Stufe ===`);
console.log(
  'Stufe       Schläge/Ball/Loch ohne → nur Umweg → mit  Abstand 1.–4. ohne → nur Umweg → mit (±SE)            ausgelöst je Loch B/K/T  je Loch ab 2  Schild fing  Störfelder gelegt/eingesammelt/verfallen je Loch',
);
const kosten: string[] = [];
for (const stufe of stufen) {
  const mit = leer();
  const ohne = leer();
  const umweg = leer();
  for (let saat = 1; saat <= saaten; saat += 1) {
    spiele(saat * 7919, stufe, 'mit', mit);
    spiele(saat * 7919, stufe, 'ohne', ohne);
    spiele(saat * 7919, stufe, 'umweg', umweg);
  }
  const lochZahl = saaten * loecher;
  const je = (x: number): string => (x / lochZahl).toFixed(2);
  const sb = (m: Messung): string => (m.schlaege / (lochZahl * SITZE)).toFixed(2);
  const ab = (m: Messung): string => {
    const r = mittelFehler(m.abstaende);
    return `${r.mittel.toFixed(2)}±${r.fehler.toFixed(2)}`;
  };
  const ausgeloest = (mit.ausgeloest.bombe ?? 0) + (mit.ausgeloest.klebefeld ?? 0) + (mit.ausgeloest.tausch ?? 0);
  const abZwei = loecher > 1 ? (ausgeloest / (saaten * (loecher - 1))).toFixed(2) : '-';
  console.log(
    `${stufe.padEnd(11)} ${`${sb(ohne)} → ${sb(umweg)} → ${sb(mit)}`.padEnd(37)} ${`${ab(ohne)} → ${ab(umweg)} → ${ab(mit)}`.padEnd(43)} ${`${je(mit.ausgeloest.bombe ?? 0)} / ${je(mit.ausgeloest.klebefeld ?? 0)} / ${je(mit.ausgeloest.tausch ?? 0)}`.padEnd(23)} ${abZwei.padEnd(13)} ${je(mit.abgewehrt).padEnd(12)} ${je(mit.gelegt)} / ${je(mit.eingesammelt)} / ${je(mit.verfallen)}`,
  );
  kosten.push(`${stufe.padEnd(11)} botStoerschlag ${zeitenText(mit.zeitStoer)}`);
  kosten.push(`${''.padEnd(11)} Takt Auslösen  ${zeitenText(mit.taktStoer)}`);
  kosten.push(`${''.padEnd(11)} Takt Schlag    ${zeitenText(mit.taktSchlag)}`);
}
console.log('\n=== Kosten je Entscheidung in ms: Median, p90, p99, max ===');
for (const zeile of kosten) console.log(zeile);
