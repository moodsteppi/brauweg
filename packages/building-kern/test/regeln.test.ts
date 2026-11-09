import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bauteilfolge, FORMEN, rangfolge, zellen } from '../src/index.js';

test('jeder Siebenersack enthält alle Formen, gleiche Seeds liefern gleiche Folgen', () => {
  const a = bauteilfolge(17, 70);
  assert.deepEqual(a, bauteilfolge(17, 70));
  assert.notDeepEqual(a, bauteilfolge(18, 70));
  for (let i = 0; i < a.length; i += 7) assert.deepEqual([...a.slice(i, i + 7)].sort(), [...FORMEN].sort());
});
test('alle zusammengesetzten Bauteile haben vier verschiedene Zellen um ihren Schwerpunkt', () => {
  for (const f of FORMEN) {
    const z = zellen(f);
    assert.equal(new Set(z.map(p => `${p.x},${p.y}`)).size, 4);
    assert.equal(z.reduce((n, p) => n + p.x, 0), 0);
    assert.equal(z.reduce((n, p) => n + p.y, 0), 0);
  }
});
test('Rennen zählt Zielerreichung vor Höhe; Standfest zählt Leben; Gleichstand bleibt Gleichstand', () => {
  const s = [
    { id: 'a', hoehe: 19, leben: 1, gebaut: 10, aufgegeben: false },
    { id: 'b', hoehe: 17, leben: 3, gebaut: 9, aufgegeben: false },
    { id: 'c', hoehe: 17, leben: 3, gebaut: 9, aufgegeben: false },
    { id: 'd', hoehe: 22, leben: 3, gebaut: 20, aufgegeben: true },
  ];
  assert.equal(rangfolge(s, 'rennen')[0].id, 'a');
  assert.equal(rangfolge(s, 'rennen', ['b'])[0].id, 'b');
  assert.deepEqual(rangfolge(s, 'standfest').map(v => [v.id, v.platz]), [['b', 1], ['c', 1], ['a', 3], ['d', 4]]);
});
