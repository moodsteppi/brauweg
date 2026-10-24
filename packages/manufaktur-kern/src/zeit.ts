/**
 * Der Ablauf der Zeit — in festen Takten von TAKT_MS, damit Server und
 * Client aus demselben Stand genau dasselbe rechnen, egal wie oft der
 * Bildschirm fragt. Eine Uhr gibt es hier nicht: `bis` kommt als Zahl.
 *
 * Reihenfolge in jedem Takt: Pressen, dann Paternoster, dann Versand. So
 * holt der Paternoster, was im selben Takt abgelegt wurde — und die Kette
 * ist bei gleicher Eingabe immer gleich.
 */

import {
  ABWESEND_AB_MS,
  OFFLINE_TEMPO,
  TAKT_MS,
  VERSAND_ABFAHRT,
  VERSAND_VERKAUF,
  paternosterFahrt,
  paternosterHalt,
  paternosterKapazitaet,
  presseErtrag,
  presseZyklus,
  versandKapazitaet,
  versandZyklus,
} from './formeln.js';
import { ladungFaktor, tempoFaktor } from './meister.js';
import { kartenwertBonus, offlineMs } from './werkstattbuch.js';
import { type ManufakturStand, kopiere } from './stand.js';

/** Liegt in irgendeiner Kiste etwas fuer den Paternoster? */
export function kistenVoll(stand: ManufakturStand): boolean {
  return stand.pressen.some((p) => p.kiste > 0);
}

/** Kann die Station jetzt einen Zyklus beginnen (ohne auf Meister oder Tipp zu schauen)? */
export function kannStarten(stand: ManufakturStand, art: 'presse' | 'paternoster' | 'versand'): boolean {
  if (art === 'presse') return true;
  if (art === 'paternoster') return kistenVoll(stand);
  return stand.packtisch > 0;
}

/** Beginnt einen Zyklus. Der Aufrufer hat `kannStarten` geprueft. */
export function starte(stand: ManufakturStand, ziel: { art: 'presse'; index: number } | { art: 'paternoster' } | { art: 'versand' }): void {
  if (ziel.art === 'presse') {
    const p = stand.pressen[ziel.index]!;
    p.laeuft = true;
    p.fortschritt = 0;
    return;
  }
  if (ziel.art === 'paternoster') {
    const f = stand.paternoster;
    f.laeuft = true;
    f.fortschritt = 0;
    f.etagen = stand.pressen.length;
    f.geholt = 0;
    f.ladung = 0;
    return;
  }
  // Der Traeger nimmt beim Start vom Packtisch, was in den Wagen passt.
  const v = stand.versand;
  // Ladungs-Meister: Der Wagen nimmt mehr, wenn die Faehigkeit beim Beladen wirkt.
  const kapazitaet = versandKapazitaet(v.stufe, stand.manufaktur) * ladungFaktor('versand', v, stand.zeit);
  const ladung = Math.min(kapazitaet, stand.packtisch);
  stand.packtisch -= ladung;
  v.ladung = ladung;
  v.laeuft = true;
  v.fortschritt = 0;
  v.verkauft = false;
}

/** Ein Takt. Veraendert `stand` an Ort und Stelle. */
function takt(stand: ManufakturStand): void {
  const t = stand.zeit;

  stand.pressen.forEach((p, index) => {
    if (!p.laeuft && p.meister) starte(stand, { art: 'presse', index });
    if (!p.laeuft) return;
    p.fortschritt += (TAKT_MS * tempoFaktor('presse', p, t)) / presseZyklus(p.stufe);
    if (p.fortschritt >= 1) {
      p.kiste += presseErtrag(index, p.stufe, stand.manufaktur, kartenwertBonus(stand));
      p.laeuft = false;
      p.fortschritt = 0;
    }
  });

  const f = stand.paternoster;
  if (!f.laeuft && f.meister && kistenVoll(stand)) starte(stand, { art: 'paternoster' });
  if (f.laeuft) {
    f.fortschritt += (TAKT_MS * tempoFaktor('paternoster', f, t)) / paternosterFahrt(f.etagen, f.stufe);
    const kapazitaet = paternosterKapazitaet(f.stufe, stand.manufaktur) * ladungFaktor('paternoster', f, t);
    while (f.geholt < f.etagen && f.fortschritt >= paternosterHalt(f.geholt + 1, f.etagen).ab) {
      const presse = stand.pressen[f.geholt];
      if (presse) {
        const nimm = Math.min(presse.kiste, Math.max(0, kapazitaet - f.ladung));
        presse.kiste -= nimm;
        f.ladung += nimm;
      }
      f.geholt += 1;
    }
    if (f.fortschritt >= 1) {
      stand.packtisch += f.ladung;
      f.ladung = 0;
      f.laeuft = false;
      f.fortschritt = 0;
    }
  }

  const v = stand.versand;
  if (!v.laeuft && v.meister && stand.packtisch > 0) starte(stand, { art: 'versand' });
  if (v.laeuft) {
    v.fortschritt += (TAKT_MS * tempoFaktor('versand', v, t)) / versandZyklus(v.stufe);
    if (!v.verkauft && v.fortschritt >= VERSAND_VERKAUF) {
      stand.taler += v.ladung;
      stand.verdient += v.ladung;
      v.ladung = 0;
      v.verkauft = true;
    }
    if (v.fortschritt >= 1) {
      v.laeuft = false;
      v.fortschritt = 0;
    }
  }

  stand.zeit = t + TAKT_MS;
}

/** Arbeitet noch irgendwer, oder wird jemand von selbst anfangen? */
function ruhig(stand: ManufakturStand): boolean {
  if (stand.pressen.some((p) => p.laeuft || p.meister)) return false;
  const f = stand.paternoster;
  if (f.laeuft || (f.meister && kistenVoll(stand))) return false;
  const v = stand.versand;
  return !(v.laeuft || (v.meister && stand.packtisch > 0));
}

/**
 * Laesst die Zeit bis `bis` laufen, in ganzen Takten — was vom letzten Takt
 * uebrig bleibt, rechnet der naechste Aufruf. Liegt der Stand laenger als
 * ABWESEND_AB_MS zurueck, war niemand da: Dann laeuft hoechstens OFFLINE_MS,
 * und das nur zum halben Tempo (OFFLINE_TEMPO) — die Uhr springt trotzdem
 * nach vorn. Kurze Luecken (der Bildschirm fragt alle 30 s) rechnen voll.
 * Ohne Meister schlafen die Pinguine nach ihrem Zyklus ein — deshalb zaehlt
 * offline ganz von selbst nur, was die Meister schaffen.
 */
export function vorspulen(alt: ManufakturStand, bis: number): ManufakturStand {
  const takte = Math.floor((bis - alt.zeit) / TAKT_MS);
  if (takte <= 0) return alt;
  const stand = kopiere(alt);
  const ende = alt.zeit + takte * TAKT_MS;
  const luecke = takte * TAKT_MS;
  const rechnen =
    luecke > ABWESEND_AB_MS ? Math.floor((Math.min(luecke, offlineMs(alt)) * OFFLINE_TEMPO) / TAKT_MS) : takte;
  for (let i = 0; i < rechnen; i += 1) {
    if (ruhig(stand)) break;
    takt(stand);
  }
  stand.zeit = ende;
  return stand;
}

