/**
 * Partiesimulation ueber die Modulschnittstelle.
 *
 * Die uebrigen Testdateien pruefen Einzelteile; hier laufen ganze Partien
 * durch, und zwar GENAU SO, wie der Server sie spielt: ueber `wizard.*`, nie
 * ueber die Engine direkt. Was hier bricht, bricht am echten Tisch.
 *
 * Zahl der Partien: klein per Vorgabe, damit `npm test` schnell bleibt. Fuer
 * eine echte Jagd
 *
 *     WIZARD_SIM_PARTIEN=300 npm test --workspace @brauweg/game-wizard
 *
 * Der Keim jeder Partie steht in jeder Fehlermeldung - eine gefundene Partie
 * laesst sich damit einzeln nachspielen (siehe `spieleDurch`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BotLevel } from '@brauweg/game-api';

import { wizard, type WizardView } from '../src/adapter.js';
import { fullRounds } from '../src/cards.js';
import type { PartyState } from '../src/party.js';
import type { RoundAction } from '../src/round.js';
import { DEFAULT_RULESET, type RuleSet } from '../src/ruleset.js';
import { scoreFor } from '../src/scoring.js';

const PARTIEN = Number(process.env.WIZARD_SIM_PARTIEN ?? 24);
/** WIZARD_SIM_TIEF=1 prueft jede Partie tief, statt nur jede vierte. */
const TIEF_IMMER = process.env.WIZARD_SIM_TIEF === '1';
const STUFEN: readonly BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];

/** mulberry32 - nur fuer die Auswahl der Partieaufbauten, nie fuers Geben. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Aufbau {
  readonly nummer: number;
  readonly seats: number;
  readonly rounds: number;
  readonly level: BotLevel;
  readonly seed: number;
  readonly seedHex: string;
  readonly rs: RuleSet;
}

/** Alle acht Hausregeln, damit keine unbeachtet bleibt. */
const HAUSREGELN = [
  'bidSumForbidden',
  'zeroBonus',
  'hiddenBids',
  'blindFirstRound',
  'lastSpecialWins',
  'dealerPicksBlind',
  'noTrump',
  'jesterPicksTrump',
] as const;

function aufbau(nummer: number): Aufbau {
  const z = rng(nummer * 7919 + 13);
  const seats = [3, 4, 5, 6][nummer % 4]!;
  const voll = fullRounds(seats);
  // Von der kurzen bis zur vollen Partie - die letzte Runde einer vollen
  // Partie ist der Sonderfall ohne aufgedeckte Karte und muss vorkommen.
  const rounds = nummer % 5 === 0 ? voll : 1 + Math.floor(z() * voll);

  const patch: Record<string, boolean> = {};
  for (const regel of HAUSREGELN) patch[regel] = z() < 0.35;

  // Widersprueche wegnehmen, statt sie neu zu wuerfeln: Der Validator lehnt
  // diese Paare ab, und eine Simulation gegen einen abgelehnten Regelsatz
  // wuerde nur den Validator noch einmal pruefen.
  if (patch.noTrump) {
    patch.jesterPicksTrump = false;
    patch.dealerPicksBlind = false;
  }
  if (patch.hiddenBids) patch.bidSumForbidden = false;

  return {
    nummer,
    seats,
    rounds,
    level: STUFEN[nummer % STUFEN.length]!,
    seed: 1000 + nummer,
    seedHex: (nummer * 0x9e3779b1 >>> 0).toString(16).padStart(8, '0').repeat(4),
    rs: { ...DEFAULT_RULESET, ...patch, tableSize: seats, rounds } as RuleSet,
  };
}

// ---------------------------------------------------------------------------
// Invarianten einer einzelnen Sicht
// ---------------------------------------------------------------------------

function pruefeSpielersicht(party: PartyState, seat: number, wo: string): void {
  const sicht = wizard.viewFor(party, seat) as WizardView;
  const runde = sicht.round;
  if (!runde) return;

  assert.equal(runde.seat, seat, `${wo}: fremder Sitz in der eigenen Sicht`);
  assert.equal(sicht.spectator, false, `${wo}: Spielersicht als Zuschauersicht markiert`);

  // Die eigene Hand ist die eigene - und niemand sonst bekommt Karten mit.
  const st = party.current!;
  const echt = st.hands[seat] ?? [];
  // Verdeckt ist die eigene Hand genau in zwei Faellen - in der blinden Runde
  // und waehrend der blinden Trumpfwahl des Gebers. Sonst nie. Beide
  // Richtungen zaehlen: Eine Hausregel, die nichts verbirgt, ist so falsch wie
  // eine, die zu viel verbirgt.
  const sollVerdeckt =
    st.blind || (st.phase === 'trump' && st.rs.dealerPicksBlind && seat === st.dealer);
  const eigeneVerdeckt = runde.hand.length === 0 && echt.length > 0;
  if (echt.length > 0) {
    assert.equal(eigeneVerdeckt, sollVerdeckt, `${wo}: eigene Hand falsch verdeckt`);
  }
  if (!eigeneVerdeckt) {
    assert.deepEqual(
      [...runde.hand].map((k) => k.id).sort((a, b) => a - b),
      [...echt].map((k) => k.id).sort((a, b) => a - b),
      `${wo}: eigene Hand stimmt nicht`,
    );
  }

  // Fremde Haende: nur in der blinden Runde, und dort ohne die eigene.
  if (runde.blindHands) {
    assert.ok(party.current!.blind, `${wo}: fremde Haende ausserhalb der blinden Runde`);
    assert.ok(!(seat in runde.blindHands), `${wo}: eigene Karte in der blinden Sicht`);
    assert.equal(runde.hand.length, 0, `${wo}: eigene Hand in der blinden Runde sichtbar`);
  }

  // Verdeckte Ansagen bleiben verdeckt - auch als Summe.
  if (!runde.bidsRevealed) {
    const fremde = Object.keys(runde.bids).filter((k) => Number(k) !== seat);
    assert.deepEqual(fremde, [], `${wo}: fremde Ansage trotz verdeckter Ansagen`);
    assert.equal(runde.bidTotal, null, `${wo}: Ansagesumme trotz verdeckter Ansagen`);
  }

  // Legale Karten sind eine Teilmenge der eigenen Hand.
  for (const karte of runde.legal) {
    assert.ok(
      runde.hand.some((eigen) => eigen.id === karte.id),
      `${wo}: legale Karte liegt nicht auf der eigenen Hand`,
    );
  }
}

function pruefeZuschauersicht(party: PartyState, wo: string): void {
  const sicht = wizard.spectatorView(party) as WizardView;
  assert.equal(sicht.spectator, true, `${wo}: Zuschauersicht nicht markiert`);
  const runde = sicht.round;
  if (!runde) return;

  assert.equal(runde.seat, null, `${wo}: Zuschauer sitzt an einem Platz`);
  assert.equal(runde.hand.length, 0, `${wo}: Zuschauer sieht eine Hand`);
  assert.equal(runde.legal.length, 0, `${wo}: Zuschauer bekommt spielbare Karten`);
  assert.equal(runde.legalBids.length, 0, `${wo}: Zuschauer bekommt Ansagen`);
  assert.equal(runde.blindHands, null, `${wo}: Zuschauer sieht die blinden Haende`);
  assert.equal(runde.isMyTurn, false, `${wo}: Zuschauer ist am Zug`);
  if (!runde.bidsRevealed) {
    assert.deepEqual(runde.bids, {}, `${wo}: Zuschauer sieht verdeckte Ansagen`);
    assert.equal(runde.bidTotal, null, `${wo}: Zuschauer sieht die verdeckte Summe`);
  }
}

// ---------------------------------------------------------------------------
// Eine Partie
// ---------------------------------------------------------------------------

/**
 * Kartenerhaltung innerhalb einer Runde.
 *
 * Eine Karte, die einmal gespielt ist, darf nie wieder auf einer Hand liegen,
 * und die Zahl der Karten im Spiel muss konstant bleiben. Beides bricht bei
 * jedem Kopierfehler in `afterPlay` - und beides sieht man einer Punktetafel
 * nicht mehr an.
 */
function pruefeKartenerhaltung(party: PartyState, gespielt: Set<number>, wo: string): void {
  const st = party.current;
  if (!st) return;

  const aufHand = st.seats.flatMap((s) => (st.hands[s] ?? []).map((k) => k.id));
  assert.equal(new Set(aufHand).size, aufHand.length, `${wo}: eine Karte liegt doppelt`);
  for (const id of aufHand) {
    assert.ok(!gespielt.has(id), `${wo}: gespielte Karte ${id} liegt wieder auf einer Hand`);
  }
  if (st.upcard) {
    assert.ok(!aufHand.includes(st.upcard.id), `${wo}: aufgedeckte Karte liegt auf einer Hand`);
  }

  const stiche = Object.values(st.tricks).reduce((x, y) => x + y, 0);
  assert.equal(
    aufHand.length + st.currentTrick.length + stiche * st.seats.length,
    st.seats.length * st.handSize,
    `${wo}: Karten sind verschwunden oder dazugekommen`,
  );

  // Der Gewinner spielt den naechsten Stich an.
  if (st.phase === 'playing' && st.currentTrick.length === 0 && st.lastTrick) {
    assert.equal(st.turn, st.lastTrick.winnerSeat, `${wo}: nicht der Stichgewinner spielt aus`);
  }
}

/** Bedienpflicht unabhaengig vom Sichtfilter nachgerechnet. */
function pruefeBedienpflicht(party: PartyState, seat: number, wo: string): void {
  const st = party.current;
  if (!st || st.phase !== 'playing' || st.blind) return;

  const hand = st.hands[seat] ?? [];
  const legal = wizard.viewFor(party, seat).round!.legal;

  // Angespielte Farbe von Hand bestimmen: Zauberer hebt die Pflicht auf,
  // Narren zaehlen nicht mit.
  let lead: string | null = null;
  for (const eintrag of st.currentTrick) {
    if (eintrag.card.suit === 'Z') { lead = null; break; }
    if (eintrag.card.suit === 'N') continue;
    lead = eintrag.card.suit;
    break;
  }

  const hatFarbe = lead !== null && hand.some((k) => k.suit === lead);
  const erwartet = hatFarbe
    ? hand.filter((k) => k.suit === lead || k.suit === 'Z' || k.suit === 'N')
    : hand;

  assert.deepEqual(
    [...legal].map((k) => k.id).sort((x, y) => x - y),
    [...erwartet].map((k) => k.id).sort((x, y) => x - y),
    `${wo}: Bedienpflicht falsch berechnet`,
  );
}

/**
 * Die Gegenprobe zu "act wirft nie bei legaler Aktion": Alles, was
 * `legalActions` NICHT anbietet, muss die Engine ablehnen.
 *
 * Ohne diese Richtung ist die Schnittstelle nur halb geprueft - und genau hier
 * lag der Fund vom 31.08. (playCard in der blinden Runde, siehe
 * `regression.test.ts`). Der Server verlaesst sich darauf, dass das Modul
 * seine eigene Auskunft einhaelt.
 */
function pruefeUnerlaubtesWirdAbgelehnt(party: PartyState, sitze: readonly number[], wo: string): void {
  const st = party.current;
  if (!st) return;

  const kandidaten: RoundAction[] = [];
  for (const seat of sitze) {
    for (const suit of ['C', 'S', 'H', 'D'] as const) kandidaten.push({ type: 'chooseTrump', seat, suit });
    for (let tricks = 0; tricks <= st.handSize; tricks++) kandidaten.push({ type: 'bid', seat, tricks });
    kandidaten.push({ type: 'playBlind', seat });
    for (const karte of st.hands[seat] ?? []) kandidaten.push({ type: 'playCard', seat, cardId: karte.id });
  }

  for (const aktion of kandidaten) {
    const erlaubt = wizard
      .legalActions(party, aktion.seat)
      .some((e) => JSON.stringify(e) === JSON.stringify(aktion));
    if (erlaubt) continue;
    assert.throws(
      () => wizard.act(party, aktion.seat, aktion),
      `${wo}: ${JSON.stringify(aktion)} wird angenommen, steht aber nicht in legalActions`,
    );
  }
}

interface Bilanz {
  readonly zuege: number;
  readonly runden: number;
}

/**
 * Eine Partie zu Ende spielen.
 *
 * `zufall` ersetzt den Bot durch eine gleichverteilte Wahl aus `legalActions`.
 * Der Bot spielt deterministisch und laesst deshalb ganze Zustandsecken nie
 * entstehen - eine Ansage von 0 mit vier Zauberern auf der Hand etwa. Genau
 * dort liegen die Fehler, die 851 gruene Tests nicht zeigen.
 */
export function spieleDurch(a: Aufbau, tief = true, zufall: (() => number) | null = null): Bilanz {
  const sitze = Array.from({ length: a.seats }, (_, i) => i);

  // Der Regelsatz muss die eigene Pruefung bestehen, sonst pruefen wir Unsinn.
  const probleme = wizard
    .validateConfig(a.rs, a.seats, a.rounds)
    .filter((p) => p.severity === 'error');
  assert.deepEqual(probleme, [], `Partie ${a.nummer}: Regelsatz abgelehnt`);

  let party = wizard.createParty({
    config: a.rs,
    seats: a.seats,
    rounds: a.rounds,
    seed: a.seed,
    seedHex: a.seedHex,
    botSeats: sitze,
    botLevel: a.level,
  });

  // Harte Zugobergrenze: Trumpfwahl plus Ansage plus eine Karte je Sitz und
  // Stich, grosszuegig verdoppelt. Wer sie reisst, dreht sich im Kreis.
  const grenze = 2 * a.rounds * (a.seats * (a.rounds + 2)) + 100;
  let zuege = 0;
  let gespielt = new Set<number>();
  let rundeVorher = party.roundIndex;

  while (!wizard.isFinished(party)) {
    const wo = `Partie ${a.nummer} (Keim ${a.seed}, ${a.seats} Sitze, ${a.rounds} Runden, ${a.level}), Zug ${zuege}`;
    assert.ok(++zuege <= grenze, `${wo}: Zugobergrenze gerissen`);

    const seat = wizard.currentActor(party);
    assert.ok(seat !== null, `${wo}: niemand am Zug, Partie laeuft aber`);

    const erlaubt = wizard.legalActions(party, seat) as RoundAction[];
    assert.ok(erlaubt.length > 0, `${wo}: Sitz ${seat} ist am Zug, darf aber nichts`);

    // Kein anderer Sitz darf handeln, solange dieser am Zug ist.
    for (const anderer of sitze) {
      if (anderer === seat) continue;
      assert.deepEqual(
        wizard.legalActions(party, anderer),
        [],
        `${wo}: Sitz ${anderer} darf handeln, obwohl ${seat} am Zug ist`,
      );
    }

    if (tief) {
      for (const s of sitze) pruefeSpielersicht(party, s, wo);
      pruefeZuschauersicht(party, wo);
      pruefeKartenerhaltung(party, gespielt, wo);
      pruefeBedienpflicht(party, seat, wo);
      // Die Aktionsprobe kostet ein Vielfaches eines Zuges (jede denkbare
      // Aktion jedes Sitzes). Jeder fuenfte Zug genuegt: Die Phasen wechseln
      // langsamer als das.
      if (zuege % 5 === 0) pruefeUnerlaubtesWirdAbgelehnt(party, sitze, wo);

      // Snapshot: was der Server speichert, muss dasselbe Spiel ergeben.
      const zurueck = wizard.deserialize(wizard.serialize(party));
      assert.deepEqual(
        JSON.parse(JSON.stringify(wizard.viewFor(zurueck, seat))),
        JSON.parse(JSON.stringify(wizard.viewFor(party, seat))),
        `${wo}: Sicht ueberlebt den Snapshot nicht`,
      );
      assert.deepEqual(
        wizard.legalActions(zurueck, seat),
        erlaubt,
        `${wo}: legale Aktionen ueberleben den Snapshot nicht`,
      );
      assert.equal(wizard.currentActor(zurueck), seat, `${wo}: Zugrecht ueberlebt den Snapshot nicht`);
    }

    let aktion: RoundAction;
    if (zufall) {
      aktion = erlaubt[Math.floor(zufall() * erlaubt.length)]!;
    } else {
      aktion = wizard.botAction(wizard.viewFor(party, seat), a.level);
      assert.ok(
        erlaubt.some((e) => JSON.stringify(e) === JSON.stringify(aktion)),
        `${wo}: Bot spielt ${JSON.stringify(aktion)}, erlaubt waere nur ${JSON.stringify(erlaubt)}`,
      );
    }

    // Merken, bevor die Karte die Hand verlaesst.
    if (aktion.type === 'playCard') gespielt.add(aktion.cardId);
    if (aktion.type === 'playBlind') {
      gespielt.add((party.current!.hands[seat] ?? [])[0]!.id);
    }

    const vorher = party;
    party = wizard.act(party, seat, aktion);
    assert.notEqual(party, vorher, `${wo}: Aktion hat nichts veraendert`);

    // Neue Runde: Die Buchhaltung der alten gilt nicht weiter.
    if (party.roundIndex !== rundeVorher) {
      gespielt = new Set<number>();
      rundeVorher = party.roundIndex;
    }
  }

  // --- Endabrechnung -------------------------------------------------------
  const ende = `Partie ${a.nummer} (Keim ${a.seed}, ${a.seats} Sitze, ${a.rounds} Runden, ${a.level})`;
  const sicht = wizard.spectatorView(party) as WizardView;
  assert.equal(sicht.finished, true, `${ende}: Partie nicht als beendet gemeldet`);
  assert.equal(party.history.length, a.rounds, `${ende}: falsche Rundenzahl`);

  const laufend: Record<number, number> = Object.fromEntries(sitze.map((s) => [s, 0]));
  for (const runde of party.history) {
    const wo = `${ende}, Runde ${runde.roundNumber}`;

    // Stichzahl der Runde ist die Handgroesse - kein Stich verschwindet.
    assert.equal(
      Object.values(runde.tricks).reduce((x, y) => x + y, 0),
      runde.roundNumber,
      `${wo}: Stichsumme passt nicht zur Kartenzahl`,
    );

    for (const s of sitze) {
      const bid = runde.bids[s];
      assert.ok(
        bid !== undefined && bid >= 0 && bid <= runde.roundNumber,
        `${wo}: Ansage ${bid} von Sitz ${s} liegt ausserhalb`,
      );
      assert.equal(
        runde.scores[s],
        scoreFor(bid!, runde.tricks[s]!, runde.roundNumber, a.rs),
        `${wo}: Punkte von Sitz ${s} folgen nicht der Wertung`,
      );
      laufend[s] = laufend[s]! + runde.scores[s]!;
      assert.equal(runde.totals[s], laufend[s], `${wo}: Gesamtstand von Sitz ${s} stimmt nicht`);
    }

    if (a.rs.bidSumForbidden) {
      assert.notEqual(
        Object.values(runde.bids).reduce((x, y) => x + y, 0),
        runde.roundNumber,
        `${wo}: Ansagesumme geht auf, obwohl das verboten ist`,
      );
    }
  }

  // Platzierung muss zum Punktestand passen.
  const platz = wizard.standings(party);
  assert.equal(platz.length, a.seats, `${ende}: unvollstaendige Platzierung`);
  for (const eintrag of platz) {
    assert.equal(eintrag.points, laufend[eintrag.seat], `${ende}: Punktzahl der Platzierung`);
  }
  for (const x of platz) {
    for (const y of platz) {
      if (x.points > y.points) {
        assert.ok(x.place < y.place, `${ende}: mehr Punkte, aber schlechterer Platz`);
      }
      if (x.points === y.points) {
        assert.equal(x.place, y.place, `${ende}: Gleichstand mit verschiedenen Plaetzen`);
      }
    }
  }

  return { zuege, runden: party.history.length };
}

// ---------------------------------------------------------------------------

test(`Simulation: ${PARTIEN} vollstaendige Partien ueber die Modulschnittstelle`, () => {
  let zuege = 0;
  let runden = 0;
  const gesehen = { seats: new Set<number>(), level: new Set<BotLevel>() };

  for (let nummer = 0; nummer < PARTIEN; nummer++) {
    const a = aufbau(nummer);
    // Die tiefe Pruefung (jede Sicht, jeder Snapshot, jeden Zug) kostet das
    // Vielfache eines Zuges. Bei grossen Laeufen genuegt sie auf jeder
    // vierten Partie; die Regel- und Abrechnungsinvarianten laufen immer.
    const bilanz = spieleDurch(a, TIEF_IMMER || PARTIEN <= 40 || nummer % 4 === 0);
    zuege += bilanz.zuege;
    runden += bilanz.runden;
    gesehen.seats.add(a.seats);
    gesehen.level.add(a.level);
  }

  assert.deepEqual([...gesehen.seats].sort(), [3, 4, 5, 6], 'nicht alle Sitzzahlen gespielt');
  assert.equal(gesehen.level.size, STUFEN.length, 'nicht alle Botstufen gespielt');
  assert.ok(zuege > 0 && runden > 0);
});

test(`Simulation: ${PARTIEN} Partien mit gleichverteilt gewaehlten Aktionen`, () => {
  // Der Bot ist berechenbar und meidet dieselben Ecken jedes Mal. Wer statt
  // seiner gleichverteilt aus `legalActions` waehlt, erreicht Zustaende, die
  // kein Bot je herstellt - und genau die sind ungetestet.
  for (let nummer = 0; nummer < PARTIEN; nummer++) {
    const a = aufbau(nummer + 10_000);
    spieleDurch(a, TIEF_IMMER || PARTIEN <= 40 || nummer % 4 === 0, rng(nummer * 2654435761 + 7));
  }
});

test('Simulation: Aussteiger mitten in der Partie aendern nichts am Ablauf', () => {
  // Am echten Tisch geht jemand mitten in Runde 3. Die Partie laeuft mit Bot
  // weiter - und muss danach dieselben Invarianten halten wie vorher.
  for (let nummer = 0; nummer < Math.max(4, Math.floor(PARTIEN / 4)); nummer++) {
    const a = aufbau(nummer + 20_000);
    const sitze = Array.from({ length: a.seats }, (_, i) => i);
    let party = wizard.createParty({
      config: a.rs,
      seats: a.seats,
      rounds: a.rounds,
      seed: a.seed,
      seedHex: a.seedHex,
      botSeats: [],
      botLevel: a.level,
    });

    let zuege = 0;
    const grenze = 2 * a.rounds * (a.seats * (a.rounds + 2)) + 100;
    while (!wizard.isFinished(party)) {
      const wo = `Aussteigerpartie ${a.nummer}, Zug ${zuege}`;
      assert.ok(++zuege <= grenze, `${wo}: Zugobergrenze gerissen`);

      // Nach ein paar Zuegen steigt einer aus, kurz darauf noch einer. Die
      // Zahlen sind klein gewaehlt, weil eine Partie ueber eine Runde mit drei
      // Sitzen nur wenige Zuege hat.
      if (zuege === 3) party = wizard.markLeft(party, sitze[1]!);
      if (zuege === 6) party = wizard.markLeft(party, sitze[0]!);
      // Doppeltes Melden darf nichts kaputt machen.
      if (zuege === 7) party = wizard.markLeft(party, sitze[1]!);

      const seat = wizard.currentActor(party);
      assert.ok(seat !== null, `${wo}: niemand am Zug`);
      const erlaubt = wizard.legalActions(party, seat) as RoundAction[];
      assert.ok(erlaubt.length > 0, `${wo}: Sitz ${seat} darf nichts`);
      const aktion = wizard.botAction(wizard.viewFor(party, seat), a.level);
      assert.ok(
        erlaubt.some((e) => JSON.stringify(e) === JSON.stringify(aktion)),
        `${wo}: Bot spielt Unerlaubtes`,
      );
      party = wizard.act(party, seat, aktion);
    }

    assert.equal(party.history.length, a.rounds, `Aussteigerpartie ${a.nummer}: falsche Rundenzahl`);
    const platz = wizard.standings(party);
    assert.equal(platz.filter((p) => p.left).length, 2, `Aussteigerpartie ${a.nummer}: Aussteiger fehlen`);
    for (const runde of party.history) {
      assert.equal(
        Object.values(runde.tricks).reduce((x, y) => x + y, 0),
        runde.roundNumber,
        `Aussteigerpartie ${a.nummer}, Runde ${runde.roundNumber}: Stichsumme`,
      );
    }
  }
});
