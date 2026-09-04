/**
 * Runenheer als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Engine einander kennen.
 *
 * Zwei Dinge weichen von einem Kartenspiel ab, und beide stehen an ihren
 * Stellen ausfuehrlich begruendet:
 *
 *   1. Es gibt keine Zugfolge. `currentActor` nennt trotzdem einen Sitz —
 *      sonst bekaeme der Tisch von der Plattform keinen einzigen Timer und
 *      keine Bot-Uebernahme (siehe `amZug` in partie.ts, dieselbe Lage wie
 *      bei Eiland).
 *   2. `legalActions` zaehlt das Verschieben von Einheiten NICHT auf. Es ist
 *      ein Paar aus 19 Plaetzen; die Liste waere laenger als die uebrige
 *      Sicht. Die einzige Einschraenkung steht stattdessen als Zahl in der
 *      Sicht (`feldplaetze`), damit der Client trotzdem keine Regel nachbaut.
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
  type RunenheerAktion,
  type RunenheerPartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  heerVon,
  markiereVerlassen,
  ohneKampfWeiter,
  platzierungen,
  sitzeVon,
} from './partie.js';
import {
  DEFAULT_REGELN,
  type RunenheerRegeln,
  SEAT_COUNTS,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import {
  type RunenheerSicht,
  SICHT_MARKE,
  sichtFuer,
  zuschauerSicht,
} from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 1;

/**
 * Wie lange die Kampfphase mindestens steht.
 *
 * Solange es keine Simulation gibt, ist das eine reine Atempause: Der Client
 * soll sehen, dass die Runde vorbei ist, bevor der naechste Laden aufgeht.
 * Mit Phase 2 wird daraus die Dauer des Kampfes — das Konzept nennt 15 bis 20
 * Sekunden.
 */
const KAMPF_PAUSE_MS = 3000;

type GespeichertePartie = RunenheerPartie & { readonly v: number };

const meta: GameMeta = {
  id: 'runenheer',
  nameKey: 'game.runenheer',
  /**
   * Vorschau, nicht spielbar: Es gibt noch keinen Bildschirm im Client und
   * keine Kampfsimulation. Ein Tisch liesse sich zwar starten, aber niemand
   * koennte etwas darauf sehen — und ein Spiel, das man startet und dann
   * anstarrt, ist schlimmer als eines, das man noch nicht starten kann.
   *
   * Umgestellt wird auf `playable`, sobald der Bildschirm steht.
   */
  availability: 'preview',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /**
   * Eine gekaufte Einheit ist keine gelegte Karte. Zaehlte sie als solche,
   * fuellte eine einzige Partie die Kartenaufgabe des Tages — dieselbe
   * Ueberlegung wie bei Filler, Eiland und Feldherr.
   */
  xpBasisZaehltKarten: false,
};

export const runenheer: GameModule<
  RunenheerPartie,
  RunenheerAktion,
  RunenheerSicht,
  RunenheerRegeln
> = {
  meta,
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

  createParty({ config, seats, seed, seedHex }: CreatePartyOptions<RunenheerRegeln>) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    /*
     * Die Hexkette, wenn es sie gibt — und hier ist das keine Vorsicht,
     * sondern Bedingung: Aus einem 32-Bit-Seed laesst sich jeder kuenftige
     * Laden JEDES Sitzes vorausrechnen. Wer das taete, wuesste, welche Einheit
     * der Nachbar gleich bekommt, und koennte sie ihm wegkaufen.
     */
    return erstellePartie(config, sitze, seedHex ?? seed);
  },

  act: (partie, sitz, aktion) => fuehreAus(partie, sitz, aktion),

  currentActor: (partie) => amZug(partie),

  legalActions: (partie, sitz) => erlaubteZuege(partie, sitz),

  isFinished: (partie) => partie.fertig,

  /**
   * Die Kampfphase laeuft von selbst ab — niemand ist am Zug, und es soll
   * trotzdem weitergehen. Genau dafuer gibt es die Schaupause.
   */
  interludeMs: (partie) => (partie.phase === 'kampf' ? KAMPF_PAUSE_MS : null),

  advanceInterlude: (partie) => ohneKampfWeiter(partie),

  standings: (partie): PartyStanding[] => platzierungen(partie),

  markLeft: (partie, sitz) => markiereVerlassen(partie, sitz),

  viewFor: (partie, sitz, seit) => sichtFuer(partie, sitz, seit ?? 0),

  spectatorView: (partie, seit) => zuschauerSicht(partie, seit ?? 0),

  /**
   * Der anwachsende Teil der Sicht ist genau ein Eintrag: der Katalog.
   *
   * Er waechst nie wieder, die Marke steht also fest. Der Gewinn ist trotzdem
   * echt — ohne sie ginge der Katalog bei jedem Rundruf mit, und das sind
   * ueber eine Partie hinweg Hunderte Kopien derselben zweieinhalb Kilobyte
   * (siehe sicht.ts).
   */
  viewCursor: () => SICHT_MARKE,

  botAction(sicht) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht);
  },

  /**
   * Grundlage der Erfahrungspunkte: ueberstandene Runden je Sitz.
   *
   * Nicht die Zahl der Kaeufe — die haengt am Gold und belohnte damit den,
   * der ohnehin schon gewinnt. Ueberstandene Runden hat jeder, der mitspielt.
   */
  xpBasis: (partie) => {
    const raus: Record<number, number> = {};
    for (const sitz of sitzeVon(partie)) {
      const heer = heerVon(partie, sitz);
      raus[sitz] = heer.ausRunde ?? partie.runde;
    }
    return raus;
  },

  serialize: (partie) => ({ v: SNAPSHOT_VERSION, ...partie }),

  deserialize(roh) {
    const snap = roh as GespeichertePartie;
    if (snap.v !== SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v, ...rest } = snap;
    return rest as RunenheerPartie;
  },
};
