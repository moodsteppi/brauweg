/**
 * Sagt `staerke` voraus, was im Kampf gewinnt?
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/bewertungsprobe.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --saaten 9           Wie viele Saaten je Paarung im Turnier darunter.
 *     --kopien 3           Einheiten je Seite, 2 bis 5.
 *     --saat turnier-v1    Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --stufe 1            Sternstufe. Gilt fuer Turnier UND Bewertung.
 *     --tabelle            Zusaetzlich jede Einheit einzeln.
 *     --json               Statt der Tabellen die rohe Auswertung als JSON.
 *
 * WOZU ES DA IST: Es beantwortet die Frage, an der die Board-Karte vom
 * 05.09.2026 zwei Wochen haengengeblieben ist — ob die Zahl, mit der der Bot
 * (und jede Balancing-Arbeit) Einheiten vergleicht, ueberhaupt zur
 * Kampfwirklichkeit passt. Ausgegeben wird die Rangkorrelation nach Spearman
 * zwischen `staerke` und der Siegquote aus `werkzeug/turnier.mjs`.
 *
 * ZWEI ZEILEN, UND DER UNTERSCHIED IST DER BEFUND: `staerke` nimmt die Deckung
 * als Parameter, und in der Vorgabe steht `KEINE_DECKUNG`. Am 22.09.2026 lag
 * "mit Deckung" bei +0,85 und "ohne" bei -0,13 — wer zwei Einheiten mit einem
 * blanken `staerke({ id, stufe: 1 })` vergleicht, bekommt also eine Rangfolge,
 * die der Kampfmessung widerspricht. Fuer den Bot ist die Vorgabe richtig (der
 * Reichweitenwert kommt bei ihm ueber `umfeldGewinn` herein, siehe
 * `kandidaten` in bot.ts); fuer einen Menschen ist sie eine Falle.
 *
 * WAS ES NICHT SAGT: ob der Bot gut spielt. Das beantwortet
 * `werkzeug/gangarten.mjs`, und zwar allein. Eine schlechte Korrelation hier
 * heisst nur, dass die ZAHL in die Irre fuehrt — der Bot entscheidet mit
 * Verschmelzungen, Marken und `umfeldGewinn` daneben. Wer das eine mit dem
 * anderen begruendet, begruendet nichts (derselbe Satz steht im Kopf von
 * turnier.mjs ueber das Verhaeltnis zu ausgewogenheit.mjs).
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt die Probe aus `dist/test/bewertungsprobe.js`
 * — dieselbe Datei, die auch test/bewertungsprobe.test.ts benutzt, und die
 * rechnet mit dem ECHTEN `staerke` aus src/bot.ts. Eine nachgebaute Formel im
 * Werkzeug waere der sichere Weg zu einer Probe, die gruen bleibt, waehrend
 * der Bot etwas anderes rechnet.
 *
 * Der Lauf ist vollstaendig bestimmt: dieselben Schalter ergeben dieselbe
 * Tabelle, auf jedem Rechner (game-api, Grundsatz 1).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const PROBESTAND = resolve(HIER, '../dist/test/bewertungsprobe.js');

if (!existsSync(PROBESTAND)) {
  console.error('Der Probestand fehlt: ' + PROBESTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

/*
 * Ueber `pathToFileURL` und nicht ueber den blanken Pfad: Unter Windows faengt
 * ein absoluter Pfad mit "C:" an, und den haelt der ESM-Lader fuer ein
 * Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
 */
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { bewertungsprobe } = await laden(PROBESTAND);

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}
const gesetzt = (name) => process.argv.includes(`--${name}`);

const SAATEN = Number(schalter('saaten', '9'));
const KOPIEN = Number(schalter('kopien', '3'));
const SAAT_BASIS = schalter('saat', 'turnier-v1');
const STUFE = Number(schalter('stufe', '1'));

for (const [name, wert] of [
  ['saaten', SAATEN],
  ['kopien', KOPIEN],
  ['stufe', STUFE],
]) {
  if (!Number.isInteger(wert) || wert < 1) {
    console.error(`--${name} braucht eine ganze Zahl ab 1`);
    process.exit(1);
  }
}

const beginn = Date.now();
const befund = bewertungsprobe({
  saaten: SAATEN,
  kopien: KOPIEN,
  saatBasis: SAAT_BASIS,
  stufe: STUFE,
});
const dauer = ((Date.now() - beginn) / 1000).toFixed(1);

if (gesetzt('json')) {
  console.log(JSON.stringify({ bewertungsprobe: befund }, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Die Ausgabe
// ---------------------------------------------------------------------------

/** `null` heisst "keine Reihenfolge da", nicht "null Zusammenhang". */
const zahl = (w) => (w === null ? '   —  ' : (w >= 0 ? '+' : '') + w.toFixed(3));

console.log('');
console.log('Tafelrunde — sagt `staerke` voraus, was im Kampf gewinnt?');
console.log(
  `Sternstufe ${STUFE}, ${KOPIEN} Kopien je Seite, ${SAATEN} Saaten je Paarung, ` +
    `Saatbasis "${SAAT_BASIS}", ${dauer} s`,
);
console.log('Rangkorrelation nach Spearman gegen die Siegquote des Monokultur-Turniers.');
console.log('');
console.log('  Kostenstufe        mit Deckung   ohne Deckung (die Vorgabe)');
for (const s of befund.stufen) {
  console.log(
    `  ${String(s.kosten).padStart(2)} Gold` + ' '.repeat(13) +
      zahl(s.mitDeckung).padStart(7) + zahl(s.ohneDeckung).padStart(15),
  );
}
console.log('  ' + '-'.repeat(52));
console.log(
  '  Schnitt' + ' '.repeat(12) +
    zahl(befund.mitDeckung).padStart(7) + zahl(befund.ohneDeckung).padStart(15),
);
console.log('');

if (gesetzt('tabelle')) {
  for (const s of befund.stufen) {
    console.log(`  === ${s.kosten} Gold ===`);
    console.log(
      '  ' + 'Einheit'.padEnd(18) + 'Rolle'.padEnd(10) +
        'Quote'.padStart(7) + 'mit Dg.'.padStart(9) + 'ohne Dg.'.padStart(10),
    );
    for (const z of s.zeilen) {
      console.log(
        '  ' + z.name.padEnd(18) + z.rolle.padEnd(10) +
          `${(z.quote * 100).toFixed(1)}%`.padStart(7) +
          String(z.mitDeckung).padStart(9) + String(z.ohneDeckung).padStart(10),
      );
    }
    console.log('');
  }
}
