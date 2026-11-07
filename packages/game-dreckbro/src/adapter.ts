/**
 * DreckBro als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und DreckBro-Kern einander kennen.
 *
 * DreckBro haelt sich an alle ueblichen Annahmen der Schnittstelle (wie
 * BroChess, anders als die Sonderfaelle aus CLAUDE.md): feste Zugfolge,
 * `currentActor` nennt den Sitz, der wirklich spielen muss, und
 * `legalActions` ist VOLLSTAENDIG — jede Karte mit jedem moeglichen Ziel
 * steht einzeln drin, dazu das Abwerfen jeder Handkarte. Der Bildschirm
 * hebt daraus die Ziele hervor und prueft selbst nichts.
 */

import {
  type ConfigProblem,
  type CreatePartyOptions,
  type GameMeta,
  type GameModule,
  type PartyStanding,
  snapshotCodec,
} from '@brauweg/game-api';

import { botZug } from './bot.js';
import {
  type DreckBroAktion,
  type DreckBroPartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  platzierungen,
} from './partie.js';
import {
  type DreckBroRegeln,
  DEFAULT_REGELN,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import { type DreckBroSicht, sichtFuer, zuschauerSicht } from './sicht.js';

const SNAPSHOT_VERSION = 1;

const meta: GameMeta = {
  id: 'dreckbro',
  nameKey: 'game.dreckbro',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
};

export const dreckbro: GameModule<DreckBroPartie, DreckBroAktion, DreckBroSicht, DreckBroRegeln> = {
  meta,
  /** 1 seit dem 4. November 2026 — die erste Fassung. */
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig: (config: unknown, seats: number, rounds: number): ConfigProblem[] =>
    pruefeRegeln(config, seats, rounds),

  // Die Hexkette, wo es sie gibt: 32 Bit Zahlensaat liessen sich
  // durchprobieren, und wer seine Hand kennt, kennt danach den Stapel.
  createParty: ({ seats, seed, seedHex }: CreatePartyOptions<DreckBroRegeln>) =>
    erstellePartie(seats, seedHex ?? String(seed)),

  act: (partie, sitz, aktion) => fuehreAus(partie, sitz, aktion),

  currentActor: (partie) => amZug(partie),

  legalActions: (partie, sitz) => erlaubteZuege(partie, sitz),

  isFinished: (partie) => partie.ende !== null,

  standings: (partie): PartyStanding[] => platzierungen(partie),

  markLeft: (partie, sitz) => markiereVerlassen(partie, sitz),

  viewFor: (partie, sitz) => sichtFuer(partie, sitz),

  spectatorView: (partie) => zuschauerSicht(partie),

  botAction(sicht) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht);
  },

  ...snapshotCodec<DreckBroPartie>(SNAPSHOT_VERSION),

  /** Eine gespielte Karte ist eine gelegte Karte; Abwerfen zaehlt nicht. */
  xpBasis: (partie) => Object.fromEntries(partie.gespielt.map((n, s) => [s, n])),
};
