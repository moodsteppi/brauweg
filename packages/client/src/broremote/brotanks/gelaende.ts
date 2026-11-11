import { REGELN, STROM, zufallsstrom } from './regeln';

/** Höhenprofil: 512 Spalten à 0,125 m, Höhe in m. Funktionen hier verändern nur das übergebene Feld. */
export type Gelaende = Float32Array;
const R = REGELN;

/** Höhe bei x (linear zwischen Spaltenmitten). Außerhalb der Welt liegt der Meeresgrund. */
export function hoeheBei(g: Gelaende, x: number): number {
  if (!(x >= 0 && x <= R.breite)) return R.meeresgrund;
  const p = Math.min(R.spalten - 1, Math.max(0, x / R.spaltenbreite - 0.5));
  const i = Math.floor(p), k = Math.min(R.spalten - 1, i + 1), f = p - i;
  return g[i] * (1 - f) + g[k] * f;
}

const glatt = (t: number): number => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };

/** Eisinsel aus dem Seed: Hügel, Senken, ein Kamm, zum Meer hin abfallend. Gleicher Seed, gleiche Insel. */
export const KARTEN = ['Polarinsel', 'Bernsteindünen', 'Kristalltal', 'Zwillingsinseln', 'Gipfelfeste'] as const;
export const karteAusSeed = (seed: number): number => (seed >>> 0) % 3;

export function inselAusSeed(seed: number, karte = karteAusSeed(seed)): Gelaende {
  const z = zufallsstrom((seed ^ STROM.gelaende) >>> 0);
  const p1 = z() * 6.28, p2 = z() * 6.28, p3 = z() * 6.28;
  const kammX = 26 + z() * 12, kammHoehe = 2 + z() * 1.5;
  const g = new Float32Array(R.spalten);
  for (let i = 0; i < R.spalten; i++) {
    const x = (i + 0.5) * R.spaltenbreite;
    let innen = 5 + 1.6 * Math.sin(x * 0.21 + p1) + 1.1 * Math.sin(x * 0.47 + p2) + 0.6 * Math.sin(x * 0.9 + p3)
      + kammHoehe * Math.exp(-(((x - kammX) / 2.5) ** 2));
    if (karte === 1) innen += 4 * Math.exp(-(((x - 32) / 9) ** 2));
    if (karte === 2) innen = 4 + Math.abs(x - 32) * .12 + .7 * Math.sin(x * .35 + p1);
    if (karte === 3) innen = 6 + Math.sin(x * .3 + p1) - 17 * Math.exp(-(((x - 32) / 4) ** 4));
    if (karte === 4) innen = 4 + 10 * Math.exp(-(((x - 32) / 8) ** 2)) + .5 * Math.sin(x * .6 + p2);
    const rand = glatt((x - 6) / 6) * glatt((58 - x) / 6);
    g[i] = R.meeresgrund + (innen - R.meeresgrund) * rand;
  }
  return g;
}

/** Schlägt eine Schüssel mit Radius r in die Oberfläche. cy = Mittelpunkthöhe (Standard: Oberfläche bei x). */
export function kraterSchlagen(g: Gelaende, x: number, r: number, cy: number = hoeheBei(g, x)): void {
  if (!(r > 0)) return;
  const von = Math.max(0, Math.floor((x - r) / R.spaltenbreite)), bis = Math.min(R.spalten - 1, Math.ceil((x + r) / R.spaltenbreite));
  for (let i = von; i <= bis; i++) {
    const dx = (i + 0.5) * R.spaltenbreite - x;
    if (Math.abs(dx) >= r) continue;
    g[i] = Math.max(R.tiefstens, Math.min(g[i], cy - Math.sqrt(r * r - dx * dx)));
  }
}

/** Baut einen weichen Hügel (Breite b, Höhe h) auf die Oberfläche. */
export function huegelSetzen(g: Gelaende, x: number, b: number, h: number): void {
  const von = Math.max(0, Math.floor((x - b / 2) / R.spaltenbreite)), bis = Math.min(R.spalten - 1, Math.ceil((x + b / 2) / R.spaltenbreite));
  for (let i = von; i <= bis; i++) {
    const dx = (i + 0.5) * R.spaltenbreite - x;
    if (Math.abs(dx) >= b / 2) continue;
    g[i] = Math.min(R.hoechstens, g[i] + h * 0.5 * (1 + Math.cos((2 * Math.PI * dx) / b)));
  }
}

/** Verteilt n Startplätze gleichmäßig über die Insel und ebnet je 2 m ein. Rückgabe: x je Platz, aufsteigend. */
export function aufstellen(g: Gelaende, n: number, seed: number): number[] {
  const z = zufallsstrom((seed ^ STROM.platz) >>> 0);
  const links = 14, rechts = 50, xs: number[] = [];
  for (let i = 0; i < n; i++) {
    let x = links + ((rechts - links) * (i + 0.5)) / n + (z() - 0.5) * 2;
    if (hoeheBei(g, x) < R.meerStart + 2) {
      const sichere = Array.from({ length: 37 }, (_, j) => j + 14).filter(v => hoeheBei(g, v) >= R.meerStart + 2 && xs.every(a => Math.abs(a - v) >= 5));
      sichere.sort((a,b) => Math.abs(a-x)-Math.abs(b-x)); x = sichere[0] ?? x;
    }
    const h = hoeheBei(g, x);
    for (let c = Math.floor((x - 1) / R.spaltenbreite); c <= Math.ceil((x + 1) / R.spaltenbreite); c++) if (c >= 0 && c < R.spalten) g[c] = h;
    xs.push(x);
  }
  return xs.sort((a,b) => a-b);
}

