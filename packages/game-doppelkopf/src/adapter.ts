/**
 * Doppelkopf als Spielmodul der Plattform.
 *
 * Diese Datei ist die EINZIGE Stelle, an der Plattform und Doppelkopf-Engine
 * einander kennen. Die Engine bleibt unveraendert; sie weiss nichts von
 * Tischen, Konten oder Troph\u00e4en.
 *
 * Zwei Dinge werden hier ergaenzt, weil die Engine sie bewusst nicht kennt:
 *
 *   1. Die Engine liefert die Sicht auf RUNDEN-Ebene. Die Plattform braucht
 *      sie zusammen mit dem Partiestand (Punkte, Rundenzahl, Bock-Faktor).
 *      Das wird in DokoView zusammengefuehrt.
 *
 *   2. Eine Zuschauersicht gibt es in der Engine nicht. Sie entsteht hier,
 *      indem Hand und alles daraus Abgeleitete weggelassen werden.
 */

import type {
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import {
  type AbsageLevel,
  type BockWindow,
  type PartyState,
  type RoundAction,
  type RuleSet,
  type PlayerView,
  BockState,
  DEFAULT_RULESET,
  isTrump,
  mayAnnounce,
  act as partyAct,
  createParty as engineCreateParty,
  botAction as engineBotAction,
  currentActor as roundCurrentActor,
  finishParty,
  markLeft as engineMarkLeft,
  rotationSize,
  startRound,
  upcomingMultiplier,
  validateRuleSet,
  viewFor as roundViewFor,
} from './index.js';

// ---------------------------------------------------------------------------
// Sicht
// ---------------------------------------------------------------------------

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht und darf ihn nicht auswerten,
 * aber er muss einen unlesbaren Snapshot als Fehler erkennen koennen statt
 * ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 1;

type SerializedParty = Omit<PartyState, 'bock'> & {
  readonly v: number;
  readonly bock: readonly BockWindow[];
};

export interface DokoView {
  /** Rundensicht der Engine. Bei Zuschauern ohne Hand. */
  readonly round: PlayerView | null;
  readonly roundIndex: number;
  readonly totalRounds: number;
  readonly scores: Readonly<Record<number, number>>;
  /** Bock-Faktor der kommenden Runde, damit der Client ihn anzeigen kann. */
  readonly nextMultiplier: number;
  readonly botSeats: readonly number[];
  readonly leftSeats: readonly number[];
  readonly finished: boolean;
  /** true = neutrale Zuschauersicht ohne jede Hand. */
  readonly spectator: boolean;
}

const meta: GameMeta = {
  id: 'doppelkopf',
  nameKey: 'game.doppelkopf',
  availability: 'playable',
  seatCounts: [3, 4, 5],
  rotationSize(seats) {
    // 3er-Tisch hat einen Dauerbot, die Rotation umfasst trotzdem 4 Geber.
    return rotationSize(seats as 3 | 4 | 5);
  },
  suggestedRounds(seats) {
    const r = rotationSize(seats as 3 | 4 | 5);
    return [r * 1, r * 2, r * 3, r * 5];
  },
};

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/** Entfernt alles, was einem Zuschauer einen Vorteil verschaffen wuerde. */
function stripHand(view: PlayerView): PlayerView {
  return {
    ...view,
    hand: [],
    legal: [],
    myParty: null,
    isMyTurn: false,
    allowedVorbehalte: [],
    forcedSolo: false,
    soloOptions: [],
    armut: { role: null, awaiting: null, handoverSize: 0 },
  };
}

/**
 * Prueft, ob ueberhaupt ein Regelsatz vorliegt.
 *
 * Verglichen wird gegen die Felder des Standardregelsatzes: Jedes muss da sein
 * und denselben Typ haben. Das haelt auch eine spaetere neue Option
 * automatisch mit, ohne dass hier eine Liste gepflegt werden muss.
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
    const expected = Array.isArray(standard) ? 'array' : typeof standard;
    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (expected !== actual) {
      problems.push({ path: key, messageKey: 'ruleset.fieldWrongType', severity: 'error' });
    }
  }

  return problems;
}

function wrap(party: PartyState, round: PlayerView | null, spectator: boolean): DokoView {
  return {
    round,
    roundIndex: party.roundIndex,
    totalRounds: party.rs.rounds,
    scores: party.scores,
    nextMultiplier: upcomingMultiplier(party),
    botSeats: party.botSeats,
    leftSeats: party.leftSeats,
    finished: party.finished,
    spectator,
  };
}

// ---------------------------------------------------------------------------
// Modul
// ---------------------------------------------------------------------------

export const doppelkopf: GameModule<PartyState, RoundAction, DokoView, RuleSet> = {
  meta,
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_RULESET,

  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[] {
    // Erst die Form, dann der Inhalt. Der Regelsatz kommt als JSON von aussen;
    // fehlt die Haelfte der Felder, findet der Validator darin keinen
    // Widerspruch und winkt ihn durch. Der Tisch flaege dann erst beim
    // Spielstart auseinander, weit weg von der Ursache.
    const malformed = shapeProblems(config);
    if (malformed.length > 0) return malformed;

    const ruleSet = config as RuleSet;
    const problems: ConfigProblem[] = validateRuleSet(ruleSet).map((issue) => ({
      // Der Validator liefert Codes, keine Feldpfade. Die Zuordnung Code ->
      // Formularfeld liegt im Client, damit Meldungen am Feld erscheinen.
      path: issue.code,
      messageKey: `ruleset.${issue.code}`,
      severity: issue.severity,
    }));

    const rot = rotationSize(seats as 3 | 4 | 5);
    if (rounds % rot !== 0) {
      problems.push({
        path: 'rounds',
        messageKey: 'error.roundsNotMultipleOfRotation',
        severity: 'error',
      });
    }
    return problems;
  },

  createParty({ config, seats, rounds, seed, seedHex }: CreatePartyOptions<RuleSet>) {
    const rot = rotationSize(seats as 3 | 4 | 5);
    const rotationSeats = Array.from({ length: rot }, (_, i) => i);
    // 3er-Tisch: der vierte Rotationssitz ist ein Dauerbot.
    const botSeats = seats === 3 ? [3] : [];
    const rs: RuleSet = { ...config, tableSize: seats as 3 | 4 | 5, rounds };
    return startRound(
      engineCreateParty(rs, rotationSeats, seed, botSeats, seedHex ?? null),
    );
  },

  act(party, seat, action) {
    // Der Server prueft hier, dass niemand fuer einen fremden Sitz handelt.
    // Die Engine validiert danach die Regelkonformitaet ein zweites Mal.
    if (action.seat !== seat) {
      throw new Error('Aktion gehoert zu einem anderen Sitz');
    }
    const next = partyAct(party, action);
    return next.current === null && !next.finished ? startRound(next) : next;
  },

  currentActor(party) {
    return party.current ? roundCurrentActor(party.current) : null;
  },

  legalActions(party, seat) {
    const st = party.current;
    if (!st) return [];

    const v = roundViewFor(st, seat);
    const actions: RoundAction[] = [];

    // Die Pflichtansage blockiert alles andere: Solange sie offen ist, ist sie
    // die einzige Aktion des betroffenen Sitzes. Ab 30 Augen gibt es nur
    // Bestaetigen, bei 29 ist Ablehnen erlaubt.
    if (v.pendingPflichtansage) {
      if (v.pendingPflichtansage.seat !== seat) return [];
      actions.push({ type: 'confirmPflichtansage', seat, accept: true });
      if (v.pendingPflichtansage.canDecline) {
        actions.push({ type: 'confirmPflichtansage', seat, accept: false });
      }
      return actions;
    }

    // Ansagen laufen parallel zum Stichverlauf und haengen NICHT am Zugrecht.
    // Die Frist bemisst sich an den eigenen bereits gespielten Karten, nicht
    // daran, wer gerade dran ist. Deshalb steht dieser Block vor isMyTurn.
    if (v.phase === 'playing' && v.myParty && st.rs.announcements) {
      const own = st.cardsPlayed[seat] ?? 0;
      const made = v.myParty === 're' ? v.announcements.re : v.announcements.kontra;
      const absage =
        v.myParty === 're' ? v.announcements.reAbsage : v.announcements.kontraAbsage;

      if (!made && mayAnnounce(0, own)) {
        actions.push({ type: 'announce', seat, level: 0 });
      }
      // Jede Absage setzt die vorherige Stufe voraus, also gibt es immer
      // hoechstens eine naechste Stufe.
      const next = (absage + 1) as AbsageLevel;
      if (st.rs.absagen && next <= 4 && mayAnnounce(next, own)) {
        actions.push({ type: 'announce', seat, level: next });
      }
    }

    if (!v.isMyTurn) return actions;

    if (v.phase === 'vorbehalt') {
      for (const kind of v.allowedVorbehalte) {
        if (kind === 'solo') {
          for (const solo of v.soloOptions) {
            actions.push({ type: 'vorbehalt', seat, kind: 'solo', solo });
          }
        } else {
          actions.push({ type: 'vorbehalt', seat, kind });
        }
      }
      // "Gesund" ist keine Option aus allowedVorbehalte, sondern deren
      // Abwesenheit. Wer vorgefuehrt wird, hat sie nicht.
      if (!v.forcedSolo) {
        actions.push({ type: 'vorbehalt', seat, kind: null });
      }
    }

    if (v.armut.awaiting === 'decide') {
      actions.push({ type: 'armutAccept', seat });
      actions.push({ type: 'armutDecline', seat });
    }

    if (v.armut.awaiting === 'handover') {
      // Wer Truempfe hat, gibt zwingend ALLE ab. Das ist genau eine Aktion,
      // also gehoert sie hierher und nicht in eine Kartenauswahl im Client.
      const trumps = v.hand.filter((card) => isTrump(card, v.order));
      if (trumps.length > 0) {
        actions.push({
          type: 'armutHandover',
          seat,
          cards: trumps.map((card) => card.id),
        });
      }
      // Ohne Trumpf sind es drei frei gewaehlte Karten. Die bleiben, wie die
      // Rueckgabe des Partners, eine Auswahl im Client: Sie liessen sich nur
      // als alle Teilmengen aufzaehlen, und drei aus zwoelf sind 220 Aktionen.
      // Rolle, Erwartung und Anzahl stehen in view.round.armut; geprueft wird
      // die Aktion ohnehin serverseitig in act.
    }

    for (const card of v.legal) {
      actions.push({ type: 'playCard', seat, cardId: card.id });
    }
    return actions;
  },

  isFinished: (party) => party.finished,

  standings(party): PartyStanding[] {
    const done = party.finished ? party : finishParty(party);
    const sorted = [...done.seats].sort((a, b) => (done.scores[b] ?? 0) - (done.scores[a] ?? 0));

    return done.seats.map((seat) => {
      const points = done.scores[seat] ?? 0;
      // Gleichstand teilt sich denselben Platz.
      const place = sorted.findIndex((s) => (done.scores[s] ?? 0) === points) + 1;
      return { seat, points, place, left: done.leftSeats.includes(seat) };
    });
  },

  markLeft: (party, seat) => engineMarkLeft(party, seat),

  viewFor(party, seat) {
    const round = party.current ? roundViewFor(party.current, seat) : null;
    return wrap(party, round, false);
  },

  spectatorView(party) {
    // Sitz 0 dient nur als Ausgangspunkt; die Hand wird anschliessend entfernt.
    const round = party.current ? stripHand(roundViewFor(party.current, 0)) : null;
    return wrap(party, round, true);
  },

  botAction(view) {
    if (!view.round) throw new Error('Keine laufende Runde');
    // Der Bot der Engine arbeitet ausschliesslich auf PlayerView und kann
    // deshalb bauartbedingt nicht schummeln. Die Zuschauersicht waere fuer ihn
    // unbrauchbar, also wird sie hier ausgeschlossen.
    if (view.spectator) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    const action = engineBotAction(view.round);
    if (!action) throw new Error('Bot fand keine gueltige Aktion');
    return action;
  },

  /** Beim Doppelkopf ist ein Abschnitt genau eine abgerechnete Runde. */
  completedSegments: (party) => party.history,

  /**
   * PartyState ist bis auf ein Feld reines JSON. `bock` ist eine BockState mit
   * Methoden; ginge sie durch JSON, kaeme ein Objekt ohne multiplier() zurueck
   * und der naechste Rundenstart wuerde scheitern. Genau dieser Weg wird nach
   * jedem Railway-Neustart gegangen, deshalb wird das Feld ausdruecklich
   * uebersetzt statt durchgereicht.
   */
  serialize(party) {
    const { bock, ...rest } = party;
    return { v: SNAPSHOT_VERSION, ...rest, bock: bock.snapshot() };
  },

  deserialize(raw) {
    const snap = raw as SerializedParty;
    if (snap.v !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v: _v, bock, ...rest } = snap;
    return { ...rest, bock: BockState.restore(rest.rs, bock) } as PartyState;
  },
};
