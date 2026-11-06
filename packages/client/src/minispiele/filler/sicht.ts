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
export type Variante = 'nebel' | 'klar' | 'build' | 'extreme';

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
  /** Plaetze der Sternfelder. Leer ausser in der Spielart `extreme`. */
  sterne: number[];
  /** Noch mauerfreie Zuege der Eroeffnung; 0, sobald gebaut werden darf. */
  mauerSperre: number;
  /**
   * Wie viele Mauern ein Zug hoechstens setzen darf: 1, in Extreme 2, ohne
   * Mauern 0. Aus dem Regelsatz des TISCHES — ein Extreme-Tisch von vor dem
   * 05.11.2026 bleibt bei einer, und dann zeigt der Knopf auch nur eine.
   */
  mauernJeZug: number;
  /** Wie viele Mauern der Sitz am Zug in diesem Zug schon gesetzt hat. */
  mauernDiesenZug: number;
  /**
   * Sitze, die im naechsten bzw. laufenden Zug keine Mauer setzen duerfen,
   * weil sie im Zug davor die volle Zahl gebaut haben (Doppelmauer). Die
   * Regel rechnet das Modul; der Bildschirm sagt nur, WARUM der Knopf ruht.
   */
  mauerPause: number[];
  /**
   * Wer aufgegeben hat, oder null. Der Abschluss sagt dann "aufgegeben"
   * statt nur einen Punktestand, der zum Sieger nicht passt.
   */
  aufgegeben: number | null;
}

/**
 * Aufgeben (Spielkern seit dem 06.11.2026). Geht jederzeit, auch wenn der
 * Gegner am Zug ist, und steht bewusst NICHT in `legalActions` — daraus
 * waehlt der Bot, und der gibt nie auf. Der Bildschirm bietet den Knopf
 * deshalb von sich aus an; eine Regel baut er damit nicht nach, erlaubt ist
 * die Aktion immer, solange die Partie laeuft.
 *
 * `typ` und nicht `type` wie bei BroChess: Filler-Aktionen heissen so
 * (`faerben`, `barriere`). Der Vertrag haelt das gegen das Modul.
 */
export interface FillerAufgabe {
  typ: 'aufgeben';
}
