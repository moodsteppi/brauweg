import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type GolfAktion, RegelverstossError, golf } from '../src/index.js';

/*
 * Störschläge im Fun-Modus (seit dem 23.09.2026, Teil 3/3): Auslösen ist ein
 * ZUG wie ein Schlag, nur mit `art: 'ausloesen'`. Das Modul prüft die Form
 * und dass der Tisch im Fun-Modus spielt — ob der Sitz überhaupt einen
 * Störschlag hält, weiß wie beim Schlag nur der Spielkern auf den Geräten
 * (packages/client/src/minispiele/golf/stoerschlag.ts).
 */

const start = (config: unknown) =>
  golf.createParty({ config: config as never, seats: 2, rounds: 3, seed: 4711 });

function zug(takt: number, extra: Record<string, unknown> = {}): GolfAktion {
  return { art: 'zug', zug: { takt, nr: takt, rx: 0, ry: -1, kraft: 0.5, ...extra } } as GolfAktion;
}

test('im Fun-Modus steht ein Auslöse-Zug in der Zugliste wie ein Schlag', () => {
  let p = start({ modus: 'fun' });
  p = golf.act(p, 0, zug(10));
  p = golf.act(p, 0, zug(20, { art: 'ausloesen' }));
  const sicht = golf.viewFor(p, 1);
  assert.deepEqual(
    sicht.zuege.map((z) => z.art ?? 'schlag'),
    ['schlag', 'ausloesen'],
  );
  // Ein Schlag trägt kein `art` — Byte für Byte wie vor dem 23.09.2026.
  assert.equal('art' in sicht.zuege[0]!, false);
  // Die Takte steigen weiter gemeinsam über Schläge und Auslöser.
  assert.throws(() => golf.act(p, 0, zug(20)), RegelverstossError);
});

test('klassisch weist der Server einen Auslöse-Zug an der Tür ab', () => {
  for (const config of [{}, { modus: 'klassisch' }]) {
    const p = start(config);
    assert.throws(
      () => golf.act(p, 0, zug(5, { art: 'ausloesen' })),
      (f: unknown) => f instanceof RegelverstossError && f.message === 'ausloesenNurImFunModus',
    );
    // Ein Schlag geht dort weiter wie immer.
    assert.equal(golf.act(p, 0, zug(5)).zuege.length, 1);
  }
});

test('Unsinn als Zugtyp weist validateMove ab — im Fun-Modus wie klassisch', () => {
  const p = start({ modus: 'fun' });
  for (const art of ['bombe', 'schlag', '', 0, 1, null, true, {}, ['ausloesen']]) {
    assert.throws(
      () => golf.act(p, 0, zug(5, { art })),
      (f: unknown) => f instanceof RegelverstossError && f.message === 'zugArtUnbekannt',
      `art ${JSON.stringify(art)}`,
    );
  }
});

test('ein Auslöse-Zug braucht dieselbe Form wie ein Schlag', () => {
  const p = start({ modus: 'fun' });
  const kaputt: Record<string, unknown>[] = [
    { rx: 0, ry: 0 },
    { rx: 2, ry: 0 },
    { kraft: 0 },
    { kraft: 1.5 },
    { kraft: Number.NaN },
    { takt: -1 },
    { nr: 0.5 },
  ];
  for (const teil of kaputt) {
    assert.throws(() => golf.act(p, 0, zug(5, { art: 'ausloesen', ...teil })), RegelverstossError, JSON.stringify(teil));
  }
});

test('der Schnappschuss behält den Zugtyp', () => {
  let p = start({ modus: 'fun' });
  p = golf.act(p, 1, zug(30, { art: 'ausloesen' }));
  const zurueck = golf.deserialize(golf.serialize(p));
  assert.equal(zurueck.zuege[0]!.art, 'ausloesen');
});

test('ab Version 9: Ein Client von davor läse einen Auslöse-Zug als Schlag', () => {
  assert.ok(golf.protocolVersion >= 9);
});
