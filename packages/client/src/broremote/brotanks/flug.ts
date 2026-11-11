import { hoeheBei, huegelSetzen, kraterSchlagen, type Gelaende } from './gelaende';
import { KETTE, REGELN, WAFFEN, WEHE, type Waffe } from './regeln';

const R = REGELN, DT = R.schritt;

/** Ein Einschlag in der Reihenfolge, in der er auf das Gelände wirkt. */
export type Einschlag = {
  /** Zeit seit dem Feuern in s. */
  t: number; waffe: Waffe; art: 'krater' | 'huegel';
  /** Mitte des Kraters (bzw. Fuß des Hügels). */
  x: number; y: number; r: number; breite: number; hoehe: number;
  /** Mitte, Radius und Größe des Schadens; stoss = Rückstoß in m. */
  sx: number; sy: number; sr: number; schaden: number; stoss: number;
};
export type Teilflug = { waffe: Waffe; t0: number; /** Ein Punkt je Schritt von 1/60 s ab t0. */ punkte: [number, number][] };
export type Flugbahn = { teile: Teilflug[]; einschlaege: Einschlag[]; /** Gesamtdauer in s, höchstens flugMax. */ dauer: number };
export type Ziel = { x: number; y: number; schuetze?: boolean };

type Kontext = { g: Gelaende; wind: number; ziele: readonly Ziel[]; teile: Teilflug[]; einschlaege: Einschlag[] };

/** Wirkt einen Einschlag auf ein Feld. Wird bei der Rechnung UND später beim Anwenden benutzt, damit beide dasselbe tun. */
export function einschlagAnwenden(g: Gelaende, e: Einschlag): void {
  if (e.art === 'huegel') huegelSetzen(g, e.x, e.breite, e.hoehe);
  else kraterSchlagen(g, e.x, e.r, e.y);
}

function melden(c: Kontext, e: Einschlag): void {
  if (c.einschlaege.length >= R.maxEinschlaege) return;
  c.einschlaege.push(e);
  einschlagAnwenden(c.g, e);
}
const leer = { x: 0, y: 0, r: 0, breite: 0, hoehe: 0, sx: 0, sy: 0, sr: 0, schaden: 0, stoss: 0 };
function krater(c: Kontext, t: number, waffe: Waffe, x: number, sx: number, sy: number, over: Partial<Einschlag> = {}): void {
  const w = WAFFEN[waffe];
  melden(c, { ...leer, t, waffe, art: 'krater', x, y: hoeheBei(c.g, x), r: w.krater, sx, sy, sr: w.radius, schaden: w.schaden, stoss: w.stoss, ...over });
}

/**
 * Das Geschoss ist am Ziel: je Waffe die Folgen. (sx, sy) ist der Ort, an dem es wirkt;
 * richtung nur beim Meißelbolzen, der sich in Flugrichtung eingräbt.
 */
function wirken(c: Kontext, waffe: Waffe, x: number, h: number, t: number, sy: number, richtung?: [number, number]): void {
  if (waffe === 10) { melden(c, { ...leer, t, waffe, art: 'huegel', x, y: h, breite: 7, hoehe: 3 }); return; }
  if (waffe === 5) { melden(c, { ...leer, t, waffe, art: 'huegel', x, y: h, breite: WEHE.breite, hoehe: WEHE.hoehe }); return; }
  if (waffe === 4 && richtung) {
    const ex = x + richtung[0] * 4, ey = h + richtung[1] * 4;
    // Das Höhenfeld kennt keine Hohlräume: Der Bolzen hinterlässt eine tiefe Grube am Eintritt,
    // wirkt aber 4 m tiefer (Schaden hinter einem Kamm).
    krater(c, t, 4, x, ex, ey, { y: h - 2 });
    return;
  }
  if (waffe === 7) {
    for (let i = 0; i < KETTE.funken; i++) {
      const fx = x + (i - (KETTE.funken - 1) / 2) * KETTE.abstand;
      krater(c, t + (i + 1) * KETTE.pause, 7, fx, fx, hoeheBei(c.g, fx));
    }
    return;
  }
  krater(c, t, waffe, x, x, sy);
}

function rollen(c: Kontext, x: number, t: number, pk: [number, number][]): void {
  let v = 0, tr = 0;
  const hang = (px: number): number => (hoeheBei(c.g, px + 0.1) - hoeheBei(c.g, px - 0.1)) / 0.2;
  for (; t < R.flugMax && tr < 3; tr += DT) {
    const s = hang(x);
    v += (-R.schwerkraft * s / (1 + s * s)) * DT;
    v = Math.max(-8, Math.min(8, v * (1 - 0.8 * DT)));
    x += v * DT; t += DT;
    pk.push([x, hoeheBei(c.g, x)]);
    if (x < 0 || x > R.breite) break;
    // Liegt es in einer Mulde (flach und langsam), zündet es dort.
    if (tr > 0.2 && Math.abs(hang(x)) < 0.05 && Math.abs(v) < 0.25) break;
  }
  const h = hoeheBei(c.g, x);
  wirken(c, 2, x, h, t, h);
}

function fliege(c: Kontext, waffe: Waffe, fisch: boolean, x: number, y: number, vx: number, vy: number, t0: number): void {
  if (c.teile.length >= R.maxTeilgeschosse) return;
  const pk: [number, number][] = [[x, y]];
  c.teile.push({ waffe, t0, punkte: pk });
  const ax = c.wind * R.windFaktor;
  let t = t0, huepfer = 0;
  while (t < R.flugMax) {
    vx += ax * DT; vy -= R.schwerkraft * DT; x += vx * DT; y += vy * DT; t += DT;
    pk.push([x, y]);
    // Der Fächer teilt sich am höchsten Punkt.
    if (waffe === 1 && !fisch && vy <= 0) {
      for (const d of [-3, 0, 3]) fliege(c, 1, true, x, y, vx + d, vy, t);
      return;
    }
    const treffer = c.ziele.some(z => (!z.schuetze || t > R.schuetzenSchonzeit) && Math.hypot(x - z.x, y - (z.y + R.broHoehe)) < R.broRadius);
    if (treffer) { wirken(c, waffe, x, hoeheBei(c.g, x), t, y); return; }
    if (x < -10 || x > R.breite + 10) return; // verpufft über dem Meer
    const h = hoeheBei(c.g, x);
    if (y > h) continue;
    if (waffe === 3 && ++huepfer < 3) {
      // Eine kleine Delle ohne Schaden, dann springt es weiter.
      krater(c, t, 3, x, x, h, { r: 0.5, sr: 0, schaden: 0 });
      y = h + 0.02; pk[pk.length - 1] = [x, y];
      vy = Math.max(3, Math.abs(vy) * 0.55); vx *= 0.75;
      continue;
    }
    if (waffe === 2) { rollen(c, x, t, pk); return; }
    const l = Math.hypot(vx, vy) || 1;
    wirken(c, waffe, x, h, t, h, [vx / l, vy / l]);
    return;
  }
}

/**
 * Rechnet den ganzen Flug einmal vor (der Wind ändert sich währenddessen nicht). Das Gelände wird nicht
 * verändert; Einschläge stehen in Wirkreihenfolge in der Antwort. winkel: 0 = rechts, 90 = hoch, 180 = links.
 */
export function flugBerechnen(start: { x: number; y: number }, winkel: number, staerke: number, wind: number, waffe: Waffe, gelaende: Gelaende, ziele: readonly Ziel[] = []): Flugbahn {
  const c: Kontext = { g: Float32Array.from(gelaende), wind, ziele, teile: [], einschlaege: [] };
  const a = (winkel * Math.PI) / 180, v = staerke * R.staerkeFaktor;
  fliege(c, waffe, false, start.x + Math.cos(a) * R.rohr, start.y + R.broHoehe + Math.sin(a) * R.rohr, Math.cos(a) * v, Math.sin(a) * v, 0);
  let dauer = 0;
  for (const tf of c.teile) dauer = Math.max(dauer, tf.t0 + (tf.punkte.length - 1) * DT);
  for (const e of c.einschlaege) dauer = Math.max(dauer, e.t);
  return { teile: c.teile, einschlaege: c.einschlaege, dauer: Math.min(dauer, R.flugMax + KETTE.funken * KETTE.pause) };
}
