/**
 * Zielen: aus einer Zeigerbewegung wird ein Schlag.
 *
 * Reine Rechnungen, kein DOM — der Bildschirm rechnet Bildschirmpixel in
 * Weltkoordinaten um und fragt hier nach dem Rest. Das hält die
 * Ereignisbehandlung im Bildschirm kurz und macht die Zahlen prüfbar.
 *
 * Die wichtigste Zeile hier ist die Umkehrung: Der Ball fliegt ENTGEGEN der
 * Zugrichtung. Man zieht den Ball zurück wie einen Flitzebogen und lässt los.
 */

import type { Karte } from './karte';
import {
  KRAFT_MIN,
  MAX_ZUG,
  type Ereignis,
  type Partiezustand,
  kopiere,
  schritt,
} from './physik';

/** Trefferradius um den eigenen Ball, in Einheiten (Maus). */
export const TREFFER_RADIUS = 1.6;
/** Am Handy größer: Ein Daumen trifft keine 0,32-Einheiten-Kugel. */
export const TREFFER_RADIUS_TIPP = 2.2;
/** So viele Takte weit wird die Bahn vorausgerechnet. */
export const VORSCHAU_TAKTE = 20;

/** Was ein abgeschlossener Zug ergibt. */
export interface Schlagwunsch {
  /** Einheitsvektor der SCHUSSrichtung (entgegen der Zugrichtung). */
  rx: number;
  ry: number;
  /** Kraft in (0, 1]. */
  kraft: number;
  /** Zuglänge in Einheiten — der Zoom hängt daran. */
  laenge: number;
}

/**
 * Aus dem Zugvektor (Ball → Zeiger, in Weltkoordinaten) einen Schlag machen.
 *
 * `null` heißt Abbruch: zu kurz gezogen. Die Schwelle ist dieselbe
 * `KRAFT_MIN`, die auch die Physik als kleinste Kraft kennt — zwei Schwellen
 * an zwei Stellen wären ein Band, in dem der Bildschirm einen Schlag
 * zuließe, den der Kern dann auf etwas anderes hochzöge.
 */
export function schlagAus(dx: number, dy: number): Schlagwunsch | null {
  const laenge = Math.sqrt(dx * dx + dy * dy);
  if (laenge <= 0) return null;
  const kraft = Math.min(1, laenge / MAX_ZUG);
  if (kraft < KRAFT_MIN) return null;
  // Entgegen der Zugrichtung: minus.
  return { rx: -dx / laenge, ry: -dy / laenge, kraft, laenge };
}

/** Trifft der Zeiger den eigenen Ball? */
export function trifftBall(
  ballX: number,
  ballY: number,
  x: number,
  y: number,
  grob: boolean,
): boolean {
  const r = grob ? TREFFER_RADIUS_TIPP : TREFFER_RADIUS;
  const dx = x - ballX;
  const dy = y - ballY;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Die gepunktete Bahnvorschau: wohin der Ball in den nächsten Takten rollte.
 *
 * Gerechnet mit DENSELBEN Physikfunktionen wie die Partie, auf einer Kopie
 * des Zustands — eine eigene, vereinfachte Vorausrechnung wäre eine zweite
 * Wahrheit über die Physik und läge an jeder Bande daneben.
 *
 * Fremde Bälle werden für die Vorschau auf `dabei: false` gesetzt und die
 * Bots abgeschaltet: Wo die anderen in zwei Sekunden stehen, weiß niemand,
 * und eine Vorschau, die an einem Ball abprallt, der dort nie sein wird,
 * lügt schlimmer als eine, die ihn ignoriert. Wände, Zonen und Bumper
 * gelten dagegen ganz normal.
 */
export function vorschau(
  zustand: Partiezustand,
  sitz: number,
  rx: number,
  ry: number,
  kraft: number,
  karten: readonly Karte[],
  ziel: number[],
  takte = VORSCHAU_TAKTE,
): number[] {
  ziel.length = 0;
  if (sitz < 0 || sitz >= zustand.baelle.length) return ziel;
  const z = kopiere(zustand);
  z.botSitze = [];
  for (let s = 0; s < z.baelle.length; s += 1) {
    if (s !== sitz) z.baelle[s].dabei = false;
  }
  const schlag: Ereignis = { art: 'schlag', takt: z.takt, sitz, nr: -1, rx, ry, kraft };
  const leer: Ereignis[] = [];
  for (let i = 0; i < takte; i += 1) {
    schritt(z, i === 0 ? [schlag] : leer, karten);
    /*
     * Der Ball wird JE DURCHGANG neu gelesen und nicht einmal gemerkt:
     * Endet in der Vorschau ein Loch, stellt `starteLoch` eine ganz neue
     * Ballliste auf, und die gemerkte Kugel zeigte danach ins Leere.
     */
    const eigen = z.baelle[sitz];
    if (eigen === undefined || !eigen.dabei || eigen.eingelocht) break;
    ziel.push(eigen.x, eigen.y);
    if (eigen.ruht) break;
  }
  return ziel;
}
