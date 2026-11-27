// Baut aus einem oder mehreren Blaettern eine bewegte Vorschau (animiertes WebP):
// je Figur eine Zeile, links das Konzeptbild, daneben die fuenf Bewegungen,
// die gleichzeitig ablaufen.
//
//   node vorschau.mjs <ausgabe.webp> <titel> <figur-ordner>...
//
// Ein figur-ordner enthaelt blatt/<name>.png + blatt/<name>.json und optional
// konzept.png sowie info.json ({ "titel": "...", "unter": "..." }).

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(join(process.env.HOME ?? process.env.USERPROFILE, 'bildwerkzeug', 'node_modules', 'sharp'));

const [ausgabe, titel, ...ordner] = process.argv.slice(2);

const ZELLE = 200; // Anzeigegroesse je Bewegung
const KONZEPT = 200;
const LINKS = 230; // Textspalte
const KOPF = 70;
const ZEILE = ZELLE + 40;
const BILDER = 32; // Laenge der Schleife
const MS = 125; // 8 Bilder je Sekunde
const GRUND = '#141b33';
const GOLD = '#e8c98a';
const TEXT = '#f1ece2';
const MATT = '#9aa3bd';
const NAMEN = { stand: 'stand', lauf: 'lauf', schlag: 'schlag', getroffen: 'getroffen', tod: 'tod' };

const figuren = [];
for (const o of ordner) {
  const name = basename(o);
  const angaben = JSON.parse(readFileSync(join(o, 'blatt', `${name}.json`), 'utf8'));
  const blatt = join(o, 'blatt', `${name}.png`);
  const info = existsSync(join(o, 'info.json')) ? JSON.parse(readFileSync(join(o, 'info.json'), 'utf8')) : { titel: name };
  // Jede Bewegung in Einzelbilder schneiden
  const K = angaben.kante;
  const bewegungen = [];
  for (let nr = 0; nr < angaben.bewegungen.length; nr++) {
    const b = angaben.bewegungen[nr];
    const { zeile, weite, proZeile } = angaben.raster.je[nr];
    const bilder = [];
    for (let i = 0; i < b.bilder; i++) {
      const breite = Math.round(K * weite);
      const roh = await sharp(blatt)
        .extract({
          left: Math.round((i % proZeile) * weite * K),
          top: (zeile + Math.floor(i / proZeile)) * K,
          width: breite,
          height: K,
        })
        .png()
        .toBuffer();
      // Quadratisch auf ZELLE einpassen (die breite Todeszelle wird mittig beschnitten)
      const quadrat = await sharp(roh)
        .extract({ left: Math.round((breite - K) / 2), top: 0, width: K, height: K })
        .resize(ZELLE, ZELLE)
        .png()
        .toBuffer();
      bilder.push(quadrat);
    }
    bewegungen.push({ ...b, zellen: bilder });
  }
  const konzept = existsSync(join(o, 'konzept.png'))
    ? await sharp(join(o, 'konzept.png')).resize(KONZEPT, KONZEPT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : null;
  figuren.push({ name, info, bewegungen, konzept });
}

const spalten = 5;
const breite = LINKS + KONZEPT + 20 + spalten * ZELLE;
const hoehe = KOPF + figuren.length * ZEILE + 10;

function textEbene() {
  const t = [];
  t.push(`<text x="16" y="34" fill="${TEXT}" font-family="sans-serif" font-size="22" font-weight="700">${titel}</text>`);
  t.push(`<text x="${LINKS + KONZEPT / 2}" y="${KOPF - 8}" fill="${MATT}" font-family="sans-serif" font-size="14" text-anchor="middle">Konzeptbild</text>`);
  for (let s = 0; s < spalten; s++) {
    const name = figuren[0].bewegungen[s].name;
    t.push(`<text x="${LINKS + KONZEPT + 20 + s * ZELLE + ZELLE / 2}" y="${KOPF - 8}" fill="${MATT}" font-family="sans-serif" font-size="14" text-anchor="middle">${NAMEN[name] ?? name}</text>`);
  }
  figuren.forEach((f, i) => {
    const y = KOPF + i * ZEILE + ZELLE / 2;
    t.push(`<text x="16" y="${y - 6}" fill="${GOLD}" font-family="sans-serif" font-size="18" font-weight="700">${f.info.titel}</text>`);
    (f.info.unter ?? '').split('|').forEach((z, k) => {
      t.push(`<text x="16" y="${y + 18 + k * 18}" fill="${MATT}" font-family="sans-serif" font-size="13">${z}</text>`);
    });
  });
  return Buffer.from(`<svg width="${breite}" height="${hoehe}" xmlns="http://www.w3.org/2000/svg">${t.join('')}</svg>`);
}

const texte = textEbene();
const rahmen = [];
for (let n = 0; n < BILDER; n++) {
  const teile = [{ input: texte, left: 0, top: 0 }];
  figuren.forEach((f, i) => {
    const oben = KOPF + i * ZEILE;
    if (f.konzept) teile.push({ input: f.konzept, left: LINKS, top: oben });
    f.bewegungen.forEach((b, s) => {
      let k;
      if (b.schleife) k = n % b.bilder;
      else {
        // Einmal ablaufen, auf dem letzten Bild stehen bleiben, von vorn
        const periode = b.bilder + 6;
        k = Math.min(n % periode, b.bilder - 1);
      }
      teile.push({ input: b.zellen[k], left: LINKS + KONZEPT + 20 + s * ZELLE, top: oben });
    });
  });
  rahmen.push(
    await sharp({ create: { width: breite, height: hoehe, channels: 4, background: GRUND } })
      .composite(teile)
      .png()
      .toBuffer(),
  );
}

await sharp(rahmen, { join: { animated: true } })
  .webp({ quality: 85, loop: 0, delay: Array(BILDER).fill(MS) })
  .toFile(ausgabe);
console.log(`${ausgabe}: ${breite}x${hoehe}, ${BILDER} Bilder`);
