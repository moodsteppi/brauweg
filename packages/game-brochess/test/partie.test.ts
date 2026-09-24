import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brochess } from '../src/adapter.js';
import {
  type BroChessAktion,
  type BroChessPartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  platzierungen,
} from '../src/partie.js';
import { DEFAULT_REGELN } from '../src/regeln.js';

/** Partie aus einer FEN; Weiss sitzt auf 0 (gerade Saat). */
function partie(fen?: string): BroChessPartie {
  return erstellePartie(DEFAULT_REGELN, 0, fen);
}

const zug = (von: string, nach: string, umwandlung?: 'q' | 'r' | 'b' | 'n'): BroChessAktion => ({
  type: 'zug',
  von,
  nach,
  ...(umwandlung ? { umwandlung } : {}),
});

/** Zieht fuer den Sitz, der gerade dran ist. */
function spiele(p: BroChessPartie, ...zuege: [string, string][]): BroChessPartie {
  return zuege.reduce((stand, [von, nach]) => fuehreAus(stand, amZug(stand)!, zug(von, nach)), p);
}

// ---------------------------------------------------------------------------
// Zugfolge und Abweisung
// ---------------------------------------------------------------------------

test('Weiss beginnt; wer Weiss ist, bestimmt die Saat', () => {
  assert.equal(amZug(erstellePartie(DEFAULT_REGELN, 0)), 0);
  assert.equal(amZug(erstellePartie(DEFAULT_REGELN, 7)), 1);
});

test('act weist fremde Zuege, unerlaubte Zuege und Unsinn ab', () => {
  const p = partie();
  assert.throws(() => fuehreAus(p, 1, zug('e7', 'e5')), /Nicht am Zug/);
  assert.throws(() => fuehreAus(p, 0, zug('e2', 'e5')), /nicht erlaubt/);
  assert.throws(() => fuehreAus(p, 0, zug('e7', 'e5')), /nicht erlaubt/);
  assert.throws(() => fuehreAus(p, 0, zug('z9', 'e4')), /Feld/);
  assert.throws(() => fuehreAus(p, 0, { type: 'aufgeben' } as never), /Unbekannte Aktion/);
});

test('legalActions nur fuer den Sitz am Zug, und jede davon nimmt act an', () => {
  const p = partie();
  assert.equal(erlaubteZuege(p, 1).length, 0);
  const zuege = erlaubteZuege(p, 0);
  assert.equal(zuege.length, 20);
  for (const aktion of zuege) assert.doesNotThrow(() => fuehreAus(p, 0, aktion));
});

test('Umwandlung: ohne Wahl abgewiesen, mit Wahl ausgefuehrt', () => {
  const p = partie('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  assert.throws(() => fuehreAus(p, 0, zug('a7', 'a8')), /nicht erlaubt/);
  const nachher = fuehreAus(p, 0, zug('a7', 'a8', 'q'));
  assert.equal(nachher.stellung.brett[56], 'Q');
  // Die Dame auf a8 gibt Schach an e8.
  assert.equal(brochess.viewFor(nachher, 1).schach, true);
});

// ---------------------------------------------------------------------------
// Ende
// ---------------------------------------------------------------------------

test('Matt in einem Zug: Grundreihenmatt beendet die Partie mit Sieger', () => {
  const p = partie('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const nachher = fuehreAus(p, 0, zug('a1', 'a8'));
  assert.deepEqual(nachher.ende, { ausgang: 'matt', sieger: 0 });
  assert.equal(amZug(nachher), null);
  assert.equal(brochess.isFinished(nachher), true);
  const plaetze = platzierungen(nachher);
  assert.deepEqual(
    plaetze.map((s) => [s.seat, s.place, s.points]),
    [[0, 1, 2], [1, 2, 0]],
  );
  assert.throws(() => fuehreAus(nachher, 1, zug('g8', 'h8')), /zu Ende/);
});

test('Schaefermatt aus der Grundstellung', () => {
  const nachher = spiele(
    partie(),
    ['e2', 'e4'], ['e7', 'e5'],
    ['d1', 'h5'], ['b8', 'c6'],
    ['f1', 'c4'], ['g8', 'f6'],
    ['h5', 'f7'],
  );
  assert.deepEqual(nachher.ende, { ausgang: 'matt', sieger: 0 });
});

test('Patt: kein legaler Zug ohne Schach ist Remis', () => {
  // Schwarz: König a8. Weiss: König b6, Dame zieht nach c7 — Patt.
  const p = partie('k7/8/1K6/8/8/8/8/2Q5 w - - 0 1');
  const nachher = fuehreAus(p, 0, zug('c1', 'c7'));
  assert.deepEqual(nachher.ende, { ausgang: 'patt', sieger: null });
  assert.deepEqual(
    platzierungen(nachher).map((s) => [s.place, s.points]),
    [[1, 1], [1, 1]],
  );
});

test('Dreifache Stellungswiederholung ist Remis', () => {
  let p = partie();
  const hinUndHer: [string, string][] = [
    ['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8'],
  ];
  p = spiele(p, ...hinUndHer);
  assert.equal(p.ende, null, 'zweimal ist noch nicht dreimal');
  p = spiele(p, ...hinUndHer);
  assert.deepEqual(p.ende, { ausgang: 'wiederholung', sieger: null });
});

test('Wiederholung zaehlt das En-passant-Recht mit: nach einem Doppelschritt ist es eine andere Stellung', () => {
  // Schwarzer Bauer d4, weisser zieht e2-e4: d4xe3 ep waere moeglich.
  let p = partie('4k3/8/8/8/3p4/8/4P3/4K1N1 w - - 0 1');
  p = spiele(p, ['e2', 'e4']);
  const mitEp = Object.keys(p.wiederholungen).find((k) => k.endsWith(' e3'));
  assert.ok(mitEp, 'der Schluessel traegt das ep-Feld, solange der Schlag legal ist');
  // Ohne moeglichen Schlag faellt das Feld aus dem Schluessel.
  let q = partie('4k3/8/8/8/8/8/4P3/4K1N1 w - - 0 1');
  q = spiele(q, ['e2', 'e4']);
  assert.ok(Object.keys(q.wiederholungen).every((k) => k.endsWith(' -')));
});

test('50-Zuege-Regel: nach hundert Halbzuegen ohne Bauernzug und Schlag ist Remis', () => {
  // Uhr steht bei 99; der naechste stille Zug erreicht 100.
  const p = partie('4k3/8/8/8/8/8/4P3/R3K3 w - - 99 80');
  const still = fuehreAus(p, 0, zug('a1', 'a2'));
  assert.deepEqual(still.ende, { ausgang: 'fuenfzigZuege', sieger: null });
  // Ein Bauernzug stellt die Uhr zurueck.
  const bauer = fuehreAus(p, 0, zug('e2', 'e4'));
  assert.equal(bauer.ende, null);
  assert.equal(bauer.stellung.halbzugUhr, 0);
});

test('Matt geht vor der 50-Zuege-Regel', () => {
  const p = partie('6k1/5ppp/8/8/8/8/8/R5K1 w - - 99 80');
  assert.deepEqual(fuehreAus(p, 0, zug('a1', 'a8')).ende, { ausgang: 'matt', sieger: 0 });
});

test('Ungenuegendes Material beendet die Partie: König schlaegt die letzte Figur', () => {
  const p = partie('4k3/8/8/8/8/8/3r4/4K3 w - - 0 1');
  assert.deepEqual(fuehreAus(p, 0, zug('e1', 'd2')).ende, { ausgang: 'material', sieger: null });
});

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

test('Regelsatz: zwei Sitze und eine Partie, sonst abgewiesen', () => {
  assert.deepEqual(brochess.validateConfig(brochess.defaultConfig(), 2, 1), []);
  assert.equal(brochess.validateConfig(brochess.defaultConfig(), 3, 1).length, 1);
  assert.equal(brochess.validateConfig(brochess.defaultConfig(), 2, 2).length, 1);
  assert.equal(brochess.validateConfig(null, 2, 1)[0]?.messageKey, 'ruleset.notAnObject');
});

test('Sicht: eigene Farbe, Zuschauer ohne Farbe, Snapshot uebersteht den Neustart', () => {
  const p = brochess.createParty({ config: DEFAULT_REGELN, seats: 2, rounds: 1, seed: 3 });
  assert.equal(brochess.viewFor(p, p.weissSitz).meineFarbe, 'w');
  assert.equal(brochess.viewFor(p, 1 - p.weissSitz).meineFarbe, 'b');
  assert.equal(brochess.spectatorView(p).meineFarbe, null);
  assert.equal(brochess.spectatorView(p).zuschauer, true);

  const gezogen = brochess.act(p, p.weissSitz, zug('e2', 'e4'));
  const wieder = brochess.deserialize(JSON.parse(JSON.stringify(brochess.serialize(gezogen))));
  assert.deepEqual(wieder, gezogen);
  assert.deepEqual(brochess.viewFor(wieder, 0).letzterZug, { von: 'e2', nach: 'e4' });
});

test('Ersatzbot zieht immer legal und bringt eine Partie zu Ende', () => {
  let p = brochess.createParty({ config: DEFAULT_REGELN, seats: 2, rounds: 1, seed: 1 });
  let zuege = 0;
  while (!brochess.isFinished(p)) {
    const sitz = brochess.currentActor(p)!;
    const aktion = brochess.botAction(brochess.viewFor(p, sitz));
    p = brochess.act(p, sitz, aktion);
    zuege += 1;
    assert.ok(zuege < 10_000, 'die Remisregeln muessen jede Partie beenden');
  }
  assert.notEqual(p.ende, null);
  assert.throws(() => brochess.botAction(brochess.spectatorView(p)));
});
