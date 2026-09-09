/**
 * Das Monokultur-Turnier als Tabelle: jede Einheit gegen jede ihrer
 * Kostenstufe, drei Kopien je Seite.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/turnier.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --saaten 3           Wie viele Saaten je Paarung. Mehr = ruhigere Zahlen.
 *     --kopien 3           Einheiten je Seite, 2 bis 5. Mehr = mehr Verbuendete.
 *     --saat turnier-v1    Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --stufe 1            Sternstufe beider Seiten (1 bis 3).
 *     --heilung 1.5        HEILUNG_FAKTOR: Heilkraft eines Beistands. 0 = keine.
 *     --zeitraffer 2       Wie im Kampf; nur fuer Vergleichslaeufe.
 *     --json               Statt der Tabellen die rohe Auswertung als JSON.
 *
 * Die Tabelle im Kopf von `HEILUNG_FAKTOR` (kampf.ts) entsteht so:
 *
 *     for f in 0 1 1.5 2 3; do node …/turnier.mjs --heilung $f | tail -12; done
 *
 * WOZU ES DA IST: Es beantwortet die eine Frage, die werkzeug/ausgewogenheit.mjs
 * nicht beantworten kann — wie eine Einheit im KAMPF dasteht, unabhaengig
 * davon, ob der Bot sie kauft. Beim Beistand war genau das der Punkt: Der
 * Moosheiler stand in der Ausgewogenheits-Messung bei 74 Antritten und damit
 * unter jeder Zaehlschwelle ("zu duenn"), waehrend er hier garantiert gleich
 * oft antritt wie jeder andere.
 *
 * WAS ES NICHT SAGT: ob das Spiel ausgewogen ist. Drei Kopien derselben
 * Einheit sind kein Brett, das jemand bauen wuerde. Die beiden Werkzeuge
 * gehoeren nebeneinander gelesen; wer nur eines liest, zieht den falschen
 * Schluss (derselbe Satz steht bei HOECHSTDAUER_MS in kampf.ts ueber die
 * beiden Kampfdauer-Proben).
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt den Turnierstand aus `dist/test/turnier.js`
 * — dieselbe Datei, die auch die Probe in test/turnier.test.ts benutzt. Eine
 * zweite Fassung des Messverfahrens im Werkzeug waere der sichere Weg zu zwei
 * Zahlen fuer dieselbe Frage.
 *
 * Der Lauf ist vollstaendig bestimmt: dieselben Schalter ergeben dieselbe
 * Tabelle, auf jedem Rechner (game-api, Grundsatz 1).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const TURNIERSTAND = resolve(HIER, '../dist/test/turnier.js');

if (!existsSync(TURNIERSTAND)) {
  console.error('Der Turnierstand fehlt: ' + TURNIERSTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

/*
 * Ueber `pathToFileURL` und nicht ueber den blanken Pfad: Unter Windows faengt
 * ein absoluter Pfad mit "C:" an, und den haelt der ESM-Lader fuer ein
 * Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
 */
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { KOPIEN, KOPIEN_HOECHSTZAHL, beistandsprobe, rollenbilanz, turnier } =
  await laden(TURNIERSTAND);
const { STANDARD_REGLER } = await laden(resolve(HIER, '../dist/src/index.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const SAATEN = Number(schalter('saaten', '3'));
const KOPIEN_LAUF = Number(schalter('kopien', KOPIEN));
const SAAT_BASIS = schalter('saat', 'turnier-v1');
const STUFE = Number(schalter('stufe', '1'));
const HEILUNG = Number(schalter('heilung', STANDARD_REGLER.heilungFaktor));
const ZEITRAFFER = Number(schalter('zeitraffer', STANDARD_REGLER.zeitraffer));
const ALS_JSON = process.argv.includes('--json');

if (!Number.isInteger(SAATEN) || SAATEN < 1) {
  console.error('--saaten braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(KOPIEN_LAUF) || KOPIEN_LAUF < 2 || KOPIEN_LAUF > KOPIEN_HOECHSTZAHL) {
  console.error(`--kopien braucht eine ganze Zahl von 2 bis ${KOPIEN_HOECHSTZAHL}`);
  process.exit(1);
}
if (![1, 2, 3].includes(STUFE)) {
  console.error('--stufe kennt nur 1, 2 und 3');
  process.exit(1);
}
if (!Number.isFinite(ZEITRAFFER) || ZEITRAFFER <= 0) {
  console.error('--zeitraffer braucht eine Zahl groesser als null');
  process.exit(1);
}
// Die Null ist hier ausdruecklich erlaubt, anders als beim Zeitraffer: Sie ist
// der Vergleichslauf gegen den Stand vor der Beistand-Wirkung.
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
const OPTIONEN = {
  saaten: SAATEN,
  kopien: KOPIEN_LAUF,
  saatBasis: SAAT_BASIS,
  stufe: STUFE,
  regler: REGLER,
};
const befund = turnier(OPTIONEN);
const probe = beistandsprobe(OPTIONEN);
const dauer = Date.now() - beginn;

if (ALS_JSON) {
  console.log(JSON.stringify({ turnier: befund, beistandsprobe: probe }, null, 2));
  process.exit(0);
}

console.log('');
console.log('Tafelrunde — Monokultur-Turnier');
console.log(
  `${befund.kaempfe} Kaempfe, ${KOPIEN_LAUF} Kopien je Seite, Sternstufe ${STUFE}, ` +
    `${SAATEN} Saaten je Paarung, Saatbasis "${SAAT_BASIS}", ${(dauer / 1000).toFixed(1)} s`,
);
const ABWEICHUNGEN = [
  ZEITRAFFER === STANDARD_REGLER.zeitraffer ? null : `Zeitraffer x${ZEITRAFFER}`,
  HEILUNG === STANDARD_REGLER.heilungFaktor ? null : `Heilfaktor ${HEILUNG}`,
  KOPIEN_LAUF === KOPIEN ? null : `${KOPIEN_LAUF} Einheiten je Seite`,
].filter(Boolean);
// Eine Tabelle, die nicht den gebauten Stand zeigt, muss das in der ersten
// Zeile sagen — sonst wandert sie als "die Zahlen von heute" weiter.
console.log(
  ABWEICHUNGEN.length === 0 ? 'Stand wie gebaut' : `ABWEICHENDER STAND: ${ABWEICHUNGEN.join(', ')}`,
);

for (const stufe of befund.stufen) {
  console.log('');
  console.log(
    `${stufe.kosten} GOLD — ${stufe.kaempfe} Kaempfe, im Mittel ` +
      `${(stufe.dauerSchnittMs / 1000).toFixed(1)} s, an der Uhr ${p1(stufe.anDerUhrAnteil)}`,
  );
  tabelle(
    ['Einheit', 'Rolle', 'Kaempfe', 'Siege', 'unent.', 'an der Uhr', 'Quote'],
    stufe.zeilen.map((z) => [
      z.name,
      z.rolle,
      String(z.kaempfe),
      String(z.siege),
      String(z.unentschieden),
      String(z.anDerUhr),
      z.quote === null ? '-' : p1(z.quote),
    ]),
  );
}

console.log('');
console.log('JE ROLLE — alle Traeger einer Rolle ueber alle Kostenstufen zusammen');
tabelle(
  ['Rolle', 'Kaempfe', 'Siege', 'Quote'],
  ['wache', 'schuetze', 'magier', 'meuchler', 'beistand'].map((rolle) => {
    const b = rollenbilanz(befund, rolle);
    return [rolle, String(b.kaempfe), String(b.siege), b.quote === null ? '-' : p1(b.quote)];
  }),
);
console.log('');
console.log('  Ein Kampf zaehlt fuer BEIDE Seiten, die Summe der Kaempfe ist also');
console.log('  doppelt so gross wie die Zahl oben. Unentschieden zaehlt fuer keinen.');

/*
 * Die Beistandsprobe ist die Zahl, an der der Heilfaktor haengt — nicht die
 * Rollenquote oben. Warum, steht bei `beistandsprobe` in test/turnier.ts:
 * Drei Heiler gegeneinander koennen nur an der Uhr gewinnen.
 */
console.log('');
console.log(
  `IST EIN BRETTPLATZ FUER EINEN BEISTAND GUT ANGELEGT? ` +
    `${KOPIEN_LAUF - 1} Kopien + 1 Beistand gegen ${KOPIEN_LAUF} Kopien`,
);
tabelle(
  ['Beistand', 'statt der dritten', 'Gold', 'Kaempfe', 'Siege', 'an der Uhr', 'Quote'],
  probe.zeilen.map((z) => [
    z.name,
    z.gegenName,
    String(z.kosten),
    String(z.kaempfe),
    String(z.siege),
    String(z.anDerUhr),
    z.quote === null ? '-' : p1(z.quote),
  ]),
);
console.log('');
console.log(
  `  ZUSAMMEN: ${probe.siege} von ${probe.kaempfe} Kaempfen ` +
    `(${probe.quote === null ? '-' : p1(probe.quote)}), an der Uhr ` +
    `${p1(probe.anDerUhr / probe.kaempfe)}. Ueber 50 % heisst: Der Platz ist gut`,
);
console.log('  angelegt. Weit darueber heisst: In jedem Heer steht dann ein Heiler.');
console.log('');
