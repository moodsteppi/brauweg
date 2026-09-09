/**
 * Die Sicht des Poker-Moduls, wie der Client sie liest.
 *
 * Sie stand bis zum 06.09.2026 in screens/EasyPoker.tsx. Hier steht sie, weil
 * der Vertrag unter src/vertrag/ sie gegen die echte Modulsicht haelt
 * (packages/game-easypoker/src/sicht.ts) — und ein Import aus dem Bildschirm
 * zoege React samt aller Bauteile in einen Test, der nur Typen vergleichen
 * will.
 *
 * Zweitbeschreibung mit Absicht; warum, steht in src/vertrag/README.md.
 */

export interface Karte {
  farbe: string;
  wert: string;
  id: number;
}

export interface Bewertung {
  kategorie: number;
  werte: number[];
  karten: Karte[];
}

export type Aktionsart = 'passen' | 'schieben' | 'mitgehen' | 'setzen';

export interface LetzteAktion {
  sitz: number;
  art: Aktionsart;
  betrag: number | null;
}

export interface HandErgebnis {
  gewinner: number[];
  durchAufgabe: boolean;
  topf: number;
  gezeigt: Record<number, Karte[]>;
  bewertung: Record<number, Bewertung>;
  gewinn: Record<number, number>;
}

export interface EasyPokerSicht {
  handNr: number;
  handMax: number;
  strasse: 'preflop' | 'flop' | 'turn' | 'river';
  brett: Karte[];
  meineKarten: Karte[];
  gegnerKarten: Karte[] | null;
  gegnerVerdeckt: number;
  fremdeKarten: Record<number, Karte[] | null>;
  fremdeVerdeckt: Record<number, number>;
  sitze: number[];
  imSpiel: number[];
  kleinerSitz: number;
  grosserSitz: number;
  meineStaerke: Bewertung | null;
  jetons: Record<number, number>;
  einsatz: Record<number, number>;
  topf: number;
  geber: number;
  dran: number | null;
  zuZahlen: number;
  setzKosten: number | null;
  letzteAktion: LetzteAktion | null;
  ergebnis: HandErgebnis | null;
  pauseMs: number | null;
  kleinerBlind: number;
  grosserBlind: number;
  startJetons: number;
  namen: Record<number, string>;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}
