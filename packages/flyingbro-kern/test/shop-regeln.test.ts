/**
 * Shop-Katalog und die festen Zahlen der Bros, Stoffe und Treffer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  abschussTempo,
  BRO_WERTE,
  broFreigeschaltet,
  broMasse,
  giraffeUmgefallen,
  HILFSMITTEL_KATALOG,
  KATALOG,
  kaufe,
  kontaktSchaden,
  neuerShopStand,
  schadensFaktor,
  setzeEin,
  trefferPunkte,
  TREFFERPUNKTE_MAX_JE_ZIEL,
  ZIERDE_KATALOG,
} from '../src/index.js';

test('Katalog: Preise wie in der Spezifikation, Kennungen eindeutig', () => {
  assert.deepEqual(
    HILFSMITTEL_KATALOG.map((a) => [a.id, a.preis]),
    [
      ['fernrohr', 40],
      ['bauplan', 60],
      ['ersatz-pelle', 80],
    ],
  );
  assert.equal(new Set(KATALOG.map((a) => a.id)).size, KATALOG.length);
  const jeGruppe = (g: string) => ZIERDE_KATALOG.filter((a) => a.gruppe === g);
  assert.equal(jeGruppe('schleuderband').length, 6);
  assert.equal(jeGruppe('flugspur').length, 3);
  assert.equal(jeGruppe('siegerpose').length, 2);
  assert.equal(jeGruppe('kistenmotiv').length, 3);
  assert.equal(ZIERDE_KATALOG.length, 14);
});

test('Katalog: die ganze Zierde kostet das Dreifache eines Durchlaufs (10 800 gegen 3 600 Meilen)', () => {
  // Wer Preise oder Einnahmen ändert, rechnet die Spezifikation („Shop im Spiel") nach —
  // der Durchlauf selbst ist in wertung.test.ts gerechnet.
  assert.equal(ZIERDE_KATALOG.reduce((s, a) => s + a.preis, 0), 10_800);
});

test('Kauf: Hilfsmittel stapeln, Zierde einmal, Meilen reichen oder nicht', () => {
  const start = neuerShopStand();
  assert.deepEqual(start.vorrat, { fernrohr: 2, bauplan: 0, 'ersatz-pelle': 1 }, 'Startgeschenk');
  assert.deepEqual(kaufe(start, 'fernrohr'), { ok: false, grund: 'zu_teuer' });
  assert.deepEqual(kaufe(start, 'goldbarren'), { ok: false, grund: 'unbekannt' });

  const reich = { ...start, meilen: 1000 };
  const a = kaufe(reich, 'fernrohr');
  assert.ok(a.ok);
  assert.equal(a.stand.meilen, 960);
  assert.equal(a.stand.vorrat.fernrohr, 3);
  assert.equal(reich.vorrat.fernrohr, 2, 'der alte Stand bleibt unverändert');

  const b = kaufe(a.stand, 'schleuderband-rot');
  assert.ok(b.ok);
  assert.equal(b.stand.meilen, 560);
  assert.deepEqual(b.stand.zierde, ['schleuderband-rot']);
  assert.deepEqual(kaufe(b.stand, 'schleuderband-rot'), { ok: false, grund: 'schon_gekauft' });
});

test('Einsatz: je Sorte einmal, nur aus dem Vorrat', () => {
  const v = neuerShopStand().vorrat;
  const r = setzeEin(v, ['fernrohr', 'ersatz-pelle']);
  assert.ok(r.ok);
  assert.deepEqual(r.vorrat, { fernrohr: 1, bauplan: 0, 'ersatz-pelle': 0 });
  assert.deepEqual(setzeEin(v, ['fernrohr', 'fernrohr']), { ok: false, grund: 'doppelt' });
  assert.deepEqual(setzeEin(v, ['bauplan']), { ok: false, grund: 'nicht_im_vorrat' });
  assert.deepEqual(setzeEin(v, ['flossenpaddel']), { ok: false, grund: 'unbekannt' });
  assert.deepEqual(setzeEin(v, []), { ok: true, vorrat: v });
});

// ---------------------------------------------------------------------------

test('Bros: Massen aus Radius und Dichte wie in der Tabelle', () => {
  assert.equal(broMasse('pelle').toFixed(2), '0.57');
  assert.equal(broMasse('malve').toFixed(2), '0.37');
  assert.equal(broMasse('tjark').toFixed(2), '0.68');
});

test('Bros: Freischaltung Malve ab w1-06, Tjark ab w2-01', () => {
  assert.ok(broFreigeschaltet('pelle', 1, 1));
  assert.ok(!broFreigeschaltet('malve', 1, 5));
  assert.ok(broFreigeschaltet('malve', 1, 6));
  assert.ok(!broFreigeschaltet('tjark', 1, 15));
  assert.ok(broFreigeschaltet('tjark', 2, 1));
  assert.ok(broFreigeschaltet('tjark', 3, 1));
});

test('Abschuss: Zugweg / 2,4 × Höchsttempo, unter 0,3 m kein Schuss, über 2,4 m gedeckelt', () => {
  assert.equal(abschussTempo('pelle', 0.29), null);
  assert.equal(abschussTempo('pelle', 1.2), 11);
  assert.equal(abschussTempo('malve', 2.4), 24);
  assert.equal(abschussTempo('tjark', 9), 20);
  assert.equal(abschussTempo('pelle', Number.NaN), null);
});

test('Schaden: Schwelle 2, ×10, Faktor nur mit ausgelöster Fähigkeit', () => {
  assert.equal(kontaktSchaden(2, 1), 0);
  assert.equal(kontaktSchaden(1, 1), 0);
  assert.equal(kontaktSchaden(4, 1), 20);
  assert.equal(schadensFaktor('pelle', 'holz', false), 1);
  assert.equal(schadensFaktor('pelle', 'holz', true), 1.5);
  assert.equal(schadensFaktor('malve', 'glas', true), 2);
  assert.equal(schadensFaktor('tjark', 'stein', true), 2.5);
  assert.equal(schadensFaktor('tjark', 'glas', true), 0.5);
  assert.equal(schadensFaktor(null, 'stein', true), 1, 'Bauteil gegen Bauteil');
  assert.equal(schadensFaktor('tjark', 'giraffe', true), 1, 'Giraffen nehmen Schaden mit Faktor 1');
  for (const b of Object.values(BRO_WERTE)) assert.equal(Object.keys(b.faktorMitFaehigkeit).length, 3);
});

test('Treffer: über 5 Schaden 10 Punkte, höchstens 5 je Ziel', () => {
  assert.equal(trefferPunkte(5, 0), 0);
  assert.equal(trefferPunkte(5.1, 0), 10);
  assert.equal(trefferPunkte(100, 4), 10);
  assert.equal(trefferPunkte(100, 5), 0);
  let summe = 0;
  for (let i = 0; i < 20; i++) summe += trefferPunkte(50, summe / 10);
  assert.equal(summe, TREFFERPUNKTE_MAX_JE_ZIEL);
});

test('Giraffe umgefallen: Haltbarkeit 0, länger als 0,5 s gelegen, mehr als 1,5 m gefallen', () => {
  const steht = { haltbarkeit: 10, liegtSeitS: 0, y: 2, hoechstesY: 2 };
  assert.equal(giraffeUmgefallen(steht), false);
  assert.equal(giraffeUmgefallen({ ...steht, haltbarkeit: 0 }), true);
  assert.equal(giraffeUmgefallen({ ...steht, liegtSeitS: 0.5 }), false);
  assert.equal(giraffeUmgefallen({ ...steht, liegtSeitS: 0.51 }), true);
  assert.equal(giraffeUmgefallen({ ...steht, y: 0.5 }), false);
  assert.equal(giraffeUmgefallen({ ...steht, y: 0.49 }), true);
});
