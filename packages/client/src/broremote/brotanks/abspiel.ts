import { REGELN } from './regeln';
import { flugBerechnen, type Flugbahn } from './flug';
import type { TanksSicht } from './partie';

/**
 * FUND zu Karte 2: sicht() nennt den Flug erst nach dem Aufschlag (schuss ist in der Phase 'flug' leer).
 * Damit die Bühne die Kugel fliegen lassen kann, rechnet sie die Bahn mit derselben Funktion und denselben
 * Eingaben nach, mit denen TanksPartie.feuern() sie rechnet. abspiel.test.ts hält beide Bahnen gleich.
 */
export function flugNachrechnen(s: TanksSicht): Flugbahn | null {
  if (s.phase !== 'flug') return null;
  const ids = s.gleichzeitig ? s.salve ?? [] : [s.amZug];
  const bahnen = ids.flatMap(id => {
    const b = s.bros.find(x => x.id === id);
    if (!b) return [];
    const ziele = s.bros.filter(o => !o.raus).map(o => ({ x: o.x, y: o.y, schuetze: o.id === b.id }));
    return [flugBerechnen(b, b.winkel, b.staerke, s.wind, b.waffe, new Float32Array(s.gelaende), ziele)];
  });
  if (!bahnen.length) return null;
  return { dauer: Math.max(...bahnen.map(b => b.dauer)), teile: bahnen.flatMap(b => b.teile),
    einschlaege: bahnen.flatMap(b => b.einschlaege).sort((a, b) => a.t - b.t) };
}

/** Flugzeit in s, die zur Restzeit der Phase gehört. Lange Flüge laufen schneller (Entwurf, Abschnitt 4). */
export function flugZeit(bahn: Flugbahn, rest: number): number {
  const anzeige = Math.max(30 * REGELN.schritt, Math.round(Math.min(REGELN.flugAnzeige, bahn.dauer) / REGELN.schritt) * REGELN.schritt);
  return Math.min(bahn.dauer, Math.max(0, anzeige - rest) * Math.max(1, bahn.dauer / REGELN.flugAnzeige));
}
