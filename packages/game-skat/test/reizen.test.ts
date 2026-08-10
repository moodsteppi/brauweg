import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyReizWeg,
  applyReizWeiter,
  reizAmZug,
  reizSicht,
  startReizen,
} from '../src/reizen.js';

// Geber = Sitz 2 -> Vorhand 0, Mittelhand 1, Hinterhand 2.
const start = () => startReizen(2);

test('Positionen aus dem Geber abgeleitet', () => {
  const s = start();
  assert.equal(s.vorhand, 0);
  assert.equal(s.mittelhand, 1);
  assert.equal(s.hinterhand, 2);
  // Zuerst reizt Mittelhand die Vorhand: Mittelhand ist am Zug.
  assert.equal(reizAmZug(s), 1);
  assert.equal(reizSicht(s).gebot, 18);
});

test('Mittelhand reizt, Vorhand haelt, dann passen beide -> Vorhand spielt', () => {
  let s = start();
  s = applyReizWeiter(s); // MH sagt 18
  assert.equal(reizAmZug(s), 0); // Vorhand hoert
  assert.equal(reizSicht(s).wert, 18);
  s = applyReizWeiter(s); // VH haelt 18
  assert.equal(reizAmZug(s), 1); // MH wieder dran
  s = applyReizWeg(s); // MH passt -> Runde 2, HH gegen VH
  assert.equal(reizAmZug(s), 2);
  s = applyReizWeg(s); // HH passt
  assert.equal(s.phase, 'fertig');
  assert.equal(s.gewinner, 0); // Vorhand
  assert.equal(s.wert, 18);
});

test('Vorhand passt, Mittelhand gewinnt gegen Hinterhand', () => {
  let s = start();
  s = applyReizWeiter(s); // MH 18
  s = applyReizWeg(s); // VH passt -> MH Sieger R1 bei 18, R2 HH gegen MH
  assert.equal(s.phase, 'r2');
  assert.equal(reizAmZug(s), 2); // HH
  s = applyReizWeg(s); // HH passt sofort
  assert.equal(s.phase, 'fertig');
  assert.equal(s.gewinner, 1); // Mittelhand
  assert.equal(s.wert, 18);
});

test('Hinterhand ueberreizt und gewinnt', () => {
  let s = start();
  s = applyReizWeiter(s); // MH 18
  s = applyReizWeiter(s); // VH haelt 18
  s = applyReizWeg(s); // MH passt -> R2 HH gegen VH, wert 18
  assert.equal(reizAmZug(s), 2);
  s = applyReizWeiter(s); // HH sagt 20
  assert.equal(s.wert, 20);
  assert.equal(reizAmZug(s), 0); // VH hoert
  s = applyReizWeg(s); // VH passt
  assert.equal(s.phase, 'fertig');
  assert.equal(s.gewinner, 2); // Hinterhand
  assert.equal(s.wert, 20);
});

test('Alle passen -> kein Gewinner (Ramsch/Neugeben)', () => {
  let s = start();
  s = applyReizWeg(s); // MH passt
  s = applyReizWeg(s); // HH passt
  assert.equal(s.phase, 'vh'); // Vorhand entscheidet
  assert.equal(reizAmZug(s), 0);
  s = applyReizWeg(s); // VH passt auch
  assert.equal(s.phase, 'fertig');
  assert.equal(s.gewinner, null);
});

test('Alle passen ausser Vorhand: sie nimmt das Spiel zu 18', () => {
  let s = start();
  s = applyReizWeg(s); // MH passt
  s = applyReizWeg(s); // HH passt
  s = applyReizWeiter(s); // VH nimmt an
  assert.equal(s.phase, 'fertig');
  assert.equal(s.gewinner, 0);
  assert.equal(s.wert, 18);
});
