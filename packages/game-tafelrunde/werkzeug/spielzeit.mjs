/**
 * Spielzeit von Tafelrunde: woraus die Minuten bestehen, und was jede
 * Stellschraube EINZELN daran aendert.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/spielzeit.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --partien 500        Wie viele Partien JE ZEILE der Tabelle.
 *     --sitze 4            Sitze am Tisch, 2 bis 8.
 *     --besetzung normal   normal | sanft | hart | gemischt
 *     --saat spielzeit-v1  Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --nur teiler         Nur eine Gruppe rechnen (leben, teiler, vorbereitung,
 *                          takt, hoechstdauer, botTakt, kombination).
 *                          Mehrere mit Komma.
 *     --json               Statt der Tabelle die rohen Zeilen als JSON.
 *
 * WOZU ES DA IST, UND WARUM ES NICHT IM AUSGEWOGENHEITS-WERKZEUG STEHT: Dort
 * geht es um EINEN Stand — Siegquoten, Schwellen, Einheiten. Hier geht es um
 * den VERGLEICH mehrerer Staende, und zwar jeder mit genau einer geaenderten
 * Zahl. Robins Frage lautet nicht "wie lange dauert es", sondern "welche
 * Aenderung bringt wie viel"; darauf antwortet nur eine Tabelle, in der jede
 * Zeile sich von der ersten in einer einzigen Zahl unterscheidet.
 *
 * JEDE ZEILE RECHNET DIESELBEN SAATEN. Die Zeilen sind damit paarweise
 * vergleichbar: Ein Unterschied zwischen zwei Zeilen ist die Wirkung der
 * Schraube und nicht die Wirkung anderer Wuerfel.
 *
 * WAS EXAKT IST UND WAS GESCHAETZT: Kampf und Nachlauf stehen im Kampfbericht
 * bzw. im Adapter — das sind Zahlen. Die Vorbereitungszeit ist ein MODELL
 * (`Zeitmodell` in test/messen.ts): Im Messstand sitzen nur Bots, und die sind
 * sofort fertig. Es steht unter jeder Tabelle, mit welchen Annahmen gerechnet
 * wurde.
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

const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, STANDARD_ZEITMODELL, messe, schnittQuote, werteAus } = await laden(MESSSTAND);
const { DEFAULT_REGELN, STANDARD_REGLER } = await laden(resolve(HIER, '../dist/src/index.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const PARTIEN = Number(schalter('partien', '500'));
const SITZZAHL = Number(schalter('sitze', '4'));
const BESETZUNG = schalter('besetzung', 'normal');
const SAAT_BASIS = schalter('saat', 'spielzeit-v1');
const NUR = schalter('nur', '').split(',').filter(Boolean);
const ALS_JSON = process.argv.includes('--json');

if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);

/**
 * Ab wie vielen Antritten eine Marke beim Ausgewogenheits-Urteil mitzaehlt.
 *
 * Dieselbe Hundert wie im Ausgewogenheits-Werkzeug und aus demselben Grund:
 * Darunter ist der Faktor zum Schnitt eine Zufallszahl. Bei 500 Partien zu
 * viert fallen Drache und Untot regelmaessig heraus — sie stehen als eigene
 * Karten auf dem Board und werden hier nicht mitbeurteilt.
 */
const MINDEST = 100;

// ---------------------------------------------------------------------------
// Die Zeilen der Tabelle
// ---------------------------------------------------------------------------

/**
 * Eine Zeile ist eine Stellschraube auf einem Wert.
 *
 * `regeln`, `regler` und `zeitmodell` gehen jeweils vom Standard aus und
 * aendern GENAU EINE Zahl. Die Gruppe `kombination` ist die einzige Ausnahme
 * und heisst deshalb so — sie steht am Ende und ist im Kopf der Tabelle
 * ausdruecklich als solche ausgewiesen.
 */
function zeile(gruppe, name, wert, aenderung = {}) {
  return {
    gruppe,
    name,
    wert,
    regeln: { ...DEFAULT_REGELN, ...(aenderung.regeln ?? {}) },
    regler: { ...STANDARD_REGLER, ...(aenderung.regler ?? {}) },
    zeitmodell: { ...STANDARD_ZEITMODELL, ...(aenderung.zeitmodell ?? {}) },
  };
}

const ZEILEN = [
  zeile('heute', 'wie gebaut', '-'),

  // 1. Weniger Startleben. Untere Schranke ist die 10 aus pruefeRegeln.
  ...[16, 14, 12, 10].map((leben) =>
    zeile('leben', 'Startleben', String(leben), { regeln: { startLeben: leben } }),
  ),

  // 2. Mehr Schaden je Niederlage: kleinerer Teiler = groesserer Schaden.
  ...[2, 1].map((teiler) =>
    zeile('teiler', 'Schadensteiler', String(teiler), {
      regler: { schadenStufenTeiler: teiler },
    }),
  ),

  /*
   * 3. Kuerzere Vorbereitung. Gerechnet als DECKEL und nicht als kuerzere
   * Grundzeit: Eine Vorbereitung wird in der Wirklichkeit dadurch kuerzer,
   * dass ein Countdown laeuft, und nicht dadurch, dass die Spieler sich mehr
   * beeilen. Wer 25 Sekunden gibt, bekommt eine Phase von hoechstens 25
   * Sekunden — und meistens weniger, weil die meisten frueher fertig sind.
   */
  ...[25_000, 20_000, 15_000, 10_000].map((deckel) =>
    zeile('vorbereitung', 'Vorbereitung hoechstens', `${deckel / 1000} s`, {
      zeitmodell: { vorbereitungHoechstMs: deckel },
    }),
  ),

  // 4a. Der Takt allein — die Schraube, wie die Aufgabe sie nennt.
  ...[50, 25].map((takt) =>
    zeile('takt', 'Takt', `${takt} ms`, { regler: { taktMs: takt } }),
  ),

  /*
   * 4b. Der Zeitraffer: Angriffstempo UND Schrittweite zusammen. Das ist die
   * Schraube, die ein Taktwechsel eigentlich sein soll — ein feinerer Takt
   * macht den Kampf nur ueber die Rundung kuerzer, ein Zeitraffer macht ihn
   * wirklich schneller.
   */
  ...[1.25, 1.5, 2].map((faktor) =>
    zeile('takt', 'Zeitraffer', `x${faktor}`, { regler: { zeitraffer: faktor } }),
  ),

  /*
   * 5. Die Abbruchgrenze — die einzige Schraube, die den SCHWANZ der
   * Kampfdauer trifft und nicht den Median. Deshalb steht sie hier trotz der
   * ausdruecklichen Warnung im Kopf von HOECHSTDAUER_MS: Wer sie senkt, laesst
   * mehr Kaempfe von der Uhr entscheiden statt vom Brett. Die Spalte
   * "Abbruch" ist bei dieser Gruppe die WICHTIGERE der beiden Zahlen.
   */
  ...[30_000, 25_000, 20_000].map((grenze) =>
    zeile('hoechstdauer', 'Hoechstdauer', `${grenze / 1000} s`, {
      regler: { hoechstdauerMs: grenze },
    }),
  ),

  /*
   * 6. Der Takt, in dem die PLATTFORM Botzuege abarbeitet. Er steht in keiner
   * Regel dieses Moduls, sondern in meta.botTaktHoechstMs (adapter.ts) und
   * runtime/party.ts — und er ist trotzdem der groesste Posten der Wartezeit,
   * siehe die Tabelle "Woran ein Sitz wartet" unter der Ausgabe.
   */
  ...[800, 400, 200, 100].map((takt) =>
    zeile('botTakt', 'Bot-Takt', `${takt} ms`, { zeitmodell: { botTaktMs: takt } }),
  ),

  /*
   * Kombinationen, ausdruecklich als solche gekennzeichnet.
   *
   * Sie stehen hier, weil die Antwort auf Robins Frage sonst unvollstaendig
   * waere: Wenn KEINE einzelne Schraube das Ziel erreicht, muss das in der
   * Tabelle stehen und nicht in einem Nebensatz. Entschieden wird trotzdem
   * ueber die Einzelzeilen darueber — nur die sagen, welche Schraube wie viel
   * bringt.
   */
  zeile('kombination', 'Zeitraffer x1,5 + Teiler 2', '-', {
    regler: { zeitraffer: 1.5, schadenStufenTeiler: 2 },
  }),
  zeile('kombination', 'Zeitraffer x1,5 + Startleben 14', '-', {
    regeln: { startLeben: 14 },
    regler: { zeitraffer: 1.5 },
  }),
  zeile('kombination', 'Zeitraffer x2 + Teiler 2', '-', {
    regler: { zeitraffer: 2, schadenStufenTeiler: 2 },
  }),
  zeile('kombination', 'Zeitraffer x2 + Startleben 16', '-', {
    regeln: { startLeben: 16 },
    regler: { zeitraffer: 2 },
  }),
  zeile('kombination', 'Zeitraffer x2 + Startleben 14', '-', {
    regeln: { startLeben: 14 },
    regler: { zeitraffer: 2 },
  }),
  zeile('kombination', 'Zeitraffer x1,5 + Startleben 12', '-', {
    regeln: { startLeben: 12 },
    regler: { zeitraffer: 1.5 },
  }),
  zeile('kombination', 'Zeitraffer x1,5 + Startleben 14 + Vorb. 20 s', '-', {
    regeln: { startLeben: 14 },
    regler: { zeitraffer: 1.5 },
    zeitmodell: { vorbereitungHoechstMs: 20_000 },
  }),
].filter((z) => NUR.length === 0 || z.gruppe === 'heute' || NUR.includes(z.gruppe));

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

const beginn = Date.now();
const ergebnisse = ZEILEN.map((z) => {
  const befunde = messe({
    partien: PARTIEN,
    sitze: SITZE,
    besetzung: BESETZUNG,
    saatBasis: SAAT_BASIS,
    regeln: z.regeln,
    regler: z.regler,
  });
  const a = werteAus(befunde, z.zeitmodell);
  const marken = a.marken.filter((m) => m.antritte >= MINDEST);
  const schnitt = schnittQuote(a.marken, MINDEST);
  const faktoren = marken.map((m) => m.quote / schnitt);
  return {
    gruppe: z.gruppe,
    name: z.name,
    wert: z.wert,
    spielzeitMedianMs: a.spielzeitMedianMs,
    spielzeitSchnittMs: a.spielzeitSchnittMs,
    vorbereitungMs: a.vorbereitungMs,
    kampfMs: a.kampfMs,
    nachlaufMs: a.nachlaufMs,
    kampfMedianMs: a.kampfMedianMs,
    kampfP90Ms: a.kampfP90Ms,
    kampfphaseMedianMs: a.kampfphaseMedianMs,
    kampfphaseP90Ms: a.kampfphaseP90Ms,
    wartenMedianMs: a.wartenMedianMs,
    wartenP90Ms: a.wartenP90Ms,
    botWartenMedianMs: a.botWartenMedianMs,
    botWartenP90Ms: a.botWartenP90Ms,
    wartenGesamtMedianMs: a.wartenGesamtMedianMs,
    wartenGesamtP90Ms: a.wartenGesamtP90Ms,
    nachlaufJeRundeMs: z.zeitmodell.kampfNachlaufMs,
    rundenMedian: a.rundenMedian,
    rundenSchnitt: a.rundenSchnitt,
    siegerAnteil: a.mitSieger / a.partien,
    anDerGrenze: a.anDerGrenze,
    vorRundeFuenf: a.vorRundeFuenf,
    zeitAbbruchAnteil: a.zeitAbbruchAnteil,
    markenMin: faktoren.length > 0 ? Math.min(...faktoren) : null,
    markenMax: faktoren.length > 0 ? Math.max(...faktoren) : null,
    markenGezaehlt: marken.length,
  };
});
const dauer = Date.now() - beginn;

if (ALS_JSON) {
  console.log(JSON.stringify({ partien: PARTIEN, sitze: SITZE.length, ergebnisse }, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const p1 = (zahl) => `${(zahl * 100).toFixed(1)} %`;
const mmss = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const sek = (ms) => `${(ms / 1000).toFixed(1)} s`;

function tabelle(kopf, zeilen) {
  const alle = [kopf, ...zeilen.filter((z) => z !== null)];
  const breiten = kopf.map((_, spalte) =>
    Math.max(...alle.map((z) => String(z[spalte] ?? '').length)),
  );
  const striche = () => console.log('  ' + breiten.map((b) => '-'.repeat(b)).join('  '));
  const schreib = (z) =>
    console.log(
      '  ' +
        z
          .map((wert, spalte) =>
            spalte <= 1
              ? String(wert ?? '').padEnd(breiten[spalte])
              : String(wert ?? '').padStart(breiten[spalte]),
          )
          .join('  '),
    );
  schreib(kopf);
  striche();
  for (const z of zeilen) {
    if (z === null) striche();
    else schreib(z);
  }
}

/** Die Spanne der Markenfaktoren — die Zahl, an der Ausgewogenheit haengt. */
function markenSpanne(e) {
  if (e.markenMin === null) return 'zu duenn';
  return `x${e.markenMin.toFixed(2)}-${e.markenMax.toFixed(2)}`;
}

/**
 * Was an einer Zeile gerissen ist — leer, wenn nichts.
 *
 * Geprueft werden dieselben Schranken wie in test/ausgewogenheit.test.ts:
 * eindeutiger Sieger in jeder Partie, keine an der Rundengrenze, keine vor
 * Runde fuenf, jede gezaehlte Marke zwischen dem halben und dem doppelten
 * Schnitt. Eine kuerzere Partie, die niemand mehr gewinnt oder in der eine
 * Marke davonzieht, ist keine Loesung.
 */
function anmerkung(e) {
  const mangel = [];
  if (e.siegerAnteil < 1) mangel.push(`Sieger nur ${p1(e.siegerAnteil)}`);
  if (e.anDerGrenze > 0) mangel.push(`${e.anDerGrenze} an der Rundengrenze`);
  if (e.vorRundeFuenf > 0) mangel.push(`${e.vorRundeFuenf} vor Runde 5`);
  if (e.markenMin !== null && (e.markenMin < 0.5 || e.markenMax > 2)) {
    mangel.push('Marke ausserhalb x0,5-x2');
  }
  return mangel.join(', ');
}

const heute = ergebnisse[0];

console.log('');
console.log('Tafelrunde — Spielzeit je Stellschraube');
console.log(
  `${PARTIEN} Partien je Zeile, zu ${SITZE.length}, Besetzung ${BESETZUNG}, ` +
    `Saatbasis "${SAAT_BASIS}", ${(dauer / 1000).toFixed(1)} s`,
);

console.log('');
console.log('WORAUS DIE SPIELZEIT BESTEHT (Stand wie gebaut, im Mittel je Partie)');
tabelle(
  ['Stueck', '', 'Zeit', 'Anteil'],
  [
    ['Vorbereitung', '(geschaetzt)', mmss(heute.vorbereitungMs), p1(heute.vorbereitungMs / heute.spielzeitSchnittMs)],
    ['Kampf', '(gemessen)', mmss(heute.kampfMs), p1(heute.kampfMs / heute.spielzeitSchnittMs)],
    ['Nachlauf', '(gemessen)', mmss(heute.nachlaufMs), p1(heute.nachlaufMs / heute.spielzeitSchnittMs)],
    null,
    ['zusammen', '', mmss(heute.spielzeitSchnittMs), '100.0 %'],
  ],
);
console.log('');
console.log(`  Einzelner Kampf im Median: ${sek(heute.kampfMedianMs)}. ` +
  `Davon an der Hoechstdauer abgeschnitten: ${p1(heute.zeitAbbruchAnteil)}.`);

/*
 * Die zweite Tabelle, und die eigentliche Antwort auf Robins Frage: Nicht wie
 * lange eine Partie DAUERT, sondern wie lange man in ihr WARTET. Beide Posten
 * haben einen langen Schwanz, deshalb steht das neunte Zehntel daneben — im
 * Median ist an dieser Stelle nichts zu sehen.
 */
console.log('');
console.log('WORAN EIN SITZ WARTET (je Runde, Stand wie gebaut)');
tabelle(
  ['Wartezeit', 'Median', 'P90'],
  [
    [
      `auf die Bots nach dem eigenen "Bereit" (Takt ${STANDARD_ZEITMODELL.botTaktMs} ms)`,
      sek(heute.botWartenMedianMs),
      sek(heute.botWartenP90Ms),
    ],
    [
      'auf die fremden Kaempfe nach dem eigenen',
      sek(heute.wartenMedianMs + heute.nachlaufJeRundeMs),
      sek(heute.wartenP90Ms + heute.nachlaufJeRundeMs),
    ],
  ],
);
console.log('');
console.log('  Die erste Zeile ist eine OBERGRENZE und fuer Sitz 0 scharf: Vor ihm ist');
console.log('  niemand dran, also faengt kein Bot an, bevor er bereit gemeldet hat');
console.log('  (amZug in partie.ts nennt immer den kleinsten offenen Sitz).');
console.log(`  Die zweite enthaelt den Nachlauf von ${sek(heute.nachlaufJeRundeMs)}.`);

console.log('');
console.log('JEDE SCHRAUBE EINZELN (die letzten Zeilen sind KOMBINATIONEN)');
const zeilen = [];
let letzteGruppe = ergebnisse[0].gruppe;
for (const e of ergebnisse) {
  if (e.gruppe !== letzteGruppe) {
    zeilen.push(null);
    letzteGruppe = e.gruppe;
  }
  zeilen.push([
    e.name,
    e.wert,
    mmss(e.spielzeitMedianMs),
    `${e.spielzeitMedianMs >= heute.spielzeitMedianMs ? '+' : '-'}${p1(
      Math.abs(e.spielzeitMedianMs - heute.spielzeitMedianMs) / heute.spielzeitMedianMs,
    )}`,
    String(e.rundenMedian),
    sek(e.kampfMedianMs),
    /* Das neunte Zehntel des WARTENS je Runde, nicht der Phase: Die Aufgabe kam
       aus dem Schwanz, nicht aus dem Median. Gebildet als Summe JE (Runde,
       Sitz) und erst dann als Perzentil — siehe wartenGesamtP90Ms. */
    sek(e.wartenGesamtP90Ms),
    p1(e.zeitAbbruchAnteil),
    p1(e.siegerAnteil),
    markenSpanne(e),
    anmerkung(e),
  ]);
}
tabelle(
  [
    'Stellschraube',
    'Wert',
    'Spielzeit',
    'zu heute',
    'Runden',
    'Kampf',
    'Warten P90',
    'Abbruch',
    'Sieger',
    'Marken',
    'gerissen',
  ],
  zeilen,
);

console.log('');
console.log('  Spielzeit ist der MEDIAN ueber die Partien; "Runden" ebenfalls.');
console.log('  "Kampf" ist der Median eines einzelnen Kampfes, "Abbruch" der Anteil');
console.log('  der Kaempfe, die an HOECHSTDAUER_MS abgeschnitten wurden.');
console.log('  "Warten P90" ist das neunte Zehntel BEIDER Wartezeiten je Runde');
console.log('  zusammen (Bots plus fremde Kaempfe plus Nachlauf) — die Zahl, um die');
console.log('  es Robin ging. Sie steht als P90 da, weil der Median nichts zeigt.');
console.log('');
console.log(
  `  Zeitmodell der Vorbereitung: ${STANDARD_ZEITMODELL.vorbereitungGrundMs / 1000} s Grundzeit ` +
    `+ ${STANDARD_ZEITMODELL.vorbereitungJeZugMs / 1000} s je Handgriff, ` +
    `Deckel ${STANDARD_ZEITMODELL.vorbereitungHoechstMs / 1000} s.`,
);
console.log('  Diese beiden Zahlen sind gesetzt, nicht gemessen (siehe test/messen.ts).');
console.log('  Kampf und Nachlauf sind gemessen.');
console.log('');
