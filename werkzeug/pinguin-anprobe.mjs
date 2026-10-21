#!/usr/bin/env node
/**
 * Pinguin-Kleidung „am Pinguin anprobiert" ausschneiden (docs/ASSETS-PINGUIN-ANPROBE.md).
 *
 *   node werkzeug/pinguin-anprobe.mjs <angezogen.png> <ziel.png> --platz <hut|brille|oberteil|schuhe|hand|aura> [--vorschau <vorschau.png>]
 *
 * Eingabe ist ein Bild des Pinguins MIT dem Stück, erzeugt aus der Vorlage
 * (nackter Pinguin 960 × 1024 bei x = 32 auf 1024 × 1024 Grün). Ausgabe ist
 * die Ebene im Rahmen 480 × 512 mit Alphakanal — deckungsgleich mit
 * `public/hub/pinguin/pinguin-basis.webp`, also genau das, was `pinguin.tsx`
 * stapelt. Gewandelt nach WebP wird danach wie immer mit
 * `~/bildwerkzeug/wandeln.mjs`.
 *
 * Warum so und nicht „Stück einzeln malen": Ein einzeln gemaltes Stück kennt
 * den Körper nicht — Ärmel neben den Flossen, Krone über dem Kopf (Emile,
 * 21.10.2026). Hier bleibt vom angezogenen Bild genau das, was sich gegenüber
 * dem nackten Pinguin geändert hat. Was das Stück verdeckt, ist damit
 * automatisch verdeckt.
 *
 * Ablauf:
 *   1. Ausrichten: Die Bild-KI verschiebt und skaliert den Pinguin oft ein
 *      wenig. Gesucht wird der Versatz/Maßstab, bei dem die meisten Pixel des
 *      nackten Pinguins wiedergefunden werden.
 *   2. Maske: Pixel, die nicht grün sind UND sich deutlich vom nackten
 *      Pinguin unterscheiden. Danach Löcher schließen, Krümel entfernen,
 *      Rand weich.
 *   3. Grünstich am Rand entfernen, in den 480er-Rahmen setzen.
 */

import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(join(process.env.HOME, 'bildwerkzeug/node_modules/sharp'));

const HIER = dirname(fileURLToPath(import.meta.url));
const BASIS = join(HIER, '../packages/client/public/hub/pinguin/pinguin-basis.webp');

const GROSS = 1024; // Arbeitsgröße
const PG = { x: 32, y: 0, b: 960, h: 1024 }; // Lage des Pinguins in der Vorlage
const RAHMEN = { b: 480, h: 512 };
/**
 * Farbabstand, ab dem ein Pixel „anders" ist. 46 reicht für Helles auf
 * Dunklem (Krone, Stiefel); schwarzer Stoff auf dem dunkelblauen Körper
 * (Frack) braucht weniger — dafür `--schwelle`.
 */
let SCHWELLE = 46;

/**
 * Wo ein Stück eines Platzes liegen darf (y von–bis in der 1024er-Vorlage).
 * Die Bild-KI zeichnet den Pinguin bei jedem Bild leicht anders — im
 * Kronen-Bild der ersten Probe (21.10.2026) saß das Gesicht ein Stück
 * tiefer. Ohne Bereich käme dieses fremde Gesicht mit in die Krone.
 */
const BEREICH = {
  hut: { y: [0, 250] },
  // Bis unter den Schnabel: Die Kette des Monokels hängt tief.
  brille: { y: [200, 560] },
  oberteil: { y: [415, 930] },
  schuhe: { y: [860, 1024] },
  // Nur rechts im Bild (dort hält die Flosse), dafür bis zum Boden — der
  // Wanderstab steht auf.
  hand: { y: [360, 1024], x: [470, 1024] },
  aura: { y: [0, 1024] },
};

/**
 * Wie aufgeräumt wird, je Platz. Auren sind Funken und Sterne — winzig, der
 * Krümelfilter löschte sie alle, und Löcherfüllen nähme den Pinguin in der
 * Mitte gleich mit. Für sie zählt deshalb nur, was AUSSERHALB des nackten
 * Pinguins liegt: Die Aura wird hinter ihn gezeichnet, drinnen sähe man
 * ohnehin nichts, und im Fach des Spinds stünde sonst ein halber Pinguin.
 */
const AUFRAEUMEN = {
  hut: { oeffnen: 2, kruemel: 900, schliessen: 8, fuellen: true, aussen: false },
  brille: { oeffnen: 1, kruemel: 150, schliessen: 6, fuellen: true, aussen: false },
  oberteil: { oeffnen: 2, kruemel: 900, schliessen: 26, fuellen: true, aussen: false },
  schuhe: { oeffnen: 2, kruemel: 900, schliessen: 8, fuellen: true, aussen: false },
  hand: { oeffnen: 2, kruemel: 600, schliessen: 14, fuellen: true, aussen: false },
  aura: { oeffnen: 0, kruemel: 12, schliessen: 0, fuellen: false, aussen: true },
};

const args = process.argv.slice(2);
const [quelle, ziel] = args;
const wert = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const vorschau = wert('--vorschau');
if (wert('--schwelle')) SCHWELLE = Number(wert('--schwelle'));
const platz = wert('--platz');
if (!quelle || !ziel || !platz || !BEREICH[platz]) {
  console.error('Aufruf: node werkzeug/pinguin-anprobe.mjs <angezogen.png> <ziel.png> --platz <hut|brille|oberteil|schuhe|hand|aura> [--vorschau <bild.png>]');
  process.exit(1);
}

/** RGBA-Puffer in Arbeitsgröße. */
async function roh(eingabe, b = GROSS, h = GROSS) {
  const { data } = await sharp(eingabe).resize(b, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

function istGruen(r, g, b) {
  return g > 140 && g > r * 1.45 && g > b * 1.45;
}

const abstand = (a, i, b, j) =>
  Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]);

// --- Vorlage: nackter Pinguin auf Grün, in Arbeitsgröße ----------------------
const basisPg = await sharp(BASIS).resize(PG.b, PG.h).toBuffer();
const vorlage = await sharp({ create: { width: GROSS, height: GROSS, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
  .composite([{ input: basisPg, left: PG.x, top: PG.y }])
  .raw()
  .toBuffer();
const basisMaske = new Uint8Array(GROSS * GROSS);
for (let p = 0; p < GROSS * GROSS; p++) {
  const i = p * 4;
  basisMaske[p] = istGruen(vorlage[i], vorlage[i + 1], vorlage[i + 2]) ? 0 : 1;
}

// --- 1. Ausrichten ------------------------------------------------------------
const roheQuelle = await sharp(quelle).ensureAlpha().toBuffer();
const KLEIN = 256;
const vorlageKlein = await roh(await sharp(vorlage, { raw: { width: GROSS, height: GROSS, channels: 4 } }).png().toBuffer(), KLEIN, KLEIN);

/** Quelle mit Maßstab s und Versatz (dx, dy) — auf Grün, Arbeitsgröße `g`. */
async function verschoben(s, dx, dy, g) {
  const b = Math.round(g * s);
  const bild = await sharp(roheQuelle).resize(b, b, { fit: 'fill' }).toBuffer();
  const links = Math.round((g - b) / 2 + dx);
  const oben = Math.round((g - b) / 2 + dy);
  // Ausschnitt auf g × g, Rest grün.
  const leinwand = sharp({ create: { width: g * 3, height: g * 3, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } }).composite([
    { input: bild, left: g + links, top: g + oben },
  ]);
  // Erst zusammensetzen, dann ausschneiden: In EINER sharp-Kette liefe der
  // Ausschnitt vor dem Zusammensetzen.
  const ganz = await leinwand.png().toBuffer();
  return sharp(ganz).extract({ left: g, top: g, width: g, height: g }).raw().toBuffer();
}

function treffer(a, b, g) {
  // Zählt Pixel des nackten Pinguins, die in der Quelle fast gleich wiederkommen.
  let n = 0;
  for (let p = 0; p < g * g; p++) {
    const i = p * 4;
    if (istGruen(b[i], b[i + 1], b[i + 2])) continue;
    if (abstand(a, i, b, i) < SCHWELLE) n++;
  }
  return n;
}

let bester = { s: 1, dx: 0, dy: 0, n: -1 };
for (const s of [0.94, 0.96, 0.98, 1, 1.02, 1.04, 1.06]) {
  for (let dx = -12; dx <= 12; dx += 3) {
    for (let dy = -12; dy <= 12; dy += 3) {
      const n = treffer(await verschoben(s, dx, dy, KLEIN), vorlageKlein, KLEIN);
      if (n > bester.n) bester = { s, dx, dy, n };
    }
  }
}
// Feinschritt um den besten Grobwert.
const grob = bester;
for (const s of [grob.s - 0.01, grob.s, grob.s + 0.01]) {
  for (let dx = grob.dx - 2; dx <= grob.dx + 2; dx++) {
    for (let dy = grob.dy - 2; dy <= grob.dy + 2; dy++) {
      const n = treffer(await verschoben(s, dx, dy, KLEIN), vorlageKlein, KLEIN);
      if (n > bester.n) bester = { s, dx, dy, n };
    }
  }
}
// Letzter Schritt in halber Arbeitsgröße, pixelgenau: Ein Restversatz von
// zwei Pixeln zeichnet sonst den Umriss des Pinguins als feine Linie mit.
const MITTEL = 512;
const vorlageMittel = await roh(await sharp(vorlage, { raw: { width: GROSS, height: GROSS, channels: 4 } }).png().toBuffer(), MITTEL, MITTEL);
const zuMittel = MITTEL / KLEIN;
let fein = { s: bester.s, dx: bester.dx * zuMittel, dy: bester.dy * zuMittel, n: -1 };
const start = { ...fein };
for (const s of [start.s - 0.005, start.s, start.s + 0.005]) {
  for (let dx = start.dx - 2; dx <= start.dx + 2; dx++) {
    for (let dy = start.dy - 2; dy <= start.dy + 2; dy++) {
      const n = treffer(await verschoben(s, dx, dy, MITTEL), vorlageMittel, MITTEL);
      if (n > fein.n) fein = { s, dx, dy, n };
    }
  }
}
bester = { ...fein, dx: fein.dx / zuMittel, dy: fein.dy / zuMittel };
const faktor = GROSS / KLEIN;
const quelleGross = await verschoben(bester.s, bester.dx * faktor, bester.dy * faktor, GROSS);

// --- 2. Maske -----------------------------------------------------------------

/**
 * Hintergrund = Grün, das vom Bildrand her zusammenhängend erreichbar ist.
 * Ein Pixel einzeln nach „grün?" zu fragen, schnitt helle Maschen aus dem
 * grünen Pulli (erste Probe): Strickgrün und Leinwandgrün liegen dafür zu
 * nah beieinander. Innerhalb des Pinguins ist Grün nie Hintergrund.
 */
function hintergrundVon(bild) {
  const hg = new Uint8Array(GROSS * GROSS);
  const stapel = [];
  for (let x = 0; x < GROSS; x++) stapel.push(x, (GROSS - 1) * GROSS + x);
  for (let y = 0; y < GROSS; y++) stapel.push(y * GROSS, y * GROSS + GROSS - 1);
  while (stapel.length) {
    const p = stapel.pop();
    if (hg[p]) continue;
    const i = p * 4;
    if (!istGruen(bild[i], bild[i + 1], bild[i + 2])) continue;
    hg[p] = 1;
    const x = p % GROSS;
    if (x > 0) stapel.push(p - 1);
    if (x < GROSS - 1) stapel.push(p + 1);
    if (p >= GROSS) stapel.push(p - GROSS);
    if (p < hg.length - GROSS) stapel.push(p + GROSS);
  }
  return hg;
}
const hintergrund = hintergrundVon(quelleGross);

let maske = new Uint8Array(GROSS * GROSS);
const [vonY, bisY] = BEREICH[platz].y;
const [vonX, bisX] = BEREICH[platz].x ?? [0, GROSS];
const regel = AUFRAEUMEN[platz];
// Für Auren: der nackte Pinguin, etwas aufgeweitet — dort ist nichts zu holen.
const pinguinBreit = regel.aussen ? morph(basisMaske, 6, true) : null;
for (let p = 0; p < GROSS * GROSS; p++) {
  const y = Math.floor(p / GROSS);
  const x = p % GROSS;
  if (y < vonY || y >= bisY || x < vonX || x >= bisX) continue;
  if (pinguinBreit && pinguinBreit[p]) continue;
  const i = p * 4;
  if (hintergrund[p]) continue;
  // Außerhalb des nackten Pinguins ist alles Nicht-Grüne neu (Krone über dem Kopf).
  if (!basisMaske[p] || abstand(quelleGross, i, vorlage, i) > SCHWELLE) maske[p] = 1;
}

/**
 * Morphologie mit quadratischem Fenster r — getrennt nach Zeilen und Spalten,
 * weil ein Quadrat aus zwei Strecken besteht. So kostet r = 24 (Oberteile)
 * Sekunden statt Minuten.
 */
function morph(m, r, dehnen) {
  const zeilen = new Uint8Array(m.length);
  for (let y = 0; y < GROSS; y++) {
    let summe = 0;
    const reihe = y * GROSS;
    for (let x = -r; x < GROSS; x++) {
      const rein = x + r;
      if (rein < GROSS) summe += m[reihe + rein];
      const raus = x - r - 1;
      if (raus >= 0) summe -= m[reihe + raus];
      if (x < 0) continue;
      const breite = Math.min(GROSS - 1, x + r) - Math.max(0, x - r) + 1;
      zeilen[reihe + x] = dehnen ? (summe > 0 ? 1 : 0) : summe === breite ? 1 : 0;
    }
  }
  const aus = new Uint8Array(m.length);
  for (let x = 0; x < GROSS; x++) {
    let summe = 0;
    for (let y = -r; y < GROSS; y++) {
      const rein = y + r;
      if (rein < GROSS) summe += zeilen[rein * GROSS + x];
      const raus = y - r - 1;
      if (raus >= 0) summe -= zeilen[raus * GROSS + x];
      if (y < 0) continue;
      const hoehe = Math.min(GROSS - 1, y + r) - Math.max(0, y - r) + 1;
      aus[y * GROSS + x] = dehnen ? (summe > 0 ? 1 : 0) : summe === hoehe ? 1 : 0;
    }
  }
  return aus;
}

/** Zusammenhängende Flecken unter `min` Pixeln entfernen. */
function kruemelWeg(m, min) {
  const marke = new Int32Array(m.length).fill(-1);
  const stapel = [];
  for (let start = 0; start < m.length; start++) {
    if (!m[start] || marke[start] >= 0) continue;
    const flaeche = [];
    stapel.push(start);
    marke[start] = start;
    while (stapel.length) {
      const p = stapel.pop();
      flaeche.push(p);
      const x = p % GROSS;
      for (const q of [p - 1, p + 1, p - GROSS, p + GROSS]) {
        if (q < 0 || q >= m.length || !m[q] || marke[q] >= 0) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === GROSS - 1)) continue;
        marke[q] = start;
        stapel.push(q);
      }
    }
    if (flaeche.length < min) for (const p of flaeche) m[p] = 0;
  }
  return m;
}

/**
 * Eingeschlossene Löcher füllen: Weißes Hemd auf weißem Bauch zählt nicht als
 * „geändert" — am Pinguin fiele das nicht auf (darunter ist derselbe Bauch),
 * allein im Fach des Spinds stünde das Hemd aber voller Löcher. Alles, was
 * vom Bildrand aus nicht durch freie Fläche erreichbar ist, gehört dazu.
 */
function loecherFuellen(m) {
  const aussen = new Uint8Array(m.length);
  const stapel = [];
  for (let x = 0; x < GROSS; x++) stapel.push(x, (GROSS - 1) * GROSS + x);
  for (let y = 0; y < GROSS; y++) stapel.push(y * GROSS, y * GROSS + GROSS - 1);
  while (stapel.length) {
    const p = stapel.pop();
    if (aussen[p] || m[p]) continue;
    aussen[p] = 1;
    const x = p % GROSS;
    if (x > 0) stapel.push(p - 1);
    if (x < GROSS - 1) stapel.push(p + 1);
    if (p >= GROSS) stapel.push(p - GROSS);
    if (p < m.length - GROSS) stapel.push(p + GROSS);
  }
  for (let p = 0; p < m.length; p++) if (!aussen[p]) m[p] = 1;
  return m;
}

if (regel.oeffnen) maske = morph(morph(maske, regel.oeffnen, false), regel.oeffnen, true); // Rauschen, Umrisslinien
maske = kruemelWeg(maske, regel.kruemel);
// Schließen: Spalten im Stück zu. Oberteile großzügig — schwarzer Stoff auf
// dunklem Körper und weißes Hemd auf weißem Bauch heben sich kaum ab, erkannt
// wird nur, wo Schwarz auf Weiß trifft (Frack, erste Probe). Was dabei an
// Körper mitkommt, sieht aus wie der Körper darunter.
if (regel.schliessen) maske = morph(morph(maske, regel.schliessen, true), regel.schliessen, false);
if (regel.fuellen) maske = loecherFuellen(maske);
// Nie über den Umriss hinaus: Grün bleibt draußen.
for (let p = 0; p < GROSS * GROSS; p++) if (hintergrund[p]) maske[p] = 0;

// --- 3. Ebene bauen -----------------------------------------------------------
const ebene = Buffer.alloc(GROSS * GROSS * 4);
/*
 * Eingeschlossenes Leinwandgrün: zwischen Kufe und Schuh, unter der Quaste,
 * im Laternenhenkel. Vom Rand her ist es nicht erreichbar, also bleibt es oben
 * in der Maske. Leinwand ist ab Grün 200 — der helle Strick des Pullis
 * reichte in der ersten Lieferung bis 199. Um solche Stellen herum wird der
 * Grünstich mit entfernt.
 */
const leinwand = new Uint8Array(GROSS * GROSS);
for (let p = 0; p < GROSS * GROSS; p++) {
  if (!maske[p]) continue;
  const i = p * 4;
  const [r, g, b] = [quelleGross[i], quelleGross[i + 1], quelleGross[i + 2]];
  if (g >= 200 && g > r * 1.45 && g > b * 1.45) {
    leinwand[p] = 1;
    maske[p] = 0;
  }
}
const nahLeinwand = morph(leinwand, 3, true);

// Nur der äußerste Rand bekommt den Grünstich entfernt. Über die ganze
// Fläche färbte das einen grünen Pulli schwarz (erste Probe, 21.10.2026).
const kern = morph(maske, 3, false);
for (let p = 0; p < GROSS * GROSS; p++) {
  if (!maske[p]) continue;
  const i = p * 4;
  let [r, g, b] = [quelleGross[i], quelleGross[i + 1], quelleGross[i + 2]];
  const deckel = Math.max(r, b) + 12;
  if ((!kern[p] || nahLeinwand[p]) && g > deckel) g = deckel;
  ebene[i] = r;
  ebene[i + 1] = g;
  ebene[i + 2] = b;
  ebene[i + 3] = 255;
}
// Weicher Rand: Alpha leicht weichzeichnen.
const weich = await sharp(ebene, { raw: { width: GROSS, height: GROSS, channels: 4 } })
  .extractChannel(3)
  .blur(1.1)
  .raw()
  .toBuffer();
// Nur nach innen weich: außerhalb der Maske bleibt es durchsichtig, sonst
// zöge der Rand Grün mit herein.
for (let p = 0; p < GROSS * GROSS; p++) if (maske[p]) ebene[p * 4 + 3] = weich[p];

const imRahmen = await sharp(
  await sharp(ebene, { raw: { width: GROSS, height: GROSS, channels: 4 } })
    .extract({ left: PG.x, top: PG.y, width: PG.b, height: PG.h })
    .png()
    .toBuffer(),
)
  .resize(RAHMEN.b, RAHMEN.h)
  .png()
  .toBuffer();
await sharp(imRahmen).toFile(ziel);

const anteil = maske.reduce((s, v) => s + v, 0) / (GROSS * GROSS);
console.log(
  `${ziel}: Versatz ${bester.dx * faktor}/${bester.dy * faktor} px, Maßstab ${bester.s.toFixed(2)}, ` +
    `Stück belegt ${(anteil * 100).toFixed(1)} % des Bildes`,
);

if (vorschau) {
  // Auf ROTEM Grund (CLAUDE.md): Schachbrett und grüne Säume fallen dort auf.
  const basis = await sharp(BASIS).toBuffer();
  await sharp({ create: { width: RAHMEN.b * 2 + 20, height: RAHMEN.h, channels: 4, background: { r: 190, g: 40, b: 40, alpha: 1 } } })
    .composite([
      { input: imRahmen, left: 0, top: 0 },
      { input: basis, left: RAHMEN.b + 20, top: 0 },
      { input: imRahmen, left: RAHMEN.b + 20, top: 0 },
    ])
    .png()
    .toFile(vorschau);
  console.log(`Vorschau (links nur das Stück, rechts angezogen): ${vorschau}`);
}
