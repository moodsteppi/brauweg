/**
 * Doppelkopf lernen — was der Client vom Lernpfad zu sehen bekommt.
 *
 * Der Inhalt der Lektionen steht im Modul (game-doppelkopf/src/lernen.ts),
 * die Serie im Server (lernpfad.ts). Der Client beschreibt beides hier ein
 * zweites Mal, wie jede Sicht (CLAUDE.md), und `vertrag/lernpfad.test.ts`
 * haelt die Beschreibung gegen das Modul.
 */

import type { Card, PlayedCard } from '../protocol';

export interface LernStichKarte {
  sitz: number;
  karte: Card;
}

export type LernSchritt =
  | { art: 'erklaerung'; titel: string; text: string; karten?: Card[] }
  | {
      art: 'waehlen';
      titel: string;
      text: string;
      hand: Card[];
      stich: LernStichKarte[];
      richtig: number[];
      /** Alle richtigen Karten antippen, dann pruefen (statt einer). */
      alle?: true;
      hinweis: string;
      merke: string;
    }
  | {
      art: 'frage';
      titel: string;
      text: string;
      karten?: Card[];
      stich?: LernStichKarte[];
      antworten: string[];
      richtig: number;
      hinweis: string;
      merke: string;
    };

export interface Lektion {
  id: string;
  titel: string;
  kurz: string;
  schritte: LernSchritt[];
  uebung?: true;
}

export interface SerieHeute {
  serie: number;
  beste: number;
  heuteGespielt: boolean;
  brauchtSchutz: boolean;
  schutzFrei: boolean;
}

export interface LernpfadAnsicht {
  lektionen: { id: string; titel: string; kurz: string; uebung: boolean; erledigt: boolean }[];
  serie: SerieHeute;
  ziel: number;
  belohnt: boolean;
  outfit: string[];
}

export interface Spieltag {
  serie: number;
  neuerTag: boolean;
  geschuetzt: boolean;
  belohnung: boolean;
  pfad: LernpfadAnsicht;
}

/** Kurzfassung in `/api/me` — die Flamme auf dem Start. */
export interface LernserieKurz {
  serie: number;
  heuteGespielt: boolean;
  belohnt: boolean;
  ziel: number;
}

/** Die Namen am Lerntisch, Sitz 0 bist du (LERN_NAMEN im Modul). */
export const LERN_NAMEN = ['Du', 'Ole', 'Mia', 'Kai'] as const;

/** Ein Stich als gelegte Karten, wie ihn der Kartentisch kennt. */
export function alsGelegt(stich: readonly LernStichKarte[]): PlayedCard[] {
  return stich.map((g) => ({ seat: g.sitz, card: g.karte }));
}
