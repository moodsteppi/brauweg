/**
 * Eiland als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Engine einander kennen.
 *
 * Es gibt hier keine Schaupause (`interludeMs`), obwohl eine Runde mit einer
 * Aufloesung endet, die man gerne saehe. Der Grund ist handfest: Die Plattform
 * setzt die Frist einer Schaupause nur zurueck, wenn zwischendurch jemand am
 * Zug war (siehe scheduleInterlude in runtime/party.ts). Ein Spiel, dessen
 * Runden ohne Zugfolge aufeinanderfolgen, wuerde deshalb ab der zweiten Runde
 * mit einer laengst abgelaufenen Frist rechnen. Die Aufloesung zeigt der
 * Client aus `sicht.letzte` — sie ist Zeichnung und kein Zustand, genau wie
 * bei Filler das Wandern der Flaeche.
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
  type EilandAktion,
  type EilandPartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  markiereVerlassen,
  platzierungen,
} from './partie.js';
import {
  DEFAULT_REGELN,
  type EilandRegeln,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import { type EilandSicht, sichtFuer, zuschauerSicht } from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 1;

type GespeichertePartie = EilandPartie & { readonly v: number };

const meta: GameMeta = {
  id: 'eiland',
  nameKey: 'game.eiland',
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /**
   * Ein eingenommenes Feld ist keine gelegte Karte. Zaehlte es als solche,
   * fuellte eine einzige Partie die Kartenaufgabe des Tages mit einem halben
   * Hundert Treffern — dieselbe Ueberlegung wie bei Filler, Feldherr und
   * Mememory.
   */
  xpBasisZaehltKarten: false,
};

export const eiland: GameModule<EilandPartie, EilandAktion, EilandSicht, EilandRegeln> = {
  meta,
  /**
   * 1 — die erste Fassung. Sie steht trotzdem ausgeschrieben und nicht als
   * stiller Standardwert: Sobald sich an Sicht oder Aktion etwas aendert, ist
   * die Zeile schon da, an der die Zahl steigen muss.
   */
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = pruefeRegeln(config);
    if (probleme.length > 0) return probleme;

    if (!SEAT_COUNTS.includes(seats)) {
      probleme.push({ path: 'seats', messageKey: 'error.seatCountUnsupported', severity: 'error' });
    }
    return probleme;
  },

  createParty({ config, seats, seed, seedHex }: CreatePartyOptions<EilandRegeln>) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    /*
     * Die Hexkette, wenn es sie gibt. Wie bei Filler ist das keine Vorsicht,
     * sondern Bedingung: Aus einem 32-Bit-Seed laesst sich die ganze Karte
     * nachrechnen — jeder See, jeder Berg, jedes Ornament —, und dann ist vom
     * Nebel nichts mehr uebrig (siehe baueZufall in karte.ts).
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
   * Grundlage der Erfahrungspunkte: gehaltene Felder je Sitz.
   *
   * Nicht die Rundenzahl — die ist fuer beide gleich, egal wie gut gespielt
   * wurde. Das Land ist das, was man tatsaechlich erarbeitet hat.
   */
  xpBasis: (partie) => ({ ...partie.punkte }),

  serialize: (partie) => ({ v: SNAPSHOT_VERSION, ...partie }),

  /*
   * Von Hand und nicht ueber den `snapshotCodec` aus game-api: Den gibt es auf
   * `main` (noch) nicht, und ein Modul, das je nach Zweig anders aussieht,
   * waere beim naechsten Uebernehmen die erste Fehlerquelle. Es sind drei
   * Zeilen — die Ersparnis waere kleiner als der Unterschied.
   */
  deserialize(roh) {
    const snap = roh as GespeichertePartie;
    if (snap.v !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v: _v, ...rest } = snap;
    return rest as EilandPartie;
  },
};
