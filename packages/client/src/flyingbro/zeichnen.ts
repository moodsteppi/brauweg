/**
 * Flying Bro: ein Bild der Partie auf eine Canvas-2D-Fläche.
 *
 * Canvas 2D und nicht WebGL: rund 60 Körper mit je einem Bild sind für die
 * 2D-Fläche nichts, und ein verlorener WebGL-Kontext („Context Lost", siehe
 * CLAUDE.md beim Runner) wäre hier ein leerer Bildschirm mitten im Flug.
 *
 * Liest die Partie nur — gezeichnet wird, was die Physik sagt.
 */

import { BRO_WERTE, type Bro, FAEHIGKEITEN, GIRAFFEN_WERTE, type GiraffenGroesse, RISS_STUFEN, type Stoff, type Teil } from '@brauweg/flyingbro-kern';

import type { BildName, Bilder } from './bilder';
import { type Kamera, aufBild, hintergrundLage } from './kamera';
import { ABGANG_S, type FliegenderBro, type Partie } from './partie';
import type { Vek } from './zielen';

const GIRAFFEN_BILD: Record<GiraffenGroesse, 'klein' | 'mittel' | 'gross'> = { kalb: 'klein', giraffe: 'mittel', langhals: 'gross' };

/** Ersatzfarben, falls ein Bild nicht lädt — und die Farbe der Splitter. */
const STOFF_FARBE: Record<Stoff, string> = { glas: '#a9dcf0', holz: '#b07a45', stein: '#8d9095' };

/** Schleuderbild 512 × 468: Die Ringe des Bands sitzen bei 42 % und 58 % der Breite, 14 % von oben. */
const SCHLEUDER_SEITEN = 512 / 468;
const RING_LINKS = 0.42;
const RING_RECHTS = 0.58;
const RING_OBEN = 0.14;

export interface Zielbild {
  /** Wohin der Bro im Band gezogen ist (Welt, relativ zum Abschusspunkt). */
  versatz: Vek;
  /** Vorschaupunkte (Welt); leer, solange der Zug zu kurz ist. */
  punkte: Vek[];
}

function bild(b: Bilder, n: BildName): HTMLImageElement | undefined {
  return b[n];
}

/** Ein Bild mittig um (0, 0), b × h Pixel. */
function mittig(ctx: CanvasRenderingContext2D, img: HTMLImageElement | undefined, b: number, h: number, ersatz: string): void {
  if (img) ctx.drawImage(img, -b / 2, -h / 2, b, h);
  else {
    ctx.fillStyle = ersatz;
    ctx.fillRect(-b / 2, -h / 2, b, h);
  }
}

export function zeichneHintergrund(ctx: CanvasRenderingContext2D, bilder: Bilder, breite: number, hoehe: number): void {
  // Himmelsfarbe für den Streifen über dem Bild (hoher, schmaler Bildschirm).
  ctx.fillStyle = '#9fd3f2';
  ctx.fillRect(0, 0, breite, hoehe);
  const h = bild(bilder, 'hintergrund');
  if (h) {
    const l = hintergrundLage(breite, hoehe);
    ctx.drawImage(h, l.x, l.y, l.b, l.h);
  } else {
    ctx.fillStyle = '#7cbf5a';
    ctx.fillRect(0, hoehe * 0.8, breite, hoehe * 0.2);
  }
}

function teilBild(stoff: Stoff, quadrat: boolean, anteil: number): BildName {
  // Zwei Bilder für drei Rissstufen: ab der ersten Stufe angeknackst; die
  // zweite dunkelt zusätzlich ab (zeichneTeil).
  return `${stoff}-${quadrat ? 'quadrat' : 'balken'}-${anteil < RISS_STUFEN[0] ? 'angeknackst' : 'heil'}` as BildName;
}

function zeichneTeil(ctx: CanvasRenderingContext2D, k: Kamera, bilder: Bilder, def: Teil, lage: { x: number; y: number; w: number }, anteil: number): void {
  const p = aufBild(k, lage);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-lage.w);
  if (def.form === 'quader') {
    const b = def.b * k.s;
    const h = def.h * k.s;
    const seiten = def.b / def.h;
    if (seiten >= 0.5 && seiten <= 2) mittig(ctx, bild(bilder, teilBild(def.stoff, true, anteil)), b, h, STOFF_FARBE[def.stoff]);
    else if (seiten > 2) mittig(ctx, bild(bilder, teilBild(def.stoff, false, anteil)), b, h, STOFF_FARBE[def.stoff]);
    else {
      // Stehender Balken: das liegende Bild um 90° gedreht, nicht gestaucht.
      ctx.rotate(Math.PI / 2);
      mittig(ctx, bild(bilder, teilBild(def.stoff, false, anteil)), h, b, STOFF_FARBE[def.stoff]);
      ctx.rotate(-Math.PI / 2);
    }
    if (anteil < RISS_STUFEN[1]) {
      ctx.fillStyle = 'rgba(30, 20, 10, 0.28)';
      ctx.fillRect(-b / 2, -h / 2, b, h);
    }
  } else {
    // Dreieck und Kreis: das Quadratbild in die Form geschnitten.
    const b = (def.form === 'kreis' ? def.r * 2 : def.b) * k.s;
    const h = (def.form === 'kreis' ? def.r * 2 : def.h) * k.s;
    ctx.beginPath();
    if (def.form === 'kreis') ctx.arc(0, 0, b / 2, 0, Math.PI * 2);
    else {
      ctx.moveTo(-b / 2, h / 2);
      ctx.lineTo(b / 2, h / 2);
      ctx.lineTo(0, -h / 2);
      ctx.closePath();
    }
    ctx.save();
    ctx.clip();
    mittig(ctx, bild(bilder, teilBild(def.stoff, true, anteil)), b, h, STOFF_FARBE[def.stoff]);
    if (anteil < RISS_STUFEN[1]) {
      ctx.fillStyle = 'rgba(30, 20, 10, 0.28)';
      ctx.fillRect(-b / 2, -h / 2, b, h);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(40, 30, 20, 0.45)';
    ctx.lineWidth = Math.max(1, k.s * 0.03);
    ctx.stroke();
  }
  ctx.restore();
}

/** Giraffe stehend (Fußpunkt unten Mitte); der Kopf schaut im Bild nach links. */
function zeichneGiraffe(
  ctx: CanvasRenderingContext2D,
  k: Kamera,
  bilder: Bilder,
  groesse: GiraffenGroesse,
  blick: 'links' | 'rechts',
  lage: { x: number; y: number; w: number },
  getroffen: boolean,
  alpha = 1,
): void {
  const w = GIRAFFEN_WERTE[groesse];
  const img = bild(bilder, `giraffe-${GIRAFFEN_BILD[groesse]}-${getroffen ? 'getroffen' : 'steht'}` as BildName);
  const h = w.hoehe * k.s;
  const b = img ? (h * img.naturalWidth) / img.naturalHeight : w.rumpfBreite * k.s;
  const p = aufBild(k, lage);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(-lage.w);
  if (blick === 'rechts') ctx.scale(-1, 1);
  if (img) ctx.drawImage(img, -b / 2, -h, b, h);
  else {
    ctx.fillStyle = '#e8b04a';
    ctx.fillRect(-b / 2, -h, b, h);
  }
  ctx.restore();
}

function schleuderMasse(k: Kamera, partie: Partie): { hoehe: number; breite: number; ringL: Vek; ringR: Vek; fuss: Vek } {
  const ab = partie.abschussPunkt();
  // So hoch, dass die Ringe genau am Abschusspunkt sitzen.
  const hoeheM = (ab.y - partie.level.boden) / (1 - RING_OBEN);
  const breiteM = hoeheM * SCHLEUDER_SEITEN;
  const fuss = { x: ab.x, y: partie.level.boden };
  return {
    hoehe: hoeheM * k.s,
    breite: breiteM * k.s,
    ringL: aufBild(k, { x: ab.x + (RING_LINKS - 0.5) * breiteM, y: ab.y }),
    ringR: aufBild(k, { x: ab.x + (RING_RECHTS - 0.5) * breiteM, y: ab.y }),
    fuss: aufBild(k, fuss),
  };
}

function band(ctx: CanvasRenderingContext2D, von: Vek, bis: Vek, s: number): void {
  ctx.strokeStyle = '#5a2e14';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(von.x, von.y);
  ctx.lineTo(bis.x, bis.y);
  ctx.stroke();
}

function zeichneBroRuhe(ctx: CanvasRenderingContext2D, k: Kamera, bilder: Bilder, art: Bro, p: Vek, hoeheM: number): void {
  const img = bild(bilder, `bro-${art}-ruhe` as BildName);
  const h = hoeheM * k.s;
  const b = img ? (h * img.naturalWidth) / img.naturalHeight : h;
  const q = aufBild(k, p);
  ctx.save();
  ctx.translate(q.x, q.y);
  if (img) ctx.drawImage(img, -b / 2, -h, b, h);
  else {
    ctx.fillStyle = '#e05a3a';
    ctx.beginPath();
    ctx.arc(0, -h / 2, h / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function zeichneFliegenden(ctx: CanvasRenderingContext2D, k: Kamera, bilder: Bilder, b: FliegenderBro): void {
  const p = b.koerper.translation();
  const v = b.koerper.linvel();
  const q = aufBild(k, p);
  const w = BRO_WERTE[b.art];
  ctx.save();
  ctx.translate(q.x, q.y);
  let name: BildName;
  let breiteM: number;
  if (b.form === 'rutsch') {
    name = 'bro-pelle-rutsch';
    breiteM = FAEHIGKEITEN.bauchrutscher.breite * 1.15;
  } else if (b.form === 'gleit') {
    name = 'bro-malve-gleit';
    breiteM = w.radius * 2 * 1.9;
  } else if (b.form === 'eis') {
    name = 'bro-tjark-eisblock';
    breiteM = FAEHIGKEITEN.eisblock.kante * 1.05;
  } else {
    name = `bro-${b.art}-flug` as BildName;
    breiteM = w.radius * 2 * 1.45;
  }
  const img = bild(bilder, name);
  const bw = breiteM * k.s;
  const bh = img ? (bw * img.naturalHeight) / img.naturalWidth : bw;
  if (b.form === 'eis') ctx.rotate(-b.koerper.rotation());
  else if (!b.kontakt || b.form === 'gleit') {
    // In der Luft schaut er in Flugrichtung — ein rollender Pinguin sähe nach Fehler aus.
    const winkel = Math.atan2(v.y, Math.abs(v.x));
    if (v.x < 0) ctx.scale(-1, 1);
    ctx.rotate(-winkel * 0.8);
  } else if (b.form === 'kreis') ctx.rotate(-b.koerper.rotation());
  else if (v.x < 0) ctx.scale(-1, 1);
  if (img) ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
  else {
    ctx.fillStyle = '#e05a3a';
    ctx.beginPath();
    ctx.arc(0, 0, bw / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Das ganze Bild einer Partie. */
export function zeichne(ctx: CanvasRenderingContext2D, partie: Partie, k: Kamera, bilder: Bilder, breite: number, hoehe: number, ziel: Zielbild | null): void {
  zeichneHintergrund(ctx, bilder, breite, hoehe);
  const s = k.s;

  // Spur des fliegenden Bros: weiße Punkte, wie man sie aus dem Genre kennt.
  if (partie.bro) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const p of partie.bro.spur) {
      const q = aufBild(k, p);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1.5, s * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Schleuder: hinteres Band, Bro, vorderes Band — so liegt der Bro im Band.
  const sm = schleuderMasse(k, partie);
  const schleuderBild = bild(bilder, 'schleuder');
  const imBand = partie.imBand();
  const ab = partie.abschussPunkt();
  const broPunkt = { x: ab.x + (ziel?.versatz.x ?? 0), y: ab.y + (ziel?.versatz.y ?? 0) };
  const broBild = aufBild(k, broPunkt);
  if (imBand) band(ctx, sm.ringR, broBild, s);
  if (schleuderBild) ctx.drawImage(schleuderBild, sm.fuss.x - sm.breite / 2, sm.fuss.y - sm.hoehe, sm.breite, sm.hoehe);
  if (imBand) {
    const r = BRO_WERTE[imBand].radius * 2.3;
    zeichneBroRuhe(ctx, k, bilder, imBand, { x: broPunkt.x, y: broPunkt.y - r / 2 }, r);
    band(ctx, sm.ringL, broBild, s);
  }

  // Die übrigen Bros warten links neben der Schleuder (Spezifikation, Schritt 1).
  partie.wartend().forEach((art, i) => {
    zeichneBroRuhe(ctx, k, bilder, art, { x: ab.x - 0.9 - i * 0.65, y: partie.level.boden }, BRO_WERTE[art].radius * 2.2);
  });

  // Vorschau: die ersten Zehntelsekunden der Bahn, nach hinten kleiner.
  if (ziel && ziel.punkte.length > 0) {
    ziel.punkte.forEach((p, i) => {
      const q = aufBild(k, p);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(2, s * (0.1 - i * 0.004)), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  for (const t of partie.teile) {
    if (!t.koerper) continue;
    const p = t.koerper.translation();
    zeichneTeil(ctx, k, bilder, t.def, { x: p.x, y: p.y, w: t.koerper.rotation() }, t.haltbarkeit / t.max);
  }

  for (const g of partie.giraffen) {
    if (g.koerper) {
      const p = g.koerper.translation();
      // Getroffen sieht sie aus, sobald sie Schaden genommen hat.
      zeichneGiraffe(ctx, k, bilder, g.def.groesse, g.def.blick, { x: p.x, y: p.y, w: g.koerper.rotation() }, g.haltbarkeit < GIRAFFEN_WERTE[g.def.groesse].haltbarkeit);
    } else if (g.abgang && g.abgang.t < ABGANG_S) {
      // Umgefallen: kurz liegen, dann aufrappeln und beleidigt aus dem Bild trotten.
      const a = g.abgang;
      const liegen = 0.5;
      const w = a.t < liegen ? a.winkel : 0;
      const lauf = Math.max(0, a.t - liegen);
      const x = a.x + lauf * 3;
      const hopsen = Math.abs(Math.sin(lauf * 9)) * 0.08;
      zeichneGiraffe(ctx, k, bilder, g.def.groesse, 'rechts', { x, y: a.y + hopsen, w }, true, Math.min(1, (ABGANG_S - a.t) / 0.6));
    }
  }

  if (partie.bro) zeichneFliegenden(ctx, k, bilder, partie.bro);

  for (const sp of partie.splitter) {
    const q = aufBild(k, sp);
    const g = sp.groesse * s;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - sp.t / 1.2);
    ctx.translate(q.x, q.y);
    ctx.rotate(sp.w);
    ctx.fillStyle = STOFF_FARBE[sp.stoff];
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.fillRect(-g / 2, -g / 4, g, g / 2);
    ctx.strokeRect(-g / 2, -g / 4, g, g / 2);
    ctx.restore();
  }

  ctx.font = `800 ${Math.round(Math.max(14, s * 0.55))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  for (const e of partie.einblendungen) {
    const q = aufBild(k, e);
    ctx.globalAlpha = Math.max(0, 1 - e.t / 1.1);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(40, 20, 0, 0.8)';
    ctx.strokeText(e.text, q.x, q.y);
    ctx.fillStyle = '#fff6c2';
    ctx.fillText(e.text, q.x, q.y);
    ctx.globalAlpha = 1;
  }
}
