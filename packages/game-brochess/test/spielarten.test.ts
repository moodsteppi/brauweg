/**
 * Spielarten von BroChess (seit dem 28.11.2026) — vor allem „Spezial":
 * `modus: 'zufall'` muss beim Partiebau zu EINEM echten Modus werden, sonst
 * spielte die Karte klassisches Schach und niemand merkte es.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brochess } from '../src/adapter.js';
import { erstellePartie } from '../src/partie.js';
import { type BroChessRegeln, ZUFALLS_MODI, modusVon, pruefeRegeln, zufallAufgeloest } from '../src/regeln.js';

const spezial = brochess.meta.spielarten!.find((a) => a.id === 'spezial')!.config as BroChessRegeln;

test('jede Spielart besteht die Regelpruefung und hat eine Uhr', () => {
  for (const art of brochess.meta.spielarten!) {
    const regeln = art.config as BroChessRegeln;
    assert.deepEqual(pruefeRegeln(regeln, 2, 1), [], art.id);
    assert.ok((regeln.bedenkzeitMs ?? 0) >= 60_000, `${art.id} ohne Uhr`);
  }
});

test('Spezial zieht beim Partiebau einen Spezialmodus aus der Saat', () => {
  const gezogen = new Set<string>();
  for (let saat = 0; saat < 200; saat += 1) {
    const partie = erstellePartie(spezial, saat);
    const modus = modusVon(partie.regeln);
    assert.ok(ZUFALLS_MODI.includes(modus), `Saat ${saat}: ${modus}`);
    assert.notEqual(partie.regeln.modus, 'zufall');
    gezogen.add(modus);
  }
  // Jeder Modus kommt vor — sonst hinge der Zug an einem Teil der Saat.
  assert.deepEqual([...gezogen].sort(), [...ZUFALLS_MODI].sort());
});

test('dieselbe Saat zieht denselben Modus, die Uhr bleibt', () => {
  const a = zufallAufgeloest(spezial, 77);
  const b = zufallAufgeloest(spezial, 77);
  assert.equal(a.modus, b.modus);
  assert.equal(a.bedenkzeitMs, spezial.bedenkzeitMs);
});

test('ein Regelsatz ohne zufall bleibt unberuehrt', () => {
  const normal: BroChessRegeln = { modus: 'huegel' };
  assert.equal(zufallAufgeloest(normal, 5), normal);
  assert.equal(modusVon({ modus: 'zufall' }), 'normal');
});
