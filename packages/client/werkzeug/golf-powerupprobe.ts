/**
 * Was machen die Golf-Bots mit Power-ups? — Messung über den ganzen Katalog
 * (Fun-Modus, Teil 2/3, seit dem 23.09.2026).
 *
 *   npx tsx packages/client/werkzeug/golf-powerupprobe.ts
 *   npx tsx packages/client/werkzeug/golf-powerupprobe.ts --saaten 10 --stufe genie,standard
 *   npx tsx packages/client/werkzeug/golf-powerupprobe.ts --karten k04,k39
 *
 * WARUM EIN EIGENES WERKZEUG neben `golf-botprobe.ts`: Die Botprobe misst
 * einen Bot allein auf einer Bahn. Ein Power-up misst sich so nur halb — das
 * Schild wirkt erst, wenn ein anderer Ball stößt, und ob Bots Felder
 * einsammeln, sieht man erst, wenn mehrere um sie rollen.
 *
 * ZWEI MESSUNGEN:
 *
 *   1. „Gehalten": Ein Bot allein, er hält die Art schon am Abschlag, keine
 *      Felder. Sein erster Schlag ist also der mit dem Power-up. Gemessen
 *      werden Schläge und Quote WISSEND (der Bot plant mit dem, was er hält)
 *      gegen BLIND (dieselbe Physik, aber er entscheidet auf einer Kopie ohne
 *      das Power-up — so, als wüsste er nichts davon). Der Abstand ist das,
 *      was „sinnvoll einsetzen" bringt. Dazu die Rechenzeit je Entscheidung.
 *   2. „Felder": vier Bots, die Felder des Lochs aus Saat und Bahn wie im
 *      Spiel, gegen dasselbe ohne Felder. Gemessen: Schläge je Ball,
 *      eingesammelte Felder je Loch, vom Schild abgefangene Stöße je Loch,
 *      und die Kosten eines Takts, in dem ein Bot entscheidet.
 *
 * Roulette gibt es in beiden Messungen keines: Die Felder hängen an einem
 * Modifikator ohne Roulette, gemessen wird nur das Power-up.
 */
import { readdirSync } from 'node:fs';

import { botEntscheidung } from '../src/minispiele/golf/bot';
import type { Karte } from '../src/minispiele/golf/karte';
import type { Lochmodifikatoren } from '../src/minispiele/golf/modifikator';
import {
  type Botstufe,
  type Ereignis,
  kopiere,
  neuePartie,
  schlagErlaubt,
  schritt,
  starteLoch,
} from '../src/minispiele/golf/physik';
import { KEINE_FELDER, type Powerupart, powerupsFuerLoch } from '../src/minispiele/golf/powerup';
import { mulberry32 } from '../src/minispiele/golf/zufall';

/* Der Katalog wie in golf-botprobe.ts: `import.meta.glob` kann nur Vite. */
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
const saaten = Number(schalter('saaten', '20'));
const stufen = schalter('stufe', 'genie,experte,standard,anfaenger').split(',') as Botstufe[];
const filter = schalter('karten', '')
  .split(',')
  .filter((s) => s.length > 0);
const karten = filter.length === 0 ? KARTEN : KARTEN.filter((k) => filter.some((f) => k.id.startsWith(f)));

function mitFeldern(felder: Lochmodifikatoren['powerups']): Lochmodifikatoren {
  return { roulette: null, wind: null, powerups: felder };
}

function perzentil(sortiert: readonly number[], anteil: number): number {
  if (sortiert.length === 0) return 0;
  return sortiert[Math.min(sortiert.length - 1, Math.floor(anteil * sortiert.length))];
}

function zeitenText(z: number[]): string {
  z.sort((a, b) => a - b);
  return `${perzentil(z, 0.5).toFixed(2).padStart(5)}  ${perzentil(z, 0.9).toFixed(2).padStart(5)}  ${perzentil(z, 0.99).toFixed(2).padStart(5)}  ${(z[z.length - 1] ?? 0).toFixed(2).padStart(5)}`;
}

/* --------------------------------------------------------------------------
 * 1. Gehalten
 * ----------------------------------------------------------------------- */

/**
 * Ein Loch, ein Bot, der Bot entscheidet von außen (statt in `schritt`),
 * damit er wahlweise auf einer Kopie OHNE sein Power-up planen kann. Die
 * Physik bekommt den Schlag als Ereignis — mit dem Power-up am echten Ball.
 */
function gehalten(
  karte: Karte,
  stufe: Botstufe,
  saat: number,
  art: Powerupart | null,
  blind: boolean,
): { geloest: boolean; schlaege: number; zeiten: number[] } {
  const z = neuePartie({ saat, sitze: 1, botSitze: [], loecher: 1, botStufe: stufe, karten: [karte] });
  starteLoch(z, 0, 0, [karte]);
  z.aktuell.mod = mitFeldern(KEINE_FELDER);
  z.baelle[0].halt = art;
  let zufall = mulberry32(saat ^ 0x51f15e);
  const zeiten: number[] = [];
  let ruhig = 0;
  let nr = 0;
  const deckel = karte.zeitLimitS * 20;
  while (z.takt < deckel && z.aktuell.endeTakt === -1) {
    const ereignisse: Ereignis[] = [];
    // Wie die Denkzeit: ein paar Takte Ruhe, dann schlagen.
    ruhig = schlagErlaubt(z, 0) ? ruhig + 1 : 0;
    if (ruhig > 5) {
      const sicht = blind ? kopiere(z) : z;
      if (blind) sicht.baelle[0].halt = null;
      const t0 = performance.now();
      const e = botEntscheidung(sicht, 0, karte, zufall);
      zeiten.push(performance.now() - t0);
      zufall = e.zufall;
      if (e.schlag !== null) {
        ereignisse.push({ takt: z.takt, sitz: 0, nr, art: 'schlag', ...e.schlag });
        nr += 1;
      }
      ruhig = 0;
    }
    schritt(z, ereignisse, [karte]);
  }
  const b = z.baelle[0];
  return { geloest: b.eingelocht, schlaege: b.schlaege, zeiten };
}

console.log(`=== Gehalten: ein Bot, das Power-up am Abschlag (${karten.length} Bahnen × ${saaten} Saaten) ===`);
console.log(`  ${'Power-up'.padEnd(9)} ${'Stufe'.padEnd(10)} wissend           blind             Entscheidung ms: Median   p90    p99    max`);
for (const art of [null, 'turbo', 'magnet', 'geist'] as const) {
  for (const stufe of stufen) {
    const werte = { wissend: { q: 0, s: 0 }, blind: { q: 0, s: 0 } };
    const zeiten: number[] = [];
    for (const karte of karten) {
      for (let saat = 1; saat <= saaten; saat += 1) {
        for (const blind of art === null ? [false] : [false, true]) {
          const r = gehalten(karte, stufe, saat * 7919, art, blind);
          const w = blind ? werte.blind : werte.wissend;
          if (r.geloest) w.q += 1;
          w.s += r.geloest ? r.schlaege : karte.schlagLimit + 1;
          if (!blind) for (const t of r.zeiten) zeiten.push(t);
        }
      }
    }
    const n = karten.length * saaten;
    const text = (w: { q: number; s: number }): string =>
      `${(w.s / n).toFixed(2)} (${((w.q / n) * 100).toFixed(1).padStart(5)} %)`;
    console.log(
      `  ${(art ?? 'keins').padEnd(9)} ${stufe.padEnd(10)} ${text(werte.wissend).padEnd(17)} ${art === null ? '—'.padEnd(17) : text(werte.blind).padEnd(17)}                   ${zeitenText(zeiten)}`,
    );
  }
}

/* --------------------------------------------------------------------------
 * 2. Felder
 * ----------------------------------------------------------------------- */

const SITZE = 4;

function felderLauf(
  karte: Karte,
  stufe: Botstufe,
  saat: number,
  mitFeld: boolean,
): { schlaege: number; eingesammelt: number; schild: number; zeiten: number[] } {
  const z = neuePartie({
    saat,
    sitze: SITZE,
    botSitze: [0, 1, 2, 3],
    loecher: 1,
    botStufe: stufe,
    karten: [karte],
  });
  starteLoch(z, 0, 0, [karte]);
  z.aktuell.mod = mitFeldern(mitFeld ? powerupsFuerLoch(saat, 0, karte) : KEINE_FELDER);
  let eingesammelt = 0;
  let schild = 0;
  const zeiten: number[] = [];
  const deckel = karte.zeitLimitS * 20 + 5;
  while (z.takt < deckel && z.aktuell.endeTakt === -1) {
    let entscheidet = false;
    for (let s = 0; s < SITZE; s += 1) {
      if (schlagErlaubt(z, s) && z.botWartet[s] !== -1 && z.takt - z.botWartet[s] >= z.botDenkzeit[s]) entscheidet = true;
    }
    const t0 = entscheidet ? performance.now() : 0;
    schritt(z, [], [karte]);
    if (entscheidet) zeiten.push(performance.now() - t0);
    for (const e of z.letzteEreignisse) {
      if (e.art === 'powerup') eingesammelt += 1;
      else if (e.art === 'schild') schild += 1;
    }
  }
  let schlaege = 0;
  for (const b of z.baelle) schlaege += b.eingelocht ? b.schlaege : karte.schlagLimit + 1;
  return { schlaege: schlaege / SITZE, eingesammelt, schild, zeiten };
}

console.log(`\n=== Felder: vier Bots, Felder aus Saat und Bahn (${karten.length} Bahnen × ${saaten} Saaten) ===`);
console.log(`  ${'Stufe'.padEnd(10)} ohne Felder  mit Feldern  eingesammelt/Loch  Schild/Loch   Takt mit Entscheidung ms: Median   p90    p99    max`);
for (const stufe of stufen) {
  let ohne = 0;
  let mit = 0;
  let eingesammelt = 0;
  let felderGesamt = 0;
  let schild = 0;
  const zeiten: number[] = [];
  for (const karte of karten) {
    for (let saat = 1; saat <= saaten; saat += 1) {
      const s = saat * 7919;
      ohne += felderLauf(karte, stufe, s, false).schlaege;
      const r = felderLauf(karte, stufe, s, true);
      mit += r.schlaege;
      eingesammelt += r.eingesammelt;
      felderGesamt += powerupsFuerLoch(s, 0, karte).length;
      schild += r.schild;
      for (const t of r.zeiten) zeiten.push(t);
    }
  }
  const n = karten.length * saaten;
  console.log(
    `  ${stufe.padEnd(10)} ${(ohne / n).toFixed(2).padStart(11)}  ${(mit / n).toFixed(2).padStart(11)}  ${(eingesammelt / n).toFixed(2).padStart(6)} von ${(felderGesamt / n).toFixed(2)}  ${(schild / n).toFixed(2).padStart(11)}                        ${zeitenText(zeiten)}`,
  );
}
