import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyDelta, awardForParty, checkpointFor } from '../src/trophies.js';

const place = (seat: number, place: number, left = false) => ({ seat, place, left });

test('die Grundverteilung ist nullsummig', () => {
  for (const seats of [2, 3, 4, 5, 6]) {
    const placements = Array.from({ length: seats }, (_, i) => place(i, i + 1));
    const total = awardForParty(placements).reduce((sum, a) => sum + a.delta, 0);
    assert.equal(total, 0, `${seats} Sitze ergeben ${total} statt 0`);
  }
});

test('Zwei Sitze: der Sieger bekommt drei, der Verlierer gibt drei', () => {
  // Die Duelle (Filler, Eiland, Mememory zu zweit, Feldherr) liefen bis zum
  // 04.09.2026 ohne Trophaeen, weil es fuer zwei Sitze keine Verteilung gab.
  const awards = awardForParty([place(0, 1), place(1, 2)]);
  assert.deepEqual(
    awards.map((a) => [a.seat, a.delta]),
    [
      [0, 3],
      [1, -3],
    ],
  );
});

test('Zwei Sitze: ein Unentschieden ist fuer beide null', () => {
  // Feldherr meldet bei einer strittigen Partie beide auf Platz 1 — daraus
  // darf kein halber Pokal werden.
  const awards = awardForParty([place(0, 1), place(1, 1)]);
  assert.deepEqual(
    awards.map((a) => a.delta),
    [0, 0],
  );
  assert.ok(awards.every((a) => Number.isInteger(a.delta)));
});

test('Zwei Sitze: Verlassen kostet die Strafe obendrauf', () => {
  const awards = awardForParty([place(0, 1), place(1, 2, true)]);
  const strafe = awards.find((a) => a.reason === 'leave_penalty');
  assert.ok(strafe);
  assert.equal(strafe.seat, 1);
  assert.equal(strafe.delta, -10);
});

test('Gleichstand teilt den Mittelwert und bleibt ganzzahlig', () => {
  // Zwei Spieler teilen sich Platz 1, zwei teilen sich Platz 3.
  const awards = awardForParty([
    place(0, 1),
    place(1, 1),
    place(2, 3),
    place(3, 3),
  ]);

  const delta = (seat: number) => awards.find((a) => a.seat === seat)!.delta;
  assert.equal(delta(0), 6); // (9 + 3) / 2
  assert.equal(delta(1), 6);
  assert.equal(delta(2), -6); // (-3 + -9) / 2
  assert.equal(delta(3), -6);
  assert.equal(awards.reduce((sum, a) => sum + a.delta, 0), 0);
  assert.ok(awards.every((a) => Number.isInteger(a.delta)));
});

test('Verlassen kostet zusaetzlich zehn Trophaeen', () => {
  const awards = awardForParty([
    place(0, 1),
    place(1, 2),
    place(2, 3),
    place(3, 4, true),
  ]);

  const penalty = awards.find((a) => a.reason === 'leave_penalty');
  assert.ok(penalty);
  assert.equal(penalty.delta, -10);
  assert.equal(penalty.seat, 3);
});

test('Sechs Sitze: die Verteilung setzt die Reihe fort und bleibt ganzzahlig', () => {
  const alle = awardForParty(Array.from({ length: 6 }, (_, i) => place(i, i + 1)));
  assert.deepEqual(
    alle.map((a) => a.delta),
    [15, 9, 3, -3, -9, -15],
  );

  // Jede zusammenhaengende Platzgruppe teilt sich ganze Zahlen.
  for (let gruppe = 2; gruppe <= 6; gruppe++) {
    const placements = Array.from({ length: 6 }, (_, i) => place(i, i < gruppe ? 1 : i + 1));
    const awards = awardForParty(placements);
    assert.ok(
      awards.every((a) => Number.isInteger(a.delta)),
      `Gruppe von ${gruppe} ergibt Bruchteile`,
    );
    assert.equal(awards.reduce((sum, a) => sum + a.delta, 0), 0);
  }
});

test('Checkpoints stehen alle 100 bis 1000, danach alle 250', () => {
  assert.equal(checkpointFor(0), 0);
  assert.equal(checkpointFor(99), 0);
  assert.equal(checkpointFor(100), 100);
  assert.equal(checkpointFor(555), 500);
  assert.equal(checkpointFor(1000), 1000);
  assert.equal(checkpointFor(1249), 1000);
  assert.equal(checkpointFor(1250), 1250);
});

test('der Checkpoint haelt, ein normaler Verlust bricht ihn nicht', () => {
  const start = applyDelta({ trophies: 95, highestCheckpoint: 0 }, 9);
  assert.equal(start.trophies, 104);
  assert.equal(start.highestCheckpoint, 100);

  const nachVerlust = applyDelta(start, -9);
  assert.equal(nachVerlust.trophies, 100, 'der Checkpoint faengt den Verlust ab');
});

test('die Verlassen-Strafe durchbricht den Checkpoint-Schutz', () => {
  const geschuetzt = { trophies: 102, highestCheckpoint: 100 };
  const nachStrafe = applyDelta(geschuetzt, -10, true);

  assert.equal(nachStrafe.trophies, 92);
  assert.equal(nachStrafe.highestCheckpoint, 100, 'der Checkpoint selbst bleibt erreicht');
});

test('unter null geht es nie', () => {
  const result = applyDelta({ trophies: 3, highestCheckpoint: 0 }, -9);
  assert.equal(result.trophies, 0);
});

test('Anfaenger koennen nicht verlieren, das ist bewusst so', () => {
  let stat = { trophies: 0, highestCheckpoint: 0 };
  for (let i = 0; i < 5; i++) stat = applyDelta(stat, -9);
  assert.equal(stat.trophies, 0);
});
