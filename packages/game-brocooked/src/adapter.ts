/**
 * BroCooked als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Spiel einander kennen. BroCooked teilt
 * mit Golf und Feldherr die grosse Abweichung vom Kartenspiel-Normalfall:
 *
 *   1. `currentActor` ist immer null. Alle Sitze kochen gleichzeitig und
 *      live in derselben Kueche; niemand "ist am Zug".
 *   2. `legalActions` ist leer — ob man gerade greifen, ablegen oder
 *      schneiden kann, entscheidet die Kueche auf dem Geraet, nicht eine
 *      Liste vom Server, der die Kueche gar nicht kennt.
 *
 * Wie Golf braucht es deshalb eine Schaupause (`interludeMs`): Ohne Zugfolge
 * hat die Plattform sonst keinen Grund, einen stillstehenden Tisch je
 * abzuschliessen.
 *
 * Und eine dritte Abweichung, die Golf nicht hat: BroCooked ist ein
 * MITEINANDER. Es gibt eine gemeinsame Punktzahl, alle Sitze stehen auf
 * Platz 1. Wer hier eine Rangfolge einbaut, baut ein anderes Spiel.
 */

import type {
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';
import { snapshotCodec } from '@brauweg/game-api';

import {
  type BroCookedAusgang,
  type BroCookedAusstieg,
  type BroCookedPartie,
  ausstieg,
  erzeugePartie,
  platzierungen,
  schliesseAb,
  verarbeite,
} from './partie.js';
import {
  DEFAULT_REGELN,
  RUNDEN_MAX,
  RUNDEN_MIN,
  SITZE,
  STILLSTAND_MS,
  TAKT_MS,
  VORLAUF_TAKTE,
  type BroCookedAktion,
  type BroCookedRegeln,
  type Eingabe,
  type ErgebnisMeldung,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';

const SNAPSHOT_VERSION = 1;

export interface BroCookedView {
  readonly saat: number;
  readonly sitze: number;
  readonly runden: number;
  readonly kuechen: readonly string[];
  readonly rundeTakte: number;
  readonly botSitze: readonly number[];
  readonly botStufe: string;
  /**
   * Eingaben aller Sitze, aelteste zuerst — wie bei Golf nicht unbedingt
   * alle: `abIndex` sagt, an welcher Stelle der Partie dieser Ausschnitt
   * beginnt (siehe `viewCursor`).
   */
  readonly eingaben: readonly (Eingabe & { readonly sitz: number })[];
  readonly abIndex: number;
  readonly ausstiege: readonly BroCookedAusstieg[];
  readonly meldungen: Readonly<Record<number, ErgebnisMeldung>>;
  readonly ausgang: BroCookedAusgang | null;
  readonly taktMs: number;
  readonly vorlauf: number;
}

const meta: GameMeta = {
  id: 'brocooked',
  nameKey: 'game.brocooked',
  availability: 'playable',
  seatCounts: SITZE,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /** Es gibt keine Karten — die Tagesaufgabe soll an Kochrunden nicht mitwachsen. */
  xpBasisZaehltKarten: false,
};

function istRegelsatz(x: unknown): x is BroCookedRegeln {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const brocooked: GameModule<
  BroCookedPartie,
  BroCookedAktion,
  BroCookedView,
  BroCookedRegeln
> = {
  meta,
  /** Erste Fassung — noch keine Protokollgeschichte. */
  protocolVersion: 1,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = [];
    if (!istRegelsatz(config)) {
      probleme.push({
        path: 'config',
        messageKey: 'brocooked.regelnUnbekannt',
        severity: 'error',
      });
    } else {
      for (const fehler of pruefeRegeln(config)) {
        probleme.push({ path: 'config', messageKey: `brocooked.${fehler}`, severity: 'error' });
      }
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 4) {
      probleme.push({ path: 'seats', messageKey: 'brocooked.sitzzahl', severity: 'error' });
    }
    if (!Number.isInteger(rounds) || rounds < RUNDEN_MIN || rounds > RUNDEN_MAX) {
      probleme.push({ path: 'rounds', messageKey: 'brocooked.runden', severity: 'error' });
    }
    return probleme;
  },

  createParty(options: CreatePartyOptions<BroCookedRegeln>): BroCookedPartie {
    return erzeugePartie({
      regeln: istRegelsatz(options.config) ? options.config : DEFAULT_REGELN,
      saat: options.seed,
      sitze: options.seats,
      runden: options.rounds,
      botSitze: options.botSeats,
      botStufe: options.botLevel,
    });
  },

  act: (partie, sitz, aktion) => verarbeite(partie, sitz, aktion),

  /** Immer null: Alle Sitze handeln gleichzeitig und jederzeit auf dem Geraet. */
  currentActor: () => null,

  /** Leer: Greifen, Ablegen und Werken entstehen aus der Kueche auf dem Geraet. */
  legalActions: () => [],

  isFinished: (partie) => partie.ausgang !== null,

  interludeMs: (partie) => (partie.ausgang === null ? STILLSTAND_MS : null),

  advanceInterlude: (partie) => schliesseAb(partie),

  /**
   * Alle auf Platz 1, alle mit derselben Punktzahl — gekocht wird miteinander.
   * Bei strittigem Ausgang null Punkte: Dass zwei Geraete auseinanderliefen,
   * soll keine Bestenliste fuellen.
   */
  standings(partie): PartyStanding[] {
    const gewertet = partie.ausgang !== null && !partie.ausgang.strittig;
    const ausgestiegen = new Set(partie.ausstiege.map((a) => a.sitz));
    return platzierungen(partie.ausgang, partie.sitze).map((p) => ({
      seat: p.sitz,
      points: gewertet ? Math.max(0, p.punkte) : 0,
      place: p.platz,
      left: ausgestiegen.has(p.sitz),
    }));
  },

  markLeft: (partie, sitz) => ausstieg(partie, sitz),

  /**
   * Alles liegt offen: Jedes Geraet rechnet ohnehin dieselbe Kueche. Was
   * jemand sieht, entscheidet allein seine Kamera.
   */
  viewFor: (partie, _sitz, seit = 0): BroCookedView => {
    const ab = Math.max(0, Math.min(seit, partie.eingaben.length));
    return {
      saat: partie.saat,
      sitze: partie.sitze,
      runden: partie.runden,
      kuechen: partie.regeln.kuechen,
      rundeTakte: partie.regeln.rundeTakte,
      botSitze: partie.botSitze,
      botStufe: partie.botStufe,
      eingaben: ab === 0 ? partie.eingaben : partie.eingaben.slice(ab),
      abIndex: ab,
      ausstiege: partie.ausstiege,
      meldungen: partie.meldungen,
      ausgang: partie.ausgang,
      taktMs: TAKT_MS,
      vorlauf: VORLAUF_TAKTE,
    };
  },

  spectatorView: (partie, seit = 0): BroCookedView => brocooked.viewFor(partie, 0, seit),

  /** Die Eingabeliste waechst nur hinten — ihre Laenge ist die Marke. */
  viewCursor: (partie): number => partie.eingaben.length,

  /**
   * Wird nie gerufen, weil `currentActor` immer null ist, muss aber da sein.
   * `nichts` ist die einzige ungefaehrliche Antwort: Ein gerateneres
   * Ergebnis koennte die Partie fuer die echten Meldungen sperren.
   */
  botAction: (): BroCookedAktion => ({ art: 'nichts' }),

  ...snapshotCodec<BroCookedPartie>(SNAPSHOT_VERSION),

  /**
   * 12 Punkte je gespielter Runde, fuer jeden Sitz gleich — auch bei
   * strittigem Ausgang: Gekocht haben trotzdem alle.
   */
  xpBasis(partie): Readonly<Record<number, number>> {
    if (!partie.ausgang) return {};
    const punkte = 12 * partie.runden;
    const ergebnis: Record<number, number> = {};
    for (let s = 0; s < partie.sitze; s += 1) ergebnis[s] = punkte;
    return ergebnis;
  },
};

export { TAKT_MS, VORLAUF_TAKTE };
