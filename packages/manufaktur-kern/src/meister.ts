/**
 * Meister mit Tiefe (Phase 1, 24.10.2026): Raenge, Faehigkeiten je Station,
 * Pools, Einstellen mit Zufall, Tauschen und Verkaufen.
 *
 * Vorbild ist Idle Miner Tycoon: Ein Meister automatisiert seine Station und
 * hat eine Faehigkeit, die man von Hand ausloest. Der Kniff, der sich gut
 * anfuehlen soll: Rabatt-Meister zuweisen, Faehigkeit ausloesen, viel
 * kaufen, zuruecktauschen. Deshalb gehoeren die Uhren dem Meister, nicht der
 * Station — ein frisch zugewiesener Meister ist sofort bereit, auch wenn
 * sein Vorgaenger gerade pausiert.
 *
 * Der Zufall beim Einstellen haengt am Stand (`zufall`), nicht an einer Uhr:
 * Wer neu laedt, zieht denselben Meister. Den Anfangswert setzt der Server.
 */

import { type Ziel, meisterKosten } from './formeln.js';
import type { FaehigkeitArt, ManufakturStand, MeisterKarte, MeisterPlatz, Rang, Station } from './stand.js';

export type StationArt = Ziel['art'];

/** Dauer der Faehigkeit und Pause danach, je Rang. */
export const RAENGE: Record<Rang, { wirkMs: number; abklingMs: number }> = {
  jung: { wirkMs: 60_000, abklingMs: 5 * 60_000 },
  meister: { wirkMs: 3 * 60_000, abklingMs: 15 * 60_000 },
  ober: { wirkMs: 10 * 60_000, abklingMs: 50 * 60_000 },
};

const RANG_INDEX: Record<Rang, number> = { jung: 0, meister: 1, ober: 2 };

/**
 * Staerke je Station, Faehigkeit und Rang (Jung / Meister / Ober). Tempo und
 * Ladung sind Faktoren, Rabatt ist der Anteil, der vom Preis abgeht.
 */
export const WIRKUNG: Record<StationArt, Partial<Record<FaehigkeitArt, readonly [number, number, number]>>> = {
  presse: { tempo: [3, 5, 7], rabatt: [0.4, 0.7, 0.8] },
  paternoster: { tempo: [2, 4, 6], ladung: [3, 5, 7], rabatt: [0.4, 0.7, 0.8] },
  versand: { tempo: [3, 5, 7], ladung: [3, 5, 8], rabatt: [0.4, 0.7, 0.8] },
};

/** Welche Faehigkeiten es an einer Station gibt — die Presse hat keine Ladung. */
export function artenVon(station: StationArt): FaehigkeitArt[] {
  return Object.keys(WIRKUNG[station]) as FaehigkeitArt[];
}

/** Die ersten drei Einstellungen je Station sind fest — danach Zufall. */
export function festeEinstellung(station: StationArt, nummer: number): { rang: Rang; art: FaehigkeitArt } | null {
  if (nummer === 0) return { rang: 'jung', art: 'tempo' };
  if (nummer === 1) return { rang: 'jung', art: 'rabatt' };
  if (nummer === 2) return { rang: 'meister', art: station === 'presse' ? 'tempo' : 'ladung' };
  return null;
}

/** Wahrscheinlichkeiten beim zufaelligen Einstellen. */
export const RANG_CHANCE: Record<Rang, number> = { jung: 0.7, meister: 0.25, ober: 0.05 };
/** Jede weitere Einstellung an derselben Station kostet so viel mehr. */
export const EINSTELLEN_STEIGUNG = 1.6;
export const POOL_GROESSE = 5;
/** Verkaufen gibt so viel vom Einstellpreis zurueck. */
export const VERKAUF_ANTEIL = 0.5;

export function slotVon(ziel: Ziel): string {
  return ziel.art === 'presse' ? `presse-${ziel.index}` : ziel.art;
}

export function platzVon(stand: ManufakturStand, ziel: Ziel): MeisterPlatz {
  return stand.belegschaft[slotVon(ziel)] ?? { pool: [], zugewiesen: null, eingestellt: 0 };
}

/** Wirkung des zugewiesenen Meisters, solange seine Faehigkeit laeuft — sonst neutral. */
function aktiv(s: Station, t: number, art: FaehigkeitArt): Rang | null {
  return s.meister && s.art === art && s.rang && t < s.faehigkeitBis ? s.rang : null;
}

export function wirkung(station: StationArt, rang: Rang, art: FaehigkeitArt): number {
  return WIRKUNG[station][art]?.[RANG_INDEX[rang]] ?? (art === 'rabatt' ? 0 : 1);
}

/** Tempo der Station zum Zeitpunkt `t`. */
export function tempoFaktor(station: StationArt, s: Station, t: number): number {
  const rang = aktiv(s, t, 'tempo');
  return rang ? wirkung(station, rang, 'tempo') : 1;
}

/** Faktor auf die Ladung (Paternoster, Wagen). */
export function ladungFaktor(station: StationArt, s: Station, t: number): number {
  const rang = aktiv(s, t, 'ladung');
  return rang ? wirkung(station, rang, 'ladung') : 1;
}

/** Anteil, der beim Ausbau dieser Station gerade vom Preis abgeht (0 … 1). */
export function rabatt(station: StationArt, s: Station, t: number): number {
  const rang = aktiv(s, t, 'rabatt');
  return rang ? wirkung(station, rang, 'rabatt') : 0;
}

/** Preis der naechsten Einstellung an dieser Station. */
export function einstellPreis(stand: ManufakturStand, ziel: Ziel): number {
  return meisterKosten(ziel, stand.manufaktur) * EINSTELLEN_STEIGUNG ** platzVon(stand, ziel).eingestellt;
}

/** mulberry32: klein, schnell, auf jeder Plattform gleich. Gibt Zahl (0 … 1) und neuen Zustand. */
export function zieheZahl(zustand: number): [number, number] {
  const neu = (zustand + 0x6d2b79f5) >>> 0;
  let x = neu;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return [((x ^ (x >>> 14)) >>> 0) / 4294967296, neu];
}

/** Rang und Faehigkeit der naechsten Einstellung — veraendert `stand.zufall`, wenn gezogen wird. */
export function ziehe(stand: ManufakturStand, ziel: Ziel, chance: Record<Rang, number> = RANG_CHANCE): { rang: Rang; art: FaehigkeitArt } {
  const fest = festeEinstellung(ziel.art, platzVon(stand, ziel).eingestellt);
  if (fest) return fest;
  const [a, z1] = zieheZahl(stand.zufall);
  const [b, z2] = zieheZahl(z1);
  stand.zufall = z2;
  const rang: Rang = a < chance.ober ? 'ober' : a < chance.ober + chance.meister ? 'meister' : 'jung';
  const arten = artenVon(ziel.art);
  return { rang, art: arten[Math.min(arten.length - 1, Math.floor(b * arten.length))]! };
}

/**
 * Weist `id` zu (null: niemand). Der bisher Zugewiesene nimmt seine Uhren
 * mit — eine laufende Faehigkeit endet beim Tauschen, die Pause laeuft
 * weiter. Danach spiegelt die Station den neuen Meister.
 */
export function weiseZu(stand: ManufakturStand, ziel: Ziel, id: number | null, s: Station | undefined, t: number): void {
  const slot = slotVon(ziel);
  const platz = stand.belegschaft[slot];
  if (!platz) return;
  const alt = platz.pool.find((m) => m.id === platz.zugewiesen);
  if (alt && s) {
    alt.faehigkeitBis = Math.min(s.faehigkeitBis, t);
    alt.abklingenBis = s.abklingenBis;
  }
  platz.zugewiesen = id;
  if (s) spiegele(s, platz.pool.find((m) => m.id === id) ?? null);
}

/** Die Station zeigt den Meister `m` (oder keinen). */
function spiegele(s: Station, m: MeisterKarte | null): void {
  s.meister = !!m;
  s.rang = m?.rang ?? null;
  s.art = m?.art ?? null;
  s.faehigkeitBis = m?.faehigkeitBis ?? 0;
  s.abklingenBis = m?.abklingenBis ?? 0;
}

/**
 * Nach Umzug, Renovieren oder einer neuen Etage: Jede Station zeigt wieder
 * ihren zugewiesenen Meister. Die Uhren kommen vom Meister selbst.
 */
export function besetze(stand: ManufakturStand): void {
  const stationen: [string, Station][] = [
    ...stand.pressen.map((p, i): [string, Station] => [`presse-${i}`, p]),
    ['paternoster', stand.paternoster],
    ['versand', stand.versand],
  ];
  for (const [slot, s] of stationen) {
    const platz = stand.belegschaft[slot];
    spiegele(s, platz?.pool.find((m) => m.id === platz.zugewiesen) ?? null);
  }
}

/**
 * Vor einem Umzug oder Renovieren: Was an den Stationen laeuft, zurueck in
 * die Meister schreiben, sonst gingen ihre Uhren mit der alten Halle verloren.
 */
export function sichereUhren(stand: ManufakturStand): void {
  const stationen: [string, Station][] = [
    ...stand.pressen.map((p, i): [string, Station] => [`presse-${i}`, p]),
    ['paternoster', stand.paternoster],
    ['versand', stand.versand],
  ];
  for (const [slot, s] of stationen) {
    const platz = stand.belegschaft[slot];
    const m = platz?.pool.find((k) => k.id === platz.zugewiesen);
    if (m) {
      m.faehigkeitBis = s.faehigkeitBis;
      m.abklingenBis = s.abklingenBis;
    }
  }
}

/** Wie viele zugewiesene Meister ihre Faehigkeit gerade ausloesen koennten. */
export function bereiteMeister(stand: ManufakturStand, t: number): number {
  return [...stand.pressen, stand.paternoster, stand.versand].filter((s) => s.meister && t >= s.abklingenBis).length;
}

/** Wann (ms) der naechste zugewiesene Meister wieder bereit ist; null, wenn keiner pausiert. */
export function naechsteBereitschaft(stand: ManufakturStand, t: number): number | null {
  const pausen = [...stand.pressen, stand.paternoster, stand.versand]
    .filter((s) => s.meister && t < s.abklingenBis)
    .map((s) => s.abklingenBis);
  return pausen.length > 0 ? Math.min(...pausen) : null;
}
