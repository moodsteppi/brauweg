import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filler } from '../src/adapter.js';
import {
  DEFAULT_REGELN,
  type FillerPartie,
  STERN_BONUS,
  autoEndeVerteilung,
  erstellePartie,
  fuehreAus,
  kante,
} from '../src/index.js';
import { botZug } from '../src/bot.js';
import { fuehreAusOhneAutoEnde } from '../src/partie.js';
import type { FillerVariante } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

/*
 * Automatisches Ende (Wunsch Niklas, 21.11.2026): Sobald kein freies Feld
 * mehr von zwei Sitzen erreichbar ist, endet die Partie, und jedes freie
 * Feld geht an den einen Sitz, der es noch erreicht.
 *
 * Die Lagen sind von Hand gelegt, auf einem 6 x 4-Brett (Platz = y * 6 + x):
 *
 *     y0:   .  .  .  | .  1  1
 *     y1:   .  .  .  | .  1  1
 *     y2:   .  .  .  | .  1  1
 *                       ─
 *     y3:   0  0  0  G  1  1
 *
 * Sitz 0 haelt die untere Zeile links, Sitz 1 die rechten zwei Spalten. Eine
 * Mauerlinie trennt Spalte 2 von Spalte 3 (Zeilen 0–2) und Platz 15 von G
 * (= 21). Links liegt das Revier von Sitz 0 — eingemauert wie auf Niklas'
 * Bild IMG_1966 (das Bild selbst lag dem Auftrag nicht bei; die Lage hier
 * bildet "ein Gebiet hinter einer Mauerlinie, ein letzter Durchgang" nach).
 * G ist das letzte Feld, das beide noch erreichen: Sitz 0 ueber 20, Sitz 1
 * ueber 22. Faerbt Sitz 0 die Farbe von G, ist nichts mehr umkaempft.
 */

const SAAT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const G = 21;

const FARBE_G = 2;

type Lage = {
  barrieren: readonly string[];
  sterne: readonly number[];
};

const MAUERN_IMG1966 = [kante(2, 3), kante(8, 9), kante(14, 15), kante(15, G)];

function lage({ barrieren, sterne }: Lage): FillerPartie {
  const grund = erstellePartie(
    { ...DEFAULT_REGELN, variante: 'build', spalten: 6, zeilen: 4 },
    [0, 1],
    SAAT,
  );
  const besitzer: (number | null)[] = new Array(24).fill(null);
  for (const p of [18, 19, 20]) besitzer[p] = 0;
  for (const p of [4, 5, 10, 11, 16, 17, 22, 23]) besitzer[p] = 1;
  /*
   * Farben so, dass der Zug auf FARBE_G genau G schluckt und sonst nichts:
   * Gebiet 0 traegt 0, Gebiet 1 traegt 1, im Revier links wechseln 3 und 4,
   * Spalte 3 traegt 5.
   */
  const feld = besitzer.map((b, p) => {
    if (b !== null) return b;
    if (p === G) return FARBE_G;
    if (p % 6 === 3) return 5;
    return (p + Math.floor(p / 6)) % 2 === 0 ? 3 : 4;
  });
  return {
    ...grund,
    feld,
    besitzer,
    farbe: { 0: 0, 1: 1 },
    punkte: { 0: 3, 1: 8 },
    dran: 0,
    zug: 10,
    barrieren,
    sterne,
  };
}

describe('Auto-Ende: Gebiet eingemauert (IMG_1966)', () => {
  const vorher = lage({ barrieren: MAUERN_IMG1966, sterne: [0, 9] });
  const nachher = fuehreAus(vorher, 0, { typ: 'faerben', farbe: FARBE_G });

  it('laeuft vor dem letzten Zug noch — G ist umkaempft', () => {
    assert.equal(autoEndeVerteilung(vorher), null);
    assert.equal(vorher.fertig, false);
  });

  it('beendet die Partie, sobald G geschluckt ist', () => {
    assert.equal(nachher.fertig, true);
    assert.equal(nachher.besitzer[G], 0);
    assert.ok(nachher.autoEnde);
  });

  it('gibt jedes Feld dem einzigen Sitz, der es erreicht', () => {
    for (const p of [0, 1, 2, 6, 7, 8, 12, 13, 14]) assert.equal(nachher.besitzer[p], 0, `Platz ${p}`);
    for (const p of [3, 9, 15]) assert.equal(nachher.besitzer[p], 1, `Platz ${p}`);
    assert.equal(nachher.besitzer.filter((b) => b === null).length, 0);
    // Verteiltes Gebiet traegt die Gebietsfarbe, wie nach einem Schluckzug.
    for (const { platz, sitz } of nachher.autoEnde!) assert.equal(nachher.feld[platz], nachher.farbe[sitz]);
  });

  it('zaehlt die Punkte wie beim Schlucken, Sterne mit Bonus', () => {
    // Sitz 0: 3 + G + neun im Revier + Stern auf 0.
    assert.equal(nachher.punkte[0], 3 + 1 + 9 + STERN_BONUS);
    // Sitz 1: 8 + drei in Spalte 3 + Stern auf 9.
    assert.equal(nachher.punkte[1], 8 + 3 + STERN_BONUS);
  });

  it('legt die Liste ringweise an: erst Abstand 1, dann 2, dann 3', () => {
    const liste = nachher.autoEnde!;
    assert.equal(liste.length, 12);
    const plaetze = liste.map((e) => e.platz);
    assert.deepEqual(new Set(plaetze.slice(0, 6)), new Set([3, 9, 15, 12, 13, 14]));
    assert.deepEqual(new Set(plaetze.slice(6, 9)), new Set([6, 7, 8]));
    assert.deepEqual(new Set(plaetze.slice(9)), new Set([0, 1, 2]));
    // G gehoert nicht in die Liste: Das hat der Zug selbst geschluckt.
    assert.ok(!plaetze.includes(G));
  });

  it('nennt je Feld die Farbe davor und was es gebracht hat (fuer das Abspielen)', () => {
    // Der Bildschirm zeigt erst das Brett davor und laesst dann den Zaehler
    // mitlaufen — beides aus der Liste, ohne Regel im Client.
    const liste = nachher.autoEnde!;
    for (const { platz, vorher: farbe } of liste) assert.equal(farbe, vorher.feld[platz], `Platz ${platz}`);
    for (const { platz, punkte } of liste) {
      assert.equal(punkte, vorher.sterne.includes(platz) ? 1 + STERN_BONUS : 1, `Platz ${platz}`);
    }
    // Die Summe ist genau der Zuwachs durch das Auto-Ende.
    for (const sitz of [0, 1]) {
      const summe = liste.filter((e) => e.sitz === sitz).reduce((s, e) => s + e.punkte, 0);
      const durchZug = sitz === 0 ? 1 : 0; // G hat der Zug selbst geschluckt
      assert.equal(nachher.punkte[sitz], vorher.punkte[sitz]! + durchZug + summe);
    }
  });

  it('zeigt die Liste erst in der Sicht, wenn die Partie zu Ende ist', () => {
    assert.equal('autoEnde' in sichtFuer(vorher, 0), false);
    assert.equal('autoEnde' in sichtFuer(vorher, 1), false);
    assert.equal('autoEnde' in zuschauerSicht(vorher), false);
    assert.deepEqual(sichtFuer(nachher, 1).autoEnde, nachher.autoEnde);
    assert.deepEqual(zuschauerSicht(nachher).autoEnde, nachher.autoEnde);
  });

  it('ueberlebt Speichern und Laden', () => {
    const zurueck = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(nachher))));
    assert.deepEqual(zurueck.autoEnde, nachher.autoEnde);
  });
});

describe('Auto-Ende: noch umkaempft', () => {
  it('endet nicht, solange ein Feld von beiden erreichbar ist', () => {
    // Ohne die Mauer zwischen 15 und G grenzt 15 nach dem Zug an G (Sitz 0)
    // und an 16 (Sitz 1) — Spalte 3 bleibt umkaempft.
    const vorher = lage({ barrieren: MAUERN_IMG1966.filter((k) => k !== kante(15, G)), sterne: [] });
    const nachher = fuehreAus(vorher, 0, { typ: 'faerben', farbe: FARBE_G });
    assert.equal(nachher.besitzer[G], 0);
    assert.equal(nachher.fertig, false);
    assert.equal(nachher.autoEnde, undefined);
    assert.equal(nachher.punkte[0], 4);
    assert.equal('autoEnde' in sichtFuer(nachher, 0), false);
  });
});

describe('Auto-Ende: unerreichbares Feld', () => {
  it('laesst ein Feld, das niemand erreicht, als Loch stehen', () => {
    // Platz 3 rundum zu: links 2|3 (steht schon), rechts zu Sitz 1, unten zu 9.
    const vorher = lage({
      barrieren: [...MAUERN_IMG1966, kante(3, 4), kante(3, 9)],
      sterne: [3],
    });
    const nachher = fuehreAus(vorher, 0, { typ: 'faerben', farbe: FARBE_G });
    assert.equal(nachher.fertig, true);
    assert.equal(nachher.besitzer[3], null);
    assert.ok(!nachher.autoEnde!.some((e) => e.platz === 3));
    // Sitz 1 bekommt nur 9 und 15, und den Stern auf dem Loch nicht.
    assert.equal(nachher.punkte[1], 8 + 2);
    assert.equal(nachher.punkte[0], 3 + 1 + 9);
  });

  it('greift nicht, wenn gar kein freies Feld mehr erreichbar ist', () => {
    // Dann gibt es nichts zu verteilen; das Ende kommt wie bisher ueber
    // LEERZUEGE_MAX (der Auftrag laesst die alten Enden unberuehrt).
    const partie = lage({ barrieren: [], sterne: [] });
    const besitzer = partie.besitzer.map((b, p) => (p === 3 ? null : (b ?? 0)));
    const lochPartie = { ...partie, besitzer, barrieren: [kante(2, 3), kante(3, 4), kante(3, 9)] };
    assert.equal(autoEndeVerteilung(lochPartie), null);
  });
});

describe('Auto-Ende: mehr als zwei Sitze', () => {
  /*
   * 3 x 3, vier Sitze. Die Mitte (4) grenzt an Sitz 2 (1 und 3), an Sitz 1
   * (5) und an Sitz 0 (7). Mauern zu 5 und 7 lassen nur Sitz 2 uebrig.
   */
  const grund = erstellePartie(
    { ...DEFAULT_REGELN, variante: 'build', spalten: 3, zeilen: 3 },
    [0, 1, 2, 3],
    SAAT,
  );
  const besitzer = [2, 2, 1, 2, null, 1, 0, 0, 3];

  it('gibt die Mitte dem einen Sitz, der sie noch erreicht', () => {
    const partie = { ...grund, besitzer, barrieren: [kante(4, 5), kante(4, 7)], sterne: [] };
    assert.deepEqual(autoEndeVerteilung(partie), [
      { platz: 4, sitz: 2, vorher: grund.feld[4], punkte: 1 },
    ]);
  });

  it('wartet, solange zwei der vier sie erreichen', () => {
    const partie = { ...grund, besitzer, barrieren: [kante(4, 5)] };
    assert.equal(autoEndeVerteilung(partie), null);
  });
});

describe('Auto-Ende nimmt das Ergebnis nur vorweg', () => {
  /*
   * Die Fingerabdruck-Tests (extreme-gross, eroeffnung-aufgeben, ausgleich)
   * laufen seit dem Auto-Ende ueber `fuehreAusOhneAutoEnde` und beweisen so,
   * dass sonst nichts verschoben ist. Was sie damit NICHT mehr sehen, steht
   * hier: Mit Auto-Ende spielt der Bot bis zum Ende Zug fuer Zug dieselbe
   * Partie, und am Ende stehen dieselben Punkte und derselbe Sieger — es
   * wird nur nicht mehr ausgespielt. Gemessen am 23.11.2026 auf 160
   * Bot-Partien (40 je Spielart): ueberall gleich.
   */
  const FAELLE: [FillerVariante, string | number][] = [
    ['nebel', 1],
    ['nebel', 42],
    ['klar', 'c0ffee1234567890abcdef0123456789'],
    ['build', 2],
    ['build', 42],
    ['extreme', 1],
  ];
  const lauf = (variante: FillerVariante, saat: string | number, zug: typeof fuehreAus) => {
    let p = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], saat);
    const zuege: string[] = [];
    for (let n = 0; !p.fertig && n < 600; n++) {
      const z = botZug(sichtFuer(p, p.dran));
      zuege.push(JSON.stringify(z));
      p = zug(p, p.dran, z);
    }
    return { p, zuege };
  };
  let gegriffen = 0;
  for (const [variante, saat] of FAELLE) {
    it(`${variante}/${saat}: gleiche Zuege bis zum Ende, gleiche Punkte`, () => {
      const mit = lauf(variante, saat, fuehreAus);
      const ohne = lauf(variante, saat, fuehreAusOhneAutoEnde);
      assert.ok(mit.p.fertig);
      assert.deepEqual(mit.zuege, ohne.zuege.slice(0, mit.zuege.length));
      assert.deepEqual(mit.p.punkte, ohne.p.punkte);
      if (mit.p.autoEnde) gegriffen++;
    });
  }
  it('greift dabei ueberhaupt', () => {
    // Sonst prueften die Faelle oben nur, dass nichts passiert.
    assert.ok(gegriffen >= 3, `nur ${gegriffen} Mal gegriffen`);
  });
});

describe('Auto-Ende: Altlast', () => {
  it('laedt eine gespeicherte Partie ohne das Feld und laesst es weg', () => {
    const partie = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    const roh = JSON.parse(JSON.stringify(filler.serialize(partie)));
    assert.equal('autoEnde' in roh, false);
    const zurueck = filler.deserialize({ ...roh, v: 5 });
    assert.equal(zurueck.autoEnde, undefined);
    assert.equal('autoEnde' in sichtFuer(zurueck, 0), false);
  });
});
