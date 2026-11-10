import { REGELN } from './regeln';
import { flugBerechnen, type Flugbahn } from './flug';
import type { TanksSicht } from './partie';

/**
 * FUND zu Karte 2: sicht() nennt den Flug erst nach dem Aufschlag (schuss ist in der Phase 'flug' leer).
 * Damit die Bühne die Kugel fliegen lassen kann, rechnet sie die Bahn mit derselben Funktion und denselben
 * Eingaben nach, mit denen TanksPartie.feuern() sie rechnet. abspiel.test.ts hält beide Bahnen gleich.
 */
export function flugNachrechnen(s: TanksSicht): Flugbahn | null {
  const b = s.bros.find(x => x.id === s.amZug);
  if (s.phase !== 'flug' || !b) return null;
  const ziele = s.bros.filter(o => !o.raus).map(o => ({ x: o.x, y: o.y, schuetze: o.id === b.id }));
  return flugBerechnen({ x: b.x, y: b.y }, b.winkel, b.staerke, s.wind, b.waffe, new Float32Array(s.gelaende), ziele);
}

/** Flugzeit in s, die zur Restzeit der Phase gehört. Lange Flüge laufen schneller (Entwurf, Abschnitt 4). */
export function flugZeit(bahn: Flugbahn, rest: number): number {
  const anzeige = Math.max(30 * REGELN.schritt, Math.round(Math.min(REGELN.flugAnzeige, bahn.dauer) / REGELN.schritt) * REGELN.schritt);
  return Math.min(bahn.dauer, Math.max(0, anzeige - rest) * Math.max(1, bahn.dauer / REGELN.flugAnzeige));
}
