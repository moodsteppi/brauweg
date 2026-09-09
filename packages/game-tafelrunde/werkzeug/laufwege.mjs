/**
 * Wie viel wird im Kampf gelaufen — gemessen an echten Partien.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/laufwege.mjs --partien 500
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --partien 500        Wie viele Partien.
 *     --sitze 4            Sitze am Tisch, 2 bis 8.
 *     --besetzung normal   normal | sanft | hart | gemischt
 *     --saat laufwege-v1   Saatbasis. Dieselbe Basis = dieselben Partien.
 *     --marke "5 Spalten"  Beschriftung der Zeile in der JSON-Ausgabe.
 *     --json               Statt der Tabelle eine JSON-Zeile.
 *     --dist <pfad>        Anderes uebersetztes Paket messen (siehe unten).
 *
 * WOZU `--dist`: Brettbreite, Reihenzahl, Luecke und Reichweiten stehen als
 * Konstanten im Modul und nicht in einem Regler — anders als Zeitraffer und
 * Startleben lassen sie sich also nicht von aussen drehen. Um sie trotzdem zu
 * MESSEN, ohne das Spiel zu aendern, kopiert `laufwege-variante.mjs` das
 * uebersetzte `dist/`, aendert dort die eine Zahl, und `--dist` zeigt darauf.
 * Gemessen wird damit weiterhin das echte Modul und keine nachgebaute Kopie
 * (dieselbe Ueberlegung wie bei `Kampfregler` in kampf.ts, nur eine Stufe
 * tiefer). Gedreht wird hier NICHTS: Ohne `--dist` misst dieses Werkzeug den
 * gebauten Stand, und der ist seit dem 06.09.2026 die Arena 5x10 (vier Reihen
 * je Seite, zwei leere dazwischen).
 *
 * WARUM ECHTE PARTIEN UND KEINE ZUFAELLIGEN BRETTER: Der Unterschied ist
 * gross und in docs/TAFELRUNDE-SPIELZEIT.md nachgerechnet — ein Bot kauft
 * nicht zufaellig, er verschmilzt, sammelt Marken und stellt nach Rolle auf.
 * Genau die Aufstellung entscheidet aber, wer wie weit laufen muss.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const DIST = resolve(schalter('dist', resolve(HIER, '../dist')));
const MESSSTAND = resolve(DIST, 'test/messen.js');
const LAUFWEGE = resolve(DIST, 'test/laufwege.js');

if (!existsSync(MESSSTAND) || !existsSync(LAUFWEGE)) {
  console.error('Der Messstand fehlt unter: ' + DIST);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, messe, schnittQuote, werteAus } = await laden(MESSSTAND);
const { werteLaufAus } = await laden(LAUFWEGE);
const {
  ARENA_LUECKE,
  ARENA_REIHEN,
  ARENA_SPALTEN,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  KATALOG,
  STANDARD_REGLER,
  schrittdauer,
} = await laden(resolve(DIST, 'src/index.js'));

/** Wie lange ein Schritt am Bildschirm dauert — aus dem Modul, nicht geraten. */
const SCHRITT_DAUER_MS = schrittdauer(STANDARD_REGLER);

const PARTIEN = Number(schalter('partien', '500'));
const SITZZAHL = Number(schalter('sitze', '4'));
const BESETZUNG = schalter('besetzung', 'normal');
const SAAT_BASIS = schalter('saat', 'laufwege-v1');
const MARKE = schalter('marke', 'wie gebaut');
const ALS_JSON = process.argv.includes('--json');

if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}

/**
 * Ab wie vielen Antritten eine Marke beim Ausgewogenheits-Urteil mitzaehlt.
 * Dieselbe Hundert wie in ausgewogenheit.mjs und spielzeit.mjs.
 */
const MINDEST = 100;

const begonnen = Date.now();
const befunde = messe({
  partien: PARTIEN,
  sitze: ACHT_SITZE.slice(0, SITZZAHL),
  besetzung: BESETZUNG,
  saatBasis: SAAT_BASIS,
  laufwege: true,
});
const auswertung = werteAus(befunde);
const lauf = werteLaufAus(befunde.flatMap((b) => b.laufbefunde));

/**
 * Die Markenspanne: hoechster und niedrigster Faktor zum Schnitt.
 *
 * Sie steht in dieser Tabelle, weil eine Stellschraube am Brett die
 * Ausgewogenheit mitdreht — mehr Platz nuetzt einem Schuetzen anders als
 * einer Wache. Eine Zeile, die mehr Bewegung bringt und dabei den Katalog
 * schief zieht, ist kein Gewinn.
 */
function markenspanne(marken) {
  const schnitt = schnittQuote(marken, MINDEST);
  const zaehlt = marken.filter((m) => m.quote !== null && m.antritte >= MINDEST);
  if (zaehlt.length === 0 || schnitt === 0) return { unten: null, oben: null, zeilen: 0 };
  const faktoren = zaehlt.map((m) => m.quote / schnitt);
  return { unten: Math.min(...faktoren), oben: Math.max(...faktoren), zeilen: zaehlt.length };
}

const spanne = markenspanne(auswertung.marken);

const zeile = {
  marke: MARKE,
  geometrie: {
    brettSpalten: BRETT_SPALTEN,
    brettReihen: BRETT_REIHEN,
    arenaSpalten: ARENA_SPALTEN,
    arenaReihen: ARENA_REIHEN,
    arenaLuecke: ARENA_LUECKE,
    reichweiten: Object.fromEntries(
      [...new Set(KATALOG.map((e) => e.reichweite))].sort().map((r) => [
        r,
        KATALOG.filter((e) => e.reichweite === r).length,
      ]),
    ),
  },
  partien: PARTIEN,
  sitze: SITZZAHL,
  saatBasis: SAAT_BASIS,
  kaempfe: lauf.kaempfe,
  bewegungenMedian: lauf.bewegungenJeKampfMedian,
  bewegungenSchnitt: runde(lauf.bewegungenJeKampfSchnitt, 2),
  bewegungenP10: lauf.bewegungenP10,
  bewegungenP90: lauf.bewegungenP90,
  kaempfeOhneBewegung: runde(lauf.anteilKaempfeOhneBewegung, 4),
  bewegungenJeTreffer: runde(lauf.bewegungenJeTreffer, 4),
  einheitenGelaufen: runde(lauf.anteilEinheitenGelaufen, 4),
  sofortInReichweite: runde(lauf.anteilSofortInReichweite, 4),
  schritteBisTrefferMedian: lauf.schritteBisTrefferMedian,
  kampfdauerMedianMs: lauf.kampfdauerMedianMs,
  letzteBewegungMedianMs: lauf.letzteBewegungMedianMs,
  schritteJeEinheit: runde(lauf.schritteJeEinheit, 3),
  /**
   * Wie sich die aufgestellten Einheiten auf die Reihen verteilen.
   *
   * Steht in dieser Tabelle, weil die Aufstellung der Bots die Laufwege
   * ERZEUGT: Eine Zeile mit mehr Bewegung, die trotzdem nur zwei der vier
   * Reihen benutzt, hat nicht die Tiefe genutzt, sondern nur die Wege
   * verlaengert.
   */
  reihenAnteile: lauf.reihenAnteile.map((a) => runde(a, 4)),
  /**
   * Anteil der Kampfzeit, in dem eine Figur ihr Laufbild zeigt.
   *
   * Ein Schritt dauert `schrittdauer(STANDARD_REGLER)` — beim Zeitraffer 2
   * sind das 300 ms. Die Zahl ist die eigentliche Antwort auf "sieht man die
   * Laufzyklen": Sie steht im Nenner der Kampfdauer und nicht in der Zahl der
   * Bewegungen.
   */
  laufbildAnteil:
    lauf.kampfdauerMedianMs === null
      ? null
      : runde((lauf.schritteJeEinheit * SCHRITT_DAUER_MS) / lauf.kampfdauerMedianMs, 4),
  zeitAbbruchAnteil: runde(auswertung.zeitAbbruchAnteil, 4),
  spielzeitMedianMs: auswertung.spielzeitMedianMs,
  rundenMedian: auswertung.rundenMedian,
  markenspanneUnten: spanne.unten === null ? null : runde(spanne.unten, 3),
  markenspanneOben: spanne.oben === null ? null : runde(spanne.oben, 3),
  markenZeilen: spanne.zeilen,
  jeRolle: lauf.jeRolle.map((r) => ({
    rolle: r.rolle,
    einheiten: r.einheiten,
    gelaufen: runde(r.anteilGelaufen, 4),
    schritteMedian: r.schritteMedian,
    schritteSchnitt: runde(r.schritteSchnitt, 2),
    bisTrefferMedian: r.bisTrefferMedian,
    sofortInReichweite: runde(r.anteilSofortInReichweite, 4),
    startAbstandMedian: r.startAbstandMedian,
    reihenAnteile: r.reihenAnteile.map((a) => runde(a, 4)),
  })),
  rechenzeitMs: Date.now() - begonnen,
};

function runde(zahl, stellen) {
  const faktor = 10 ** stellen;
  return Math.round(zahl * faktor) / faktor;
}

if (ALS_JSON) {
  console.log(JSON.stringify(zeile));
} else {
  const proz = (n) => `${(n * 100).toFixed(1)} %`;
  const sek = (ms) => `${(ms / 1000).toFixed(1)} s`;
  console.log(`Laufwege — ${MARKE}`);
  console.log(
    `Brett ${BRETT_SPALTEN} x ${BRETT_REIHEN} je Seite, Arena ${ARENA_SPALTEN} x ${ARENA_REIHEN}` +
      ` (Luecke ${ARENA_LUECKE})` +
      ` · ${PARTIEN} Partien zu ${SITZZAHL}, Saatbasis ${SAAT_BASIS} · ${lauf.kaempfe} Kaempfe`,
  );
  console.log('');
  console.log(`Bewegungen je Kampf   Median ${zeile.bewegungenMedian}` +
    `  Schnitt ${zeile.bewegungenSchnitt}  (P10 ${zeile.bewegungenP10} / P90 ${zeile.bewegungenP90})`);
  console.log(`Kaempfe ganz ohne Schritt   ${proz(lauf.anteilKaempfeOhneBewegung)}`);
  console.log(`Bewegungen je Treffer       ${zeile.bewegungenJeTreffer}`);
  console.log(`Einheiten, die einmal liefen ${proz(lauf.anteilEinheitenGelaufen)}`);
  console.log(`Schon im Start in Reichweite ${proz(lauf.anteilSofortInReichweite)}`);
  console.log(`Schritte bis zum ersten Treffer, Median ${lauf.schritteBisTrefferMedian}`);
  console.log(
    `Schritte je Einheit ${zeile.schritteJeEinheit}` +
      ` -> Laufbild in ${proz(zeile.laufbildAnteil)} der Kampfzeit` +
      ` (ein Schritt ${SCHRITT_DAUER_MS} ms)`,
  );
  console.log(`Letzter Schritt eines Kampfes, Median ${sek(lauf.letzteBewegungMedianMs)}`);
  console.log(
    `Kampfdauer Median ${sek(lauf.kampfdauerMedianMs)}` +
      ` · von der Uhr entschieden ${proz(auswertung.zeitAbbruchAnteil)}` +
      ` · Partie ${sek(auswertung.spielzeitMedianMs)} bei ${auswertung.rundenMedian} Runden`,
  );
  console.log(
    `Markenspanne x${zeile.markenspanneUnten} bis x${zeile.markenspanneOben}` +
      ` (${spanne.zeilen} Marken ab ${MINDEST} Antritten)`,
  );
  console.log('');
  console.log(
    'Reihen (0 = vorn)  ' +
      lauf.reihenAnteile.map((a, i) => `R${i} ${proz(a)}`).join('  '),
  );
  console.log('');
  console.log(
    'Rolle       Einheiten  laeuft je   Schritte  bis 1. Treffer  sofort in RW  Startabstand' +
      '   Reihen 0..' + (lauf.reihenAnteile.length - 1),
  );
  for (const r of lauf.jeRolle) {
    console.log(
      r.rolle.padEnd(11) +
        String(r.einheiten).padStart(9) +
        proz(r.anteilGelaufen).padStart(11) +
        String(r.schritteMedian).padStart(10) +
        String(r.bisTrefferMedian).padStart(16) +
        proz(r.anteilSofortInReichweite).padStart(14) +
        String(r.startAbstandMedian).padStart(14) +
        '   ' +
        r.reihenAnteile.map((a) => `${(a * 100).toFixed(0)}%`.padStart(4)).join(' '),
    );
  }
  console.log('');
  console.log(`Rechenzeit ${(zeile.rechenzeitMs / 1000).toFixed(1)} s`);
}
