/**
 * Spielarten des Doppelkopfs (seit dem 28.11.2026). Der Plattformtest im
 * Server prueft Kennung, Validator und Bot-Partie fuer jedes Modul; hier steht,
 * was nur fuer Doppelkopf gilt: was die einzelnen Spielarten AUSMACHT.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doppelkopf } from '../src/adapter.js';
import type { RuleSet } from '../src/ruleset.js';
import { validateRuleSet } from '../src/validator.js';

const arten = new Map(doppelkopf.meta.spielarten!.map((a) => [a.id, a.config as RuleSet & { variante: string }]));

test('vier Spielarten, Standard vorn, alle ohne Fehler im Validator', () => {
  assert.deepEqual([...arten.keys()], ['standard', 'anfaenger', 'normal', 'hart']);
  for (const [id, rs] of arten) {
    const fehler = validateRuleSet(rs).filter((i) => i.severity === 'error');
    assert.deepEqual(fehler, [], id);
    assert.equal(rs.variante, id);
    assert.equal(rs.tableSize, 4);
  }
});

test('Anfaenger: keine Ansagen, keine Sonderpunkte, Augen werden gezaehlt', () => {
  const rs = arten.get('anfaenger')!;
  assert.equal(rs.announcements, false);
  assert.equal(rs.absagen, false);
  assert.equal(rs.feigling, false);
  assert.equal(rs.pflichtansage, false);
  assert.equal(rs.bock, false);
  assert.equal(rs.countPoints, true);
  assert.equal(rs.deck, 'with9');
  assert.equal(rs.hochzeit && rs.armut, true);
  assert.equal(rs.spFuchsGefangen || rs.spKarlchen || rs.spDoppelkopf || rs.spCharlieGefangen || rs.spHerzdurchlauf, false);
});

test('Normal: Vorgabe ohne Fuchs, Karlchen und Doppelkopf', () => {
  const rs = arten.get('normal')!;
  assert.equal(rs.spFuchsGefangen || rs.spKarlchen || rs.spDoppelkopf, false);
  assert.equal(rs.announcements, true);
});

test('Hart: Standard plus alle Bock-Ausloeser, Schmeissen mit Bock, Solo-Feigling und -Pflichtansage', () => {
  const standard = arten.get('standard')!;
  const hart = arten.get('hart')!;
  assert.deepEqual([...hart.bockTriggers].sort(), ['lostRe', 'reAndKontra', 'schmeiss', 'solo', 'zeroResult']);
  assert.equal(hart.schmeissConsequence, 'redealAndBock');
  assert.equal(hart.feiglingSolo, true);
  assert.equal(hart.pflichtansageImSolo, true);
  // Sonst wie Standard.
  assert.equal(hart.deck, standard.deck);
  assert.equal(hart.pflichtsolo, standard.pflichtsolo);
});
