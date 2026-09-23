/**
 * Proben für die Küchenpläne.
 *
 * Ein Gitter sieht im Editor immer richtig aus. Was man nicht sieht: eine
 * Zeile, die ein Zeichen kürzer ist (der Koch läuft aus dem Bild), eine
 * Station hinter drei Theken (unerreichbar, und das Rezept wird nie fertig)
 * oder ein Rezept, das es gar nicht gibt. Genau das steht hier.
 */

import { describe, expect, it } from 'vitest';

import { KUECHEN, kuechenplan } from './kuechen';
import { neueKueche, stationBei, type Kueche } from './kueche';
import { REZEPTE, rezept } from './rezepte';

const KISTEN_ZEICHEN = '123456789';

function bodenNeben(k: Kueche, x: number, y: number): boolean {
  const nachbarn = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  return nachbarn.some(([nx, ny]) => {
    if (nx < 0 || ny < 0 || nx >= k.breite || ny >= k.hoehe) return false;
    return k.fest[ny * k.breite + nx] === 0;
  });
}

describe.each(KUECHEN.map((p) => [p.id, p] as const))('Küche %s', (_id, plan) => {
  it('hat lauter gleich lange Zeilen', () => {
    const breiten = new Set(plan.gitter.map((z) => z.length));
    expect([...breiten]).toHaveLength(1);
  });

  it('ist ringsum geschlossen — sonst läuft ein Koch aus dem Bild', () => {
    const hoehe = plan.gitter.length;
    const breite = plan.gitter[0].length;
    for (let x = 0; x < breite; x += 1) {
      expect(plan.gitter[0][x]).toBe('#');
      expect(plan.gitter[hoehe - 1][x]).toBe('#');
    }
    for (let y = 0; y < hoehe; y += 1) {
      expect(plan.gitter[y][0]).toBe('#');
      expect(plan.gitter[y][breite - 1]).toBe('#');
    }
  });

  it('kennt jede Kiste, die im Gitter steht', () => {
    for (const zeile of plan.gitter) {
      for (const z of zeile) {
        if (KISTEN_ZEICHEN.includes(z)) expect(plan.kisten[z]).toBeDefined();
      }
    }
    // Und umgekehrt: keine Kiste, die niemand aufgestellt hat.
    for (const z of Object.keys(plan.kisten)) {
      expect(plan.gitter.some((zeile) => zeile.includes(z))).toBe(true);
    }
  });

  it('hat Tellerstapel, Spüle und Durchreiche', () => {
    const k = neueKueche({ plan: plan.id, saat: 1, sitze: 2, dauer: 100 });
    for (const art of ['tellerstapel', 'spuele', 'durchreiche'] as const) {
      expect(k.stationen.some((s) => s.art === art)).toBe(true);
    }
  });

  it('stellt jede Station an ein Bodenfeld — unerreichbar ist so gut wie nicht da', () => {
    const k = neueKueche({ plan: plan.id, saat: 1, sitze: 2, dauer: 100 });
    for (const s of k.stationen) {
      expect(bodenNeben(k, s.x, s.y), `${s.art} bei ${s.x},${s.y}`).toBe(true);
    }
  });

  it('nennt nur Rezepte, die es gibt, und liefert deren Zutaten aus Kisten', () => {
    const k = neueKueche({ plan: plan.id, saat: 1, sitze: 2, dauer: 100 });
    const kisten = new Set(k.stationen.filter((s) => s.art === 'kiste').map((s) => s.zutat));
    for (const id of plan.rezepte) {
      const r = rezept(id);
      for (const z of r.braucht) {
        expect(kisten.has(z), `${plan.id} braucht ${z} für ${id}`).toBe(true);
      }
      // Wer garen muss, braucht die passende Station.
      if (r.station !== null) {
        expect(k.stationen.some((s) => s.art === r.station)).toBe(true);
      }
    }
  });

  it('hat aufsteigende Sternschwellen', () => {
    expect(plan.schwellen[0]).toBeLessThan(plan.schwellen[1]);
    expect(plan.schwellen[1]).toBeLessThan(plan.schwellen[2]);
  });

  it('stellt mindestens zwei Startplätze', () => {
    const plaetze = plan.gitter.join('').match(/[a-d]/g) ?? [];
    expect(plaetze.length).toBeGreaterThanOrEqual(2);
  });
});

describe('kuechenplan', () => {
  it('gibt bei unbekannter Kennung die erste Küche statt eines Fehlers', () => {
    expect(kuechenplan('gibtsnicht').id).toBe(KUECHEN[0].id);
    expect(kuechenplan('insel').id).toBe('insel');
  });
});

describe('Rezepte', () => {
  it('haben eindeutige Kennungen und plausible Fristen', () => {
    const ids = REZEPTE.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REZEPTE) {
      expect(r.braucht.length).toBeGreaterThan(0);
      expect(r.braucht.length).toBeLessThanOrEqual(3);
      expect(r.frist).toBeGreaterThanOrEqual(600);
      // Was gegart wird, muss auch gebraucht werden.
      for (const z of r.garen) expect(r.braucht).toContain(z);
      // Wer gart, nennt eine Station; wer keine nennt, gart nichts.
      expect(r.garen.length > 0).toBe(r.station !== null);
    }
  });

  it('stellt jede Station des Spiels in mindestens einer Küche auf', () => {
    const gestellt = new Set<string>();
    for (const plan of KUECHEN) {
      const k = neueKueche({ plan: plan.id, saat: 1, sitze: 1, dauer: 10 });
      for (const s of k.stationen) gestellt.add(s.art);
    }
    for (const art of ['brett', 'topf', 'pfanne', 'fritteuse', 'tonne', 'ablage'] as const) {
      expect(gestellt.has(art), art).toBe(true);
    }
  });
});

describe('neueKueche', () => {
  it('macht aus Buchstaben Stationen und aus Startplätzen Böden', () => {
    const k = neueKueche({ plan: 'wiese', saat: 5, sitze: 2, dauer: 500 });
    const stapel = k.stationen.find((s) => s.art === 'tellerstapel');
    expect(stapel).toBeDefined();
    expect(stapel?.stapel).toBe(kuechenplan('wiese').teller);
    // Der Startplatz `a` steht in Zeile 2, Spalte 2 — dort ist Boden.
    expect(k.fest[2 * k.breite + 2]).toBe(0);
    expect(stationBei(k, 2, 2)).toBeNull();
    // Die Köche stehen in der Küche, nicht in einer Wand.
    for (const koch of k.koeche) {
      expect(k.fest[Math.floor(koch.y) * k.breite + Math.floor(koch.x)]).toBe(0);
    }
  });
});
