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
 * selbst aus Saatkorn, Bahnkennungen und Zugliste (siehe SPEZIFIKATION-GOLF.md
 * Abschnitt 2 und 3). `botStufe` ist die vom Tisch gewuenschte Bot-Spielstaerke, siehe
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
  /**
   * Die Tafel `[loch][sitz]` hinter `pruef`, seit dem 22.09.2026 fuer die
   * Bestleistung je Bahn. Fehlt bei Geraeten von davor. Der Bildschirm liest
   * sie nicht — er hat seine eigene Tafel aus der Physik.
   */
  jeLoch?: number[][];
  /** `[loch][sitz]` ob der Ball gefallen ist — nicht eingelocht ist nie eine Bestleistung. */
  eingelocht?: boolean[][];
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
  /**
   * Die Bahnen der Partie als Kennungen, eine je Loch in Spielfolge — seit
   * dem 22.09.2026 vom Modul gezogen statt auf jedem Geraet. Aufgeloest wird
   * gegen `karten/` (`loeseBahnen`); fehlt eine, ist dieser Stand zu alt.
   */
  bahnen: string[];
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
  /**
   * Klassisch oder Fun (seit dem 23.09.2026). Im Fun-Modus zieht jedes Gerät
   * je Loch selbst einen Modifikator aus `saat` und Lochindex
   * (modifikator.ts) — über die Leitung geht dafür nichts. Optional nur für
   * Testsichten und Server von davor: Fehlt es, ist der Tisch klassisch
   * (`modusAus` in netz.ts); das Modul liefert es immer.
   */
  modus?: 'klassisch' | 'fun';
}
