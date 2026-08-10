import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sumAugen } from '../src/cards.js';
import { makeRuleSet } from '../src/ruleset.js';
import {
  type RoundState,
  apply,
  createRound,
  currentActor,
  legalActions,
} from '../src/round.js';

/**
 * Treibt das Reizen bis zum Ende: hier gewinnt immer die Vorhand zu 18. So
 * kommen wir reproduzierbar in die Skat-Phase, ohne die ganze Bietlogik im
 * Test nachzubauen — die prueft reizen.test.ts fuer sich.
 */
function reizenZuVorhand(s0: RoundState): RoundState {
  let s = s0;
  // Mittelhand passt, Hinterhand passt, Vorhand nimmt zu 18 an.
  const mh = currentActor(s)!;
  s = apply(s, mh, { type: 'reizWeg' });
  const hh = currentActor(s)!;
  s = apply(s, hh, { type: 'reizWeg' });
  const vh = currentActor(s)!;
  s = apply(s, vh, { type: 'reizWeiter' });
  return s;
}

/** Spielt ab der Stich-Phase stur die erste zulaessige Karte, bis vorbei. */
function stecheDurch(s0: RoundState): RoundState {
  let s = s0;
  let schutz = 0;
  while (s.phase === 'stich') {
    if (++schutz > 100) throw new Error('Stichschleife dreht durch');
    const seat = currentActor(s)!;
    const karten = legalActions(s, seat).filter((a) => a.type === 'karte');
    assert.ok(karten.length > 0, 'am Zug muss es eine spielbare Karte geben');
    s = apply(s, seat, karten[0]!);
  }
  return s;
}

test('Volle Gabe als Grand-Hand: Augen summieren sich zu 120', () => {
  const rs = makeRuleSet();
  let s = createRound(rs, 2, 'test-grand');
  s = reizenZuVorhand(s);
  assert.equal(s.phase, 'skat');
  const declarer = s.declarer!;
  // Hand spielen (kein Skat), dann Grand ansagen.
  s = apply(s, declarer, { type: 'handSpielen' });
  assert.equal(s.phase, 'ansage');
  s = apply(s, declarer, { type: 'ansage', spiel: 'grand' });
  assert.equal(s.phase, 'stich');
  s = stecheDurch(s);

  assert.equal(s.phase, 'vorbei');
  assert.ok(s.result, 'Ergebnis muss stehen');
  // Alle gewonnenen Karten plus Skat ergeben 120 Augen.
  const gewonnenAugen = s.seats.reduce((a, t) => a + sumAugen([...s.gewonnen[t]!]), 0);
  assert.equal(gewonnenAugen + sumAugen([...s.skat]), 120);
  // Genau zehn Stiche verteilt.
  const stiche = s.seats.reduce((a, t) => a + s.tricks.filter((tr) => tr.winner === t).length, 0);
  assert.equal(stiche, 10);
});

test('Volle Gabe mit Skataufnahme und Farbansage laeuft bis zur Abrechnung', () => {
  const rs = makeRuleSet();
  let s = createRound(rs, 0, 'test-farbe');
  s = reizenZuVorhand(s);
  const declarer = s.declarer!;
  s = apply(s, declarer, { type: 'skatNehmen' });
  assert.equal(s.phase, 'druecken');
  assert.equal(s.hands[declarer]!.length, 12);
  // Die ersten beiden Handkarten druecken.
  const weg = s.hands[declarer]!.slice(0, 2).map((c) => c.id);
  s = apply(s, declarer, { type: 'druecken', cards: weg });
  assert.equal(s.phase, 'ansage');
  assert.equal(s.hands[declarer]!.length, 10);
  s = apply(s, declarer, { type: 'ansage', spiel: 'H' });
  assert.equal(s.gameType?.kind, 'suit');
  s = stecheDurch(s);

  assert.equal(s.phase, 'vorbei');
  assert.ok(s.result);
  assert.equal(s.result!.declarer, declarer);
  // Punkte: nur der Alleinspieler bekommt etwas (Farbspiel), Gegner 0.
  assert.equal(s.result!.punkte[s.seats.find((t) => t !== declarer)!], 0);
});

test('Alle passen bei aktivem Ramsch: es wird Ramsch gespielt und abgerechnet', () => {
  const rs = makeRuleSet({ ramsch: true });
  let s = createRound(rs, 1, 'test-ramsch');
  // Alle drei passen.
  s = apply(s, currentActor(s)!, { type: 'reizWeg' }); // Mittelhand
  s = apply(s, currentActor(s)!, { type: 'reizWeg' }); // Hinterhand
  assert.equal(s.phase, 'reizen'); // jetzt entscheidet Vorhand
  s = apply(s, currentActor(s)!, { type: 'reizWeg' }); // Vorhand passt auch

  assert.equal(s.phase, 'stich');
  assert.equal(s.gameType?.kind, 'ramsch');
  assert.equal(s.declarer, null);
  s = stecheDurch(s);

  assert.equal(s.phase, 'vorbei');
  assert.ok(s.result);
  assert.equal(s.result!.declarer, null);
  // Ramsch: Der Skat faellt dem letzten Stichgewinner zu, Summe bleibt 120.
  const augen = s.seats.reduce((a, t) => a + sumAugen([...s.gewonnen[t]!]), 0);
  assert.equal(augen, 120);
  // Der Augenreichste hat Minuspunkte, oder ein Durchmarsch dreht es.
  const punkte = s.result!.punkte;
  const hatMinus = s.seats.some((t) => punkte[t]! < 0);
  const hatDurchmarsch = s.result!.durchmarsch !== null;
  assert.ok(hatMinus || hatDurchmarsch);
});

test('Alle passen bei Ramsch=aus: neu geben', () => {
  const rs = makeRuleSet({ ramsch: false });
  let s = createRound(rs, 1, 'test-neu');
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  s = apply(s, currentActor(s)!, { type: 'reizWeg' });
  assert.equal(s.phase, 'vorbei');
  assert.equal(s.neuGeben, true);
  assert.equal(s.result, null);
});
