/**
 * Proben zur Tauschprobe (test/tauschprobe.ts) und zur Normierung gegen
 * Bretter gleicher Kostensumme (test/messen.ts).
 *
 * DREI VERSCHIEDENE DINGE STEHEN HIER:
 *
 *   1. Das Auszaehlen. Der ganze Wert der Probe haengt daran, dass jede Zeile
 *      einer Kostenstufe denselben Nenner hat — faellt das auseinander, sieht
 *      die Tabelle aus wie vorher und misst wieder die Auswahl des Bots.
 *   2. Die Baender der Normierung: gleich grosse Stuecke, keine Luecke, keine
 *      Ueberschneidung. Ein Fehler darin faellt sonst nirgends auf, weil
 *      niemand eine Zahl gegenpruefen kann, die er zum ersten Mal sieht.
 *   3. DER BEFUND SELBST: Die Tauschprobe muss auf eine Schwaechung nach
 *      UNTEN antworten. Genau das ist die Eigenschaft, um derentwillen sie
 *      gebaut wurde — die rohe Siegquote antwortet nach oben (Lichtwahrerin,
 *      neunte Messung). Nachgestellt wird das hier nicht mit einem
 *      veraenderten Katalog, sondern ueber den Heilfaktor: `--heilung 0` ist
 *      der Stand vor der Beistand-Wirkung, und eine Lichtwahrerin ohne
 *      Heilung MUSS schlechter dastehen als eine mit.
 *
 * Der Lauf ist klein gehalten: Die grosse Zahl steht in
 * werkzeug/tauschprobe.mjs und wird von Hand gestartet. Eine Probe, die eine
 * Minute laeuft, laesst niemand mehr laufen.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { STANDARD_REGLER, einheitenMitKosten } from '../src/index.js';
import { BRETTWERT_BAENDER, VIER_SITZE, brettwert, messe, werteAus } from './messen.js';
import { tauschprobe, zeileVon } from './tauschprobe.js';

/**
 * Klein, aber nicht zu klein: 60 Partien zu viert geben rund 240
 * Schlussbretter, davon tragen etwa 40 eine Drei-Gold-Einheit. Darunter wird
 * der Nenner der Drei-Gold-Stufe so duenn, dass die Probe unter Punkt 3
 * anfinge zu flackern.
 */
const KLEIN = {
  partien: 60,
  sitze: VIER_SITZE,
  kontexte: 40,
  saatBasis: 'tausch-probe',
} as const;

describe('Tauschprobe: das Auszaehlen', () => {
  const BEFUND = tauschprobe(KLEIN);

  it('gibt jeder Einheit einer Kostenstufe denselben Nenner', () => {
    assert.equal(BEFUND.stufen.length, 3);
    for (const stufe of BEFUND.stufen) {
      assert.equal(stufe.zeilen.length, einheitenMitKosten(stufe.kosten).length);
      assert.ok(stufe.kontexte > 0, `${stufe.kosten} Gold ohne Kontext`);
      // Je Kontext zwei Kaempfe (beide Seiten) mal Saaten. DAS ist der Punkt
      // gegenueber messen.ts, wo die Zahl der Antritte am Einkauf haengt.
      for (const zeile of stufe.zeilen) {
        assert.equal(zeile.kaempfe, stufe.kontexte * 2, zeile.name);
      }
      assert.equal(
        stufe.kaempfe,
        stufe.zeilen.reduce((s, z) => s + z.kaempfe, 0),
      );
    }
  });

  it('nennt den Index als Quote zum Schnitt der eigenen Kostenstufe', () => {
    for (const stufe of BEFUND.stufen) {
      const schnitt =
        stufe.zeilen.reduce((s, z) => s + (z.quote ?? 0), 0) / stufe.zeilen.length;
      assert.ok(Math.abs(schnitt - stufe.schnitt) < 1e-9);
      for (const zeile of stufe.zeilen) {
        assert.ok(zeile.quote !== null && zeile.index !== null, zeile.name);
        assert.ok(Math.abs(zeile.index! - zeile.quote! / stufe.schnitt) < 1e-9, zeile.name);
      }
      // Die Summe der Indizes einer Stufe ergibt ihre Zeilenzahl — dieselbe
      // Rechnung wie beim Faktor zum Schnitt in ausgewogenheit.mjs.
      const summe = stufe.zeilen.reduce((s, z) => s + (z.index ?? 0), 0);
      assert.ok(Math.abs(summe - stufe.zeilen.length) < 1e-6);
    }
  });

  it('liefert bei gleichen Schaltern dieselbe Tabelle', () => {
    const noch = tauschprobe(KLEIN);
    assert.deepEqual(noch, BEFUND);
  });
});

describe('Tauschprobe: der Befund', () => {
  /*
   * Dieselben Bretter, einmal mit und einmal ohne Beistand-Wirkung. Die
   * Lichtwahrerin heilt mit Faktor 1,5 ihren Angriff; ohne Heilung ist sie
   * eine schwache Wache mit Reichweite 2 und MUSS auf demselben Platz
   * schlechter abschneiden.
   */
  const MIT = tauschprobe(KLEIN);
  const OHNE = tauschprobe({ ...KLEIN, regler: { ...STANDARD_REGLER, heilungFaktor: 0 } });

  it('antwortet auf eine Schwaechung nach unten', () => {
    const mit = zeileVon(MIT, 'lichtwahrerin');
    const ohne = zeileVon(OHNE, 'lichtwahrerin');
    assert.ok(mit && ohne);
    assert.ok(
      ohne!.quote! < mit!.quote!,
      `ohne Heilung ${ohne!.quote} statt unter ${mit!.quote}`,
    );
    assert.ok(ohne!.saldo < mit!.saldo, `Saldo ${ohne!.saldo} statt unter ${mit!.saldo}`);
  });
});

describe('Normierung gegen Bretter gleicher Kostensumme', () => {
  const AUSWERTUNG = werteAus(
    messe({ partien: 60, sitze: VIER_SITZE, besetzung: 'normal', saatBasis: 'tausch-probe' }),
  );

  it('schneidet luecken- und ueberschneidungsfreie Baender', () => {
    const baender = AUSWERTUNG.brettwertBaender;
    assert.ok(baender.length > 1 && baender.length <= BRETTWERT_BAENDER);
    for (const [i, band] of baender.entries()) {
      assert.ok(band.von <= band.bis, `Band ${i} laeuft rueckwaerts`);
      if (i > 0) assert.equal(band.von, baender[i - 1]!.bis + 1);
    }
    /*
     * Jedes Schlussbrett steckt in genau einem Band. Nachgewiesen ueber die
     * Siege: Eine Partie mit eindeutigem Sieger hat genau ein siegreiches
     * Schlussbrett, die Summe ueber alle Baender muss also `mitSieger` sein.
     * Faellt ein Brett durch die Baender, faellt hier eine Zahl.
     */
    assert.equal(
      baender.reduce((s, b) => s + b.siege, 0),
      AUSWERTUNG.mitSieger,
    );
    assert.ok(baender.every((b) => b.antritte > 0));
  });

  it('rechnet den Index als Siege je erwartetem Sieg', () => {
    for (const zeile of AUSWERTUNG.einheitenNormiert) {
      if (zeile.erwartet === 0) {
        assert.equal(zeile.index, null);
        continue;
      }
      assert.ok(Math.abs(zeile.index! - zeile.siege / zeile.erwartet) < 1e-9, zeile.name);
      // Erwartet werden kann hoechstens ein Sieg je Antritt.
      assert.ok(zeile.erwartet <= zeile.antritte, zeile.name);
    }
  });

  it('zaehlt dieselben Antritte wie die rohe Tabelle', () => {
    for (const roh of AUSWERTUNG.einheiten) {
      const normiert = AUSWERTUNG.einheitenNormiert.find((z) => z.name === roh.name);
      assert.ok(normiert, roh.name);
      assert.equal(normiert!.antritte, roh.antritte, roh.name);
      assert.equal(normiert!.siege, roh.siege, roh.name);
    }
  });

  it('rechnet den Brettwert mit Sternstufen', () => {
    // Drei Dorfwachen ergeben eine auf Stufe 2 — und die hat drei Gold
    // gekostet, nicht eines.
    assert.equal(brettwert([{ id: 'dorfwache', stufe: 1 }, null]), 1);
    assert.equal(brettwert([{ id: 'dorfwache', stufe: 2 }, null]), 3);
    assert.equal(brettwert([{ id: 'dorfwache', stufe: 3 }, null]), 9);
    assert.equal(brettwert([null, null]), 0);
  });
});
