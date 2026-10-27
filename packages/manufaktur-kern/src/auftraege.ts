/** Wiederholbare Druckauftraege: nur echte Versandverkaeufe zaehlen.
 * Keine Frist, kein Einsatz, kein Verlust bei Renovierung oder Umzug.
 * Angebot und Belohnung werden bei Annahme festgeschrieben. */
import { durchsatz } from './ansicht.js';
import type { ManufakturStand } from './stand.js';

export const AUFTRAGSARTEN = ['laden', 'gilde', 'hof'] as const;
export type Auftragsart = typeof AUFTRAGSARTEN[number];
export interface Druckauftrag {
  art: Auftragsart;
  ziel: number;
  geliefert: number;
  belohnung: number;
}
export interface Auftragsbuch {
  aktiv: Druckauftrag | null;
  erledigt: number;
}
export interface Auftragsangebot {
  art: Auftragsart;
  titel: string;
  text: string;
  umfang: string;
  ziel: number;
  belohnung: number;
  frei: boolean;
  voraussetzung: string;
}
const KUNDEN = {
  laden: { titel: 'Der Spieleladen', text: 'Frische Karten für die nächste Spielrunde.', umfang: 'Kleine Lieferung', faktor: 0.25, ort: 1 },
  gilde: { titel: 'Die Spielergilde', text: 'Ein großer Kartenvorrat für das nächste Turnier.', umfang: 'Großauftrag', faktor: 1, ort: 1 },
  hof: { titel: 'Der königliche Hof', text: 'Eine Festlieferung für die königlichen Spielsäle.', umfang: 'Königliche Lieferung', faktor: 4, ort: 2 },
} as const;
export const AUFTRAGSABZEICHEN = [
  { ab: 1, titel: 'Erste Lieferung', siegel: 0 },
  { ab: 3, titel: 'Zuverlässige Werkstatt', siegel: 1 },
  { ab: 10, titel: 'Liebling der Gilde', siegel: 2 },
  { ab: 25, titel: 'Hoflieferant', siegel: 3 },
  { ab: 50, titel: 'Goldene Druckerei', siegel: 4 },
] as const;

export function auftragsangebote(s: ManufakturStand): Auftragsangebot[] {
  // Zehn Minuten normale Produktion am Engpass, ohne aktive Meister-Boni.
  // So bleiben Lieferungen auch bei langsamem Ausbau in einer Sitzung erreichbar.
  const grund = Math.max(100, Math.min(...Object.values(durchsatz(s))) * 600);
  return AUFTRAGSARTEN.map((art) => {
    const k = KUNDEN[art];
    const ziel = Math.ceil(grund * k.faktor);
    return { art, titel: k.titel, text: k.text, umfang: k.umfang, ziel,
      belohnung: Math.ceil(ziel * 0.1), frei: s.pressen.length >= 3 && s.manufaktur >= k.ort,
      voraussetzung: k.ort === 2 ? 'Ab der Fabrik am Fluss und 3 Pressen' : 'Ab 3 Pressen' };
  });
}
export function auftragFertig(s: ManufakturStand): boolean {
  const a = s.auftraege.aktiv;
  return a !== null && a.geliefert >= a.ziel;
}
/** Im Versandtakt aufrufen, bevor die Ladung geleert wird. Ueberschuss verfaellt. */
export function liefereAuftrag(s: ManufakturStand, wert: number): void {
  const a = s.auftraege.aktiv;
  if (a) a.geliefert = Math.min(a.ziel, a.geliefert + wert);
}
export function auftragsSiegel(erledigt: number): number {
  return AUFTRAGSABZEICHEN.find((a) => a.ab === erledigt)?.siegel ?? 0;
}
