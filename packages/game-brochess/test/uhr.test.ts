/**
 * Schachuhr, Zugliste, Aufgeben, Vorab-Ziele (seit dem 22.10.2026).
 *
 * Die Uhr selbst MISST die Plattform (runtime/party.ts); hier steht, was das
 * Modul daraus macht: Zuschlag nach dem Zug, Verlust oder Remis bei
 * Zeitablauf, und wie die Sicht die Zahlen weitergibt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brochess } from '../src/adapter.js';
import { ausFen, sanVon, feldIndex, vorabZiele, materialStand } from '../src/brett.js';
import {
  type BroChessPartie,
  amZug,
  erstellePartie,
  fuehreAus,
  platzierungen,
  restzeit,
  verbraucheZeit,
} from '../src/partie.js';
import { type BroChessRegeln, pruefeRegeln } from '../src/regeln.js';

const BLITZ: BroChessRegeln = { bedenkzeitMs: 180_000, zuschlagMs: 2_000 };

function partie(regeln: BroChessRegeln = BLITZ, fen?: string): BroChessPartie {
  return erstellePartie(regeln, 0, fen);
}

function spiele(p: BroChessPartie, ...zuege: [string, string][]): BroChessPartie {
  return zuege.reduce(
    (stand, [von, nach]) => fuehreAus(stand, amZug(stand)!, { type: 'zug', von, nach }),
    p,
  );
}

test('Regelsatz: Bedenkzeit und Zuschlag werden geprueft', () => {
  assert.deepEqual(pruefeRegeln(BLITZ, 2, 1), []);
  assert.deepEqual(pruefeRegeln({ tableSize: 2, rounds: 1, bedenkzeitMs: 600_000 }, 2, 1), []);
  assert.equal(pruefeRegeln({ bedenkzeitMs: 5_000 }, 2, 1)[0]?.messageKey, 'ruleset.bedenkzeit');
  assert.equal(pruefeRegeln({ bedenkzeitMs: 1.5 }, 2, 1)[0]?.messageKey, 'ruleset.bedenkzeit');
  assert.equal(pruefeRegeln({ zuschlagMs: 1_000 }, 2, 1)[0]?.messageKey, 'ruleset.zuschlag');
  assert.equal(
    pruefeRegeln({ bedenkzeitMs: 60_000, zuschlagMs: 120_000 }, 2, 1)[0]?.messageKey,
    'ruleset.zuschlag',
  );
});

test('ohne Zeitkontrolle gibt es keine Uhr — die Plattform nimmt dann ihre Zugzeit', () => {
  const p = partie({});
  assert.equal(p.uhr, null);
  assert.equal(brochess.schachuhr!.restMs(p, 0), null);
  assert.equal(brochess.viewFor(p, 0).uhr, null);
});

test('der Zuschlag kommt nach dem eigenen Zug, die Buchung zieht ab', () => {
  let p = partie();
  assert.deepEqual(p.uhr!.restMs, [180_000, 180_000]);
  p = verbraucheZeit(p, 0, 5_000);
  p = spiele(p, ['e2', 'e4']);
  assert.deepEqual(p.uhr!.restMs, [177_000, 180_000]);
  assert.equal(restzeit(p, 1), 180_000);
  const sicht = brochess.viewFor(p, 1);
  assert.deepEqual(sicht.uhr, { restMs: [177_000, 180_000], bedenkzeitMs: 180_000, zuschlagMs: 2_000 });
});

test('Zeit abgelaufen: verloren — die Plattform erkennt das Ende an isFinished', () => {
  const p = verbraucheZeit(partie(), 0, 999_999);
  assert.deepEqual(p.ende, { ausgang: 'zeit', sieger: 1 });
  assert.equal(brochess.isFinished(p), true);
  assert.equal(restzeit(p, 0), null);
  assert.deepEqual(
    platzierungen(p).map((s) => s.place),
    [2, 1],
  );
});

test('Zeit abgelaufen, aber der Gegner kann nicht mattsetzen: Remis (FIDE 6.9)', () => {
  // Weiss (Sitz 0) mit Turm, Schwarz nur mit Koenig und Laeufer.
  const p = verbraucheZeit(partie(BLITZ, '4k3/8/8/8/8/8/2b5/R3K3 w - - 0 1'), 0, 999_999);
  assert.deepEqual(p.ende, { ausgang: 'zeit', sieger: null });
  // Umgekehrt: Schwarz ueberschreitet, Weiss hat einen Turm — Weiss gewinnt.
  const q = verbraucheZeit(partie(BLITZ, '4k3/8/8/8/8/8/2b5/R3K3 b - - 0 1'), 1, 999_999);
  assert.deepEqual(q.ende, { ausgang: 'zeit', sieger: 0 });
});

test('Aufgeben geht jederzeit, auch wenn der Gegner am Zug ist', () => {
  const p = partie();
  const aus = fuehreAus(p, 1, { type: 'aufgeben' });
  assert.deepEqual(aus.ende, { ausgang: 'aufgabe', sieger: 0 });
  assert.throws(() => fuehreAus(aus, 0, { type: 'aufgeben' }), /zu Ende/);
  // Aufgeben steht nicht in legalActions — die Liste sind die Zuege.
  assert.ok(brochess.legalActions(p, 0).every((a) => a.type === 'zug'));
});

test('Zugliste in Kurzschrift: Schlag, Schach, Matt', () => {
  const p = spiele(partie({}), ['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']);
  assert.deepEqual(p.verlauf, ['f3', 'e5', 'g4', 'Qh4#']);
  assert.equal(p.ende?.ausgang, 'matt');
  const q = spiele(partie({}), ['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']);
  assert.equal(q.verlauf.at(-1), 'exd5');
});

test('Kurzschrift: Rochade, Umwandlung, Mehrdeutigkeit', () => {
  const zug = (fen: string, von: string, nach: string, umwandlung?: 'q') =>
    sanVon(ausFen(fen), { von: feldIndex(von), nach: feldIndex(nach), ...(umwandlung ? { umwandlung } : {}) });
  assert.equal(zug('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1', 'g1'), 'O-O');
  assert.equal(zug('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1', 'c1'), 'O-O-O');
  assert.equal(zug('8/P6k/8/8/8/8/8/4K3 w - - 0 1', 'a7', 'a8', 'q'), 'a8=Q');
  // Zwei Springer koennen nach d2: die Linie entscheidet.
  assert.equal(zug('4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1', 'b1', 'd2'), 'Nbd2');
  // Zwei Tuerme auf derselben Linie: die Reihe entscheidet.
  assert.equal(zug('4k3/R7/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a4'), 'R1a4');
});

test('Vorab-Ziele: nur fuer den, der nicht am Zug ist, mit Gangart auf leerem Brett', () => {
  const p = spiele(partie(), ['e2', 'e4']);
  assert.deepEqual(brochess.viewFor(p, 1).vorab, {});
  const weiss = brochess.viewFor(p, 0).vorab;
  // Der Laeufer auf f1 steht hinter dem eigenen Bauern — vorab zaehlt die Gangart.
  assert.ok(weiss.f1!.includes('a6'));
  // Bauern duerfen vorab schraeg, falls dort gleich etwas steht.
  assert.ok(weiss.d2!.includes('c3') && weiss.d2!.includes('e3'));
  // Rochade vorab, solange das Recht besteht.
  assert.ok(weiss.e1!.includes('g1'));
  // Keiner zieht auf den eigenen Koenig.
  assert.ok(!Object.values(weiss).some((ziele) => ziele.includes('e1')));
  assert.deepEqual(Object.keys(vorabZiele(ausFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), 'b')), ['e8']);
});

test('Material: geschlagene Figuren und Vorsprung', () => {
  const p = spiele(partie({}), ['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']);
  const sicht = brochess.viewFor(p, 0);
  assert.deepEqual(sicht.geschlagen, { w: [], b: ['p'] });
  assert.equal(sicht.vorsprung, 1);
  assert.equal(materialStand(ausFen('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1').brett).vorsprung, 9);
});

test('ein Spielstand aus Fassung 1 laedt weiter: ohne Uhr, mit leerer Zugliste', () => {
  const neu = partie({});
  const { verlauf: _v, uhr: _u, ...alt } = neu;
  const geladen = brochess.deserialize({ v: 1, ...alt });
  assert.deepEqual(geladen.verlauf, []);
  assert.equal(geladen.uhr, null);
  const wieder = brochess.deserialize(brochess.serialize(spiele(partie(), ['e2', 'e4'])));
  assert.deepEqual(wieder.verlauf, ['e4']);
});
