/**
 * Sternregel, Flugmeilen, Hub-Münzen und die Plausibilität einer Meldung —
 * alles, was der Server aus einem Versuch macht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  type Level,
  FLYINGBRO_MAX_PRO_TAG,
  FLYINGBRO_MUENZEN_JE_STERN,
  FLYINGBRO_WELT_MUENZEN,
  freigeschaltet,
  hoechstpunkte,
  LEVELS,
  levelNach,
  MEILEN,
  meilenFuer,
  muenzenFuer,
  pruefeMeldung,
  sterneFuer,
  weltErfuellt,
  werte,
} from '../src/index.js';

const w1 = levelNach('w1-01')!;
const [, zwei, drei] = w1.sterne;

test('Sterne: nicht geschafft ist null, egal wie viele Punkte', () => {
  assert.equal(sterneFuer(w1, { geschafft: false, punkte: 999_999, hilfsmittel: [] }), 0);
});

test('Sterne: Schwellen 1 / 2 / 3', () => {
  const s = (punkte: number) => sterneFuer(w1, { geschafft: true, punkte, hilfsmittel: [] });
  assert.equal(s(0), 1);
  assert.equal(s(zwei - 1), 1);
  assert.equal(s(zwei), 2);
  assert.equal(s(drei - 1), 2);
  assert.equal(s(drei), 3);
});

test('Sterne: mit Hilfsmittel höchstens zwei, egal wie viele Punkte', () => {
  for (const h of ['fernrohr', 'bauplan', 'ersatz-pelle'] as const)
    assert.equal(sterneFuer(w1, { geschafft: true, punkte: drei + 10_000, hilfsmittel: [h] }), 2, h);
});

// ---------------------------------------------------------------------------

const ALLE = new Set(LEVELS.map((l) => l.id));

test('Freischaltung: erstes Level immer, danach nur mit geschafftem Vorgänger', () => {
  assert.ok(freigeschaltet('w1-01', new Set()));
  assert.ok(!freigeschaltet('w1-02', new Set()));
  assert.ok(freigeschaltet('w1-02', new Set(['w1-01'])));
  assert.ok(!freigeschaltet('w1-03', new Set(['w1-01'])));
  assert.ok(!freigeschaltet('w7-01', ALLE));
});

const gut = { levelId: 'w1-01', geschafft: true, punkte: 7000, verschossen: 2, hilfsmittel: [] as string[], dauerMs: 30_000 };

test('Meldung: eine ehrliche wird angenommen', () => {
  const r = pruefeMeldung(gut, new Set());
  assert.ok(r.ok);
  assert.equal(r.level.id, 'w1-01');
});

test('Meldung: jede Plausibilitätsregel lehnt ab', () => {
  const grund = (m: Partial<typeof gut>, geschafft = new Set<string>()) => {
    const r = pruefeMeldung({ ...gut, ...m }, geschafft);
    return r.ok ? 'ok' : r.grund;
  };
  assert.equal(grund({ levelId: 'w1-99' }), 'level_unbekannt');
  assert.equal(grund({ levelId: 'w1-05' }), 'nicht_freigeschaltet');
  assert.equal(grund({ hilfsmittel: ['zauberstab'] }), 'hilfsmittel_ungueltig');
  assert.equal(grund({ hilfsmittel: ['fernrohr', 'fernrohr'] }), 'hilfsmittel_ungueltig');
  assert.equal(grund({ verschossen: 0 }), 'bros_ungueltig');
  assert.equal(grund({ verschossen: 4 }), 'bros_ungueltig');
  assert.equal(grund({ verschossen: 1.5 }), 'bros_ungueltig');
  assert.equal(grund({ punkte: -1 }), 'punkte_ungueltig');
  assert.equal(grund({ punkte: 12.5 }), 'punkte_ungueltig');
  assert.equal(grund({ punkte: hoechstpunkte(w1) + 1 }), 'punkte_ungueltig');
  assert.equal(grund({ dauerMs: 7999 }), 'zu_schnell', '4 s je verschossenem Bro');
  assert.equal(grund({ dauerMs: 8000 }), 'ok');
});

test('Meldung: Ersatz-Pelle hebt Bros und Höchstpunkte um einen Bro', () => {
  const h = hoechstpunkte(w1);
  assert.equal(pruefeMeldung({ ...gut, punkte: h + 3000, verschossen: 4, dauerMs: 60_000, hilfsmittel: ['ersatz-pelle'] }, new Set()).ok, true);
  assert.equal(pruefeMeldung({ ...gut, punkte: h + 3000, verschossen: 4, dauerMs: 60_000, hilfsmittel: ['fernrohr'] }, new Set()).ok, false);
});

// ---------------------------------------------------------------------------

test('Meilen: erstes Schaffen mit drei Sternen', () => {
  const m = meilenFuer(w1, 3, {}, 0);
  assert.equal(m.erstmals, 30);
  assert.equal(m.neueSterne, 30);
  assert.equal(m.wiederholung, 0);
  assert.equal(m.summe, 60);
  assert.equal(m.zaehltAlsWiederholung, false);
});

test('Meilen: Wiederholung bringt 5, neue Sterne zusätzlich, verlorene Sterne nichts ab', () => {
  assert.equal(meilenFuer(w1, 1, { 'w1-01': 1 }, 0).summe, 5);
  assert.equal(meilenFuer(w1, 3, { 'w1-01': 1 }, 0).summe, 5 + 20);
  // Schlechter als zuvor: Sterne gehen nie verloren, Meilen werden nie abgezogen.
  const schlechter = meilenFuer(w1, 1, { 'w1-01': 3 }, 0);
  assert.equal(schlechter.neueSterne, 0);
  assert.equal(schlechter.summe, 5);
});

test('Meilen: nicht geschafft bringt nichts und zählt nicht als Wiederholung', () => {
  const m = meilenFuer(w1, 0, { 'w1-01': 2 }, 0);
  assert.equal(m.summe, 0);
  assert.equal(m.zaehltAlsWiederholung, false);
});

test('Meilen: nur die ersten zehn Wiederholungen am Tag', () => {
  assert.equal(meilenFuer(w1, 1, { 'w1-01': 1 }, MEILEN.wiederholungenJeTag - 1).wiederholung, 5);
  const elfte = meilenFuer(w1, 1, { 'w1-01': 1 }, MEILEN.wiederholungenJeTag);
  assert.equal(elfte.wiederholung, 0);
  assert.equal(elfte.zaehltAlsWiederholung, false);
});

/** Eine gedachte vollständige Welt 2 aus 15 Kopien von w1-01 — unabhängig vom echten Katalog. */
function vollWelt(): Level[] {
  return Array.from({ length: 15 }, (_, i) => ({ ...w1, welt: 2, nr: i + 1, id: `w2-${String(i + 1).padStart(2, '0')}` }));
}

test('Weltbonus: eine erst teilweise gelieferte Welt gilt nie als geschafft', () => {
  // Ein Katalog, in dem Welt 1 nur 10 von 15 Leveln hat (so lag er bis zur Aufgabe 8e3c72af vor):
  // alle mit drei Sternen bringt trotzdem keinen Bonus, sonst gäbe es ihn dann und für die fünf
  // nachgelieferten nichts mehr.
  const teilweise = LEVELS.filter((l) => l.welt === 1 && l.nr <= 10);
  const alleDrei = Object.fromEntries(teilweise.map((l) => [l.id, 3]));
  assert.equal(weltErfuellt(1, alleDrei, 1, teilweise), false);
  const ohneLetztes = { ...alleDrei, 'w1-10': 0 };
  const m = meilenFuer(levelNach('w1-10')!, 3, ohneLetztes, 0, teilweise);
  assert.equal(m.welt, 0);
  assert.equal(m.weltAlleSterne, 0);
});

test('Weltbonus: der echte Katalog hat drei vollständige Welten', () => {
  const alleDrei = Object.fromEntries(LEVELS.map((l) => [l.id, 3]));
  for (const w of [1, 2, 3]) assert.equal(weltErfuellt(w, alleDrei, 3), true, `Welt ${w}`);
  // Fehlt ein einziges Level, gibt es den Bonus nicht.
  assert.equal(weltErfuellt(2, { ...alleDrei, 'w2-15': 0 }, 1), false);
  // Das letzte Level von Welt 1 löst den Bonus aus, wenn die vierzehn davor geschafft sind.
  const m = meilenFuer(levelNach('w1-15')!, 3, { ...alleDrei, 'w1-15': 0 }, 0);
  assert.equal(m.welt, MEILEN.weltGeschafft);
  assert.equal(m.weltAlleSterne, MEILEN.weltAlleSterne);
});

test('Weltbonus: letztes Level einer vollständigen Welt bringt 100 Meilen und 50 Münzen, alle 45 Sterne 200', () => {
  const welt = vollWelt();
  const letztes = welt[14];
  const vierzehn = Object.fromEntries(welt.slice(0, 14).map((l) => [l.id, 3]));
  const r = werte(letztes, { geschafft: true, punkte: drei, hilfsmittel: [] }, { sterne: vierzehn, wiederholungenHeute: 0, muenzenHeute: 0, muenzenOffen: 0 }, welt);
  assert.equal(r.meilen.welt, MEILEN.weltGeschafft);
  assert.equal(r.meilen.weltAlleSterne, MEILEN.weltAlleSterne);
  assert.equal(r.meilen.summe, 30 + 30 + 100 + 200);
  assert.equal(r.muenzen.welt, FLYINGBRO_WELT_MUENZEN);

  // Mit einem Stern geschafft: Weltbonus ja, Sternbonus nein — der kommt später, einmal.
  const einer = werte(letztes, { geschafft: true, punkte: 0, hilfsmittel: [] }, { sterne: vierzehn, wiederholungenHeute: 0, muenzenHeute: 0, muenzenOffen: 0 }, welt);
  assert.equal(einer.meilen.welt, MEILEN.weltGeschafft);
  assert.equal(einer.meilen.weltAlleSterne, 0);
  const spaeter = meilenFuer(letztes, 3, { ...vierzehn, [letztes.id]: 1 }, 0, welt);
  assert.equal(spaeter.welt, 0, 'der Weltbonus kommt nur einmal');
  assert.equal(spaeter.weltAlleSterne, MEILEN.weltAlleSterne);
});

test('Meilen: ein ganzer Durchlauf (3 Welten à 15) bringt 3 600 — die Zahl, an der die Shoppreise hängen', () => {
  let summe = 0;
  for (const w of [1, 2, 3]) {
    const welt = vollWelt().map((l) => ({ ...l, welt: w, id: `w${w}-${String(l.nr).padStart(2, '0')}` }));
    let stand: Record<string, number> = {};
    for (const l of welt) {
      summe += meilenFuer(l, 3, stand, 0, welt).summe;
      stand = { ...stand, [l.id]: 3 };
    }
  }
  assert.equal(summe, 3600);
});

// ---------------------------------------------------------------------------

test('Münzen: 2 je neuem Stern, höchstens 6 je Level', () => {
  assert.deepEqual(muenzenFuer({ neueSterne: 1, heuteSchon: 0, offen: 0, weltNeuGeschafft: false }), { gutschrift: 2, welt: 0, offen: 0 });
  assert.deepEqual(muenzenFuer({ neueSterne: 3, heuteSchon: 0, offen: 0, weltNeuGeschafft: false }), { gutschrift: 6, welt: 0, offen: 0 });
  assert.deepEqual(muenzenFuer({ neueSterne: 9, heuteSchon: 0, offen: 0, weltNeuGeschafft: false }).gutschrift, 6);
  assert.deepEqual(muenzenFuer({ neueSterne: 0, heuteSchon: 0, offen: 0, weltNeuGeschafft: false }).gutschrift, 0);
});

test('Münzen: Tageskappe 40, der Rest bleibt offen und wird nachgezahlt', () => {
  const heute = muenzenFuer({ neueSterne: 3, heuteSchon: FLYINGBRO_MAX_PRO_TAG - 2, offen: 0, weltNeuGeschafft: false });
  assert.deepEqual(heute, { gutschrift: 2, welt: 0, offen: 4 });
  const voll = muenzenFuer({ neueSterne: 3, heuteSchon: FLYINGBRO_MAX_PRO_TAG, offen: 4, weltNeuGeschafft: false });
  assert.deepEqual(voll, { gutschrift: 0, welt: 0, offen: 10 });
  // Am nächsten Tag: offen kommt mit, auch ohne neuen Stern.
  assert.deepEqual(muenzenFuer({ neueSterne: 0, heuteSchon: 0, offen: 10, weltNeuGeschafft: false }), { gutschrift: 10, welt: 0, offen: 0 });
});

test('Münzen: Weltbonus außerhalb der Tageskappe', () => {
  const r = muenzenFuer({ neueSterne: 1, heuteSchon: FLYINGBRO_MAX_PRO_TAG, offen: 0, weltNeuGeschafft: true });
  assert.equal(r.gutschrift, 0);
  assert.equal(r.welt, FLYINGBRO_WELT_MUENZEN);
});

test('Münzen: die Lebenssumme ist gedeckelt (135 Sterne × 2 + 3 Welten × 50 = 420)', () => {
  assert.equal(3 * 15 * 3 * FLYINGBRO_MUENZEN_JE_STERN + 3 * FLYINGBRO_WELT_MUENZEN, 420);
});

// ---------------------------------------------------------------------------

test('werte(): Sterne, Meilen und Münzen in einem Aufruf', () => {
  const r = werte(w1, { geschafft: true, punkte: drei, hilfsmittel: [] }, { sterne: { 'w1-01': 1 }, wiederholungenHeute: 0, muenzenHeute: 0, muenzenOffen: 0 });
  assert.equal(r.sterne, 3);
  assert.equal(r.besteSterne, 3);
  assert.equal(r.neueSterne, 2);
  assert.equal(r.meilen.summe, 5 + 20);
  assert.deepEqual(r.muenzen, { gutschrift: 4, welt: 0, offen: 0 });
});

test('werte(): wiederholen ohne neuen Stern bringt keine Münzen', () => {
  const r = werte(w1, { geschafft: true, punkte: drei, hilfsmittel: [] }, { sterne: { 'w1-01': 3 }, wiederholungenHeute: 0, muenzenHeute: 0, muenzenOffen: 0 });
  assert.equal(r.neueSterne, 0);
  assert.equal(r.muenzen.gutschrift, 0);
  assert.equal(r.meilen.summe, 5);
});
