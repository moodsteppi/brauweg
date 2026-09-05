/**
 * Die Sicht des Filler-Moduls, wie der Client sie liest.
 *
 * Sie stand bis zum 06.09.2026 in screens/Filler.tsx. Hier steht sie, weil
 * der Vertrag unter src/vertrag/ sie gegen die echte Modulsicht haelt
 * (packages/game-filler/src/sicht.ts) — und ein Import aus dem Bildschirm
 * zoege React samt aller Bauteile in einen Test, der nur Typen vergleichen
 * will.
 *
 * Zweitbeschreibung mit Absicht; warum, steht in src/vertrag/README.md.
 */

/**
 * Die beiden Spielarten. Muss zu FillerVariante in
 * packages/game-filler/src/regeln.ts passen.
 */
export type Variante = 'nebel' | 'klar' | 'build';

/** Sicht des Moduls, siehe packages/game-filler/src/sicht.ts. */
export interface FillerSicht {
  ich: number | null;
  /** Spielart dieses Tisches. Der Kopf des Bretts schreibt sie hin. */
  variante: Variante;
  spalten: number;
  zeilen: number;
  farbzahl: number;
  /** Farbnummer je Platz, oder null solange das Feld im Nebel liegt. */
  feld: (number | null)[];
  /** Grauton je Platz — nur Zeichnung, verraet nichts. */
  grau: number[];
  besitzer: (number | null)[];
  farbe: Record<number, number>;
  punkte: Record<number, number>;
  dran: number;
  zug: number;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
  /** Gesetzte Barrieren als Plaetzepaare. Leer ausser in der Spielart `build`. */
  barrieren: [number, number][];
  /** Wie viele Barrieren jedem Sitz noch bleiben. */
  barrierenUebrig: Record<number, number>;
  /**
   * Wohin ich gerade eine Barriere setzen darf. Fehlt, wenn ich nicht am Zug
   * bin oder keine mehr habe.
   *
   * Kommt fertig vom Server, weil die Einsperr-Regel eine REGEL ist — der
   * Client baut sie nicht nach (CLAUDE.md).
   */
  barrierenMoeglich?: [number, number][];
}
