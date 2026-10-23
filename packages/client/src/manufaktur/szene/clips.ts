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
 *
 * Seit dem Rig (Lieferung 23.10.2026) zusaetzlich je Einzelteil, in Grad um
 * den Drehpunkt des Teils: `fv`/`fh` Vorder-/Hinterflosse, `fuv`/`fuh`
 * Vorder-/Hinterfuss, `lid` 0 … 1 (Lider zu). Negativ dreht die Vorderflosse
 * nach vorn hoch — so haelt der Pinguin etwas vor der Brust (−75°, wie in den
 * Montageproben). Das Einzelbild ohne Rig kennt diese Kanaele nicht und
 * ueberspringt sie.
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
  fv: number;
  fh: number;
  fuv: number;
  fuh: number;
  lid: number;
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

export const RUHE: Pose = { dreh: 0, hoch: 0, breit: 1, hochS: 1, fv: 0, fh: 0, fuv: 0, fuh: 0, lid: 0 };
const FELDER = Object.keys(RUHE) as (keyof Pose)[];
/** Vorderflosse, wenn der Pinguin etwas vor der Brust haelt. */
const TRAGEN = -75;

/** Ueberblendung zwischen zwei Ablaeufen (ms) — 100 … 150 laut Auftrag. */
export const UEBERBLENDUNG_MS = 120;

export const CLIPS: Record<ClipName, Clip> = {
  idle: {
    dauer: 2200,
    schleife: true,
    keyframes: [
      { t: 0, breit: 1, hochS: 1, fv: 0, fh: 0 },
      { t: 0.5, breit: 1.02, hochS: 0.985, fv: -5, fh: 5, easing: 'weich' },
      { t: 1, breit: 1, hochS: 1, fv: 0, fh: 0, easing: 'weich' },
    ],
  },
  // Watscheln: Fuesse im Wechsel, der Rumpf pendelt mit, die Flossen gegenlaeufig.
  laufen: {
    dauer: 520,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -6, hoch: 0, fuv: 16, fuh: -12, fv: 12, fh: -10 },
      { t: 0.25, dreh: 0, hoch: 2.5, fuv: 0, fuh: 0, fv: 0, fh: 0, easing: 'raus' },
      { t: 0.5, dreh: 6, hoch: 0, fuv: -12, fuh: 16, fv: -12, fh: 10, easing: 'weich' },
      { t: 0.75, dreh: 0, hoch: 2.5, fuv: 0, fuh: 0, fv: 0, fh: 0, easing: 'raus' },
      { t: 1, dreh: -6, hoch: 0, fuv: 16, fuh: -12, fv: 12, fh: -10, easing: 'weich' },
    ],
  },
  // Mit Last: kleinere Schritte, tiefer, die Vorderflosse haelt fest.
  laufen_tragen: {
    dauer: 600,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -3, hoch: 0, hochS: 0.98, fuv: 12, fuh: -10, fv: TRAGEN, fh: -6 },
      { t: 0.25, dreh: 0, hoch: 1.5, hochS: 1, fuv: 0, fuh: 0, fv: TRAGEN - 4, fh: 0, easing: 'raus' },
      { t: 0.5, dreh: 3, hoch: 0, hochS: 0.98, fuv: -10, fuh: 12, fv: TRAGEN, fh: 6, easing: 'weich' },
      { t: 0.75, dreh: 0, hoch: 1.5, hochS: 1, fuv: 0, fuh: 0, fv: TRAGEN - 4, fh: 0, easing: 'raus' },
      { t: 1, dreh: -3, hoch: 0, hochS: 0.98, fuv: 12, fuh: -10, fv: TRAGEN, fh: -6, easing: 'weich' },
    ],
  },
  // An der Presse: die Vorderflosse drueckt den Hebel, im Takt der Schlaege.
  arbeiten: {
    dauer: 700,
    schleife: true,
    keyframes: [
      { t: 0, dreh: 0, hochS: 1, breit: 1, fv: -55, fh: -8 },
      { t: 0.35, dreh: 6, hochS: 0.95, breit: 1.04, fv: -95, fh: -14, easing: 'weich' },
      { t: 0.5, dreh: 8, hochS: 0.93, breit: 1.05, fv: -105, fh: -16, easing: 'raus' },
      { t: 1, dreh: 0, hochS: 1, breit: 1, fv: -55, fh: -8, easing: 'weich' },
    ],
  },
  ablegen: {
    dauer: 400,
    schleife: false,
    keyframes: [
      { t: 0, dreh: 0, hochS: 1, fv: TRAGEN },
      { t: 0.5, dreh: -10, hochS: 0.94, fv: -25, easing: 'weich' },
      { t: 1, dreh: 0, hochS: 1, fv: 0, easing: 'weich' },
    ],
  },
  // Schlafen: zur Seite gesunken, Lider zu, atmet langsam.
  schlafen: {
    dauer: 3000,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -12, hochS: 0.96, breit: 1.02, lid: 1, fv: 6, fh: -6 },
      { t: 0.5, dreh: -13, hochS: 0.93, breit: 1.04, lid: 1, fv: 8, fh: -8, easing: 'weich' },
      { t: 1, dreh: -12, hochS: 0.96, breit: 1.02, lid: 1, fv: 6, fh: -6, easing: 'weich' },
    ],
  },
  // Zwei Freudenspruenge, beide Flossen hoch.
  jubeln: {
    dauer: 800,
    schleife: false,
    keyframes: [
      { t: 0, hoch: 0, hochS: 0.9, breit: 1.08, fv: 20, fh: -20 },
      { t: 0.2, hoch: 12, hochS: 1.08, breit: 0.95, fv: 120, fh: -120, easing: 'raus' },
      { t: 0.42, hoch: 0, hochS: 0.9, breit: 1.08, fv: 60, fh: -60, easing: 'weich' },
      { t: 0.62, hoch: 9, hochS: 1.06, breit: 0.96, fv: 120, fh: -120, easing: 'raus' },
      { t: 0.84, hoch: 0, hochS: 0.92, breit: 1.06, fv: 30, fh: -30, easing: 'weich' },
      { t: 1, hoch: 0, hochS: 1, breit: 1, fv: 0, fh: 0, easing: 'weich' },
    ],
  },
  // Am Antriebsrad: die Vorderflosse dreht im Kreis.
  kurbeln: {
    dauer: 600,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -3, fv: -30 },
      { t: 0.25, dreh: 0, fv: -75, easing: 'weich' },
      { t: 0.5, dreh: 3, fv: -110, easing: 'weich' },
      { t: 0.75, dreh: 0, fv: -75, easing: 'weich' },
      { t: 1, dreh: -3, fv: -30, easing: 'weich' },
    ],
  },
  // Das Paket in den Wagen schieben.
  einladen: {
    dauer: 500,
    schleife: false,
    keyframes: [
      { t: 0, dreh: 0, hoch: 0, fv: TRAGEN },
      { t: 0.4, dreh: 10, hoch: 3, hochS: 1.04, fv: -110, easing: 'raus' },
      { t: 0.7, dreh: 14, hoch: 0, hochS: 0.95, fv: -120, easing: 'weich' },
      { t: 1, dreh: 0, hoch: 0, hochS: 1, fv: 0, easing: 'weich' },
    ],
  },
  // Dem Wagen nachwinken: die Hinterflosse hoch und hin und her.
  winken: {
    dauer: 700,
    schleife: true,
    keyframes: [
      { t: 0, dreh: -3, fh: -120 },
      { t: 0.5, dreh: 3, hoch: 1, fh: -155, easing: 'weich' },
      { t: 1, dreh: -3, fh: -120, easing: 'weich' },
    ],
  },
  // Meister: Flosse an den Schnabel, aufrichten, wippen — er pfeift die Faehigkeit an.
  pfeifen: {
    dauer: 900,
    schleife: false,
    keyframes: [
      { t: 0, hochS: 1, hoch: 0, fv: 0 },
      { t: 0.25, hochS: 1.07, hoch: 3, fv: -135, easing: 'raus' },
      { t: 0.5, hochS: 1.02, hoch: 1, dreh: 4, fv: -140, easing: 'weich' },
      { t: 0.75, hochS: 1.05, hoch: 2, dreh: -4, fv: -135, easing: 'weich' },
      { t: 1, hochS: 1, hoch: 0, dreh: 0, fv: 0, easing: 'weich' },
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
  const pose = { ...RUHE };
  for (const feld of FELDER) {
    const va = a[feld] ?? RUHE[feld];
    const vb = b[feld] ?? RUHE[feld];
    pose[feld] = va + (vb - va) * f;
  }
  return pose;
}

export function mische(a: Pose, b: Pose, gewicht: number): Pose {
  const w = Math.min(1, Math.max(0, gewicht));
  const pose = { ...RUHE };
  for (const feld of FELDER) pose[feld] = a[feld] + (b[feld] - a[feld]) * w;
  return pose;
}
