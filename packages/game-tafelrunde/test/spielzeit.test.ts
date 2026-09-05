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
   * Der Deckel ist keine Zierde: Nach `vorbereitungMs` gelten offene Sitze als
   * bereit und der Kampf beginnt (`fristAbgelaufen`). Eine geschaetzte
   * Vorbereitung, die darueber liegt, beschreibt einen Zustand, den es am
   * Tisch gar nicht gibt.
   */
  it('deckelt die Vorbereitung bei der Rundenfrist des Regelsatzes', () => {
    assert.equal(
      vorbereitungsdauer(1000, STANDARD_ZEITMODELL),
      DEFAULT_REGELN.vorbereitungMs,
    );
  });

  /**
   * Die Zahl hinter `vorbereitungMs` (regeln.ts): Sie liegt UEBER der
   * laengsten Vorbereitung, die eine zuegig gespielte Runde braucht — sonst
   * schnitte die Frist nicht den Truedler ab, sondern den Kauf, den jemand
   * gerade tippt.
   *
   * Gemessen wird der fleissigste Sitz je Runde, denn auf den wartet die
   * Phase. 800 Partien sind rund 7.600 Runden; die Schranke steht ueber dem
   * gemessenen Hoechstwert (23 Handgriffe, 39,5 s) und nicht darauf, damit
   * eine Katalogaenderung sie nicht sofort rot faerbt.
   */
  it('haelt die Rundenfrist ueber der laengsten gemessenen Vorbereitung', () => {
    const befunde = messe({
      partien: 800,
      sitze: VIER_SITZE,
      besetzung: 'normal',
      saatBasis: 'frist-v1',
    });
    const laengste = Math.max(
      ...befunde.flatMap((b) => b.zuegeJeRunde).map((zuege) =>
        // Ohne Deckel gerechnet: Der Deckel ist ja gerade das, was geprueft
        // wird — mit ihm kaeme immer die Frist selbst heraus.
        vorbereitungsdauer(zuege, { ...STANDARD_ZEITMODELL, vorbereitungHoechstMs: Infinity }),
      ),
    );
    assert.ok(
      laengste <= DEFAULT_REGELN.vorbereitungMs,
      `laengste Vorbereitung ${laengste} ms ueber der Frist ${DEFAULT_REGELN.vorbereitungMs} ms`,
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
   * siebeneinhalb Minuten und liegt damit unter Robins acht.
   *
   * Sie lag am selben Tag noch bei 13,5 Minuten; kuerzer wurde sie durch
   * Zeitraffer x2 und die Startleben (20 auf 14, spaeter auf 12 — siehe
   * STANDARD_REGLER und DEFAULT_REGELN) und dazwischen durch den Laden, der
   * sich bei jedem Kauf ganz erneuert. Dagegen zog der Bot, seit er auf Marken
   * spielt: Er baut staerkere Bretter, die laenger kaempfen, und kostete
   * knapp eine Minute. Die Schranken liegen bewusst weit um den gemessenen
   * Wert (7,2 am 05.09.2026 abends, davor 7,3): Diese Probe soll nicht bei
   * jeder Katalogaenderung anschlagen, sondern dann, wenn jemand die Spielzeit
   * ohne Absicht verdoppelt oder halbiert. Wer sie ABSICHTLICH aendert,
   * aendert hier die Zahlen mit — und traegt den neuen Stand in
   * docs/TAFELRUNDE-SPIELZEIT.md nach.
   */
  it('dauert im Median zwischen vier und vierzehn Minuten', () => {
    const minuten = AUSWERTUNG.spielzeitMedianMs / 60_000;
    assert.ok(
      minuten > 4 && minuten < 14,
      `Median ${minuten.toFixed(1)} Minuten (gemessen am 05.09.2026: 7,2)`,
    );
  });

  /**
   * Der Kampf ist der groesste Posten — mit Abstand.
   *
   * Das ist die Antwort auf die eigentliche Frage der Aufgabe ("miss, woraus
   * die elf Minuten bestehen"): rund 60 % Kampf, 35 % Vorbereitung, 5 %
   * Nachlauf. Wer an der Vorbereitung dreht, dreht am kleineren Posten. Diese
   * Probe haelt die Rangfolge fest, damit die Empfehlung nicht still veraltet.
   * Gemessen am 05.09.2026 abends: 59,8 / 34,9 / 5,3 (vormittags 57,4 / 36,7 /
   * 6,0 — der Kampf hat zugelegt, weil der Bot seitdem staerkere Bretter
   * baut).
   *
   * VOR DEM ZEITRAFFER waren es 70 / 25 / 5. Dass der Kampf nur noch knapp
   * ueber der Haelfte liegt, ist die Wirkung von x2 und kein neuer Befund —
   * der Anteil, den man wegnehmen wollte, ist weg. Die Schranke bleibt bei
   * der Haelfte: Faellt der Kampf DARUNTER, ist die Vorbereitung der groesste
   * Posten geworden, und dann gilt die Empfehlung von damals nicht mehr.
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
   * DER BEFUND, DER DEN ZEITRAFFER AUSGELOEST HAT — und seine Aufloesung.
   *
   * Vorher lief fast jeder dritte Kampf einer echten Partie in
   * `HOECHSTDAUER_MS` und wurde von `entscheideNachZeit` entschieden statt vom
   * Brett (29 %). Mit Zeitraffer x2 waren es 1,9 %, und seit ein Kauf den
   * ganzen Laden neu zieht, 4,3 %: Die Grenze ist wieder das Rettungsseil, das
   * sie sein soll — aber der neue Laden baut staerkere Bretter, und die halten
   * einander laenger aus. Diese Zeile geht bei einem Eingriff am Katalog als
   * Erstes.
   *
   * Die Probe in kampf.test.ts misst dasselbe auf ZUFAELLIG besetzten
   * Brettern und kommt deshalb tiefer heraus. Ein Bot kauft nicht zufaellig —
   * er kauft das Beste, verschmilzt auf Stufe 2 und 3 und sammelt Marken,
   * deren Boni Leben und Ruestung dazulegen; solche Bretter halten laenger
   * durch. Deshalb steht die Messung hier NOCH EINMAL, auf Brettern aus
   * echten Partien.
   *
   * Die Schranke ist von 45 % auf 10 % nachgezogen, weil sie sonst nichts
   * mehr faengt: Sie liegt damit weiter deutlich ueber dem gemessenen Wert,
   * schlaegt aber an, wenn der alte Zustand zurueckkommt.
   */
  it('haelt fest, wie oft ein Kampf in die Hoechstdauer laeuft', () => {
    assert.ok(
      AUSWERTUNG.zeitAbbruchAnteil < 0.1,
      `${(AUSWERTUNG.zeitAbbruchAnteil * 100).toFixed(1)} % der Kaempfe enden durch Zeitablauf ` +
        `(gemessen am 05.09.2026: 4,3 %, vor dem Zeitraffer 29 %)`,
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

/**
 * Der Regler OHNE Zeitraffer — der ungeraffte Ablauf als Bezugsgroesse.
 *
 * Er ist der Stand vor dem 05.09.2026. Jede Probe, die die WIRKUNG des
 * Reglers zeigen will, braucht ihn: Gegen den Standard verglichen (x2) waere
 * ein Zeitraffer von 1,5 laenger und einer von 2 gleich lang.
 */
const UNGERAFFT = { ...STANDARD_REGLER, zeitraffer: 1 };

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
   * eine Rundung. Gemessen liegt der Kampf bei Faktor 1,5 auf rund 70 % seiner
   * ungerafften Dauer, weil die Wartezeiten auf ganze Takte aufgerundet
   * werden.
   *
   * Verglichen wird ausdruecklich gegen UNGERAFFT und nicht gegen den
   * Standardregler: Der steht seit dem 05.09.2026 selbst auf x2, und x1,5
   * waere dagegen LAENGER. Die Probe pruefte dann die Voreinstellung statt der
   * Wirkung des Reglers.
   */
  it('verkuerzt denselben Kampf mit Zeitraffer', () => {
    for (let i = 0; i < 20; i++) {
      const normal = simuliereKampf(ZWEI_BRETTER, `z${i}`, UNGERAFFT);
      const schnell = simuliereKampf(ZWEI_BRETTER, `z${i}`, {
        ...UNGERAFFT,
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
    // Gegen UNGERAFFT und nicht gegen den Standard: Der ist seit dem
    // 05.09.2026 selbst x2, ein zweites x2 daneben waere derselbe Lauf.
    const langsam = werteAus(messe({ ...auftrag, regler: UNGERAFFT }));
    const schnell = werteAus(messe({ ...auftrag, regler: STANDARD_REGLER }));
    assert.ok(
      schnell.kampfMedianMs < langsam.kampfMedianMs * 0.75,
      `Kampf im Median ${schnell.kampfMedianMs} ms gegen ${langsam.kampfMedianMs} ms`,
    );
  });
});
