/**
 * Proben für die Eingabe — Joystick und Tastatur.
 *
 * Alle drei Fehler, die diese Datei abfängt, sieht man am Bildschirm nicht
 * oder erst viel später:
 *
 *  1. Eine Richtung, die nicht genau die Länge eins hat. Das Modul weist sie
 *     ab (`richtungUngueltig` in `packages/game-brocooked/src/partie.ts`, die
 *     Spanne dort ist 0,99 bis 1,01) — der Koch bliebe stehen, ohne dass
 *     irgendwo eine Fehlermeldung erschiene.
 *  2. Eine Totzone, die nicht greift: Der Koch zittert um seinen Platz, weil
 *     ein aufliegender Daumen nie ganz stillhält.
 *  3. Eine Taste, die zwei Köchen gehört. Am geteilten Bildschirm steuerte
 *     eine Taste dann beide — und man sucht den Fehler in der Küche.
 */

import { describe, expect, it } from 'vitest';

import {
  BELEGUNG_LINKS,
  BELEGUNG_RECHTS,
  DOPPELTIPP_MS,
  STEHT,
  STICK_RADIUS,
  TOTZONE,
  belegteTasten,
  gleich,
  istDoppeltipp,
  normiere,
  stickRichtung,
  stickWeg,
  taste,
  tastenRichtung,
  type Richtung,
  type Stick,
} from './eingabe';

/** Die Spanne, die `partie.ts` im Modul durchlässt. */
const SPANNE_MIN = 0.99;
const SPANNE_MAX = 1.01;

function laenge(r: Richtung): number {
  return Math.sqrt(r.dx * r.dx + r.dy * r.dy);
}

/**
 * Vier Nachkommastellen, genau wie das Modul sie auf der Leitung sieht.
 *
 * Geprüft wird als Rundreise (runden, zurückteilen, vergleichen) und nicht
 * über `dx * 10000`: Letzteres ist auch für einen sauber gerundeten Wert
 * nicht ganzzahlig (0,7071 · 10000 ergibt 7071,000000000001), und die Probe
 * wäre für jede Richtung rot.
 */
function hatVierStellen(r: Richtung): boolean {
  return Math.round(r.dx * 10000) / 10000 === r.dx && Math.round(r.dy * 10000) / 10000 === r.dy;
}

function tasten(...t: string[]): ReadonlySet<string> {
  return new Set(t);
}

function stick(dx: number, dy: number): Stick {
  return { zeiger: 1, ursprungX: 100, ursprungY: 200, x: 100 + dx, y: 200 + dy };
}

describe('normiere', () => {
  it('lässt kleine Auslenkungen als Stillstand durch', () => {
    // Ein aufliegender Daumen wandert immer ein paar Punkte. Ohne Totzone
    // wäre jede dieser Wanderungen eine Eingabe auf der Leitung.
    expect(normiere(0, 0)).toEqual(STEHT);
    expect(normiere(3, 4)).toEqual(STEHT); // Länge 5
    expect(normiere(-8, 6)).toEqual(STEHT); // Länge 10
    expect(normiere(0, TOTZONE - 0.5)).toEqual(STEHT);
  });

  it('normiert ab der Totzone — die Grenze selbst zählt als bewegt', () => {
    expect(normiere(TOTZONE, 0)).toEqual({ dx: 1, dy: 0 });
    expect(normiere(0, -TOTZONE)).toEqual({ dx: 0, dy: -1 });
  });

  it('gibt eine Richtung der Länge eins zurück, auf vier Stellen gerundet', () => {
    const r = normiere(30, -40);
    expect(r).toEqual({ dx: 0.6, dy: -0.8 });
    expect(laenge(r)).toBe(1);
  });

  it('bleibt bei jeder Auslenkung in der Spanne, die das Modul durchlässt', () => {
    /*
     * Das ist der Kern: Das Runden auf vier Stellen verkürzt den Vektor
     * geringfügig. Bliebe es dabei, wäre die Eingabe am Server wertlos —
     * gerundet werden MUSS aber, weil `Math.atan2` und Freunde zwischen
     * Safari und V8 in der letzten Stelle abweichen.
     *
     * Bewusst ohne `sin`/`cos`: ganzzahlige Auslenkungen, wie sie aus
     * Bildpunkten kommen, und zwar quer über alle Quadranten.
     */
    for (let dx = -60; dx <= 60; dx += 1) {
      for (let dy = -60; dy <= 60; dy += 3) {
        const r = normiere(dx, dy);
        if (gleich(r, STEHT)) continue;
        const l = laenge(r);
        expect(l, `${dx}/${dy}`).toBeGreaterThan(SPANNE_MIN);
        expect(l, `${dx}/${dy}`).toBeLessThan(SPANNE_MAX);
        // Das Runden der beiden Zahlen verschiebt die Länge um höchstens
        // ein Zehntausendstel — also weit innerhalb der Spanne des Moduls,
        // aber eben nicht auf die Null hinter dem Komma genau.
        expect(Math.abs(l - 1), `${dx}/${dy}`).toBeLessThan(1e-4);
        expect(hatVierStellen(r), `${dx}/${dy}`).toBe(true);
      }
    }
  });

  it('nimmt eine eigene Totzone an — die Tastatur braucht keine', () => {
    /*
     * Eine Tastenrichtung ist schon 0/±1, da wäre jede Totzone falsch; sie
     * wird deshalb mit 0 abgeschaltet.
     *
     * ACHTUNG, hier hängt etwas am Aufrufer: Mit Totzone 0 ist auch die
     * Auslenkung 0/0 „bewegt", und `normiere` teilt durch null — das Ergebnis
     * wäre NaN/NaN auf der Leitung. Abgefangen wird das nur in
     * `tastenRichtung`, das vorher auf Stillstand prüft. Die Probe darunter
     * hält genau diese Deckung fest.
     */
    expect(normiere(1, 1, 0)).toEqual({ dx: 0.7071, dy: 0.7071 });
    expect(normiere(-1, 0, 0)).toEqual({ dx: -1, dy: 0 });
  });

  it('wird vom Aufrufer vor der Auslenkung null geschützt', () => {
    const r = tastenRichtung(tasten(), BELEGUNG_LINKS);
    expect(r).toEqual(STEHT);
    expect(Number.isNaN(r.dx)).toBe(false);
    expect(Number.isNaN(r.dy)).toBe(false);
  });
});

describe('gleich', () => {
  it('vergleicht genau die zwei Zahlen, die über die Leitung gehen', () => {
    expect(gleich(normiere(30, -40), { dx: 0.6, dy: -0.8 })).toBe(true);
    expect(gleich(normiere(30, -40), normiere(-30, -40))).toBe(false);
    expect(gleich(STEHT, STEHT)).toBe(true);
  });
});

describe('tastenRichtung', () => {
  it('läuft in die vier geraden Richtungen', () => {
    expect(tastenRichtung(tasten('KeyW'), BELEGUNG_LINKS)).toEqual({ dx: 0, dy: -1 });
    expect(tastenRichtung(tasten('KeyS'), BELEGUNG_LINKS)).toEqual({ dx: 0, dy: 1 });
    expect(tastenRichtung(tasten('KeyA'), BELEGUNG_LINKS)).toEqual({ dx: -1, dy: 0 });
    expect(tastenRichtung(tasten('KeyD'), BELEGUNG_LINKS)).toEqual({ dx: 1, dy: 0 });
  });

  it('hebt gegensätzliche Tasten auf', () => {
    /*
     * Wer links und rechts zugleich hält, steht. Alles andere wäre eine
     * Frage der Tastaturbauart: Welche der beiden Tasten „gewinnt", hinge
     * sonst an der Reihenfolge der Ereignisse, und die ist je nach Tastatur
     * und Betriebssystem eine andere.
     */
    expect(tastenRichtung(tasten('KeyA', 'KeyD'), BELEGUNG_LINKS)).toEqual(STEHT);
    expect(tastenRichtung(tasten('KeyW', 'KeyS'), BELEGUNG_LINKS)).toEqual(STEHT);
    expect(tastenRichtung(tasten('KeyA', 'KeyD', 'KeyW', 'KeyS'), BELEGUNG_LINKS)).toEqual(STEHT);
    // Aber nur die Achse, die sich aufhebt — die andere bleibt.
    expect(tastenRichtung(tasten('KeyA', 'KeyD', 'KeyW'), BELEGUNG_LINKS)).toEqual({ dx: 0, dy: -1 });
  });

  it('gibt diagonal die Länge eins — nicht Wurzel zwei', () => {
    // Sonst liefe man schräg das 1,41-Fache schnell, und das Modul wiese die
    // Richtung ohnehin ab (Länge über 1,01).
    const r = tastenRichtung(tasten('KeyD', 'KeyS'), BELEGUNG_LINKS);
    expect(r).toEqual({ dx: 0.7071, dy: 0.7071 });
    expect(laenge(r)).toBeGreaterThan(SPANNE_MIN);
    expect(laenge(r)).toBeLessThan(SPANNE_MAX);
  });

  it('steht ohne gedrückte Taste', () => {
    expect(tastenRichtung(tasten(), BELEGUNG_LINKS)).toEqual(STEHT);
    expect(tastenRichtung(tasten('KeyQ', 'Escape'), BELEGUNG_LINKS)).toEqual(STEHT);
  });

  it('greift nicht in die zweite Belegung hinein', () => {
    // Die Pfeiltasten dürfen Koch 1 nicht bewegen und WASD nicht Koch 2.
    expect(tastenRichtung(tasten('ArrowUp', 'ArrowLeft'), BELEGUNG_LINKS)).toEqual(STEHT);
    expect(tastenRichtung(tasten('KeyW', 'KeyA'), BELEGUNG_RECHTS)).toEqual(STEHT);
    expect(tastenRichtung(tasten('ArrowRight'), BELEGUNG_RECHTS)).toEqual({ dx: 1, dy: 0 });
  });
});

describe('taste', () => {
  it('erkennt die Knöpfe beider Belegungen', () => {
    expect(taste(tasten('Space'), BELEGUNG_LINKS, 'greifen')).toBe(true);
    expect(taste(tasten('KeyE'), BELEGUNG_LINKS, 'werken')).toBe(true);
    expect(taste(tasten('ShiftLeft'), BELEGUNG_LINKS, 'spurt')).toBe(true);
    // Zweitbelegungen: Nicht jede Tastatur hat einen Ziffernblock.
    expect(taste(tasten('NumpadEnter'), BELEGUNG_RECHTS, 'greifen')).toBe(true);
    expect(taste(tasten('Enter'), BELEGUNG_RECHTS, 'greifen')).toBe(true);
    expect(taste(tasten('ControlRight'), BELEGUNG_RECHTS, 'werken')).toBe(true);
    expect(taste(tasten('Numpad0'), BELEGUNG_RECHTS, 'werken')).toBe(true);
  });

  it('meldet einen Knopf der anderen Belegung nicht', () => {
    expect(taste(tasten('Space'), BELEGUNG_RECHTS, 'greifen')).toBe(false);
    expect(taste(tasten('ShiftRight'), BELEGUNG_LINKS, 'spurt')).toBe(false);
  });
});

describe('belegteTasten', () => {
  it('sammelt alle Tasten beider Belegungen', () => {
    const alle = belegteTasten([BELEGUNG_LINKS, BELEGUNG_RECHTS]);
    expect(alle.has('KeyW')).toBe(true);
    expect(alle.has('ArrowUp')).toBe(true);
    expect(alle.has('NumpadEnter')).toBe(true);
    // Was nicht belegt ist, darf der Bildschirm nicht abfangen — sonst
    // bliebe zum Beispiel die Eingabetaste im Chat wirkungslos.
    expect(alle.has('KeyQ')).toBe(false);
    expect(belegteTasten([]).size).toBe(0);
  });

  it('vergibt keine Taste doppelt', () => {
    /*
     * Am geteilten Bildschirm sitzen zwei Menschen an einer Tastatur. Eine
     * Taste in beiden Belegungen steuerte beide Köche zugleich — und man
     * suchte den Fehler in der Küche statt in dieser Tabelle.
     */
    const links = belegteTasten([BELEGUNG_LINKS]);
    const rechts = belegteTasten([BELEGUNG_RECHTS]);
    const beide = [...links].filter((t) => rechts.has(t));
    expect(beide).toEqual([]);
    expect(belegteTasten([BELEGUNG_LINKS, BELEGUNG_RECHTS]).size).toBe(links.size + rechts.size);
  });

  it('vergibt innerhalb einer Belegung keine Taste zweimal', () => {
    // Eine Taste, die zugleich „links" und „greifen" ist, ließe den Koch bei
    // jedem Griff losmarschieren.
    for (const b of [BELEGUNG_LINKS, BELEGUNG_RECHTS]) {
      const listen = [b.hoch, b.runter, b.links, b.rechts, b.greifen, b.werken, b.spurt];
      const flach = listen.flatMap((l) => [...l]);
      expect(new Set(flach).size).toBe(flach.length);
    }
  });
});

describe('stickRichtung und stickWeg', () => {
  it('steht ohne Daumen auf dem Glas', () => {
    expect(stickRichtung(null)).toEqual(STEHT);
    expect(stickWeg(null)).toBe(0);
  });

  it('misst vom Aufsetzpunkt, nicht von der Mitte des Bildschirms', () => {
    // Auf einem Handy trifft niemand blind dieselbe Stelle; ein fester Kreis
    // kostete jedes Mal einen Blick nach unten.
    expect(stickRichtung(stick(0, 40))).toEqual({ dx: 0, dy: 1 });
    expect(stickRichtung(stick(-30, -40))).toEqual({ dx: -0.6, dy: -0.8 });
  });

  it('zählt eine Auslenkung innerhalb der Totzone als Stillstand', () => {
    expect(stickRichtung(stick(0, 0))).toEqual(STEHT);
    expect(stickRichtung(stick(5, 5))).toEqual(STEHT);
  });

  it('gibt den Weg zwischen null und eins an', () => {
    expect(stickWeg(stick(0, 0))).toBe(0);
    expect(stickWeg(stick(STICK_RADIUS / 2, 0))).toBe(0.5);
    expect(stickWeg(stick(STICK_RADIUS, 0))).toBe(1);
    // Über den Rand hinaus wird gekappt: Der Ring wüchse sonst aus dem Bild.
    expect(stickWeg(stick(STICK_RADIUS * 4, 0))).toBe(1);
  });
});

describe('istDoppeltipp', () => {
  it('erkennt zwei Berührungen innerhalb des Fensters', () => {
    expect(istDoppeltipp(1_000, 1_000)).toBe(true);
    expect(istDoppeltipp(1_000, 1_000 + DOPPELTIPP_MS - 1)).toBe(true);
    // Die Grenze selbst zählt noch als Doppeltipp.
    expect(istDoppeltipp(1_000, 1_000 + DOPPELTIPP_MS)).toBe(true);
  });

  it('lässt ein hektisches Nachfassen kein Spurt werden', () => {
    expect(istDoppeltipp(1_000, 1_000 + DOPPELTIPP_MS + 1)).toBe(false);
    expect(istDoppeltipp(1_000, 5_000)).toBe(false);
  });

  it('meldet vor dem ersten Tipp keinen Doppeltipp', () => {
    // Der Anfangswert ist eine sehr kleine Zahl; sonst wäre die allererste
    // Berührung einer Partie ein Spurt.
    expect(istDoppeltipp(Number.NEGATIVE_INFINITY, 0)).toBe(false);
    expect(istDoppeltipp(-100_000, 0)).toBe(false);
  });
});
