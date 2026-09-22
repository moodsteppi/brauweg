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
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { Karte } from '../src/minispiele/golf/karte';
import { botLoestKarte } from '../src/minispiele/golf/karten-pruefen';
import type { Botstufe } from '../src/minispiele/golf/physik';

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

for (const stufe of stufen) {
  const zeilen: Zeile[] = [];
  for (const karte of karten) {
    let geloest = 0;
    let summe = 0;
    for (let saat = 1; saat <= saaten; saat += 1) {
      const r = botLoestKarte(karte, stufe, saat * 7919);
      if (r.geloest) geloest += 1;
      summe += r.geloest ? r.schlaege : karte.schlagLimit + 1;
    }
    zeilen.push({ id: karte.id, quote: geloest / saaten, schlaege: summe / saaten });
  }
  messung[stufe] = zeilen;

  const mittel = (liste: Zeile[], feld: 'quote' | 'schlaege'): number =>
    liste.length === 0 ? 0 : liste.reduce((s, z) => s + z[feld], 0) / liste.length;
  const vorher = alt?.[stufe] ?? null;
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

  console.log(`\n=== ${stufe} (${saaten} Saaten je Bahn) ===`);
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

if (jsonZiel !== '') writeFileSync(jsonZiel, JSON.stringify(messung, null, 1));
