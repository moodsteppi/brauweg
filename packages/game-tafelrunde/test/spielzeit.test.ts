/**
 * Spielzeit: wie lange eine Partie DAUERT, nicht wie viele Runden sie hat.
 *
 * Robins Vorgabe vom 05.09.2026: "durchschnittlich 8 Minuten maximum". Bis
 * dahin gab es im ganzen Paket keine Zahl in Sekunden — gemessen wurden
 * Runden, und eine Runde hat keine Laenge. Diese Datei haelt die Zerlegung
 * fest, die seitdem im Messstand steht (`Zeitmodell` in messen.ts), und die
 * Befunde, die dabei herausgekommen sind.
 *
 * SIE IST KEINE ABNAHME DER SPIELZEIT. Die Schranken hier stehen ueber den
 * heutigen Zahlen und halten sie fest; sie sagen nicht, dass die Zahlen gut
 * sind. Was gut ist, entscheidet Robin nach der Tabelle aus
 * `werkzeug/spielzeit.mjs` — die Auswertung steht in
 * docs/TAFELRUNDE-SPIELZEIT.md.
 *
 * BESTIMMT, NICHT ZUFAELLIG: feste Saatbasis, wie ueberall im Messstand. Ein
 * Fehlschlag ist immer eine Nachricht ueber das Spiel und nie ueber den
 * Wuerfel.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  STANDARD_ZEITMODELL,
  VIER_SITZE,
  messe,
  vorbereitungsdauer,
  werteAus,
  zeitbilanz,
} from './messen.js';
import {
  BRETT_FELDER,
  type Brettseite,
  DEFAULT_REGELN,
  type EinheitId,
  HOECHSTDAUER_MS,
  type Kaempferstand,
  STANDARD_REGLER,
  type Stufe,
  erstellePartie,
  platzNummer,
  protokollText,
  schadenFuerVerlierer,
  simuliereKampf,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Das Zeitmodell
// ---------------------------------------------------------------------------

describe('Spielzeit: das Zeitmodell', () => {
  /**
   * Wer nichts tut, wartet trotzdem.
   *
   * Die Grundzeit ist der Kern des Modells: Eine Vorbereitung kostet Zeit,
   * weil der Laden aufgeht und man hinsieht — nicht erst, weil man tippt.
   * Ohne sie waere eine Runde, in der niemand kauft, unendlich schnell, und
   * die geschaetzte Spielzeit einer sparsamen Partie faellt auf die reine
   * Kampfzeit.
   */
  it('rechnet die Grundzeit auch ohne einen einzigen Handgriff', () => {
    assert.equal(
      vorbereitungsdauer(0, STANDARD_ZEITMODELL),
      STANDARD_ZEITMODELL.vorbereitungGrundMs,
    );
  });

  it('legt je Handgriff denselben Betrag drauf', () => {
    const eins = vorbereitungsdauer(1, STANDARD_ZEITMODELL);
    const zwei = vorbereitungsdauer(2, STANDARD_ZEITMODELL);
    assert.equal(zwei - eins, STANDARD_ZEITMODELL.vorbereitungJeZugMs);
  });

  /**
   * Der Deckel ist keine Zierde: Die Plattform nimmt einem Sitz nach
   * `turnTimeoutMs` die Entscheidung ab und laesst den Bot ziehen. Eine
   * geschaetzte Vorbereitung, die darueber liegt, beschreibt einen Zustand,
   * den es am Tisch gar nicht gibt.
   */
  it('deckelt die Vorbereitung bei der Zugzeit der Plattform', () => {
    assert.equal(
      vorbereitungsdauer(1000, STANDARD_ZEITMODELL),
      STANDARD_ZEITMODELL.vorbereitungHoechstMs,
    );
  });

  /**
   * Die Bilanz muss aufgehen — sonst ist der Anteil, den ein Stueck an der
   * Spielzeit hat, keine Aussage, sondern eine Ziffer.
   */
  it('zerlegt die Spielzeit vollstaendig in ihre drei Stuecke', () => {
    const befunde = messe({
      partien: 5,
      sitze: VIER_SITZE,
      besetzung: 'normal',
      saatBasis: 'zerlegung',
    });
    for (const befund of befunde) {
      const b = zeitbilanz(befund, STANDARD_ZEITMODELL);
      assert.equal(b.gesamtMs, b.vorbereitungMs + b.kampfMs + b.nachlaufMs);
      // Je gekaempfter Runde genau ein Nachlauf, nicht je Kampf: Alle Kaempfe
      // einer Runde laufen gleichzeitig ab.
      assert.equal(
        b.nachlaufMs,
        befund.kampfphasen.length * STANDARD_ZEITMODELL.kampfNachlaufMs,
      );
      assert.equal(befund.zuegeJeRunde.length, befund.kampfphasen.length);
    }
  });

  /**
   * Die Kampfphase ist der LAENGSTE Kampf der Runde, nicht der Durchschnitt —
   * genauso rechnet `kampfdauer`, und danach richtet sich die Schaupause der
   * Plattform. Waere es der Durchschnitt, saehe die geschaetzte Spielzeit
   * kuerzer aus als das, was ein Spieler abwartet.
   */
  it('nimmt je Runde den laengsten Kampf als Kampfphase', () => {
    const [befund] = messe({
      partien: 1,
      sitze: VIER_SITZE,
      besetzung: 'normal',
      saatBasis: 'laengster',
    });
    assert.ok(befund);
    assert.ok(befund.kampfDauern.length >= befund.kampfphasen.length);
    for (const phase of befund.kampfphasen) {
      assert.ok(befund.kampfDauern.includes(phase), `${phase} ms ist kein Kampf dieser Partie`);
    }
    assert.ok(Math.max(...befund.kampfphasen) <= Math.max(...befund.kampfDauern));
  });
});

// ---------------------------------------------------------------------------
// Was heute herauskommt
// ---------------------------------------------------------------------------

/**
 * Hundertfuenfzig Partien zu viert, rund drei Sekunden.
 *
 * Weniger als die vierhundert der Ausgewogenheits-Probe, und das genuegt: Hier
 * geht es um einen Median ueber Partien und nicht um Siegquoten je Marke, die
 * einen Nenner in den Hunderten brauchen.
 */
const AUSWERTUNG = werteAus(
  messe({ partien: 150, sitze: VIER_SITZE, besetzung: 'normal', saatBasis: 'spielzeit-probe' }),
);

describe('Spielzeit: der heutige Stand', () => {
  /**
   * DER BEFUND, DEN DIESE DATEI FESTHAELT: Eine Partie dauert rund
   * dreizehneinhalb Minuten und damit deutlich mehr als Robins acht.
   *
   * Die Schranken liegen bewusst weit um den gemessenen Wert (13:31 am
   * 05.09.2026): Diese Probe soll nicht bei jeder Katalogaenderung anschlagen,
   * sondern dann, wenn jemand die Spielzeit ohne Absicht verdoppelt oder
   * halbiert. Wer sie ABSICHTLICH aendert, aendert hier die Zahlen mit — und
   * traegt den neuen Stand in docs/TAFELRUNDE-SPIELZEIT.md nach.
   */
  it('dauert im Median zwischen sechs und zwanzig Minuten', () => {
    const minuten = AUSWERTUNG.spielzeitMedianMs / 60_000;
    assert.ok(
      minuten > 6 && minuten < 20,
      `Median ${minuten.toFixed(1)} Minuten (gemessen am 05.09.2026: 13,5)`,
    );
  });

  /**
   * Der Kampf ist der groesste Posten — mit Abstand.
   *
   * Das ist die Antwort auf die eigentliche Frage der Aufgabe ("miss, woraus
   * die elf Minuten bestehen"): rund 70 % Kampf, 25 % Vorbereitung, 5 %
   * Nachlauf. Wer an der Vorbereitung dreht, dreht am kleinen Posten. Diese
   * Probe haelt die Rangfolge fest, damit die Empfehlung nicht still veraltet.
   */
  it('steckt seine Zeit vor allem in die Kaempfe', () => {
    const gesamt = AUSWERTUNG.vorbereitungMs + AUSWERTUNG.kampfMs + AUSWERTUNG.nachlaufMs;
    assert.ok(
      AUSWERTUNG.kampfMs / gesamt > 0.5,
      `nur ${((AUSWERTUNG.kampfMs / gesamt) * 100).toFixed(1)} % der Spielzeit sind Kampf`,
    );
    assert.ok(AUSWERTUNG.kampfMs > AUSWERTUNG.vorbereitungMs);
    assert.ok(AUSWERTUNG.vorbereitungMs > AUSWERTUNG.nachlaufMs);
  });

  /**
   * DER ZWEITE BEFUND, und der unangenehmere: Fast jeder dritte Kampf einer
   * echten Partie laeuft in `HOECHSTDAUER_MS` und wird von
   * `entscheideNachZeit` entschieden statt vom Brett.
   *
   * Die Probe in kampf.test.ts sieht das nicht, und zwar aus einem Grund, den
   * man kennen muss: Sie besetzt die Bretter ZUFAELLIG aus dem Katalog. Ein
   * Bot kauft aber nicht zufaellig — er kauft das Beste, verschmilzt auf Stufe
   * 2 und 3 und sammelt Marken, deren Boni Leben und Ruestung dazulegen. Auf
   * solchen Brettern dauert derselbe Kampf doppelt so lange (Median 35 s statt
   * 17 s).
   *
   * Deshalb steht die Messung hier NOCH EINMAL, auf Brettern aus echten
   * Partien. Die Schranke ist mit 45 % ueber dem heutigen Wert von rund 29 %:
   * Sie faerbt den Befund nicht gruen, sondern haelt ihn fest und schlaegt an,
   * wenn er schlimmer wird.
   */
  it('haelt fest, wie oft ein Kampf in die Hoechstdauer laeuft', () => {
    assert.ok(
      AUSWERTUNG.zeitAbbruchAnteil < 0.45,
      `${(AUSWERTUNG.zeitAbbruchAnteil * 100).toFixed(1)} % der Kaempfe enden durch Zeitablauf ` +
        `(gemessen am 05.09.2026: 29 %)`,
    );
    assert.ok(
      AUSWERTUNG.kampfMedianMs <= HOECHSTDAUER_MS,
      'der mittlere Kampf laeuft in die Abbruchgrenze',
    );
  });
});

// ---------------------------------------------------------------------------
// Der Kampfregler
// ---------------------------------------------------------------------------

/** Eine Bretthaelfte aus Spalte/Reihe-Angaben, wie in kampf.test.ts. */
function stelleAuf(
  liste: readonly (readonly [EinheitId, Stufe, number, number])[],
): Brettseite {
  const brett: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
  for (const [id, stufe, spalte, reihe] of liste) brett[platzNummer(reihe, spalte)] = { id, stufe };
  return brett;
}

/** Zwei kleine Bretter, die einander sicher ausloeschen — kein Zeitablauf im Weg. */
const ZWEI_BRETTER: readonly [Brettseite, Brettseite] = [
  stelleAuf([
    ['dorfwache', 1, 0, 0],
    ['astschuetze', 1, 2, 1],
  ]),
  stelleAuf([
    ['gassendieb', 1, 0, 0],
    ['schildknappe', 1, 2, 1],
  ]),
];

describe('Spielzeit: der Kampfregler', () => {
  /**
   * Der wichtigste Satz ueber den Regler: Ohne ihn aendert sich NICHTS.
   *
   * Er ist ein Messwerkzeug, kein Umbau. Waere der Standardablauf auch nur um
   * einen Takt anders als vorher, waeren alle Zahlen der letzten Messungen
   * ungueltig — und niemand haette es gemerkt.
   */
  it('rechnet mit dem Standardregler Ereignis fuer Ereignis wie ohne', () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(
        protokollText(simuliereKampf(ZWEI_BRETTER, `r${i}`, STANDARD_REGLER)),
        protokollText(simuliereKampf(ZWEI_BRETTER, `r${i}`)),
      );
    }
  });

  it('legt ohne Regler kein Feld in den Partiezustand', () => {
    const ohne = erstellePartie(DEFAULT_REGELN, VIER_SITZE, 'ohne-regler');
    assert.equal('regler' in ohne, false);
    const mit = erstellePartie(DEFAULT_REGELN, VIER_SITZE, 'mit-regler', STANDARD_REGLER);
    assert.deepEqual(mit.regler, STANDARD_REGLER);
  });

  /**
   * Der Zeitraffer macht denselben Kampf kuerzer — und zwar spuerbar, nicht um
   * eine Rundung. Zwei Drittel sind die grosszuegige Schranke fuer den Faktor
   * 1,5; gemessen liegt der Kampf bei rund 70 % seiner alten Dauer, weil die
   * Wartezeiten auf ganze Takte aufgerundet werden.
   */
  it('verkuerzt denselben Kampf mit Zeitraffer', () => {
    for (let i = 0; i < 20; i++) {
      const normal = simuliereKampf(ZWEI_BRETTER, `z${i}`);
      const schnell = simuliereKampf(ZWEI_BRETTER, `z${i}`, {
        ...STANDARD_REGLER,
        zeitraffer: 1.5,
      });
      assert.ok(
        schnell.dauerMs < normal.dauerMs,
        `Saat ${i}: ${schnell.dauerMs} ms ist nicht kuerzer als ${normal.dauerMs} ms`,
      );
    }
  });

  /**
   * Ein kleinerer Teiler bedeutet mehr Schaden je Niederlage — die zweite
   * Stellschraube der Aufgabe. Geprueft an der reinen Funktion, weil die Zahl
   * dort ohne Umwege sichtbar ist.
   */
  it('macht die Niederlage mit kleinerem Teiler teurer', () => {
    const ueberlebende: Kaempferstand[] = ([1, 2, 3] as Stufe[]).map((stufe) => ({
      id: stufe,
      seite: 0,
      einheitId: 'dorfwache',
      stufe,
      platz: stufe,
      leben: 10,
      hoechstesLeben: 10,
    }));
    assert.ok(schadenFuerVerlierer(ueberlebende, 1) > schadenFuerVerlierer(ueberlebende, 3));
    assert.equal(schadenFuerVerlierer(ueberlebende), schadenFuerVerlierer(ueberlebende, 3));
  });

  /**
   * Und der Regler kommt auch dort an, wo die Partie ihre Kaempfe rechnet:
   * `erstellePartie` -> Zustand -> `beginneKampf`. Ohne diese Kette waere er
   * ein Schalter, den nur `simuliereKampf` sieht — und die Messung ueber ganze
   * Partien liefe weiter auf den gebauten Werten.
   */
  it('kommt bis in die Kaempfe einer ganzen Partie durch', () => {
    const auftrag = {
      partien: 12,
      sitze: VIER_SITZE,
      besetzung: 'normal' as const,
      saatBasis: 'regler-durchgereicht',
    };
    const normal = werteAus(messe(auftrag));
    const schnell = werteAus(
      messe({ ...auftrag, regler: { ...STANDARD_REGLER, zeitraffer: 2 } }),
    );
    assert.ok(
      schnell.kampfMedianMs < normal.kampfMedianMs * 0.75,
      `Kampf im Median ${schnell.kampfMedianMs} ms gegen ${normal.kampfMedianMs} ms`,
    );
  });
});
