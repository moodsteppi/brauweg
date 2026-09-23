/**
 * Die Regelkarten des Koenigsbechers: was jede Karte des Stapels bedeutet.
 *
 * Gezogen wird aus demselben 52er-Blatt wie beim Bus fahren (`neuerStapel`
 * in partie.ts); hier steht nur, was ein RANG am Tisch ausloest. Der Text ist
 * das, was auf der Buehne steht, `folge` das, was die Regel daraus macht —
 * getrennt, damit man die Texte pflegen kann, ohne eine Zeile Ablauf zu
 * beruehren, und damit keine Regel am Wortlaut haengt.
 *
 * KEIN TRINKWORT. Die Karten sind Befehle an alle, dieselbe strenge Stufe wie
 * Wahrheit oder Pflicht und die Regel-Karten: Wer eine Karte trifft,
 * „kassiert" — ob das ein Schluck ist oder ein Strafpunkt, sagt die Wertung
 * (`SCHLUECKE` in regeln.ts) und der Trinkmodus des Tisches, nicht der Text.
 * Die Kneipenfassung („Zwei — du trinkst, drei — ich trinke") wurde darum
 * umgeschrieben (`test/zeitdruck.test.ts`).
 *
 * Seit dem 23.09.2026. Kein Filterkatalog: Jeder Rang braucht GENAU eine
 * Karte, Haerte und Paket haetten hier nichts zu waehlen. Kennungen aendern
 * sich nie.
 */

import type { Inhalt } from './typen.js';

/** Was eine Karte am Tisch ausloest — die Regel dazu steht in zeitdruck.ts. */
export type KartenFolge =
  /** Alle Anwesenden kassieren. */
  | 'alle'
  /** Wer zieht, zeigt auf jemanden, der kassiert. */
  | 'waehlen'
  /** Wer zieht, kassiert selbst. */
  | 'selbst'
  /** Wer vor dem Ziehenden dran war. */
  | 'voriger'
  /** Wer nach dem Ziehenden dran ist. */
  | 'naechster'
  /** Alle ausser dem Ziehenden. */
  | 'andere'
  /** Alle tippen „Hand hoch", wer zuletzt tippt (oder gar nicht), kassiert. */
  | 'hand'
  /** Ein Punkt fuer den Ziehenden. */
  | 'glueck'
  /** Nach der Runde gilt eine neue Regel-Karte. */
  | 'regel'
  /** Der Becher fuellt sich; wer den letzten Koenig der Runde zieht, bekommt ihn. */
  | 'becher'
  /** Nichts. */
  | 'durchatmen';

export interface Koenigsbecherkarte extends Inhalt {
  /** 2..14, wie `Karte.rang` (11 Bube, 12 Dame, 13 Koenig, 14 Ass). */
  readonly rang: number;
  readonly folge: KartenFolge;
  readonly titel: string;
  readonly text: string;
}

export const KOENIGSBECHER_KARTEN: readonly Koenigsbecherkarte[] = [
  { id: 'kb02', rang: 2, folge: 'waehlen', titel: 'Du wählst', text: 'Zeig auf jemanden — der kassiert.' },
  { id: 'kb03', rang: 3, folge: 'selbst', titel: 'Du selbst', text: 'Diese Karte geht auf dich.' },
  { id: 'kb04', rang: 4, folge: 'voriger', titel: 'Voriger', text: 'Wer vor dir dran war, kassiert.' },
  { id: 'kb05', rang: 5, folge: 'naechster', titel: 'Nächster', text: 'Wer nach dir dran ist, kassiert.' },
  { id: 'kb06', rang: 6, folge: 'durchatmen', titel: 'Durchatmen', text: 'Diesmal passiert nichts.' },
  { id: 'kb07', rang: 7, folge: 'hand', titel: 'Hand hoch', text: 'Alle zeigen nach oben und tippen „Hand hoch" — wer zuletzt ist, kassiert.' },
  { id: 'kb08', rang: 8, folge: 'andere', titel: 'Alle anderen', text: 'Alle außer dir kassieren.' },
  { id: 'kb09', rang: 9, folge: 'glueck', titel: 'Glückskarte', text: 'Ein Punkt für dich.' },
  { id: 'kb10', rang: 10, folge: 'durchatmen', titel: 'Durchatmen', text: 'Diesmal passiert nichts.' },
  { id: 'kb11', rang: 11, folge: 'regel', titel: 'Neue Regel', text: 'Nach dieser Runde gilt eine neue Regel-Karte.' },
  { id: 'kb12', rang: 12, folge: 'durchatmen', titel: 'Gnade', text: 'Die Dame verschont den Tisch — diesmal passiert nichts.' },
  { id: 'kb13', rang: 13, folge: 'becher', titel: 'Becher', text: 'Der Becher füllt sich. Wer den letzten König der Runde zieht, bekommt ihn.' },
  { id: 'kb14', rang: 14, folge: 'alle', titel: 'Wasserfall', text: 'Alle kassieren — der ganze Tisch.' },
];

/** Die Karte zu einem Rang. Jeder Rang von 2 bis 14 hat genau eine (Test). */
export function koenigsbecherKarte(rang: number): Koenigsbecherkarte {
  return KOENIGSBECHER_KARTEN.find((k) => k.rang === rang) ?? KOENIGSBECHER_KARTEN[4]!;
}
