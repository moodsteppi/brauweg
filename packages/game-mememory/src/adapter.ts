/**
 * Mememory als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Engine einander kennen.
 *
 * Der interessante Teil ist die Schaupause. Zwei ungleiche Karten muessen kurz
 * liegen bleiben und dann zurueckdrehen — das ist eine Uhr, und ein Spielmodul
 * ist ausdruecklich uhrlos. Geloest ueber `interludeMs` / `advanceInterlude`:
 * Das Modul nennt nur die Dauer, gemessen wird sie von der Plattform
 * (packages/server/src/runtime/party.ts). Ein eigener Timer im Modul waere
 * nicht nur verboten, er ueberlebte auch keinen Serverneustart.
 */

import type {
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import { botZug } from './bot.js';
import {
  type MememoryAktion,
  type MememoryPartie,
  beendePause,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  amZug,
  pauseDauerMs,
  platzierungen,
} from './partie.js';
import { MOTIVE } from './motive.js';
import {
  DEFAULT_REGELN,
  type MememoryRegeln,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import { type MememorySicht, sichtFuer, zuschauerSicht } from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 *
 * 2 seit dem 27. August 2026: Der Zustand traegt Zugnummer, Saat und das
 * Gedaechtnis der Bots. `deserialize` nimmt die 1 weiterhin an und ergaenzt
 * die Felder — sonst braeche der Deploy jede laufende Partie, und das
 * ausgerechnet fuer eine Funktion, die diese Partien gar nicht benutzen.
 */
const SNAPSHOT_VERSION = 2;

type GespeichertePartie = MememoryPartie & { readonly v: number };

const meta: GameMeta = {
  id: 'mememory',
  nameKey: 'game.mememory',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /**
   * Eine umgedrehte Karte ist keine gelegte Karte. Zaehlte sie als solche,
   * fuellte eine einzige Mememory-Partie die Kartenaufgabe des Tages mit
   * vierzig Treffern — dieselbe Ueberlegung wie bei Feldherr.
   */
  xpBasisZaehltKarten: false,
};

export const mememory: GameModule<
  MememoryPartie,
  MememoryAktion,
  MememorySicht,
  MememoryRegeln
> = {
  meta,
  /**
   * 2 seit dem 22. August 2026: Der Client kennt den Reaktionskanal
   * (Emojis ueber den Tisch). Der Gateway schickt Reaktionen nur an
   * Verbindungen, die mindestens diese Version gemeldet haben — eine
   * unbekannte Nachricht landete bei einem aelteren Client im Sicht-Zweig
   * und leerte das Brett.
   *
   * 3 seit dem 26. August 2026: Als Reaktion kann ein gesammeltes MOTIV
   * fliegen (Feld `motiv`). Version 2 kennt die Nachricht, nicht aber das
   * Feld — sie zeigte das Emoji Nummer 0 und damit etwas anderes, als der
   * Absender geschickt hat. Der Gateway laesst Motive deshalb erst ab 3
   * durch; Emojis gehen weiterhin auch an 2.
   */
  protocolVersion: 3,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = pruefeRegeln(config);
    if (probleme.length > 0) return probleme;

    const regeln = config as MememoryRegeln;
    // Der Katalog ist die harte Grenze: Ein Brett, fuer das es nicht genug
    // Motive gibt, liesse sich nur mit doppelten Paaren fuellen — und dann
    // gaebe es vier gleiche Karten statt zwei. Zusatzmotive des Tisches
    // zaehlen mit; auf ihre Form hat pruefeRegeln schon gesehen.
    const topfGroesse = new Set([...MOTIVE, ...(regeln.zusatz ?? [])]).size;
    if ((regeln.spalten * regeln.zeilen) / 2 > topfGroesse) {
      probleme.push({
        path: 'spalten',
        messageKey: 'ruleset.zuWenigMotive',
        severity: 'error',
      });
    }
    if (!SEAT_COUNTS.includes(seats)) {
      probleme.push({ path: 'seats', messageKey: 'error.seatCountUnsupported', severity: 'error' });
    }
    return probleme;
  },

  createParty({ config, seats, seed, seedHex }: CreatePartyOptions<MememoryRegeln>) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    // Die Hexkette, wenn es sie gibt: Ein 32-Bit-Zahlenseed liesse sich
    // durchprobieren, und wer ihn hat, kennt jede verdeckte Karte.
    return erstellePartie(config, sitze, seedHex ?? seed);
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

  botAction(sicht) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht);
  },

  /**
   * Grundlage der Erfahrungspunkte: aufgedeckte Karten je Sitz.
   *
   * Nicht die Punkte — sonst bekaeme ein Spieler, der zwanzig Mal danebengriff,
   * gar nichts fuer eine lange Partie. Und nicht die Brettgroesse, sonst
   * bekaemen beide dasselbe, egal wie oft sie dran waren.
   */
  xpBasis: (partie) => ({ ...partie.aufgedeckt }),

  /**
   * Der Zustand ist reines JSON. Die Version kommt trotzdem mit: Ein Snapshot
   * aus einer aelteren Fassung soll als Fehler auffallen und nicht
   * stillschweigend falsch gedeutet werden.
   */
  serialize: (partie) => ({ v: SNAPSHOT_VERSION, ...partie }),

  deserialize(roh) {
    const snap = roh as GespeichertePartie;
    if (snap.v !== SNAPSHOT_VERSION && snap.v !== 1) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v, ...rest } = snap;
    if (v === 1) {
      /**
       * Eine Partie aus der Zeit vor den Bot-Stufen.
       *
       * Sie hat weder Zugnummer noch Saat noch Gedaechtnis — und braucht
       * nichts davon: Ohne `botStufen` in der `config` merkt sich kein Sitz
       * etwas. Die Felder werden trotzdem gesetzt, damit der Zustand ab hier
       * vollstaendig ist und niemand auf `undefined` laeuft.
       */
      return {
        ...(rest as MememoryPartie),
        zug: 0,
        saat: 'alt',
        erinnerung: {},
      };
    }
    return rest as MememoryPartie;
  },
};
