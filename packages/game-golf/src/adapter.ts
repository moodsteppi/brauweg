/**
 * Golf als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Spiel einander kennen — wie bei jedem
 * anderen Modul. Golf teilt mit Feldherr die grosse Abweichung vom
 * Kartenspiel-Normalfall:
 *
 *   1. `currentActor` liefert immer null. Alle acht Sitze spielen gleichzeitig
 *      und live auf derselben Bahn; niemand "ist am Zug" im Sinn der
 *      Plattform. Ueber die Leitung gehen ausschliesslich Schlaege, mit
 *      denen der Server nichts weiter anfaengt als sie in Reihenfolge zu
 *      halten (SPEZIFIKATION-GOLF.md Abschnitt 2).
 *   2. `legalActions` ist leer — die Schaltflaechen (Ziehen, Loslassen)
 *      entstehen aus der Physik auf dem Geraet, nicht aus einer Liste vom
 *      Server, der die Baelle gar nicht kennt.
 *
 * Anders als Feldherr braucht Golf aber eine Schaupause: Ohne Zugfolge kennt
 * die Plattform sonst keinen Grund, jemals von selbst weiterzumachen, wenn
 * ein Tisch stillsteht. `interludeMs` liefert deshalb `STILLSTAND_MS`, solange
 * die Partie laeuft, und `advanceInterlude` schliesst sie mit den vorhandenen
 * Meldungen ab (siehe `schliesseAb` in partie.ts). `phaseMs`/`advancePhase`
 * gibt es dagegen nicht: Golf kennt keine Phase, die laeuft, WAEHREND jemand
 * am Zug ist — es ist ja nie jemand am Zug.
 */

import type {
  BotLevel,
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';
import { snapshotCodec } from '@brauweg/game-api';

import {
  type GolfAusgang,
  type GolfAusstieg,
  type GolfMeldung,
  type GolfPartie,
  ausstieg,
  erzeugePartie,
  platzierungen,
  schliesseAb,
  verarbeite,
} from './partie.js';
import {
  DEFAULT_REGELN,
  LOECHER_MAX,
  LOECHER_MIN,
  STILLSTAND_MS,
  TAKT_MS,
  VORLAUF_TAKTE,
  type GolfAktion,
  type GolfRegeln,
  type Zug,
} from './regeln.js';

const SNAPSHOT_VERSION = 1;

export interface GolfView {
  readonly saat: number;
  readonly sitze: number;
  readonly loecher: number;
  readonly botSitze: readonly number[];
  /**
   * Schlaege beider... aller Sitze, aeltester zuerst. Wie bei Feldherr nicht
   * unbedingt alle: `abIndex` sagt, an welcher Stelle der Partie dieser
   * Ausschnitt beginnt (siehe `viewCursor`).
   */
  readonly zuege: readonly (Zug & { readonly sitz: number })[];
  readonly abIndex: number;
  readonly ausstiege: readonly GolfAusstieg[];
  readonly meldungen: Readonly<Record<number, GolfMeldung>>;
  readonly ausgang: GolfAusgang | null;
  readonly taktMs: number;
  readonly vorlauf: number;
  readonly botStufe: BotLevel;
}

const meta: GameMeta = {
  id: 'golf',
  nameKey: 'game.golf',
  availability: 'playable',
  seatCounts: [1, 2, 3, 4, 5, 6, 7, 8],
  /** Golf kennt keine Geberrotation — jedes Loch spielen alle gleichzeitig. */
  rotationSize: () => 1,
  suggestedRounds: () =>
    Array.from({ length: LOECHER_MAX - LOECHER_MIN + 1 }, (_, i) => LOECHER_MIN + i),
  /**
   * xpBasis ist hier "Loecher gespielt", keine Kartenzahl — die Kartenaufgabe
   * des Tages soll nicht mit jeder Golfrunde mitwachsen.
   */
  xpBasisZaehltKarten: false,
};

function istRegelsatz(x: unknown): x is GolfRegeln {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export const golf: GameModule<GolfPartie, GolfAktion, GolfView, GolfRegeln> = {
  meta,
  /** Erste Fassung — noch keine Protokollgeschichte. */
  /**
   * 2 seit dem 06.09.2026 abends: Physikänderung (Geistphase bis zum ersten
   * Schlag statt Immunfrist, ein gemeinsamer Abschlag). Die Sicht ist gleich
   * geblieben — aber zwei Geräte mit verschiedener Physik rechnen aus
   * derselben Zugliste verschiedene Partien, und genau das hält die
   * Versionsgrenze des Gateways auseinander.
   */
  protocolVersion: 2,

  defaultConfig: () => DEFAULT_REGELN,

  validateConfig(config: unknown, seats: number, rounds: number): ConfigProblem[] {
    const probleme: ConfigProblem[] = [];
    if (!istRegelsatz(config)) {
      probleme.push({ path: 'config', messageKey: 'golf.regelnUnbekannt', severity: 'error' });
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 8) {
      probleme.push({ path: 'seats', messageKey: 'golf.sitzzahl', severity: 'error' });
    }
    if (!Number.isInteger(rounds) || rounds < LOECHER_MIN || rounds > LOECHER_MAX) {
      probleme.push({ path: 'rounds', messageKey: 'golf.loecher', severity: 'error' });
    }
    return probleme;
  },

  createParty(options: CreatePartyOptions<GolfRegeln>): GolfPartie {
    return erzeugePartie({
      regeln: istRegelsatz(options.config) ? options.config : DEFAULT_REGELN,
      saat: options.seed,
      sitze: options.seats,
      loecher: options.rounds,
      botSitze: options.botSeats,
      botStufe: options.botLevel,
    });
  },

  act: (partie, sitz, aktion) => verarbeite(partie, sitz, aktion),

  /** Immer null: Alle Sitze handeln gleichzeitig und jederzeit auf dem Geraet. */
  currentActor: () => null,

  /** Leer: Zielen und Schiessen entstehen aus der Physik auf dem Geraet. */
  legalActions: () => [],

  isFinished: (partie) => partie.ausgang !== null,

  /**
   * Sicherheitsnetz statt Zugtimer (siehe Modulkopf). Endet erst, wenn
   * `advanceInterlude` (oder eine vollstaendige Meldungsrunde ueber `act`)
   * einen Ausgang setzt.
   */
  interludeMs: (partie) => (partie.ausgang === null ? STILLSTAND_MS : null),

  advanceInterlude: (partie) => schliesseAb(partie),

  standings(partie): PartyStanding[] {
    const abgeschlossen = partie.ausgang !== null && !partie.ausgang.strittig;
    const ausgestiegen = new Set(partie.ausstiege.map((a) => a.sitz));
    return platzierungen(partie.ausgang, partie.sitze).map((p) => ({
      seat: p.sitz,
      points: abgeschlossen ? Math.max(0, partie.loecher * 12 - p.schlaege) : 0,
      place: p.platz,
      left: ausgestiegen.has(p.sitz),
    }));
  },

  markLeft: (partie, sitz) => ausstieg(partie, sitz),

  /**
   * Alles liegt offen — wie bei Feldherr sieht ohnehin jeder dieselbe Bahn
   * und dieselben Baelle, nur auf dem eigenen Geraet gerechnet statt vom
   * Server verschickt.
   */
  viewFor: (partie, _sitz, seit = 0): GolfView => {
    const ab = Math.max(0, Math.min(seit, partie.zuege.length));
    return {
      saat: partie.saat,
      sitze: partie.sitze,
      loecher: partie.loecher,
      botSitze: partie.botSitze,
      zuege: ab === 0 ? partie.zuege : partie.zuege.slice(ab),
      abIndex: ab,
      ausstiege: partie.ausstiege,
      meldungen: partie.meldungen,
      ausgang: partie.ausgang,
      taktMs: TAKT_MS,
      vorlauf: VORLAUF_TAKTE,
      botStufe: partie.botStufe,
    };
  },

  spectatorView: (partie, seit = 0): GolfView => golf.viewFor(partie, 0, seit),

  /** Die Zugliste ist append-only — ihre Laenge ist die Marke. */
  viewCursor: (partie): number => partie.zuege.length,

  /**
   * Wird nie aufgerufen, weil `currentActor` immer null ist — muss aber
   * existieren. `{art:'ergebnis', ...}` waere gefaehrlich (ein erratenes
   * Ergebnis koennte die Partie fuer echte Meldungen sperren); `{art:'aufgabe'}`
   * waere falsch (Golf-Bots leben im Client, sie geben nie auf). Die einzige
   * ungefaehrliche Antwort ist `nichts` — `act` ignoriert sie folgenlos.
   */
  botAction: (): GolfAktion => ({ art: 'nichts' }),

  ...snapshotCodec<GolfPartie>(SNAPSHOT_VERSION),

  /**
   * 15 Punkte je gespieltem Loch, fuer jeden Sitz gleich — auch bei
   * strittigem Ausgang: Dass Geraete auseinanderliefen, ist kein Verschulden
   * der Spieler, und gespielt haben trotzdem alle dieselbe Rundenzahl.
   */
  xpBasis(partie): Readonly<Record<number, number>> {
    if (!partie.ausgang) return {};
    const punkte = 15 * partie.loecher;
    const ergebnis: Record<number, number> = {};
    for (let s = 0; s < partie.sitze; s += 1) ergebnis[s] = punkte;
    return ergebnis;
  },
};
