/**
 * Die Zielkette (Phase 5, 24.10.2026): immer genau ein naechstes Ziel, mit
 * Fortschritt, und eine kleine Belohnung in Talern zum Abholen. Sie fuehrt
 * durch das, was die Fingeranleitung nicht mehr zeigt — Meister tauschen,
 * Rabatt nutzen, renovieren, das Werkstattbuch.
 *
 * Gemessen wird am Stand selbst oder an Zaehlern, die die Aktionen
 * hochzaehlen (`stand.zaehler`) — nie an einer Uhr, damit Server und Client
 * dasselbe Ziel sehen. Belohnt wird in Talern, nie in Siegeln oder
 * Hub-Muenzen: Die Ziele sind fuer jeden gleich, also waeren sie sonst eine
 * feste Muenzquelle.
 *
 * Die Tagesauftraege des Hubs (server/src/quests.ts) sind bewusst nicht
 * erweitert: Sie zahlen Hub-Muenzen, und „Loese 3 Faehigkeiten aus" taeglich
 * waere genau die Bruecke zwischen den Wirtschaften, die das Buch vermeidet.
 * Die zwei vorgeschlagenen Vorlagen stehen deshalb hier in der Kette.
 */

import { MAX_PRESSEN, freischaltKosten } from './formeln.js';
import { renovierung } from './renovieren.js';
import type { ManufakturStand } from './stand.js';

export type Zaehler = 'faehigkeiten' | 'getauscht' | 'rabattStufen';

export function zaehler(stand: ManufakturStand, z: Zaehler): number {
  return stand.zaehler[z] ?? 0;
}

/** Wie viele Meister je eingestellt wurden (Verkaufen zaehlt nicht zurueck). */
function eingestellt(stand: ManufakturStand): number {
  return Object.values(stand.belegschaft).reduce((summe, p) => summe + p.eingestellt, 0);
}

export interface Kettenziel {
  kennung: string;
  text: string;
  /** Fortschritt jetzt und wie viel es braucht. */
  messe: (stand: ManufakturStand) => { ist: number; soll: number };
}

const einmal = (ja: boolean) => ({ ist: ja ? 1 : 0, soll: 1 });

export const ZIELKETTE: readonly Kettenziel[] = [
  { kennung: 'meister-2', text: 'Stelle einen zweiten Meister ein', messe: (s) => ({ ist: Math.min(2, eingestellt(s)), soll: 2 }) },
  { kennung: 'faehigkeit-1', text: 'Löse eine Meister-Fähigkeit aus', messe: (s) => einmal(zaehler(s, 'faehigkeiten') >= 1) },
  { kennung: 'tauschen', text: 'Tausche einen Meister', messe: (s) => einmal(zaehler(s, 'getauscht') >= 1) },
  { kennung: 'rabatt-1', text: 'Kaufe eine Stufe mit Rabatt', messe: (s) => einmal(zaehler(s, 'rabattStufen') >= 1) },
  { kennung: 'faehigkeit-3', text: 'Löse 3 Fähigkeiten aus', messe: (s) => ({ ist: Math.min(3, zaehler(s, 'faehigkeiten')), soll: 3 }) },
  { kennung: 'rabatt-10', text: 'Kaufe 10 Stufen mit Rabatt', messe: (s) => ({ ist: Math.min(10, zaehler(s, 'rabattStufen')), soll: 10 }) },
  { kennung: 'pressen-8', text: 'Baue alle 8 Pressen', messe: (s) => ({ ist: s.pressen.length, soll: MAX_PRESSEN }) },
  { kennung: 'renovieren-1', text: 'Renoviere zum ersten Mal', messe: (s) => einmal(Object.values(s.orte).some((o) => o.renovierung > 0) || renovierung(s) > 0) },
  { kennung: 'buch-1', text: 'Kaufe den ersten Eintrag im Werkstattbuch', messe: (s) => einmal(Object.values(s.werkstattbuch).some((n) => n > 0)) },
  { kennung: 'umzug-1', text: 'Ziehe in eine neue Manufaktur', messe: (s) => einmal(s.meilensteine.some((k) => k.startsWith('umzug-'))) },
];

/** Das jetzige Ziel; null, wenn die Kette durch ist. */
export function aktuellesZiel(stand: ManufakturStand): Kettenziel | null {
  return ZIELKETTE[stand.ziel] ?? null;
}

export function zielErreicht(stand: ManufakturStand): boolean {
  const z = aktuellesZiel(stand);
  if (!z) return false;
  const { ist, soll } = z.messe(stand);
  return ist >= soll;
}

/**
 * Belohnung zum Abholen: ein Zwanzigstel dessen, was die naechste Etage
 * kostet — ein Zehntel war ein Vielfaches des Geldbeutels und uebersprang
 * ganze Ausbauten.
 * Am Etagenpreis statt am Ertrag, weil der Ertrag erst in ansicht.ts steht —
 * und der Kern keine Ringe zwischen seinen Teilen haben soll.
 */
export function zielBelohnung(stand: ManufakturStand): number {
  return freischaltKosten(Math.min(stand.pressen.length, MAX_PRESSEN - 1), stand.manufaktur) * 0.05;
}
