#!/usr/bin/env node
/**
 * Rohschnitt fuer Ad 3, Variante 1 „Fehlt noch einer" — genau nach der Tabelle
 * in docs/werbung/ad-3/konzept.md (0,0–21,0 s), 1080 × 1920, 30 fps, H.264.
 *
 *   node werkzeug/store/schnitt-ad3.mjs <eingabeordner> <ausgabe.mp4> [--aufnahmen <ordner>] [--belege <ordner>] [--behalten]
 *
 *   <eingabeordner>   Runway-Clips H1, H2, H3, R1, R2, R3 (mp4/mov/webm). Erkannt
 *                     wird das Kuerzel als eigenes Wort im Dateinamen
 *                     („h1.mp4", „ad3-H1-sofa_v2.mp4"), Gross/klein egal.
 *   --aufnahmen       Ordner mit B1–B3 aus `clips.mjs --szene ad3`; Vorgabe ist
 *                     der Eingabeordner. Die Namen dort („15-ad3-wartesaal-b1-…")
 *                     tragen das Kuerzel ebenso als eigenes Wort.
 *   --belege          legt je Abdeckung ein Standbild aus dem FERTIGEN Schnitt ab
 *                     (Dateiname nennt die Sekunde).
 *   --behalten        Zwischenteile nicht loeschen.
 *
 * Fehlt ein Clip, steht an seiner Stelle eine dunkle Tafel „H2 · Runway folgt" in der
 * richtigen Laenge, MIT der Einblendung darueber — so laesst sich der Schnitt
 * schon abnehmen, bevor Runway fertig ist, und ein zweiter Lauf mit den neuen
 * Clips braucht keine Handarbeit. B1–B3 duerfen nicht fehlen: Ihre
 * Abdeckungen sind auf genau diese Aufnahmen vermessen (siehe AUFNAHMEN).
 *
 * Die Einblendungen rendert Chromium (Playwright liegt hier ohnehin fuer
 * clips.mjs) als durchsichtige PNG; ffmpegs drawtext braucht unter Windows eine
 * Fontconfig, die es dort nicht gibt, und setzt Umlaute und Laufweite schlechter.
 *
 * Der Ton der Runway-Clips wird verworfen (die Ad ist ohne Ton gebaut, die
 * Muender sind nicht lippensynchron). Statt gar keiner Tonspur liegt Stille
 * darunter — manche Plattformen behandeln ein Video ohne Tonspur gesondert.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HIER = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HIER, '../../packages/client/public');
const B = 1080;
const H = 1920;
const FPS = 30;
// Reels/TikTok legen Beschreibung und Knoepfe ueber das untere Fuenftel und
// den rechten Rand. Alles Gesetzte bleibt links von RECHTS und ueber UNTEN.
const LINKS = 70;
const RECHTS = B - 170;
const UNTEN = Math.round(H * 0.8);

// ---------------------------------------------------------------------------
// Die Tabelle. Zeiten in Sekunden des fertigen Schnitts.

const ABLAUF = [
  { kuerzel: 'H1', von: 0.0, bis: 2.5, text: 'Ich mach heute Abend nen Doppelkopftisch auf.' },
  { kuerzel: 'B1', von: 2.5, bis: 4.5 },
  { kuerzel: 'R1', von: 4.5, bis: 6.0, text: 'Nele: Bin drin.' },
  { kuerzel: 'R2', von: 6.0, bis: 7.5, text: 'Kalle: Bin drin.' },
  { kuerzel: 'B2', von: 7.5, bis: 9.5, text: '3 von 4. Fehlt: Basti.' },
  { kuerzel: 'H2', von: 9.5, bis: 11.5, text: 'Basti …?' },
  { kuerzel: 'R3', von: 11.5, bis: 13.5, text: 'Basti: Bin im Bus. Bin drin.' },
  { kuerzel: 'B3', von: 13.5, bis: 17.0, text: 'Erster Stich: Basti.' },
  { kuerzel: 'H3', von: 17.0, bis: 19.0, text: 'Euren Tisch macht ihr auf www.brauweg-spielen.de auf.' },
  { kuerzel: 'ENDE', von: 19.0, bis: 21.0 },
];

// ---------------------------------------------------------------------------
// Die Bildschirmaufnahmen: welcher Ausschnitt, was abgedeckt wird. Alle Masse
// sind in Pixeln und Sekunden der ROHAUFNAHME, vermessen an den Clips vom
// 21.10.2026 (clips.mjs, brauweg #317). Eine neue Aufnahme verschiebt das
// Layout — dann hier neu messen, sonst rutscht eine Abdeckung neben den QR-Code.
// Die Farben sind aus denselben Bildern abgegriffen (Seite, Karte, Sitzzeile).

const SEITE = '0x251709';
const KARTE = '0x2C2016';
const ZEILE = '0x221810';

const AUFNAHMEN = {
  // Wartesaal, Tipp auf „Link teilen" bei 2,0 s; ab 2,1 s steht „Link kopiert …"
  // darunter, und alles darunter rutscht 75 px tiefer.
  B1: {
    ab: 1.0,
    hinweis: 2.1,
    abdecken: [
      // „Bot-Stärke" — Ad 3 erzaehlt von Freunden, kein Bot-Wort im Bild.
      { x: 60, y: 128, b: 960, h: 132, farbe: SEITE },
      // QR-Code (fuehrt nach staging)
      { x: 236, y: 533, b: 608, h: 608, farbe: KARTE },
      // Adresse unter dem Knopf, vor und nach dem Hinweis
      { x: 90, y: 1300, b: 900, h: 62, farbe: KARTE, bis: 2.1 },
      { x: 90, y: 1376, b: 900, h: 62, farbe: KARTE, von: 2.1 },
      // „+ Bot" am freien Platz, vor und nach dem Hinweis
      { x: 826, y: 1708, b: 166, h: 100, farbe: ZEILE, bis: 2.1 },
      // der dritte Platz lugt vor dem Hinweis unten ins Bild
      { x: 826, y: 1868, b: 166, h: 52, farbe: ZEILE, bis: 2.1 },
      { x: 826, y: 1782, b: 166, h: 100, farbe: ZEILE, von: 2.1 },
    ],
  },
  // 3 von 4: Bro, Nele, Kalle sitzen, Platz vier ist frei. Steht von etwa
  // 13,5 bis 16,6 s, danach kommt Bastis Anfrage — die darf noch nicht ins Bild.
  B2: {
    ab: 14.0,
    abdecken: [
      { x: 236, y: 255, b: 608, h: 608, farbe: KARTE },
      { x: 90, y: 1022, b: 900, h: 62, farbe: KARTE },
      { x: 826, y: 1795, b: 166, h: 100, farbe: ZEILE },
    ],
  },
  // Dritte und vierte Karte, „Na sowas!" ab 8,13 s, Stich geht bei etwa 9,0 s an Basti.
  B3: {
    ab: 6.0,
    // Der Zuruf steht in der Aufnahme am rechten Rand und ist dort abgeschnitten
    // („Na sowas" ohne „!"). Darueber kommt erst ein Stueck sauberer Hintergrund
    // aus einem Bild kurz VOR dem Zuruf, dann derselbe Zuruf als Bild aus der App,
    // so weit nach links geschoben, dass er ganz im Bild steht.
    zuruf: {
      ab: 8.13,
      flicken: { zeit: 8.0, x: 850, y: 286, b: 230, h: 76 },
      bild: 'hub/spruch-na-sowas.png',
      x: 785,
      y: 265,
      b: 275,
    },
  },
};

// ---------------------------------------------------------------------------

function abbruch(text) {
  console.error(text);
  process.exit(1);
}

function argumente(liste) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < liste.length; i++) {
    const a = liste[i];
    if (a === '--behalten') opt.behalten = true;
    else if (a === '--aufnahmen' || a === '--belege') {
      if (!liste[i + 1]) abbruch(`${a} braucht einen Ordner.`);
      opt[a.slice(2)] = resolve(liste[++i]);
    } else if (a.startsWith('--')) abbruch(`Unbekannte Angabe ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 2) {
    abbruch('Aufruf: node werkzeug/store/schnitt-ad3.mjs <eingabeordner> <ausgabe.mp4> [--aufnahmen <ordner>] [--belege <ordner>] [--behalten]');
  }
  return { eingabe: resolve(pos[0]), ausgabe: resolve(pos[1]), ...opt };
}

/** Datei, deren Name das Kuerzel als eigenes Wort traegt; bei mehreren die juengste. */
function finde(ordner, kuerzel) {
  if (!existsSync(ordner)) return null;
  const k = kuerzel.toLowerCase();
  const treffer = readdirSync(ordner)
    .filter((n) => ['.mp4', '.mov', '.webm', '.m4v'].includes(extname(n).toLowerCase()))
    .filter((n) => basename(n, extname(n)).toLowerCase().split(/[^a-z0-9]+/).includes(k))
    .map((n) => join(ordner, n))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (treffer.length > 1) console.warn(`  ${kuerzel}: ${treffer.length} Dateien, nehme die juengste: ${basename(treffer[0])}`);
  return treffer[0] ?? null;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error) abbruch(`ffmpeg nicht startbar: ${r.error.message}`);
  if (r.status !== 0) abbruch(`ffmpeg ist gescheitert:\n${r.stderr}`);
}

function dauerVon(datei) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', datei], { encoding: 'utf8' });
  return Number.parseFloat(r.stdout);
}

function datenUrl(pfad) {
  return `data:image/png;base64,${readFileSync(pfad).toString('base64')}`;
}

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Gesetztes: Einblendung, Chat-Blase, Platzhaltertafel, Endkarte.

const GRUND = `
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${B}px; height: ${H}px; background: transparent; overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .feld { position: absolute; left: ${LINKS}px; width: ${RECHTS - LINKS}px; display: flex; justify-content: center; }
`;

/** Einblendung: weisse, fette Schrift auf dunkler Platte, mittig in der sicheren Zone. */
function einblendungHtml(text, mitteY) {
  return `<style>${GRUND}
    .feld { top: ${mitteY}px; transform: translateY(-50%); }
    .platte { background: rgba(14, 9, 5, 0.78); color: #fff; font-weight: 700; font-size: 62px;
      line-height: 1.18; text-align: center; padding: 22px 34px 26px; border-radius: 26px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.45); }
  </style><div class="feld"><div class="platte">${esc(text)}</div></div>`;
}

/**
 * Neutrale Chat-Blase — bewusst kein Messenger-Look (konzept.md: WhatsApp,
 * Signal, Telegram sind Marken). Die Adresse ist die der Produktion.
 */
function chatBlaseHtml(code) {
  return `<style>${GRUND}
    .feld { top: 560px; }
    .blase { position: relative; background: #f4efe6; color: #1b140d; border-radius: 34px 34px 34px 8px;
      padding: 30px 38px 32px; width: 760px; box-shadow: 0 10px 34px rgba(0,0,0,0.5); }
    .wer { font-size: 30px; font-weight: 700; color: #8a5a1c; margin-bottom: 8px; }
    .text { font-size: 50px; font-weight: 700; line-height: 1.15; }
    /* 35 statt 38 px: Mit www davor brach der Link sonst im Code um („FUXHY / A"). */
    .link { margin-top: 18px; font-size: 35px; color: #2459c4; text-decoration: underline; word-break: break-all; }
  </style><div class="feld"><div class="blase">
    <div class="wer">Bro</div>
    <div class="text">Heute 20 Uhr. Wer ist dabei?</div>
    <div class="link">www.brauweg-spielen.de/beitritt/${esc(code)}</div>
  </div></div>`;
}

function tafelHtml(kuerzel) {
  return `<style>${GRUND}
    body { background: radial-gradient(circle at 50% 40%, #2b2017 0%, #120c07 75%); }
    .feld { top: 520px; flex-direction: column; align-items: center; gap: 18px; color: #d9c7a8; text-align: center; }
    .k { font-size: 78px; white-space: nowrap; font-weight: 800; letter-spacing: 4px; }
    .u { font-size: 42px; color: #9b8a70; }
  </style><div class="feld"><div class="k">${esc(kuerzel)} · Runway folgt</div><div class="u">Platzhalter in der Länge laut Tabelle</div></div>`;
}

function endkarteHtml() {
  return `<style>${GRUND}
    body { background: radial-gradient(circle at 50% 38%, #3a2a1b 0%, #1a110a 70%, #0f0905 100%); }
    .feld { top: 360px; flex-direction: column; align-items: center; text-align: center; color: #f3e9d8; }
    .icon { width: 260px; height: 260px; border-radius: 58px; box-shadow: 0 12px 40px rgba(0,0,0,0.55); }
    .titel { margin-top: 64px; font-size: 56px; white-space: nowrap; font-weight: 800; }
    .zeile { margin-top: 54px; font-size: 44px; color: #cdbb9c; }
    /* Seit der Umstellung auf www (die Domain ohne www hat kein
       Zertifikat) brach die Adresse bei 76 px am Bindestrich um. Einzeilig
       erzwingen und so klein setzen, dass sie in die 840 px der sicheren Zone passt. */
    .adresse { margin-top: 10px; font-size: 64px; white-space: nowrap; font-weight: 800; color: #e7b54a; }
    /* Platzhalter fuer das offizielle Abzeichen „Laden im App Store" (3:1). Das
       Original kommt erst nach der Veroeffentlichung und nie ins Repo. */
    .abzeichen { margin-top: 90px; width: 420px; height: 140px; border: 4px dashed #8f7d60; border-radius: 22px;
      display: flex; align-items: center; justify-content: center; font-size: 34px; color: #b3a183; }
  </style><div class="feld">
    <img class="icon" src="${datenUrl(join(PUBLIC, 'icon-512.png'))}">
    <div class="titel">Brauweg · Doppelkopf · Skat</div>
    <div class="zeile">Jetzt im Browser spielen:</div>
    <div class="adresse">www.brauweg-spielen.de</div>
    <div class="abzeichen">App-Store-Abzeichen</div>
  </div>`;
}

function zurufHtml(z) {
  return `<style>${GRUND}
    img { position: absolute; left: ${z.x}px; top: ${z.y}px; width: ${z.b}px; }
  </style><img src="${datenUrl(join(PUBLIC, z.bild))}">`;
}

async function rendern(seite, html, ziel) {
  await seite.setContent(`<!doctype html><meta charset="utf-8">${html}`);
  await seite.evaluate(() => document.fonts.ready);
  await seite.screenshot({ path: ziel, omitBackground: true });
  return ziel;
}

// ---------------------------------------------------------------------------
// Ein Teil je Tabellenzeile, alle mit gleichen Parametern, damit das
// Aneinanderhaengen ohne neues Kodieren geht.

const KODIEREN = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'smpte170m', '-color_primaries', 'smpte170m', '-color_trc', 'smpte170m', '-r', String(FPS), '-an'];

function zeitfenster(von, bis, ab) {
  const a = von === undefined ? 0 : Math.max(0, von - ab);
  const e = bis === undefined ? 9999 : bis - ab;
  return `between(t,${a.toFixed(3)},${e.toFixed(3)})`;
}

/** Quelle (Video oder Standbild) + Kette aus Abdeckungen und Ueberlagerungen. */
function teil({ quelle, standbild = false, ab = 0, dauer, abdecken = [], ueber = [], ziel }) {
  const ein = standbild
    ? ['-loop', '1', '-framerate', String(FPS), '-t', String(dauer), '-i', quelle]
    : ['-ss', String(ab), '-t', String(dauer), '-i', quelle];
  const kette = [
    `[0:v]setpts=PTS-STARTPTS,fps=${FPS},scale=${B}:${H}:force_original_aspect_ratio=increase,crop=${B}:${H},setsar=1,` +
      // Die Aufnahmen sind Vollbereich (yuvj420p). drawbox rechnet in YUV mit
      // eingeschraenktem Bereich, die abgegriffenen Farben kamen so sichtbar
      // heller heraus; in RGB stimmen sie aufs Pixel.
      `format=rgb24,` +
      // Ist ein Runway-Clip kuerzer als sein Platz, steht das letzte Bild weiter.
      `tpad=stop_mode=clone:stop_duration=${dauer},trim=duration=${dauer}`,
  ];
  for (const k of abdecken) {
    kette[0] += `,drawbox=x=${k.x}:y=${k.y}:w=${k.b}:h=${k.h}:color=${k.farbe}:t=fill:enable='${zeitfenster(k.von, k.bis, ab)}'`;
  }
  kette[0] += '[v0]';
  const letzte = `[v${ueber.length}]`;
  const eingaenge = [];
  ueber.forEach((u, i) => {
    eingaenge.push('-loop', '1', '-framerate', String(FPS), '-t', String(dauer), '-i', u.bild);
    const n = i + 1;
    const blende = u.einblenden !== undefined ? `,fade=in:st=${u.einblenden.toFixed(3)}:d=0.18:alpha=1` : '';
    kette.push(`[${n}:v]format=rgba,setpts=PTS-STARTPTS${blende}[o${n}]`);
    const wann = u.ab !== undefined ? `:enable='gte(t,${u.ab.toFixed(3)})'` : '';
    kette.push(`[v${i}][o${n}]overlay=${u.x ?? 0}:${u.y ?? 0}:shortest=1${wann}[v${n}]`);
  });
  kette.push(`${letzte}format=yuv420p[fertig]`);
  ffmpeg([...ein, ...eingaenge, '-filter_complex', kette.join(';'), '-map', '[fertig]', '-t', String(dauer), ...KODIEREN, ziel]);
}

// ---------------------------------------------------------------------------

async function main() {
  const arg = argumente(process.argv.slice(2));
  const aufnahmen = arg.aufnahmen ?? arg.eingabe;
  if (!existsSync(arg.eingabe)) console.warn(`Eingabeordner ${arg.eingabe} fehlt — alle Runway-Clips werden Tafeln.`);
  const arbeit = join(dirname(arg.ausgabe), `${basename(arg.ausgabe, extname(arg.ausgabe))}-teile`);
  rmSync(arbeit, { recursive: true, force: true });
  mkdirSync(arbeit, { recursive: true });

  const quellen = {};
  for (const z of ABLAUF) {
    if (z.kuerzel === 'ENDE') continue;
    const ordner = z.kuerzel.startsWith('B') ? aufnahmen : arg.eingabe;
    quellen[z.kuerzel] = finde(ordner, z.kuerzel);
    if (!quellen[z.kuerzel] && z.kuerzel.startsWith('B')) abbruch(`${z.kuerzel} fehlt in ${ordner} — ohne die Bildschirmaufnahme gibt es keinen Schnitt.`);
  }

  // Der Code im Wartesaal steht gross im Bild; die Blase nennt denselben.
  const code = process.env.AD3_CODE ?? 'FUXHYA';

  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: B, height: H } });
  const png = (name) => join(arbeit, `${name}.png`);
  const bilder = {};
  for (const z of ABLAUF) {
    if (z.text) bilder[`text-${z.kuerzel}`] = await rendern(seite, einblendungHtml(z.text, z.kuerzel === 'B2' ? 560 : z.kuerzel === 'B3' ? 1200 : 1250), png(`text-${z.kuerzel}`));
    if (/^[HR]/.test(z.kuerzel) && !quellen[z.kuerzel]) bilder[`tafel-${z.kuerzel}`] = await rendern(seite, tafelHtml(z.kuerzel), png(`tafel-${z.kuerzel}`));
  }
  bilder.blase = await rendern(seite, chatBlaseHtml(code), png('blase'));
  bilder.ende = await rendern(seite, endkarteHtml(), png('ende'));
  bilder.zuruf = await rendern(seite, zurufHtml(AUFNAHMEN.B3.zuruf), png('zuruf'));
  await browser.close();

  // Sauberer Hintergrund hinter dem abgeschnittenen Zuruf, aus der Aufnahme selbst.
  const z3 = AUFNAHMEN.B3.zuruf;
  const flicken = png('flicken');
  ffmpeg(['-ss', String(z3.flicken.zeit), '-i', quellen.B3, '-frames:v', '1', '-vf', `crop=${z3.flicken.b}:${z3.flicken.h}:${z3.flicken.x}:${z3.flicken.y}`, '-update', '1', flicken]);

  const teile = [];
  const bericht = [];
  for (const [i, z] of ABLAUF.entries()) {
    const dauer = +(z.bis - z.von).toFixed(3);
    const ziel = join(arbeit, `teil-${String(i).padStart(2, '0')}-${z.kuerzel}.mp4`);
    const text = bilder[`text-${z.kuerzel}`] ? [{ bild: bilder[`text-${z.kuerzel}`] }] : [];
    let art;
    if (z.kuerzel === 'ENDE') {
      teil({ quelle: bilder.ende, standbild: true, dauer, ziel });
      art = 'Endkarte (gesetzt, Platzhalter statt App-Store-Abzeichen)';
    } else if (z.kuerzel.startsWith('B')) {
      const a = AUFNAHMEN[z.kuerzel];
      const ueber = [...text];
      if (z.kuerzel === 'B1') ueber.push({ bild: bilder.blase, ab: a.hinweis - a.ab + 0.05, einblenden: a.hinweis - a.ab + 0.05 });
      if (z.kuerzel === 'B3') {
        const ab = a.zuruf.ab - a.ab;
        ueber.unshift({ bild: flicken, x: a.zuruf.flicken.x, y: a.zuruf.flicken.y, ab }, { bild: bilder.zuruf, ab });
      }
      teil({ quelle: quellen[z.kuerzel], ab: a.ab, dauer, abdecken: a.abdecken ?? [], ueber, ziel });
      art = `Bildschirmaufnahme ${basename(quellen[z.kuerzel])} ab ${a.ab.toFixed(2)} s`;
    } else if (quellen[z.kuerzel]) {
      const lang = dauerVon(quellen[z.kuerzel]);
      teil({ quelle: quellen[z.kuerzel], ab: 0, dauer, ueber: text, ziel });
      art = `Runway ${basename(quellen[z.kuerzel])} 0.0–${dauer.toFixed(1)} s${lang < dauer ? ` (nur ${lang.toFixed(2)} s lang, letztes Bild steht)` : ''}`;
    } else {
      teil({ quelle: bilder[`tafel-${z.kuerzel}`], standbild: true, dauer, ueber: text, ziel });
      art = `TAFEL „${z.kuerzel} · Runway folgt"`;
    }
    teile.push(ziel);
    bericht.push(`${z.von.toFixed(1).padStart(4)}–${z.bis.toFixed(1).padStart(4)} s  ${z.kuerzel.padEnd(4)}  ${art}`);
  }

  // Aneinanderhaengen ohne neues Kodieren, Stille als Tonspur darunter.
  const liste = join(arbeit, 'liste.txt');
  writeFileSync(liste, teile.map((t) => `file '${t.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  mkdirSync(dirname(arg.ausgabe), { recursive: true });
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', liste, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', arg.ausgabe]);

  const groesse = statSync(arg.ausgabe).size;
  const gesamt = dauerVon(arg.ausgabe);
  console.log(bericht.join('\n'));
  console.log(`\n${arg.ausgabe}\n${gesamt.toFixed(2)} s, ${(groesse / 1e6).toFixed(1)} MB`);
  if (groesse >= 100e6) abbruch('Groesser als 100 MB — so nicht hochladen.');

  if (arg.belege) {
    mkdirSync(arg.belege, { recursive: true });
    // Je Abdeckung ein Bild: B1 vor und nach dem Hinweis, B2 Mitte, B3 nach dem Zuruf.
    const zeiten = [
      ['b1-vor-hinweis', 2.5 + 0.5],
      ['b1-nach-hinweis', 2.5 + 1.7],
      ['b2-drei-von-vier', 7.5 + 1.0],
      ['b3-na-sowas', 13.5 + 2.8],
      ['endkarte', 20.0],
    ];
    for (const [name, t] of zeiten) {
      ffmpeg(['-ss', t.toFixed(2), '-i', arg.ausgabe, '-frames:v', '1', '-update', '1', join(arg.belege, `${name}-${t.toFixed(2)}s.png`)]);
    }
    console.log(`Belege: ${arg.belege}`);
  }
  if (!arg.behalten) rmSync(arbeit, { recursive: true, force: true });
}

main().catch((e) => abbruch(e.stack ?? String(e)));
