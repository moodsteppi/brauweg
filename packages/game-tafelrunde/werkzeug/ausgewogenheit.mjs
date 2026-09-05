/**
 * Ausgewogenheits-Messung von Tafelrunde: viele Partien mit Bots, ausgezaehlt
 * und als Tabelle ausgegeben.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --partien 500        Wie viele Partien. Rund 60 ms je Partie zu acht.
 *     --sitze 8            Sitze am Tisch, 2 bis 8.
 *     --besetzung normal   normal | sanft | hart | gemischt (reihum sanft/normal/hart)
 *     --saat basis         Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --mindest 100        Ab wie vielen Antritten eine Zeile mitgerechnet wird.
 *     --json               Statt der Tabellen die rohe Auswertung als JSON.
 *
 * Und die vier Stellschrauben der Spielzeit, damit man die Ausgewogenheit
 * eines VORGESCHLAGENEN Standes ansehen kann, ohne ihn vorher einzubauen
 * (siehe werkzeug/spielzeit.mjs und docs/TAFELRUNDE-SPIELZEIT.md):
 *
 *     --leben 20           Startleben je Sitz.
 *     --teiler 3           SCHADEN_STUFEN_TEILER: kleiner = mehr Schaden.
 *     --zeitraffer 1       Wie viel schneller der Kampf ablaeuft.
 *     --takt 100           Taktlaenge der Simulation in Millisekunden.
 *
 * WOZU ES DA IST: Wer am Katalog dreht — an Werten, Kosten, Marken oder den
 * Schwellen in synergien.ts —, laesst das hier vorher und nachher laufen und
 * vergleicht. Die Probe in test/ausgewogenheit.test.ts faengt nur ab, was
 * WIRKLICH kaputt waere; ob eine Aenderung das Spiel besser macht, sieht man
 * allein hier.
 *
 * WARUM ES GEBAUT SEIN MUSS: Es holt den Messstand aus `dist/test/messen.js`
 * — dieselbe Datei, die auch die Probe benutzt. Eine zweite Fassung des
 * Messverfahrens im Werkzeug waere der sichere Weg zu zwei Zahlen fuer
 * dieselbe Frage.
 *
 * Der Lauf ist vollstaendig bestimmt: dieselben Schalter ergeben dieselbe
 * Tabelle, auf jedem Rechner (game-api, Grundsatz 1).
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

/*
 * Ueber `pathToFileURL` und nicht ueber den blanken Pfad: Unter Windows faengt
 * ein absoluter Pfad mit "C:" an, und den haelt der ESM-Lader fuer ein
 * Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME). Der Aufruf kostet nichts und
 * spart die Fehlersuche.
 */
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, STANDARD_ZEITMODELL, messe, schnittQuote, werteAus } = await laden(MESSSTAND);
const { DEFAULT_REGELN, KATALOG, MARKEN, SCHWELLEN, STANDARD_REGLER, einheit, synergie } =
  await laden(resolve(HIER, '../dist/src/index.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const PARTIEN = Number(schalter('partien', '500'));
const SITZZAHL = Number(schalter('sitze', '8'));
const BESETZUNG = schalter('besetzung', 'normal');
const SAAT_BASIS = schalter('saat', 'ausgewogenheit-v1');
const MINDEST = Number(schalter('mindest', '100'));
const ALS_JSON = process.argv.includes('--json');

if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}
if (!['normal', 'sanft', 'hart', 'gemischt'].includes(BESETZUNG)) {
  console.error('--besetzung kennt nur normal, sanft, hart und gemischt');
  process.exit(1);
}

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);

/*
 * Die Stellschrauben. Wer keine angibt, misst genau den gebauten Stand — die
 * Vorgaben sind DEFAULT_REGELN und STANDARD_REGLER selbst und keine
 * abgeschriebenen Zahlen, damit die Vorgabe hier nicht veraltet, sobald jemand
 * eine Konstante aendert.
 */
const REGELN = { ...DEFAULT_REGELN, startLeben: Number(schalter('leben', DEFAULT_REGELN.startLeben)) };
const REGLER = {
  ...STANDARD_REGLER,
  schadenStufenTeiler: Number(schalter('teiler', STANDARD_REGLER.schadenStufenTeiler)),
  zeitraffer: Number(schalter('zeitraffer', STANDARD_REGLER.zeitraffer)),
  taktMs: Number(schalter('takt', STANDARD_REGLER.taktMs)),
};
/*
 * Geprueft wird hier und nicht in kampf.ts: Der Regler ist Werkzeug und kein
 * Regelsatz, aber ueber die Kommandozeile kommt trotzdem Freitext herein. Eine
 * Null im Takt waere kein falsches Ergebnis, sondern eine Endlosschleife
 * (`jetzt += 0`), und eine Null im Teiler ergaebe unendlich viel Schaden.
 */
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

const ABWEICHUNGEN = [
  REGELN.startLeben === DEFAULT_REGELN.startLeben ? null : `Startleben ${REGELN.startLeben}`,
  REGLER.schadenStufenTeiler === STANDARD_REGLER.schadenStufenTeiler
    ? null
    : `Schadensteiler ${REGLER.schadenStufenTeiler}`,
  REGLER.zeitraffer === STANDARD_REGLER.zeitraffer ? null : `Zeitraffer x${REGLER.zeitraffer}`,
  REGLER.taktMs === STANDARD_REGLER.taktMs ? null : `Takt ${REGLER.taktMs} ms`,
].filter(Boolean);

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const p1 = (zahl) => `${(zahl * 100).toFixed(1)} %`;
const mmss = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Eine Tabelle mit fester Spaltenbreite — links Text, rechts Zahlen. */
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

/**
 * Der Faktor zum Schnitt — die Zahl, um die es beim Balancing geht.
 *
 * Zeilen unter der Mindestzahl bekommen KEINEN Faktor, sondern einen Hinweis.
 * Eine Marke, die dreissigmal antrat, hat einen Standardfehler von rund acht
 * Prozentpunkten; ihr Faktor saehe genau aus wie eine Aussage und waere keine.
 */
function faktor(zeile, schnitt) {
  if (zeile.quote === null) return '-';
  if (zeile.antritte < MINDEST) return 'zu duenn';
  return `x${(zeile.quote / schnitt).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

const beginn = Date.now();
const befunde = messe({
  partien: PARTIEN,
  sitze: SITZE,
  besetzung: BESETZUNG,
  saatBasis: SAAT_BASIS,
  regeln: REGELN,
  regler: REGLER,
});
const a = werteAus(befunde);
const dauer = Date.now() - beginn;

if (ALS_JSON) {
  console.log(JSON.stringify(a, null, 2));
  process.exit(0);
}

console.log('');
console.log('Tafelrunde — Ausgewogenheit');
console.log(
  `${a.partien} Partien zu ${SITZE.length}, Besetzung ${BESETZUNG}, ` +
    `Saatbasis "${SAAT_BASIS}", ${(dauer / 1000).toFixed(1)} s`,
);
// Eine Tabelle, die nicht den gebauten Stand zeigt, muss das in der ersten
// Zeile sagen — sonst wandert sie als "die Zahlen von heute" weiter.
console.log(
  ABWEICHUNGEN.length === 0
    ? 'Stand wie gebaut'
    : `ABWEICHENDER STAND: ${ABWEICHUNGEN.join(', ')}`,
);

console.log('');
console.log('PARTIEN');
tabelle(
  ['', 'Wert'],
  [
    ['Runden im Mittel', a.rundenSchnitt.toFixed(1)],
    ['Runden im Median', String(a.rundenMedian)],
    ['Runden kuerzeste / laengste', `${a.rundenMin} / ${a.rundenMax}`],
    ['an der Rundengrenze geendet', `${a.anDerGrenze} (${p1(a.anDerGrenze / a.partien)})`],
    ['vor Runde fuenf geendet', `${a.vorRundeFuenf} (${p1(a.vorRundeFuenf / a.partien)})`],
    [
      'erstes Ausscheiden in Runde',
      a.erstesAusscheidenSchnitt === null ? 'nie' : a.erstesAusscheidenSchnitt.toFixed(1),
    ],
    ['vorzeitig einseitig', `${a.einseitig} (${p1(a.einseitig / a.partien)})`],
    ['mit eindeutigem Sieger', `${a.mitSieger} (${p1(a.mitSieger / a.partien)})`],
    ['Antritte insgesamt', String(a.antritte)],
  ],
);
console.log('');
console.log('  "vorzeitig einseitig": der Sieger lag spaetestens zur Halbzeit vorne');
console.log('  und blieb es bis zum Schluss.');

/*
 * Die SPIELZEIT steht hier und nicht nur im Spielzeit-Werkzeug, weil sie an
 * jeder Katalogaenderung haengt: Wer eine Einheit zaeher macht, verlaengert
 * jeden Kampf und damit die Partie. Wer das nicht neben den Siegquoten sieht,
 * balanciert das Spiel laenger, ohne es zu merken.
 */
console.log('');
console.log('SPIELZEIT');
tabelle(
  ['', 'Wert'],
  [
    ['Spielzeit im Median', mmss(a.spielzeitMedianMs)],
    ['Spielzeit im Mittel', mmss(a.spielzeitSchnittMs)],
    ['kuerzeste / laengste', `${mmss(a.spielzeitMinMs)} / ${mmss(a.spielzeitMaxMs)}`],
    ['davon Vorbereitung (geschaetzt)', mmss(a.vorbereitungMs)],
    ['davon Kampf (gemessen)', mmss(a.kampfMs)],
    ['davon Nachlauf (gemessen)', mmss(a.nachlaufMs)],
    ['einzelner Kampf im Median', `${(a.kampfMedianMs / 1000).toFixed(1)} s`],
    ['Kampfphase je Runde im Median', `${(a.kampfphaseMedianMs / 1000).toFixed(1)} s`],
    ['Kaempfe an der Hoechstdauer abgebrochen', p1(a.zeitAbbruchAnteil)],
  ],
);
console.log('');
console.log(
  `  Vorbereitung ist GESCHAETZT (${STANDARD_ZEITMODELL.vorbereitungGrundMs / 1000} s Grundzeit ` +
    `+ ${STANDARD_ZEITMODELL.vorbereitungJeZugMs / 1000} s je Handgriff, Deckel ` +
    `${STANDARD_ZEITMODELL.vorbereitungHoechstMs / 1000} s) — im Messstand sitzen nur`,
);
console.log('  Bots, und die sind sofort bereit. Kampf und Nachlauf sind gemessen.');
console.log('  Welche Stellschraube wie viel bringt: werkzeug/spielzeit.mjs.');

const markenSchnitt = schnittQuote(a.marken, MINDEST);
console.log('');
console.log(`SIEGQUOTE JE MARKE (Schnitt der gezaehlten Zeilen: ${p1(markenSchnitt)})`);
tabelle(
  ['Marke', 'Antritte', 'Siege', 'Quote', 'zum Schnitt'],
  a.marken.map((z) => [
    synergie(z.name).name,
    String(z.antritte),
    String(z.siege),
    z.quote === null ? '-' : p1(z.quote),
    faktor(z, markenSchnitt),
  ]),
);
console.log('');
console.log(`  Gezaehlt wird ein Sitz, dessen LETZTES Brett die Marke mindestens zweimal`);
console.log(`  trug (erste Schwelle). Zeilen unter ${MINDEST} Antritten sagen nichts.`);

const einheitenSchnitt = schnittQuote(a.einheiten, MINDEST);
console.log('');
console.log(`SIEGQUOTE JE EINHEIT AUF DEM LETZTEN BRETT (Schnitt: ${p1(einheitenSchnitt)})`);
tabelle(
  ['Einheit', 'Gold', 'Antritte', 'Siege', 'Quote', 'zum Schnitt'],
  a.einheiten.map((z) => [
    einheit(z.name).name,
    String(einheit(z.name).kosten),
    String(z.antritte),
    String(z.siege),
    z.quote === null ? '-' : p1(z.quote),
    faktor(z, einheitenSchnitt),
  ]),
);
if (a.nieGesehen.length > 0) {
  console.log('');
  console.log(
    `  NIE AUF EINEM BRETT: ${a.nieGesehen.map((id) => einheit(id).name).join(', ')}`,
  );
}

console.log('');
console.log('SCHWELLEN — wie oft eine Marke bei einem Antritt welche Stufe hielt');
tabelle(
  ['Marke', ...SCHWELLEN.map((s) => `ab ${s}`), 'Traeger im Katalog'],
  [
    ...MARKEN.map((marke) => [
      synergie(marke).name,
      ...SCHWELLEN.map((s) => String(a.schwellen[marke][s])),
      String(KATALOG.filter((e) => e.marken.includes(marke)).length),
    ]),
    [
      'zusammen',
      ...SCHWELLEN.map((s) => `${a.schwellenGesamt[s]} (${p1(a.schwellenGesamt[s] / a.antritte)})`),
      '',
    ],
  ],
);
console.log('');
console.log(`  Nenner ist die Zahl der Antritte (${a.antritte}) — je Runde ein Eintrag fuer`);
console.log('  jeden lebenden Sitz. Ein Brett kann mehrere Schwellen gleichzeitig halten,');
console.log('  die Zeile "zusammen" kann deshalb ueber 100 % gehen.');
console.log('');
