/**
 * BroChess als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Schachkern einander kennen.
 *
 * Schach haelt sich an alle ueblichen Annahmen der Schnittstelle, anders als
 * die fuenf Sonderfaelle aus CLAUDE.md: feste Zugfolge, `currentActor` nennt
 * den Sitz, der wirklich ziehen muss, und `legalActions` ist VOLLSTAENDIG —
 * jeder legale Zug steht einzeln drin, auch jede der vier Umwandlungen. Der
 * Bildschirm hebt daraus die Zielfelder hervor und prueft selbst nichts.
 *
 * Es gibt keine Schaupause und keine Phasenfrist: Nach einem Zug ist der
 * andere dran, und die Zugzeit der Plattform genuegt als Uhr. Eine
 * Schachuhr ist bewusst nicht Teil dieses Moduls.
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
  type BroChessAktion,
  type BroChessPartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  platzierungen,
} from './partie.js';
import {
  type BroChessRegeln,
  DEFAULT_REGELN,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import { type BroChessSicht, sichtFuer, zuschauerSicht } from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert — der Server muss einen unlesbaren Snapshot als Fehler erkennen,
 * statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 1;

const meta: GameMeta = {
  id: 'brochess',
  nameKey: 'game.brochess',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /** Eine gezogene Figur ist keine gelegte Karte (wie bei Filler und Feldherr). */
  xpBasisZaehltKarten: false,
};

export const brochess: GameModule<BroChessPartie, BroChessAktion, BroChessSicht, BroChessRegeln> = {
  meta,
  /** 1 seit dem 24. September 2026 — die erste Fassung. */
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig: (config: unknown, seats: number, rounds: number): ConfigProblem[] =>
    pruefeRegeln(config, seats, rounds),

  createParty: ({ config, seed }: CreatePartyOptions<BroChessRegeln>) =>
    erstellePartie(config, seed),

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

  ...snapshotCodec<BroChessPartie>(SNAPSHOT_VERSION),
};
