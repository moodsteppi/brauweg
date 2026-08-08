/**
 * Cambio als Spielmodul der Plattform.
 *
 * Diese Datei ist die EINZIGE Stelle, an der Plattform und Engine einander
 * kennen. Die Engine weiss nichts von Tischen, Konten oder Trophaeen.
 *
 * Zwei Dinge kommen hier dazu, weil die Engine sie bewusst nicht kennt:
 *
 *   1. Die Engine liefert die Sicht auf RUNDEN-Ebene. Die Plattform braucht
 *      sie zusammen mit dem Partiestand (Punkte, Rundenzahl, Punktetafel).
 *   2. Eine Zuschauersicht ohne jede Karte.
 */

import type {
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import {
  type PartyState,
  type RoundSummary,
  act as partyAct,
  createParty as engineCreateParty,
  endePause,
  markLeft as engineMarkLeft,
  standings as engineStandings,
  startRound,
} from './party.js';
import {
  type RoundAction,
  currentActor as roundCurrentActor,
  legalActions as roundLegalActions,
} from './round.js';
import {
  DEFAULT_RULESET,
  HAND_SIZE,
  type RuleSet,
  SEAT_COUNTS,
  rotationSize,
  suggestedRounds,
} from './ruleset.js';
import { validateRuleSet } from './validator.js';
import {
  type PlayerView,
  spectatorView as roundSpectatorView,
  viewFor as roundViewFor,
} from './view.js';
import { botAction as engineBotAction } from './bot.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 1;

type SerializedParty = PartyState & { readonly v: number };

export interface CambioView {
  /** Rundensicht der Engine. Bei Zuschauern ohne jede Karte. */
  readonly round: PlayerView | null;
  readonly roundIndex: number;
  readonly totalRounds: number;
  readonly scores: Readonly<Record<number, number>>;
  /**
   * Alle abgerechneten Runden. Oeffentlich - am Ende jeder Runde lagen die
   * Haende ohnehin offen. Der Client baut daraus die Punktetafel.
   */
  readonly history: readonly RoundSummary[];
  readonly botSeats: readonly number[];
  readonly leftSeats: readonly number[];
  readonly finished: boolean;
  /** true = neutrale Zuschauersicht ohne jede Karte. */
  readonly spectator: boolean;
}

const meta: GameMeta = {
  id: 'cambio',
  nameKey: 'game.cambio',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: (seats) => rotationSize(seats),
  suggestedRounds: (seats) => suggestedRounds(seats),
};

/**
 * Prueft, ob ueberhaupt ein Regelsatz vorliegt.
 *
 * Verglichen wird gegen die Felder des Standardregelsatzes: Jedes muss da sein
 * und denselben Typ haben. Das haelt auch eine spaetere neue Option
 * automatisch mit.
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
    if (typeof value !== typeof standard) {
      problems.push({ path: key, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }

  return problems;
}

function wrap(party: PartyState, round: PlayerView | null, spectator: boolean): CambioView {
  return {
    round,
    roundIndex: party.roundIndex,
    totalRounds: party.rs.rounds,
    scores: party.scores,
    history: party.history,
    botSeats: [],
    leftSeats: party.leftSeats,
    finished: party.finished,
    spectator,
  };
}

export const cambio: GameModule<PartyState, RoundAction, CambioView, RuleSet> = {
  meta,
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_RULESET,

  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[] {
    // Erst die Form, dann der Inhalt: Fehlt die Haelfte der Felder, findet der
    // Validator darin keinen Widerspruch und winkt Unsinn durch.
    const malformed = shapeProblems(config);
    if (malformed.length > 0) return malformed;

    const ruleSet: RuleSet = { ...(config as RuleSet), tableSize: seats, rounds };
    const problems: ConfigProblem[] = validateRuleSet(ruleSet).map((issue) => ({
      path: issue.code,
      messageKey: `ruleset.${issue.code}`,
      severity: issue.severity,
    }));

    if (!SEAT_COUNTS.includes(seats)) {
      problems.push({
        path: 'seats',
        messageKey: 'error.seatCountUnsupported',
        severity: 'error',
      });
    }

    return problems;
  },

  createParty({ config, seats, rounds, seed, seedHex }: CreatePartyOptions<RuleSet>) {
    const rs: RuleSet = { ...config, tableSize: seats, rounds };
    const sitze = Array.from({ length: seats }, (_, i) => i);
    return startRound(engineCreateParty(rs, sitze, seed, seedHex ?? null));
  },

  act(party, seat, action) {
    // Der Server prueft hier, dass niemand fuer einen fremden Sitz handelt.
    // Die Engine validiert danach die Regelkonformitaet ein zweites Mal.
    if (action.seat !== seat) throw new Error('Aktion gehoert zu einem anderen Sitz');
    // Endet die Runde, beginnt NICHT sofort die naechste: Es folgt die
    // Rundenpause, in der die aufgedeckten Haende zu sehen sind.
    return partyAct(party, action);
  },

  /**
   * Rundenpause als Schaupause der Plattform.
   *
   * Zwoelf Sekunden - lang genug, um vier aufgedeckte Haende zu lesen und zu
   * sehen, ob der Ruf aufging; kurz genug, dass der Tisch nie an einem
   * abwesenden Spieler haengt.
   */
  interludeMs: (party) => (party.pause ? 12_000 : null),

  advanceInterlude(party) {
    if (!party.pause) return party;
    const next = endePause(party);
    return next.finished ? next : startRound(next);
  },

  currentActor(party) {
    return party.current ? roundCurrentActor(party.current) : null;
  },

  legalActions(party, seat) {
    return party.current ? roundLegalActions(party.current, seat) : [];
  },

  isFinished: (party) => party.finished,

  standings(party): PartyStanding[] {
    return engineStandings(party);
  },

  markLeft: (party, seat) => engineMarkLeft(party, seat),

  viewFor(party, seat) {
    const round = party.current ? roundViewFor(party.current, seat) : null;
    return wrap(party, round, false);
  },

  spectatorView(party) {
    const round = party.current ? roundSpectatorView(party.current) : null;
    return wrap(party, round, true);
  },

  botAction(view) {
    if (!view.round) throw new Error('Keine laufende Runde');
    if (view.spectator) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    const action = engineBotAction(view.round);
    if (!action) throw new Error('Bot fand keine gueltige Aktion');
    return action;
  },

  /** Ein Abschnitt ist genau eine abgerechnete Runde. */
  completedSegments: (party) => party.history,

  /**
   * Gelegte Karten je Sitz.
   *
   * Anders als beim Stichspiel gibt es hier keine feste Zahl - wie viele
   * Karten durch eine Hand gehen, haengt am Spielverlauf. Als Naeherung die
   * Handgroesse je gespielter Runde: gleich viel fuer alle, und laenger
   * gespielt heisst mehr Punkte.
   */
  xpBasis: (party) => {
    const karten = party.history.length * HAND_SIZE;
    return Object.fromEntries(party.seats.map((seat) => [seat, karten]));
  },

  /**
   * PartyState ist reines JSON - keine Klasse, keine Methode, kein Datum.
   * Die Version kommt trotzdem mit: Ein Snapshot aus einer aelteren Fassung
   * soll als Fehler auffallen und nicht stillschweigend falsch gedeutet werden.
   */
  serialize(party) {
    return { v: SNAPSHOT_VERSION, ...party };
  },

  deserialize(raw) {
    const snap = raw as SerializedParty;
    if (snap.v !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v: _v, ...rest } = snap;
    return rest as PartyState;
  },
};
