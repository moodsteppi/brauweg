/**
 * Die Sicht des Eiland-Moduls, wie der Client sie liest.
 *
 * Sie stand bis zum 06.09.2026 in screens/Eiland.tsx. Hier steht sie, weil
 * der Vertrag unter src/vertrag/ sie gegen die echte Modulsicht haelt
 * (packages/game-eiland/src/sicht.ts) — und ein Import aus dem Bildschirm
 * zoege React samt aller Bauteile in einen Test, der nur Typen vergleichen
 * will.
 *
 * Zweitbeschreibung mit Absicht; warum, steht in src/vertrag/README.md.
 */

/** Sicht des Moduls, siehe packages/game-eiland/src/sicht.ts. */
export interface EilandSicht {
  ich: number | null;
  spalten: number;
  zeilen: number;
  sichtweite: number;
  /** 'nebel' oder 'klar' — siehe packages/game-eiland/src/regeln.ts. */
  variante: EilandVariante;
  /** 0 Gras, 1 Wasser, 2 Berg — oder null, solange das Feld im Nebel liegt. */
  gelaende: (number | null)[];
  ornament: (number | null)[];
  /** Eingesammelte Ornamente, die als Bauwerk stehen geblieben sind. */
  bauwerk: (number | null)[];
  besitzer: (number | null)[];
  /** Grauton je Platz — nur Zeichnung, verraet nichts. */
  grau: number[];
  punkte: Record<number, number>;
  gesammelt: Record<number, number>;
  kontingent: Record<number, number>;
  bereit: Record<number, boolean>;
  wahl: number[];
  waehlbar: number[];
  runde: number;
  letzte: {
    runde: number;
    /** In Entscheidungsreihenfolge; `einsatz` = Sitze, die ein Feld darauf gesetzt haben. */
    kaempfe: { platz: number; sieger: number; einsatz: number[] }[];
    reserve: Record<number, number>;
    genommen: Record<number, number[]>;
    verfallen: Record<number, number[]>;
    ornamente: Record<number, number>;
  } | null;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}

/** Die beiden Spielarten, siehe packages/game-eiland/src/regeln.ts. */
export type EilandVariante = 'nebel' | 'klar';
