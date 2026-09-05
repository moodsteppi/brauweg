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
const SNAPSHOT_VERSION = 5;

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
   * 2 seit dem 1. September 2026, wenige Stunden nach der 1. Zwei Aenderungen
   * auf einmal, weil zwischen ihnen kein Deploy lag: Aus drei Aktionen (Feld
   * waehlen, zuruecknehmen, abgeben) ist eine geworden — der fertige Zettel —,
   * und die Sicht traegt jetzt die Spielart. Ein Client der Fassung 1 schickt
   * Aktionen, die es nicht mehr gibt, und muss deshalb abgewiesen werden,
   * statt mitten in der Partie zu scheitern.
   *
   * NICHT erhoeht am 2. September fuer die Bauwerke: Die Sicht bekam nur ein
   * Feld dazu, das ein aelterer Client schlicht nicht liest. Eine neue
   * Fassung wuerfe jeden offenen Tab aus der Partie — fuer eine Zeichnung.
   *
   * Auch NICHT erhoeht am 5. September fuer die Angriffe: Der Zettel sieht
   * gleich aus (eine Feldliste), ein aelterer Client kennt `angreifbar` nicht
   * und bietet eben keine Angriffe an — und einen Zettel, auf dem nur freies
   * Land steht, nimmt der Server weiterhin an.
   */
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
    if (!Number.isInteger(snap.v) || snap.v < 1 || snap.v > SNAPSHOT_VERSION) {
      throw new Error(
        `Snapshot-Version ${snap.v} wird nicht unterstuetzt (erwartet ${SNAPSHOT_VERSION})`,
      );
    }
    const { v, ...rest } = snap;
    let alt = rest as EilandPartie;
    /*
     * Version 1 kannte die Spielart nicht — es gab nur eine. Sie hier
     * nachzutragen ist deshalb kein Raten: Jede Partie aus dieser Fassung
     * wurde im Nebel gespielt. Abzuweisen waere der falsche Weg; ein Deploy
     * darf keine laufende Partie brechen.
     */
    if (v === 1) alt = { ...alt, regeln: { ...alt.regeln, variante: 'nebel' } };
    /*
     * Bis Version 2 verschwand ein eingesammeltes Ornament von der Karte.
     * Eine laufende Partie aus dieser Zeit bekommt eine leere Bauwerk-Liste:
     * Was vor dem Deploy eingesammelt wurde, laesst sich nicht mehr
     * nachzeichnen — und eine Karte ohne die alten Bauwerke ist immer noch
     * dieselbe Partie, ein abgewiesener Snapshot waere es nicht.
     */
    if (v < 3) alt = { ...alt, bauwerk: alt.gelaende.map(() => null) };
    /*
     * Bis Version 3 kannte ein Kampf keinen Einsatz. Die letzte Rundenmeldung
     * einer laufenden Partie bekommt leere Einsaetze nachgetragen — sie ist
     * nur Zeichnung, und der Client liest `einsatz` ohne Netz.
     */
    if (v < 4 && alt.letzte) {
      const letzte = alt.letzte;
      alt = {
        ...alt,
        letzte: {
          ...letzte,
          reserve: letzte.reserve ?? {},
          kaempfe: letzte.kaempfe.map((k) => ({ ...k, einsatz: k.einsatz ?? [] })),
        },
      };
    }
    /*
     * Bis Version 4 gab es keine Angriffe: kein Kampfrundenzaehler, keine
     * Stellungsliste und keine Eroberungen in der Rundenmeldung. Alles
     * beginnt bei null — eine laufende Partie bekommt die neue Regel ab
     * ihrer naechsten Runde.
     */
    if (v < 5) {
      const teil = alt as Partial<EilandPartie>;
      alt = {
        ...alt,
        kampfrunden: teil.kampfrunden ?? 0,
        stellungen: teil.stellungen ?? [],
        letzte: alt.letzte ? { ...alt.letzte, erobert: alt.letzte.erobert ?? {} } : null,
      };
    }
    return alt;
  },
};
