/**
 * Der Adapter ist die einzige Stelle, an der Plattform und Engine einander
 * kennen. Diese Tests sichern die Zusagen, auf die sich Server und Client
 * verlassen: legalActions ist vollstaendig, und die Zuschauersicht enthaelt
 * unter keinen Umstaenden eine Hand.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { doppelkopf } from '../src/adapter.js';
import { makeRuleSet } from '../src/ruleset.js';
import { type PartyState, act } from '../src/party.js';
import { currentActor } from '../src/round.js';

const CONFIG = makeRuleSet({ pflichtansage: true, announcements: true, absagen: true });

/**
 * Acht Runden, nicht vier. Eine Partie ueber genau so viele Runden, wie es
 * offene Pflichtsoli gibt, wird ab der ersten Runde vorgefuehrt; "gesund" gibt
 * es dann richtigerweise nicht. Fuer die allgemeinen Tests braucht es also
 * eine laengere Partie. Der Vorfuehrfall wird direkt darunter geprueft.
 */
function newParty(patch = {}): PartyState {
  return doppelkopf.createParty({
    config: makeRuleSet({ ...CONFIG, ...patch }),
    seats: 4,
    rounds: 8,
    seed: 12345,
  });
}

test('legalActions bietet in der Vorbehaltsabfrage immer auch "gesund" an', () => {
  const party = newParty();
  const seat = doppelkopf.currentActor(party);
  assert.notEqual(seat, null);

  const actions = doppelkopf.legalActions(party, seat as number);
  const gesund = actions.filter((a) => a.type === 'vorbehalt' && a.kind === null);
  assert.equal(gesund.length, 1, '"gesund" fehlt, der Sitz koennte nicht passen');
});

/**
 * Vorfuehr-Regel: Sind nur noch so viele Runden offen wie Pflichtsoli, wird
 * vorgefuehrt. Bei vier Spielern und vier Runden trifft das schon die erste
 * Runde, bei fuenf Spielern und fuenf Runden ebenso. Dem Vorgefuehrten bleibt
 * ausschliesslich das Solo, "gesund" ist dann keine Option.
 */
for (const [seats, rounds] of [
  [4, 4],
  [5, 5],
] as const) {
  test(`${seats} Spieler und ${rounds} Runden: es wird ab der ersten Runde vorgefuehrt`, () => {
    const party = doppelkopf.createParty({
      config: makeRuleSet({ ...CONFIG, pflichtsolo: true }),
      seats,
      rounds,
      seed: 12345,
    });

    const seat = doppelkopf.currentActor(party) as number;
    const actions = doppelkopf.legalActions(party, seat);

    assert.ok(actions.length > 0, 'der Vorgefuehrte muss handeln koennen');
    assert.ok(
      actions.every((a) => a.type === 'vorbehalt' && a.kind === 'solo'),
      'dem Vorgefuehrten bleibt ausschliesslich das Solo',
    );
    assert.equal(
      actions.filter((a) => a.type === 'vorbehalt' && a.kind === null).length,
      0,
      '"gesund" darf dem Vorgefuehrten nicht angeboten werden',
    );
  });
}

test('legalActions liefert fuer fremde Sitze in der Vorbehaltsabfrage nichts', () => {
  const party = newParty();
  const seat = doppelkopf.currentActor(party) as number;
  const other = (seat + 1) % 4;
  assert.deepEqual(doppelkopf.legalActions(party, other), []);
});

/** Bringt die Partie in die Spielphase, indem alle gesund melden. */
function toPlaying(start: PartyState): PartyState {
  let party = start;
  for (let i = 0; i < 6 && party.current?.phase === 'vorbehalt'; i++) {
    const seat = currentActor(party.current);
    if (seat === null) break;
    party = act(party, { type: 'vorbehalt', seat, kind: null });
  }
  return party;
}

test('Ansagen haengen nicht am Zugrecht', () => {
  const party = toPlaying(newParty());
  assert.equal(party.current?.phase, 'playing');

  const onTurn = doppelkopf.currentActor(party) as number;
  const waiting = (onTurn + 1) % 4;

  const actions = doppelkopf.legalActions(party, waiting);
  const announces = actions.filter((a) => a.type === 'announce');

  assert.ok(
    announces.length > 0,
    'Ein Sitz, der nicht am Zug ist, muss trotzdem ansagen duerfen',
  );
  // Aber spielen darf er nicht.
  assert.equal(actions.filter((a) => a.type === 'playCard').length, 0);
});

test('ohne aktivierte Ansagen gibt es keine Ansage-Aktionen', () => {
  const party = toPlaying(newParty({ announcements: false, absagen: false }));
  for (let seat = 0; seat < 4; seat++) {
    const actions = doppelkopf.legalActions(party, seat);
    assert.equal(actions.filter((a) => a.type === 'announce').length, 0);
  }
});

test('es wird immer hoechstens eine naechste Absagestufe angeboten', () => {
  const party = toPlaying(newParty());
  const seat = doppelkopf.currentActor(party) as number;
  const levels = doppelkopf
    .legalActions(party, seat)
    .filter((a) => a.type === 'announce')
    .map((a) => (a as { level: number }).level);

  // Re (0) und die erste Absage (1), mehr nicht.
  assert.deepEqual(levels, [0, 1]);
});

test('jede angebotene Aktion wird von act auch angenommen', () => {
  const party = toPlaying(newParty());
  for (let seat = 0; seat < 4; seat++) {
    for (const action of doppelkopf.legalActions(party, seat)) {
      assert.doesNotThrow(
        () => doppelkopf.act(party, seat, action),
        `abgelehnt: ${JSON.stringify(action)}`,
      );
    }
  }
});

test('spectatorView enthaelt keine Hand und keine eigene Partei', () => {
  const party = toPlaying(newParty());
  const view = doppelkopf.spectatorView(party);

  assert.equal(view.spectator, true);
  assert.deepEqual(view.round?.hand, []);
  assert.deepEqual(view.round?.legal, []);
  assert.equal(view.round?.myParty, null);
  assert.equal(view.round?.isMyTurn, false);

  // Der schaerfste Test: nirgends im serialisierten Objekt darf eine Karte
  // stehen, die nicht auf dem Tisch liegt.
  const onTable = new Set(
    (view.round?.currentTrick ?? []).map((p) => (p as { card: { id: number } }).card.id),
  );
  const json = JSON.stringify(view.round);
  const hands = party.current?.hands ?? {};
  for (const seat of Object.keys(hands)) {
    for (const card of hands[Number(seat)] ?? []) {
      if (onTable.has(card.id)) continue;
      assert.ok(
        !json.includes(`"id":${card.id}`),
        `Karte ${card.id} von Sitz ${seat} ist in der Zuschauersicht sichtbar`,
      );
    }
  }
});

test('der Bot laeuft nicht auf der Zuschauersicht', () => {
  const party = toPlaying(newParty());
  assert.throws(() => doppelkopf.botAction(doppelkopf.spectatorView(party)));
});

test('act weist Aktionen fuer einen fremden Sitz ab', () => {
  const party = toPlaying(newParty());
  const seat = doppelkopf.currentActor(party) as number;
  const action = doppelkopf
    .legalActions(party, seat)
    .find((a) => a.type === 'playCard');
  assert.ok(action);
  assert.throws(() => doppelkopf.act(party, (seat + 1) % 4, action));
});

test('serialize und deserialize erhalten den Zustand', () => {
  const party = toPlaying(newParty());
  const raw = JSON.parse(JSON.stringify(doppelkopf.serialize(party)));
  const back = doppelkopf.deserialize(raw);

  assert.equal(doppelkopf.currentActor(back), doppelkopf.currentActor(party));
  assert.deepEqual(
    doppelkopf.viewFor(back, 0).round?.hand,
    doppelkopf.viewFor(party, 0).round?.hand,
  );
});
