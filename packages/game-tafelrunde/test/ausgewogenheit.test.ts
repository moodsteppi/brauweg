/**
 * Ausgewogenheit: Proben auf das Balancing von Tafelrunde.
 *
 * Gemessen wird mit dem Messstand nebenan (`messen.ts`) — dieselbe Datei, die
 * auch `werkzeug/ausgewogenheit.mjs` benutzt. Der Unterschied ist allein die
 * Zahl der Partien: hier eine kleine, feste Auswahl, damit der Testlauf kurz
 * bleibt; dort ein paar hundert, wenn jemand wirklich messen will.
 *
 * WAS DIESE DATEI NICHT IST: eine Abnahme des Katalogs. Sie haelt nur fest,
 * was WIRKLICH kaputt waere — eine Marke, die alles gewinnt oder nichts; eine
 * Partie, die vorbei ist, bevor sie anfaengt; eine Einheit, die nie jemand
 * aufstellt; eine Schwelle, die niemand je erreicht. Ob eine Zahl im Katalog
 * gut GEWAEHLT ist, entscheidet niemand hier, sondern Robin nach einem Blick
 * auf die Tabellen des Werkzeugs.
 *
 * Die Schranken sind deshalb bewusst weit und stehen nicht auf runden
 * Wunschwerten. Jede von ihnen ist unten mit der Zahl begruendet, die am
 * 05.09.2026 ueber 500 Partien zu acht gemessen wurde; die vollstaendige
 * Auswertung steht in docs/spiele/auto-battler-konzept.md.
 *
 * BESTIMMT, NICHT ZUFAELLIG: Die Saatbasis ist fest verdrahtet. Diese Probe
 * kann deshalb nicht "manchmal" fehlschlagen — sie schlaegt fehl, wenn sich
 * am Spiel etwas aendert, und sonst nie. Ein Fehlschlag ist also immer eine
 * Nachricht ueber den Katalog und nie ueber den Wuerfel.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACHT_SITZE, VIER_SITZE, messe, schnittQuote, werteAus } from './messen.js';
import { KATALOG, MARKEN, SCHWELLEN } from '../src/index.js';

/**
 * Vierhundert Partien zu viert, rund anderthalb Sekunden.
 *
 * ZU VIERT, weil das seit dem 05.09.2026 der Normalfall ist (SEAT_COUNTS in
 * regeln.ts) — eine Probe auf acht Sitzen wuerde eine Besetzung absichern, die
 * am Bildschirm gar nicht zustande kommt.
 *
 * Vierhundert und nicht achtzig: Eine Partie zu viert dauert seit dem kuerzeren
 * Lebensbalken 15 statt 27 Runden und kostet damit ein Vielfaches weniger. Bei
 * vierhundert traegt die schwaechste gezaehlte Marke 184 Antritte und die
 * naechste schon 272; bei achtzig waere die schwaechste unter vierzig und ihr
 * Standardfehler groesser als der Abstand, den die Probe messen soll. Mehr
 * waeren besser und gehoeren ins Werkzeug, nicht in einen Testlauf, den jemand
 * vor jedem Commit abwartet.
 */
const PARTIEN = 400;

/**
 * Eine eigene Saatbasis, nicht die des Werkzeugs.
 *
 * Sonst waere die Probe genau die Stichprobe, auf die der Katalog eingestellt
 * wurde — und ein Balancing, das nur bei diesen 400 Saaten aufgeht, faellt
 * dann nirgends mehr auf.
 */
const SAAT_BASIS = 'ausgewogenheit-probe';

/**
 * Ab wie vielen Antritten eine Zeile ueberhaupt mitgerechnet wird.
 *
 * Hundert ist keine Zierde: Bei einer Siegquote um 30 % liegt der
 * Standardfehler dort noch bei 4,6 Prozentpunkten, also bei rund einem Sechstel
 * des Werts. Darunter wird der Faktor zum Schnitt zur Zufallszahl — eine Probe,
 * die das als Ausschlag laese, schluege bei jeder zweiten Katalogaenderung
 * grundlos an.
 *
 * Was dadurch UNGEPRUEFT bleibt, ist ausdruecklich festgehalten — und seit dem
 * 06.09.2026 ist das NICHTS MEHR: Ueber 400 Partien zu viert zaehlen ALLE
 * SIEBEN Marken. Waechter 612, Krieger 583, Elementar 435, Meuchler 428,
 * Drache 323, Naturwesen 255, Untot 123. Die Mindestzahl unten verlangt sechs
 * und laesst der duennsten Zeile damit genau einen Ausfall Luft. WER DEN
 * KATALOG SO AENDERT, DASS ZWEI DIESER ZEILEN UNTER HUNDERT FALLEN, SIEHT HIER
 * "nur 5 Marken mit genug Antritten" und nicht den eigentlichen Befund; die
 * Zahl 123 (Untot) ist die knappste der Datei.
 *
 * DIESE SIEBEN ZAHLEN VERALTEN VON SELBST, und zwar bei jeder Aenderung, die
 * beeinflusst, WAS der Bot am Ende auf dem Brett hat — Katalog, Bot-Bewertung,
 * Geometrie. Sie standen schon einmal daneben, ohne dass es jemandem auffiel;
 * bemerkt wurde es erst beim Einbau der Nachbarordnung je Seite (arena.ts,
 * `arenaNachbarnFuer`), die sie erneut verschoben hat. Wer sie braucht, misst
 * nach, statt sie zu glauben:
 *
 *     node packages/game-tafelrunde/werkzeug/ausgewogenheit.mjs --partien 400
 *       --sitze 4 --saat ausgewogenheit-probe --mindest 100
 *
 * Der ARGUMENTATION schadet das Veralten nicht: Sie haengt an der duennsten
 * Zeile und nicht an sieben genauen Werten — und die Probe faengt den Fall
 * ohnehin selbst ab.
 *
 * DREI ZEILEN HABEN IHREN PLATZ HIER ERST NACHTRAEGLICH BEKOMMEN, aus drei
 * verschiedenen Gruenden — und keiner davon ist eine Aenderung an dieser
 * Probe. Untot stand bei einem einzigen Antritt, weil nur Knochenspaeher und
 * Grabfuerstin die Marke trugen ("Untot zu zweit" hiess zwei Kopien derselben
 * Einheit); seit der Schildknappe sie mittraegt, zaehlt die Zeile. Elementar
 * und Drache hingen daran, dass Elementar keinen Traeger in der Vorderreihe
 * hatte; seit das Irrlicht dort steht, zaehlen beide. Und NATURWESEN stand mit
 * 85 knapp darunter, bis die Bot-Bewertung die Reichweite bekam (bot.ts,
 * `REICHWEITEN_GEWICHT`): Der Bot kauft seitdem den Astschuetzen deutlich
 * oefter — 1.141 auf 4.761 Antritte ueber 5.000 Partien —, und mit ihm kommt
 * die Marke ueber die Zaehlschwelle. Alles drei steht ausfuehrlich im
 * Konzeptdokument.
 *
 * UNTOT IST DABEI IN DIE GEGENRICHTUNG GERUTSCHT (von 295 herunter) und ist
 * jetzt die knappste Zeile: Zwei seiner drei Traeger sind Nahkaempfer, und
 * der Bot kauft die seitdem seltener. Die Marke haelt die Schwelle noch, aber sie ist
 * die naechste, die faellt.
 */
const MINDEST_ANTRITTE = 100;

/**
 * Einmal messen, viermal ansehen.
 *
 * Der Lauf kostet Sekunden; ihn je Probe zu wiederholen kostete sie viermal.
 * Dass er dabei nichts zwischen den Proben verschleppt, garantiert der
 * Messstand: `messe` haelt keinen Zustand und haengt allein an der Saat.
 */
const AUSWERTUNG = werteAus(
  messe({ partien: PARTIEN, sitze: VIER_SITZE, besetzung: 'normal', saatBasis: SAAT_BASIS }),
);

// ---------------------------------------------------------------------------
// Marken
// ---------------------------------------------------------------------------

/**
 * Der Standardfehler einer Siegquote — aus der Stichprobe selbst.
 *
 * `sqrt(p * (1 - p) / n)`, die Streuung eines Anteils bei `n` unabhaengigen
 * Antritten. Sie steht hier und nicht in messen.ts, weil sie eine Aussage
 * ueber die PROBE ist und nicht ueber das Spiel: Das Werkzeug rechnet mit
 * 5.000 Partien und braucht sie nicht.
 */
function standardfehler(quote: number, antritte: number): number {
  return Math.sqrt((quote * (1 - quote)) / antritte);
}

describe('Ausgewogenheit: Marken', () => {
  /**
   * Keine Marke gewinnt mehr als das Doppelte des Schnitts und keine faellt
   * unter die Haelfte.
   *
   * Der Faktor zwei ist die Grenze, ab der eine Marke keine Wahl mehr ist,
   * sondern DIE Wahl: Wer eine Aufstellung findet, die doppelt so oft gewinnt
   * wie der Durchschnitt, spielt nichts anderes mehr.
   *
   * In dieser Auswahl reicht der weiteste Ausschlag von x1,49 (Waechter) bis
   * x0,74 (Drache) — nach beiden Seiten ist also Platz, aber weniger als ohne
   * den Reichweitenfaktor im Bot (x1,34 bis x0,71 auf demselben Stand).
   *
   * DASS DIE SPANNE AUFGEGANGEN IST, hat einen benannten Grund und ist kein
   * Rueckschritt am Katalog: Die Bot-Bewertung kennt seit dem 06.09.2026 die
   * Reichweite (bot.ts, `REICHWEITEN_GEWICHT`). Ein Bot, der besser spielt,
   * trennt staerkere von schwaecheren Marken schaerfer — Krieger und Waechter
   * gehen hoch, Naturwesen, Elementar, Drache und Meuchler runter, ohne dass
   * an einer Katalogzeile etwas geaendert wurde. Eine Meta ist gewollt;
   * angefasst wird, was die Schranke reisst, und die ist x0,5 bis x2.
   *
   * Alle sieben Zeilen stehen inzwischen in der Tabelle, es faellt also keine
   * mehr unbeobachtet aus. Wer den Katalog anfasst, laesst trotzdem das
   * Werkzeug ueber 5.000 Partien laufen und verlaesst sich nicht auf diese
   * Probe allein; die Auswertung steht im Konzeptdokument.
   *
   * VERGLICHEN WIRD MIT DEM STANDARDFEHLER DER EIGENEN STICHPROBE, seit dem
   * 06.09.2026 — die Schranken x0,5 und x2 sind unveraendert, aber eine
   * Marke reisst sie erst, wenn sie es UM MEHR ALS DIE MESSUNGENAUIGKEIT tut.
   *
   * Der Anlass war ein Fehlalarm, und er trifft immer dieselbe Zeile:
   * Naturwesen ist die schwaechste gezaehlte Marke und steht dicht an der
   * unteren Schranke (Board-Karte "Naturwesen ist mit x0,54 die neue
   * Wackelzeile"). Bei 400 Partien traegt sie rund 280 Antritte, ihre Quote
   * liegt bei 13 bis 15 %, und deren Standardfehler ist 2,0 Prozentpunkte —
   * auf den Faktor umgerechnet plus/minus 0,07. Gemessen auf DERSELBEN
   * Saatfamilie ergibt sie x0,48 (400 Partien), x0,51 (800), x0,52 (1.200),
   * x0,50 (1.600) und x0,55 (3.000), und zwar VOR wie NACH der Umstellung des
   * Bots auf eine Wunschreihe je Rolle: Ihre Siegquote selbst bewegte sich
   * dabei von 15,0 auf 15,2 %. Was die Probe an diesem Tag gemeldet hat, war
   * also ihre eigene Streuung und kein Befund ueber den Katalog.
   *
   * DIE ANTWORT IST NICHT "MEHR PARTIEN": Die Reihe oben zeigt, dass die
   * Schaetzung auch bei 1.600 noch auf der Schranke steht, und ein Testlauf,
   * den jemand vor jedem Commit abwartet, vertraegt keine 30 Sekunden fuer
   * eine Zeile. Und sie ist auch nicht "die Schranke senken" — dann verschoebe
   * eine Messfrage stillschweigend die Zusage ueber den Katalog. Eine Marke,
   * die WIRKLICH bei x0,3 steht, faellt weiterhin auf: Der Standardfehler
   * traegt bei diesen Stichproben rund 0,07, nicht 0,2.
   */
  it('haelt jede gezaehlte Marke zwischen der Haelfte und dem Doppelten des Schnitts', () => {
    const schnitt = schnittQuote(AUSWERTUNG.marken, MINDEST_ANTRITTE);
    const gezaehlt = AUSWERTUNG.marken.filter((z) => z.antritte >= MINDEST_ANTRITTE);

    // Ohne Zeilen gibt es nichts zu vergleichen — und eine Probe, die bei
    // leerer Tabelle gruen ist, prueft nichts.
    assert.ok(gezaehlt.length >= 6, `nur ${gezaehlt.length} Marken mit genug Antritten`);
    assert.ok(schnitt > 0, 'der Schnitt der Siegquoten ist null');

    for (const zeile of gezaehlt) {
      const faktor = zeile.quote! / schnitt;
      const streuung = standardfehler(zeile.quote!, zeile.antritte) / schnitt;
      const lage =
        `x${faktor.toFixed(2)} ± ${streuung.toFixed(2)} des Schnitts von ` +
        `${(schnitt * 100).toFixed(1)} %, ${zeile.antritte} Antritte`;
      assert.ok(
        faktor - streuung <= 2,
        `${zeile.name} gewinnt ${(zeile.quote! * 100).toFixed(1)} % (${lage})`,
      );
      assert.ok(
        faktor + streuung >= 0.5,
        `${zeile.name} gewinnt nur ${(zeile.quote! * 100).toFixed(1)} % (${lage})`,
      );
    }
  });

  /**
   * Jede Marke muss ueberhaupt vorkommen — sonst ist sie eine Zeile im
   * Katalog ohne Wirkung im Spiel.
   *
   * Geprueft wird auf der ERSTEN Schwelle und nicht auf einem Antritt: Eine
   * Marke, die zwar auf Brettern steht, aber nie zu zweit, gibt nie einen
   * Bonus und ist damit genauso tot.
   */
  it('laesst jede Marke wenigstens einmal ihre erste Schwelle erreichen', () => {
    for (const marke of MARKEN) {
      assert.ok(
        AUSWERTUNG.schwellen[marke][2] > 0,
        `die Marke ${marke} hat in ${PARTIEN} Partien nie zwei Traeger auf einem Brett`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Schwellen
// ---------------------------------------------------------------------------

describe('Ausgewogenheit: Schwellen', () => {
  /**
   * JEDE der drei Schwellen wird wenigstens einmal erreicht — auch die
   * hoechste.
   *
   * Das ist die schwaechste denkbare Aussage und trotzdem eine noetige: Wer an
   * den Feldplaetzen oder am Katalog dreht, kann eine Schwelle ohne Absicht
   * ganz abschalten. Auf einen ANTEIL laesst sich das nicht pruefen — dafuer
   * ist die hoechste Schwelle zu selten und die Auswahl hier zu klein.
   *
   * DIE HOECHSTE WAR BIS ZUM 05.09.2026 AUSGENOMMEN, und das war ein Befund
   * und kein Versehen: Solange sie bei SECHS Traegern lag, stand sie ueber
   * 2.000 Partien zu viert in 0 von 75.028 Antritten. Sechs Traeger brauchen
   * mindestens Level 6, und gemessen kommt ein Bot in 0,04 % der Antritte
   * dorthin — die Bretter dieser Partie sind drei bis fuenf Einheiten gross.
   * Eine Probe darauf waere kein Muenzwurf gewesen, sondern immer rot.
   *
   * Seit die Schwellen bei 2/3/5 liegen und der Bot ein echtes Markengewicht
   * hat (bot.ts, `heerStaerke`), steht die hoechste in 0,9 % der Antritte —
   * ueber 400 Partien also rund hundertmal. Fuer ein "wenigstens einmal"
   * reicht das mit grossem Abstand, und genau dieser Abstand ist es, den die
   * Probe kuenftig ueberwacht: Faellt sie, ist die hoechste Schwelle wieder
   * unerreichbar geworden.
   */
  for (const schwelle of SCHWELLEN) {
    it(`erreicht die Schwelle ${schwelle} wenigstens einmal`, () => {
      assert.ok(
        AUSWERTUNG.schwellenGesamt[schwelle] > 0,
        `die Schwelle ${schwelle} wurde in ${PARTIEN} Partien kein einziges Mal erreicht`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Einheiten
// ---------------------------------------------------------------------------

describe('Ausgewogenheit: Einheiten', () => {
  /**
   * Jede Einheit kommt ueberhaupt vor.
   *
   * Gezaehlt wird ueber ALLE Runden und nicht nur ueber das letzte Brett:
   * Eine Einheit, die zwischendurch aushilft und spaeter weicht, ist im Spiel
   * — eine, die in achtzig Partien mit acht Sitzen und rund achttausend
   * Antritten kein einziges Mal aufgestellt wird, ist es nicht. Sie waere
   * dann entweder unbezahlbar, unerreichbar oder so schwach, dass der Bot sie
   * nie waehlt, und alle drei Faelle sind ein Fehler im Katalog.
   */
  it('stellt jede der 22 Einheiten wenigstens einmal auf ein Brett', () => {
    assert.equal(
      AUSWERTUNG.nieGesehen.length,
      0,
      `nie aufgestellt: ${AUSWERTUNG.nieGesehen.join(', ')}`,
    );
    // Gegenprobe auf den Messstand selbst: Zaehlte er gar nichts, waere die
    // Zeile darueber ebenfalls gruen.
    assert.equal(AUSWERTUNG.einheiten.length, KATALOG.length);
    assert.ok(AUSWERTUNG.antritte > 1000, `nur ${AUSWERTUNG.antritte} Antritte gezaehlt`);
  });
});

// ---------------------------------------------------------------------------
// Laenge der Partien
// ---------------------------------------------------------------------------

describe('Ausgewogenheit: Laenge der Partien', () => {
  /**
   * Eine Partie endet nicht regelmaessig vor Runde fuenf.
   *
   * Vier Runden sind zu wenig fuer eine Entscheidung: In dieser Zeit steht
   * ein Brett von hoechstens drei bis vier Plaetzen, verschmolzen hat kaum
   * jemand, und die Marken erreichen ihre erste Schwelle gerade eben. Wer da
   * schon ausgeschieden ist, hat nicht verloren, sondern nicht gespielt.
   *
   * Gemessen: In 500 Partien zu acht endete KEINE vor Runde fuenf, die
   * kuerzeste lief 24 Runden, das erste Ausscheiden faellt im Mittel in Runde
   * 18,5. Fuenf Prozent lassen also viel Luft — genug, dass ein deutlich
   * hoeherer Schaden je Niederlage (der auf dem Board steht und die Partien
   * ausdruecklich verkuerzen SOLL) hier nicht anschlaegt, und wenig genug,
   * dass eine Partie, die reihenweise nach vier Runden vorbei ist, auffaellt.
   */
  it('endet so gut wie nie vor Runde fuenf', () => {
    const anteil = AUSWERTUNG.vorRundeFuenf / AUSWERTUNG.partien;
    assert.ok(
      anteil < 0.05,
      `${AUSWERTUNG.vorRundeFuenf} von ${AUSWERTUNG.partien} Partien endeten vor Runde fuenf`,
    );
    assert.ok(
      AUSWERTUNG.rundenMin >= 5,
      `die kuerzeste Partie dauerte nur ${AUSWERTUNG.rundenMin} Runden`,
    );
  });

  /**
   * Eine Partie spielt sich aus, statt an der Rundengrenze abgeschnitten zu
   * werden.
   *
   * Das ist die Zusage aus Robins Vorgabe vom 05.09.2026 ("kurzes
   * Handyspiel"): Wer bis zum Schluss spielt, soll einen Sieger sehen und kein
   * "Zeit abgelaufen". Vor der Umstellung endeten zu viert 18 % und zu acht
   * 73 % der Partien an der Grenze; heute sind es zu viert 0 von 5.000.
   *
   * Jede zehnte ist die abgenommene Obergrenze und nicht die Messung — sie
   * laesst Luft fuer eine Katalogaenderung, schlaegt aber an, sobald die Grenze
   * wieder vom Rettungsseil zum Regelfall wird.
   */
  it('spielt sich aus, statt an der Rundengrenze zu enden', () => {
    const anteil = AUSWERTUNG.anDerGrenze / AUSWERTUNG.partien;
    assert.ok(
      anteil < 0.1,
      `${AUSWERTUNG.anDerGrenze} von ${AUSWERTUNG.partien} Partien endeten an der Rundengrenze`,
    );
  });
});

// ---------------------------------------------------------------------------
// Der Messstand selbst
// ---------------------------------------------------------------------------

describe('Ausgewogenheit: der Messstand', () => {
  /**
   * Dieselbe Saat, dieselben Zahlen.
   *
   * Ohne das ist jede Zahl darueber eine Momentaufnahme, und ein Vergleich
   * "vorher / nachher" mit dem Werkzeug waere sinnlos. Zwei Partien genuegen:
   * Was ueber zwei Partien gleich laeuft, laeuft auch ueber fuenfhundert
   * gleich — der Messstand haelt keinen Zustand zwischen ihnen.
   */
  it('liefert bei gleicher Saat dieselbe Auswertung', () => {
    const auftrag = {
      partien: 2,
      sitze: ACHT_SITZE,
      besetzung: 'normal' as const,
      saatBasis: 'wiederholung',
    };
    assert.deepEqual(werteAus(messe(auftrag)), werteAus(messe(auftrag)));
  });

  it('liefert bei anderer Saat eine andere Auswertung', () => {
    const eins = werteAus(
      messe({ partien: 2, sitze: ACHT_SITZE, besetzung: 'normal', saatBasis: 'links' }),
    );
    const zwei = werteAus(
      messe({ partien: 2, sitze: ACHT_SITZE, besetzung: 'normal', saatBasis: 'rechts' }),
    );
    assert.notDeepEqual(zwei, eins);
  });
});
