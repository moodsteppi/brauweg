#!/usr/bin/env node
/**
 * Platzhalter fuer die zweite Rig-Lieferung der Kartenmanufaktur
 * (docs/ASSETS-KARTENMANUFAKTUR-RIG2.md) — gleiche Namen, gleiche Masse.
 *
 *   node werkzeug/manufaktur-platzhalter.mjs
 *
 * Warum ueberhaupt Platzhalter: Der Code soll fertig sein, bevor die Bilder
 * kommen, und „kein <img> auf eine Datei, die es noch nicht gibt" (CLAUDE.md).
 * Kommt die echte Lieferung, wird sie mit `wandeln.mjs … wappen` in denselben
 * Ordner gewandelt und ueberschreibt diese Dateien — sonst aendert sich nichts.
 *
 * Kleidung: umgefaerbte Kopien vorhandener Rig-Teile, damit die Szene
 * glaubwuerdig bleibt. Zeichen: einfache Formen ohne Schrift.
 * Braucht `sharp` aus ~/bildwerkzeug (siehe docs/JETZT-AUSFUEHREN.md).
 */

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(join(process.env.HOME, 'bildwerkzeug/node_modules/sharp'));

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const RIG = join(WURZEL, 'packages/client/public/manufaktur/rig');
const ZIEL = join(WURZEL, 'packages/client/public/manufaktur/rig2');
mkdirSync(ZIEL, { recursive: true });

const WEBP = { quality: 90, alphaQuality: 100 };

/** Ein vorhandenes Rig-Teil umfaerben (Farbton in Grad, Helligkeit, Saettigung). */
async function umgefaerbt(quelle, ziel, { farbton = 0, hell = 1, satt = 1 } = {}) {
  await sharp(join(RIG, `${quelle}.webp`)).modulate({ hue: farbton, brightness: hell, saturation: satt }).webp(WEBP).toFile(join(ZIEL, `${ziel}.webp`));
}

/** Eine Form als SVG zeichnen. */
async function form(ziel, b, h, svg) {
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${b}" height="${h}" viewBox="0 0 ${b} ${h}">${svg}</svg>`;
  await sharp(Buffer.from(text)).webp(WEBP).toFile(join(ZIEL, `${ziel}.webp`));
}

const stern = (cx, cy, r, farbe) => {
  const p = [];
  for (let i = 0; i < 10; i += 1) {
    const w = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    p.push(`${(cx + Math.cos(w) * rr).toFixed(1)},${(cy + Math.sin(w) * rr).toFixed(1)}`);
  }
  return `<polygon points="${p.join(' ')}" fill="${farbe}" stroke="#5a3a10" stroke-width="3"/>`;
};
const medaille = (farbe, kante, sterne) =>
  `<circle cx="64" cy="64" r="54" fill="${farbe}" stroke="${kante}" stroke-width="8"/>` +
  Array.from({ length: sterne }, (_, i) => stern(64 + (i - (sterne - 1) / 2) * 30, 64, 16, '#fff7d6')).join('');
const blitz = (x, y, s, farbe) =>
  `<polygon transform="translate(${x} ${y}) scale(${s})" points="14,0 0,22 10,22 6,40 22,14 12,14 18,0" fill="${farbe}" stroke="#6b4a10" stroke-width="2"/>`;

// A — Rang-Kleidung und Baustelle
await umgefaerbt('muetze-schiebermuetze', 'muetze-jungmeister', { farbton: 60, satt: 1.2 });
// Ungefaerbt: Ein Farbdreh traf auch Schnabel und Fuesse des Pinguins — der wurde gruen.
await umgefaerbt('oberteil-weste', 'koerper-weste-meister');
await umgefaerbt('flosse-vorn-weste', 'flosse-vorn-weste-meister');
await umgefaerbt('flosse-hinten-weste', 'flosse-hinten-weste-meister');
await umgefaerbt('hut-zylinder', 'hut-obermeister', { hell: 0.9 });
await umgefaerbt('hut-wollmuetze', 'muetze-bauhelm', { farbton: 160, hell: 1.25, satt: 2 });
await form('req-schaufel', 256, 256, '<rect x="52" y="60" width="16" height="140" rx="6" fill="#a0703a"/><path d="M30 190 h60 v30 q-30 30 -60 0 z" fill="#9aa4ad" stroke="#4a5058" stroke-width="4"/>');
await form('req-hammer', 256, 256, '<rect x="52" y="90" width="16" height="120" rx="6" fill="#a0703a"/><rect x="24" y="64" width="72" height="34" rx="6" fill="#6d737a" stroke="#3a3e44" stroke-width="4"/>');

// B — Abzeichen und Faehigkeiten
await form('abzeichen-bronze', 128, 128, medaille('#c4834a', '#7a4a20', 1));
await form('abzeichen-silber', 128, 128, medaille('#c8d0da', '#6b7480', 2));
await form('abzeichen-gold', 128, 128, medaille('#f2c94c', '#9a6b10', 3));
await form('faehigkeit-tempo', 128, 128, `<circle cx="64" cy="64" r="58" fill="#2b4a8a"/>${blitz(36, 20, 2.2, '#ffd65a')}`);
await form('faehigkeit-ladung', 128, 128, '<circle cx="64" cy="64" r="58" fill="#5a3a1c"/><rect x="34" y="70" width="60" height="16" rx="3" fill="#f3e6c4"/><rect x="34" y="52" width="60" height="16" rx="3" fill="#e6d4a8"/><rect x="34" y="34" width="60" height="16" rx="3" fill="#d9c28a"/><path d="M64 96 l14 0 l-14 18 l-14 -18 z" transform="rotate(180 64 105)" fill="#ffd65a"/>');
await form('faehigkeit-rabatt', 128, 128, '<circle cx="64" cy="64" r="58" fill="#1f6b3a"/><path d="M30 44 h50 l20 20 l-20 20 h-50 z" fill="#e8c46a" stroke="#7a5a10" stroke-width="4"/><circle cx="42" cy="64" r="7" fill="#1f6b3a"/>');
await form('faehigkeit-alle', 128, 128, `<circle cx="64" cy="64" r="58" fill="#3a2a6a"/>${blitz(20, 34, 1.4, '#ffd65a')}${blitz(50, 20, 1.4, '#ffd65a')}${blitz(80, 34, 1.4, '#ffd65a')}`);
await form('einstellen-mappe', 256, 256, '<rect x="30" y="60" width="196" height="150" rx="14" fill="#7a4a26" stroke="#3a2414" stroke-width="6"/><rect x="30" y="44" width="80" height="30" rx="8" fill="#7a4a26"/><rect x="110" y="120" width="36" height="22" rx="4" fill="#e8c46a"/>');

// C — Renovieren
await form('renovierung-schild', 384, 160, '<line x1="80" y1="0" x2="100" y2="34" stroke="#8a6a30" stroke-width="5"/><line x1="304" y1="0" x2="284" y2="34" stroke="#8a6a30" stroke-width="5"/><rect x="16" y="30" width="352" height="116" rx="18" fill="#d9a83a" stroke="#7a5410" stroke-width="8"/><rect x="40" y="52" width="304" height="72" rx="10" fill="#c9952c"/>');
await form('renovierung-stern', 64, 64, stern(32, 33, 28, '#ffd65a'));
await form(
  'deko-girlande',
  1024,
  128,
  '<path d="M0 20 Q512 110 1024 20" fill="none" stroke="#6b4a26" stroke-width="4"/>' +
    Array.from({ length: 16 }, (_, i) => {
      const x = 32 + i * 62;
      const y = 20 + Math.sin((x / 1024) * Math.PI) * 52;
      const farbe = ['#d9534f', '#f0c24a', '#4a8ad9', '#5cb85c'][i % 4];
      return `<polygon points="${x - 16},${y} ${x + 16},${y} ${x},${y + 34}" fill="${farbe}"/><circle cx="${x + 30}" cy="${y + 4}" r="5" fill="#fff2b0"/>`;
    }).join(''),
);
await form('deko-lampe', 128, 256, '<line x1="64" y1="0" x2="64" y2="120" stroke="#5a4020" stroke-width="5"/><path d="M24 170 q40 -60 80 0 z" fill="#c9952c" stroke="#7a5410" stroke-width="5"/><circle cx="64" cy="182" r="16" fill="#fff2b0"/>');

// D — Werkstattbuch und Siegel
await form('siegel', 128, 128, '<circle cx="64" cy="64" r="54" fill="#b3262c" stroke="#6a1014" stroke-width="8"/><rect x="48" y="40" width="32" height="46" rx="4" fill="#f0c24a"/>');
await form('werkstattbuch', 256, 256, '<rect x="40" y="30" width="176" height="200" rx="14" fill="#6a3418" stroke="#2e160a" stroke-width="8"/><rect x="58" y="30" width="10" height="200" fill="#3e1e0c"/><path d="M40 30 h40 l-40 40 z M216 30 h-40 l40 40 z M40 230 h40 l-40 -40 z M216 230 h-40 l40 -40 z" fill="#d9a83a"/>');
await form('werkstattbuch-seite', 768, 1024, '<rect x="0" y="0" width="768" height="1024" rx="24" fill="#f1e2bd"/>' + Array.from({ length: 22 }, (_, i) => `<line x1="80" y1="${120 + i * 40}" x2="688" y2="${120 + i * 40}" stroke="#e0cc9c" stroke-width="2"/>`).join(''));
const glyph = {
  nachtschicht: '<path d="M78 30 a34 34 0 1 0 0 68 a26 26 0 1 1 0 -68 z" fill="#f0d27a"/>',
  ruf: '<rect x="46" y="34" width="36" height="52" rx="5" fill="#fff" stroke="#7a5410" stroke-width="4"/><path d="M30 96 q34 20 68 0" stroke="#5cb85c" stroke-width="6" fill="none"/>',
  erfahrene: '<path d="M42 30 h44 l-22 34 l22 34 h-44 l22 -34 z" fill="#e6d4a8" stroke="#7a5410" stroke-width="4"/>',
  pausen: '<rect x="36" y="50" width="44" height="44" rx="8" fill="#fff"/><path d="M80 60 q16 12 0 24" stroke="#fff" stroke-width="6" fill="none"/>',
  feilschen: '<circle cx="64" cy="64" r="22" fill="#f0c24a" stroke="#7a5410" stroke-width="4"/>',
  bewerber: '<rect x="36" y="56" width="56" height="40" rx="5" fill="#a0703a"/><rect x="40" y="46" width="56" height="40" rx="5" fill="#c08a4a"/>',
  bautrupps: '<line x1="38" y1="38" x2="90" y2="90" stroke="#a0703a" stroke-width="10"/><line x1="90" y1="38" x2="38" y2="90" stroke="#9aa4ad" stroke-width="10"/>',
  lager: '<rect x="34" y="40" width="60" height="50" rx="4" fill="#a0703a" stroke="#5a3a1c" stroke-width="4"/><path d="M64 50 v30 M49 65 h30" stroke="#f0c24a" stroke-width="7"/>',
};
for (const [name, inhalt] of Object.entries(glyph)) {
  await form(`wb-${name}`, 128, 128, `<circle cx="64" cy="64" r="58" fill="#4a2a14"/>${inhalt}`);
}

// E — Baustelle
await form(
  'barriere-schutt',
  1024,
  320,
  '<rect x="0" y="40" width="1024" height="280" fill="#5a4636"/>' +
    Array.from({ length: 60 }, (_, i) => {
      const x = (i * 97) % 1000;
      const y = 60 + ((i * 53) % 240);
      return `<rect x="${x}" y="${y}" width="${40 + (i % 3) * 14}" height="22" rx="4" fill="${['#8a4a30', '#7a6a5a', '#9a5a3a'][i % 3]}" transform="rotate(${(i * 17) % 30 - 15} ${x} ${y})"/>`;
    }).join(''),
);
await form(
  'barriere-geruest',
  1024,
  320,
  [120, 360, 664, 904].map((x) => `<rect x="${x}" y="0" width="16" height="320" fill="#b07a3a"/>`).join('') +
    [60, 180, 290].map((y) => `<rect x="80" y="${y}" width="864" height="14" fill="#c08a4a"/>`).join(''),
);

console.log(`Platzhalter in ${ZIEL}`);
