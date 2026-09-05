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
  type Brettseite,
  BRETT_FELDER,
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
   * Die Kernaussage der ganzen Messung, hier als Probe festgehalten: Auf dem
   * heutigen Brett steht eine Einheit der hinteren Reihe hoechstens zwei
   * Felder von der naechsten gegnerischen entfernt. Wer die Brettmasse
   * aendert, aendert diese Zahl — und diese Zeile faellt.
   */
  it('rechnet den Startabstand auf dem heutigen Brett zu hoechstens zwei', () => {
    const bericht = simuliereKampf(
      [
        stelleAuf([
          ['astschuetze', 1, 0, 1],
          ['dorfwache', 1, 0, 0],
        ]),
        stelleAuf([
          ['astschuetze', 1, 4, 1],
          ['dorfwache', 1, 4, 0],
        ]),
      ],
      'laufprobe-3',
    );
    for (const zeile of laufbefund(bericht).einheiten) {
      assert.ok(zeile.startAbstand <= 2, `Startabstand ${zeile.startAbstand} ist groesser als 2`);
      // Reichweite 3 beim Schuetzen, 1 bei der Wache — der Schuetze steht
      // damit von Anfang an im Ziel und braucht keinen Schritt.
      if (zeile.rolle === 'schuetze') assert.ok(zeile.sofortInReichweite);
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
    assert.ok(zeile.anteilSofortInReichweite > 0 && zeile.anteilSofortInReichweite <= 1);
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
