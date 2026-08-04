/**
 * Stufen und Erfahrungspunkte.
 *
 * Geprueft wird vor allem, dass Formel und Umkehrung zusammenpassen: Die
 * Stufe wird aus dem Punktestand geschlossen berechnet, nicht hochgezaehlt,
 * und ein Rechenfehler darin faellt sonst erst bei einem Konto mit vielen
 * Punkten auf.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  kostenFuerStufe,
  punkteFuerStufe,
  stufeFuerPunkte,
  stufenstand,
  xpFuerPartie,
} from '../src/level.js';

test('die ersten Stufen kosten, was der Plan sagt', () => {
  assert.equal(kostenFuerStufe(1), 40);
  assert.equal(kostenFuerStufe(2), 60);
  assert.equal(kostenFuerStufe(3), 80);
  assert.equal(kostenFuerStufe(49), 1000);
});

test('Stufe 1 beginnt bei null, Stufe 50 bei rund 25.500', () => {
  assert.equal(punkteFuerStufe(1), 0);
  assert.equal(punkteFuerStufe(2), 40);
  assert.equal(punkteFuerStufe(3), 100);
  assert.equal(punkteFuerStufe(50), 25_480);
});

test('Formel und Umkehrung passen ueber tausend Stufen zusammen', () => {
  for (let stufe = 1; stufe <= 1000; stufe++) {
    const grenze = punkteFuerStufe(stufe);
    assert.equal(stufeFuerPunkte(grenze), stufe, `Grenze von Stufe ${stufe}`);
    if (stufe > 1) {
      assert.equal(
        stufeFuerPunkte(grenze - 1),
        stufe - 1,
        `ein Punkt vor Stufe ${stufe} muss noch die vorige sein`,
      );
    }
    assert.equal(
      punkteFuerStufe(stufe) + kostenFuerStufe(stufe),
      punkteFuerStufe(stufe + 1),
      `Kosten von Stufe ${stufe} muessen die Luecke genau fuellen`,
    );
  }
});

test('unter null und krumme Werte werfen nichts um', () => {
  assert.equal(stufeFuerPunkte(-5), 1);
  assert.equal(stufenstand(-5).stufe, 1);
  assert.equal(stufenstand(39.9).stufe, 1);
  assert.equal(stufenstand(40).stufe, 2);
});

test('der Stand fuer die Anzeige rechnet sich selbst aus', () => {
  const stand = stufenstand(70);
  assert.equal(stand.stufe, 2);
  assert.equal(stand.imLevel, 30, '70 minus die 40 fuer Stufe 2');
  assert.equal(stand.fuerLevel, 60, 'Stufe 2 kostet 60');
});

test('Punkte je Partie: eine je Karte, doppelt bei positiven Trophaeen', () => {
  assert.equal(xpFuerPartie(48, 9), 96, 'Sieger');
  assert.equal(xpFuerPartie(48, 3), 96, 'zweiter Platz, noch positiv');
  assert.equal(xpFuerPartie(48, -3), 48, 'dritter Platz');
  assert.equal(xpFuerPartie(48, 0), 48, 'Gleichstand in der Mitte');
  // Wer verlaesst, bekommt die gelegten Karten - aber nie den Verdoppler,
  // denn seine Buchung ist die Verlassen-Strafe.
  assert.equal(xpFuerPartie(12, -10), 12);
  assert.equal(xpFuerPartie(0, 9), 0);
});
