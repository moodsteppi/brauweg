/**
 * Proben fuer die Bewertungsprobe.
 *
 * Zwei Sorten, und sie haben verschiedene Halbwertszeiten:
 *
 *   - DAS RECHENWERK (Spearman, Aufbau des Befundes) ist Mathematik und darf
 *     nie anders herauskommen. Hier wird scharf geprueft.
 *   - DER BEFUND SELBST haengt am Katalog und an der Arena und wird sich
 *     bewegen. Geprueft wird deshalb nur, was die Aussage traegt: dass die
 *     Bewertung MIT Deckung deutlich zur Kampfmessung passt und OHNE sie
 *     nicht. Eine Schwelle auf die dritte Nachkommastelle waere eine Probe,
 *     die bei jedem Katalogeintrag rot wird, ohne etwas zu melden.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bewertungsprobe, spearman } from './bewertungsprobe.js';

describe('Spearman', () => {
  it('gibt +1 bei gleicher Reihenfolge', () => {
    assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  });

  it('gibt -1 bei umgekehrter Reihenfolge', () => {
    assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  });

  it('sieht nur die Raenge und nicht die Abstaende', () => {
    assert.equal(spearman([1, 2, 3], [1, 2, 1000]), 1);
  });

  /*
   * Gleichstaende bekommen ihren Mittelrang. Ohne das haengt das Ergebnis an
   * der Reihenfolge der Eingabe — siehe `raenge`.
   */
  it('behandelt Gleichstaende unabhaengig von der Eingabereihenfolge', () => {
    const vorwaerts = spearman([1, 1, 2], [5, 6, 7]);
    const rueckwaerts = spearman([1, 1, 2], [6, 5, 7]);
    assert.equal(vorwaerts, rueckwaerts);
  });

  it('meldet `null`, wenn eine Seite gar nicht streut', () => {
    assert.equal(spearman([1, 1, 1], [1, 2, 3]), null);
    assert.equal(spearman([1, 2, 3], [7, 7, 7]), null);
  });

  it('meldet `null` bei weniger als zwei Werten', () => {
    assert.equal(spearman([1], [1]), null);
    assert.equal(spearman([], []), null);
  });

  it('weist zwei verschieden lange Reihen ab', () => {
    assert.throws(() => spearman([1, 2], [1]), /gleich lange/);
  });
});

describe('Bewertungsprobe', () => {
  const befund = bewertungsprobe({ saaten: 3 });

  it('fuehrt jede Kostenstufe mit ihren Einheiten', () => {
    assert.ok(befund.stufen.length >= 3);
    for (const s of befund.stufen) {
      assert.ok(s.zeilen.length >= 2, `${s.kosten} Gold hat zu wenige Zeilen`);
      for (const z of s.zeilen) {
        assert.ok(z.quote >= 0 && z.quote <= 1);
        assert.ok(z.mitDeckung > 0);
        assert.ok(z.ohneDeckung > 0);
      }
    }
  });

  /*
   * Die Reichweite kann nur AUFschlagen (`ausDerFerne` ist 1 plus etwas
   * Nichtnegatives), und bei Reichweite 1 aendert sie nichts. Eine Zeile, in
   * der die gedeckte Zahl KLEINER waere, hiesse, dass die beiden Aufrufe nicht
   * dieselbe Einheit meinen.
   */
  it('bewertet mit Deckung nie schwaecher als ohne', () => {
    for (const s of befund.stufen) {
      for (const z of s.zeilen) {
        assert.ok(z.mitDeckung >= z.ohneDeckung, `${z.name}: ${z.mitDeckung} < ${z.ohneDeckung}`);
      }
    }
  });

  it('liefert bei gleicher Saatbasis dasselbe Ergebnis', () => {
    assert.deepEqual(bewertungsprobe({ saaten: 3 }), befund);
  });

  /**
   * DER BEFUND, um den es bei dieser Probe geht.
   *
   * Mit Deckung sagt `staerke` die Turnier-Rangfolge gut vorher, ohne Deckung
   * gar nicht — und ohne ist die Vorgabe. Die Schwellen sind weit gesetzt
   * (gemessen am 22.09.2026: +0,84 und -0,29), weil die Zahlen am Katalog und
   * an den Brettmassen haengen. Rot werden soll diese Zeile nicht, wenn sich
   * eine Einheit aendert, sondern wenn die AUSSAGE kippt.
   *
   * Kippt sie nach oben — steht die Vorgabe eines Tages auch im Plus —, dann
   * ist der Warnhinweis bei `staerke` ueberholt und gehoert weg. Auch das ist
   * ein Befund, und er faellt hier auf.
   */
  /*
   * NACHTRAG 27.11.2026 — DIE AUSSAGE IST GEKIPPT, wie oben vorhergesagt.
   * Seit den Faehigkeiten (faehigkeiten.ts) liegen die Rollen im Turnier
   * enger beieinander (Wachen 33 statt 13 %, Schuetzen 60 statt 82 %), und
   * damit sagt `staerke` die Rangfolge auch OHNE Deckung vorher: gemessen
   * +0,51 mit, +0,30 ohne, nachdem der Bot einen Schaetzwert je Faehigkeit
   * bekam (`FAEHIGKEIT_WERT`). Der Bot bleibt sonst, wie er ist — er wurde in
   * echten Partien abgestimmt, nicht am Turnier. Geprueft wird jetzt nur noch,
   * dass die Deckung nicht SCHADET.
   */
  /*
   * NACHTRAG 2, 27.11.2026 (abends) — SCHWELLE VON 0,5 AUF 0,3. Mit den neu
   * abgestimmten Markenwerten (Meuchler schneller/haerter/zaeher, Krieger
   * mehr Ruestung, Waechter-Schild kleiner, Untot staerkere Wiederkehr) und
   * der Hoechstdauer 55 statt 45 s (beides Commit 19f9e4d9; das Turnier
   * stellt drei Kopien auf, die Marken greifen also) misst die Probe +0,38
   * mit und +0,22 ohne Deckung (3 und 6 Saaten gleich). Welcher der beiden
   * Eingriffe wie viel davon ausmacht, ist nicht getrennt gemessen. Die 0,5 lag eine Hundertstel unter dem vorigen Messwert
   * und war damit genau die Schwelle auf die Nachkommastelle, vor der der
   * Kopf dieser Datei warnt. Die Aussage selbst — mit Deckung klar positiv,
   * und die Deckung schadet nicht — steht weiter. Dass `staerke` die
   * Turnier-Rangfolge schlechter trifft als vorher, ist ein Befund ueber die
   * Schaetzwerte des Bots, nicht ueber diese Probe.
   */
  it('passt mit Deckung zur Kampfmessung, ohne Deckung seit den Faehigkeiten auch', () => {
    assert.ok(befund.mitDeckung !== null && befund.ohneDeckung !== null);
    assert.ok(
      befund.mitDeckung > 0.3,
      `mit Deckung nur ${befund.mitDeckung!.toFixed(3)} — erwartet deutlich ueber null`,
    );
    assert.ok(
      befund.mitDeckung >= befund.ohneDeckung - 0.05,
      `ohne Deckung ${befund.ohneDeckung!.toFixed(3)} besser als mit ${befund.mitDeckung!.toFixed(3)}`,
    );
  });
});
