// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { BRO_WERTE, SPIELABLAUF } from '@brauweg/flyingbro-kern';

import { aufBild, bodenLinie, kameraFuer } from './kamera';
import { abschuss, vollerZugPx, vorschau, zugAus } from './zielen';

describe('Flying Bro: Zielen', () => {
  it('Zug nach links unten schießt nach rechts oben', () => {
    const zug = zugAus(-100, 100, 200)!;
    expect(zug.richtung.x).toBeGreaterThan(0);
    expect(zug.richtung.y).toBeGreaterThan(0);
    // Der Bro folgt dem Finger: nach links unten.
    expect(zug.versatz.x).toBeLessThan(0);
    expect(zug.versatz.y).toBeLessThan(0);
  });

  it('der Zugweg ist auf den Kernwert gedeckelt', () => {
    expect(zugAus(1000, 0, 200)!.zugweg).toBe(SPIELABLAUF.zugwegMax);
    expect(zugAus(100, 0, 200)!.zugweg).toBeCloseTo(SPIELABLAUF.zugwegMax / 2);
  });

  it('ein zu kurzer Zug schießt nicht, ein voller mit Höchsttempo', () => {
    expect(abschuss('pelle', zugAus(5, 0, 200))).toBeNull();
    expect(abschuss('pelle', zugAus(0, 0, 200))).toBeNull();
    const v = abschuss('pelle', zugAus(-400, 0, 200))!;
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(BRO_WERTE.pelle.hoechsttempo);
  });

  it('der volle Zugweg in Pixeln bleibt auf jedem Bildschirm greifbar', () => {
    expect(vollerZugPx(844, 390)).toBe(130);
    expect(vollerZugPx(320, 200)).toBe(100);
    expect(vollerZugPx(1400, 900)).toBe(220);
  });

  it('die Vorschau steigt und fällt und endet am Boden', () => {
    const punkte = vorschau({ x: 0, y: 1 }, { x: 10, y: 10 }, 5, 1);
    expect(punkte.length).toBeGreaterThan(10);
    const hoechster = Math.max(...punkte.map((p) => p.y));
    expect(hoechster).toBeGreaterThan(1);
    expect(punkte.every((p) => p.y >= 0)).toBe(true);
    // Gedämpft: kürzer als die ungedämpfte Wurfparabel.
    const letzter = punkte[punkte.length - 1]!;
    expect(letzter.x).toBeLessThan(10 * 2.1);
  });
});

describe('Flying Bro: Kamera', () => {
  it('der Boden der Welt liegt auf der Graslinie', () => {
    const k = kameraFuer(844, 390, 0, { links: -3, rechts: 27, oben: 8 });
    expect(aufBild(k, { x: 0, y: 0 }).y).toBeCloseTo(bodenLinie(844, 390));
  });

  it('der ganze Rahmen ist zu sehen', () => {
    for (const [b, h] of [[844, 390], [1400, 900], [667, 375]] as const) {
      const k = kameraFuer(b, h, 0, { links: -3, rechts: 27, oben: 8 });
      const links = aufBild(k, { x: -3, y: 8 });
      const rechts = aufBild(k, { x: 27, y: 0 });
      expect(links.x).toBeGreaterThanOrEqual(-0.5);
      expect(rechts.x).toBeLessThanOrEqual(b + 0.5);
      expect(links.y).toBeGreaterThanOrEqual(44 - 0.5);
    }
  });
});
