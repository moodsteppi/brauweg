import { REGELN, zellen, type BauForm } from '@brauweg/building-kern';
import type { BahnSicht } from './partie';

const farben: Record<BauForm, [string, string, string]> = {
  balken: ['#77e8d4', '#209b9e', '#bcfff0'], quadrat: ['#ffd875', '#bf7b2b', '#fff1b9'],
  treppe: ['#ba9dff', '#7354b6', '#e9dfff'], bogen: ['#fb9eae', '#bd4a72', '#ffe1df'],
  haken: ['#7bbcff', '#3765aa', '#cfeeff'], spiegel: ['#ffb775', '#b9682b', '#ffdfb0'], stufe: ['#a6d87b', '#5a8e4a', '#d7f6af'],
};
export function zeichneBahn(canvas: HTMLCanvasElement, bahn: BahnSicht, ziel: boolean): void {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  // Begrenzte Pixeldichte und 30 Bilder/s halten auch vier Bühnen auf iPhones bezahlbar.
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const c = canvas.getContext('2d'); if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const oben = Math.max(23, ...bahn.steine.map(s => s.y + 3)), skala = Math.min(w / 16, (h - 90) / oben), x = w / 2, boden = h - 70;
  const py = (y: number): number => boden - y * skala;
  c.strokeStyle = '#bedafa15'; c.lineWidth = 1;
  for (let y = 4; y < oben; y += 4) { c.beginPath(); c.moveTo(15, py(y)); c.lineTo(w - 15, py(y)); c.stroke(); c.fillStyle = '#b7cae087'; c.font = '10px sans-serif'; c.fillText(`${y} m`, 9, py(y) - 6); }
  if (ziel) {
    c.strokeStyle = '#ffdd83'; c.setLineDash([7, 6]); c.beginPath(); c.moveTo(6, py(REGELN.ziel)); c.lineTo(w - 6, py(REGELN.ziel)); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ffdd83'; c.font = 'bold 11px sans-serif'; c.textAlign = 'right'; c.fillText('ZIEL 16 m', w - 9, py(REGELN.ziel) - 9); c.textAlign = 'left';
  }
  // Die Fallspur zeigt die Position, ohne eine sichere Landung zu versprechen.
  const aktiv = bahn.steine.find(s => s.aktiv);
  if (aktiv) {
    const xx = x + aktiv.x * skala;
    const g = c.createLinearGradient(0, py(aktiv.y), 0, boden); g.addColorStop(0, `${bahn.farbe}24`); g.addColorStop(1, `${bahn.farbe}03`);
    c.fillStyle = g; c.fillRect(xx - skala * 1.8, py(aktiv.y), skala * 3.6, boden - py(aktiv.y));
  }
  const halb = REGELN.bodenHalb * skala;
  c.save(); c.shadowColor = `${bahn.farbe}55`; c.shadowBlur = 24;
  c.fillStyle = '#48566f'; c.beginPath(); c.moveTo(x - halb, boden); c.lineTo(x + halb, boden); c.lineTo(x + halb * .8, boden + 31); c.lineTo(x + halb * .35, boden + 42); c.lineTo(x, boden + 65); c.lineTo(x - halb * .35, boden + 37); c.lineTo(x - halb * .85, boden + 30); c.closePath(); c.fill(); c.restore();
  c.fillStyle = '#29384e'; c.beginPath(); c.moveTo(x, boden + 9); c.lineTo(x + halb * .85, boden + 9); c.lineTo(x + halb * .35, boden + 42); c.lineTo(x, boden + 65); c.closePath(); c.fill();
  c.fillStyle = bahn.farbe; c.fillRect(x - halb, boden, halb * 2, 5); c.fillStyle = '#d9f2d2'; c.fillRect(x - halb, boden - 2, halb * 2, 3);
  for (const s of bahn.steine) {
    c.save(); c.translate(x + s.x * skala, py(s.y)); c.rotate(-s.winkel);
    if (s.aktiv) { c.shadowColor = bahn.farbe; c.shadowBlur = 10; }
    const [hell, dunkel, glanz] = farben[s.form];
    for (const z of zellen(s.form)) {
      const xx = (z.x - .48) * skala, yy = (-z.y - .48) * skala, breite = .96 * skala;
      const g = c.createLinearGradient(xx, yy, xx, yy + breite); g.addColorStop(0, hell); g.addColorStop(1, dunkel);
      c.fillStyle = g; c.beginPath(); c.roundRect(xx, yy, breite, breite, Math.max(1.2, skala * .1)); c.fill();
      c.strokeStyle = '#112239b0'; c.lineWidth = 1; c.stroke();
      c.shadowBlur = 0; c.strokeStyle = glanz; c.globalAlpha = .7; c.beginPath(); c.moveTo(xx + 3, yy + 3); c.lineTo(xx + breite - 3, yy + 3); c.stroke(); c.globalAlpha = 1;
      c.fillStyle = `${glanz}66`; c.beginPath(); c.arc(xx + breite / 2, yy + breite / 2, Math.max(1, skala * .075), 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}
