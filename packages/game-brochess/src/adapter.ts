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
 * andere dran. Seit dem 22.10.2026 gibt es eine Schachuhr (`schachuhr` in
 * game-api): Die Plattform misst, das Modul regelt Zuschlag und Zeitablauf.
 * Ohne Zeitkontrolle im Regelsatz bleibt es bei der Zugzeit der Plattform.
 *
 * Eine Ausnahme von „legalActions ist vollstaendig" gibt es seitdem doch:
 * Aufgeben steht nicht darin (Begruendung an `erlaubteZuege`).
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
  restzeit,
  verbraucheZeit,
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
 *
 * 2 seit dem 22.10.2026 (Zugliste und Schachuhr). Eine Partie aus Fassung 1
 * laeuft weiter: ohne Uhr und mit leerer Zugliste — mehr wusste sie nicht.
 */
const SNAPSHOT_VERSION = 2;
const codec = snapshotCodec<BroChessPartie>(SNAPSHOT_VERSION);

function ladeSnapshot(raw: unknown): BroChessPartie {
  const snap = raw as { v?: unknown } | null;
  if (snap && snap.v === 1) {
    const alt = codec.deserialize({ ...snap, v: SNAPSHOT_VERSION }) as BroChessPartie & {
      verlauf?: string[];
      uhr?: BroChessPartie['uhr'];
    };
    return { ...alt, verlauf: alt.verlauf ?? [], uhr: alt.uhr ?? null };
  }
  return codec.deserialize(raw);
}

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
  /**
   * 1 seit dem 24. September 2026 — die erste Fassung. 2 seit dem 22.10.2026:
   * Aufgeben als Aktion, Uhr, Zugliste, Material und Vorab-Ziele in der Sicht.
   */
  protocolVersion: 2,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig: (config: unknown, seats: number, rounds: number): ConfigProblem[] =>
    pruefeRegeln(config, seats, rounds),

  createParty: ({ config, seed }: CreatePartyOptions<BroChessRegeln>) =>
    erstellePartie(config, seed),

  act: (partie, sitz, aktion) => fuehreAus(partie, sitz, aktion),

  currentActor: (partie) => amZug(partie),

  legalActions: (partie, sitz) => erlaubteZuege(partie, sitz),

  schachuhr: {
    restMs: (partie, sitz) => restzeit(partie, sitz),
    verbrauche: (partie, sitz, ms) => verbraucheZeit(partie, sitz, ms),
  },

  isFinished: (partie) => partie.ende !== null,

  standings: (partie): PartyStanding[] => platzierungen(partie),

  markLeft: (partie, sitz) => markiereVerlassen(partie, sitz),

  viewFor: (partie, sitz) => sichtFuer(partie, sitz),

  spectatorView: (partie) => zuschauerSicht(partie),

  botAction(sicht, level) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht, level);
  },

  serialize: codec.serialize,
  deserialize: ladeSnapshot,
};
