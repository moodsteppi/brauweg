/**
 * Die Sicht des DreckBro-Moduls, wie der Client sie liest.
 *
 * Steht hier und nicht im Bildschirm, weil der Vertrag unter src/vertrag/
 * sie gegen die echte Modulsicht haelt (packages/game-dreckbro/src/sicht.ts)
 * — ein Import aus einer .tsx zoege React in einen Test, der nur Typen
 * vergleichen will.
 *
 * Zweitbeschreibung mit Absicht; warum, steht in src/vertrag/README.md.
 */

/** Muss zu `KartenArt` in packages/game-dreckbro/src/karten.ts passen. */
export type KartenArt =
  | 'pfuetze'
  | 'schlammrutsche'
  | 'schneeball'
  | 'eisregen'
  | 'iglu'
  | 'tauwetter'
  | 'robbenklau';

export interface Karte {
  id: number;
  art: KartenArt;
}

export interface Pinguin {
  /** 0 blitzblank, 1 fleckig, 2 DreckBro. */
  dreck: number;
  iglu: boolean;
}

export interface Ziel {
  sitz: number;
  pinguin: number;
}

/** Ein Eintrag aus `legalActions` — der Bildschirm schickt ihn unveraendert zurueck. */
export type DreckBroZug =
  | { type: 'spielen'; karte: number; eigen?: number; ziel?: Ziel }
  | { type: 'abwerfen'; karte: number };

export interface LetzterZug {
  sitz: number;
  art: KartenArt | 'abwerfen';
  abgeworfen?: KartenArt;
  eigen?: number;
  ziel?: Ziel;
}

export interface Ende {
  sieger: number | null;
  grund: 'dreckbro' | 'zuggrenze';
}

/** Sicht des Moduls, siehe packages/game-dreckbro/src/sicht.ts. */
export interface DreckBroSicht {
  zuschauer: boolean;
  meinSitz: number | null;
  sitze: number;
  amZug: number | null;
  pinguine: Pinguin[][];
  hand: Karte[];
  handAnzahl: number[];
  stapel: number;
  ablage: KartenArt | null;
  letzterZug: LetzterZug | null;
  ende: Ende | null;
  zuege: number;
}
