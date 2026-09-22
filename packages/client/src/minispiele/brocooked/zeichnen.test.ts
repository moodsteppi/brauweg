import { describe, expect, it, vi } from 'vitest';

import { neueKueche, type Kueche } from './kueche';
import { kameraFuer, zeichne } from './zeichnen';

/*
 * Der Zeichner von BroCooked.
 *
 * Zwei Dinge sind hier zu prüfen, und beide fallen im Betrieb erst spät auf:
 *
 *   1. **Die Kamera.** Sie hat keine Bewegung, also kann sie nur einen Fehler
 *      machen: die Küche nicht ganz zeigen oder sie an den Rand drücken. Beides
 *      sieht nach „hübsch genug" aus, bis jemand eine Station am Bildrand nicht
 *      mehr erreicht.
 *   2. **Dass das Malen den Zustand nicht anfasst.** Die Küche ist derselbe
 *      Gegenstand, den der Gleichschritt kopiert und weiterrechnet. Ein
 *      Zeichner, der ein `fortschritt` hochzählt oder `koeche` sortiert, lässt
 *      zwei Geräte auseinanderlaufen — sichtbar wird das als strittige
 *      Prüfsumme am Rundenende, Minuten später und nur auf einem der Geräte.
 *      Deshalb der tiefe Vergleich vorher/nachher und nicht eine Stichprobe.
 *
 * Die Leinwand ist eine Attrappe: jsdom hat keinen 2D-Kontext, und geprüft
 * wird ohnehin nicht, wie es aussieht, sondern dass es durchläuft.
 */

/** Alle Methoden, die der Zeichner benutzen darf — jede als `vi.fn()`. */
const METHODEN = [
  'save',
  'restore',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'ellipse',
  'rect',
  'fill',
  'stroke',
  'fillRect',
  'strokeRect',
  'clearRect',
  'fillText',
  'strokeText',
  'translate',
  'scale',
  'rotate',
  'setTransform',
  'clip',
  'quadraticCurveTo',
  'bezierCurveTo',
] as const;

interface Attrappe {
  ctx: CanvasRenderingContext2D;
  rufe: () => number;
}

function attrappe(): Attrappe {
  const roh: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
  };
  for (const name of METHODEN) roh[name] = vi.fn();
  return {
    ctx: roh as unknown as CanvasRenderingContext2D,
    rufe: () =>
      METHODEN.reduce((summe, name) => summe + (roh[name] as ReturnType<typeof vi.fn>).mock.calls.length, 0),
  };
}

/**
 * Tiefe Kopie zum Vergleichen. `structuredClone` steht in jsdom nicht überall
 * bereit, und die Küche trägt zwei typisierte Felder (`fest`, `stationAuf`),
 * die ein `JSON.parse(JSON.stringify(…))` in Objekte mit Zifferschlüsseln
 * verwandelte — der Vergleich wäre dann grün, egal was passiert.
 */
function tiefeKopie<T>(wert: T): T {
  if (wert instanceof Uint8Array) return new Uint8Array(wert) as unknown as T;
  if (wert instanceof Int16Array) return new Int16Array(wert) as unknown as T;
  if (Array.isArray(wert)) return wert.map((e) => tiefeKopie(e)) as unknown as T;
  if (wert !== null && typeof wert === 'object') {
    const aus: Record<string, unknown> = {};
    for (const [schluessel, inhalt] of Object.entries(wert)) aus[schluessel] = tiefeKopie(inhalt);
    return aus as unknown as T;
  }
  return wert;
}

function kueche(plan = 'insel'): Kueche {
  return neueKueche({ plan, saat: 7, sitze: 4, dauer: 2400 });
}

/**
 * Eine Küche, in der alles gleichzeitig passiert: Es gibt keinen Takt, an dem
 * man das natürlich anträfe, und genau deshalb steht es hier — der Zeichner
 * muss jeden Zweig einmal gemalt haben.
 */
function volleKueche(): Kueche {
  const k = kueche();
  k.takt = 137;
  const brett = k.stationen.find((s) => s.art === 'brett');
  if (brett) {
    brett.inhalt = { art: 'zutat', zutat: 'tomate', zustand: 'roh' };
    brett.fortschritt = 20;
  }
  const topf = k.stationen.find((s) => s.art === 'topf');
  if (topf) {
    topf.inhalt = { art: 'zutat', zutat: 'kartoffel', zustand: 'gart' };
    topf.fortschritt = 60;
  }
  const pfanne = k.stationen.find((s) => s.art === 'pfanne');
  if (pfanne) pfanne.inhalt = { art: 'zutat', zutat: 'fleisch', zustand: 'verkohlt' };
  const ablage = k.stationen.find((s) => s.art === 'ablage');
  if (ablage) {
    ablage.inhalt = {
      art: 'teller',
      sauber: true,
      inhalt: [
        { zutat: 'salat', zustand: 'geschnitten' },
        { zutat: 'fleisch', zustand: 'gar' },
      ],
    };
  }
  const spuele = k.stationen.find((s) => s.art === 'spuele');
  if (spuele) {
    spuele.stapel = 6;
    spuele.fortschritt = 30;
  }
  const tonne = k.stationen.find((s) => s.art === 'tonne');
  if (tonne) tonne.brennt = 40;

  k.koeche[0].traegt = { art: 'zutat', zutat: 'zwiebel', zustand: 'geschnitten' };
  k.koeche[1].traegt = { art: 'teller', sauber: false, inhalt: [] };
  k.koeche[1].werkt = true;
  // Koch 2 steht vor dem Brett und schneidet — der Fortschrittsring.
  if (brett) {
    k.koeche[2].x = brett.x + 0.5;
    k.koeche[2].y = brett.y + 1.5;
    k.koeche[2].rx = 0;
    k.koeche[2].ry = -1;
    k.koeche[2].werkt = true;
  }
  k.koeche[3].aktiv = false;
  return k;
}

describe('kameraFuer', () => {
  it('lässt die ganze Küche mit Rand in die Leinwand passen', () => {
    const k = kueche();
    const sicht = kameraFuer(k, 900, 600);
    expect(k.breite * sicht.mass).toBeLessThanOrEqual(900);
    expect(k.hoehe * sicht.mass).toBeLessThanOrEqual(600);
    // Der Rand ist Absicht: Ohne ihn klebt die Randwand am Bildrand.
    expect(k.breite * sicht.mass).toBeLessThan(900);
    expect(k.hoehe * sicht.mass).toBeLessThan(600);
  });

  it('zentriert die Küche in beiden Richtungen', () => {
    const k = kueche();
    const sicht = kameraFuer(k, 900, 600);
    expect(sicht.versatzX).toBeGreaterThan(0);
    expect(sicht.versatzY).toBeGreaterThan(0);
    // Links wie rechts gleich viel Luft.
    expect(900 - (sicht.versatzX + k.breite * sicht.mass)).toBeCloseTo(sicht.versatzX, 6);
    expect(600 - (sicht.versatzY + k.hoehe * sicht.mass)).toBeCloseTo(sicht.versatzY, 6);
  });

  it('gibt bei jedem Seitenverhältnis einen positiven Maßstab', () => {
    const k = kueche();
    for (const [b, h] of [
      [1920, 1080],
      [390, 844],
      [300, 300],
      [1, 1],
    ]) {
      const sicht = kameraFuer(k, b, h);
      expect(sicht.mass).toBeGreaterThan(0);
      expect(Number.isFinite(sicht.mass)).toBe(true);
    }
  });

  it('macht aus einer Leinwand mit Maß 0 kein NaN', () => {
    // Ein frisch eingehängtes <canvas> meldet im ersten Bild 0 × 0; ein
    // Maßstab von 0 färbte danach jede Rechnung mit NaN ein, und das Bild
    // bliebe für immer leer.
    const sicht = kameraFuer(kueche(), 0, 0);
    expect(sicht.mass).toBeGreaterThan(0);
    expect(Number.isFinite(sicht.versatzX)).toBe(true);
    expect(Number.isFinite(sicht.versatzY)).toBe(true);
  });
});

describe('zeichne', () => {
  it('läuft mit einem Attrappen-Kontext durch und malt etwas', () => {
    const k = volleKueche();
    const { ctx, rufe } = attrappe();
    expect(() => zeichne(ctx, k, kameraFuer(k, 900, 600), 0, false)).not.toThrow();
    expect(rufe()).toBeGreaterThan(50);
  });

  it('malt hell wie dunkel und mit und ohne eigenen Sitz', () => {
    const k = volleKueche();
    for (const dunkel of [false, true]) {
      for (const sitz of [-1, 0, 3]) {
        const { ctx } = attrappe();
        expect(() => zeichne(ctx, k, kameraFuer(k, 480, 900), sitz, dunkel)).not.toThrow();
      }
    }
  });

  it('kommt mit jeder Küche zurecht', () => {
    for (const plan of ['wiese', 'kantine', 'insel', 'brandwache']) {
      const k = neueKueche({ plan, saat: 3, sitze: 2, dauer: 1200 });
      const { ctx } = attrappe();
      expect(() => zeichne(ctx, k, kameraFuer(k, 1024, 768), 1, false)).not.toThrow();
    }
  });

  it('verändert den Zustand nicht', () => {
    const k = volleKueche();
    const vorher = tiefeKopie(k);
    const { ctx } = attrappe();
    zeichne(ctx, k, kameraFuer(k, 900, 600), 0, false);
    expect(k).toEqual(vorher);
  });

  it('lässt auch die Reihenfolge der Köche unangetastet', () => {
    // Nach Tiefe sortiert wird auf einer KOPIE: Die Sitzreihenfolge von
    // `koeche` ist die Eingabereihenfolge des Gleichschritts — sie zu
    // vertauschen wäre eine andere Partie.
    const k = volleKueche();
    k.koeche[0].y = 5.5;
    k.koeche[1].y = 2.5;
    const vorher = k.koeche.map((koch) => koch.y);
    zeichne(attrappe().ctx, k, kameraFuer(k, 900, 600), 0, false);
    expect(k.koeche.map((koch) => koch.y)).toEqual(vorher);
  });
});
