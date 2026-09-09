/**
 * Die Sicht des Feldherr-Moduls, wie der Client sie liest.
 *
 * Sie stand bis zum 06.09.2026 in screens/FeldherrTisch.tsx. Hier steht sie,
 * weil der Vertrag unter src/vertrag/ sie gegen die echte Modulsicht haelt
 * (packages/game-feldherr/src/adapter.ts, `FeldherrView`) — und ein Import aus
 * dem Bildschirm zoege React samt aller Bauteile in einen Test, der nur Typen
 * vergleichen will.
 *
 * Die Zugform kommt aus `kern.d.ts` und nicht noch einmal von Hand: Sie ist
 * dieselbe, die der gebaute Spielkern meldet und die der Server nur
 * weiterreicht. Waeren es zwei Beschreibungen, koennte der Vertrag gruen sein,
 * waehrend Kern und Modul auseinanderlaufen.
 */

// Nur der Typ: `kern.js` ist der gebaute Spielkern und hat im Vertrag nichts
// zu suchen.
import type { FeldherrZug } from './kern.js';

/** Feldgroessen des Moduls, siehe packages/game-feldherr/src/regeln.ts. */
export type Feld = 'klein' | 'mittel' | 'gross';

/** Sicht des Feldherr-Moduls, siehe packages/game-feldherr/src/adapter.ts. */
export interface FeldherrSicht {
  saat: number;
  regeln: { feld: Feld };
  /**
   * Ausschnitt der Zugliste, nicht zwingend die ganze — `abIndex` sagt, wo
   * er anfaengt. Beim `join` (und damit nach jedem Wiederverbinden) ist er
   * 0 und die Liste vollstaendig; nach einem Zug enthaelt sie nur den
   * Zuwachs. Der Grund steht in `viewCursor` in packages/game-api.
   */
  zuege: (FeldherrZug & { sitz: number })[];
  abIndex?: number;
  /**
   * Die Ergebnismeldung je Sitz. Der Bildschirm rechnet nicht damit — sie
   * steht hier fuer die Aufzeichnung: Weichen Sieger oder Pruefsumme der
   * beiden Geraete ab, gilt die Partie als strittig, und dann ist genau
   * dieses Paar der Beweis, WIE weit sie auseinanderlagen.
   */
  meldungen?: Record<number, { sieger: number; takt: number; pruef: string }>;
  ausgang: { sieger: number | null; strittig: boolean; aufgegeben: boolean } | null;
}
