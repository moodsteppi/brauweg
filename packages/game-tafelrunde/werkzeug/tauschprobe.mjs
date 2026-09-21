/**
 * Die Tauschprobe als Tabelle: jede Einheit auf denselben echten Brettern.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/tauschprobe.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --partien 300        Wie viele Botpartien die Bretter liefern.
 *     --sitze 4            Sitze am Tisch, 2 bis 8.
 *     --besetzung normal   normal | sanft | hart | gemischt
 *     --kontexte 200       Bretter je Kostenstufe.
 *     --saaten 1           Saaten je Kontext und Seite.
 *     --saat tausch-v1     Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --zeitraffer 2       Wie im Kampf; nur fuer Vergleichslaeufe.
 *     --heilung 1.5        HEILUNG_FAKTOR, nur fuer Vergleichslaeufe.
 *     --json               Statt der Tabellen die rohe Auswertung als JSON.
 *
 * WOZU ES DA IST: Es beantwortet "ist diese Einheit zu stark", und zwar als
 * einziges der drei Werkzeuge. `ausgewogenheit.mjs` misst mit der rohen
 * Siegquote den Wohlstand des Bretts mit (nachgewiesen an der Lichtwahrerin,
 * neunte Messung), `turnier.mjs` misst drei Kopien im luftleeren Raum. Hier
 * steht dasselbe gespielte Brett zweimal da und unterscheidet sich in genau
 * einer Einheit auf genau einem Platz.
 *
 * WIE MAN ES LIEST: Die Zeilen einer Kostenstufe haben alle denselben Nenner.
 * Der Index ist die Quote zum Schnitt der Stufe — 1,00 heisst "so gut wie der
 * Durchschnitt dessen, was man fuer dasselbe Gold auf den Platz stellen
 * koennte". Was das Werkzeug NICHT sagt: wie oft die Einheit im Spiel
 * ueberhaupt vorkommt. Das steht in den Antritten von ausgewogenheit.mjs, und
 * die beiden Zahlen gehoeren nebeneinander gelesen.
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt die Probe aus `dist/test/tauschprobe.js`
 * — dieselbe Datei, die auch test/tauschprobe.test.ts benutzt. Eine zweite
 * Fassung des Messverfahrens im Werkzeug waere der sichere Weg zu zwei Zahlen
 * fuer dieselbe Frage.
 *
 * Der Lauf ist vollstaendig bestimmt: dieselben Schalter ergeben dieselbe
 * Tabelle, auf jedem Rechner (game-api, Grundsatz 1).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const PROBENSTAND = resolve(HIER, '../dist/test/tauschprobe.js');

if (!existsSync(PROBENSTAND)) {
  console.error('Der Probenstand fehlt: ' + PROBENSTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

// Ueber `pathToFileURL`: Unter Windows haelt der ESM-Lader das "C:" eines
// absoluten Pfades fuer ein Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { tauschprobe } = await laden(PROBENSTAND);
const { ACHT_SITZE } = await laden(resolve(HIER, '../dist/test/messen.js'));
const { STANDARD_REGLER } = await laden(resolve(HIER, '../dist/src/index.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const PARTIEN = Number(schalter('partien', '300'));
const SITZZAHL = Number(schalter('sitze', '4'));
const BESETZUNG = schalter('besetzung', 'normal');
const KONTEXTE = Number(schalter('kontexte', '200'));
const SAATEN = Number(schalter('saaten', '1'));
const SAAT_BASIS = schalter('saat', 'tausch-v1');
const ZEITRAFFER = Number(schalter('zeitraffer', STANDARD_REGLER.zeitraffer));
const HEILUNG = Number(schalter('heilung', STANDARD_REGLER.heilungFaktor));
const ALS_JSON = process.argv.includes('--json');

for (const [name, wert, ab] of [
  ['partien', PARTIEN, 1],
  ['kontexte', KONTEXTE, 1],
  ['saaten', SAATEN, 1],
]) {
  if (!Number.isInteger(wert) || wert < ab) {
    console.error(`--${name} braucht eine ganze Zahl ab ${ab}`);
    process.exit(1);
  }
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}
if (!['normal', 'sanft', 'hart', 'gemischt'].includes(BESETZUNG)) {
  console.error('--besetzung kennt nur normal, sanft, hart und gemischt');
  process.exit(1);
}
if (!Number.isFinite(ZEITRAFFER) || ZEITRAFFER <= 0) {
  console.error('--zeitraffer braucht eine Zahl groesser als null');
  process.exit(1);
}
// Die Null ist hier erlaubt, anders als beim Zeitraffer: Sie ist der
// Vergleichslauf gegen den Stand vor der Beistand-Wirkung.
if (!Number.isFinite(HEILUNG) || HEILUNG < 0) {
  console.error('--heilung braucht eine Zahl ab null');
  process.exit(1);
}

const REGLER = { ...STANDARD_REGLER, zeitraffer: ZEITRAFFER, heilungFaktor: HEILUNG };

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const p1 = (zahl) => `${(zahl * 100).toFixed(1)} %`;

function tabelle(kopf, zeilen) {
  const alle = [kopf, ...zeilen];
  const breiten = kopf.map((_, spalte) =>
    Math.max(...alle.map((z) => String(z[spalte] ?? '').length)),
  );
  const zeile = (z) =>
    z
      .map((wert, spalte) =>
        spalte === 0
          ? String(wert ?? '').padEnd(breiten[spalte])
          : String(wert ?? '').padStart(breiten[spalte]),
      )
      .join('  ');
  console.log('  ' + zeile(kopf));
  console.log('  ' + breiten.map((b) => '-'.repeat(b)).join('  '));
  for (const z of zeilen) console.log('  ' + zeile(z));
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

const beginn = Date.now();
const befund = tauschprobe({
  partien: PARTIEN,
  sitze: ACHT_SITZE.slice(0, SITZZAHL),
  besetzung: BESETZUNG,
  saatBasis: SAAT_BASIS,
  kontexte: KONTEXTE,
  saaten: SAATEN,
  regler: REGLER,
});
const dauer = Date.now() - beginn;

if (ALS_JSON) {
  console.log(JSON.stringify(befund, null, 2));
  process.exit(0);
}

console.log('');
console.log('Tafelrunde — Tauschprobe (dieselben Bretter, eine Einheit getauscht)');
console.log(
  `${befund.kaempfe} Kaempfe aus ${befund.bretter} Schlussbrettern von ${PARTIEN} Partien ` +
    `zu ${SITZZAHL}, Besetzung ${BESETZUNG}, Saatbasis "${SAAT_BASIS}", ` +
    `${(dauer / 1000).toFixed(1)} s`,
);
const ABWEICHUNGEN = [
  ZEITRAFFER === STANDARD_REGLER.zeitraffer ? null : `Zeitraffer x${ZEITRAFFER}`,
  HEILUNG === STANDARD_REGLER.heilungFaktor ? null : `Heilfaktor ${HEILUNG}`,
].filter(Boolean);
// Eine Tabelle, die nicht den gebauten Stand zeigt, muss das in der ersten
// Zeile sagen — sonst wandert sie als "die Zahlen von heute" weiter.
console.log(
  ABWEICHUNGEN.length === 0 ? 'Stand wie gebaut' : `ABWEICHENDER STAND: ${ABWEICHUNGEN.join(', ')}`,
);

for (const stufe of befund.stufen) {
  console.log('');
  console.log(
    `${stufe.kosten} GOLD — ${stufe.kontexte} Bretter, ${stufe.kaempfe} Kaempfe, ` +
      `Schnitt der Stufe ${p1(stufe.schnitt)}`,
  );
  tabelle(
    ['Einheit', 'Rolle', 'Kaempfe', 'Siege', 'unent.', 'an der Uhr', 'Quote', 'Index', 'Saldo'],
    stufe.zeilen.map((z) => [
      z.name,
      z.rolle,
      String(z.kaempfe),
      String(z.siege),
      String(z.unentschieden),
      String(z.anDerUhr),
      z.quote === null ? '-' : p1(z.quote),
      z.index === null ? '-' : `x${z.index.toFixed(2)}`,
      z.saldo.toFixed(2),
    ]),
  );
}

console.log('');
console.log('  Jede Zeile einer Stufe stand auf DENSELBEN Brettern gegen DIESELBEN Gegner,');
console.log('  mit denselben Saaten; getauscht ist genau ein Platz. Der Index ist die');
console.log('  Quote zum Schnitt der Stufe: x1,00 heisst "so gut wie der Durchschnitt');
console.log('  dessen, was fuer dasselbe Gold auf den Platz koennte".');
console.log('');
console.log('  SALDO ist der Rundenschaden je Kampf, zugefuegt minus erlitten — dieselbe');
console.log('  Rangfolge wie die Quote, nur feiner: Er behaelt den Unterschied zwischen');
console.log('  knapp und deutlich und schlaegt deshalb frueher aus.');
console.log('');
console.log('  WAS HIER NICHT STEHT: wie oft eine Einheit im Spiel vorkommt. Dafuer die');
console.log('  Antritte in werkzeug/ausgewogenheit.mjs — beide Zahlen gehoeren zusammen.');
console.log('');
