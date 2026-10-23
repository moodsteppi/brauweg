/**
 * Bewegungsablaeufe der Pinguine als Daten — Keyframes mit Easing.
 *
 * Solange es die Einzelteile (rig-pinguin.json) noch nicht gibt, bewegt sich
 * der ganze Pinguin als ein Teil: Watscheln ueber ±6° Drehung, Huepfen,
 * Stauchen. Die Namen der Ablaeufe sind dieselben, die spaeter das Rig
 * bekommt — dann tauscht man nur die Daten, nicht den Code.
 *
 * Werte je Keyframe: `dreh` (Grad), `hoch` (Welt-Einheiten nach oben),
 * `breit`/`hoch_s` (Stauchung, 1 = normal). Ein Ablauf dauert `dauer` ms bei
 * Tempo 1 und laeuft im Kreis, wenn `schleife` gesetzt ist.
 */

export type ClipName =
  | 'idle'
  | 'laufen'
  | 'laufen_tragen'
  | 'arbeiten'
  | 'ablegen'
  | 'schlafen'
  | 'jubeln'
  | 'kurbeln'
  | 'einladen'
  | 'winken'
  | 'pfeifen';

export interface Pose {
  dreh: number;
  hoch: number;
  breit: number;
  hochS: number;
}

export interface Keyframe extends Partial<Pose> {
  /** Zeitpunkt im Ablauf, 0 … 1. */
  t: number;
  /** Wie es zum naechsten Keyframe geht. */
  easing?: 'linear' | 'weich' | 'raus';
}

export interface Clip {
  dauer: number;
  schleife: boolean;
  keyframes: Keyframe[];
}

export const RUHE: Pose = { dreh: 0, hoch: 0, breit: 1, hochS: 1 };

/** Ueberblendung zwischen zwei Ablaeufen (ms) — 100 … 150 laut Auftrag. */
export const UEBERBLENDUNG_MS = 120;

export const CLIPS: Record<ClipName, Clip> = {
  idle: {
    dauer: 2200,
    schleife: true,
    keyframes: [
      { t: 0, breit: 1, hochS: 1 },
      { t: 0.5, breit: 1.02, hochS: 0.985, easing: 'weich' },
      { t: 1, breit: 1, hochS: 1, easing: 'weich' },
    ],
  },
  // Watscheln: links, Mitte (gehoben), rechts, Mitte (gehoben).
  laufen: {
    dauer: 520,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -6, hoch: 0 },
      { t: 0.25, dreh: 0, hoch: 2.5, easing: 'raus' },
      { t: 0.5, dreh: 6, hoch: 0, easing: 'weich' },
      { t: 0.75, dreh: 0, hoch: 2.5, easing: 'raus' },
      { t: 1, dreh: -6, hoch: 0, easing: 'weich' },
    ],
  },
  // Mit Last: kleinere Schritte, tiefer, etwas langsamer.
  laufen_tragen: {
    dauer: 600,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -4, hoch: 0, hochS: 0.98 },
      { t: 0.25, dreh: 0, hoch: 1.5, hochS: 1, easing: 'raus' },
      { t: 0.5, dreh: 4, hoch: 0, hochS: 0.98, easing: 'weich' },
      { t: 0.75, dreh: 0, hoch: 1.5, hochS: 1, easing: 'raus' },
      { t: 1, dreh: -4, hoch: 0, hochS: 0.98, easing: 'weich' },
    ],
  },
  // An der Presse: nach vorn beugen und druecken, im Takt der Schlaege.
  arbeiten: {
    dauer: 700,
    schleife: true,
    keyframes: [
      { t: 0, dreh: 0, hochS: 1, breit: 1 },
      { t: 0.35, dreh: 8, hochS: 0.95, breit: 1.04, easing: 'weich' },
      { t: 0.5, dreh: 10, hochS: 0.93, breit: 1.05, easing: 'raus' },
      { t: 1, dreh: 0, hochS: 1, breit: 1, easing: 'weich' },
    ],
  },
  ablegen: {
    dauer: 400,
    schleife: false,
    keyframes: [
      { t: 0, dreh: 0, hochS: 1 },
      { t: 0.5, dreh: -12, hochS: 0.94, easing: 'weich' },
      { t: 1, dreh: 0, hochS: 1, easing: 'weich' },
    ],
  },
  // Schlafen: zur Seite gesunken, atmet langsam.
  schlafen: {
    dauer: 3000,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -14, hochS: 0.96, breit: 1.02 },
      { t: 0.5, dreh: -15, hochS: 0.93, breit: 1.04, easing: 'weich' },
      { t: 1, dreh: -14, hochS: 0.96, breit: 1.02, easing: 'weich' },
    ],
  },
  // Zwei Freudenspruenge mit Stauchung beim Landen.
  jubeln: {
    dauer: 800,
    schleife: false,
    keyframes: [
      { t: 0, hoch: 0, hochS: 0.9, breit: 1.08 },
      { t: 0.2, hoch: 12, hochS: 1.08, breit: 0.95, easing: 'raus' },
      { t: 0.42, hoch: 0, hochS: 0.9, breit: 1.08, easing: 'weich' },
      { t: 0.62, hoch: 9, hochS: 1.06, breit: 0.96, easing: 'raus' },
      { t: 0.84, hoch: 0, hochS: 0.92, breit: 1.06, easing: 'weich' },
      { t: 1, hoch: 0, hochS: 1, breit: 1, easing: 'weich' },
    ],
  },
  kurbeln: {
    dauer: 600,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -5 },
      { t: 0.5, dreh: 5, easing: 'weich' },
      { t: 1, dreh: -5, easing: 'weich' },
    ],
  },
  // Den Karton in den Wagen wuchten.
  einladen: {
    dauer: 500,
    schleife: false,
    keyframes: [
      { t: 0, dreh: 0, hoch: 0 },
      { t: 0.4, dreh: 10, hoch: 3, hochS: 1.04, easing: 'raus' },
      { t: 0.7, dreh: 14, hoch: 0, hochS: 0.95, easing: 'weich' },
      { t: 1, dreh: 0, hoch: 0, hochS: 1, easing: 'weich' },
    ],
  },
  winken: {
    dauer: 700,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -4 },
      { t: 0.5, dreh: 4, hoch: 1, easing: 'weich' },
      { t: 1, dreh: -4, easing: 'weich' },
    ],
  },
  // Meister: kurz aufrichten und wippen, wenn er die Faehigkeit ausloest.
  pfeifen: {
    dauer: 900,
    schleife: false,
    keyframes: [
      { t: 0, hochS: 1, hoch: 0 },
      { t: 0.25, hochS: 1.07, hoch: 3, easing: 'raus' },
      { t: 0.5, hochS: 1.02, hoch: 1, dreh: 4, easing: 'weich' },
      { t: 0.75, hochS: 1.05, hoch: 2, dreh: -4, easing: 'weich' },
      { t: 1, hochS: 1, hoch: 0, dreh: 0, easing: 'weich' },
    ],
  },
};

function easing(art: Keyframe['easing'], x: number): number {
  if (art === 'weich') return x * x * (3 - 2 * x);
  if (art === 'raus') return 1 - (1 - x) * (1 - x);
  return x;
}

/** Die Pose eines Ablaufs an Stelle `t` (0 … 1). Fehlende Werte gelten als Ruhe. */
export function poseBei(clip: Clip, t: number): Pose {
  const k = clip.keyframes;
  const x = clip.schleife ? ((t % 1) + 1) % 1 : Math.min(1, Math.max(0, t));
  let i = 0;
  while (i < k.length - 2 && x > k[i + 1]!.t) i += 1;
  const a = k[i]!;
  const b = k[Math.min(i + 1, k.length - 1)]!;
  const spanne = b.t - a.t;
  const f = spanne <= 0 ? 0 : easing(b.easing, (x - a.t) / spanne);
  const wert = (feld: keyof Pose): number => {
    const va = a[feld] ?? RUHE[feld];
    const vb = b[feld] ?? RUHE[feld];
    return va + (vb - va) * f;
  };
  return { dreh: wert('dreh'), hoch: wert('hoch'), breit: wert('breit'), hochS: wert('hochS') };
}

export function mische(a: Pose, b: Pose, gewicht: number): Pose {
  const w = Math.min(1, Math.max(0, gewicht));
  return {
    dreh: a.dreh + (b.dreh - a.dreh) * w,
    hoch: a.hoch + (b.hoch - a.hoch) * w,
    breit: a.breit + (b.breit - a.breit) * w,
    hochS: a.hochS + (b.hochS - a.hochS) * w,
  };
}
