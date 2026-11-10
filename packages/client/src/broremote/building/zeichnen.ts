import { REGELN, ZAUBER, zellen, type BauForm } from '@brauweg/building-kern';
import type { BahnSicht } from './partie';
import { kameraBedarf, kameraSchritt, type BauKamera } from './kamera';

import { BAUFARBEN } from './material';

const kameras = new WeakMap<HTMLCanvasElement, BauKamera>();
const kacheln = new Map<string, HTMLCanvasElement>();
const formen = new Map(Object.keys(BAUFARBEN).map(f => [f as BauForm, zellen(f as BauForm)]));
let insel: HTMLImageElement | undefined;
export function setzeBaukameraZurueck(canvas: HTMLCanvasElement): void { kameras.delete(canvas); }

/** Beleuchtung, Holzmaserung und Beschläge werden einmal gerastert, nicht
 * für jeden Baustein in jedem Bild. Wenige gemeinsam genutzte Texturen für alle vier Bahnen. */
function kachel(form: BauForm, schwer: boolean, eis: boolean, stein: boolean): HTMLCanvasElement {
  const schluessel = `${stein ? 'stein' : eis ? 'eis' : schwer ? 'schwer' : form}-${schwer}`;
  const vorhanden = kacheln.get(schluessel); if (vorhanden) return vorhanden;
  const bild = document.createElement('canvas'); bild.width = bild.height = 96;
  const c = bild.getContext('2d')!;
  const [hell, dunkel, glanz] = stein ? ['#b1abcb', '#504b69', '#eae2ff'] : eis ? ['#94e0ed', '#28677f', '#e3fcff'] : schwer ? ['#c3a1e9', '#443356', '#f0ddff'] : BAUFARBEN[form];
  c.fillStyle = '#111c2b'; c.beginPath(); c.roundRect(1, 1, 94, 94, 9); c.fill();
  const g = c.createLinearGradient(0, 0, 96, 96); g.addColorStop(0, glanz); g.addColorStop(.18, hell); g.addColorStop(.8, dunkel); g.addColorStop(1, '#243044');
  c.fillStyle = g; c.beginPath(); c.roundRect(3, 3, 90, 89, 7); c.fill();
  c.fillStyle = hell; c.beginPath(); c.roundRect(12, 13, 72, 66, 3); c.fill();
  c.strokeStyle = '#fff4cf30'; c.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    c.beginPath(); c.moveTo(16, 23 + i * 11); c.bezierCurveTo(38, 17 + i * 11, 58, 28 + i * 11, 80, 22 + i * 11); c.stroke();
  }
  c.strokeStyle = glanz; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 10); c.lineTo(86, 10); c.stroke();
  c.strokeStyle = '#14223766'; c.lineWidth = 3; c.strokeRect(12, 13, 72, 66);
  c.fillStyle = '#e9c785';
  for (const [x, y] of [[8, 8], [88, 8], [8, 87], [88, 87]]) { c.beginPath(); c.arc(x, y, 2, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#fff6d577'; c.lineWidth = 2; c.beginPath(); c.moveTo(48, 34); c.lineTo(58, 46); c.lineTo(48, 58); c.lineTo(38, 46); c.closePath(); c.stroke();
  if (schwer) { c.strokeStyle = '#393146aa'; c.lineWidth = 10; c.beginPath(); c.moveTo(16, 16); c.lineTo(80, 80); c.moveTo(80, 16); c.lineTo(16, 80); c.stroke(); }
  if (eis) {
    c.strokeStyle = '#e4ffff'; c.lineWidth = 3; c.beginPath();
    c.moveTo(48, 25); c.lineTo(48, 70); c.moveTo(28, 36); c.lineTo(68, 59); c.moveTo(28, 59); c.lineTo(68, 36); c.stroke();
  } else if (stein) {
    c.strokeStyle = '#655c81'; c.lineWidth = 3; c.beginPath(); c.moveTo(12, 35); c.lineTo(36, 35); c.lineTo(36, 13); c.moveTo(60, 79); c.lineTo(60, 60); c.lineTo(83, 60); c.stroke();
  }
  kacheln.set(schluessel, bild); return bild;
}

export function zeichneBahn(canvas: HTMLCanvasElement, bahn: BahnSicht, ziel: boolean, sekunden = 1 / 30, ruhe = false): void {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const c = canvas.getContext('2d'); if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  if (!insel) { insel = new Image(); insel.src = '/broremote/bauinsel.webp'; }
  // Platz für den nächsten Spawn früh vorbereiten. Danach schrumpft der
  // Ausschnitt bis zur nächsten Runde nie, auch wenn der Turm ganz einstürzt.
  const aktiv = bahn.steine.find(s => s.aktiv);
  const benoetigt = kameraBedarf(bahn.hoehe, aktiv?.y, ziel);
  const kamera = kameraSchritt(kameras.get(canvas), benoetigt, sekunden, ruhe); kameras.set(canvas, kamera);
  const oben = kamera.oben, boden = h - 82, skala = Math.min((w - 36) / 16, (boden - 26) / oben), x = w / 2;
  const py = (y: number): number => boden - y * skala;

  // Eine feine Messlatte hält das Feld frei; nur die Zielhöhe zieht sich
  // vollständig über die Bühne. Die Höhe bleibt auch beim Zoomen eindeutig.
  c.font = '10px Nunito, sans-serif'; c.textAlign = 'left';
  for (let y = 4; y < oben; y += 4) {
    c.strokeStyle = '#adcce550'; c.lineWidth = 1; c.beginPath(); c.moveTo(13, py(y)); c.lineTo(23, py(y)); c.stroke();
    c.fillStyle = '#a4bed0'; c.fillText(`${y}`, 13, py(y) - 7);
  }
  if (ziel) {
    const yy = py(REGELN.ziel);
    const g = c.createLinearGradient(0, yy - 18, 0, yy + 22); g.addColorStop(0, '#ffd67a00'); g.addColorStop(.5, '#ffd67a16'); g.addColorStop(1, '#ffd67a00');
    c.fillStyle = g; c.fillRect(30, yy - 18, w - 60, 40);
    c.strokeStyle = '#ffdf88ba'; c.lineWidth = 1; c.setLineDash([4, 7]); c.beginPath(); c.moveTo(33, yy); c.lineTo(w - 33, yy); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ffd98a';
    for (const xx of [30, w - 30]) { c.beginPath(); c.moveTo(xx, yy - 5); c.lineTo(xx + 4, yy); c.lineTo(xx, yy + 5); c.lineTo(xx - 4, yy); c.closePath(); c.fill(); }
    c.font = 'bold 11px Nunito, sans-serif'; c.textAlign = 'right'; c.fillText('ZIEL · 16 m', w - 35, yy - 9); c.textAlign = 'left';
  }
  if (aktiv) {
    const xx = x + aktiv.x * skala, yy = Math.max(0, py(aktiv.y));
    const g = c.createLinearGradient(0, yy, 0, boden); g.addColorStop(0, `${bahn.farbe}22`); g.addColorStop(1, `${bahn.farbe}00`);
    c.fillStyle = g; c.fillRect(xx - skala * 1.8, yy, skala * 3.6, Math.max(0, boden - yy));
    if (py(aktiv.y) < 5) { c.fillStyle = bahn.farbe; c.font = 'bold 11px Nunito, sans-serif'; c.textAlign = 'center'; c.fillText('↓ Nachschub', Math.max(55, Math.min(w - 55, xx)), 18); c.textAlign = 'left'; }
  }

  const halb = REGELN.bodenHalb * skala;
  if (insel.complete && insel.naturalWidth) {
    // Gelieferter Balken: x=80..1456, Baukante y=366 im 1536×1024-Original.
    const breite = halb * 2 * 1536 / 1376, hoehe = breite * 1024 / 1536;
    c.drawImage(insel, x - breite / 2, boden - hoehe * 366 / 1024, breite, hoehe);
  } else {
    c.fillStyle = '#65462e'; c.fillRect(x - halb, boden, halb * 2, 12);
  }
  c.fillStyle = bahn.farbe; c.globalAlpha = .65; c.fillRect(x - halb + 4, boden, halb * 2 - 8, 2); c.globalAlpha = 1;

  // Der Steg ist ein fester Körper. Die Vorschau markiert freie und belegte Stellen.
  for (const p of [...bahn.plattformen, ...(bahn.platzierung ? [bahn.platzierung] : [])]) {
    const vorschau = 'gueltig' in p, frei = !vorschau || p.gueltig;
    const xx = x + p.x * skala, yy = py(p.y), breite = ZAUBER.plattformHalb * 2 * skala, hoch = Math.max(5, ZAUBER.plattformHoehe * 2 * skala);
    c.save(); c.globalAlpha = vorschau ? .75 : 1;
    c.fillStyle = vorschau ? frei ? '#7bffc655' : '#ff7f8f55' : '#775534';
    c.strokeStyle = vorschau ? frei ? '#aaffdb' : '#ff8c9f' : '#f5d486'; c.lineWidth = 2;
    if (vorschau) c.setLineDash([4, 3]);
    c.beginPath(); c.roundRect(xx - breite / 2, yy - hoch / 2, breite, hoch, 2); c.fill(); c.stroke(); c.setLineDash([]);
    if (!vorschau) {
      c.beginPath(); c.moveTo(xx - breite * .35, yy + hoch / 2); c.lineTo(xx, yy + hoch / 2 + 10); c.lineTo(xx + breite * .35, yy + hoch / 2); c.stroke();
      c.fillStyle = '#a8f6ec'; c.beginPath(); c.moveTo(xx, yy + 2); c.lineTo(xx + 4, yy + 6); c.lineTo(xx, yy + 10); c.lineTo(xx - 4, yy + 6); c.closePath(); c.fill();
    } else {
      c.fillStyle = frei ? '#c7ffe6' : '#ffc1cb'; c.font = 'bold 11px Nunito, sans-serif'; c.textAlign = 'center';
      c.fillText(frei ? `Platzieren · ${bahn.platzierung!.rest} s` : 'Stelle belegt', Math.max(60, Math.min(w - 60, xx)), yy - 14);
    }
    c.restore();
  }

  // Ein sanfter Schutzsaum bleibt unter den Bauteilen, nicht vor ihnen.
  if (bahn.anker > 0) {
    const g = c.createRadialGradient(x, boden - 20, 4, x, boden - 20, Math.max(1, halb * 1.8)); g.addColorStop(0, '#79ffe32c'); g.addColorStop(1, '#79ffe300');
    c.fillStyle = g; c.fillRect(x - halb * 2, boden - halb * 2, halb * 4, halb * 3);
  }
  for (const s of bahn.steine) {
    c.save(); c.translate(x + s.x * skala, py(s.y)); c.rotate(-s.winkel);
    const bild = kachel(s.form, s.schwer, s.eis, s.stein);
    for (const z of formen.get(s.form)!) c.drawImage(bild, (z.x - .49) * skala, (-z.y - .49) * skala, .98 * skala, .98 * skala);
    if (s.aktiv) {
      c.strokeStyle = `${bahn.farbe}bb`; c.lineWidth = 1;
      for (const z of formen.get(s.form)!) c.strokeRect((z.x - .5) * skala, (-z.y - .5) * skala, skala, skala);
    }
    c.restore();
  }
}
