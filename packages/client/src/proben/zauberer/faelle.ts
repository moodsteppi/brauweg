/**
 * Erfundene Sichten des Zauberer-Tisches, von Hand geschrieben — fuer den
 * Schaukasten (`Schaukasten.tsx`) und die Sprachprobe
 * (`screens/WizardTable.sprache.test.tsx`).
 *
 * Sie kommen NICHT aus dem Modul, damit beide auch dann zeichnen, wenn das
 * Modul gerade nicht baut. Dass die Form stimmt, prueft der Typ
 * (`WizardGameView`) und der Vertrag unter `src/vertrag/wizard.test.ts`.
 *
 *   gebot (Vorgabe) · trumpf · spiel · blind · runde · tafel · pause
 *
 * `runde` und `tafel` zeigen den Tisch wie `spiel`; die beiden Blaetter legt
 * der Schaukasten selbst darueber (am echten Tisch oeffnen sie erst nach einer
 * gespielten Runde bzw. auf einen Tipp).
 */

import type {
  Action,
  Card,
  PartyMessage,
  SeatInfo,
  TableMessage,
  ViewMessage,
  WizardGameView,
  WizardRoundSummary,
  WizardRoundView,
} from '../../protocol';
import type { TableConnection } from '../../useTable';

export const FAELLE = ['gebot', 'trumpf', 'spiel', 'blind', 'runde', 'tafel', 'pause'] as const;

const nichts = (): void => undefined;

const k = (id: number, suit: string, rank: string): Card => ({ id, suit, rank }) as Card;

export const SITZE: SeatInfo[] = [
  { seat: 0, displayName: 'Mia', accountId: null, isBot: false, avatarUrl: null },
  { seat: 1, displayName: 'Jonas', accountId: null, isBot: false, avatarUrl: null },
  { seat: 2, displayName: null, accountId: null, isBot: true, avatarUrl: null },
  { seat: 3, displayName: 'Lea', accountId: null, isBot: false, avatarUrl: null },
];

const HAND: Card[] = [
  k(1, 'Z', '1'),
  k(2, 'H', '13'),
  k(3, 'H', '7'),
  k(4, 'C', '11'),
  k(5, 'N', '2'),
];

export const GESCHICHTE: WizardRoundSummary[] = [1, 2, 3, 4].map((nummer, i) => ({
  roundIndex: i,
  roundNumber: nummer,
  dealer: i % 4,
  upcard: null,
  trump: ['H', 'C', null, 'S'][i] ?? null,
  bids: { 0: 1, 1: 0, 2: nummer > 2 ? 2 : 1, 3: 0 },
  tricks: { 0: 1, 1: 1, 2: nummer > 2 ? 2 : 0, 3: 0 },
  scores: { 0: 30, 1: -10, 2: nummer > 2 ? 40 : -10, 3: 20 },
  totals: { 0: 30 * nummer, 1: -10 * nummer, 2: 10 * nummer, 3: 20 * nummer },
}));

function runde(teil: Partial<WizardRoundView>): WizardRoundView {
  return {
    seat: 0,
    phase: 'playing',
    roundNumber: 5,
    handSize: 5,
    seats: [0, 1, 2, 3],
    dealer: 3,
    hand: HAND,
    legal: [],
    legalBids: [],
    blind: false,
    blindHands: null,
    handCounts: { 0: 5, 1: 5, 2: 5, 3: 5 },
    bids: {},
    bidsRevealed: true,
    bidTotal: null,
    tricks: { 0: 0, 1: 0, 2: 0, 3: 0 },
    currentTrick: [],
    lastTrick: null,
    turn: 0,
    isMyTurn: false,
    upcard: k(90, 'H', '9'),
    trump: 'H',
    awaitingTrump: null,
    order: { trumps: ['H13', 'H7'] },
    ...teil,
  } as WizardRoundView;
}

interface Fall {
  runde: WizardRoundView;
  legal: Action[];
  amZug: number | null;
}

function fallFuer(name: string): Fall {
  switch (name) {
    case 'trumpf':
      return {
        runde: runde({ phase: 'trump', upcard: k(91, 'Z', '3'), trump: null, awaitingTrump: 0 }),
        legal: ['C', 'S', 'H', 'D'].map((suit) => ({ type: 'chooseTrump', seat: 0, suit })),
        amZug: 0,
      };
    case 'blind':
      return {
        runde: runde({
          roundNumber: 1,
          handSize: 1,
          hand: [],
          blind: true,
          blindHands: { 1: [k(11, 'S', '12')], 2: [k(12, 'N', '1')], 3: [k(13, 'D', '4')] },
          handCounts: { 0: 1, 1: 1, 2: 1, 3: 1 },
          bids: { 0: 1, 1: 0, 2: 0, 3: 1 },
          bidTotal: 2,
          upcard: k(92, 'C', '5'),
          trump: 'C',
        }),
        legal: [{ type: 'playBlind', seat: 0 }],
        amZug: 0,
      };
    case 'spiel':
    case 'runde':
    case 'tafel':
    case 'pause':
      return {
        runde: runde({
          phase: 'playing',
          handCounts: { 0: 4, 1: 3, 2: 3, 3: 4 },
          hand: HAND.slice(0, 4),
          bids: { 0: 2, 1: 1, 2: 0, 3: 1 },
          bidTotal: 4,
          tricks: { 0: 1, 1: 1, 2: 0, 3: 0 },
          currentTrick: [
            { seat: 1, card: k(21, 'H', '3') },
            { seat: 2, card: k(22, 'H', '10') },
          ],
          lastTrick: {
            winnerSeat: 1,
            played: [
              { seat: 0, card: k(31, 'D', '2') },
              { seat: 1, card: k(32, 'D', '12') },
            ],
          },
        } as Partial<WizardRoundView>),
        legal: [],
        amZug: 3,
      };
    default:
      // Ansage: Mia sagt als Vorletzte an, Jonas und der Bot schon vor ihr.
      // Die 2 fehlt in der Liste — so sieht der gesperrte Knopf aus.
      return {
        runde: runde({ phase: 'bidding', bids: { 1: 1, 2: 2 }, bidTotal: 3 }),
        legal: [0, 1, 3, 4, 5].map((tricks) => ({ type: 'bid', seat: 0, tricks })),
        amZug: 0,
      };
  }
}

/** Die Verbindung, wie `useTable` sie liefern wuerde — fuer den genannten Fall. */
export function verbindungFuer(fall: string): TableConnection<WizardGameView> {
  const gewaehlt = fallFuer(fall);

  const sicht: ViewMessage<WizardGameView> = {
    v: 1,
    game: 'wizard',
    type: 'view',
    tableId: 'schaukasten',
    revision: 1,
    seat: 0,
    view: {
      roundIndex: 4,
      totalRounds: 15,
      scores: { 0: 120, 1: -40, 2: 40, 3: 80 },
      finished: false,
      spectator: false,
      round: gewaehlt.runde,
      history: GESCHICHTE,
    },
    legalActions: gewaehlt.legal,
    currentActor: gewaehlt.amZug,
    turnDeadline: Date.now() + 25_000,
    interludeDeadline: null,
    phaseDeadline: null,
    botSeats: [2],
    leftSeats: [],
    finished: false,
    ruleSetVersion: 1,
  };

  const partie: PartyMessage = {
    v: 1,
    game: 'wizard',
    type: 'party',
    tableId: 'schaukasten',
    standings: [],
    seats: SITZE,
  };

  const tisch: TableMessage = {
    v: 1,
    game: 'wizard',
    type: 'table',
    tableId: 'schaukasten',
    status: 'running',
    seats: SITZE,
    missing: 0,
    rounds: 15,
    visibility: fall === 'pause' ? 'club_only' : 'public',
    paused: fall === 'pause',
    botLevel: 'standard',
  };

  const verbindung = {
    view: sicht,
    party: partie,
    table: tisch,
    error: null,
    connected: true,
    status: 'connected',
    send: nichts,
    emotes: {},
    sendEmote: nichts,
    addBot: nichts,
    removeBot: nichts,
    startNow: nichts,
    setBotLevel: nichts,
    setSeatColor: nichts,
  } as unknown as TableConnection<WizardGameView>;

  return verbindung;
}
