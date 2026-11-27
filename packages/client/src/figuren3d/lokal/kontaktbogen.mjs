// Kontaktbogen: Konzeptbilder auf knallrotem Grund mit Namen, zum Pruefen.
//   node kontaktbogen.mjs <ausgabe.png> <spalten> <bild.png>...
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
const require = createRequire(import.meta.url);
const sharp = require(join(process.env.HOME ?? process.env.USERPROFILE, 'bildwerkzeug', 'node_modules', 'sharp'));
const [ausgabe, spaltenText, ...bilder] = process.argv.slice(2);
const spalten = Number(spaltenText);
const Z = 320;
const zeilen = Math.ceil(bilder.length / spalten);
const teile = [];
for (const [i, b] of bilder.entries()) {
  const x = (i % spalten) * Z;
  const y = Math.floor(i / spalten) * (Z + 24);
  teile.push({ input: await sharp(b).resize(Z, Z, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: x, top: y });
  const name = basename(b, '.png');
  teile.push({ input: Buffer.from(`<svg width="${Z}" height="24" xmlns="http://www.w3.org/2000/svg"><text x="${Z / 2}" y="18" fill="#fff" font-family="sans-serif" font-size="16" text-anchor="middle">${name}</text></svg>`), left: x, top: y + Z });
}
await sharp({ create: { width: spalten * Z, height: zeilen * (Z + 24), channels: 3, background: '#d00000' } })
  .composite(teile)
  .png()
  .toFile(ausgabe);
console.log(ausgabe);
