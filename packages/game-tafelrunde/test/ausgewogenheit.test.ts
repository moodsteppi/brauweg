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

import { ACHT_SITZE, messe, schnittQuote, werteAus } from './messen.js';
import { KATALOG, MARKEN, SCHWELLEN } from '../src/index.js';

/**
 * Achtzig Partien zu acht, rund vier Sekunden.
 *
 * Weniger waeren schneller und wertlos: Bei vierzig Partien traegt die
 * schwaechste gezaehlte Marke noch rund 230 Antritte, ihr Standardfehler
 * liegt bei anderthalb Prozentpunkten — bei zwanzig Partien waere er dreimal
 * so gross wie der Abstand, den die Probe messen soll. Mehr waeren besser und
 * gehoeren ins Werkzeug, nicht in einen Testlauf, den jemand vor jedem Commit
 * abwartet.
 */
const PARTIEN = 80;

/**
 * Eine eigene Saatbasis, nicht die des Werkzeugs.
 *
 * Sonst waere die Probe genau die Stichprobe, auf die der Katalog eingestellt
 * wurde — und ein Balancing, das nur bei diesen 80 Saaten aufgeht, faellt
 * dann nirgends mehr auf.
 */
const SAAT_BASIS = 'ausgewogenheit-probe';

/**
 * Ab wie vielen Antritten eine Zeile ueberhaupt mitgerechnet wird.
 *
 * Hundert ist keine Zierde: Bei einer Siegquote um 15 % liegt der
 * Standardfehler dort noch bei 3,6 Prozentpunkten, also bei rund einem
 * Viertel des Werts. Darunter wird der Faktor zum Schnitt zur Zufallszahl —
 * die Marke Drache hat ueber 80 Partien rund 35 Antritte und schwankte in den
 * Messungen zwischen 22 % und 39 %. Eine Probe, die das als Ausschlag laese,
 * schluege bei jeder zweiten Katalogaenderung grundlos an.
 *
 * Was dadurch UNGEPRUEFT bleibt, ist ausdruecklich festgehalten: Drache und
 * Untot fallen bei dieser Partienzahl immer heraus. Beide sind Befunde des
 * Werkzeugs und stehen im Konzeptdokument — Drache mit 34 % Siegquote ueber
 * 500 Partien ist der eigentliche Ausreisser des Katalogs, und ihn hier zu
 * pruefen ginge nur mit einem zehnmal so langen Testlauf.
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
  messe({ partien: PARTIEN, sitze: ACHT_SITZE, besetzung: 'normal', saatBasis: SAAT_BASIS }),
);

// ---------------------------------------------------------------------------
// Marken
// ---------------------------------------------------------------------------

describe('Ausgewogenheit: Marken', () => {
  /**
   * Keine Marke gewinnt mehr als das Doppelte des Schnitts und keine faellt
   * unter die Haelfte.
   *
   * Der Faktor zwei ist die Grenze, ab der eine Marke keine Wahl mehr ist,
   * sondern DIE Wahl: Wer eine Aufstellung findet, die doppelt so oft gewinnt
   * wie der Durchschnitt, spielt nichts anderes mehr.
   *
   * In dieser Auswahl reicht der weiteste Ausschlag von x1,52 (Elementar) bis
   * x0,64 (Meuchler) — nach beiden Seiten ist also Platz. ABER: Ueber die 500
   * Partien des Werkzeugs steht die Marke Drache bei x1,86, und das ist
   * knapp. Hier faellt sie mit rund 35 Antritten unter die Mindestzahl und
   * wird gar nicht geprueft; sie steht als Befund im Konzeptdokument. Wer den
   * Katalog anfasst, laesst deshalb das Werkzeug laufen und verlaesst sich
   * nicht auf diese Probe allein.
   */
  it('haelt jede gezaehlte Marke zwischen der Haelfte und dem Doppelten des Schnitts', () => {
    const schnitt = schnittQuote(AUSWERTUNG.marken, MINDEST_ANTRITTE);
    const gezaehlt = AUSWERTUNG.marken.filter((z) => z.antritte >= MINDEST_ANTRITTE);

    // Ohne Zeilen gibt es nichts zu vergleichen — und eine Probe, die bei
    // leerer Tabelle gruen ist, prueft nichts.
    assert.ok(gezaehlt.length >= 4, `nur ${gezaehlt.length} Marken mit genug Antritten`);
    assert.ok(schnitt > 0, 'der Schnitt der Siegquoten ist null');

    for (const zeile of gezaehlt) {
      const faktor = zeile.quote! / schnitt;
      assert.ok(
        faktor <= 2,
        `${zeile.name} gewinnt ${(zeile.quote! * 100).toFixed(1)} % ` +
          `(x${faktor.toFixed(2)} des Schnitts von ${(schnitt * 100).toFixed(1)} %, ` +
          `${zeile.antritte} Antritte)`,
      );
      assert.ok(
        faktor >= 0.5,
        `${zeile.name} gewinnt nur ${(zeile.quote! * 100).toFixed(1)} % ` +
          `(x${faktor.toFixed(2)} des Schnitts von ${(schnitt * 100).toFixed(1)} %, ` +
          `${zeile.antritte} Antritte)`,
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
   * Jede der drei Schwellen wird wenigstens erreicht.
   *
   * Das ist die schwaechste denkbare Aussage und trotzdem eine noetige: Ueber
   * 500 Partien stand die Schwelle 6 in 187 von 99.391 Antritten, also in
   * zwei von tausend. Sie ist damit heute schon fast eine Tabellenzeile ohne
   * Spiel (siehe Konzeptdokument), und wer an den Feldplaetzen oder am
   * Katalog dreht, kann sie ohne Absicht ganz abschalten. Auf einen ANTEIL
   * laesst sich das nicht pruefen — dafuer ist das Ereignis zu selten und die
   * Auswahl hier zu klein.
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
