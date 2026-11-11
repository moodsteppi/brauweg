import { KLANGFARBEN } from './klang';
import { WELTEN } from './welten';
import { SCHLACHTFELD, bildEinpassen } from './massstab';
import { hoeheBei } from './gelaende';
import { REGELN, type Waffe } from './regeln';
import type { Gelaende } from './gelaende';
import type { BroSicht } from './partie';
import type { Flugbahn } from './flug';

/**
 * BroTanks-Bühne mit Canvas 2D im Stil von building/zeichnen.ts (docs/BROREMOTE-ARTILLERIE.md, Abschnitt 7):
 * Nachtblau, goldene Akzente und vorbereitete WebP-Kulissen. Himmel und Insel
 * werden in Puffer gerastert — die Insel nur dann neu, wenn sich das Gelände geändert hat.
 */
const R = REGELN;
/** Sichtfenster in Metern: ein Rand Meer links und rechts, unten ein Stück unter den Meeresgrund. */
export const ANSICHT = Object.freeze({ links: 0, rechts: R.breite, unten: -10 });
const GOLD = '#ffd67a';
const hintergruende = new Map<string, HTMLImageElement>();
let panzerBild: HTMLImageElement | undefined;
function panzerGrafik(): HTMLImageElement { if (!panzerBild) { panzerBild = new Image(); panzerBild.src = '/broremote/ausbau/panzer.webp'; } return panzerBild; }

export type Effekt =
  | { art: 'ring'; x: number; y: number; r: number; waffe?: number; seit: number }
  | { art: 'zahl'; x: number; y: number; text: string; farbe: string; seit: number }
  | { art: 'wehe'; x: number; y: number; seit: number };

export type Buehnenbild = {
  karte?: number; gelaende: Gelaende; gelaendeSchluessel: string; meer: number; wind: number;
  bros: readonly BroSicht[]; amZug?: string; zielen: boolean;
  /** Abgespielter Flug und die Flugzeit in s, bis zu der er gezeigt wird. */
  flug?: { bahn: Flugbahn; t: number };
  effekte: readonly Effekt[]; jetzt: number; wackeln: number; ruhe: boolean;
};

type Puffer = { himmel?: HTMLCanvasElement; insel?: HTMLCanvasElement; inselSchluessel?: string; w: number; h: number };
const neigungen = new WeakMap<HTMLCanvasElement, Map<string, number>>();
const puffer = new WeakMap<HTMLCanvasElement, Puffer>();

function leinwand(w: number, h: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c.getContext('2d') ? c : null;
}

function himmelZeichnen(w: number, h: number): HTMLCanvasElement | null {
  const bild = leinwand(w, h); if (!bild) return null;
  const c = bild.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1424'); g.addColorStop(.45, '#111c2b'); g.addColorStop(1, '#17485a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // Ein schwaches Polarlichtband und feste Sterne: gleich in jedem Bild, darum einmal gerastert.
  const p = c.createLinearGradient(0, h * .08, w, h * .3); p.addColorStop(0, '#5cf2c300'); p.addColorStop(.4, '#5cf2c322'); p.addColorStop(.7, '#8f7cff18'); p.addColorStop(1, '#8f7cff00');
  c.fillStyle = p; c.beginPath(); c.moveTo(0, h * .2);
  c.bezierCurveTo(w * .3, h * .05, w * .55, h * .32, w, h * .1); c.lineTo(w, h * .2); c.bezierCurveTo(w * .55, h * .42, w * .3, h * .14, 0, h * .3); c.closePath(); c.fill();
  let s = 7;
  const z = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(234,243,255,${(.25 + z() * .6).toFixed(2)})`;
    c.beginPath(); c.arc(z() * w, z() * h * .55, .5 + z() * 1.2, 0, Math.PI * 2); c.fill();
  }
  return bild;
}

/** Höhenprofil als Pfad: Fels unten, Eis darüber, oben eine 0,4 m dicke Schneekruste mit Glanz. */
function inselZeichnen(w: number, h: number, g: Gelaende, mx: (x: number) => number, my: (y: number) => number, skala: number, welt = WELTEN[0] as typeof WELTEN[number]): HTMLCanvasElement | null {
  const bild = leinwand(w, h); if (!bild) return null;
  const c = bild.getContext('2d')!;
  const oberflaeche = (): void => {
    c.moveTo(mx(0), my(g[0]));
    for (let i = 0; i < g.length; i++) c.lineTo(mx((i + .5) * R.spaltenbreite), my(g[i]));
    c.lineTo(mx(R.breite), my(g[g.length - 1]));
  };
  c.beginPath(); oberflaeche(); c.lineTo(mx(R.breite), h); c.lineTo(mx(0), h); c.closePath();
  const f = c.createLinearGradient(0, my(10), 0, my(ANSICHT.unten)); f.addColorStop(0, welt.farben[0]); f.addColorStop(.35, welt.farben[1]); f.addColorStop(.7, welt.farben[2]); f.addColorStop(1, welt.farben[3]);
  c.fillStyle = f; c.fill();
  c.save(); c.clip();
  // Feine Schichtlinien im Eis, damit Krater als Schnitt durch die Insel lesbar sind.
  c.strokeStyle = '#9ee7f218'; c.lineWidth = 1;
  for (let y = -3; y < 14; y += 1.2) { c.beginPath(); c.moveTo(0, my(y)); c.bezierCurveTo(w * .3, my(y + .4), w * .6, my(y - .3), w, my(y + .2)); c.stroke(); }
  c.restore();
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = '#0d1a2a99'; c.lineWidth = Math.max(3, .55 * skala); c.beginPath(); oberflaeche(); c.stroke();
  c.strokeStyle = welt.kruste; c.lineWidth = Math.max(2, .4 * skala); c.beginPath(); oberflaeche(); c.stroke();
  c.strokeStyle = '#ffffffaa'; c.lineWidth = Math.max(1, .1 * skala); c.save(); c.translate(0, -Math.max(1, .12 * skala)); c.beginPath(); oberflaeche(); c.stroke(); c.restore();
  return bild;
}

function geschoss(c: CanvasRenderingContext2D, waffe: Waffe, x: number, y: number, s: number, winkel: number): void {
  c.save(); c.translate(x, y); c.rotate(winkel);
  const r = Math.max(4, s * .28);
  if (waffe === 0) { c.fillStyle = '#f4fbff'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.fillStyle = '#7fd2ff'; c.beginPath(); c.arc(-r * .35, -r * .35, r * .3, 0, Math.PI * 2); c.fill(); }
  else if (waffe === 1) { c.fillStyle = '#cfdbe6'; c.beginPath(); c.ellipse(0, 0, r * 1.4, r * .6, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(-r * 1.2, 0); c.lineTo(-r * 2, -r * .7); c.lineTo(-r * 2, r * .7); c.closePath(); c.fill(); c.fillStyle = '#20324a'; c.beginPath(); c.arc(r * .8, -r * .1, r * .15, 0, Math.PI * 2); c.fill(); }
  else if (waffe === 2) { c.fillStyle = '#8b5a33'; c.beginPath(); c.roundRect(-r, -r * 1.2, r * 2, r * 2.4, r * .5); c.fill(); c.fillStyle = '#e9c785'; c.fillRect(-r, -r * .6, r * 2, r * .25); c.fillRect(-r, r * .35, r * 2, r * .25); }
  else if (waffe === 3) { c.fillStyle = '#94e0ed'; c.fillRect(-r, -r, r * 2, r * 2); c.strokeStyle = '#e4ffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-r * .6, -r * .6); c.lineTo(r * .6, r * .6); c.moveTo(r * .6, -r * .6); c.lineTo(-r * .6, r * .6); c.stroke(); }
  else if (waffe === 4) { c.fillStyle = '#aab6c4'; c.beginPath(); c.moveTo(r * 1.8, 0); c.lineTo(-r, -r * .6); c.lineTo(-r, r * .6); c.closePath(); c.fill(); c.fillStyle = '#d0874c'; c.fillRect(-r * .3, -r * .45, r * .4, r * .9); }
  else if (waffe === 5) { c.fillStyle = '#f4fbff'; for (const [dx, dy, rr] of [[-r * .7, r * .2, r * .7], [0, -r * .2, r * .9], [r * .7, r * .2, r * .7]]) { c.beginPath(); c.arc(dx, dy, rr, 0, Math.PI * 2); c.fill(); } }
  else if (waffe === 6) { c.fillStyle = '#d7b07a'; c.beginPath(); c.moveTo(-r, -r * .8); c.lineTo(r, -r * .55); c.lineTo(r, r * .55); c.lineTo(-r, r * .8); c.closePath(); c.fill(); c.strokeStyle = '#c9d2dc'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(r, -r * .55); c.lineTo(r * 1.5, 0); c.lineTo(r, r * .55); c.stroke(); }
  else { c.fillStyle = GOLD; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc((i - 1) * r, Math.abs(i - 1) * r * .3, r * .45, 0, Math.PI * 2); c.fill(); } }
  c.restore();
}

/** Pinguin im kleinen Panzer, Blick nach rechts; das Rohr zeigt in `winkel` (0 = rechts, 90 = hoch). */
function bro(c: CanvasRenderingContext2D, b: BroSicht, x: number, y: number, s: number, amZug: boolean, neigung: number, rueckstoss: number): void {
  c.save(); c.translate(x, y);
  if (b.raus) {
    c.globalAlpha = .7; c.rotate(Math.PI * .9); c.translate(0, s * .5);
  }
  const w = s * 1.3, hk = s * .35;
  // Rohr zuerst, damit es hinter dem Turm ansetzt.
  const a = (b.winkel * Math.PI) / 180;
  c.strokeStyle = '#e6be6c'; c.lineWidth = Math.max(3, s * .16); c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -s * .55); c.lineTo(Math.cos(a) * (s * .95-rueckstoss*6), -s * .55 - Math.sin(a) * (s * .95-rueckstoss*6)); c.stroke();
  c.save(); c.rotate(neigung);
  const motiv = panzerGrafik();
  if (motiv.complete && motiv.naturalWidth) {
    c.save();
    if (b.design==='kupfer') c.filter='sepia(.7) saturate(1.4)';
    else if (b.design==='polar') c.filter='saturate(.25) brightness(1.3)';
    else if (b.design==='royal') c.filter='hue-rotate(75deg) saturate(1.5)';
    if (b.winkel > 90) c.scale(-1, 1);
    c.drawImage(motiv, -s * .85, -s * 1.4, s * 1.7, s * 1.4); c.restore();
  } else {
  // Ketten
  c.fillStyle = '#1b2433'; c.beginPath(); c.roundRect(-w / 2, -hk, w, hk, hk / 2); c.fill();
  c.fillStyle = '#6c7b8f'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(-w / 2 + hk / 2 + (i * (w - hk)) / 4, -hk / 2, hk * .28, 0, Math.PI * 2); c.fill(); }
  // Wanne in Spielerfarbe mit Glanzkante
  const g = c.createLinearGradient(0, -s * .75, 0, -hk); g.addColorStop(0, '#ffffff'); g.addColorStop(.12, b.farbe); g.addColorStop(1, '#1b2b40');
  c.fillStyle = g; c.beginPath(); c.moveTo(-w * .46, -hk); c.lineTo(-w * .38, -s * .62); c.lineTo(w * .38, -s * .62); c.lineTo(w * .46, -hk); c.closePath(); c.fill();
  // Pinguin: Rücken nachtblau, Bauch weiß, Schal in Spielerfarbe
  c.fillStyle = '#111c2b'; c.beginPath(); c.ellipse(0, -s * .9, s * .3, s * .36, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f6fbff'; c.beginPath(); c.ellipse(s * .05, -s * .86, s * .19, s * .26, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(s * .1, -s * 1.06, s * .07, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111c2b'; c.beginPath(); c.arc(s * .12, -s * 1.06, s * .035, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f2a83a'; c.beginPath(); c.moveTo(s * .24, -s * 1.0); c.lineTo(s * .38, -s * .96); c.lineTo(s * .24, -s * .92); c.closePath(); c.fill();
  c.fillStyle = b.farbe; c.beginPath(); c.roundRect(-s * .28, -s * .74, s * .56, s * .1, s * .05); c.fill();
  }
  c.restore();
  c.restore();
  if (b.raus) return;
  if (b.schild) { c.strokeStyle='#8ff5ff'; c.lineWidth=2; c.fillStyle='#63e4f022'; c.beginPath(); c.arc(x,y-s*.6,s*1.25,0,Math.PI*2); c.fill();c.stroke(); }
  if (b.design && b.design!=='klassisch') { c.fillStyle=b.design==='royal'?'#ffd67a':b.design==='polar'?'#e1ffff':'#efb48b'; c.font='bold 12px sans-serif';c.textAlign='center';c.fillText(b.design==='royal'?'♛':b.design==='polar'?'❄':'◆',x,y-s*1.25); }
  if (rueckstoss>.3) {
    const x0=x+Math.cos(a)*s*.95, y0=y-s*.55-Math.sin(a)*s*.95;
    c.save();c.translate(x0,y0);c.rotate(-a);c.fillStyle=KLANGFARBEN[b.waffe];c.beginPath();c.moveTo(0,-4);c.lineTo(16*rueckstoss,-7*rueckstoss);c.lineTo(10*rueckstoss,0);c.lineTo(19*rueckstoss,5*rueckstoss);c.lineTo(0,4);c.closePath();c.fill();c.restore();
  }
  // Lebensbalken über dem Bro
  const bw = s * 1.5, by = y - s * 1.65;
  c.fillStyle = '#0a1424cc'; c.beginPath(); c.roundRect(x - bw / 2, by, bw, 5, 3); c.fill();
  c.fillStyle = b.farbe; c.beginPath(); c.roundRect(x - bw / 2, by, (bw * b.lp) / R.lebenspunkte, 5, 3); c.fill();
  c.font = `bold ${Math.max(10, s * .32)}px Nunito, sans-serif`; c.textAlign = 'center'; c.fillStyle = '#e8f1fb';
  c.fillText(`${b.name} · ${b.lp}`, x, by - 4);
  if (amZug) {
    // Goldene Raute wie die Zielmarken des Bauspiels
    const ry = by - s * .55;
    c.fillStyle = GOLD; c.beginPath(); c.moveTo(x, ry + 8); c.lineTo(x + 6, ry); c.lineTo(x, ry - 8); c.lineTo(x - 6, ry); c.closePath(); c.fill();
  }
}

function windfahne(c: CanvasRenderingContext2D, w: number, wind: number): void {
  const x = w / 2, y = 20, l = 18 + Math.abs(wind) * 6, r = Math.sign(wind) || 1;
  c.save();
  c.fillStyle = '#0e2038d9'; c.strokeStyle = '#d4b16a99'; c.lineWidth = 1;
  c.beginPath(); c.roundRect(x - 92, y - 12, 184, 48, 14); c.fill(); c.stroke();
  c.strokeStyle = '#c7d6e6'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x, y + 30); c.stroke();
  if (wind !== 0) {
    c.fillStyle = GOLD; c.beginPath(); c.moveTo(x, y - 4);
    c.bezierCurveTo(x + r * l * .4, y - 7, x + r * l * .7, y + 2, x + r * l, y + 3);
    c.bezierCurveTo(x + r * l * .7, y + 8, x + r * l * .4, y + 14, x, y + 10); c.closePath(); c.fill();
  }
  c.fillStyle = '#ffe9b6'; c.font = 'bold 13px Nunito, sans-serif'; c.textAlign = 'center';
  c.fillText(wind === 0 ? 'WINDSTILL' : `WIND ${wind < 0 ? '◀' : ''} ${Math.abs(wind)} ${wind > 0 ? '▶' : ''}`, x - r * 42 * (wind === 0 ? 0 : 1), y + 30);
  c.restore();
}

/** Ein ganzes Bild der Bühne. Gibt false zurück, wenn es (noch) nichts zu zeichnen gab. */
export function zeichneBuehne(canvas: HTMLCanvasElement, bild: Buehnenbild): boolean {
  const breite = canvas.clientWidth, hoehe = canvas.clientHeight;
  if (!breite || !hoehe) return false;
  const w = SCHLACHTFELD.breite, h = SCHLACHTFELD.hoehe;
  const rahmen = bildEinpassen(breite, hoehe);
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const pw = Math.round(breite * dpr), ph = Math.round(hoehe * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const c = canvas.getContext('2d'); if (!c) return false;
  let p = puffer.get(canvas);
  if (!p || p.w !== pw || p.h !== ph) { p = { w: pw, h: ph }; puffer.set(canvas, p); }

  const skala = w / (ANSICHT.rechts - ANSICHT.links);
  const mx = (x: number): number => (x - ANSICHT.links) * skala;
  const my = (y: number): number => h - (y - ANSICHT.unten) * skala;

  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = "#0b1424"; c.fillRect(0, 0, pw, ph);
  c.setTransform(dpr * rahmen.faktor, 0, 0, dpr * rahmen.faktor, rahmen.x * dpr, rahmen.y * dpr);
  if (!p.himmel) p.himmel = himmelZeichnen(w, h) ?? undefined;
  if (p.himmel) c.drawImage(p.himmel, 0, 0, w, h); else { c.fillStyle = '#111c2b'; c.fillRect(0, 0, w, h); }
  const welt = WELTEN[bild.karte ?? 0] ?? WELTEN[0];
  let hintergrund = hintergruende.get(welt.bild);
  if (!hintergrund) { hintergrund = new Image(); hintergrund.src = welt.bild; hintergruende.set(welt.bild, hintergrund); }
  if (hintergrund.complete && hintergrund.naturalWidth) { c.drawImage(hintergrund, 0, 0, w, h); c.fillStyle = '#07142a44'; c.fillRect(0, 0, w, h); }

  if (bild.wackeln > 0 && !bild.ruhe) c.translate((Math.random() - .5) * bild.wackeln * 8, (Math.random() - .5) * bild.wackeln * 6);

  if (p.inselSchluessel !== `${bild.karte}-${bild.gelaendeSchluessel}`) {
    // Die Insel wird in Bildschirm-Pixeln gerastert; ändert sich nur bei einem Einschlag oder der Größe.
    const insel = leinwand(w, h);
    if (insel) {
      const ic = insel.getContext('2d')!; ic.setTransform(1, 0, 0, 1, 0, 0);
      const quelle = inselZeichnen(w, h, bild.gelaende, mx, my, skala, welt);
      if (quelle) ic.drawImage(quelle, 0, 0);
      p.insel = insel; p.inselSchluessel = `${bild.karte}-${bild.gelaendeSchluessel}`;
    }
  }
  if (p.insel) c.drawImage(p.insel, 0, 0, w, h);

  // Bros
  const s = SCHLACHTFELD.panzerBreite / 1.7;
  let winkel = neigungen.get(canvas);
  if (!winkel) { winkel = new Map(); neigungen.set(canvas, winkel); }
  for (const b of bild.bros) {
    if (b.raus && b.y <= bild.meer) {
      // Rettungsring auf dem Wasser
      const x = mx(Math.max(0, Math.min(R.breite, b.x))), y = my(bild.meer);
      c.lineWidth = Math.max(3, s * .18); c.strokeStyle = '#ff6f6f'; c.beginPath(); c.arc(x, y, s * .4, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#ffffff'; c.setLineDash([s * .3, s * .3]); c.beginPath(); c.arc(x, y, s * .4, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      continue;
    }
    const halb = SCHLACHTFELD.panzerBreite / skala / 2;
    const ziel = Math.max(-.6, Math.min(.6, -Math.atan2(hoeheBei(bild.gelaende, b.x + halb) - hoeheBei(bild.gelaende, b.x - halb), halb * 2)));
    const alt = winkel.get(b.id) ?? ziel;
    const neu = bild.ruhe ? ziel : alt + (ziel - alt) * .18;
    winkel.set(b.id, neu);
    bro(c, b, mx(b.x), my(b.y), s, b.id === bild.amZug && !bild.flug, neu, !bild.ruhe && b.id===bild.amZug && bild.flug ? Math.max(0,1-bild.flug.t/.28) : 0);
  }

  // Zielhilfe: gestrichelter Strahl in Rohrrichtung, Länge = Stärke. Bewusst NICHT die Bahn.
  const schuetze = bild.bros.find(b => b.id === bild.amZug);
  if (bild.zielen && schuetze && !schuetze.raus) {
    const a = (schuetze.winkel * Math.PI) / 180, x0 = mx(schuetze.x) + Math.cos(a) * s * .95, y0 = my(schuetze.y) - s * .55 - Math.sin(a) * s * .95;
    const l = s * .6 + (schuetze.staerke / 100) * s * 4.5;
    c.strokeStyle = `${schuetze.farbe}cc`; c.lineWidth = 2; c.setLineDash([5, 6]);
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * l, y0 - Math.sin(a) * l); c.stroke(); c.setLineDash([]);
    c.fillStyle = GOLD; c.beginPath(); c.arc(x0 + Math.cos(a) * l, y0 - Math.sin(a) * l, 4, 0, Math.PI * 2); c.fill();
  }

  // Flug: Geschosse mit kurzer, ausblendender Spur; oben aus dem Bild zeigt ein Pfeil am Rand.
  if (bild.flug) {
    const { bahn, t } = bild.flug;
    for (const teil of bahn.teile) {
      const i = Math.floor((t - teil.t0) / R.schritt);
      if (i < 0) continue;
      const ende = Math.min(teil.punkte.length - 1, i);
      if (i > teil.punkte.length - 1 + 6) continue;
      for (let k = Math.max(0, ende - 12 * 3); k < ende; k += 3) {
        const [x, y] = teil.punkte[k];
        c.fillStyle = KLANGFARBEN[teil.waffe]; c.globalAlpha=Math.max(0,(k-(ende-36))/36*.65);
        if ([2,4,6].includes(teil.waffe)) c.fillRect(mx(x)-2,my(y)-2,4,4);
        else { c.beginPath(); c.arc(mx(x),my(y),teil.waffe===8?4:teil.waffe===9?3.2:2.2,0,Math.PI*2);c.fill(); }
        c.globalAlpha=1;
      }
      if (i > teil.punkte.length - 1) continue;
      const [x, y] = teil.punkte[ende], [vx, vy] = teil.punkte[Math.max(0, ende - 1)];
      const px = mx(x), py = my(y);
      if (py < 0) {
        c.fillStyle = GOLD; c.beginPath(); c.moveTo(px, 4); c.lineTo(px + 7, 16); c.lineTo(px - 7, 16); c.closePath(); c.fill();
        c.font = 'bold 11px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText(`${Math.round(y)} m`, px, 30);
      } else geschoss(c, teil.waffe, px, py, s, Math.atan2(-(y - vy), x - vx));
    }
    // Lichterkette: Funken fallen kurz vor ihrem Einschlag senkrecht herab.
    for (const e of bahn.einschlaege) {
      if (e.waffe !== 7 || t < e.t - .25 || t > e.t) continue;
      const f = 1 - (e.t - t) / .25;
      c.fillStyle = GOLD; c.beginPath(); c.arc(mx(e.sx), my(e.sy + 6 * (1 - f)), 4, 0, Math.PI * 2); c.fill();
    }
  }

  // Meer vor der Insel: zwei Wellenlinien mit Versatz, Schaum oben; steigt mit der Flut.
  const meerY = my(bild.meer), welle = bild.ruhe ? 0 : bild.jetzt / 900;
  const mg = c.createLinearGradient(0, meerY, 0, h); mg.addColorStop(0, '#1f6f8bcc'); mg.addColorStop(1, '#0a2238f2');
  c.fillStyle = mg; c.beginPath(); c.moveTo(0, meerY);
  for (let x = 0; x <= w; x += 12) c.lineTo(x, meerY + Math.sin(x / 28 + welle) * 2.5);
  c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
  for (const [versatz, farbe] of [[0, '#d8f6ffaa'], [7, '#9fd8ec55']] as const) {
    c.strokeStyle = farbe; c.lineWidth = 2; c.beginPath();
    for (let x = 0; x <= w; x += 12) { const y = meerY + versatz + Math.sin(x / 28 + welle + versatz) * 2.5; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  }

  // Einschläge, Schneewehen und aufsteigende Schadenszahlen
  for (const e of bild.effekte) {
    const alter = (bild.jetzt - e.seit) / 1000;
    if (e.art === 'ring') {
      if (alter > .7) continue;
      const f = alter / .7;
      c.globalAlpha=1-f; c.strokeStyle=KLANGFARBEN[e.waffe??0]; c.lineWidth=e.waffe===8?6:3;
      c.beginPath(); c.arc(mx(e.x), my(e.y), (e.r * .6 + f * e.r * 1.4) * skala, 0, Math.PI * 2); c.stroke();
      c.globalAlpha=1;
      c.fillStyle = `rgba(238,248,255,${(.8 * (1 - f)).toFixed(2)})`; c.font = `${Math.round(16 + f * 10)}px Nunito, sans-serif`; c.textAlign = 'center';
      (e.waffe===8?['❄','✦','❄']:e.waffe===9?['◌','◯','◌']:e.waffe===4?['◆','◆','◆']:['✦','◆','✧']).forEach((z, i) => c.fillText(z, mx(e.x) + (i - 1) * (14 + f * 30), my(e.y) - 10 - f * 30 * (i === 1 ? 1.4 : 1)));
    } else if (e.art === 'wehe') {
      if (alter > .6) continue;
      const f = Math.min(1, alter / .4);
      c.fillStyle = `rgba(244,251,255,${(1 - alter / .6).toFixed(2)})`;
      for (const [dx, rr] of [[-1, .6], [0, .8], [1, .6]]) { c.beginPath(); c.arc(mx(e.x + dx), my(e.y), rr * f * skala, 0, Math.PI * 2); c.fill(); }
    } else {
      if (alter > 1.4) continue;
      const y = my(e.y) - s * 2 - alter * 40;
      c.globalAlpha = Math.max(0, 1 - Math.max(0, alter - .9) / .5);
      c.font = `900 ${Math.round(s * .9)}px Nunito, sans-serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#0a1424';
      c.strokeText(e.text, mx(e.x), y); c.fillStyle = e.farbe; c.fillText(e.text, mx(e.x), y);
      c.globalAlpha = 1;
    }
  }

  c.setTransform(dpr * rahmen.faktor, 0, 0, dpr * rahmen.faktor, rahmen.x * dpr, rahmen.y * dpr);
  windfahne(c, w, bild.wind);
  return true;
}
