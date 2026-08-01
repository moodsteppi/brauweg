import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cardValue, sumValues } from '../src/cards.js';
import { makeRuleSet } from '../src/ruleset.js';
import { makeRng } from '../src/deal.js';
import { buildOrder } from '../src/order.js';
import { botAction, chooseCard } from '../src/bot.js';
import {
  type PartyState,
  act,
  createParty,
  startRound,
} from '../src/party.js';
import {
  type PlayerView,
  apply as applyRound,
  createRound,
  currentActor,
  viewFor,
} from '../src/round.js';

const FOUR = [0, 1, 2, 3];

/** Spielt eine ganze Partie ausschliesslich mit Bots. */
function botParty(party: PartyState): PartyState {
  let guard = 0;
  while (!party.finished && guard++ < 500) {
    party = startRound(party);

    let steps = 0;
    while (party.current && steps++ < 500) {
      const seat = currentActor(party.current);
      if (seat === null) break;
      const action = botAction(viewFor(party.current, seat));
      assert.notEqual(
        action,
        null,
        `Bot hat keine Aktion in Phase ${party.current.phase}`,
      );
      party = act(party, action!);
    }
  }
  return party;
}

test('Bot: 1000 Partien laufen ohne Regelverstoss durch', () => {
  const rng = makeRng(13579);
  let soloParties = 0;

  for (let i = 0; i < 1000; i++) {
    const rs = makeRuleSet({
      deck: rng() < 0.5 ? 'with9' : 'without9',
      rounds: 4,
      pflichtsolo: rng() < 0.7,
      pflichtansage: rng() < 0.5,
      bock: true,
      bockTriggers: ['zeroResult', 'reAndKontra', 'solo'],
      schweinchen: rng() < 0.5,
      superSchweine: rng() < 0.3,
      secondDulleBeatsFirst: rng() < 0.5,
      defusedDullen: rng() < 0.3,
    });

    const party = botParty(createParty(rs, FOUR, 20000 + i));

    assert.equal(party.finished, true, `Partie ${i} nicht beendet`);
    assert.equal(party.history.length, rs.rounds);
    assert.equal(Object.values(party.scores).reduce((a, b) => a + b, 0), 0);

    for (const summary of party.history) {
      assert.equal(
        summary.result.rePoints + summary.result.kontraPoints,
        240,
        `Partie ${i}, Runde ${summary.roundIndex}: Augensumme falsch`,
      );
      // Der Bot sagt nie freiwillig an. Angesagt wird nur, was Pflicht war.
      if (!rs.pflichtansage) {
        assert.equal(summary.announcements.re, false);
        assert.equal(summary.announcements.kontra, false);
      }
      assert.equal(summary.announcements.reAbsage, 0);
      assert.equal(summary.announcements.kontraAbsage, 0);
    }

    if (rs.pflichtsolo) {
      soloParties++;
      assert.deepEqual(
        [...party.soloPlayed].sort(),
        FOUR,
        `Partie ${i}: Pflichtsolo-Zyklus unvollstaendig`,
      );
    }
  }

  assert.ok(soloParties > 500, 'Zu wenige Partien mit Pflichtsolo getestet');
});

test('Bot nimmt eine Armut nie an', () => {
  const rs = makeRuleSet({ rounds: 4, armut: true, pflichtsolo: false });
  let party = startRound(createParty(rs, FOUR, 777));

  // Vorbehaltsabfrage: erster Sitz mit Armut sagt sie an, Rest gesund.
  let announced = false;
  while (party.current && party.current.phase === 'vorbehalt') {
    const st = party.current;
    const seat = currentActor(st)!;
    const view = viewFor(st, seat);
    const takeArmut = !announced && view.allowedVorbehalte.includes('armut');
    if (takeArmut) announced = true;
    party = act(party, {
      type: 'vorbehalt',
      seat,
      kind: takeArmut ? 'armut' : null,
    });
  }

  if (!announced) return; // in dieser Verteilung keine Armut moeglich

  // Alle Kandidaten sind Bots: keiner nimmt an, es muss neu gegeben werden.
  let steps = 0;
  while (party.current && steps++ < 10) {
    const seat = currentActor(party.current)!;
    const action = botAction(viewFor(party.current, seat))!;
    assert.notEqual(action.type, 'armutAccept', 'Bot darf keine Armut annehmen');
    party = act(party, action);
  }
  assert.equal(party.roundIndex, 0, 'Neugabe darf die Runde nicht weiterzaehlen');
  assert.equal(party.attempt, 1);
});

test('Bot sagt bei Vorfuehrung ein Solo an', () => {
  const rs = makeRuleSet({ rounds: 4, pflichtsolo: true });
  const party = startRound(createParty(rs, FOUR, 909));
  const forced = party.current!.forcedSoloSeat;
  assert.notEqual(forced, null);

  const action = botAction(viewFor(party.current!, forced!))!;
  assert.equal(action.type, 'vorbehalt');
  assert.equal((action as { kind: unknown }).kind, 'solo');
});

test('Bot lehnt die moralische Pflichtansage ab und bestaetigt die zwingende', () => {
  const base = {
    seat: 1,
    isMyTurn: false,
  } as unknown as PlayerView;

  const moral = {
    ...base,
    pendingPflichtansage: { seat: 1, trickPoints: 29, canDecline: true },
  } as PlayerView;
  assert.deepEqual(botAction(moral), {
    type: 'confirmPflichtansage',
    seat: 1,
    accept: false,
  });

  const mandatory = {
    ...base,
    pendingPflichtansage: { seat: 1, trickPoints: 32, canDecline: false },
  } as PlayerView;
  assert.deepEqual(botAction(mandatory), {
    type: 'confirmPflichtansage',
    seat: 1,
    accept: true,
  });
});

test('Kartenwahl: sticht knapp statt mit der staerksten Karte', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const mk = (key: string, id: number) => ({
    suit: key[0] as 'C' | 'S' | 'H' | 'D',
    rank: key.slice(1) as 'A' | 'T' | 'K' | 'Q' | 'J' | '9',
    id,
  });

  // Gegner fuehrt mit Karo-Koenig. Der Bot koennte mit Dulle oder Karo-Ass
  // stechen; er soll das billigere, knapper reichende Karo-Ass nehmen.
  const view = {
    seat: 2,
    order,
    myParty: 're',
    knownParties: {},
    currentTrick: [{ card: mk('DK', 1), seat: 1 }],
    legal: [mk('HT', 2), mk('DA', 3), mk('D9', 4)],
    hand: [mk('HT', 2), mk('DA', 3), mk('D9', 4)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 3);
});

test('Kartenwahl: schmiert, wenn ein bekannter Partner den Stich haelt', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'solo', solo: 'suitC' }, rs);
  const mk = (key: string, id: number) => ({
    suit: key[0] as 'C' | 'S' | 'H' | 'D',
    rank: key.slice(1) as 'A' | 'T' | 'K' | 'Q' | 'J' | '9',
    id,
  });

  const view = {
    seat: 2,
    order,
    myParty: 'kontra',
    knownParties: { 0: 're', 1: 'kontra', 2: 'kontra', 3: 'kontra' },
    currentTrick: [{ card: mk('SA', 1), seat: 1 }],
    legal: [mk('ST', 2), mk('S9', 3), mk('SK', 4)],
    hand: [mk('ST', 2), mk('S9', 3), mk('SK', 4)],
  } as unknown as PlayerView;

  // Partner fuehrt mit dem Ass: die wertvollste Karte drauflegen.
  const chosen = chooseCard(view);
  assert.equal(chosen.id, 2);
  assert.equal(cardValue(chosen), 10);
});

test('Kartenwahl: wirft die billigste Karte ab, wenn nichts zu holen ist', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);
  const mk = (key: string, id: number) => ({
    suit: key[0] as 'C' | 'S' | 'H' | 'D',
    rank: key.slice(1) as 'A' | 'T' | 'K' | 'Q' | 'J' | '9',
    id,
  });

  const view = {
    seat: 2,
    order,
    myParty: 're',
    knownParties: {},
    currentTrick: [{ card: mk('HT', 1), seat: 1 }],
    legal: [mk('DA', 2), mk('D9', 3), mk('DK', 4)],
    hand: [mk('DA', 2), mk('D9', 3), mk('DK', 4)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 3); // Karo-Neun, null Augen
});

test('Bot verschenkt weniger Augen als reiner Zufall', () => {
  // Kein Anspruch auf Spielstaerke. Die Heuristik soll aber messbar besser
  // sein als zufaelliges Kartenlegen, sonst waere sie ihren Code nicht wert.
  // Sitze 0 und 2 spielen mit Heuristik, 1 und 3 rein zufaellig.
  const rng = makeRng(2468);
  const rs = makeRuleSet({ rounds: 4, pflichtsolo: false, pflichtansage: false });

  let botPoints = 0;
  let randomPoints = 0;

  for (let i = 0; i < 400; i++) {
    let state = createRound(rs, FOUR, i % 4, 60000 + i);

    let steps = 0;
    while (state.phase !== 'finished' && state.phase !== 'redeal' && steps++ < 200) {
      const seat = currentActor(state);
      if (seat === null) break;
      const view = viewFor(state, seat);

      if (state.phase === 'playing' && (seat === 1 || seat === 3)) {
        const card = view.legal[Math.floor(rng() * view.legal.length)];
        state = applyRound(state, { type: 'playCard', seat, cardId: card.id });
        continue;
      }
      const action = botAction(view);
      if (!action) break;
      state = applyRound(state, action);
    }

    if (state.phase !== 'finished') continue;

    for (const trick of state.tricks) {
      const pts = sumValues(trick.played.map((p) => p.card));
      if (trick.winnerSeat === 0 || trick.winnerSeat === 2) botPoints += pts;
      else randomPoints += pts;
    }
  }

  assert.ok(
    botPoints > randomPoints * 1.05,
    `Heuristik kaum besser als Zufall: ${botPoints} gegen ${randomPoints}`,
  );
});
