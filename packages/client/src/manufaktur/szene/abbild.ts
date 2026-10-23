/**
 * Vom Stand zum Bild: wo jede Figur steht, was sie tut, wie voll eine Kiste
 * aussieht. Reine Funktionen, damit gilt und geprueft ist: **Die Bilder luegen
 * nie.** Der Pinguin legt den Stapel genau dann ab, wenn der Warenwert in der
 * Kiste landet; die Tabletts tragen nur Karten, wenn wirklich etwas faehrt;
 * der Wagen faehrt erst beladen los. Das Tempo kommt aus der Zykluszeit der
 * Station — ein Upgrade macht sie sichtbar schneller.
 *
 * `rest` ist die Zeit seit dem letzten Takt (0 … 50 ms): Der Kern rechnet in
 * Takten, das Bild soll trotzdem fliessen.
 */

import {
  type ManufakturStand,
  PRESSE_PHASEN,
  type Presse,
  type Station,
  VERSAND_ABFAHRT,
  VERSAND_VERKAUF,
  paternosterEntladen,
  paternosterFahrt,
  paternosterHalt,
  paternosterWende,
  presseErtrag,
  presseZyklus,
  tempo,
  versandZyklus,
} from '@brauweg/manufaktur-kern';

/** Wie weit der laufende Zyklus im Bild ist — mit dem Rest seit dem letzten Takt. */
export function fortschrittImBild(s: Station, dauerMs: number, jetzt: number, rest: number): number {
  if (!s.laeuft) return 0;
  return Math.min(0.9999, s.fortschritt + (rest * tempo(s, jetzt)) / dauerMs);
}

export type PressenPhase = 'schlafen' | 'wartet' | 'hin' | 'arbeiten' | 'zurueck' | 'ablegen';

/** Was der Arbeiter an einer Presse gerade tut, und wie weit (0 … 1) er darin ist. */
export function pressenPhase(p: Presse, jetzt: number, rest: number): { phase: PressenPhase; anteil: number; fortschritt: number } {
  if (!p.laeuft) return { phase: p.meister ? 'wartet' : 'schlafen', anteil: 0, fortschritt: 0 };
  const f = fortschrittImBild(p, presseZyklus(p.stufe), jetzt, rest);
  let grenze = 0;
  for (const phase of ['hin', 'arbeiten', 'zurueck', 'ablegen'] as const) {
    const laenge = PRESSE_PHASEN[phase];
    if (f < grenze + laenge || phase === 'ablegen') return { phase, anteil: Math.min(1, (f - grenze) / laenge), fortschritt: f };
    grenze += laenge;
  }
  return { phase: 'ablegen', anteil: 1, fortschritt: f };
}

/**
 * Wo der Arbeiter steht (0 = an der Kiste, 1 = an der Presse). Er schlaeft
 * an der Kiste ein — dort, wo er zuletzt abgelegt hat — und geht von dort los.
 */
export function arbeiterOrt(phase: PressenPhase, anteil: number): number {
  switch (phase) {
    case 'hin':
      return glatt(anteil);
    case 'arbeiten':
      return 1;
    case 'zurueck':
      return 1 - glatt(anteil);
    default:
      return 0;
  }
}

/** Traegt der Arbeiter gerade einen Stapel? Nur auf dem Rueckweg und beim Ablegen. */
export function traegtStapel(phase: PressenPhase): boolean {
  return phase === 'zurueck' || phase === 'ablegen';
}

/** Pressenschlaege in der Arbeitsphase: drei je Zyklus, jeweils als Anteil 0 … 1. */
export const SCHLAEGE = [0.2, 0.5, 0.8] as const;

/**
 * Wie viele Stapel in der Kiste liegen: so viele Zyklen, wie drin sind, aber
 * hoechstens sechs. Darueber quillt die Kiste ueber — dann staut es sich hier
 * (der Paternoster kommt nicht nach).
 */
export function kistenStapel(p: Presse, index: number, manufaktur: number, jubilaeen = 0): { anzahl: number; quillt: boolean } {
  if (p.kiste <= 1e-9) return { anzahl: 0, quillt: false };
  const zyklen = p.kiste / presseErtrag(index, p.stufe, manufaktur, jubilaeen);
  return { anzahl: Math.min(6, Math.max(1, Math.ceil(zyklen - 1e-9))), quillt: zyklen > 6 };
}

/** Wie viele Kartons auf dem Packtisch stehen — nach dem, was der Wagen auf einmal nimmt. */
export function packtischKartons(packtisch: number, wagenKapazitaet: number): { anzahl: number; quillt: boolean } {
  if (packtisch <= 1e-9) return { anzahl: 0, quillt: false };
  const fuhren = packtisch / wagenKapazitaet;
  return { anzahl: Math.min(8, Math.max(1, Math.ceil(fuhren * 4 - 1e-9))), quillt: fuhren > 2 };
}

/**
 * Wo die Kabine des Paternosters ist: 0 = oben in der Halle, k = an Etage k
 * (1 …). Haelt an jeder Etage, faehrt nach der tiefsten wieder hinauf.
 */
export function paternosterOrt(stand: ManufakturStand, jetzt: number, rest: number): { etage: number; faehrt: boolean; abwaerts: boolean } {
  const f = stand.paternoster;
  if (!f.laeuft) return { etage: 0, faehrt: false, abwaerts: false };
  const p = fortschrittImBild(f, paternosterFahrt(f.etagen, f.stufe), jetzt, rest);
  const wende = paternosterWende(f.etagen);
  if (p < wende) {
    let vorher = 0;
    let ab = 0;
    for (let k = 1; k <= f.etagen; k += 1) {
      const halt = paternosterHalt(k, f.etagen);
      if (p < halt.an) return { etage: vorher + ((p - ab) / (halt.an - ab)) * (k - vorher), faehrt: true, abwaerts: true };
      if (p < halt.ab) return { etage: k, faehrt: false, abwaerts: true };
      vorher = k;
      ab = halt.ab;
    }
    return { etage: f.etagen, faehrt: false, abwaerts: true };
  }
  const oben = paternosterEntladen(f.etagen);
  if (p < oben) return { etage: f.etagen * (1 - (p - wende) / (oben - wende)), faehrt: true, abwaerts: false };
  return { etage: 0, faehrt: false, abwaerts: false };
}

export type WagenPhase = 'steht' | 'laden' | 'weg' | 'zurueck';

/**
 * Der Lieferwagen: steht am Tor, wird beladen, faehrt nach rechts ab (dort
 * wird verkauft) und kommt leer zurueck. `weg` ist 0 am Tor, 1 aus dem Bild.
 */
export function wagenOrt(stand: ManufakturStand, jetzt: number, rest: number): { phase: WagenPhase; weg: number; anteil: number } {
  const v = stand.versand;
  if (!v.laeuft) return { phase: 'steht', weg: 0, anteil: 0 };
  const f = fortschrittImBild(v, versandZyklus(v.stufe), jetzt, rest);
  if (f < VERSAND_ABFAHRT) return { phase: 'laden', weg: 0, anteil: f / VERSAND_ABFAHRT };
  if (f < VERSAND_VERKAUF) {
    const a = (f - VERSAND_ABFAHRT) / (VERSAND_VERKAUF - VERSAND_ABFAHRT);
    return { phase: 'weg', weg: anfahren(a), anteil: a };
  }
  const a = (f - VERSAND_VERKAUF) / (1 - VERSAND_VERKAUF);
  return { phase: 'zurueck', weg: 1 - bremsen(a), anteil: a };
}

/** Weich an beiden Enden (fuer Laufwege). */
export function glatt(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Langsam anfahren, dann zuegig. */
function anfahren(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t;
}

/** Zuegig heran, dann langsam ausrollen. */
function bremsen(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return 1 - (1 - t) * (1 - t);
}

/** Welcher Ablauf zu welcher Phase gehoert — der Zustandsautomat des Arbeiters. */
export function arbeiterAblauf(phase: PressenPhase): 'schlafen' | 'idle' | 'laufen' | 'arbeiten' | 'laufen_tragen' | 'ablegen' {
  switch (phase) {
    case 'schlafen':
      return 'schlafen';
    case 'wartet':
      return 'idle';
    case 'hin':
      return 'laufen';
    case 'arbeiten':
      return 'arbeiten';
    case 'zurueck':
      return 'laufen_tragen';
    case 'ablegen':
      return 'ablegen';
  }
}

/**
 * Wie schnell die Ablaeufe einer Presse laufen: im Verhaeltnis zur Zykluszeit
 * auf Stufe 1, mal Meister-Faehigkeit. Ein Upgrade macht die Presse sichtbar
 * schneller, weil ihr Zyklus kuerzer wird — nicht, weil hier etwas erfunden ist.
 */
export function ablaufTempo(p: Presse, jetzt: number): number {
  return (presseZyklus(1) / presseZyklus(p.stufe)) * tempo(p, jetzt);
}

/**
 * Laufschritte hoechstens so viel schneller als auf Stufe 1. Darueber
 * trippelten die Pinguine nur noch (Rueckmeldung 23.10.2026); der Weg selbst
 * wird trotzdem in der Zeit geschafft, die der Zyklus vorgibt.
 */
export const LAUFEN_TEMPO_MAX = 2;

/**
 * Wie schnell der Ablauf zu einer Phase laufen muss, damit er in die Phase
 * passt. Die Ablaeufe haben feste Laengen (clips.ts), die Phasen nicht: Bei
 * vollem Tempo dauert `ablegen` 50 ms, der Ablauf 400 ms — er brach immer
 * mitten im Bewegen ab, und die Figur zuckte.
 *
 * - einmalige Ablaeufe: genau so schnell, dass sie mit der Phase enden
 * - `arbeiten`: eine Bewegung je Pressenschlag (drei je Phase)
 * - Laufen: im Takt des Zyklus, aber gedeckelt
 */
export function phasenTempo(ablauf: { dauer: number; schleife: boolean }, name: string, phaseMs: number, grundTempo: number): number {
  if (phaseMs <= 0) return grundTempo;
  if (name === 'arbeiten') return ablauf.dauer / (phaseMs / SCHLAEGE.length);
  if (!ablauf.schleife) return Math.max(1, ablauf.dauer / phaseMs);
  if (name.startsWith('laufen')) return Math.min(LAUFEN_TEMPO_MAX, grundTempo);
  return grundTempo;
}

/** Wie lange eine Phase der Presse gerade dauert (ms), mit Meister-Faehigkeit. */
export function pressenPhaseMs(p: Presse, phase: PressenPhase, jetzt: number): number {
  if (phase === 'schlafen' || phase === 'wartet') return 0;
  return (PRESSE_PHASEN[phase] * presseZyklus(p.stufe)) / tempo(p, jetzt);
}

/** Wurde zwischen `vorher` und `jetzt` (Anteile der Arbeitsphase) ein Pressenschlag erreicht? */
export function schlagZwischen(vorher: number, jetzt: number): boolean {
  if (jetzt < vorher) return SCHLAEGE.some((s) => s <= jetzt || s > vorher);
  return SCHLAEGE.some((s) => s > vorher && s <= jetzt);
}
