import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BLATTGROESSE,
  KATEGORIE,
  besteHand,
  erstelleBlatt,
  karteAusSchluessel,
  kartenSchluessel,
  rang,
  vergleicheHaende,
} from '../src/karten.js';

/** Kurzschreibweise: "HA SK D7" wird zu Karten. */
function h(schluessel: string) {
  return schluessel.split(/\s+/).map(karteAusSchluessel);
}

test('das Blatt hat 52 verschiedene Karten', () => {
  const blatt = erstelleBlatt();
  assert.equal(blatt.length, BLATTGROESSE);
  assert.equal(new Set(blatt.map(kartenSchluessel)).size, BLATTGROESSE);
  assert.equal(new Set(blatt.map((karte) => karte.id)).size, BLATTGROESSE);
});

test('Werte laufen von der Zwei bis zum Ass', () => {
  assert.equal(rang('2'), 2);
  assert.equal(rang('T'), 10);
  assert.equal(rang('J'), 11);
  assert.equal(rang('A'), 14);
});

test('jede Kategorie wird erkannt', () => {
  const faelle: [string, number][] = [
    ['SA SK SQ SJ ST H2 D3', KATEGORIE.strassenFlush],
    ['S9 H9 D9 C9 SK H2 D3', KATEGORIE.vierling],
    ['S9 H9 D9 CK SK H2 D3', KATEGORIE.fullHouse],
    ['S2 S5 S9 SJ SK H3 D4', KATEGORIE.flush],
    ['S5 H6 D7 C8 S9 HK DQ', KATEGORIE.strasse],
    ['S9 H9 D9 CK SQ H2 D3', KATEGORIE.drilling],
    ['S9 H9 DK CK SQ H2 D3', KATEGORIE.zweiPaare],
    ['S9 H9 DK CQ SJ H2 D3', KATEGORIE.paar],
    ['S9 H7 DK CQ SJ H2 D3', KATEGORIE.hoechsteKarte],
  ];
  for (const [karten, kategorie] of faelle) {
    assert.equal(besteHand(h(karten)).kategorie, kategorie, karten);
  }
});

test('die gewertete Kombination besteht aus genau fuenf Karten', () => {
  for (const karten of ['SA SK SQ SJ ST H2 D3', 'S9 H9 D9 CK SQ H2 D3', 'S9 H7 DK CQ SJ H2 D3']) {
    assert.equal(besteHand(h(karten)).karten.length, 5, karten);
  }
});

/**
 * Das Rad: Ass bis Fuenf ist eine Strasse, und die niedrigste. Genau hier
 * liegen selbstgeschriebene Auswertungen fast immer falsch.
 */
test('Ass bis Fuenf ist eine Strasse, und zwar die kleinste', () => {
  const rad = besteHand(h('SA H2 D3 C4 S5 HK DQ'));
  assert.equal(rad.kategorie, KATEGORIE.strasse);
  assert.equal(rad.werte[0], 5, 'die Fuenf fuehrt das Rad an, nicht das Ass');

  const hoeher = besteHand(h('S2 H3 D4 C5 S6 HK DQ'));
  assert.ok(vergleicheHaende(hoeher, rad) > 0, 'Sechs-hoch schlaegt das Rad');
});

test('ein Ass am Ende macht aus einem Rad keine Strasse mit Luecke', () => {
  // Ass, Zwei, Drei, Vier — aber keine Fuenf: das ist keine Strasse.
  assert.equal(besteHand(h('SA H2 D3 C4 S9 HK DQ')).kategorie, KATEGORIE.hoechsteKarte);
});

test('Strassenflush schlaegt Vierling, Vierling schlaegt Full House', () => {
  const strassenFlush = besteHand(h('S5 S6 S7 S8 S9 HA DA'));
  const vierling = besteHand(h('SA HA DA CA SK HQ D2'));
  const fullHouse = besteHand(h('SA HA DA CK SK HQ D2'));
  assert.ok(vergleicheHaende(strassenFlush, vierling) > 0);
  assert.ok(vergleicheHaende(vierling, fullHouse) > 0);
});

test('bei gleicher Kategorie entscheidet die Beikarte', () => {
  // Keine zusammenhaengenden Werte dazwischen, sonst wird aus dem Paar
  // versehentlich eine Strasse — genau daran ist dieser Test einmal gescheitert.
  const mitAss = besteHand(h('S9 H9 SA H7 D5 C3 H2'));
  const mitKoenig = besteHand(h('S9 H9 SK H7 D5 C3 H2'));
  assert.equal(mitAss.kategorie, KATEGORIE.paar);
  assert.ok(vergleicheHaende(mitAss, mitKoenig) > 0);
});

test('zwei gleich starke Blaetter ergeben null', () => {
  // Beide spielen dasselbe Brett: Farben unterscheiden sich, Werte nicht.
  const links = besteHand(h('SA SK SQ SJ ST'));
  const rechts = besteHand(h('HA HK HQ HJ HT'));
  assert.equal(vergleicheHaende(links, rechts), 0);
});

test('aus sieben Karten wird die beste Fuenferkombination gewaehlt', () => {
  // Drilling Neunen liegt drin, aber Full House ist staerker.
  const hand = besteHand(h('S9 H9 D9 CK SK H2 D3'));
  assert.equal(hand.kategorie, KATEGORIE.fullHouse);
  assert.deepEqual(hand.werte, [9, 13]);
});

test('sechs Karten einer Farbe ergeben den hoechsten Flush', () => {
  const flush = besteHand(h('S2 S5 S9 SJ SK S3 H4'));
  assert.equal(flush.kategorie, KATEGORIE.flush);
  assert.deepEqual(flush.werte, [13, 11, 9, 5, 3]);
});

test('weniger als fuenf Karten sind keine Hand', () => {
  assert.throws(() => besteHand(h('SA SK')), /fuenf/);
});

test('ein unbekannter Kartenschluessel fliegt auf', () => {
  assert.throws(() => karteAusSchluessel('X9'), /Kartenschluessel/);
  assert.throws(() => karteAusSchluessel('S1'), /Kartenschluessel/);
});
