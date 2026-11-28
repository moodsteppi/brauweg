// Splash-Art fuer die Shop-Karten aus den Konzeptbildern: Hochformat 11:16,
// Kopf bis etwa Knie, freigestellt (der Bildschirm legt die Kostenfarbe dahinter).
//   node splash.mjs <konzept-ordner> <ausgabe-ordner> <kennung>...
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const sharp = require(join(process.env.HOME ?? process.env.USERPROFILE, 'bildwerkzeug', 'node_modules', 'sharp'));
const [quelle, ziel, ...namen] = process.argv.slice(2);
mkdirSync(ziel, { recursive: true });

for (const n of namen) {
  const datei = join(quelle, `${n}.png`);
  const { data, info } = await sharp(datei).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const a = (x, y) => data[(y * info.width + x) * 4 + 3] > 128;
  // Boden und Koerpermitte aus den Fuessen (wie punkte_auto.py)
  let unten = 0;
  for (let y = info.height - 1; y >= 0 && !unten; y--) for (let x = 0; x < info.width; x++) if (a(x, y)) { unten = y; break; }
  let links = info.width, rechts = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (a(x, y)) { if (x < links) links = x; if (x > rechts) rechts = x; }
  const zeileFuss = Math.round(unten - (unten * 0.03));
  const xs = [];
  for (let x = 0; x < info.width; x++) if (a(x, zeileFuss)) xs.push(x);
  const mitte = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : (links + rechts) / 2;
  const band = Math.round((rechts - links) * 0.06);
  let kopf = 0;
  outer: for (let y = 0; y < info.height; y++) for (let x = Math.round(mitte - band); x <= mitte + band; x++) if (a(x, y)) { kopf = y; break outer; }
  const hb = unten - kopf;
  const hoehe = Math.round(hb * 0.82);
  const breite = Math.round((hoehe * 11) / 16);
  const oben = Math.round(kopf - hb * 0.05);
  const x0 = Math.round(mitte - breite / 2);
  // Ausschnitt, der ueber den Rand hinausragen darf: erst erweitern, dann schneiden
  const rand = Math.max(0, -x0, -oben, x0 + breite - info.width, oben + hoehe - info.height);
  const erweitert = await sharp(datei)
    .extend({ top: rand, bottom: rand, left: rand, right: rand, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(erweitert)
    .extract({ left: x0 + rand, top: oben + rand, width: breite, height: hoehe })
    .resize(352, 512)
    .png()
    .toFile(join(ziel, `${n}.png`));
  console.log(n, { kopf, unten, mitte: Math.round(mitte), breite, hoehe });
}
