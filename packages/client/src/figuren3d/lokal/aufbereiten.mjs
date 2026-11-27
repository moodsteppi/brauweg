// Bereitet die Grafik von Tafelrunde neu fuer das Wandeln vor: freistellen,
// beschneiden, auf Zielgroesse bringen. Danach wandelt ~/bildwerkzeug/wandeln.mjs
// nach WebP (die Aufloesung bleibt dort, wie sie ist — deshalb hier).
//
//   node aufbereiten.mjs <grafik-ordner> <ausgabe-ordner>
//
// Ausgabe: <ausgabe>/{feld,karten,zeichen,effekte}/<name>.png
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(join(process.env.HOME ?? process.env.USERPROFILE, 'bildwerkzeug', 'node_modules', 'sharp'));
const [quelle, ziel] = process.argv.slice(2);

/** Leeren Rand weg, 4 % Luft wieder dran, Seitenverhaeltnis bleibt. */
async function beschnitten(datei) {
  const bild = sharp(datei).ensureAlpha();
  const { data, info } = await bild.clone().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const b = x1 - x0 + 1, h = y1 - y0 + 1;
  const rand = Math.round(Math.max(b, h) * 0.04);
  return sharp(datei)
    .extract({ left: x0, top: y0, width: b, height: h })
    .extend({ top: rand, bottom: rand, left: rand, right: rand, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

const ARTEN = [
  // Feld: hochkant, ohne Alpha. 768 x 1152 traegt auf einem 390er Handy mit
  // dreifacher Dichte die Hoehe; breiter wird das Feld nie gezeigt.
  { praefix: 'feld-', ordner: 'feld', name: (n) => n.slice('feld-'.length), mach: (d) => sharp(d).resize(768, 1152, { fit: 'cover' }).png().toBuffer() },
  // Kartenrahmen: 11:16, eine Karte ist am Handy hoechstens ~120 px breit.
  { praefix: 'rahmen-', ordner: 'karten', name: (n) => n, mach: (d) => sharp(d).resize(352, 512, { fit: 'fill' }).png().toBuffer() },
  // Zeichen: 96 px reichen fuer 32 px Anzeige bei dreifacher Dichte.
  { praefix: '', ordner: 'zeichen', passt: (n) => /^(rolle-|marke-|stern|gold|leben)/.test(n), name: (n) => n, mach: async (d) => sharp(await beschnitten(d)).resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() },
  // Effekte: 256 px, sie werden im Kampf groesser gezeigt als ein Zeichen.
  { praefix: 'effekt-', ordner: 'effekte', name: (n) => n, mach: async (d) => sharp(await beschnitten(d)).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer() },
];

let anzahl = 0;
for (const datei of readdirSync(quelle).filter((d) => d.endsWith('.png') && !d.includes('bogen'))) {
  const n = datei.slice(0, -4);
  const art = ARTEN.find((a) => (a.passt ? a.passt(n) : n.startsWith(a.praefix)));
  if (!art) continue;
  const ordner = join(ziel, art.ordner);
  if (!existsSync(ordner)) mkdirSync(ordner, { recursive: true });
  await sharp(await art.mach(join(quelle, datei))).toFile(join(ordner, `${art.name(n)}.png`));
  anzahl += 1;
}
console.log(`${anzahl} Bilder aufbereitet nach ${ziel}`);
