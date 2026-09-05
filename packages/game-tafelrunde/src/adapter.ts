/**
 * Tafelrunde als Spielmodul der Plattform.
 *
 * Einzige Stelle, an der Plattform und Engine einander kennen.
 *
 * Drei Dinge weichen von einem Kartenspiel ab, und alle drei stehen an ihren
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
 *   3. Die Vorbereitung hat eine eigene FRIST (`phaseMs`), obwohl jemand am
 *      Zug ist. Die Zugzeit der Plattform taugt hier nicht: Sie laeuft je
 *      Sitz, wird bei jeder Aktion irgendeines Sitzes neu gestellt und faellt
 *      am Botsitz ganz weg — bei einem Spiel, in dem alle gleichzeitig
 *      ruesten, ist sie damit keine Restzeit.
 */

import type {
  BotLevel,
  ConfigProblem,
  CreatePartyOptions,
  GameMeta,
  GameModule,
  PartyStanding,
} from '@brauweg/game-api';

import { type Schwierigkeit, botZug } from './bot.js';
import {
  type Heer,
  type TafelrundeAktion,
  type TafelrundePartie,
  amZug,
  erlaubteZuege,
  erstellePartie,
  fristAbgelaufen,
  fuehreAus,
  heerVon,
  kampfdauer,
  loeseKampfAuf,
  markiereVerlassen,
  platzierungen,
  sitzeVon,
} from './partie.js';
import {
  DEFAULT_REGELN,
  type TafelrundeRegeln,
  SEAT_COUNTS,
  mitFrist,
  pruefeRegeln,
  rotationSize,
  suggestedRounds,
} from './regeln.js';
import {
  type TafelrundeSicht,
  SICHT_MARKE,
  sichtFuer,
  zuschauerSicht,
} from './sicht.js';

/**
 * Format des Partie-Snapshots. Steigt, sobald sich der gespeicherte Aufbau
 * aendert. Der Server kennt den Inhalt nicht, muss einen unlesbaren Snapshot
 * aber als Fehler erkennen koennen, statt ihn falsch zu deuten.
 */
const SNAPSHOT_VERSION = 2;

/**
 * Snapshots dieser Versionen lassen sich noch laden.
 *
 * Die 1 stammt aus der Zeit vor der Kampfsimulation und kennt das Feld
 * `kaempfe` nicht. Sie mitzunehmen kostet drei Zeilen und rettet jeden Tisch,
 * der beim Deploy gerade laeuft — ohne sie wuerfe `deserialize` und die Partie
 * waere verloren.
 */
const LESBARE_VERSIONEN = [1, SNAPSHOT_VERSION];

/**
 * Was die Schaupause NACH dem letzten Ereignis eines Kampfes noch stehen
 * bleibt.
 *
 * Die Kampfphase dauert so lange wie der laengste Kampf der Runde
 * (`kampfdauer`) plus diesen Nachlauf. Ohne ihn ginge der naechste Laden in
 * demselben Augenblick auf, in dem die letzte Einheit faellt — der Spieler
 * saehe nie, wie es ausgegangen ist.
 *
 * Ausgefuehrt, weil der Messstand ihn mitrechnet (`Zeitmodell` in
 * test/messen.ts): Er ist ein Posten der Spielzeit, und die Zahl zweimal
 * hinzuschreiben waere der Weg, sie einmal zu aendern und einmal zu vergessen.
 */
export const KAMPF_NACHLAUF_MS = 2500;

type GespeichertePartie = TafelrundePartie & { readonly v: number };

/**
 * Die vier Stufen der Plattform auf die drei Gangarten des Bots.
 *
 * Vier auf drei geht nicht auf, und das ist kein Versehen: `bot.ts` hat drei
 * Gangarten, weil sich mehr nicht messbar unterscheiden liessen (die Zahlen
 * stehen dort). `experte` und `genie` fallen deshalb beide auf `hart` — die
 * ehrlichere Zuordnung als eine vierte Gangart, die genauso spielt wie die
 * dritte und nur anders heisst.
 *
 * Ohne Stufe gilt `normal`: dieselbe Vorgabe wie in `botZug` selbst.
 */
function gangartVon(level: BotLevel | undefined): Schwierigkeit {
  if (level === 'anfaenger') return 'sanft';
  if (level === 'experte' || level === 'genie') return 'hart';
  return 'normal';
}

const meta: GameMeta = {
  id: 'tafelrunde',
  nameKey: 'game.tafelrunde',
  /**
   * Spielbar seit dem 04.09.2026: Der Bildschirm steht
   * (packages/client/src/screens/Tafelrunde.tsx), also gibt es etwas zu
   * sehen. Bis dahin stand hier `preview` — ein Tisch ohne Bildschirm ist
   * schlimmer als ein Spiel, das man noch nicht starten kann.
   *
   * Seit dem Nachziehen der Kampfsimulation laeuft eine Runde vollstaendig
   * durch: Vorbereitung, Kampf, Schaden am Verlierer, naechste Runde.
   */
  availability: 'playable',
  seatCounts: SEAT_COUNTS,
  rotationSize: () => rotationSize(),
  suggestedRounds: () => suggestedRounds(),
  /**
   * Eine gekaufte Einheit ist keine gelegte Karte. Zaehlte sie als solche,
   * fuellte eine einzige Partie die Kartenaufgabe des Tages — dieselbe
   * Ueberlegung wie bei Filler, Eiland und Feldherr.
   */
  xpBasisZaehltKarten: false,
  /*
   * Siehe Punkt 2 im Kopf dieser Datei: `legalActions` laesst das Verschieben
   * aus. Ohne diese Angabe scheitert die Plattform-Invariante daran, dass der
   * Bot einen Zug waehlt, den die Liste nicht nennt — und zwar zu Recht: Von
   * aussen ist eine unvollstaendige Liste nicht von einer vollstaendigen zu
   * unterscheiden.
   */
  legalActionsUnvollstaendig: true,
};

export const tafelrunde: GameModule<
  TafelrundePartie,
  TafelrundeAktion,
  TafelrundeSicht,
  TafelrundeRegeln
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

  createParty({ config, seats, seed, seedHex }: CreatePartyOptions<TafelrundeRegeln>) {
    const sitze = Array.from({ length: seats }, (_, i) => i);
    /*
     * Die Hexkette, wenn es sie gibt — und hier ist das keine Vorsicht,
     * sondern Bedingung: Aus einem 32-Bit-Seed laesst sich jeder kuenftige
     * Laden JEDES Sitzes vorausrechnen. Wer das taete, wuesste, welche Einheit
     * der Nachbar gleich bekommt, und koennte sie ihm wegkaufen.
     */
    /*
     * `mitFrist`: Ein Tisch, der VOR dem 06.09.2026 aufgemacht wurde, hat
     * seinen Regelsatz ohne `vorbereitungMs` in der Datenbank stehen. Er
     * startet trotzdem — nur eben ohne Deckel auf der Vorbereitung, und das
     * faellt niemandem auf, weil die Phase ja weiterhin endet, sobald alle
     * bereit sind. Genau solche Luecken sieht man erst, wenn einer wegbleibt.
     */
    return erstellePartie(mitFrist(config), sitze, seedHex ?? seed);
  },

  act: (partie, sitz, aktion) => fuehreAus(partie, sitz, aktion),

  currentActor: (partie) => amZug(partie),

  legalActions: (partie, sitz) => erlaubteZuege(partie, sitz),

  isFinished: (partie) => partie.fertig,

  /**
   * Die Kampfphase laeuft von selbst ab — niemand ist am Zug, und es soll
   * trotzdem weitergehen. Die Pause ist genau so lang, wie der laengste Kampf
   * der Runde zum Abspielen braucht: Sie hier zu kuerzen hiesse, dem Spieler
   * das Ende seines eigenen Kampfes vorzuenthalten.
   */
  interludeMs: (partie) =>
    partie.phase === 'kampf' ? kampfdauer(partie) + KAMPF_NACHLAUF_MS : null,

  advanceInterlude: (partie) => loeseKampfAuf(partie),

  /**
   * Der Deckel auf die Platzierungsphase.
   *
   * Anders als die Schaupause laeuft diese Frist, WAEHREND geruestet wird —
   * dafuer gibt es sie (siehe `phaseMs` in game-api). Die Plattform misst,
   * dieses Paket nennt nur die Dauer.
   *
   * Ausserhalb der Vorbereitung ausdruecklich null, und das ist keine
   * Formalie: Die Plattform erkennt am null, dass eine neue Phase begonnen
   * hat, und stellt die Frist erst dann wieder. Ohne die Kampfphase
   * dazwischen liefe die Frist der vorigen Runde weiter.
   */
  phaseMs: (partie) =>
    !partie.fertig && partie.phase === 'vorbereitung' ? partie.regeln.vorbereitungMs : null,

  advancePhase: (partie) => fristAbgelaufen(partie),

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

  botAction(sicht, level) {
    if (sicht.zuschauer) throw new Error('Bot darf nicht auf Zuschauersicht laufen');
    return botZug(sicht, gangartVon(level));
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
    if (!LESBARE_VERSIONEN.includes(snap.v)) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v, ...rest } = snap;
    const partie = rest as TafelrundePartie;
    // Version 1 kannte noch keine Kampfprotokolle. Eine leere Liste ist die
    // richtige Antwort: Dann loest `advanceInterlude` die Kampfphase ohne
    // Buchung auf, statt ueber ein fehlendes Feld zu stolpern.
    const mitKaempfen = partie.kaempfe ? partie : { ...partie, kaempfe: [] };
    /*
     * Ebenso fuer `wuerfeRunde` (seit dem kostenlosen Wuerfeln, 05.09.2026):
     * Ein Snapshot aus der Zeit davor hat das Feld nicht, und ein `undefined`
     * im Vergleich des Bots waere still immer falsch — er wuerfelte dann in
     * einer alten Partie ohne Deckel weiter. Null ist der richtige Anfang.
     */
    const heere: Record<number, Heer> = {};
    for (const [sitz, heer] of Object.entries(mitKaempfen.heere)) {
      heere[Number(sitz)] = heer.wuerfeRunde === undefined ? { ...heer, wuerfeRunde: 0 } : heer;
    }
    // Und fuer `vorbereitungMs` (seit dem 06.09.2026): Eine Partie, die den
    // Deploy im Snapshot ueberlebt, soll ihren Deckel bekommen und nicht bis
    // zum Partieende ohne Frist weiterlaufen (siehe `mitFrist`).
    return { ...mitKaempfen, regeln: mitFrist(mitKaempfen.regeln), heere };
  },
};
