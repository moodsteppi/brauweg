/**
 * Die Sicht des Golf-Moduls, wie der Client sie liest.
 *
 * Der Vertrag unter `src/vertrag/` haelt diese Beschreibung gegen die echte
 * Modulsicht (packages/game-golf/src/adapter.ts). Sie steht hier und nicht im
 * Bildschirm, damit ein Import aus einer `.tsx` nicht React in einen Test
 * zieht, der nur Typen vergleichen will.
 *
 * Golf ist wie Feldherr Echtzeit im Gleichschritt: Ueber die Leitung gehen
 * nur Schlaege (`GolfZug`), niemals ein Spielzustand. Die eigentliche Bahn,
 * die Baelle und die Loecher kennt diese Sicht nicht — das rechnet der Client
 * selbst aus Saatkorn und Zugliste (siehe SPEZIFIKATION-GOLF.md Abschnitt 2
 * und 3). `botStufe` ist die vom Tisch gewuenschte Bot-Spielstaerke, siehe
 * `BotLevel` in protocol.ts.
 */

/** Spielstaerke der Bots — Spiegelbild von game-api BotLevel (protocol.ts). */
export type GolfBotStufe = 'anfaenger' | 'standard' | 'experte' | 'genie';

/**
 * Ein Schlag, verankert an einem Takt. Richtung ist ein Einheitsvektor
 * `(rx, ry)`, keine Gradzahl — Determinismus-Regel aus der Spezifikation:
 * Winkelfunktionen weichen zwischen Browsern in der letzten Stelle ab.
 */
export interface GolfZug {
  takt: number;
  /** Laufnummer innerhalb des Sitzes — Teil der kanonischen Ereignisordnung. */
  nr: number;
  rx: number;
  ry: number;
  kraft: number;
}

/** Wer den Tisch verlassen hat, und ab welchem Zug (Index in `zuege`). */
export interface GolfAusstieg {
  sitz: number;
  abZug: number;
}

/** Gemeldetes Gesamtergebnis eines Sitzes am Matchende. */
export interface GolfMeldung {
  schlaege: number[];
  pruef: string;
}

/** Ausgang eines Matches, sobald genug Meldungen vorliegen. */
export interface GolfAusgang {
  schlaege: number[];
  strittig: boolean;
}

/** Sicht des Moduls, siehe packages/game-golf/src/adapter.ts. */
export interface GolfSicht {
  saat: number;
  sitze: number;
  loecher: number;
  botSitze: number[];
  /** Schlaege aller Sitze, aeltester zuerst — ab `abIndex` nur der Zuwachs. */
  zuege: (GolfZug & { sitz: number })[];
  /** Stelle in der Gesamtliste, an der `zuege` beginnt (siehe Feldherr-Vorbild). */
  abIndex: number;
  ausstiege: GolfAusstieg[];
  meldungen: Record<number, GolfMeldung>;
  ausgang: GolfAusgang | null;
  taktMs: number;
  vorlauf: number;
  botStufe: GolfBotStufe;
}
