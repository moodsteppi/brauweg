/**
 * Skat als Spielmodul der Plattform.
 *
 * Die einzige Stelle, an der Plattform und Skat-Engine einander kennen. Die
 * Engine (round.ts, party.ts) bleibt uhr- und netzlos; hier kommt nur dazu,
 * was die Plattform braucht: die Zusammenfuehrung von Gaben-Sicht und
 * Partiestand, die Zuschauersicht ohne Hand und die Zwischenpause als
 * Schaupause.
 */

import type {
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import { DEFAULT_RULESET, type RuleSet } from './ruleset.js';
import {
  type PlayerView,
  currentActor as roundCurrentActor,
  legalActions as roundLegalActions,
  viewFor as roundViewFor,
} from './round.js';
import { validateRuleSet } from './validator.js';
import {
  ROTATION,
  type PartyAction,
  type PartyState,
  act as partyAct,
  createParty as engineCreateParty,
  endePause,
  inPause,
  markLeft as engineMarkLeft,
  pauseSeats,
  startRound,
  upcomingBock,
} from './party.js';
import { botAction as engineBotAction } from './bot.js';

const SNAPSHOT_VERSION = 1;

export interface SkatView {
  /** Gaben-Sicht der Engine. Bei Zuschauern ohne Hand. */
  readonly round: PlayerView | null;
  readonly roundIndex: number;
  readonly totalRounds: number;
  readonly scores: Readonly<Record<number, number>>;
  /** Bock-Faktor der laufenden Gabe, damit der Client ihn anzeigen kann. */
  readonly bock: number;
  readonly botSeats: readonly number[];
  readonly leftSeats: readonly number[];
  readonly finished: boolean;
  /** true = neutrale Zuschauersicht ohne jede Hand. */
  readonly spectator: boolean;
}

const meta: GameMeta = {
  id: 'skat',
  nameKey: 'game.skat',
  availability: 'playable',
  // Skat ist ein Dreierspiel. Fehlen Menschen, fuellt ein Bot den Sitz.
  seatCounts: [3],
  rotationSize() {
    return ROTATION;
  },
  suggestedRounds() {
    return [ROTATION, ROTATION * 2, ROTATION * 3, ROTATION * 4];
  },
};

/** Entfernt alles, was einem Zuschauer einen Vorteil verschaffen wuerde. */
function stripHand(view: PlayerView): PlayerView {
  return { ...view, hand: [], legal: [], ouvertHand: null, isMyTurn: false };
}

/**
 * Prueft, ob ueberhaupt ein Regelsatz vorliegt: jedes Feld des
 * Standardregelsatzes muss da sein und denselben Typ haben. So haelt auch eine
 * spaetere neue Option automatisch mit, ohne dass hier eine Liste gepflegt wird.
 */
function shapeProblems(config: unknown): ConfigProblem[] {
  if (typeof config !== 'object' || config === null) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }
  const given = config as Record<string, unknown>;
  const problems: ConfigProblem[] = [];
  for (const [key, standard] of Object.entries(DEFAULT_RULESET)) {
    const value = given[key];
    if (value === undefined) {
      problems.push({ path: key, messageKey: 'ruleset.fieldMissing', severity: 'error' });
      continue;
    }
    if (typeof standard !== typeof value) {
      problems.push({ path: key, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }
  return problems;
}

function wrap(party: PartyState, round: PlayerView | null, spectator: boolean): SkatView {
  return {
    round,
    roundIndex: party.roundIndex,
    totalRounds: party.rs.rounds,
    scores: party.scores,
    bock: upcomingBock(party),
    botSeats: party.botSeats,
    leftSeats: party.leftSeats,
    finished: party.finished,
    spectator,
  };
}

export const skat: GameModule<PartyState, PartyAction, SkatView, RuleSet> = {
  meta,
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_RULESET,

  validateConfig(config: unknown, _seats: number, rounds: number): ConfigProblem[] {
    const malformed = shapeProblems(config);
    if (malformed.length > 0) return malformed;

    const rs = config as RuleSet;
    const problems: ConfigProblem[] = validateRuleSet(rs).map((issue) => ({
      path: issue.code,
      messageKey: `ruleset.${issue.code}`,
      severity: issue.severity,
    }));
    if (rounds % ROTATION !== 0) {
      problems.push({
        path: 'rounds',
        messageKey: 'error.roundsNotMultipleOfRotation',
        severity: 'error',
      });
    }
    return problems;
  },

  createParty({ config, seats, rounds, seed, seedHex }: CreatePartyOptions<RuleSet>) {
    if (seats !== ROTATION) throw new Error('Skat wird zu dritt gespielt');
    const rotationSeats = [0, 1, 2];
    const rs: RuleSet = { ...config, tableSize: 3, rounds };
    const party = engineCreateParty(rs, rotationSeats, seed, [], seedHex ?? null);
    return startRound(party);
  },

  act(party, seat, action) {
    const next = partyAct(party, seat, action);
    // Nach Neugabe oder beendeter Pause liegt keine Gabe mehr an: die naechste
    // wird sofort ausgeteilt, damit der Tisch nie ohne laufende Gabe dasteht.
    return next.current === null && !next.finished ? startRound(next) : next;
  },

  currentActor(party) {
    if (!party.current) return null;
    // Waehrend der Zwischenpause ist niemand am Zug (die Plattform steuert die
    // Schaupause), obwohl noch eine fertige Gabe als `current` liegt.
    if (inPause(party)) return null;
    return roundCurrentActor(party.current);
  },

  legalActions(party, seat) {
    if (!party.current) return [];
    if (inPause(party)) {
      // In der Pause gibt es genau eine Aktion, das eigene "Weiter" — und auch
      // die nur fuer anwesende Menschen, die noch nicht getippt haben.
      return pauseSeats(party).includes(seat) && !party.weiter.includes(seat)
        ? [{ type: 'weiter' }]
        : [];
    }
    // Reizen, Skatwahl und Stich liefert die Engine als fertige Aktionen.
    // Druecken und Ansage baut der Client aus der Sicht (Kartenauswahl bzw.
    // Farb-/Grand-/Null-Wahl), genau wie beim Doppelkopf die Armut.
    return roundLegalActions(party.current, seat);
  },

  isFinished: (party) => party.finished,

  interludeMs: (party) => (inPause(party) ? 12_000 : null),

  advanceInterlude(party) {
    if (!inPause(party)) return party;
    const next = endePause(party);
    return next.finished ? next : startRound(next);
  },

  standings(party): PartyStanding[] {
    const sorted = [...party.seats].sort((a, b) => (party.scores[b] ?? 0) - (party.scores[a] ?? 0));
    return party.seats.map((seat) => {
      const points = party.scores[seat] ?? 0;
      const place = sorted.findIndex((s) => (party.scores[s] ?? 0) === points) + 1;
      return { seat, points, place, left: party.leftSeats.includes(seat) };
    });
  },

  markLeft: (party, seat) => engineMarkLeft(party, seat),

  viewFor(party, seat) {
    const round = party.current ? roundViewFor(party.current, seat) : null;
    return wrap(party, round, false);
  },

  spectatorView(party) {
    const round = party.current ? stripHand(roundViewFor(party.current, 0)) : null;
    return wrap(party, round, true);
  },

  botAction(view) {
    if (!view.round) throw new Error('Keine laufende Gabe');
    if (view.spectator) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    const action = engineBotAction(view.round);
    if (!action) throw new Error('Bot fand keine gueltige Aktion');
    return action;
  },

  completedSegments: (party) => party.history,

  /**
   * Gelegte Karten je Sitz: zehn je abgerechneter Gabe. Neugaben (alle
   * passen, kein Ramsch) zaehlen nicht — dort wurde keine Karte gelegt.
   */
  xpBasis: (party) => {
    const karten = party.history.length * 10;
    return Object.fromEntries(party.seats.map((seat) => [seat, karten]));
  },

  serialize(party) {
    return { v: SNAPSHOT_VERSION, ...party };
  },

  deserialize(raw) {
    const snap = raw as PartyState & { v: number };
    if (snap.v !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v: _v, ...rest } = snap;
    return rest as PartyState;
  },
};
