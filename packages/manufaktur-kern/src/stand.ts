/**
 * Der gespeicherte Stand einer Manufaktur — eine Zeile je Konto auf dem
 * Server, dieselbe Form im Client. Alles, was man sieht, folgt aus diesem
 * Stand; nichts daneben ist gespeichert.
 *
 * `fassung` zaehlt die Form. Aeltere Staende werden in `migriere` umgebaut,
 * nie verworfen.
 */

import { MAX_PRESSEN, meisterKosten } from './formeln.js';

export const FASSUNG = 6;

/** Ein Arbeitszyklus: laeuft er, und wie weit ist er (0 … 1)? */
export interface Zyklus {
  laeuft: boolean;
  fortschritt: number;
}

/** Rang eines Meisters (Phase 1, 24.10.2026): bestimmt Dauer, Pause und Staerke. */
export type Rang = 'jung' | 'meister' | 'ober';
/** Was die Faehigkeit tut: schneller, mehr Ladung, billigere Ausbauten. */
export type FaehigkeitArt = 'tempo' | 'ladung' | 'rabatt';

/** Ein eingestellter Meister im Pool einer Station. Die Uhren gehoeren ihm, nicht der Station. */
export interface MeisterKarte {
  id: number;
  rang: Rang;
  art: FaehigkeitArt;
  /** Was er beim Einstellen gekostet hat — Verkaufen gibt die Haelfte zurueck. */
  preis: number;
  faehigkeitBis: number;
  abklingenBis: number;
}

/** Pool einer Station: eingestellte Meister, genau einer davon (oder keiner) zugewiesen. */
export interface MeisterPlatz {
  pool: MeisterKarte[];
  zugewiesen: number | null;
  /** Wie oft hier schon eingestellt wurde — davon haengt der Preis ab, Verkaufen zaehlt nicht zurueck. */
  eingestellt: number;
}

export interface Station extends Zyklus {
  stufe: number;
  /**
   * Spiegel des zugewiesenen Meisters (meister.ts, `weiseZu`): ob einer da
   * ist, sein Rang, seine Faehigkeit und ihre Uhren. Gespiegelt, weil Takt
   * und Bildschirm sie in jedem Bild brauchen; geschrieben werden sie nur
   * beim Zuweisen und Ausloesen, nie von Hand.
   */
  meister: boolean;
  rang: Rang | null;
  art: FaehigkeitArt | null;
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

export interface OrtStand {
  /** 0 … 4; im Palast darueber hinaus (Jubilaeum). */
  renovierung: number;
  /** Etagen (Index), deren Baustelle an diesem Ort schon geraeumt ist (Phase 4). */
  geraeumt: number[];
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
  /**
   * Je Ort (Schluessel: Nummer der Manufaktur) die Renovierungsstufe und die
   * schon geraeumten Baustellen. Bleibt fuer immer (renovieren.ts).
   */
  orte: Record<string, OrtStand>;
  /** Erreichte Meilensteine, etwa `million-2`. Bleiben ueber den Umzug. */
  meilensteine: string[];
  /**
   * Meister-Pools je Station (`presse-0` … `presse-7`, `paternoster`,
   * `versand`). Bleiben ueber Umzug und Renovieren — wer einmal einen
   * Obermeister hat, verliert ihn nicht.
   */
  belegschaft: Record<string, MeisterPlatz>;
  /** Zustand des Zufalls fuer das Einstellen; der Server setzt den Anfang, der Kern zieht weiter. */
  zufall: number;
  naechsteMeisterId: number;
  /** Siegel fuers Werkstattbuch (Renovieren, Umzug). Eigene Waehrung, nie Hub-Muenzen. */
  siegel: number;
  /** Stufe je Eintrag des Werkstattbuchs (werkstattbuch.ts). Wird nie zurueckgesetzt. */
  werkstattbuch: Record<string, number>;
  /** Bis hierhin (ms) ist gerechnet — immer ein ganzer Takt. */
  zeit: number;
}

function station(): Station {
  return { stufe: 1, meister: false, rang: null, art: null, faehigkeitBis: 0, abklingenBis: 0, laeuft: false, fortschritt: 0 };
}

export function neuePresse(): Presse {
  return { ...station(), kiste: 0 };
}

/** Was ueber Umzug und Renovieren erhalten bleibt (alles ausser der Halle selbst). */
export interface Bleibt {
  meilensteine?: string[];
  orte?: Record<string, OrtStand>;
  belegschaft?: Record<string, MeisterPlatz>;
  zufall?: number;
  naechsteMeisterId?: number;
  siegel?: number;
  werkstattbuch?: Record<string, number>;
}

/**
 * Ein frischer Stand. Zugewiesene Meister aus `bleibt.belegschaft` stehen
 * danach noch NICHT an den Stationen — das erledigt `besetze` (meister.ts),
 * damit die Spiegel-Regel an einer Stelle bleibt.
 */
export function neuerStand(jetzt: number, manufaktur = 1, bleibt: Bleibt = {}): ManufakturStand {
  return {
    fassung: FASSUNG,
    manufaktur,
    taler: 0,
    verdient: 0,
    pressen: [neuePresse()],
    paternoster: { ...station(), ladung: 0, etagen: 1, geholt: 0 },
    versand: { ...station(), ladung: 0, verkauft: false },
    packtisch: 0,
    meilensteine: [...(bleibt.meilensteine ?? [])],
    orte: kopiereOrte(bleibt.orte ?? {}),
    belegschaft: kopiereBelegschaft(bleibt.belegschaft ?? {}),
    zufall: bleibt.zufall ?? 1,
    naechsteMeisterId: bleibt.naechsteMeisterId ?? 1,
    siegel: bleibt.siegel ?? 0,
    werkstattbuch: { ...(bleibt.werkstattbuch ?? {}) },
    zeit: jetzt,
  };
}

function kopiereOrte(o: Record<string, OrtStand>): Record<string, OrtStand> {
  const neu: Record<string, OrtStand> = {};
  for (const [k, v] of Object.entries(o)) neu[k] = { renovierung: v.renovierung, geraeumt: [...v.geraeumt] };
  return neu;
}

function kopiereBelegschaft(b: Record<string, MeisterPlatz>): Record<string, MeisterPlatz> {
  const neu: Record<string, MeisterPlatz> = {};
  for (const [slot, platz] of Object.entries(b)) neu[slot] = { ...platz, pool: platz.pool.map((m) => ({ ...m })) };
  return neu;
}

export function kopiere(stand: ManufakturStand): ManufakturStand {
  return {
    ...stand,
    pressen: stand.pressen.map((p) => ({ ...p })),
    paternoster: { ...stand.paternoster },
    versand: { ...stand.versand },
    meilensteine: [...stand.meilensteine],
    belegschaft: kopiereBelegschaft(stand.belegschaft),
    werkstattbuch: { ...stand.werkstattbuch },
    orte: kopiereOrte(stand.orte),
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

/** Fassung 3 (bis 24.10.2026): Meister nur als Ja/Nein an der Station, ohne Pool. */
type StandFassung3 = Omit<ManufakturStand, 'fassung' | 'belegschaft' | 'zufall' | 'naechsteMeisterId' | 'siegel' | 'werkstattbuch' | 'orte'> & {
  fassung: 3;
  jubilaeen: number;
};
/** Fassung 5 (bis 24.10.2026): mit Buch, aber Jubilaeen statt Renovierung. */
type StandFassung5 = Omit<ManufakturStand, 'fassung' | 'orte'> & { fassung: 5; jubilaeen: number };

/**
 * Ein Anfangswert fuer den Zufall aus der Uhrzeit. Nur fuer umgebaute
 * Staende: Neue bekommen ihren Anfang vom Server (crypto). Wichtig ist
 * allein, dass er im Stand steht — wer neu laedt, zieht dasselbe.
 */
export function zufallAus(zahl: number): number {
  let h = Math.floor(zahl) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

/**
 * Fassung 3 → 4: Jeder vorhandene Meister wird ein Jungmeister mit Tempo,
 * zugewiesen und als erste Einstellung seiner Station gezaehlt (so kommt als
 * naechste der feste Rabatt-Jungmeister). Laufende Faehigkeiten enden — die
 * alte dauerte 30 s.
 */
function ausFassung3(alt: StandFassung3): StandFassung5 {
  const stand: StandFassung5 = {
    ...(alt as unknown as StandFassung5),
    fassung: 5,
    belegschaft: {},
    zufall: zufallAus(alt.zeit),
    naechsteMeisterId: 1,
    siegel: 0,
    werkstattbuch: {},
  };
  const stationen: [string, Station][] = [
    ...alt.pressen.map((p, i): [string, Station] => [`presse-${i}`, p]),
    ['paternoster', alt.paternoster],
    ['versand', alt.versand],
  ];
  const ziele: Record<string, Parameters<typeof meisterKosten>[0]> = { paternoster: { art: 'paternoster' }, versand: { art: 'versand' } };
  for (const [slot, s] of stationen) {
    s.rang = null;
    s.art = null;
    s.faehigkeitBis = 0;
    s.abklingenBis = 0;
    if (!s.meister) continue;
    const id = stand.naechsteMeisterId;
    stand.naechsteMeisterId += 1;
    const ziel = ziele[slot] ?? { art: 'presse' as const, index: Number(slot.slice(7)) };
    stand.belegschaft[slot] = {
      pool: [{ id, rang: 'jung', art: 'tempo', preis: meisterKosten(ziel, alt.manufaktur), faehigkeitBis: 0, abklingenBis: 0 }],
      zugewiesen: id,
      eingestellt: 1,
    };
    s.rang = 'jung';
    s.art = 'tempo';
  }
  return stand;
}

/**
 * Fassung 5 → 6: Das Jubilaeum wird zur Renovierung des Palasts. Jedes
 * gefeierte Jubilaeum zaehlt als eine Renovierungsstufe dort (hoechstens
 * vier, mehr waren nie moeglich). Die +10 % Kartenwert je Gildensiegel gibt
 * es nicht mehr — dafuer gilt der Multiplikator der Stufe.
 */
function ausFassung5(alt: StandFassung5): ManufakturStand {
  const { jubilaeen, ...rest } = alt;
  const orte: Record<string, OrtStand> = {};
  if (jubilaeen > 0) orte['5'] = { renovierung: Math.min(4, jubilaeen), geraeumt: [] };
  return { ...(rest as unknown as ManufakturStand), fassung: FASSUNG, orte };
}

/**
 * Bringt einen gespeicherten Stand auf die jetzige Fassung — Schritt fuer
 * Schritt, jede Fassung nur aus der vorigen. Stufen, Meister, Taler,
 * Bestaende und Meilensteine bleiben; nichts wird verworfen.
 */
export function migriere(roh: unknown): ManufakturStand {
  const alt = roh as { fassung?: number } & Partial<StandFassung1>;
  if (alt.fassung === FASSUNG) return alt as unknown as ManufakturStand;
  let f3: StandFassung3 | null = null;
  // Fassung 2 (Zyklen, ohne Jubilaeum): alles bleibt, es gab nur noch keine Siegel.
  if (alt.fassung === 2) f3 = { ...(alt as unknown as StandFassung3), fassung: 3, jubilaeen: 0 };
  if (alt.fassung === 3) f3 = alt as unknown as StandFassung3;
  if (alt.fassung === undefined || alt.fassung === 1) f3 = ausFassung1(alt as StandFassung1);
  let f5: StandFassung5;
  if (f3) f5 = ausFassung3(f3);
  // Fassung 4 (Meister mit Pools, ohne Werkstattbuch): alles bleibt, Buch leer.
  else if (alt.fassung === 4) f5 = { ...(alt as unknown as StandFassung5), fassung: 5, siegel: 0, werkstattbuch: {} };
  else f5 = alt as unknown as StandFassung5;
  return ausFassung5(f5);
}

/** Fassung 1 (Raten statt Zyklen) → 3. */
function ausFassung1(v1: StandFassung1): StandFassung3 {
  const neu = neuerStand(v1.zeit, v1.manufaktur ?? 1, { meilensteine: v1.meilensteine ?? [] }) as unknown as StandFassung3;
  neu.jubilaeen = 0;
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
  return { ...neu, fassung: 3 };
}
