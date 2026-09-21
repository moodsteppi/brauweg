/**
 * Wie gut spielen die Golf-Bots? — Messung ueber den ganzen Katalog.
 *
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts
 *   npx tsx packages/client/werkzeug/golf-botprobe.ts --saaten 30 --stufe genie
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
 */
import { KARTEN } from '../src/minispiele/golf/karten/index';
import { botLoestKarte } from '../src/minispiele/golf/karten-pruefen';
import type { Botstufe } from '../src/minispiele/golf/physik';

const args = process.argv.slice(2);
function schalter(name: string, vorgabe: string): string {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : vorgabe;
}

const saaten = Number(schalter('saaten', '20'));
const stufen = schalter('stufe', 'genie,experte,standard,anfaenger').split(',') as Botstufe[];

function hatUntergrund(id: string): boolean {
  const karte = KARTEN.find((k) => k.id === id);
  if (karte === undefined) return false;
  return karte.zonen.some((z) => z.art === 'sand' || z.art === 'eis');
}

for (const stufe of stufen) {
  const zeilen: { id: string; quote: number; schlaege: number; sonder: boolean }[] = [];
  for (const karte of KARTEN) {
    let geloest = 0;
    let summe = 0;
    for (let saat = 1; saat <= saaten; saat += 1) {
      const r = botLoestKarte(karte, stufe, saat * 7919);
      if (r.geloest) geloest += 1;
      summe += r.geloest ? r.schlaege : karte.schlagLimit + 1;
    }
    zeilen.push({
      id: karte.id,
      quote: geloest / saaten,
      schlaege: summe / saaten,
      sonder: hatUntergrund(karte.id),
    });
  }

  const mittel = (liste: typeof zeilen, feld: 'quote' | 'schlaege'): number =>
    liste.length === 0 ? 0 : liste.reduce((s, z) => s + z[feld], 0) / liste.length;
  const sonder = zeilen.filter((z) => z.sonder);
  const rest = zeilen.filter((z) => !z.sonder);

  console.log(`\n=== ${stufe} (${saaten} Saaten je Bahn) ===`);
  for (const z of zeilen) {
    const marke = z.sonder ? '*' : ' ';
    console.log(
      `${marke} ${z.id.padEnd(28)} Quote ${(z.quote * 100).toFixed(0).padStart(3)} %   Schlaege ${z.schlaege.toFixed(2)}`,
    );
  }
  console.log(
    `  ALLE          Quote ${(mittel(zeilen, 'quote') * 100).toFixed(1)} %  Schlaege ${mittel(zeilen, 'schlaege').toFixed(2)}`,
  );
  console.log(
    `  * Sand/Eis (${sonder.length}) Quote ${(mittel(sonder, 'quote') * 100).toFixed(1)} %  Schlaege ${mittel(sonder, 'schlaege').toFixed(2)}`,
  );
  console.log(
    `    ohne (${rest.length})       Quote ${(mittel(rest, 'quote') * 100).toFixed(1)} %  Schlaege ${mittel(rest, 'schlaege').toFixed(2)}`,
  );
}
