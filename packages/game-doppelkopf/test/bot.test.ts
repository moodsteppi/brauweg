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
  inRundenpause,
  pauseSeats,
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

    // Rundenpause: Alle tippen "Weiter", wie am echten Tisch.
    let warten = 0;
    while (inRundenpause(party) && warten++ < 10) {
      const offen = pauseSeats(party).filter((s) => !party.weiter.includes(s));
      party = act(party, { type: 'weiter', seat: offen[0]! });
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

const mk = (key: string, id: number) => ({
  suit: key[0] as 'C' | 'S' | 'H' | 'D',
  rank: key.slice(1) as 'A' | 'T' | 'K' | 'Q' | 'J' | '9',
  id,
});
const VOLLE_HAENDE = { 0: 9, 1: 9, 2: 9, 3: 9 };

test('Kartenwahl: verheizt das Karo-Ass nicht, wenn noch zwei drueberkommen', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Gegner fuehrt mit Karo-Koenig, der Bot sitzt an zweiter Stelle. Er
  // koennte mit Dulle oder Karo-Ass stechen. Beides waere falsch: Das Ass
  // schlagen achtzehn von sechsundzwanzig Truempfen, und fuer vier Augen
  // gibt niemand die Dulle her. Also ziehen lassen.
  const view = {
    seat: 2,
    order,
    myParty: 're',
    knownParties: {},
    handCounts: VOLLE_HAENDE,
    currentTrick: [{ card: mk('DK', 1), seat: 1 }],
    legal: [mk('HT', 2), mk('DA', 3), mk('D9', 4)],
    hand: [mk('HT', 2), mk('DA', 3), mk('D9', 4)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 4, 'soll die Karo-Neun abwerfen');
});

test('Kartenwahl: als Letzter nimmt er den Stich auch mit dem Ass', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Derselbe Stich, nur sitzt der Bot als Letzter. Jetzt kann niemand mehr
  // drueber, und die knappste ausreichende Karte ist genau richtig.
  const view = {
    seat: 3,
    order,
    myParty: 're',
    knownParties: {},
    handCounts: VOLLE_HAENDE,
    currentTrick: [
      { card: mk('DT', 1), seat: 0 },
      { card: mk('D9', 5), seat: 1 },
      { card: mk('DK', 6), seat: 2 },
    ],
    legal: [mk('HT', 2), mk('DA', 3)],
    hand: [mk('HT', 2), mk('DA', 3)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 3, 'soll mit dem Karo-Ass nehmen');
});

test('Kartenwahl: muss er stechen, nimmt er die billigste Gewinnkarte', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Karo-Zehn angespielt, Bot an zweiter Stelle, und beide seiner Trumpf-
  // karten gewinnen. Dann die Kreuz-Dame: Sie haelt den Stich und kostet
  // drei Augen statt elf.
  const view = {
    seat: 2,
    order,
    myParty: 're',
    knownParties: {},
    handCounts: VOLLE_HAENDE,
    currentTrick: [{ card: mk('DT', 1), seat: 1 }],
    legal: [mk('DA', 2), mk('CQ', 3)],
    hand: [mk('DA', 2), mk('CQ', 3), mk('S9', 4)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 3, 'soll die Kreuz-Dame nehmen');
});

test('Anspiel: Fehl-Ass statt der billigsten Karte', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Frueher legte der Bot hier die Karo-Neun ab - also einen Trumpf,
  // verschenkt. Ein Ass, das man aufhebt, wird spaeter gestochen.
  const hand = [mk('D9', 1), mk('SA', 2), mk('S9', 3), mk('H9', 4)];
  const view = {
    seat: 0,
    order,
    myParty: 're',
    knownParties: {},
    handCounts: VOLLE_HAENDE,
    currentTrick: [],
    legal: hand,
    hand,
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 2, 'soll das Pik-Ass anspielen');
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
    handCounts: VOLLE_HAENDE,
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
      // "weiter" gehoert zur Partie-Maschine; auf Rundenebene ist Schluss.
      if (!action || action.type === 'weiter') break;
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

test('Partei: erkennt den Partner an der gespielten Kreuz-Dame', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Sitz 1 hat irgendwann eine Kreuz-Dame gelegt. Die Runde fuehrt ihn
  // seitdem als Re - dauerhaft, auch viele Stiche spaeter. Der Bot ist
  // selbst Re, also ist Sitz 1 sein Partner und sein Ass wird geschmiert.
  const view = {
    seat: 2,
    order,
    gameType: { kind: 'normal' },
    myParty: 're',
    knownParties: { 1: 're' },
    handCounts: VOLLE_HAENDE,
    currentTrick: [{ card: mk('SA', 1), seat: 1 }],
    legal: [mk('ST', 2), mk('S9', 3)],
    hand: [mk('ST', 2), mk('S9', 3)],
  } as unknown as PlayerView;

  const gewaehlt = chooseCard(view);
  assert.equal(gewaehlt.id, 2, 'soll die Pik-Zehn schmieren');
  assert.equal(cardValue(gewaehlt), 10);
});

test('Partei: schmiert nicht auf den Gegner, der die Kreuz-Dame zeigte', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Gleiche Lage, aber der Bot ist Kontra. Sitz 1 ist damit Gegner, und
  // sein Ass bekommt die billigste Karte statt der Zehn.
  const view = {
    seat: 2,
    order,
    gameType: { kind: 'normal' },
    myParty: 'kontra',
    knownParties: { 1: 're' },
    handCounts: VOLLE_HAENDE,
    currentTrick: [{ card: mk('SA', 1), seat: 1 }],
    legal: [mk('ST', 2), mk('S9', 3)],
    hand: [mk('ST', 2), mk('S9', 3)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 3, 'soll die Pik-Neun abwerfen');
});

test('Partei: eine einzelne Kreuz-Dame verraet nichts ueber die uebrigen Sitze', () => {
  const rs = makeRuleSet();
  const order = buildOrder({ kind: 'normal' }, rs);

  // Sitz 1 zeigte eine Kreuz-Dame, ist also Re. Ueber Sitz 3 folgt daraus
  // nichts: Sitz 1 koennte beide Damen halten und still allein spielen.
  // Also wird auf Sitz 3 nicht geschmiert.
  const view = {
    seat: 2,
    order,
    gameType: { kind: 'normal' },
    myParty: 'kontra',
    knownParties: { 1: 're' },
    handCounts: VOLLE_HAENDE,
    currentTrick: [{ card: mk('SA', 1), seat: 3 }],
    legal: [mk('ST', 2), mk('S9', 3)],
    hand: [mk('ST', 2), mk('S9', 3)],
  } as unknown as PlayerView;

  assert.equal(chooseCard(view).id, 3, 'soll nicht schmieren');
});

test('Vorbehalt: sagt an, was die Hand vorgibt — aber nie freiwillig ein Solo', () => {
  const base = { seat: 1, isMyTurn: true, phase: 'vorbehalt', forcedSolo: false };

  const faelle: { erlaubt: string[]; erwartet: string | null }[] = [
    { erlaubt: ['solo', 'schmeiss'], erwartet: 'schmeiss' },
    { erlaubt: ['solo', 'armut'], erwartet: 'armut' },
    { erlaubt: ['solo', 'hochzeit'], erwartet: 'hochzeit' },
    // Nur ein Solo im Angebot heisst: gesundes Blatt. Der Bot bleibt gesund.
    { erlaubt: ['solo'], erwartet: null },
    { erlaubt: [], erwartet: null },
    // Schmeissen geht vor: eine Hand, die man wegwerfen darf, spielt man nicht.
    { erlaubt: ['schmeiss', 'armut', 'hochzeit'], erwartet: 'schmeiss' },
  ];

  for (const f of faelle) {
    const view = { ...base, allowedVorbehalte: f.erlaubt } as unknown as PlayerView;
    const action = botAction(view)!;
    assert.equal(action.type, 'vorbehalt');
    assert.equal(
      (action as { kind: unknown }).kind,
      f.erwartet,
      `bei [${f.erlaubt.join(', ')}]`,
    );
  }
});
