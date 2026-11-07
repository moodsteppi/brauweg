/**
 * Flying Bro: was der Server schickt (packages/server/src/flyingbro.ts),
 * im Client noch einmal beschrieben — wie bei jedem Spiel (CLAUDE.md, „Der
 * Client beschreibt jede Sicht ein zweites Mal"). Die Ergebnisteile aus dem
 * Kern (`MeilenErgebnis`, `MuenzErgebnis`, `Sterne`) kommen direkt von dort:
 * Server und Client rechnen sie mit derselben Funktion.
 *
 * Steht hier und nicht im Bildschirm, damit ein späterer Vertrag
 * (src/vertrag/) sie ohne React importieren kann.
 */

import type { Hilfsmittel, MeilenErgebnis, MuenzErgebnis, Sterne } from '@brauweg/flyingbro-kern';

export interface FlyingbroLevelStand {
  sterne: number;
  bestpunkte: number;
}

export interface FlyingbroAnsicht {
  meilen: number;
  vorrat: Record<Hilfsmittel, number>;
  zierde: string[];
  muenzenOffen: number;
  /** Nur geschaffte Level, nach Kennung. */
  level: Record<string, FlyingbroLevelStand>;
  heute: {
    muenzen: number;
    restMuenzen: number;
    limitMuenzen: number;
    wiederholungen: number;
    restWiederholungen: number;
  };
  offenerStart: { levelId: string; hilfsmittel: string[] } | null;
}

export interface FlyingbroStartAntwort {
  levelId: string;
  start: number;
  hilfsmittel: Hilfsmittel[];
  vorrat: Record<Hilfsmittel, number>;
}

export interface FlyingbroErgebnisAntwort {
  levelId: string;
  geschafft: boolean;
  punkte: number;
  sterne: Sterne;
  besteSterne: number;
  neueSterne: number;
  meilen: MeilenErgebnis;
  muenzen: MuenzErgebnis;
  hubMuenzen: number;
  /** Mit diesem Versuch sind alle Sterne erreicht — der Goldhelm liegt jetzt im Kleiderschrank. */
  goldhelmNeu: boolean;
  stand: FlyingbroAnsicht;
}

export interface FlyingbroMeldung {
  levelId: string;
  geschafft: boolean;
  punkte: number;
  verschossen: number;
  hilfsmittel: Hilfsmittel[];
}
