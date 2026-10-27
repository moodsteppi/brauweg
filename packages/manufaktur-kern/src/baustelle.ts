/**
 * Baustellen (Phase 4, 24.10.2026): Vor Etage 5 und Etage 8 liegt Schutt.
 * Bevor man sie bauen kann, braucht es Bauarbeiten — Taler plus Wartezeit,
 * die auch offline weiterlaeuft. Es gibt bewusst kein Sofort-Fertigstellen;
 * kuerzer macht es nur das Werkstattbuch (Flinke Bautrupps).
 *
 * Geraeumt wird **einmal je Ort**: Renovieren setzt die Etagen zurueck, und
 * jedes Mal wieder 10 und 30 min zu warten, machte das Renovieren zur Strafe.
 * Die Baustelle gehoert dem Ort (`orte[m].bau`) — wer waehrenddessen den Ort
 * wechselt, findet sie bei der Rueckkehr fertig vor.
 */

import { STELLSCHRAUBEN, freischaltKosten } from './formeln.js';
import type { ManufakturStand, OrtStand } from './stand.js';
import { bauFaktor } from './werkstattbuch.js';

const W = STELLSCHRAUBEN;

/** Vor welchen Etagen (Index: 4 = Etage 5) Schutt liegt, und wie lange die Arbeiten dauern. */
export const BAUSTELLEN: Readonly<Record<number, number>> = { 4: 10 * 60_000, 7: 30 * 60_000 };

function ort(stand: ManufakturStand): OrtStand {
  return stand.orte[String(stand.manufaktur)] ?? { renovierung: 0, geraeumt: [] };
}

/** Liegt vor dieser Etage (Index) noch Schutt? */
export function hatBaustelle(stand: ManufakturStand, etage: number): boolean {
  return etage in BAUSTELLEN && !ort(stand).geraeumt.includes(etage);
}

/** Die laufenden Bauarbeiten an diesem Ort, oder null. */
export function laufenderBau(stand: ManufakturStand): { etage: number; bis: number } | null {
  return ort(stand).bau ?? null;
}

export function bauDauer(stand: ManufakturStand, etage: number): number {
  return (BAUSTELLEN[etage] ?? 0) * bauFaktor(stand);
}

/** Was die Bauarbeiten kosten: ein Teil dessen, was die Etage danach kostet. */
export function bauKosten(etage: number, manufaktur: number): number {
  return freischaltKosten(etage, manufaktur) * W.BAU_KOSTEN;
}

/**
 * So viele Etagen vorher darf man mit dem Bau beginnen. Erst ab der Etage
 * davor zu bauen, liess den aktiven Spieler vor Etage 8 eine halbe Stunde
 * warten — der erste Umzug rutschte von 89 auf 119 min (Simulation). So
 * laeuft die Wartezeit, waehrend er auf die Etagen davor spart.
 */
export const BAU_VORLAUF = 2;

/** Die naechste Baustelle, an der man jetzt beginnen koennte — oder null. */
export function naechsteBaustelle(stand: ManufakturStand): number | null {
  const offen = Object.keys(BAUSTELLEN)
    .map(Number)
    .filter((e) => e >= stand.pressen.length && hatBaustelle(stand, e))
    .sort((a, b) => a - b)[0];
  return offen !== undefined && stand.pressen.length >= offen - BAU_VORLAUF ? offen : null;
}

/** Kann man an diesem Ort jetzt mit dem Bau beginnen? (Eine Baustelle in Reichweite, nichts laeuft.) */
export function kannBauen(stand: ManufakturStand): boolean {
  return naechsteBaustelle(stand) !== null && laufenderBau(stand) === null;
}

/**
 * Fertige Bauarbeiten abschliessen: Ist die Zeit um, ist der Schutt weg. Laeuft
 * bei jedem Nachrechnen mit — auch offline, denn es haengt nur an der Uhr.
 */
export function raeumeAuf(stand: ManufakturStand): void {
  const o = stand.orte[String(stand.manufaktur)];
  if (!o?.bau || stand.zeit < o.bau.bis) return;
  o.geraeumt = [...o.geraeumt, o.bau.etage];
  delete o.bau;
}
