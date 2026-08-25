/**
 * Die gefilterte Sicht.
 *
 * Hier — und nur hier — entsteht die Sichtbarkeit (game-api, Grundsatz 2).
 * Beim Poker ist das die ganze Spielmechanik: Wer die beiden Karten des
 * Gegners kennt, braucht nicht mehr zu spielen. Fuer eine verdeckte Hand geht
 * deshalb `null` raus und nicht etwa die Karte mit einem Merker "bitte nicht
 * anzeigen".
 *
 * Was ABSICHTLICH NICHT drinsteht: die Zufallsbasis der Partie und der
 * Reststapel. Beides stuende sonst in jeder Netzwerkantwort und verriete jede
 * kommende Karte.
 *
 * Was zusaetzlich DRINSTEHT, ist die eigene Handstaerke (`meineStaerke`). Sie
 * ist eine Regel, und der Client bildet keine Regeln nach (DESIGN-DOKO) — er
 * soll aber "Zwei Paare" anzeigen koennen, ohne selbst zu werten. Sie ist je
 * Sitz gefiltert und verraet dem Gegner nichts.
 */

import type { Bewertung, Karte } from './karten.js';
import { besteHand } from './karten.js';
import type {
  EasyPokerPartie,
  HandErgebnis,
  LetzteAktion,
  Strasse,
} from './partie.js';
import { gegnerVon, pauseDauerMs, setzKosten, sieger, sitzeVon, topfGesamt, zuZahlen } from './partie.js';

export interface EasyPokerSicht {
  readonly handNr: number;
  readonly handMax: number;
  readonly strasse: Strasse;
  readonly brett: readonly Karte[];
  /** Die eigene Hand. Fuer Zuschauer immer leer. */
  readonly meineKarten: readonly Karte[];
  /**
   * Die Hand des Gegners — nur beim Zeigen. Sonst nur die ANZAHL verdeckter
   * Karten, damit der Bildschirm zwei Rueckseiten legen kann.
   */
  readonly gegnerKarten: readonly Karte[] | null;
  readonly gegnerVerdeckt: number;
  /** Beste Fuenferkombination des eigenen Sitzes, sobald das Brett liegt. */
  readonly meineStaerke: Bewertung | null;
  readonly jetons: Readonly<Record<number, number>>;
  readonly einsatz: Readonly<Record<number, number>>;
  /** Topf einschliesslich der Einsaetze der laufenden Strasse. */
  readonly topf: number;
  readonly geber: number;
  readonly dran: number | null;
  /** Was der eigene Sitz zum Mitgehen zahlen muesste. Null, wenn nichts. */
  readonly zuZahlen: number;
  /** Was ein Erhoehen den eigenen Sitz kosten wuerde, oder null. */
  readonly setzKosten: number | null;
  readonly letzteAktion: LetzteAktion | null;
  readonly ergebnis: HandErgebnis | null;
  /** Dauer der laufenden Schaupause, damit der Bildschirm mitzaehlen kann. */
  readonly pauseMs: number | null;
  readonly kleinerBlind: number;
  readonly grosserBlind: number;
  readonly startJetons: number;
  readonly namen: Readonly<Record<number, string>>;
  readonly fertig: boolean;
  readonly sieger: number | null;
  readonly leftSeats: readonly number[];
  /** true = neutrale Zuschauersicht, ohne jede Hand. */
  readonly zuschauer: boolean;
}

/**
 * Beim Zeigen liegen die Karten offen — aber nur die, die das Ergebnis auch
 * nennt. Bei einer Aufgabe nennt es keine.
 */
function offengelegt(partie: EasyPokerPartie, sitz: number): readonly Karte[] | null {
  const gezeigt = partie.ergebnis?.gezeigt[sitz];
  return gezeigt && gezeigt.length > 0 ? gezeigt : null;
}

function grundsicht(partie: EasyPokerPartie, sitz: number | null): EasyPokerSicht {
  const zuschauer = sitz === null;
  const eigene = sitz === null ? [] : (partie.hand[sitz] ?? []);
  const gegner = sitz === null ? null : gegnerVon(partie, sitz);

  /*
   * Die eigene Staerke erst ab dem Flop.
   *
   * Vorher besteht die "beste Fuenferkombination" aus zwei Karten und ist
   * damit keine — `besteHand` verlangt aus gutem Grund mindestens fuenf.
   */
  const alleEigenen = [...eigene, ...partie.brett];
  const meineStaerke = alleEigenen.length >= 5 ? besteHand(alleEigenen) : null;

  return {
    handNr: partie.handNr,
    handMax: partie.handMax,
    strasse: partie.strasse,
    brett: partie.brett,
    meineKarten: eigene,
    gegnerKarten: gegner === null ? null : offengelegt(partie, gegner),
    gegnerVerdeckt: gegner === null ? 0 : (partie.hand[gegner] ?? []).length,
    meineStaerke,
    jetons: partie.jetons,
    einsatz: partie.einsatz,
    topf: topfGesamt(partie),
    geber: partie.geber,
    dran: partie.fertig || partie.ergebnis !== null ? null : partie.dran,
    zuZahlen: sitz === null ? 0 : zuZahlen(partie, sitz),
    setzKosten: sitz === null ? null : setzKosten(partie, sitz),
    letzteAktion: partie.letzteAktion,
    ergebnis: partie.ergebnis,
    pauseMs: pauseDauerMs(partie),
    kleinerBlind: partie.regeln.kleinerBlind,
    grosserBlind: partie.regeln.grosserBlind,
    startJetons: partie.regeln.startJetons,
    namen: partie.namen,
    fertig: partie.fertig,
    sieger: sieger(partie),
    leftSeats: partie.leftSeats,
    zuschauer,
  };
}

export function sichtFuer(partie: EasyPokerPartie, sitz: number): EasyPokerSicht {
  return grundsicht(partie, sitz);
}

/**
 * Zuschauersicht, OHNE jede Hand.
 *
 * Die Trennung ist nicht verhandelbar (game-api): Ein Zuschauer mit
 * Handeinsicht waere hier der perfekte Komplize — er muesste einem Spieler
 * nur mitteilen, dass der Gegner blufft. Gezeigte Karten am Ende einer Hand
 * darf er sehen, die stehen ohnehin auf dem Tisch.
 */
export function zuschauerSicht(partie: EasyPokerPartie): EasyPokerSicht {
  const sicht = grundsicht(partie, null);
  const sitze = sitzeVon(partie);
  const gezeigt = sitze
    .map((s) => partie.ergebnis?.gezeigt[s] ?? null)
    .filter((karten): karten is readonly Karte[] => karten !== null && karten.length > 0);
  return {
    ...sicht,
    gegnerKarten: gezeigt.length > 0 ? gezeigt.flat() : null,
    gegnerVerdeckt: 0,
  };
}
