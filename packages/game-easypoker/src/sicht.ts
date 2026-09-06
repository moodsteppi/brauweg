/**
 * Die gefilterte Sicht.
 *
 * Hier — und nur hier — entsteht die Sichtbarkeit (game-api, Grundsatz 2).
 * Beim Poker ist das die ganze Spielmechanik: Wer die Karten der anderen
 * kennt, braucht nicht mehr zu spielen. Fuer eine verdeckte Hand geht
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
 * Sitz gefiltert und verraet den anderen nichts.
 */

import type { Bewertung, Karte } from './karten.js';
import { besteHand } from './karten.js';
import type {
  EasyPokerPartie,
  HandErgebnis,
  LetzteAktion,
  Strasse,
} from './partie.js';
import {
  gegnerVon,
  pauseDauerMs,
  setzKosten,
  sieger,
  sitzeVon,
  topfGesamt,
  zuZahlen,
} from './partie.js';

export interface EasyPokerSicht {
  readonly handNr: number;
  readonly handMax: number;
  readonly strasse: Strasse;
  readonly brett: readonly Karte[];
  /** Die eigene Hand. Fuer Zuschauer immer leer. */
  readonly meineKarten: readonly Karte[];
  /**
   * Die Hand des naechsten anderen Sitzes — nur beim Zeigen. Sonst nur die
   * ANZAHL verdeckter Karten, damit ein Zweier-Bildschirm zwei Rueckseiten
   * legen kann, ohne die neuen Felder zu kennen.
   */
  readonly gegnerKarten: readonly Karte[] | null;
  readonly gegnerVerdeckt: number;
  /**
   * Fremde Karten je Sitz. `null` = verdeckt, leeres Feld = nicht in der
   * Hand (gepasst oder pleite). Eigene Karten stehen hier nicht.
   */
  readonly fremdeKarten: Readonly<Record<number, readonly Karte[] | null>>;
  readonly fremdeVerdeckt: Readonly<Record<number, number>>;
  readonly sitze: readonly number[];
  readonly imSpiel: readonly number[];
  readonly kleinerSitz: number;
  readonly grosserSitz: number;
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

function fremdsicht(
  partie: EasyPokerPartie,
  sitz: number | null,
): {
  fremdeKarten: Record<number, readonly Karte[] | null>;
  fremdeVerdeckt: Record<number, number>;
} {
  const fremdeKarten: Record<number, readonly Karte[] | null> = {};
  const fremdeVerdeckt: Record<number, number> = {};
  for (const anderer of sitzeVon(partie)) {
    if (sitz !== null && anderer === sitz) continue;
    const offen = offengelegt(partie, anderer);
    if (offen) {
      fremdeKarten[anderer] = offen;
      fremdeVerdeckt[anderer] = 0;
    } else if (partie.imSpiel.includes(anderer) && (partie.hand[anderer] ?? []).length > 0) {
      fremdeKarten[anderer] = null;
      fremdeVerdeckt[anderer] = (partie.hand[anderer] ?? []).length;
    } else {
      fremdeKarten[anderer] = null;
      fremdeVerdeckt[anderer] = 0;
    }
  }
  return { fremdeKarten, fremdeVerdeckt };
}

function grundsicht(partie: EasyPokerPartie, sitz: number | null): EasyPokerSicht {
  const zuschauer = sitz === null;
  const eigene = sitz === null ? [] : (partie.hand[sitz] ?? []);
  const gegner = sitz === null ? null : gegnerVon(partie, sitz);
  const { fremdeKarten, fremdeVerdeckt } = fremdsicht(partie, sitz);

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
    gegnerKarten: gegner === null ? null : (fremdeKarten[gegner] ?? null),
    gegnerVerdeckt: gegner === null ? 0 : (fremdeVerdeckt[gegner] ?? 0),
    fremdeKarten,
    fremdeVerdeckt,
    sitze: sitzeVon(partie),
    imSpiel: partie.imSpiel,
    kleinerSitz: partie.kleinerSitz,
    grosserSitz: partie.grosserSitz,
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
 * nur mitteilen, dass ein anderer blufft. Gezeigte Karten am Ende einer Hand
 * darf er sehen, die stehen ohnehin auf dem Tisch.
 */
export function zuschauerSicht(partie: EasyPokerPartie): EasyPokerSicht {
  const sicht = grundsicht(partie, null);
  const gezeigt = sitzeVon(partie)
    .map((s) => partie.ergebnis?.gezeigt[s] ?? null)
    .filter((karten): karten is readonly Karte[] => karten !== null && karten.length > 0);
  return {
    ...sicht,
    gegnerKarten: gezeigt.length > 0 ? gezeigt.flat() : null,
    gegnerVerdeckt: 0,
    /*
     * Ein Zuschauer hat keine eigene Staerke.
     *
     * `grundsicht` rechnet sie aus `[...eigene, ...brett]` — fuer den
     * Zuschauer ist `eigene` leer, also ergibt sich ab dem Flop die Staerke
     * des offenen BRETTS. Verraten wird damit nichts (das Brett liegt fuer
     * alle sichtbar), aber der Client zeigt dieses Feld als Handkategorie
     * fett an: Wer zuschaut, las dort "Zwei Paare", als haette er eine Hand.
     * Alle anderen persoenlichen Felder werden fuer Zuschauer bereits geleert
     * (meineKarten, gegnerKarten, zuZahlen, setzKosten); dieses fehlte.
     */
    meineStaerke: null,
  };
}
