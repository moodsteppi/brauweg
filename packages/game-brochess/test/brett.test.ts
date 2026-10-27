import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  START_FEN,
  type Stellung,
  ausFen,
  feldIndex,
  feldName,
  imSchach,
  legaleZuege,
  ungenuegendesMaterial,
  wendeAn,
  zuFen,
} from '../src/brett.js';

/** Zielfelder aller legalen Zuege von einem Feld, sortiert. */
function ziele(fen: string, von: string): string[] {
  const stellung = ausFen(fen);
  const feld = feldIndex(von);
  return [...new Set(legaleZuege(stellung).filter((z) => z.von === feld).map((z) => feldName(z.nach)))].sort();
}

function zieh(stellung: Stellung, von: string, nach: string, umwandlung?: 'q' | 'r' | 'b' | 'n'): Stellung {
  const zug = legaleZuege(stellung).find(
    (z) => z.von === feldIndex(von) && z.nach === feldIndex(nach) && z.umwandlung === umwandlung,
  );
  assert.ok(zug, `${von}-${nach} sollte legal sein in ${zuFen(stellung)}`);
  return wendeAn(stellung, zug);
}

/**
 * Perft: alle Zugfolgen bis zur Tiefe zaehlen. Die Sollwerte sind die
 * bekannten Zahlen aus der Schachprogrammierung (chessprogramming.org) —
 * sie decken Schach, Fesselung, Rochade, En passant und Umwandlung auf
 * einmal ab, und ein einziger falscher Zug irgendwo verschiebt die Zahl.
 */
function perft(stellung: Stellung, tiefe: number): number {
  if (tiefe === 0) return 1;
  const zuege = legaleZuege(stellung);
  if (tiefe === 1) return zuege.length;
  return zuege.reduce((summe, zug) => summe + perft(wendeAn(stellung, zug), tiefe - 1), 0);
}

// ---------------------------------------------------------------------------
// FEN
// ---------------------------------------------------------------------------

test('FEN: Grundstellung liest sich und schreibt sich unveraendert zurueck', () => {
  assert.equal(zuFen(ausFen(START_FEN)), START_FEN);
  const kiwipete = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  assert.equal(zuFen(ausFen(kiwipete)), kiwipete);
});

test('FEN: Unsinn wird abgewiesen statt still falsch gelesen', () => {
  assert.throws(() => ausFen('8/8/8 w - - 0 1'));
  assert.throws(() => ausFen('rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
  assert.throws(() => ausFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1'));
  assert.throws(() => ausFen('rnbqkbnx/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
});

// ---------------------------------------------------------------------------
// Zuege je Figur
// ---------------------------------------------------------------------------

test('Grundstellung: zwanzig Zuege', () => {
  assert.equal(legaleZuege(ausFen(START_FEN)).length, 20);
});

test('Bauer: ein oder zwei Schritte vom Start, schlaegt nur schraeg', () => {
  assert.deepEqual(ziele(START_FEN, 'e2'), ['e3', 'e4']);
  // Nicht mehr auf der Startreihe: nur einen Schritt; schlagen schraeg.
  assert.deepEqual(ziele('4k3/8/8/3p1p2/4P3/8/8/4K3 w - - 0 1', 'e4'), ['d5', 'e5', 'f5']);
  // Blockiert: kein Schritt, auch nicht der doppelte ueber die Figur hinweg.
  assert.deepEqual(ziele('4k3/8/8/8/8/4n3/4P3/4K3 w - - 0 1', 'e2'), []);
  // Schwarz zieht nach unten.
  assert.deepEqual(ziele('4k3/3p4/8/8/8/8/8/4K3 b - - 0 1', 'd7'), ['d5', 'd6']);
});

test('Springer: acht Felder in der Mitte, zwei in der Ecke, springt ueber Figuren', () => {
  assert.equal(ziele('4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', 'd4').length, 8);
  assert.deepEqual(ziele('4k3/8/8/8/8/8/8/N3K3 w - - 0 1', 'a1'), ['b3', 'c2']);
  assert.deepEqual(ziele(START_FEN, 'g1'), ['f3', 'h3']);
});

test('Laeufer: Diagonalen bis zur ersten Figur, eigene blockiert, fremde geschlagen', () => {
  assert.deepEqual(
    ziele('4k3/8/8/8/3B4/8/8/4K3 w - - 0 1', 'd4').sort(),
    ['a1', 'a7', 'b2', 'b6', 'c3', 'c5', 'e3', 'e5', 'f2', 'f6', 'g1', 'g7', 'h8'].sort(),
  );
  // Eigener Bauer auf e5 blockiert, fremder auf b6 wird geschlagen.
  assert.deepEqual(ziele('4k3/8/1p6/4P3/3B4/8/8/4K3 w - - 0 1', 'd4'), [
    'a1', 'b2', 'b6', 'c3', 'c5', 'e3', 'f2', 'g1',
  ]);
});

test('Turm: Linie und Reihe, vierzehn Felder auf leerem Brett', () => {
  assert.equal(ziele('4k3/8/8/8/3R4/8/8/K7 w - - 0 1', 'd4').length, 14);
});

test('Dame: Turm und Laeufer zusammen', () => {
  assert.equal(ziele('4k3/8/8/8/3Q4/8/8/7K w - - 0 1', 'd4').length, 27);
});

test('Koenig: ein Feld weit, nie auf ein angegriffenes', () => {
  assert.equal(ziele('4k3/8/8/8/3K4/8/8/8 w - - 0 1', 'd4').length, 8);
  // Der schwarze Turm auf e8 bestreicht die e-Linie, der König auf d4 darf nicht nach e3/e4/e5.
  assert.deepEqual(ziele('k3r3/8/8/8/3K4/8/8/8 w - - 0 1', 'd4'), ['c3', 'c4', 'c5', 'd3', 'd5']);
  // Nie neben den gegnerischen König.
  assert.deepEqual(ziele('8/8/8/8/8/2k5/8/K7 w - - 0 1', 'a1'), ['a2', 'b1']);
});

// ---------------------------------------------------------------------------
// Schach und Selbstschach
// ---------------------------------------------------------------------------

test('Schach wird erkannt', () => {
  assert.equal(imSchach(ausFen('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1')), true);
  assert.equal(imSchach(ausFen('4k3/8/8/8/8/8/8/3R2K1 b - - 0 1')), false);
  // Bauernschach: nur schraeg, nicht geradeaus.
  assert.equal(imSchach(ausFen('8/8/8/3k4/4P3/8/8/4K3 b - - 0 1')), true);
  assert.equal(imSchach(ausFen('8/8/8/4k3/4P3/8/8/4K3 b - - 0 1')), false);
});

test('Selbstschach: eine gefesselte Figur darf die Fesselung nicht verlassen', () => {
  // Laeufer e2 ist durch den Turm e8 an den König e1 gefesselt.
  assert.deepEqual(ziele('4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1', 'e2'), []);
  // Ein gefesselter Turm darf auf der Fessellinie ziehen und den Angreifer schlagen.
  assert.deepEqual(ziele('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e2'), [
    'e3', 'e4', 'e5', 'e6', 'e7', 'e8',
  ]);
});

test('Im Schach sind nur Zuege erlaubt, die das Schach aufheben', () => {
  // Turm e8 gibt Schach; Weiss kann ausweichen oder mit dem Turm a4 dazwischenziehen.
  const stellung = ausFen('4r1k1/8/8/8/R7/8/8/4K3 w - - 0 1');
  const zuege = legaleZuege(stellung).map((z) => `${feldName(z.von)}${feldName(z.nach)}`).sort();
  assert.deepEqual(zuege, ['a4e4', 'e1d1', 'e1d2', 'e1f1', 'e1f2']);
});

// ---------------------------------------------------------------------------
// Rochade
// ---------------------------------------------------------------------------

const ROCHADE_FEN = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';

test('Rochade: beide Seiten erlaubt, Turm springt mit', () => {
  assert.ok(ziele(ROCHADE_FEN, 'e1').includes('g1'));
  assert.ok(ziele(ROCHADE_FEN, 'e1').includes('c1'));

  const kurz = zieh(ausFen(ROCHADE_FEN), 'e1', 'g1');
  assert.equal(kurz.brett[feldIndex('g1')], 'K');
  assert.equal(kurz.brett[feldIndex('f1')], 'R');
  assert.equal(kurz.brett[feldIndex('h1')], '');
  assert.equal(kurz.rochade, 'kq');

  const lang = zieh(ausFen(ROCHADE_FEN), 'e1', 'c1');
  assert.equal(lang.brett[feldIndex('c1')], 'K');
  assert.equal(lang.brett[feldIndex('d1')], 'R');
  assert.equal(lang.brett[feldIndex('a1')], '');

  const schwarz = zieh(ausFen('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1'), 'e8', 'c8');
  assert.equal(schwarz.brett[feldIndex('d8')], 'r');
  assert.equal(schwarz.rochade, 'KQ');
});

test('Rochade verboten: ohne Recht, mit Figur dazwischen, aus, durch oder ins Schach', () => {
  // Kein Recht mehr.
  assert.ok(!ziele('r3k2r/8/8/8/8/8/8/R3K2R w kq - 0 1', 'e1').includes('g1'));
  // Springer auf b1: lang verboten (auch b1 muss leer sein), kurz erlaubt.
  const springer = ziele('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1', 'e1');
  assert.ok(!springer.includes('c1'));
  assert.ok(springer.includes('g1'));
  // Aus dem Schach heraus: Turm e8 gibt Schach.
  const ausSchach = ziele('4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1');
  assert.ok(!ausSchach.includes('g1') && !ausSchach.includes('c1'));
  // Durch ein angegriffenes Feld: Turm f8 bestreicht f1.
  const durch = ziele('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1');
  assert.ok(!durch.includes('g1'));
  assert.ok(durch.includes('c1'));
  // Ins Schach: Turm g8 bestreicht g1.
  assert.ok(!ziele('k5r1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1').includes('g1'));
  // Nur b1 angegriffen (nicht Durchgang des Königs): lange Rochade bleibt erlaubt.
  assert.ok(ziele('1r4k1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e1').includes('c1'));
});

test('Rochaderecht faellt weg, wenn König oder Turm ziehen oder der Turm geschlagen wird', () => {
  const turm = zieh(ausFen(ROCHADE_FEN), 'h1', 'h2');
  assert.equal(turm.rochade, 'Qkq');
  const koenig = zieh(ausFen(ROCHADE_FEN), 'e1', 'e2');
  assert.equal(koenig.rochade, 'kq');
  // Weisser Turm schlaegt auf a8: Schwarz verliert die lange Rochade, Weiss die lange auch.
  const schlag = zieh(ausFen(ROCHADE_FEN), 'a1', 'a8');
  assert.equal(schlag.rochade, 'Kk');
  // Und hin und zurueck bringt das Recht nicht wieder.
  let s = zieh(ausFen(ROCHADE_FEN), 'h1', 'g1');
  s = zieh(s, 'a8', 'b8');
  s = zieh(s, 'g1', 'h1');
  s = zieh(s, 'b8', 'a8');
  assert.ok(!ziele(zuFen(s), 'e1').includes('g1'));
});

// ---------------------------------------------------------------------------
// En passant
// ---------------------------------------------------------------------------

test('En passant: unmittelbar nach dem Doppelschritt, und der geschlagene Bauer verschwindet', () => {
  let s = ausFen('4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1');
  s = zieh(s, 'd7', 'd5');
  assert.equal(s.epFeld, feldIndex('d6'));
  assert.ok(ziele(zuFen(s), 'e5').includes('d6'));

  const nachher = zieh(s, 'e5', 'd6');
  assert.equal(nachher.brett[feldIndex('d6')], 'P');
  assert.equal(nachher.brett[feldIndex('d5')], '', 'der geschlagene Bauer steht neben dem Ziel');
  assert.equal(nachher.halbzugUhr, 0);
});

test('En passant: einen Zug spaeter nicht mehr', () => {
  let s = ausFen('4k3/3p4/8/4P3/8/8/8/K7 b - - 0 1');
  s = zieh(s, 'd7', 'd5');
  s = zieh(s, 'a1', 'a2'); // Weiss zieht etwas anderes …
  s = zieh(s, 'e8', 'e7'); // … Schwarz auch …
  assert.equal(s.epFeld, null);
  assert.ok(!ziele(zuFen(s), 'e5').includes('d6'), '… und das Recht ist verfallen');
});

test('En passant: nicht nach einem einfachen Schritt, und nicht, wenn er den König blosslegt', () => {
  let s = ausFen('4k3/8/3p4/4P3/8/8/8/4K3 b - - 0 1');
  s = zieh(s, 'd6', 'd5');
  assert.ok(!ziele(zuFen(s), 'e5').includes('d6'));
  // König a5, Bauern b5 und c5 zwischen ihm und dem Turm h5: bxc6 raeumte beide von der Reihe.
  const gefesselt = ausFen('8/8/8/KPp4r/8/8/8/4k3 w - c6 0 1');
  assert.ok(!ziele(zuFen(gefesselt), 'b5').includes('c6'));
});

// ---------------------------------------------------------------------------
// Umwandlung
// ---------------------------------------------------------------------------

test('Umwandlung: vier Wahlmoeglichkeiten, auch beim Schlagen, und die Figur wechselt', () => {
  const s = ausFen('1n2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const zuege = legaleZuege(s).filter((z) => z.von === feldIndex('a7'));
  assert.deepEqual(
    zuege.map((z) => `${feldName(z.nach)}${z.umwandlung}`).sort(),
    ['a8b', 'a8n', 'a8q', 'a8r', 'b8b', 'b8n', 'b8q', 'b8r'],
  );
  assert.equal(zieh(s, 'a7', 'a8', 'q').brett[feldIndex('a8')], 'Q');
  assert.equal(zieh(s, 'a7', 'b8', 'n').brett[feldIndex('b8')], 'N');
  assert.equal(zieh(ausFen('4k3/8/8/8/8/8/p7/4K3 b - - 0 1'), 'a2', 'a1', 'r').brett[0], 'r');
});

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

test('Ungenuegendes Material: nur wo kein Matt mehr moeglich ist', () => {
  const brett = (fen: string): readonly string[] => ausFen(fen).brett;
  assert.equal(ungenuegendesMaterial(brett('4k3/8/8/8/8/8/8/4K3 w - - 0 1')), true);
  assert.equal(ungenuegendesMaterial(brett('4k3/8/8/8/8/8/8/4KN2 w - - 0 1')), true);
  assert.equal(ungenuegendesMaterial(brett('4k3/8/8/8/8/8/8/4KB2 w - - 0 1')), true);
  // Laeufer auf gleichfarbigen Feldern (c1 und f8 sind beide dunkel).
  assert.equal(ungenuegendesMaterial(brett('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1')), true);
  // Verschiedenfarbig: Matt ist moeglich.
  assert.equal(ungenuegendesMaterial(brett('4k1b1/8/8/8/8/8/8/2B1K3 w - - 0 1')), false);
  assert.equal(ungenuegendesMaterial(brett('4k3/8/8/8/8/8/8/3NKN2 w - - 0 1')), false);
  assert.equal(ungenuegendesMaterial(brett('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')), false);
});

// ---------------------------------------------------------------------------
// Perft
// ---------------------------------------------------------------------------

test('Perft Grundstellung bis Tiefe 3', () => {
  const s = ausFen(START_FEN);
  assert.equal(perft(s, 1), 20);
  assert.equal(perft(s, 2), 400);
  assert.equal(perft(s, 3), 8902);
});

test('Perft Kiwipete (Rochade, Fesselung, En passant, Umwandlung) bis Tiefe 3', () => {
  const s = ausFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.equal(perft(s, 1), 48);
  assert.equal(perft(s, 2), 2039);
  assert.equal(perft(s, 3), 97862);
});

test('Perft Stellung 3 (En-passant-Fesselung auf der Reihe) bis Tiefe 4', () => {
  const s = ausFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.equal(perft(s, 1), 14);
  assert.equal(perft(s, 2), 191);
  assert.equal(perft(s, 3), 2812);
  assert.equal(perft(s, 4), 43238);
});

test('Perft Stellung 4 (Umwandlung unter Schach) bis Tiefe 3', () => {
  const s = ausFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
  assert.equal(perft(s, 1), 6);
  assert.equal(perft(s, 2), 264);
  assert.equal(perft(s, 3), 9467);
});

test('Perft Stellung 5 bis Tiefe 2', () => {
  const s = ausFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
  assert.equal(perft(s, 1), 44);
  assert.equal(perft(s, 2), 1486);
});
