/**
 * Gangart gegen Gangart: ein Sitz spielt hart, der Rest normal — wer gewinnt?
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/gangarten.mjs
 *
 * WOZU ES DA IST. `werkzeug/ausgewogenheit.mjs` misst den KATALOG und besetzt
 * dafuer mit Absicht alle Sitze gleich — sonst maesse es die Gangarten statt
 * der Marken. Genau die Frage bleibt damit offen, und sie ist am 05.09.2026
 * teuer geworden: Nach der Umstellung auf 14 Startleben verlor `hart` gegen
 * `normal`, und niemand hatte ein Werkzeug, um zu sehen, woran es liegt.
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --stark hart         Gangart von Sitz 0.
 *     --schwach normal     Gangart aller uebrigen Sitze.
 *     --partien 400        Wie viele Partien je Lauf.
 *     --sitze 4            Sitze am Tisch, 2 bis 8.
 *     --saat basis         Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *
 * Und dieselben vier Stellschrauben wie in ausgewogenheit.mjs, damit sich ein
 * VORGESCHLAGENER Stand ansehen laesst, ohne ihn einzubauen:
 *
 *     --leben 20           Startleben je Sitz.
 *     --teiler 3           SCHADEN_STUFEN_TEILER: kleiner = mehr Schaden.
 *     --zeitraffer 1       Wie viel schneller der Kampf ablaeuft.
 *     --takt 100           Taktlaenge der Simulation in Millisekunden.
 *
 * Dazu eine fuenfte, die es in ausgewogenheit.mjs nicht gibt:
 *
 *     --wuerfelkosten 0    Was ein Neu-Wuerfeln kostet.
 *
 * Sie steht hier, weil genau dieser Preis die Gangarten auseinandergetrieben
 * hat: Solange ein Wurf 2 Gold kostete, zahlte `hart` seinen Tempovorsprung
 * an der Ladentheke wieder ein (siehe die Zahlen in GANGARTEN, bot.ts).
 *
 * GEZAEHLT WIRD NUR DER EINDEUTIGE ERSTE PLATZ, und verglichen wird mit dem
 * SCHNITT der uebrigen Sitze und nicht mit ihrer Summe: Am Tisch zu viert
 * sitzen drei schwache Gegner, ihre Siege zusammenzuzaehlen hiesse, die starke
 * Gangart gegen drei Spieler antreten zu lassen und sich zu wundern.
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt `spieleParte` aus `dist/test/messen.js` —
 * dieselbe Partieschleife, die auch die Proben benutzen (siehe messen.ts).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const MESSSTAND = resolve(HIER, '../dist/test/messen.js');

if (!existsSync(MESSSTAND)) {
  console.error('Der Messstand fehlt: ' + MESSSTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

// Ueber `pathToFileURL`: Unter Windows haelt der ESM-Lader das "C:" eines
// absoluten Pfades sonst fuer ein Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, spieleParte } = await laden(MESSSTAND);
const { DEFAULT_REGELN, STANDARD_REGLER } = await laden(resolve(HIER, '../dist/src/index.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const GANGARTEN = ['sanft', 'normal', 'hart'];
const STARK = schalter('stark', 'hart');
const SCHWACH = schalter('schwach', 'normal');
const PARTIEN = Number(schalter('partien', '400'));
const SITZZAHL = Number(schalter('sitze', '4'));
const SAAT_BASIS = schalter('saat', 'gangarten-v1');

for (const [name, wert] of [
  ['stark', STARK],
  ['schwach', SCHWACH],
]) {
  if (!GANGARTEN.includes(wert)) {
    console.error(`--${name} kennt nur ${GANGARTEN.join(', ')}`);
    process.exit(1);
  }
}
if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);

const REGELN = {
  ...DEFAULT_REGELN,
  startLeben: Number(schalter('leben', DEFAULT_REGELN.startLeben)),
  neuwuerfelnKosten: Number(
    schalter('wuerfelkosten', DEFAULT_REGELN.neuwuerfelnKosten),
  ),
};
const REGLER = {
  ...STANDARD_REGLER,
  schadenStufenTeiler: Number(schalter('teiler', STANDARD_REGLER.schadenStufenTeiler)),
  zeitraffer: Number(schalter('zeitraffer', STANDARD_REGLER.zeitraffer)),
  taktMs: Number(schalter('takt', STANDARD_REGLER.taktMs)),
};
for (const [name, wert] of [
  ['leben', REGELN.startLeben],
  ['teiler', REGLER.schadenStufenTeiler],
  ['zeitraffer', REGLER.zeitraffer],
  ['takt', REGLER.taktMs],
]) {
  if (!Number.isFinite(wert) || wert <= 0) {
    console.error(`--${name} braucht eine Zahl groesser als null`);
    process.exit(1);
  }
}
// Null ist hier erlaubt und sogar die Vorgabe — deshalb steht der Wurfpreis
// nicht in der Schleife darueber.
if (!Number.isFinite(REGELN.neuwuerfelnKosten) || REGELN.neuwuerfelnKosten < 0) {
  console.error('--wuerfelkosten braucht eine Zahl ab null');
  process.exit(1);
}

const ABWEICHUNGEN = [
  REGELN.startLeben === DEFAULT_REGELN.startLeben ? null : `Startleben ${REGELN.startLeben}`,
  REGLER.schadenStufenTeiler === STANDARD_REGLER.schadenStufenTeiler
    ? null
    : `Schadensteiler ${REGLER.schadenStufenTeiler}`,
  REGLER.zeitraffer === STANDARD_REGLER.zeitraffer ? null : `Zeitraffer x${REGLER.zeitraffer}`,
  REGLER.taktMs === STANDARD_REGLER.taktMs ? null : `Takt ${REGLER.taktMs} ms`,
  REGELN.neuwuerfelnKosten === DEFAULT_REGELN.neuwuerfelnKosten
    ? null
    : `Wurf kostet ${REGELN.neuwuerfelnKosten}`,
].filter(Boolean);

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

/** Sitz 0 bekommt die starke Gangart, alle uebrigen die schwache. */
const besetzung = SITZE.map((_, sitz) => (sitz === 0 ? STARK : SCHWACH));

const beginn = Date.now();
const siege = SITZE.map(() => 0);
const runden = [];
let mitSieger = 0;

for (let i = 0; i < PARTIEN; i++) {
  const befund = spieleParte(
    `${SAAT_BASIS}-${STARK}-${SCHWACH}-${i}`,
    SITZE,
    besetzung,
    REGELN,
    REGLER,
  );
  runden.push(befund.runden);
  if (befund.sieger !== null) {
    siege[befund.sieger] += 1;
    mitSieger += 1;
  }
}

const dauer = Date.now() - beginn;
const andere = siege.slice(1);
const schnittDerAnderen = andere.reduce((s, z) => s + z, 0) / andere.length;
const sortiert = [...runden].sort((a, b) => a - b);
const rundenMedian = sortiert[Math.floor(sortiert.length / 2)];

console.log('');
console.log('Tafelrunde — Gangart gegen Gangart');
console.log(
  `${PARTIEN} Partien zu ${SITZE.length}, Sitz 0 spielt ${STARK}, die uebrigen ${SCHWACH}, ` +
    `Saatbasis "${SAAT_BASIS}", ${(dauer / 1000).toFixed(1)} s`,
);
console.log(
  ABWEICHUNGEN.length === 0 ? 'Stand wie gebaut' : `ABWEICHENDER STAND: ${ABWEICHUNGEN.join(', ')}`,
);
console.log('');
console.log(`  ${STARK} : ${SCHWACH}   ${siege[0]} : ${schnittDerAnderen.toFixed(1)}`);
console.log('');
console.log(`  Siege je Sitz: ${siege.join(', ')}`);
console.log(`  Partien mit eindeutigem Sieger: ${mitSieger} von ${PARTIEN}`);
console.log(`  Runden im Median: ${rundenMedian}`);
console.log('');
