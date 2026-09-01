/**
 * Filler als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Engine einander kennen.
 *
 * Es gibt hier keine Schaupause (`interludeMs`): Ein Zug ist ein Tipp auf eine
 * Farbe, und danach ist der andere dran. Was der Client an Bewegung zeigt —
 * das Wandern der Flaeche —, ist Zeichnung und keine Regel; ein Zustand
 * dafuer waere ein Zustand zu viel.
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
  type FillerAktion,
  type FillerPartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  platzierungen,
} from './partie.js';
import {
  DEFAULT_REGELN,
  type FillerRegeln,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import { type FillerSicht, sichtFuer, zuschauerSicht } from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 2;

type GespeichertePartie = FillerPartie & { readonly v: number };

const meta: GameMeta = {
  id: 'filler',
  nameKey: 'game.filler',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /**
   * Ein erobertes Feld ist keine gelegte Karte. Zaehlte es als solche, fuellte
   * eine einzige Partie die Kartenaufgabe des Tages mit einem halben Hundert
   * Treffern — dieselbe Ueberlegung wie bei Feldherr und Mememory.
   */
  xpBasisZaehltKarten: false,
};

export const filler: GameModule<FillerPartie, FillerAktion, FillerSicht, FillerRegeln> = {
  meta,
  /**
   * 2 seit dem 31. August 2026: Die Sicht traegt die Spielart (`variante`).
   * Ein Client der Version 1 kaeme damit nicht durcheinander — er zeichnet
   * einfach, was in der Sicht steht, und das ist in der offenen Spielart
   * vollstaendig —, aber er koennte sie nirgends benennen.
   */
  protocolVersion: 2,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = pruefeRegeln(config);
    if (probleme.length > 0) return probleme;

    const regeln = config as FillerRegeln;
    if (!SEAT_COUNTS.includes(seats)) {
      probleme.push({ path: 'seats', messageKey: 'error.seatCountUnsupported', severity: 'error' });
    }
    /*
     * Jeder Sitz sperrt eine Farbe. Blieben danach weniger als zwei uebrig,
     * waere der Zug keine Entscheidung mehr, sondern eine Pflicht — und bei
     * genau einer verbleibenden Farbe zoege die Partie sich selbst zu Ende.
     */
    if (regeln.farben - seats < 2) {
      probleme.push({ path: 'farben', messageKey: 'ruleset.zuWenigFarben', severity: 'error' });
    }
    return probleme;
  },

  createParty({ config, seats, seed, seedHex }: CreatePartyOptions<FillerRegeln>) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    /*
     * Die Hexkette, wenn es sie gibt. Bei Filler ist das keine Vorsicht,
     * sondern Bedingung: Aus einem 32-Bit-Seed laesst sich das ganze Brett
     * nachrechnen, und dann ist vom Nebel nichts mehr uebrig (siehe
     * baueZufall in partie.ts).
     */
    return erstellePartie(config, sitze, seedHex ?? seed);
  },

  act: (partie, sitz, aktion) => fuehreAus(partie, sitz, aktion),

  currentActor: (partie) => amZug(partie),

  legalActions: (partie, sitz) => erlaubteZuege(partie, sitz),

  isFinished: (partie) => partie.fertig,

  standings: (partie): PartyStanding[] => platzierungen(partie),

  markLeft: (partie, sitz) => markiereVerlassen(partie, sitz),

  viewFor: (partie, sitz) => sichtFuer(partie, sitz),

  spectatorView: (partie) => zuschauerSicht(partie),

  botAction(sicht) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht);
  },

  /**
   * Grundlage der Erfahrungspunkte: eroberte Felder je Sitz.
   *
   * Nicht die Zugzahl — die ist fuer beide fast gleich, egal wie gut gespielt
   * wurde. Die Felder sind das, was man tatsaechlich erarbeitet hat.
   */
  xpBasis: (partie) => ({ ...partie.punkte }),

  serialize: (partie) => ({ v: SNAPSHOT_VERSION, ...partie }),

  deserialize(roh) {
    const snap = roh as GespeichertePartie;
    if (snap.v !== SNAPSHOT_VERSION && snap.v !== 1) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v, ...rest } = snap;
    const alt = rest as FillerPartie;
    /**
     * Version 1 kannte die Spielart nicht — es gab nur eine. Sie hier
     * nachzutragen ist deshalb kein Raten: Jede Partie aus dieser Fassung
     * wurde im Nebel gespielt. Abzuweisen waere der falsche Weg; ein Deploy
     * darf keine laufende Partie brechen.
     */
    if (v === 1) {
      return { ...alt, regeln: { ...alt.regeln, variante: 'nebel' } };
    }
    return alt;
  },
};
