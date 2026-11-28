/**
 * Faehigkeiten und Markeneffekte (seit dem 27.11.2026). Geprueft wird, was
 * die Anzeige und die Balance voraussetzen: Jede aktive Faehigkeit loest
 * ueberhaupt aus, Mana bleibt in seinen Grenzen, Betaeubte handeln nicht,
 * Wiederkehr gibt es je Seite einmal, und nur Nahkaempfer springen.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type Brettseite,
  BRETT_FELDER,
  type EinheitId,
  type Ereignis,
  FAEHIGKEITEN,
  KATALOG,
  type Kampfbericht,
  einheit,
  platzNummer,
  simuliereKampf,
  werteFuer,
} from '../src/index.js';

type Treffer = Extract<Ereignis, { art: 'treffer' }>;

/** Eine Bretthaelfte aus [Einheit, Reihe, Spalte]. Reihe 0 ist vorn. */
function brett(einheiten: readonly (readonly [EinheitId, number, number])[]): Brettseite {
  const plaetze: (Brettseite[number])[] = Array.from({ length: BRETT_FELDER }, () => null);
  for (const [id, reihe, spalte] of einheiten) plaetze[platzNummer(reihe, spalte)] = { id, stufe: 1 };
  return plaetze;
}

/** Drei Kopien vorn und eine Wache dahinter, gegen ein gemischtes Brett. */
function probeKampf(id: EinheitId, saat: string): Kampfbericht {
  const eigen = brett([
    [id, 0, 1],
    [id, 0, 2],
    [id, 0, 3],
    ['dorfwache', 1, 2],
  ]);
  const gegner = brett([
    ['grimmbart', 0, 1],
    ['hainwaechterin', 0, 2],
    ['schattenklinge', 0, 3],
    ['bogenmeisterin', 1, 1],
    ['moosheiler', 1, 3],
  ]);
  return simuliereKampf([eigen, gegner], saat);
}

describe('Faehigkeiten', () => {
  it('hat fuer jede Einheit einen Eintrag, und aktive brauchen Mana', () => {
    for (const e of KATALOG) {
      assert.ok(e.id in FAEHIGKEITEN, `${e.id} fehlt in FAEHIGKEITEN`);
      const f = FAEHIGKEITEN[e.id];
      if (f?.art === 'aktiv') assert.ok(f.mana > 0, `${e.id}: aktiv ohne Mana`);
      if (f?.art === 'passiv') assert.equal(f.mana, 0, `${e.id}: passiv mit Mana`);
    }
  });

  it('loest jede aktive Faehigkeit in einem gewoehnlichen Kampf wenigstens einmal aus', () => {
    for (const e of KATALOG) {
      const f = FAEHIGKEITEN[e.id];
      if (f?.art !== 'aktiv') continue;
      let gesehen = false;
      for (let i = 0; i < 6 && !gesehen; i++) {
        const bericht = probeKampf(e.id, `f-${e.id}-${i}`);
        gesehen = bericht.ereignisse.some((x) => x.art === 'faehigkeit' && x.faehigkeit === f.id);
      }
      assert.ok(gesehen, `${e.id} (${f.id}) wirkt nie`);
    }
  });

  it('haelt das Mana zwischen null und dem vollen Balken und leert es beim Wirken', () => {
    for (const e of KATALOG) {
      const bericht = probeKampf(e.id, `mana-${e.id}`);
      const start = new Map(bericht.start.map((k) => [k.id, k.einheitId]));
      const voll = (id: number): number => {
        const f = FAEHIGKEITEN[start.get(id)!];
        return f?.art === 'aktiv' ? f.mana : 0;
      };
      for (const x of bericht.ereignisse) {
        if (x.art !== 'treffer') continue;
        assert.ok(x.manaWer >= 0 && x.manaWer <= voll(x.wer), `${e.id}: Mana ${x.manaWer}`);
        assert.ok(x.manaZiel >= 0 && x.manaZiel <= voll(x.ziel), `${e.id}: Mana ${x.manaZiel}`);
      }
      // Der erste Treffer NACH einem Wirken nennt beim Wirker hoechstens
      // das Mana eines einzelnen Angriffs.
      bericht.ereignisse.forEach((x, n) => {
        if (x.art !== 'faehigkeit') return;
        const danach = bericht.ereignisse
          .slice(n + 1)
          .find((y): y is Treffer => y.art === 'treffer' && y.wer === x.wer && y.quelle === 'faehigkeit');
        if (danach) assert.ok(danach.manaWer <= 10, `${e.id}: Mana nach dem Wirken ${danach.manaWer}`);
      });
    }
  });

  it('laesst eine betaeubte Einheit bis zum Ende der Betaeubung nichts tun', () => {
    for (let i = 0; i < 10; i++) {
      const bericht = probeKampf('steinschleuderer', `betaeubt-${i}`);
      const betaeubt = new Map<number, number>();
      for (const x of bericht.ereignisse) {
        if (x.art === 'zustand' && x.zustand === 'betaeubt' && x.bisMs !== null) {
          betaeubt.set(x.wer, x.bisMs);
          continue;
        }
        if (x.art !== 'treffer' && x.art !== 'bewegung' && x.art !== 'heilung' && x.art !== 'faehigkeit') continue;
        if (x.art === 'treffer' && x.quelle === 'brand') continue;
        if (x.art === 'heilung' && x.quelle === 'wachstum') continue;
        const bis = betaeubt.get(x.wer);
        if (bis !== undefined && x.zeitMs < bis) {
          assert.fail(`Kennung ${x.wer} handelt bei ${x.zeitMs} ms, betaeubt bis ${bis}`);
        }
      }
    }
  });

  it('zieht den Schild vom Schaden ab, bevor das Leben sinkt', () => {
    const bericht = probeKampf('runenpriester', 'schild');
    const schild = new Map<number, number>();
    for (const x of bericht.ereignisse) {
      if (x.art === 'zustand' && x.zustand === 'schild') {
        schild.set(x.wer, (schild.get(x.wer) ?? 0) + (x.menge ?? 0));
      }
      if (x.art === 'treffer' && x.abgefangen) {
        const rest = schild.get(x.ziel) ?? 0;
        assert.ok(x.abgefangen <= rest, `abgefangen ${x.abgefangen}, Schild ${rest}`);
        schild.set(x.ziel, rest - x.abgefangen);
      }
    }
    assert.ok([...bericht.ereignisse].some((x) => x.art === 'zustand' && x.zustand === 'schild'));
  });
});

describe('Markeneffekte', () => {
  it('laesst je Seite hoechstens einen Untoten wiederkehren', () => {
    const untot = brett([
      ['knochenspaeher', 0, 1],
      ['schildknappe', 0, 2],
      ['grabfuerstin', 1, 2],
    ]);
    const gegner = brett([
      ['wurzelriese', 0, 2],
      ['klingentaenzerin', 0, 1],
      ['drachenkind', 1, 2],
    ]);
    let einmalGesehen = false;
    for (let i = 0; i < 10; i++) {
      const bericht = simuliereKampf([untot, gegner], `untot-${i}`);
      const kehren = bericht.ereignisse.filter((x) => x.art === 'wiederkehr');
      assert.ok(kehren.length <= 1, `${kehren.length} Wiederkehren`);
      if (kehren.length === 1) einmalGesehen = true;
    }
    assert.ok(einmalGesehen, 'die Wiederkehr kommt in zehn Kaempfen nie vor');
  });

  it('laesst nur Nahkaempfer mit der Marke Meuchler zu Kampfbeginn springen', () => {
    const meuchler = brett([
      ['gassendieb', 0, 1],
      ['schattenklinge', 0, 3],
      ['nachtpfeil', 1, 2],
    ]);
    const gegner = brett([
      ['dorfwache', 0, 2],
      ['astschuetze', 2, 1],
      ['funkenlehrling', 2, 3],
    ]);
    const bericht = simuliereKampf([meuchler, gegner], 'hinterhalt');
    const zuBeginn = bericht.ereignisse.filter((x) => x.art === 'sprung' && x.zeitMs === 0);
    assert.ok(zuBeginn.length >= 1, 'niemand springt');
    for (const x of zuBeginn) {
      if (x.art !== 'sprung') continue;
      const stand = bericht.start.find((k) => k.id === x.wer)!;
      assert.equal(werteFuer(stand.einheitId, 1).reichweite, 1, `${stand.einheitId} springt, ist aber Fernkaempfer`);
      assert.ok(einheit(stand.einheitId).marken.includes('meuchler'));
    }
  });

  it('setzt mit der Marke Drache einen Brand, der ueber Zeit schadet', () => {
    const drachen = brett([
      ['funkenlehrling', 0, 1],
      ['drachenkind', 1, 2],
    ]);
    const gegner = brett([['grimmbart', 0, 2]]);
    const bericht = simuliereKampf([drachen, gegner], 'glut');
    assert.ok(bericht.ereignisse.some((x) => x.art === 'zustand' && x.zustand === 'brand'));
    assert.ok(bericht.ereignisse.some((x) => x.art === 'treffer' && x.quelle === 'brand'));
  });
});
