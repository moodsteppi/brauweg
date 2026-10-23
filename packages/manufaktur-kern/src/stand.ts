/**
 * Der gespeicherte Stand einer Manufaktur — eine Zeile je Konto auf dem
 * Server, dieselbe Form im Client. Alles, was man sieht, folgt aus diesem
 * Stand; nichts daneben ist gespeichert.
 *
 * `fassung` zaehlt die Form. Aeltere Staende werden in `migriere` umgebaut,
 * nie verworfen.
 */

import { MAX_PRESSEN } from './formeln.js';

export const FASSUNG = 2;

/** Ein Arbeitszyklus: laeuft er, und wie weit ist er (0 … 1)? */
export interface Zyklus {
  laeuft: boolean;
  fortschritt: number;
}

export interface Station extends Zyklus {
  stufe: number;
  meister: boolean;
  /** Meister-Faehigkeit wirkt bis hier (ms), danach Pause bis `abklingenBis`. */
  faehigkeitBis: number;
  abklingenBis: number;
}

export interface Presse extends Station {
  /** Warenwert in der Ablage-Kiste am Schacht. */
  kiste: number;
}

export interface Paternoster extends Station {
  /** Warenwert auf den Tabletts. */
  ladung: number;
  /** Bis zu dieser Etage faehrt die laufende Fahrt (beim Start festgelegt). */
  etagen: number;
  /** So viele Etagen hat die laufende Fahrt schon beladen. */
  geholt: number;
}

export interface Versand extends Station {
  /** Warenwert im Wagen. */
  ladung: number;
  verkauft: boolean;
}

export interface ManufakturStand {
  fassung: typeof FASSUNG;
  /** Welche Manufaktur (1 … 5) — steigt beim Umzug. */
  manufaktur: number;
  taler: number;
  /** Verdienst in DIESER Manufaktur — fuer Meilensteine. */
  verdient: number;
  pressen: Presse[];
  paternoster: Paternoster;
  versand: Versand;
  /** Warenwert auf dem Packtisch in der Versandhalle. */
  packtisch: number;
  /** Erreichte Meilensteine, etwa `million-2`. Bleiben ueber den Umzug. */
  meilensteine: string[];
  /** Bis hierhin (ms) ist gerechnet — immer ein ganzer Takt. */
  zeit: number;
}

function station(): Station {
  return { stufe: 1, meister: false, faehigkeitBis: 0, abklingenBis: 0, laeuft: false, fortschritt: 0 };
}

export function neuePresse(): Presse {
  return { ...station(), kiste: 0 };
}

export function neuerStand(jetzt: number, manufaktur = 1, meilensteine: string[] = []): ManufakturStand {
  return {
    fassung: FASSUNG,
    manufaktur,
    taler: 0,
    verdient: 0,
    pressen: [neuePresse()],
    paternoster: { ...station(), ladung: 0, etagen: 1, geholt: 0 },
    versand: { ...station(), ladung: 0, verkauft: false },
    packtisch: 0,
    meilensteine,
    zeit: jetzt,
  };
}

export function kopiere(stand: ManufakturStand): ManufakturStand {
  return {
    ...stand,
    pressen: stand.pressen.map((p) => ({ ...p })),
    paternoster: { ...stand.paternoster },
    versand: { ...stand.versand },
    meilensteine: [...stand.meilensteine],
  };
}

/** Fassung 1 (23.10.2026): Raten statt Zyklen, Laufband statt Paternoster. */
interface StandFassung1 {
  manufaktur: number;
  taler: number;
  verdient: number;
  pressen: { stufe: number; meister: boolean; ablage: number }[];
  laufband: { stufe: number; meister: boolean };
  versand: { stufe: number; meister: boolean };
  lager: number;
  meilensteine: string[];
  zeit: number;
}

/**
 * Bringt einen gespeicherten Stand auf die jetzige Fassung. Stufen, Meister,
 * Taler, Bestaende und Meilensteine bleiben; laufende Schichten der alten
 * Fassung enden (es gab sie nur zehn Sekunden lang).
 */
export function migriere(roh: unknown): ManufakturStand {
  const alt = roh as Partial<ManufakturStand> & Partial<StandFassung1>;
  if (alt.fassung === FASSUNG) return alt as ManufakturStand;
  const v1 = alt as StandFassung1;
  const neu = neuerStand(v1.zeit, v1.manufaktur ?? 1, v1.meilensteine ?? []);
  neu.taler = v1.taler ?? 0;
  neu.verdient = v1.verdient ?? 0;
  neu.pressen = (v1.pressen ?? []).slice(0, MAX_PRESSEN).map((p) => ({
    ...neuePresse(),
    stufe: Math.max(1, p.stufe),
    meister: p.meister,
    kiste: p.ablage ?? 0,
  }));
  if (neu.pressen.length === 0) neu.pressen = [neuePresse()];
  neu.paternoster = { ...neu.paternoster, stufe: Math.max(1, v1.laufband?.stufe ?? 1), meister: !!v1.laufband?.meister };
  neu.versand = { ...neu.versand, stufe: Math.max(1, v1.versand?.stufe ?? 1), meister: !!v1.versand?.meister };
  neu.packtisch = v1.lager ?? 0;
  return neu;
}
