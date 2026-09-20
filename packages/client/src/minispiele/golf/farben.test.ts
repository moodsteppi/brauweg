import { describe, expect, it } from 'vitest';

import { FARBEN, farbtafel, naechsteFarbe, zieheFarben } from './farben';

/*
 * Die Farbverteilung von Golf.
 *
 * Sie ist die einzige Regel, die der Client selbst rechnet: Der Server
 * verwahrt nur den Wunsch je Sitz und prüft ihn nicht gegen die anderen
 * (siehe setSeatColor). Doppelfrei wird es erst in `farbtafel` — und weil
 * jedes Gerät dieselbe Funktion auf dieselben Wünsche wirft, sieht jeder am
 * Tisch dieselben Bälle. Genau das wird hier geprüft.
 */

describe('farbtafel', () => {
  it('gibt ohne Wünsche jedem Sitz seine eigene Farbe', () => {
    expect(farbtafel([null, null, null, null])).toEqual([0, 1, 2, 3]);
  });

  it('erfüllt Wünsche und lässt die Wunschlosen ausweichen', () => {
    // Sitz 1 will die 0 — Sitz 0 ist wunschlos und muss weichen.
    expect(farbtafel([null, 0, null])).toEqual([1, 0, 2]);
  });

  it('gibt bei zwei gleichen Wünschen dem früheren Sitz den Zuschlag', () => {
    const tafel = farbtafel([5, 5, null]);
    expect(tafel[0]).toBe(5);
    expect(tafel[1]).not.toBe(5);
    expect(new Set(tafel).size).toBe(3);
  });

  it('bleibt bei acht Sitzen mit lauter Wünschen doppelfrei', () => {
    const tafel = farbtafel([3, 3, 3, 3, 3, 3, 3, 3]);
    expect(new Set(tafel).size).toBe(8);
    expect(tafel[0]).toBe(3);
  });

  it('nimmt einen Wunsch außerhalb der Tabelle auf den Rest', () => {
    // 17 gibt es nicht; ein `undefined` im fillStyle malte still schwarz.
    expect(farbtafel([FARBEN.length + 1])[0]).toBe(1);
  });

  it('kommt mit undefined und krummen Zahlen zurecht', () => {
    const tafel = farbtafel([undefined, Number.NaN, 4.7]);
    expect(new Set(tafel).size).toBe(3);
    expect(tafel[2]).toBe(4);
  });
});

describe('naechsteFarbe', () => {
  it('springt auf die nächste Nummer, wenn sie frei ist', () => {
    expect(naechsteFarbe([0, 1, 2], 1)).toBe(3);
  });

  it('überspringt, was ein anderer Sitz trägt', () => {
    // Sitz 0 hat 0, Sitz 1 hat 1, Sitz 2 hat 3: von 1 aus ist 2 frei.
    expect(naechsteFarbe([0, 1, 3], 1)).toBe(2);
  });

  it('läuft am Ende der Tabelle um', () => {
    expect(naechsteFarbe([FARBEN.length - 1, 1], 0)).toBe(0);
  });
});

describe('zieheFarben', () => {
  it('zieht ohne Zurücklegen — im Menü stehen nie zwei gleiche Bälle', () => {
    for (let lauf = 0; lauf < 50; lauf += 1) {
      const acht = zieheFarben(8);
      expect(acht).toHaveLength(8);
      expect(new Set(acht).size).toBe(8);
      for (const farbe of acht) expect(FARBEN).toContain(farbe);
    }
  });

  it('gibt höchstens so viele, wie es Farben gibt', () => {
    expect(zieheFarben(99)).toHaveLength(FARBEN.length);
    expect(zieheFarben(-3)).toEqual([]);
  });

  it('ist mit festem Würfel vorhersagbar', () => {
    // Immer die 0 als Zufall heißt: kein Tausch, die Tabelle von vorn.
    expect(zieheFarben(3, () => 0)).toEqual([FARBEN[0], FARBEN[1], FARBEN[2]]);
  });
});
