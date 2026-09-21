/**
 * Das Aufstellungsduell als Tabelle: dasselbe Heer nach zwei Regeln
 * aufgestellt, dann gegeneinander.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/aufstellungsduell.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --heere 50           Wie viele Heere je Groesse gewuerfelt werden.
 *     --saaten 1           Saaten je Heer und Seitenzuweisung.
 *     --groessen 3,5,7,9   Heergroessen (Feldplaetze, also Level).
 *     --saat duell-v1      Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --stufe 1            Sternstufe beider Seiten (1 bis 3).
 *     --kosten 1|2|3       Nur Einheiten dieser Kostenstufe. Ohne: ganzer Katalog.
 *     --heilung 1.5        HEILUNG_FAKTOR wie im Kampf; nur fuer Vergleichslaeufe.
 *     --zeitraffer 2       Wie im Kampf; nur fuer Vergleichslaeufe.
 *     --json               Statt der Tabellen die rohe Auswertung als JSON.
 *
 * WOZU ES DA IST: Es beantwortet die eine Frage, die
 * werkzeug/ausgewogenheit.mjs, werkzeug/laufwege.mjs und
 * werkzeug/gangarten.mjs bauartbedingt NICHT beantworten koennen — spielt der
 * neue Bot staerker? Dort benutzt jeder Bot am Tisch dieselbe Regel; der
 * Regelunterschied hebt sich heraus, ehe der erste Takt laeuft, und eine
 * Siegquote gegen sich selbst ist immer 50 %. Hier stehen die beiden Regeln
 * gegeneinander, mit demselben Heer auf beiden Seiten.
 *
 * WAS ES NICHT SAGT: ob das Spiel mit der neuen Regel besser ist. Kuerzere
 * Kaempfe, ausgewogenere Einheiten und mehr Bewegung stehen weiter in den drei
 * Werkzeugen oben. Die beiden Sorten Zahl gehoeren nebeneinander gelesen; wer
 * nur eine liest, zieht den falschen Schluss.
 *
 * WIE MAN DIE ZAHL LIEST: Ueber 50 % heisst, die neue Regel stellt staerker
 * auf. Die Spalte "gleich" steht gleichberechtigt daneben — sie zaehlt die
 * Heere, bei denen beide Regeln dasselbe Feld waehlten. Die kaempfen nicht
 * (ein Kampf gegen die eigene Aufstellung entscheidet nur der Erstzieher), und
 * eine grosse Quote auf wenigen ungleichen Heeren ist ein kleiner Effekt.
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt den Duellstand aus
 * `dist/test/aufstellungsduell.js` — dieselbe Datei, die auch die Probe in
 * test/aufstellungsduell.test.ts benutzt. Eine zweite Fassung des
 * Messverfahrens im Werkzeug waere der sichere Weg zu zwei Zahlen fuer
 * dieselbe Frage (siehe werkzeug/turnier.mjs, derselbe Satz).
 *
 * Der Lauf ist vollstaendig bestimmt: dieselben Schalter ergeben dieselbe
 * Tabelle, auf jedem Rechner (game-api, Grundsatz 1).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const DUELLSTAND = resolve(HIER, '../dist/test/aufstellungsduell.js');

if (!existsSync(DUELLSTAND)) {
  console.error('Der Duellstand fehlt: ' + DUELLSTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

/*
 * Ueber `pathToFileURL` und nicht ueber den blanken Pfad: Unter Windows faengt
 * ein absoluter Pfad mit "C:" an, und den haelt der ESM-Lader fuer ein
 * Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
 */
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { HEERGROESSEN, duell } = await laden(DUELLSTAND);
const { STANDARD_REGLER } = await laden(resolve(HIER, '../dist/src/index.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const HEERE = Number(schalter('heere', '50'));
const SAATEN = Number(schalter('saaten', '1'));
const GROESSEN = schalter('groessen', HEERGROESSEN.join(',')).split(',').map(Number);
const SAAT_BASIS = schalter('saat', 'duell-v1');
const STUFE = Number(schalter('stufe', '1'));
const KOSTEN = schalter('kosten', null);
const HEILUNG = Number(schalter('heilung', STANDARD_REGLER.heilungFaktor));
const ZEITRAFFER = Number(schalter('zeitraffer', STANDARD_REGLER.zeitraffer));
const ALS_JSON = process.argv.includes('--json');

if (!Number.isInteger(HEERE) || HEERE < 1) {
  console.error('--heere braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SAATEN) || SAATEN < 1) {
  console.error('--saaten braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (GROESSEN.some((g) => !Number.isInteger(g) || g < 1 || g > 20)) {
  console.error('--groessen braucht ganze Zahlen von 1 bis 20, mit Komma getrennt');
  process.exit(1);
}
if (![1, 2, 3].includes(STUFE)) {
  console.error('--stufe kennt nur 1, 2 und 3');
  process.exit(1);
}
if (KOSTEN !== null && !['1', '2', '3'].includes(KOSTEN)) {
  console.error('--kosten kennt nur 1, 2 und 3');
  process.exit(1);
}
if (!Number.isFinite(ZEITRAFFER) || ZEITRAFFER <= 0) {
  console.error('--zeitraffer braucht eine Zahl groesser als null');
  process.exit(1);
}
if (!Number.isFinite(HEILUNG) || HEILUNG < 0) {
  console.error('--heilung braucht eine Zahl ab null');
  process.exit(1);
}

const REGLER = { ...STANDARD_REGLER, zeitraffer: ZEITRAFFER, heilungFaktor: HEILUNG };

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const p1 = (zahl) => (zahl === null ? '-' : `${(zahl * 100).toFixed(1)} %`);

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
const befund = duell({
  heere: HEERE,
  saaten: SAATEN,
  groessen: GROESSEN,
  saatBasis: SAAT_BASIS,
  stufe: STUFE,
  kosten: KOSTEN === null ? undefined : Number(KOSTEN),
  regler: REGLER,
});
const dauer = Date.now() - beginn;

if (ALS_JSON) {
  console.log(
    JSON.stringify(
      { ...befund, jeRolle: Object.fromEntries(befund.jeRolle) },
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log('');
console.log('Tafelrunde — Aufstellungsduell');
console.log('Regel A: der Bot von heute (wunschreihe je Rolle, bot.ts)');
console.log('Regel B: der Bot bis zum 06.09.2026 (ganz vorn oder ganz hinten)');
console.log(
  `${befund.gesamt.kaempfe} Kaempfe aus ${befund.heere} Heeren, Sternstufe ${STUFE}, ` +
    `${SAATEN} Saaten je Seite, Saatbasis "${SAAT_BASIS}", ${(dauer / 1000).toFixed(1)} s`,
);
const ABWEICHUNGEN = [
  ZEITRAFFER === STANDARD_REGLER.zeitraffer ? null : `Zeitraffer x${ZEITRAFFER}`,
  HEILUNG === STANDARD_REGLER.heilungFaktor ? null : `Heilfaktor ${HEILUNG}`,
  KOSTEN === null ? null : `nur ${KOSTEN} Gold`,
].filter(Boolean);
// Eine Tabelle, die nicht den gebauten Stand zeigt, muss das in der ersten
// Zeile sagen — sonst wandert sie als "die Zahlen von heute" weiter.
console.log(
  ABWEICHUNGEN.length === 0 ? 'Stand wie gebaut' : `ABWEICHENDER STAND: ${ABWEICHUNGEN.join(', ')}`,
);

console.log('');
console.log('JE HEERGROESSE — Quote ist die Siegquote von Regel A');
tabelle(
  ['Einheiten', 'Heere', 'gleich', 'Kaempfe', 'Siege A', 'unent.', 'an der Uhr', 'Dauer', 'Quote'],
  befund.zeilen.map((z) => [
    String(z.groesse),
    String(z.heere),
    String(z.gleich),
    String(z.kaempfe),
    String(z.siege),
    String(z.unentschieden),
    String(z.anDerUhr),
    `${(z.dauerSchnittMs / 1000).toFixed(1)} s`,
    p1(z.quote),
  ]),
);

console.log('');
console.log('JE ROLLE — nur die Heere, in denen die Rolle vorkommt');
tabelle(
  ['Rolle', 'Kaempfe', 'Siege A', 'unent.', 'Quote'],
  ['wache', 'meuchler', 'beistand', 'schuetze', 'magier']
    .filter((rolle) => befund.jeRolle.has(rolle))
    .map((rolle) => {
      const b = befund.jeRolle.get(rolle);
      return [rolle, String(b.kaempfe), String(b.siege), String(b.unentschieden), p1(b.quote)];
    }),
);
console.log('');
console.log('  Ein Heer zaehlt fuer JEDE Rolle, die darin steht. Die Zeilen summieren');
console.log('  sich deshalb nicht zur Gesamtzahl — sie sagen, an welcher Rolle der');
console.log('  Unterschied haengt.');

console.log('');
console.log(
  `ZUSAMMEN: ${befund.gesamt.siege} von ${befund.gesamt.kaempfe} Kaempfen ` +
    `(${p1(befund.gesamt.quote)}), ${befund.gesamt.unentschieden} unentschieden, an der Uhr ` +
    `${p1(befund.gesamt.kaempfe === 0 ? null : befund.gesamt.anDerUhr / befund.gesamt.kaempfe)}.`,
);
console.log(
  `  Bei ${befund.gleich} von ${befund.heere} Heeren stellten beide Regeln GLEICH auf;`,
);
console.log('  die kaempfen nicht. Ueber 50 % heisst: Regel A stellt staerker auf.');
console.log('');
