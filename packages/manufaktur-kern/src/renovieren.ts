/**
 * Renovieren (Phase 2, 24.10.2026): vier Stufen je Ort mit dauerhaftem
 * Multiplikator — das Prestige der Manufaktur, wie bei Idle Miner Tycoon.
 *
 * Renovieren setzt die Halle zurueck (Stufen, Etagen, Taler); es bleiben
 * Meister-Pools, Werkstattbuch, Siegel und die Renovierungsstufe. Umziehen
 * geht erst nach Stufe 1. Die Stufen gehoeren dem Ort (`stand.orte`), nicht
 * dem Spieler — es gibt kein Zurueck, aber die Daten muessten dafuer nicht
 * umgebaut werden.
 *
 * Nach dem Kartenpalast gibt es keinen Umzug mehr. Damit das Spiel dort
 * nicht endet, geht das Renovieren im Palast ueber Stufe 4 hinaus weiter:
 * das **Jubilaeum** mit flacherem Zuwachs (×1,5 je Stufe), den alten
 * Hub-Muenzen fuer die ersten zehn und dem Kartenruecken des Palasts.
 */

import { MAX_MANUFAKTUR, MAX_PRESSEN, STELLSCHRAUBEN, freischaltKosten } from './formeln.js';
import type { ManufakturStand } from './stand.js';
import { SIEGEL_RENOVIERUNG, kartenwertBonus } from './werkstattbuch.js';

const W = STELLSCHRAUBEN;

/** Hoechste Renovierung an einem gewoehnlichen Ort; im Palast geht es als Jubilaeum weiter. */
export const MAX_RENOVIERUNG = 4;

export function renovierung(stand: ManufakturStand, manufaktur = stand.manufaktur): number {
  return stand.orte[String(manufaktur)]?.renovierung ?? 0;
}

/** Ist die naechste Renovierung im Palast schon ein Jubilaeum (Stufe 5 und hoeher)? */
export function istJubilaeum(stand: ManufakturStand): boolean {
  return stand.manufaktur >= MAX_MANUFAKTUR && renovierung(stand) >= MAX_RENOVIERUNG;
}

/** Multiplikator einer Renovierungsstufe — Gesamtwert, nicht aufmultipliziert (Stufe 2 = ×10). */
export function renovierFaktor(stufe: number): number {
  if (stufe <= MAX_RENOVIERUNG) return W.RENOV_FAKTOR[stufe]!;
  return W.RENOV_FAKTOR[MAX_RENOVIERUNG]! * W.JUBILAEUM_WACHSTUM ** (stufe - MAX_RENOVIERUNG);
}

/** Der dauerhafte Faktor dieses Orts auf alles, was er leistet. */
export function ortFaktor(stand: ManufakturStand): number {
  return renovierFaktor(renovierung(stand));
}

/** Preis der naechsten Renovierung — fest je Ort und Stufe (an der achten Presse gemessen). */
export function renovierKosten(manufaktur: number, stufe: number): number {
  const grund = freischaltKosten(MAX_PRESSEN - 1, manufaktur);
  if (stufe < MAX_RENOVIERUNG) return grund * W.RENOV_KOSTEN[stufe]!;
  return grund * W.RENOV_KOSTEN[MAX_RENOVIERUNG - 1]! * W.JUBILAEUM_KOSTEN ** (stufe - MAX_RENOVIERUNG + 1);
}

/** Renovieren darf, wer alle acht Pressen gebaut hat — im Palast unbegrenzt, sonst bis Stufe 4. */
export function kannRenovieren(stand: ManufakturStand): boolean {
  if (stand.pressen.length < MAX_PRESSEN) return false;
  return stand.manufaktur >= MAX_MANUFAKTUR || renovierung(stand) < MAX_RENOVIERUNG;
}

/** Alles, was die Pressen dauerhaft mehr leisten: Renovierung mal Guter Ruf. */
export function presseBonus(stand: ManufakturStand): number {
  return ortFaktor(stand) * kartenwertBonus(stand);
}

export interface RenovierVorschau {
  /** Jetzige Stufe und die nach der Renovierung. */
  stufe: number;
  neueStufe: number;
  faktorVorher: number;
  faktorNachher: number;
  kosten: number;
  /** Siegel, die es dafuer gibt (0 beim Jubilaeum). */
  siegel: number;
  istJubilaeum: boolean;
  /** Bedingung erfuellt (acht Pressen, noch nicht ganz renoviert) — nicht, ob das Geld reicht. */
  moeglich: boolean;
  leistbar: boolean;
}

/** Was die naechste Renovierung bringt — fuer das Renovieren-Blatt. */
export function renovierVorschau(stand: ManufakturStand): RenovierVorschau {
  const stufe = renovierung(stand);
  const kosten = renovierKosten(stand.manufaktur, stufe);
  const moeglich = kannRenovieren(stand);
  return {
    stufe,
    neueStufe: stufe + 1,
    faktorVorher: renovierFaktor(stufe),
    faktorNachher: renovierFaktor(stufe + 1),
    kosten,
    siegel: stufe < MAX_RENOVIERUNG ? SIEGEL_RENOVIERUNG[stufe]! : 0,
    istJubilaeum: istJubilaeum(stand),
    moeglich,
    leistbar: moeglich && stand.taler + 1e-9 >= kosten,
  };
}
