/**
 * Easy Poker als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Engine einander kennen.
 *
 * Der interessante Teil ist — wie bei Mememory — die Schaupause. Nach jeder
 * Hand muessen die gezeigten Karten einen Moment liegen bleiben, bevor neu
 * gegeben wird. Das ist eine Uhr, und ein Spielmodul ist ausdruecklich uhrlos.
 * Geloest ueber `interludeMs` / `advanceInterlude`: Das Modul nennt nur die
 * Dauer, gemessen wird sie von der Plattform (server/src/runtime/party.ts).
 * Ein eigener Timer im Modul waere nicht nur verboten, er ueberlebte auch
 * keinen Serverneustart.
 */

import type {
  BotLevel,
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import { botZug } from './bot.js';
import {
  type EasyPokerAktion,
  type EasyPokerPartie,
  beendePause,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  amZug,
  pauseDauerMs,
  platzierungen,
  sitzeVon,
} from './partie.js';
import {
  DEFAULT_REGELN,
  type EasyPokerRegeln,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import { type EasyPokerSicht, sichtFuer, zuschauerSicht } from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 2;

type GespeichertePartie = EasyPokerPartie & { readonly v: number };

const meta: GameMeta = {
  id: 'easypoker',
  nameKey: 'game.easypoker',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: (seats) => rotationSize(seats),
  suggestedRounds: (seats) => suggestedRounds(seats),
  /**
   * Eine ausgeteilte Pokerhand ist keine gelegte Karte. Zaehlte sie als
   * solche, fuellte eine einzige Partie die Kartenaufgabe des Tages — dieselbe
   * Ueberlegung wie bei Feldherr und Mememory.
   */
  xpBasisZaehltKarten: false,
};

export const easypoker: GameModule<
  EasyPokerPartie,
  EasyPokerAktion,
  EasyPokerSicht,
  EasyPokerRegeln
> = {
  meta,
  protocolVersion: 2,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = pruefeRegeln(config);
    if (probleme.length > 0) return probleme;
    if (!SEAT_COUNTS.includes(seats)) {
      probleme.push({ path: 'seats', messageKey: 'error.seatCountUnsupported', severity: 'error' });
    }
    return probleme;
  },

  createParty({ config, seats, rounds, seed, seedHex }: CreatePartyOptions<EasyPokerRegeln>) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    // Die Hexkette, wenn es sie gibt: Ein 32-Bit-Zahlenseed liesse sich
    // durchprobieren, und wer ihn hat, kennt jede Karte des Gegners.
    return erstellePartie(config, sitze, seedHex ?? seed, rounds);
  },

  act: (partie, sitz, aktion) => fuehreAus(partie, sitz, aktion),

  currentActor: (partie) => amZug(partie),

  legalActions: (partie, sitz) => erlaubteZuege(partie, sitz),

  isFinished: (partie) => partie.fertig,

  interludeMs: (partie) => pauseDauerMs(partie),

  advanceInterlude: (partie) => beendePause(partie),

  standings: (partie): PartyStanding[] => platzierungen(partie),

  markLeft: (partie, sitz) => markiereVerlassen(partie, sitz),

  viewFor: (partie, sitz) => sichtFuer(partie, sitz),

  spectatorView: (partie) => zuschauerSicht(partie),

  botAction(sicht: EasyPokerSicht, level?: BotLevel) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht, level);
  },

  /**
   * Grundlage der Erfahrungspunkte: die eigenen Karten der abgeschlossenen
   * Haende, also zwei je Hand.
   *
   * Nicht die Jetons — sonst bekaeme der Verlierer einer langen Partie gar
   * nichts, obwohl er genauso lange gespielt hat. Und nicht die Anzahl der
   * Zuege, sonst lohnte sich Zoegern.
   */
  xpBasis: (partie) =>
    Object.fromEntries(sitzeVon(partie).map((sitz) => [sitz, partie.abgeschlossen * 2])),

  /**
   * Der Zustand ist reines JSON. Die Version kommt trotzdem mit: Ein Snapshot
   * aus einer aelteren Fassung soll als Fehler auffallen und nicht
   * stillschweigend falsch gedeutet werden.
   */
  serialize: (partie) => ({ v: SNAPSHOT_VERSION, ...partie }),

  deserialize(roh) {
    const snap = roh as GespeichertePartie;
    if (snap.v !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v: _v, ...rest } = snap;
    return rest as EasyPokerPartie;
  },
};
