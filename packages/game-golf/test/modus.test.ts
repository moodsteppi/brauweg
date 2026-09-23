import assert from 'node:assert/strict';
import { test } from 'node:test';

import { golf, modusVon, pruefeModus, zaehltFuerBestleistung } from '../src/index.js';

/*
 * Der Fun-Modus als Regeloption (seit dem 23.09.2026, modus.ts). Das Modul
 * kennt nur den Namen; was er bewirkt, rechnet der Client.
 */

const start = (config: unknown) =>
  golf.createParty({ config: config as never, seats: 2, rounds: 4, seed: 4711 });

test('ohne Angabe ist ein Tisch klassisch — auch jeder von vor dem Fun-Modus', () => {
  assert.equal(modusVon({}), 'klassisch');
  assert.equal(modusVon(undefined), 'klassisch');
  assert.equal(golf.viewFor(start({}), 0).modus, 'klassisch');
  assert.deepEqual(golf.validateConfig({}, 2, 4), []);
});

test('fun steht in der Sicht, damit jedes Gerät die Modifikatoren selbst zieht', () => {
  const partie = start({ modus: 'fun' });
  assert.equal(golf.viewFor(partie, 0).modus, 'fun');
  assert.equal(golf.spectatorView?.(partie).modus, 'fun');
  assert.deepEqual(golf.validateConfig({ modus: 'fun' }, 2, 4), []);
});

test('unbekannte Spielarten weist validateConfig ab, ohne zu werfen', () => {
  for (const modus of ['wild', 42, null, [], {}, true]) {
    const probleme = golf.validateConfig({ modus }, 2, 4);
    assert.deepEqual(
      probleme.map((p) => p.messageKey),
      ['ruleset.golf.modusUnbekannt'],
      `modus ${JSON.stringify(modus)}`,
    );
  }
  for (const unsinn of [null, 42, 'fun', [], undefined]) assert.deepEqual(pruefeModus(unsinn), []);
});

test('Modus und Bahnauswahl vertragen sich', () => {
  assert.deepEqual(golf.validateConfig({ modus: 'fun', kurs: 'einstieg' }, 2, 4).filter((p) => p.path === 'config.modus'), []);
});

test('der Haken für die Bestleistung: nur klassisch zählt', () => {
  assert.equal(zaehltFuerBestleistung({}), true);
  assert.equal(zaehltFuerBestleistung({ modus: 'klassisch' }), true);
  assert.equal(zaehltFuerBestleistung({ modus: 'fun' }), false);
});

test('ein Schnappschuss behält den Modus', () => {
  const partie = start({ modus: 'fun' });
  const zurueck = golf.deserialize(golf.serialize(partie));
  assert.equal(golf.viewFor(zurueck, 0).modus, 'fun');
});
