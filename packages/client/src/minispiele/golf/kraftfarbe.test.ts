import { describe, expect, it } from 'vitest';

import { mische } from './farben';
import { kraftfarbe } from './zeichnen';

/*
 * Die Farbe des Kraftpfeils.
 *
 * Seit dem 08.09.2026 ist sie ein Verlauf statt vier Stufen. Geprüft wird
 * beides, was daran schiefgehen kann: dass die vier Farben von früher an
 * ihren alten Grenzen noch genau so herauskommen (sonst ist es ein anderer
 * Pfeil), und dass dazwischen wirklich jedes Prozent seinen eigenen Ton hat
 * (sonst ist es wieder eine Stufe, nur an anderer Stelle).
 */

describe('kraftfarbe', () => {
  it('gibt an den alten Stufengrenzen genau die alten Farben', () => {
    expect(kraftfarbe(0)).toBe('#3ddc84');
    expect(kraftfarbe(0.34)).toBe('#ffd23f');
    expect(kraftfarbe(0.67)).toBe('#ff9124');
    expect(kraftfarbe(0.9)).toBe('#ff4d4d');
  });

  it('bleibt im letzten Zehntel reines Rot', () => {
    expect(kraftfarbe(0.95)).toBe('#ff4d4d');
    expect(kraftfarbe(1)).toBe('#ff4d4d');
    // Über 100 % kommt der Pfeil nicht, aber ein Wert darüber darf nichts
    // Anderes malen als die letzte Stützstelle.
    expect(kraftfarbe(1.5)).toBe('#ff4d4d');
  });

  it('mischt zwischen den Stützstellen statt zu springen', () => {
    // Genau in der Mitte zwischen Grün und Gelb.
    expect(kraftfarbe(0.17)).toBe(mische('#3ddc84', '#ffd23f', 0.5));
    expect(kraftfarbe(0.505)).toBe(mische('#ffd23f', '#ff9124', 0.5));
    expect(kraftfarbe(0.785)).toBe(mische('#ff9124', '#ff4d4d', 0.5));
  });

  it('ändert sich mit jedem Prozentschritt — das war der ganze Anlass', () => {
    // Bis 90 % gibt jeder Prozentschritt einen anderen Ton; danach steht
    // Rot bewusst still.
    for (let p = 0; p < 90; p += 1) {
      expect(kraftfarbe(p / 100)).not.toBe(kraftfarbe((p + 1) / 100));
    }
    expect(kraftfarbe(0.9)).toBe(kraftfarbe(0.99));
  });

  it('läuft ohne Sprung durch die Stützstellen', () => {
    // Kein Schritt von einem Prozent zum nächsten darf mehr als einen
    // kleinen Kanalabstand haben: Genau daran erkennt man eine Stufe.
    const kanal = (farbe: string, i: number) => Number.parseInt(farbe.slice(1 + i * 2, 3 + i * 2), 16);
    for (let p = 0; p < 100; p += 1) {
      const a = kraftfarbe(p / 100);
      const b = kraftfarbe((p + 1) / 100);
      for (let i = 0; i < 3; i += 1) {
        expect(Math.abs(kanal(a, i) - kanal(b, i))).toBeLessThanOrEqual(12);
      }
    }
  });

  it('malt bei einem unbrauchbaren Wert die schwächste Farbe statt undefined', () => {
    expect(kraftfarbe(Number.NaN)).toBe('#3ddc84');
    expect(kraftfarbe(-1)).toBe('#3ddc84');
  });
});

describe('mische', () => {
  it('gibt an den Enden genau die Ausgangsfarben zurück', () => {
    expect(mische('#3ddc84', '#ff4d4d', 0)).toBe('#3ddc84');
    expect(mische('#3ddc84', '#ff4d4d', 1)).toBe('#ff4d4d');
  });

  it('führt einzelne Kanäle mit und füllt die Null auf', () => {
    // 0x00 und 0x10 gemischt ergibt 0x08 — zweistellig, sonst wäre '#8…'
    // eine um ein Zeichen verrutschte Farbe.
    expect(mische('#000000', '#101010', 0.5)).toBe('#080808');
  });

  it('deckelt einen Anteil außerhalb von 0 bis 1', () => {
    expect(mische('#000000', '#ffffff', 2)).toBe('#ffffff');
    expect(mische('#000000', '#ffffff', -1)).toBe('#000000');
  });
});
