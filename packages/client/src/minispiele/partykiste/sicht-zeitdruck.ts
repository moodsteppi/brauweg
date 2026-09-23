/**
 * Die Sicht der drei Minispiele mit Uhr (Bombe, 10 Sekunden, Koenigsbecher),
 * wie der Client sie liest — seit dem 23.09.2026.
 *
 * Spiegelbild von packages/game-partykiste/src/zeitdruck.ts; der Vertrag
 * unter `src/vertrag/partykiste.test.ts` haelt beide deckungsgleich. Eigene
 * Datei, damit `sicht.ts` nur Einhaengezeilen bekommt.
 *
 * Was hier NICHT steht, ist das Spiel der Bombe: ihre Zuendzeit. Der Server
 * schickt sie nicht, auch nicht als `phaseDeadline` (`phaseHidden` in
 * game-api). Der Bildschirm kann die Restzeit also gar nicht zeigen — er hat
 * sie nicht.
 */

import type { PartyKarte } from './sicht';

export interface BombeSicht {
  art: 'bombe';
  kategorie: string;
  /** Wer die Bombe gerade haelt. */
  amZug: number;
  weitergaben: number;
  /** Wer sie hatte, als sie hochging; -1 solange sie tickt. */
  verlierer: number;
}

export interface ZehnSekundenSicht {
  art: 'zehnsekunden';
  sprecher: number;
  schritt: 'bereit' | 'sprechen' | 'urteil';
  /** null, solange der Sprecher nicht „Los" getippt hat — fuer alle. */
  aufgabe: string | null;
  /** Wie viele Dinge genannt werden muessen. */
  anzahl: number;
  /** Wer urteilt. Vom Server, nicht nachgerechnet. */
  richter: number[];
  meinUrteil: number;
  /** Wer schon geurteilt hat — nicht, wie. */
  abgegeben: number[];
  /** Erst im Ergebnis. */
  urteile: number[] | null;
  geschafft: boolean | null;
}

export type PartyKartenFolge =
  | 'alle'
  | 'waehlen'
  | 'selbst'
  | 'voriger'
  | 'naechster'
  | 'andere'
  | 'hand'
  | 'glueck'
  | 'regel'
  | 'becher'
  | 'durchatmen';

export interface PartyGezogeneKarte {
  sitz: number;
  karte: PartyKarte;
  kartenId: string;
  folge: PartyKartenFolge;
  /** Wen sie getroffen hat — bei „du wählst" und „Hand hoch" erst, wenn es feststeht. */
  ziele: number[];
  titel: string;
  text: string;
}

export interface KoenigsbecherSicht {
  art: 'koenigsbecher';
  amZug: number;
  kartenJeSitz: number;
  gezogen: number[];
  restKarten: number;
  letzte: PartyGezogeneKarte | null;
  wahlOffen: boolean;
  /** Nach einer Sieben: wer schon „Hand hoch" getippt hat, in Eingangsreihenfolge. */
  hand: number[] | null;
  /** Je Sitz: was er in dieser Runde kassiert hat, mit Härtegrad — ohne den Becher. */
  kassiert: number[];
  becher: number;
  koenigSitz: number;
  /** Die Regel, die nach dieser Runde gilt, oder null. */
  neueRegel: string | null;
}

/** Die Aktionen der drei. Koenigsbecher „du wählst" nimmt die vorhandene `stimme`. */
export type ZeitdruckAktion =
  | { art: 'weitergeben' }
  | { art: 'fertig' }
  | { art: 'urteil'; geschafft: boolean }
  | { art: 'ziehen' }
  | { art: 'hochzeigen' };
