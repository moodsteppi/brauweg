/**
 * Feldherr als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Spiel einander kennen.
 *
 * Zwei Dinge weichen von den Kartenspielen ab, und beide sind Absicht:
 *
 *   1. `currentActor` liefert immer null. In Echtzeit ist niemand "am Zug" —
 *      beide handeln gleichzeitig und jederzeit. Die Partie-Laufzeit darf
 *      daraus KEINEN Zugtimer ableiten; ein Tisch ohne Aktion ist hier der
 *      Normalfall und kein haengender Spieler.
 *   2. `legalActions` ist leer. Die Schaltflaechen entstehen aus dem
 *      Spielstand auf dem Geraet, nicht aus einer Liste vom Server. Das ist
 *      der Preis von Weg B (docs/FELDHERR-PLAN.md) und der Grund, warum
 *      Feldherr vorerst keine Rangliste bekommt: Der Server kennt den
 *      Spielstand nicht mit und muesste dem gemeldeten Ausgang glauben.
 *      Beide Geraete melden getrennt; weichen sie ab, gilt die Partie als
 *      strittig und niemand gewinnt.
 */

import type {
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import {
  type FeldherrPartie,
  type Meldung,
  ausstieg,
  erzeugePartie,
  verarbeite,
} from './partie.js';
import {
  FELDGROESSEN,
  type FeldherrAktion,
  type FeldherrRegeln,
  STANDARD_REGELN,
  TAKT_MS,
  VORLAUF_TAKTE,
  punkteFuerDauer,
} from './regeln.js';

const SNAPSHOT_VERSION = 1;

export interface FeldherrView {
  readonly saat: number;
  readonly regeln: FeldherrRegeln;
  /** Alle Zuege beider Sitze, aeltester zuerst. Nichts ist verdeckt. */
  readonly zuege: FeldherrPartie['zuege'];
  readonly meldungen: Readonly<Record<number, Meldung>>;
  readonly ausgang: FeldherrPartie['ausgang'];
  readonly taktMs: number;
  readonly vorlauf: number;
}

const meta: GameMeta = {
  id: 'feldherr',
  nameKey: 'game.feldherr',
  availability: 'playable',
  seatCounts: [2],
  /**
   * Feldherr kennt keine Runden und keine Geberrotation: eine Partie ist ein
   * Gefecht. Rotationslaenge 1 und die einzige empfohlene Rundenzahl 1 halten
   * die Tischpruefung stimmig, ohne eine Rundenzahl zu erfinden, die es nicht
   * gibt. Wer hier spaeter mitteln will, muss erst Runden einfuehren.
   */
  rotationSize: () => 1,
  suggestedRounds: () => [1],
  /**
   * xpBasis ist hier die Partiedauer, keine Kartenzahl. Die Tagesaufgaben
   * partie-spielen und partie-gewinnen zaehlen Feldherr ueber die Plaetze
   * mit; die Kartenaufgabe bleibt den Kartenspielen (Entscheidung 5 in
   * docs/FELDHERR-PLAN.md).
   */
  xpBasisZaehltKarten: false,
};

function istRegeln(x: unknown): x is FeldherrRegeln {
  if (typeof x !== 'object' || x === null) return false;
  const feld = (x as { feld?: unknown }).feld;
  return typeof feld === 'string' && (FELDGROESSEN as readonly string[]).includes(feld);
}

export const feldherr: GameModule<
  FeldherrPartie,
  FeldherrAktion,
  FeldherrView,
  FeldherrRegeln
> = {
  meta,
  protocolVersion: 1,

  defaultConfig: () => STANDARD_REGELN,

  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = [];
    if (!istRegeln(config)) {
      probleme.push({ path: 'feld', messageKey: 'feldherr.feldUnbekannt', severity: 'error' });
    }
    if (seats !== 2) {
      probleme.push({ path: 'seats', messageKey: 'feldherr.nurZuZweit', severity: 'error' });
    }
    if (rounds !== 1) {
      probleme.push({ path: 'rounds', messageKey: 'feldherr.eineRunde', severity: 'error' });
    }
    return probleme;
  },

  createParty(options: CreatePartyOptions<FeldherrRegeln>): FeldherrPartie {
    return erzeugePartie(
      istRegeln(options.config) ? options.config : STANDARD_REGELN,
      options.seed,
    );
  },

  act: (partie, sitz, aktion) => verarbeite(partie, sitz, aktion),

  /** Immer null: In Echtzeit wartet die Partie auf niemanden. */
  currentActor: () => null,

  /** Leer: Die Oberflaeche entsteht aus dem Spielstand auf dem Geraet. */
  legalActions: () => [],

  isFinished: (partie) => partie.ausgang !== null,

  standings(partie): PartyStanding[] {
    const sieger = partie.ausgang?.sieger ?? null;
    return [0, 1].map((seat) => {
      const punkte = sieger === null ? 0 : seat === sieger ? 1 : 0;
      return {
        seat,
        points: punkte,
        /** Ohne Ausgang oder bei strittiger Partie steht niemand vorn. */
        place: sieger === null ? 1 : seat === sieger ? 1 : 2,
        left: partie.ausgestiegen.includes(seat),
      };
    });
  },

  markLeft: (partie, sitz) => ausstieg(partie, sitz),

  /**
   * Alles liegt offen — bei Feldherr sieht ohnehin jeder das ganze Brett.
   * Eine Sicht je Sitz gibt es trotzdem, damit die Plattform nichts
   * Besonderes tun muss.
   */
  viewFor: (partie): FeldherrView => ({
    saat: partie.saat,
    regeln: partie.regeln,
    zuege: partie.zuege,
    meldungen: partie.meldungen,
    ausgang: partie.ausgang,
    taktMs: TAKT_MS,
    vorlauf: VORLAUF_TAKTE,
  }),

  spectatorView: (partie): FeldherrView => feldherr.viewFor(partie, 0),

  /**
   * Ein Bot gibt auf.
   *
   * Feldherr hat eine starke KI — aber sie lebt im Spielkern auf den
   * Geraeten. Ein Bot im Server muesste die ganze Echtzeitpartie mitrechnen,
   * und genau das vermeidet Weg B. Tische mit Botauffuellung sind fuer
   * Feldherr deshalb nicht vorgesehen; kommt es doch dazu, endet die Partie
   * sofort, statt stillzustehen.
   */
  botAction: (): FeldherrAktion => ({ art: 'aufgabe' }),

  serialize: (partie) => ({ ...partie, v: SNAPSHOT_VERSION }),

  deserialize(raw: unknown): FeldherrPartie {
    const roh = raw as FeldherrPartie & { v?: number };
    if (!roh || roh.v !== SNAPSHOT_VERSION) {
      throw new Error('feldherr: unbekannter Snapshot');
    }
    const { v: _v, ...partie } = roh;
    return partie;
  },

  /**
   * Erfahrung nach Partiedauer statt nach gelegten Karten.
   *
   * Karten legen ist bei Feldherr keine Leistung — man kann in einer Minute
   * dreissig Karten legen. Die Dauer mit fallendem Ertrag (Kurve in
   * regeln.ts) belohnt Spielen, nicht Sitzenbleiben.
   *
   * Bei strittigem Ausgang bekommen beide die Punkte: Dass die Geraete
   * auseinandergelaufen sind, ist kein Verschulden der Spieler.
   */
  xpBasis(partie): Readonly<Record<number, number>> {
    if (!partie.ausgang) return {};
    const punkte = punkteFuerDauer(partie.ausgang.takte);
    return { 0: punkte, 1: punkte };
  },
};
