import { test } from 'node:test';
import assert from 'node:assert/strict';

import { easypoker } from '../src/adapter.js';
import { DEFAULT_REGELN } from '../src/regeln.js';
import type { EasyPokerPartie } from '../src/partie.js';

function neu(seed = 4711, rounds = 4): EasyPokerPartie {
  return easypoker.createParty({ config: DEFAULT_REGELN, seats: 2, rounds, seed });
}

test('die Beschreibung passt zur Plattform', () => {
  assert.equal(easypoker.meta.id, 'easypoker');
  assert.equal(easypoker.meta.availability, 'playable');
  assert.deepEqual([...easypoker.meta.seatCounts], [2]);
  // Der Knopf wandert jede Hand: Die Plattform verlangt daraufhin eine gerade
  // Handzahl, damit beide gleich oft in Position sind.
  assert.equal(easypoker.meta.rotationSize(2), 2);
  assert.equal(easypoker.meta.xpBasisZaehltKarten, false);
});

test('der Regelsatz wird gegen Spielerzahl und Unsinn geprueft', () => {
  assert.deepEqual(easypoker.validateConfig(DEFAULT_REGELN, 2, 4), []);
  assert.ok(easypoker.validateConfig(DEFAULT_REGELN, 3, 4).length > 0);
  assert.ok(easypoker.validateConfig({ startJetons: 5 }, 2, 4).length > 0);
  assert.ok(easypoker.validateConfig('unsinn', 2, 4).length > 0);
});

/**
 * Der Kern des Ganzen: Die Sicht darf die Karten des Gegners nicht enthalten
 * — auch nicht versteckt in einem Feld, das der Client "eigentlich nicht
 * anzeigt". Geprueft wird deshalb der ganze serialisierte Text.
 */
test('die Sicht enthaelt die Karten des Gegners nicht', () => {
  const partie = neu();
  const sicht = easypoker.viewFor(partie, 0);
  const text = JSON.stringify(sicht);

  assert.equal(sicht.meineKarten.length, 2);
  assert.equal(sicht.gegnerKarten, null);
  assert.equal(sicht.gegnerVerdeckt, 2);

  for (const karte of partie.hand[1] ?? []) {
    assert.ok(
      !text.includes(`"id":${karte.id}`),
      `Karte ${karte.farbe}${karte.wert} des Gegners steht in der Sicht`,
    );
  }
});

test('die Sicht verraet weder Saat noch Reststapel', () => {
  const text = JSON.stringify(easypoker.viewFor(neu(), 0));
  assert.ok(!text.includes('saat'), 'mit der Saat liesse sich jede kommende Karte berechnen');
  assert.ok(!text.includes('reststapel'));
});

test('Zuschauer sehen ueberhaupt keine Hand', () => {
  const sicht = easypoker.spectatorView(neu());
  assert.equal(sicht.zuschauer, true);
  assert.deepEqual([...sicht.meineKarten], []);
  assert.equal(sicht.gegnerKarten, null);
  assert.equal(sicht.setzKosten, null);
});

test('der Bot laeuft nicht auf einer Zuschauersicht', () => {
  assert.throws(() => easypoker.botAction(easypoker.spectatorView(neu())), /Zuschauersicht/);
});

test('die eigene Staerke kommt erst mit dem Flop', () => {
  const partie = neu();
  assert.equal(easypoker.viewFor(partie, 0).meineStaerke, null, 'zwei Karten sind keine Hand');
});

/**
 * Der wichtigste Dauerlauf: Zwei Bots spielen ganze Partien gegeneinander.
 * Jeder Zug muss erlaubt sein, keine Partie darf haengen bleiben, und die
 * Summe der Jetons darf sich nie aendern.
 */
test('zwei Bots spielen hundert Partien zu Ende, jeder Zug erlaubt', () => {
  for (let seed = 0; seed < 100; seed++) {
    let partie = neu(seed, 6);
    let schritte = 0;
    while (!easypoker.isFinished(partie) && schritte++ < 4000) {
      const sitz = easypoker.currentActor(partie);
      if (sitz === null) {
        const ms = easypoker.interludeMs!(partie);
        assert.notEqual(ms, null, `Seed ${seed}: niemand am Zug und keine Pause`);
        partie = easypoker.advanceInterlude!(partie);
        continue;
      }
      const erlaubt = easypoker.legalActions(partie, sitz);
      const zug = easypoker.botAction(easypoker.viewFor(partie, sitz), 'standard');
      assert.ok(
        erlaubt.some((e) => JSON.stringify(e) === JSON.stringify(zug)),
        `Seed ${seed}: Botzug ${JSON.stringify(zug)} steht nicht in ${JSON.stringify(erlaubt)}`,
      );
      partie = easypoker.act(partie, sitz, zug);
    }
    assert.ok(easypoker.isFinished(partie), `Seed ${seed}: Partie blieb haengen`);
    const summe = (partie.jetons[0] ?? 0) + (partie.jetons[1] ?? 0);
    assert.equal(summe, DEFAULT_REGELN.startJetons * 2, `Seed ${seed}: Jetons stimmen nicht`);
  }
});

test('alle vier Spielstaerken spielen gueltig', () => {
  for (const level of ['anfaenger', 'standard', 'experte', 'genie'] as const) {
    let partie = neu(2026, 4);
    let schritte = 0;
    while (!easypoker.isFinished(partie) && schritte++ < 2000) {
      const sitz = easypoker.currentActor(partie);
      if (sitz === null) {
        partie = easypoker.advanceInterlude!(partie);
        continue;
      }
      const zug = easypoker.botAction(easypoker.viewFor(partie, sitz), level);
      partie = easypoker.act(partie, sitz, zug);
    }
    assert.ok(easypoker.isFinished(partie), level);
  }
});

test('Platzierungen und Erfahrungsgrundlage stehen am Ende', () => {
  let partie = neu(7, 4);
  while (!easypoker.isFinished(partie)) {
    const sitz = easypoker.currentActor(partie);
    if (sitz === null) {
      partie = easypoker.advanceInterlude!(partie);
      continue;
    }
    partie = easypoker.act(partie, sitz, easypoker.botAction(easypoker.viewFor(partie, sitz)));
  }
  const stand = easypoker.standings(partie);
  assert.equal(stand.length, 2);
  assert.equal(stand[0]!.place, 1);

  const xp = easypoker.xpBasis!(partie);
  assert.equal(xp[0], partie.abgeschlossen * 2);
  assert.equal(xp[1], partie.abgeschlossen * 2);
});

test('ein verlassener Sitz laesst die Partie weiterlaufen', () => {
  const partie = easypoker.markLeft(neu(), 1);
  assert.deepEqual([...partie.leftSeats], [1]);
  assert.equal(easypoker.standings(partie).find((s) => s.seat === 1)?.left, true);
});

test('der Snapshot ueberlebt einen Neustart', () => {
  const partie = neu(1234);
  const zurueck = easypoker.deserialize(JSON.parse(JSON.stringify(easypoker.serialize(partie))));
  assert.deepEqual(zurueck, partie);
});

test('ein Snapshot aus einer fremden Fassung faellt auf', () => {
  const roh = { ...(easypoker.serialize(neu()) as Record<string, unknown>), v: 99 };
  assert.throws(() => easypoker.deserialize(roh), /Snapshot-Version/);
});

test('die Hexkette schlaegt den Zahlenseed', () => {
  const mitHex = easypoker.createParty({
    config: DEFAULT_REGELN,
    seats: 2,
    rounds: 4,
    seed: 1,
    seedHex: 'ffeeddccbbaa99887766554433221100',
  });
  const ohneHex = easypoker.createParty({
    config: DEFAULT_REGELN,
    seats: 2,
    rounds: 4,
    seed: 1,
  });
  assert.notDeepEqual(mitHex.hand, ohneHex.hand);
});
