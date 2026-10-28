import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wuerfelglanz, punkte, stand, erstelle, handeln, ausstieg, erlaubt, sicht, bot, platzierungen, KATEGORIEN, type Partie, type Bogen } from '../src/index.js';

test('alle 13 Kategorien, Straßen mit doppelten Werten und eindeutiges volles Haus', () => {
  assert.equal(punkte([1, 1, 3, 4, 6], 'eins'), 2);
  assert.equal(punkte([6, 6, 6, 6, 1], 'dreierpasch'), 25);
  assert.equal(punkte([6, 6, 6, 6, 1], 'viererpasch'), 25);
  assert.equal(punkte([2, 2, 3, 3, 3], 'volleshaus'), 25);
  assert.equal(punkte([2, 2, 2, 2, 2], 'volleshaus'), 0);
  assert.equal(punkte([1, 2, 2, 3, 4], 'kleinestrasse'), 30);
  assert.equal(punkte([3, 4, 4, 5, 6], 'kleinestrasse'), 30);
  assert.equal(punkte([1, 2, 3, 4, 5], 'grossestrasse'), 40);
  assert.equal(punkte([6, 5, 4, 3, 2], 'grossestrasse'), 40);
  assert.equal(punkte([1, 2, 2, 3, 4], 'grossestrasse'), 0);
  assert.equal(punkte([5, 5, 5, 5, 5], 'fuenferglanz'), 50);
  assert.equal(punkte([1, 2, 3, 4, 6], 'chance'), 16);
  assert.throws(() => punkte([0, 2, 3, 4, 6], 'chance'));
  assert.throws(() => punkte([1, 2, 3, 4, 6], '__proto__' as never));
});
test('Bonus erst ab 63, ohne doppelte Addition', () => {
  const b: Bogen = { eins: 3, zwei: 6, drei: 9, vier: 12, fuenf: 15, sechs: 18 };
  assert.deepEqual(stand(b), { oben: 63, bonus: 35, gesamt: 98, felder: 6 });
  assert.equal(stand({ ...b, sechs: 17 }).bonus, 0);
  assert.equal(stand({ ...b, chance: 30 }).gesamt, 128);
});
test('halten und lösen, drei Würfe, feste Felder und unveränderliche Eingaben', () => {
  const p = erstelle(2, 7); const vorher = structuredClone(p);
  assert.throws(() => handeln(p, 0, { art: 'halten', index: 0 }));
  assert.throws(() => handeln(p, 0, { art: 'eintragen', kategorie: 'chance' }));
  assert.throws(() => handeln(p, 1, { art: 'wuerfeln' }));
  let q = handeln(p, 0, { art: 'wuerfeln' }); const w = q.wuerfel[0];
  q = handeln(q, 0, { art: 'halten', index: 0 });
  q = handeln(q, 0, { art: 'wuerfeln' }); assert.equal(q.wuerfel[0], w);
  q = handeln(q, 0, { art: 'halten', index: 0 }); assert.equal(q.gehalten[0], false);
  q = handeln(q, 0, { art: 'wuerfeln' }); assert.throws(() => handeln(q, 0, { art: 'wuerfeln' }));
  q = handeln(q, 0, { art: 'eintragen', kategorie: 'chance' }); assert.equal(q.amZug, 1); assert.equal(q.wurf, 0);
  q = handeln(q, 1, { art: 'wuerfeln' }); q = handeln(q, 1, { art: 'eintragen', kategorie: 'chance' });
  q = handeln(q, 0, { art: 'wuerfeln' }); assert.throws(() => handeln(q, 0, { art: 'eintragen', kategorie: 'chance' }));
  assert.deepEqual(p, vorher);
});
test('kein Würfeln mit fünf gehaltenen Würfeln und keine manipulierten Aktionen', () => {
  let p = handeln(erstelle(1, 10), 0, { art: 'wuerfeln' });
  for (let i = 0; i < 5; i++) p = handeln(p, 0, { art: 'halten', index: i });
  assert.ok(!erlaubt(p, 0).some(a => a.art === 'wuerfeln'));
  assert.throws(() => handeln(p, 0, { art: 'wuerfeln' }));
  for (const index of [-1, 5, 1.5, NaN, Infinity]) assert.throws(() => handeln(p, 0, { art: 'halten', index }));
  assert.throws(() => handeln(p, 0, null as never));
  assert.throws(() => handeln(p, 0, { art: 'eintragen', kategorie: '__proto__' } as never));
});
test('reproduzierbare Würfe, private Zufallsbasis und Snapshot-Fortsetzung', () => {
  const hex = 'aabbccddeeff11223344556677889900';
  let a = erstelle(2, 42, hex), b = erstelle(2, 42, hex);
  a = handeln(a, 0, { art: 'wuerfeln' }); b = handeln(b, 0, { art: 'wuerfeln' }); assert.deepEqual(a, b);
  const v = sicht(a, 0); assert.equal('zufall' in v, false); assert.ok(!JSON.stringify(v).includes(hex));
  assert.equal(sicht(a, null).ich, null); assert.deepEqual(erlaubt(a, -1), []);
  const wieder = wuerfelglanz.deserialize(JSON.parse(JSON.stringify(wuerfelglanz.serialize(a))));
  assert.deepEqual(handeln(wieder, 0, { art: 'wuerfeln' }), handeln(a, 0, { art: 'wuerfeln' }));
  assert.notDeepEqual(handeln(erstelle(2, 42, '1122334455667788aabbccddeeff9900'), 0, { art: 'wuerfeln' }).wuerfel, a.wuerfel);
});
test('Solo bis sechs Spieler: Bots beenden jeden Bogen mit gültigen Zügen', () => {
  for (let sitze = 1; sitze <= 6; sitze++) for (let seed = 0; seed < 8; seed++) {
    let p = erstelle(sitze, seed), schritte = 0;
    while (!p.fertig && schritte++ < 1500) {
      const a = bot(sicht(p, p.amZug), seed % 2 ? 'anfaenger' : 'genie');
      assert.ok(erlaubt(p, p.amZug).some(x => JSON.stringify(x) === JSON.stringify(a)));
      p = handeln(p, p.amZug, a);
      if (p.wurf > 0) assert.ok(p.wuerfel.every(n => n >= 1 && n <= 6));
    }
    assert.equal(p.fertig, true); assert.ok(p.boegen.every(b => Object.keys(b).length === 13));
    assert.equal(platzierungen(p).length, sitze);
    assert.throws(() => handeln(p, p.amZug, { art: 'wuerfeln' }));
    const meldung = platzierungen(p)[0] as { bestleistungen?: { wert: number }[] };
    assert.ok(meldung.bestleistungen?.[0]?.wert !== undefined);
  }
});
test('Aussteiger werden übersprungen, Gleichstand teilt den Platz und Solo gibt keine Wettkampfgewinne vor', () => {
  let p = ausstieg(erstelle(3, 4), 0); assert.equal(p.amZug, 1); assert.equal(p.fertig, false);
  p = ausstieg(p, 2); assert.equal(p.fertig, true); assert.equal(platzierungen(p)[0]!.seat, 1);
  const q: Partie = { ...erstelle(3, 1), fertig: true, boegen: [{ chance: 10 }, { chance: 10 }, { chance: 5 }] };
  assert.deepEqual(platzierungen(q).map(s => s.place), [1, 1, 3]);
  assert.equal(ausstieg(erstelle(1, 1), 0).fertig, true);
  assert.equal(KATEGORIEN.length, 13);
  assert.equal(wuerfelglanz.validateConfig({}, 1, 1).length, 0);
  for (const [c, n, r] of [[null, 1, 1], [{ a: 1 }, 1, 1], [{}, 7, 1], [{}, 2, 13]] as const) assert.ok(wuerfelglanz.validateConfig(c, n, r).length > 0);
});
