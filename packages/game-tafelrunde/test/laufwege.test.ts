/**
 * Proben zur Laufweg-Auswertung (test/laufwege.ts).
 *
 * Gemessen wird hier nichts — die Messung steht in werkzeug/laufwege.mjs und
 * ihr Ergebnis in docs/TAFELRUNDE-LAUFWEGE.md. Diese Datei prueft nur, dass
 * die Auswertung zaehlt, was sie zu zaehlen behauptet: Ein Auszaehlfehler in
 * `laufbefund` faellt sonst nirgends auf, weil niemand die Zahl gegenpruefen
 * kann, die er gerade zum ersten Mal sieht.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARENA_LUECKE,
  type Brettseite,
  BRETT_FELDER,
  BRETT_REIHEN,
  type EinheitId,
  type Stufe,
  einheit,
  platzNummer,
  simuliereKampf,
} from '../src/index.js';
import { laufbefund, median, perzentil, werteLaufAus } from './laufwege.js';

function stelleAuf(
  liste: readonly (readonly [EinheitId, Stufe, number, number])[],
): Brettseite {
  const brett: ({ id: EinheitId; stufe: Stufe } | null)[] = new Array(BRETT_FELDER).fill(null);
  for (const [id, stufe, spalte, reihe] of liste) brett[platzNummer(reihe, spalte)] = { id, stufe };
  return brett;
}

describe('laufbefund', () => {
  it('zaehlt Bewegungen und Treffer wie das Protokoll', () => {
    const bericht = simuliereKampf(
      [
        stelleAuf([
          ['dorfwache', 1, 0, 0],
          ['astschuetze', 1, 2, 1],
        ]),
        stelleAuf([
          ['dorfwache', 1, 4, 0],
          ['astschuetze', 1, 2, 1],
        ]),
      ],
      'laufprobe-1',
    );
    const befund = laufbefund(bericht);

    assert.equal(
      befund.bewegungen,
      bericht.ereignisse.filter((e) => e.art === 'bewegung').length,
    );
    assert.equal(befund.treffer, bericht.ereignisse.filter((e) => e.art === 'treffer').length);
    assert.equal(befund.einheiten.length, bericht.start.length);
    // Die Summe der Einzelschritte ist die Zahl der Bewegungsereignisse — sonst
    // ist eine Bewegung entweder doppelt oder gar nicht zugeordnet worden.
    assert.equal(
      befund.einheiten.reduce((s, e) => s + e.schritte, 0),
      befund.bewegungen,
    );
  });

  it('nennt Rolle und Reichweite aus dem Katalog', () => {
    const bericht = simuliereKampf(
      [stelleAuf([['astschuetze', 1, 2, 1]]), stelleAuf([['dorfwache', 1, 2, 0]])],
      'laufprobe-2',
    );
    const schuetze = bericht.start.find((k) => k.einheitId === 'astschuetze')!;
    const befund = laufbefund(bericht);
    const zeile = befund.einheiten.find((e) => e.wer === schuetze.id)!;

    assert.equal(zeile.rolle, 'schuetze');
    assert.equal(zeile.reichweite, einheit('astschuetze').reichweite);
  });

  /*
   * Die Kernaussage der ganzen Messung, hier als Probe festgehalten — und die
   * Zeile, an der man den Umbau vom 06.09.2026 sieht.
   *
   * BIS DAHIN stand hier "hoechstens zwei": Vorderste und hinterste Reihe
   * lagen 1 bzw. 2 Felder von der naechsten gegnerischen entfernt, und damit
   * stand jede Reichweite ab 2 vom ersten Takt an im Ziel (das war der
   * gemessene Grund, aus dem kaum gelaufen wurde). Seit der Luecke ist der
   * kleinste moegliche Startabstand `ARENA_LUECKE + 1` — dieselbe Zahl, die
   * arena.test.ts als "Kopf an Kopf" prueft.
   *
   * Gerechnet und nicht abgeschrieben: Wer die Luecke wieder aendert, soll
   * hier keine Zahl nachziehen muessen, sondern nur die Aussage lesen.
   */
  it('haelt jeden Startabstand auf mindestens Luecke plus eins', () => {
    const hinten = BRETT_REIHEN - 1;
    const bericht = simuliereKampf(
      [
        stelleAuf([
          ['astschuetze', 1, 0, hinten],
          ['dorfwache', 1, 0, 0],
        ]),
        stelleAuf([
          ['astschuetze', 1, 4, hinten],
          ['dorfwache', 1, 4, 0],
        ]),
      ],
      'laufprobe-3',
    );
    const befund = laufbefund(bericht);
    for (const zeile of befund.einheiten) {
      assert.ok(
        zeile.startAbstand >= ARENA_LUECKE + 1,
        `Startabstand ${zeile.startAbstand} unterschreitet ${ARENA_LUECKE + 1}`,
      );
    }
    /*
     * Und die Folge davon, um die es in der ganzen Karte ging: Ein Schuetze
     * (Reichweite 3) in seiner eigenen HINTERSTEN Reihe steht nicht mehr von
     * Anfang an im Ziel. Vor dem Umbau war genau das der Fall — bei 14.862
     * gemessenen Schuetzen ausnahmslos.
     */
    for (const zeile of befund.einheiten) {
      if (zeile.rolle === 'schuetze') assert.equal(zeile.sofortInReichweite, false);
    }
  });

  it('zaehlt Schritte VOR dem ersten Treffer, nicht danach', () => {
    const bericht = simuliereKampf(
      // BEIDE auf Spalte 0: Seite 1 wird punktgespiegelt in die Arena gelegt
      // (arena.ts), ihre Spalte 0 liegt also gegenueber der Spalte 4 von
      // Seite 0. Zwei gleiche Spaltennummern stehen damit maximal weit
      // auseinander — genau der Fall, in dem gelaufen werden MUSS.
      [stelleAuf([['gassendieb', 1, 0, 0]]), stelleAuf([['dorfwache', 1, 0, 0]])],
      'laufprobe-4',
    );
    const befund = laufbefund(bericht);
    const dieb = befund.einheiten.find((e) => e.rolle === 'meuchler')!;

    assert.ok(dieb.hatGetroffen, 'der Meuchler soll seinen Gegner erreichen');
    assert.ok(dieb.schritteBisTreffer !== null);
    assert.ok(
      dieb.schritteBisTreffer! > 0,
      'quer ueber das Brett kommt niemand ohne einen Schritt',
    );
    assert.ok(dieb.schritteBisTreffer! <= dieb.schritte);
  });

  it('laesst Einheiten ohne eigenen Treffer aus der Schrittzahl heraus', () => {
    // Eine Wache gegen eine Uebermacht: Sie faellt, bevor sie zuschlaegt —
    // ihre Null darf den Median der anderen nicht nach unten ziehen.
    const befund = laufbefund(
      simuliereKampf(
        [
          stelleAuf([['dorfwache', 1, 0, 1]]),
          stelleAuf([
            ['bogenmeisterin', 3, 0, 0],
            ['bogenmeisterin', 3, 1, 0],
            ['bogenmeisterin', 3, 2, 0],
          ]),
        ],
        'laufprobe-5',
      ),
    );
    for (const zeile of befund.einheiten) {
      if (!zeile.hatGetroffen) assert.equal(zeile.schritteBisTreffer, null);
    }
  });
});

describe('werteLaufAus', () => {
  it('fasst mehrere Kaempfe zu einer Zeile zusammen', () => {
    const befunde = ['a', 'b', 'c'].map((saat) =>
      laufbefund(
        simuliereKampf(
          [
            stelleAuf([
              ['dorfwache', 1, 1, 0],
              ['astschuetze', 1, 2, 1],
            ]),
            stelleAuf([
              ['dorfwache', 1, 3, 0],
              ['astschuetze', 1, 2, 1],
            ]),
          ],
          saat,
        ),
      ),
    );
    const zeile = werteLaufAus(befunde);

    assert.equal(zeile.kaempfe, 3);
    assert.equal(zeile.einheiten, befunde.reduce((s, b) => s + b.einheiten.length, 0));
    /*
     * Anteil und Auszaehlung muessen dasselbe sagen — und zwar OHNE eine
     * Annahme ueber die Geometrie. Ein `> 0` stand hier bis zum 06.09.2026
     * und fiel mit der Luecke: Seitdem beginnt kein Kampf mehr in Kontakt,
     * der Anteil ist glatt null, und die Probe waere rot geworden, obwohl
     * die Auswertung genau das Richtige zaehlt.
     */
    const sofort = befunde.flatMap((b) => b.einheiten).filter((e) => e.sofortInReichweite).length;
    assert.equal(zeile.anteilSofortInReichweite, sofort / zeile.einheiten);
    // Jede Rolle steht in der Tabelle, auch die leeren: Eine fehlende Zeile
    // laese sich beim Vergleich zweier Laeufe als Null missdeuten.
    assert.equal(zeile.jeRolle.length, 5);
    assert.equal(
      zeile.jeRolle.reduce((s, r) => s + r.einheiten, 0),
      zeile.einheiten,
    );
  });

  it('vertraegt einen leeren Lauf, ohne durch null zu teilen', () => {
    const zeile = werteLaufAus([]);
    assert.equal(zeile.kaempfe, 0);
    assert.equal(zeile.anteilEinheitenGelaufen, 0);
    assert.equal(zeile.bewegungenJeTreffer, 0);
    assert.equal(zeile.bewegungenJeKampfMedian, null);
    for (const r of zeile.jeRolle) assert.equal(r.anteilGelaufen, 0);
  });
});

describe('Median und Perzentil', () => {
  it('nimmt bei gerader Anzahl die Mitte der beiden mittleren Werte', () => {
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([]), null);
  });

  it('liefert die Raender als kleinsten und groessten Wert', () => {
    const werte = [5, 1, 4, 2, 3];
    assert.equal(perzentil(werte, 0), 1);
    assert.equal(perzentil(werte, 1), 5);
    assert.equal(perzentil([], 0.5), null);
  });
});
