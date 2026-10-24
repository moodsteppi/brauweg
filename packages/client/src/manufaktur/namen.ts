import { type FaehigkeitArt, type Rang, type StationArt, RAENGE, wirkung } from '@brauweg/manufaktur-kern';

/** Je Presse eine Kartenart — tiefer heisst wertvoller (Spielentwurf). */
export const KARTENARTEN = ['Skatblatt', 'Doppelkopf', 'Zauberer', 'Poker', 'Schafkopf', 'Rommé', 'Tarock', 'Goldblatt'];

/** Die fuenf Standorte, in dieser Reihenfolge bezogen (Umzug). */
export const MANUFAKTUREN = ['Werkstatt im Dorf', 'Fabrik am Fluss', 'Bergdruckerei', 'Hafen-Druckhaus', 'Kartenpalast'];

export function manufakturName(nummer: number): string {
  return MANUFAKTUREN[nummer - 1] ?? `Manufaktur ${nummer}`;
}

/** Name einer Station fuer Blaetter und Vorlesegeraete. */
export function stationName(ziel: { art: 'presse'; index: number } | { art: 'paternoster' } | { art: 'versand' }): string {
  if (ziel.art === 'presse') return `Presse ${ziel.index + 1} · ${KARTENARTEN[ziel.index] ?? ''}`;
  return ziel.art === 'paternoster' ? 'Paternoster' : 'Versand';
}

/** Raenge, wie sie im Blatt stehen. */
export const RANG_NAME: Record<Rang, string> = { jung: 'Jungmeister', meister: 'Meister', ober: 'Obermeister' };

/**
 * Was die Faehigkeit tut, in einem Satz: „Tempo ×5 für 3 min". Die Zahlen
 * kommen aus dem Kern (WIRKUNG, RAENGE) — hier steht nur die Wortwahl.
 */
export function faehigkeitText(station: StationArt, rang: Rang, art: FaehigkeitArt): string {
  const w = wirkung(station, rang, art);
  const dauer = `${RAENGE[rang].wirkMs / 60_000} min`;
  if (art === 'rabatt') return `Ausbau −${Math.round(w * 100)} % für ${dauer}`;
  const was = art === 'tempo' ? (station === 'paternoster' ? 'Bandtempo' : station === 'versand' ? 'Lauftempo' : 'Tempo') : station === 'versand' ? 'Wagenladung' : 'Ladung';
  return `${was} ×${w} für ${dauer}`;
}
