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
