/**
 * Wie gut spielen die Golf-Bots? — Messung ueber den ganzen Katalog.
 *
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts --saaten 30 --stufe genie
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts --karten k04,k12 --stufe genie
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts --json vorher.json
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts --vergleich vorher.json
 *
 * WARUM ES DIESES WERKZEUG GIBT. Am Bot laesst sich nichts „ansehen": Ob eine
 * Aenderung ihn besser oder schlechter macht, entscheidet allein die Zahl der
 * Schlaege ueber viele Saaten und alle vierzig Bahnen. Einzelne Partien sagen
 * gar nichts — die Streuung je Stufe ist groesser als der Unterschied, den
 * eine Regelaenderung ausmacht.
 *
 * WAS ES MISST, je Bahn und ueber alle Bahnen:
 *   - Quote: Anteil der Laeufe, in denen der Bot ueberhaupt einlocht.
 *   - Schlaege: Mittel ueber die geloesten Laeufe (ungeloeste zaehlen mit
 *     `schlagLimit + 1`, so wie es die Partie selbst wertet).
 * Die Bahnen mit Sand oder Eis stehen zusaetzlich als eigene Gruppe darunter:
 * Genau dort schlaegt eine Aenderung an der Kraftrechnung durch, und im
 * Gesamtmittel ueber vierzig Bahnen wuerde sie sonst untergehen.
 *
 * Seit dem 22.09.2026 dazu je Zonenart eine Gruppe (Beschleuniger, Bumper,
 * Strudel, Sprungfeld, Drehkreuz — die fuenf, die der Bot bis dahin fuer
 * Rasen hielt) und die Kennbuchstaben der Zonen hinter jeder Bahn. Anlass:
 * Der Bot lernte diese fuenf Arten eine nach der anderen, und die Regel war
 * „eine Aenderung, die eine Bahn verschlechtert, bleibt nicht drin". Das
 * prueft `--vergleich` gegen eine mit `--json` gespeicherte Messung: Es
 * zeigt je Bahn den Unterschied und markiert jede, die schlechter wurde.
 * `--karten` grenzt auf einzelne Bahnen ein (Anfang der Kennung genuegt),
 * damit das Nachfahren einer Art nicht jedes Mal den ganzen Katalog kostet.
 *
 * Seit dem 22.09.2026 (Fun-Modus) misst `--modifikator wind,regen` bzw.
 * `--modifikator alle` dieselbe Tabelle mit einem festen Roulette-
 * Modifikator auf jeder Bahn (der Wind dreht je Saat mit), dahinter eine
 * Uebersicht Modifikator × Stufe. `--kosten` misst dazu die Rechenzeit je
 * Bot-Entscheidung (Median, p90, p99, Hoechstwert) — die Takte, in denen der
 * Bot schlaegt, samt der Physik dieses Takts. Die Kosten zaehlen doppelt:
 * Jedes Rueckspulen rechnet die Entscheidungen ab dort neu, und auf dem
 * Handy kostet jede ein Vielfaches.
 *
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts --modifikator alle --kosten
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { Karte } from '../src/minispiele/golf/karte';
import { botLoestKarte } from '../src/minispiele/golf/karten-pruefen';
import {
  type Lochmodifikatoren,
  OHNE_MODIFIKATOR,
  ROULETTE,
  type Rouletteart,
  festerModifikator,
} from '../src/minispiele/golf/modifikator';
import {
  type Botstufe,
  neuePartie,
  physikwerte,
  schlagErlaubt,
  schritt,
  starteLoch,
} from '../src/minispiele/golf/physik';

/*
 * Der Katalog wird hier selbst eingesammelt, nicht aus `karten/index.ts`
 * importiert. Seit #206 (22.09.2026) liegt jede Bahn in einer eigenen Datei,
 * und `index.ts` sammelt sie per `import.meta.glob` ein — das kann nur Vite,
 * unter `tsx` bricht der Import ab. Dasselbe Muster wie dort (`kNN-*.ts`
 * ohne `*.test.ts`, sortiert nach Dateiname), also dieselbe Liste.
 */
const KARTEN_ORDNER = new URL('../src/minispiele/golf/karten/', import.meta.url);
const KARTEN: Karte[] = [];
const kartenDateien = readdirSync(KARTEN_ORDNER)
  .filter((d) => /^k\d\d-.*\.ts$/.test(d) && !d.endsWith('.test.ts'))
  .sort();
for (const datei of kartenDateien) {
  const modul = (await import(new URL(datei, KARTEN_ORDNER).href)) as { bahn?: Karte };
  if (modul.bahn !== undefined) KARTEN.push(modul.bahn);
}

const args = process.argv.slice(2);
function schalter(name: string, vorgabe: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : vorgabe;
}

const saaten = Number(schalter('saaten', '20'));
const stufen = schalter('stufe', 'genie,experte,standard,anfaenger').split(',') as Botstufe[];
const filter = schalter('karten', '')
  .split(',')
  .filter((s) => s.length > 0);
const jsonZiel = schalter('json', '');
const vergleichQuelle = schalter('vergleich', '');
const modSchalter = schalter('modifikator', '');
/** `null` ist der klassische Modus. */
const modifikatoren: (Rouletteart | null)[] =
  modSchalter === ''
    ? [null]
    : modSchalter === 'alle'
      ? [null, ...ROULETTE]
      : modSchalter.split(',').map((m) => {
          if (m === 'keiner') return null;
          if (!(ROULETTE as readonly string[]).includes(m)) {
            throw new Error(`unbekannter Modifikator ${m} — bekannt: ${ROULETTE.join(', ')}, keiner, alle`);
          }
          return m as Rouletteart;
        });
const mitKosten = args.includes('--kosten');

function modFuer(art: Rouletteart | null, saat: number): Lochmodifikatoren {
  return art === null ? OHNE_MODIFIKATOR : festerModifikator(art, saat, 0);
}

/**
 * Wie `botLoestKarte`, misst aber die Rechenzeit jedes Takts, in dem der Bot
 * entscheidet. Welcher das ist, steht vor dem Takt fest (dieselbe Bedingung
 * wie in `botsEntscheiden`): Er darf schlagen, denkt schon und hat seine
 * Denkzeit abgesessen.
 */
function kostenLauf(
  karte: Karte,
  stufe: Botstufe,
  saat: number,
  mod: Lochmodifikatoren,
): { geloest: boolean; schlaege: number; zeiten: number[] } {
  const z = neuePartie({ saat, sitze: 1, botSitze: [0], loecher: 1, botStufe: stufe, karten: [karte] });
  starteLoch(z, 0, 0, [karte]);
  z.aktuell.mod = mod;
  const deckel = 3000 * physikwerte(mod, karte).zeitlimit;
  const zeiten: number[] = [];
  while (z.takt < deckel && z.aktuell.endeTakt === -1) {
    const entscheidet =
      schlagErlaubt(z, 0) && z.botWartet[0] !== -1 && z.takt - z.botWartet[0] >= z.botDenkzeit[0];
    const t0 = entscheidet ? performance.now() : 0;
    schritt(z, [], [karte]);
    if (entscheidet) zeiten.push(performance.now() - t0);
  }
  const ball = z.baelle[0];
  return { geloest: ball.eingelocht, schlaege: ball.schlaege, zeiten };
}

function perzentil(sortiert: readonly number[], anteil: number): number {
  if (sortiert.length === 0) return 0;
  const i = Math.min(sortiert.length - 1, Math.floor(anteil * sortiert.length));
  return sortiert[i];
}

const karten = filter.length === 0 ? KARTEN : KARTEN.filter((k) => filter.some((f) => k.id.startsWith(f)));

/** Kennbuchstaben je Zonenart fuer die Zeile hinter der Bahn. */
const KUERZEL: Record<string, string> = {
  sand: 'S',
  eis: 'E',
  wasser: 'W',
  portal: 'P',
  beschleuniger: 'B',
  bumper: 'U',
  strudel: 'T',
  sprungfeld: 'F',
  drehkreuz: 'D',
};
/** Die fuenf Arten, die der Bot bis zum 22.09.2026 nicht kannte. */
const NEUE_ARTEN = ['beschleuniger', 'bumper', 'strudel', 'sprungfeld', 'drehkreuz'] as const;

function arten(id: string): Set<string> {
  const karte = KARTEN.find((k) => k.id === id);
  return new Set(karte === undefined ? [] : karte.zonen.map((z) => z.art));
}

function hatUntergrund(id: string): boolean {
  const a = arten(id);
  return a.has('sand') || a.has('eis');
}

interface Zeile {
  id: string;
  quote: number;
  schlaege: number;
}
type Messung = Record<string, Zeile[]>;

const alt: Messung | null = vergleichQuelle === '' ? null : (JSON.parse(readFileSync(vergleichQuelle, 'utf8')) as Messung);
const messung: Messung = {};
/** Je Modifikator und Stufe: Mittel über alle Bahnen und die Entscheidungskosten. */
const uebersicht: { art: string; stufe: Botstufe; quote: number; schlaege: number; zeiten: number[] }[] = [];

for (const art of modifikatoren) for (const stufe of stufen) {
  // Klassisch unter dem alten Schlüssel, damit alte --json-Dateien weiter vergleichbar sind.
  const schluessel = art === null ? stufe : `${art}/${stufe}`;
  const zeilen: Zeile[] = [];
  const zeiten: number[] = [];
  for (const karte of karten) {
    let geloest = 0;
    let summe = 0;
    for (let saat = 1; saat <= saaten; saat += 1) {
      const s = saat * 7919;
      const mod = modFuer(art, s);
      let r: { geloest: boolean; schlaege: number };
      if (mitKosten) {
        const k = kostenLauf(karte, stufe, s, mod);
        for (const t of k.zeiten) zeiten.push(t);
        r = k;
      } else {
        r = botLoestKarte(karte, stufe, s, mod);
      }
      if (r.geloest) geloest += 1;
      summe += r.geloest ? r.schlaege : karte.schlagLimit + 1;
    }
    zeilen.push({ id: karte.id, quote: geloest / saaten, schlaege: summe / saaten });
  }
  messung[schluessel] = zeilen;

  const mittel = (liste: Zeile[], feld: 'quote' | 'schlaege'): number =>
    liste.length === 0 ? 0 : liste.reduce((s, z) => s + z[feld], 0) / liste.length;
  zeiten.sort((a, b) => a - b);
  uebersicht.push({ art: art ?? 'klassisch', stufe, quote: mittel(zeilen, 'quote'), schlaege: mittel(zeilen, 'schlaege'), zeiten });
  const vorher = alt?.[schluessel] ?? null;
  const altVon = (id: string): Zeile | undefined => vorher?.find((z) => z.id === id);
  const gruppe = (name: string, liste: Zeile[]): void => {
    let text = `  ${name.padEnd(22)} Quote ${(mittel(liste, 'quote') * 100).toFixed(1).padStart(5)} %  Schlaege ${mittel(liste, 'schlaege').toFixed(2)}`;
    if (vorher !== null) {
      const altListe = liste.map((z) => altVon(z.id)).filter((z): z is Zeile => z !== undefined);
      if (altListe.length === liste.length) {
        text += `   vorher ${(mittel(altListe, 'quote') * 100).toFixed(1).padStart(5)} %  ${mittel(altListe, 'schlaege').toFixed(2)}`;
      }
    }
    console.log(text);
  };

  console.log(`\n=== ${art === null ? '' : `${art} · `}${stufe} (${saaten} Saaten je Bahn) ===`);
  const schlechter: string[] = [];
  for (const z of zeilen) {
    const a = arten(z.id);
    const marke = hatUntergrund(z.id) ? '*' : ' ';
    const kuerzel = [...a].map((art) => KUERZEL[art] ?? '?').join('');
    let text = `${marke} ${z.id.padEnd(34)} ${kuerzel.padEnd(7)} Quote ${(z.quote * 100).toFixed(0).padStart(3)} %   Schlaege ${z.schlaege.toFixed(2)}`;
    const v = altVon(z.id);
    if (v !== undefined) {
      const diff = z.schlaege - v.schlaege;
      // Schon ein Zwanzigstel Schlag im Mittel ist ein Lauf mit einem Schlag
      // mehr — bei 20 Saaten ist das die kleinste messbare Verschlechterung.
      const warn = diff > 1e-9 || z.quote < v.quote - 1e-9;
      text += `   (${diff >= 0 ? '+' : ''}${diff.toFixed(2)})${warn ? '  SCHLECHTER' : ''}`;
      if (warn) schlechter.push(z.id);
    }
    console.log(text);
  }
  gruppe(`ALLE (${zeilen.length})`, zeilen);
  gruppe(`* Sand/Eis (${zeilen.filter((z) => hatUntergrund(z.id)).length})`, zeilen.filter((z) => hatUntergrund(z.id)));
  gruppe(`ohne (${zeilen.filter((z) => !hatUntergrund(z.id)).length})`, zeilen.filter((z) => !hatUntergrund(z.id)));
  for (const art of NEUE_ARTEN) {
    const liste = zeilen.filter((z) => arten(z.id).has(art));
    if (liste.length > 0) gruppe(`${KUERZEL[art]} ${art} (${liste.length})`, liste);
  }
  if (vorher !== null) {
    console.log(schlechter.length === 0 ? '  keine Bahn schlechter' : `  SCHLECHTER: ${schlechter.join(', ')}`);
  }
}

if (modifikatoren.length > 1 || mitKosten) {
  console.log(`\n=== Übersicht (${karten.length} Bahnen, ${saaten} Saaten) ===`);
  console.log(
    `  ${'Modifikator'.padEnd(12)} ${'Stufe'.padEnd(10)} Quote    Schläge${mitKosten ? '   Entscheidung ms: Median   p90    p99    max' : ''}`,
  );
  for (const u of uebersicht) {
    let text = `  ${u.art.padEnd(12)} ${u.stufe.padEnd(10)} ${(u.quote * 100).toFixed(1).padStart(5)} %  ${u.schlaege.toFixed(2).padStart(5)}`;
    if (mitKosten) {
      const z = u.zeiten;
      text += `                    ${perzentil(z, 0.5).toFixed(2).padStart(5)}  ${perzentil(z, 0.9).toFixed(2).padStart(5)}  ${perzentil(z, 0.99).toFixed(2).padStart(5)}  ${(z[z.length - 1] ?? 0).toFixed(2).padStart(5)}`;
    }
    console.log(text);
  }
}

if (jsonZiel !== '') writeFileSync(jsonZiel, JSON.stringify(messung, null, 1));
