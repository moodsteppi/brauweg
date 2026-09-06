import { describe, expect, it } from 'vitest';

import {
  type Gestenkarte,
  SELBER_FLECK,
  haengtZusammen,
  laufe,
  selberFleck,
  treffer,
  waehlbarMit,
  zelleVon,
} from './gesten';

/*
 * Die Karte fuer alle Proben: 5 x 5, Sitz 0 haelt die Ecke unten links (20),
 * rechts daneben liegt ein See (22). Anzeigeindex und Platz sind hier gleich
 * (`platzVon` ist die Identitaet) — die Drehung fuer Sitz 1 ist eine Zeile
 * in der Karte und kein Fall fuer diese Rechnung.
 *
 *   0  1  2  3  4
 *   5  6  7  8  9
 *  10 11 12 13 14
 *  15 16 17 18 19
 *  20 21 ~~ 23 24     20 = eigen, 22 = Wasser
 */
const GRAS = 0;
const WASSER = 1;
const spalten = 5;
const zeilen = 5;
const gelaende = Array.from({ length: 25 }, (_, i) => (i === 22 ? WASSER : GRAS));
const besitzer = Array.from({ length: 25 }, (_, i) => (i === 20 ? 0 : null));
const karte: Gestenkarte = { spalten, zeilen, gelaende, besitzer, waehlbar: [15, 21] };
const gleich = (zelle: number): number => zelle;
const mitte = (zelle: number) => ({ u: (zelle % spalten) + 0.5, v: Math.floor(zelle / spalten) + 0.5 });

describe('waehlbarMit', () => {
  it('nimmt den Rand des Gebiets und den Rand der Auswahl, nie die Auswahl selbst', () => {
    expect([...waehlbarMit(karte, [])].sort()).toEqual([15, 21]);
    // 21 auf dem Zettel: 16 und 22 grenzen daran — 22 ist Wasser und faellt weg.
    expect([...waehlbarMit(karte, [21])].sort()).toEqual([15, 16]);
  });
});

describe('haengtZusammen', () => {
  it('laesst fallen, was nur ueber das abgewaehlte Feld erreichbar war', () => {
    // 21 -> 16 -> 17 ist ein Vorstoss; ohne 16 haengt 17 in der Luft.
    expect(haengtZusammen(karte, 0, [21, 17])).toEqual([21]);
    expect(haengtZusammen(karte, 0, [21, 16, 17])).toEqual([21, 16, 17]);
  });
});

describe('treffer — die gewichteten Trefferflaechen', () => {
  it('trifft in der Mitte eines gewaehlten Feldes das Feld selbst', () => {
    expect(treffer(karte, [21], 6, gleich, mitte(21), 21)).toBe(21);
  });

  it('meint am Rand eines gewaehlten Feldes den waehlbaren Nachbarn', () => {
    // Finger bei 88 % der Breite von 21, Richtung 16 liegt oben: rechts ist
    // Wasser (tot), oben 16 ist waehlbar. Oben-Rand von 21 -> 16.
    expect(treffer(karte, [21], 6, gleich, { u: 1.5, v: 4.12 }, 21)).toBe(16);
    // Rechts-Rand von 21 -> bleibt 21: 22 ist Wasser und zieht nicht.
    expect(treffer(karte, [21], 6, gleich, { u: 1.88, v: 4.5 }, 21)).toBe(21);
  });

  it('haelt die inneren zwei Drittel eines gewaehlten Feldes frei', () => {
    // Bei 1 gegen 0,5 liegt die Grenze ein Drittel Feldbreite von der Mitte
    // entfernt: Der Nachbar reicht also ein Sechstel weit hinein.
    expect(treffer(karte, [21], 6, gleich, { u: 1.5, v: 4.2 }, 21)).toBe(21);
    expect(treffer(karte, [21], 6, gleich, { u: 1.5, v: 4.14 }, 21)).toBe(16);
  });

  it('laesst ein waehlbares Feld in ein totes hineinreichen', () => {
    // Tipp knapp im Wasser (22), links davon liegt das waehlbare 21.
    expect(treffer(karte, [], 6, gleich, { u: 2.15, v: 4.5 }, 22)).toBe(21);
    // Mitten im Wasser bleibt es Wasser — dort passiert dann nichts.
    expect(treffer(karte, [], 6, gleich, mitte(22), 22)).toBe(22);
  });

  it('zieht nicht mehr zum Nachbarn, wenn das Kontingent voll ist', () => {
    // Mit vollem Zettel ist kein Nachbar mehr waehlbar; der Rand von 21
    // gehoert wieder 21 — ein Tipp dort will abwaehlen.
    expect(treffer(karte, [21], 1, gleich, { u: 1.5, v: 4.12 }, 21)).toBe(21);
  });

  it('rechnet mit der Drehung der Karte fuer Sitz 1', () => {
    // Fuer Sitz 1 ist Anzeigeindex i der Platz 24 - i. Der Rand liegt dann
    // bei den Anzeigeindizes 9 (Platz 15) und 3 (Platz 21).
    const gedreht = (zelle: number): number => 24 - zelle;
    // Tipp am unteren Rand der Anzeigezelle 8 (= Platz 16, waehlbar nach 21):
    // darunter liegt Anzeigezelle 13 (Platz 11, tot) — es bleibt 8.
    expect(treffer(karte, [21], 6, gedreht, { u: 3.5, v: 1.9 }, 8)).toBe(8);
    // Tipp am oberen Rand von Anzeigezelle 3 (= Platz 21, gewaehlt): darueber
    // liegt nichts — es bleibt bei 3, dem Abwaehlen.
    expect(treffer(karte, [21], 6, gedreht, { u: 3.5, v: 0.1 }, 3)).toBe(3);
  });
});

describe('laufe — ein Wischen ueber die Karte', () => {
  it('laeuft eine Reihe entlang, jede Zelle einmal', () => {
    const betreten: number[] = [];
    laufe(20, 24, spalten, () => true, (z) => betreten.push(z));
    expect(betreten).toEqual([21, 22, 23, 24]);
  });

  it('fuellt einen Sprung ueber zwei Felder ohne Loch', () => {
    const betreten: number[] = [];
    laufe(21, 23, spalten, () => true, (z) => betreten.push(z));
    expect(betreten).toEqual([22, 23]);
  });

  it('nimmt ueber die Ecke das Zwischenfeld, das die Geste brauchen kann', () => {
    // Von 20 schraeg nach 16: Zwischenfeld 21 (rechts) oder 15 (oben). Taugt
    // nur 15, geht der Weg oben herum.
    const betreten: number[] = [];
    laufe(20, 16, spalten, (z) => z === 15, (z) => betreten.push(z));
    expect(betreten).toEqual([15, 16]);
    // Taugen beide, geht es waagerecht zuerst.
    const beide: number[] = [];
    laufe(20, 16, spalten, () => true, (z) => beide.push(z));
    expect(beide).toEqual([21, 16]);
  });

  it('fragt bei jedem Schritt neu, was taugt', () => {
    // Die Auswahl waechst waehrend des Laufens — `taugt` muss das sehen.
    const genommen = new Set<number>([20]);
    const betreten: number[] = [];
    laufe(
      20,
      12,
      spalten,
      (z) => [...genommen].some((g) => Math.abs(g - z) === 1 || Math.abs(g - z) === spalten),
      (z) => {
        genommen.add(z);
        betreten.push(z);
      },
    );
    expect(betreten).toHaveLength(4);
    expect(betreten.at(-1)).toBe(12);
  });
});

describe('selberFleck und zelleVon', () => {
  it('erkennt einen zweiten Tipp an derselben Stelle', () => {
    expect(selberFleck({ u: 1.8, v: 4.5 }, { u: 1.9, v: 4.6 })).toBe(true);
    expect(selberFleck({ u: 1.8, v: 4.5 }, { u: 1.8 + SELBER_FLECK, v: 4.5 })).toBe(false);
  });

  it('findet die Zelle unter dem Finger und nichts ausserhalb der Karte', () => {
    expect(zelleVon(karte, { u: 1.2, v: 4.9 })).toBe(21);
    expect(zelleVon(karte, { u: -0.1, v: 2 })).toBeNull();
    expect(zelleVon(karte, { u: 2, v: 5.01 })).toBeNull();
  });
});
