/* Erzeugt die GameDesk-Tafel „GameDesk — Funktionsweise".
 *
 * GameDesk, mit seinen eigenen Mitteln abgebildet: die Seiten der Oberfläche,
 * die Ladekette des Kerns, die zehn Module, die 3D-Maschine, die
 * Änderungsverfolgung samt Medienlager, das Dateiformat, der Projektordner
 * mit Server und Broweg-Brücke, die Regeln, die das Bild ruhig halten — und
 * ein Rahmen, in dem Weiterentwicklungsideen als einzelne Notizen liegen.
 * Von dort führt ein Pfeil auf die Worker-Kachel.
 *
 * Stand des Quelltextes: 11.08.2026, 00:32 Uhr. GameDesk wächst gerade
 * schnell — wer diese Tafel auffrischt, zählt die Zeilen neu:
 *   wc -l js/core/*.js js/modules/*.js css/*.css tools/*.mjs index.html
 *
 * Die Höhen hier sind geschätzt; die Feinarbeit macht danach GD.layout im
 * Browser (passeHoehenAn misst den Text wirklich).
 *
 *   node boards/_erzeuger-gamedesk.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = 'C:/Users/freyd/Desktop/SPIDERVISION/gamedesk/boards/gamedesk-funktionsweise.gamedesk.json';

/* ===================================================================== */
/* Werkzeug                                                              */
/* ===================================================================== */

let n = 0;
const uid = (p) => p + '_gd_' + (++n).toString(36);

const wins = [];
const conns = [];
const key = new Map();          // Kurzname -> Fenster-ID

const RAND = 44;                // Luft zwischen Rahmenkante und Inhalt
const KOPF = 114;               // Kopfband mit Untertitel (gemessen)
const KOPF_OHNE = 93;           // ohne Untertitel ist der Rahmen flacher
const LUFT = 30;                // zwischen zwei Kacheln einer Spalte
const SPALTE = 40;              // zwischen Spalten ohne Pfeile
const GASSE = 520;              // zwischen Spalten, zwischen denen Pfeile laufen
const NEUTRAL = '#94a3b8';      // jeder verschachtelte Rahmen

/** Grobe Texthöhe. Der Browser misst später nach — hier zählt nur, dass die
 *  Rahmen ungefähr passen und nichts übereinanderliegt. */
function schaetzeNotiz(html, breite, fs) {
  const innen = Math.max(80, breite - 44);
  let h = 14;
  const re = /<(h1|h2|h3|p|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m, gefunden = false;
  while ((m = re.exec(html))) {
    gefunden = true;
    const tag = m[1].toLowerCase();
    const text = m[2].replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, 'x').trim();
    const gr = tag === 'h1' ? fs * 1.85 : tag === 'h2' ? fs * 1.34 : tag === 'h3' ? fs * 1.12 : fs;
    const einzug = tag === 'li' ? 24 : tag === 'blockquote' ? 20 : 0;
    const cpl = Math.max(10, (innen - einzug) / (gr * 0.502));
    const zeilen = Math.max(1, Math.ceil(text.length / cpl));
    h += zeilen * gr * 1.52 + (tag === 'li' ? 4 : 11);
  }
  if (!gefunden) h += 70;
  return Math.round(34 + 36 + h + 12);          // Titelleiste + Werkzeugleiste
}

function schaetzeCode(src, size, caption) {
  const zeilen = src.split('\n').length;
  return Math.round(34 + 46 + zeilen * size * 1.56 + (caption ? 52 : 0) + 18);
}

function fenster(k, type, titel, breite, hoehe, state, accent) {
  const id = uid('win');
  key.set(k, id);
  const w = {
    id, type, title: titel,
    x: 0, y: 0, w: breite, h: hoehe,
    z: 100 + wins.length,
    accent: accent || null, collapsed: false, state
  };
  wins.push(w);
  return w;
}

/** Notiz-Kachel. Die Höhe kommt aus der Schätzung, wenn keine genannt wird. */
function notiz(k, titel, html, opt = {}) {
  const text = html.replace(/^\n/, '').replace(/\s+$/, '');
  const breite = opt.w || 440;
  const fs = opt.fontSize || 13;
  return fenster(k, 'notes', titel, breite, opt.h || schaetzeNotiz(text, breite, fs),
    { html: text, fontSize: fs }, opt.accent || '#57c98a');
}

function quell(k, titel, pfad, src, opt = {}) {
  const code = src.replace(/^\n/, '').replace(/\s+$/, '');
  const breite = opt.w || 520;
  const size = opt.size || 11;
  return fenster(k, 'code', titel, breite, opt.h || schaetzeCode(code, size, opt.caption),
    {
      path: pfad, code, firstLine: opt.firstLine || 1, size,
      wrap: false, marks: opt.marks || [], caption: opt.caption || ''
    }, opt.accent || '#8fa4c4');
}

/** Spalten nebeneinander, Kacheln darin untereinander. Liefert den Kasten. */
function setze(x0, y0, spalten, gasse) {
  const abstand = gasse === undefined ? SPALTE : gasse;
  let x = x0, x2 = x0, y2 = y0;
  for (const spalte of spalten) {
    let y = y0, breite = 0;
    for (const eintrag of spalte) {
      const w = typeof eintrag === 'string' ? holen(eintrag) : eintrag;
      w.x = Math.round(x);
      w.y = Math.round(y);
      y += w.h + LUFT;
      breite = Math.max(breite, w.w);
    }
    x += breite + abstand;
    x2 = Math.max(x2, x - abstand);
    y2 = Math.max(y2, y - LUFT);
  }
  return { x: x0, y: y0, w: x2 - x0, h: y2 - y0 };
}

function holen(k) {
  const id = key.get(k);
  const w = id && wins.find((v) => v.id === id);
  if (!w) throw new Error('unbekanntes Fenster: ' + k);
  return w;
}

/** Rahmen um einen Kasten. */
function lege(k, titel, kasten, opt = {}) {
  const kopf = opt.note ? KOPF : KOPF_OHNE;
  const rand = opt.rand === undefined ? RAND : opt.rand;
  const id = uid('win');
  key.set(k, id);
  const f = {
    id, type: 'frame', title: titel,
    x: Math.round(kasten.x - rand),
    y: Math.round(kasten.y - rand - kopf),
    w: Math.round(kasten.w + rand * 2),
    h: Math.round(kasten.h + rand * 2 + kopf),
    z: opt.z || 1,
    accent: opt.tint || NEUTRAL, collapsed: false,
    state: {
      tint: opt.tint || NEUTRAL,
      strength: opt.strength === undefined ? 0.08 : opt.strength,
      dashed: !!opt.dashed,
      note: opt.note || '',
      bereich: opt.bereich || null,
      kopfX: 0, kopfY: 0
    }
  };
  wins.unshift(f);
  return f;
}

function link(a, b, label, opt = {}) {
  conns.push({
    id: uid('con'),
    from: { win: key.get(a), side: opt.from || 'auto', shape: null },
    to: { win: key.get(b), side: opt.to || 'auto', shape: null },
    label: label || '',
    labelSize: opt.size || 12,
    t: opt.t === undefined ? null : opt.t,
    color: opt.color || '#6ea8fe',
    width: opt.width || 2,
    dash: opt.dash || 'solid',
    curve: opt.curve || 'ortho',
    heads: opt.heads || 'end',
    bundle: opt.bundle || null
  });
}

/* Farben der Bereiche (dieselben wie in js/core/layout.js) */
const C = {
  menues: '#6ea8fe', game: '#57c98a', technik: '#8fa4c4', mechanik: '#4fd1c5',
  daten: '#e8b45c', betrieb: '#ef6b6b', gamedesign: '#b78cf7', sonstiges: '#94a3b8'
};

/* ===================================================================== */
/* A · Seiten & Oberfläche                                               */
/* ===================================================================== */

quell('a-index', 'index.html — das ganze Gerüst', 'gamedesk/index.html', `
<body>
 <div id="app">
   <header id="topbar"> Marke · ↺ ↻ · Zoom · ▦ ⊹ ◱ · ⤡ Anordnen ·
                        ⬚ Aenderungssicht + Aenderungen ·
                        ← Zurueck · Projekte · Neu · Oeffnen · Speichern ·
                        ⚙ ◐ ? </header>
   <aside  id="palette">  Modulliste (aus GD.modules.list())  </aside>

   <main id="board" tabindex="0">
     <div id="world">                     <!-- traegt Zoom + Versatz -->
       <svg id="conn-layer">              <!-- Pfeile, ueber den Fenstern -->
       <div id="win-layer">               <!-- Fenster, zwei Baender -->
       <div id="frame-layer">             <!-- Rahmenkoepfe -->
       <svg id="diff-layer">              <!-- Aenderungssicht, rote Kaesten -->
       <svg id="guide-layer">             <!-- rosa Hilfslinien -->
     </div>
     <div id="label-layer"></div>         <!-- Pfeil- und Diff-Beschriftung -->
     <div id="marquee"></div>             <!-- Auswahlrechteck -->
     <div id="board-empty"></div>
   </main>

   <aside id="inspector"><div id="insp-body"></div></aside>

   <div id="minimap">…</div>  <div id="toasts"></div>
   <div id="ctxmenu"></div>   <div id="modal-root"></div>
 </div>

 <script src="js/core/util.js"></script>       <!-- 1  Fundament -->
 …                                              <!-- 17 Kerndateien -->
 <script src="js/modules/frame.js"></script>    <!-- 10 Module -->
 …
 <script src="js/modules/worker.js"></script>
 <script src="js/core/app.js"></script>         <!-- zuletzt: Start -->
</body>`, {
  w: 560, size: 10.5,
  marks: [1, 2],
  caption: 'Klassische <script>-Tags ohne Import — nur so lässt sich index.html auch per Doppelklick über file:// öffnen. Die Reihenfolge IST die Abhängigkeitskette.'
});

notiz('a-topbar', 'Werkzeugleiste — #topbar', `
<h3>Sieben Gruppen, links nach rechts</h3>
<ul>
<li><b>Marke + Boardname</b> — das Eingabefeld schreibt <code>doc.name</code></li>
<li><b>↺ ↻</b> — Rückgängig / Wiederherstellen</li>
<li><b>− 100 % + ⤢</b> — Zoom, Zurücksetzen, alles einpassen</li>
<li><b>▦ ⊹ ◱</b> — Raster, Einrasten, Übersichtskarte</li>
<li><b>⤡ Anordnen</b> — setzt die fünf Regeln durch (<code>GD.layout.aufraeumen</code>)</li>
<li><b>⬚ + Änderungen</b> <span style="color:#e8b45c">(neu)</span> — die Änderungssicht
(<code>Strg+Umschalt+D</code>) rahmt alles rot ein, was seit dem letzten Commit anders
ist; die Zahl am Knopf zählt die offenen Änderungen</li>
<li><b>← Zurück · 🗀 Projekte · Neu · Öffnen… · Speichern</b> — der Zurück-Knopf steht nur
da, wenn man über eine Projekt-Kachel hergekommen ist; der Speichern-Knopf trägt einen
grünen Punkt, sobald das Board mit einer Datei verknüpft ist</li>
<li><b>⚙ ◐ ?</b> — Einstellungen, Hell/Dunkel, Hilfe</li>
</ul>`, { accent: C.menues });

notiz('a-palette', 'Palette — #palette', `
<p>Die Liste baut sich aus <code>GD.modules.list()</code>: Symbol, Bezeichnung, Kurztext.
Ein <b>Klick</b> legt das Modul in die Mitte der Sicht, <b>Ziehen</b> auf das Board legt es
dorthin, wo man loslässt.</p>
<p>Ein neues Modul erscheint hier von allein — es gibt keine zweite Liste, die man
nachpflegen müsste. Zuletzt kam so <b>⚗ Worker</b> dazu.</p>`, { accent: C.menues });

notiz('a-board', 'Board — #board / #world', `
<h3>Fünf Ebenen in einer Welt</h3>
<p><code>#world</code> trägt <b>eine</b> Transformation (Versatz + Maßstab). Alles darin
rechnet in Weltkoordinaten, nichts rechnet den Zoom selbst nach.</p>
<ul>
<li><code>#conn-layer</code> — die Pfeile, z-index 2 500 000: sie liegen <b>über</b> den
Fenstern</li>
<li><code>#win-layer</code> — die Fenster, in zwei Stapelbändern (Rahmen unten)</li>
<li><code>#frame-layer</code> — die Rahmenüberschriften, z-index 2 400 000</li>
<li><code>#diff-layer</code> — die roten Kästen der Änderungssicht</li>
<li><code>#guide-layer</code> — die rosa Hilfslinien beim Einrasten</li>
</ul>
<p><code>#label-layer</code> und <code>#marquee</code> liegen <b>außerhalb</b> von
<code>#world</code>: Pfeilbeschriftungen und die Reiter der Änderungssicht behalten ihre
Pixelgröße, das Auswahlrechteck seine Strichstärke.</p>`, { accent: C.menues });

notiz('a-inspector', 'Inspector — #inspector', `
<h3>Fünf Gesichter, je nach Auswahl</h3>
<ul>
<li><b>nichts gewählt</b> — Board: Name, Raster, Zoom, Zahlen zum Bestand</li>
<li><b>ein Fenster</b> — Titel, Position, Größe, Farbe, Einklappen, Löschen; darunter
hängt <code>inst.inspector(host)</code>, der Teil des Moduls</li>
<li><b>mehrere Fenster</b> — Ausrichten, Verteilen, gemeinsame Farbe</li>
<li><b>ein Pfeil</b> — Beschriftung und Schriftgröße, Farbe, Stärke, Linienstil,
Verlauf, Pfeilspitzen, Ankerpunkte, Bündelzugehörigkeit</li>
<li><b>ein Bündel</b> — Name, Farbe, Dicke, Aderabstand, Stranglänge, Adern lösen</li>
</ul>
<p>Die Bausteine der Felder stehen als <code>GD.ui.fields</code> bereit
(<code>title · row · full · grid · sel · chk · range · num · text · btn · note</code>) —
ein Modul baut seinen Inspector aus denselben Teilen wie der Kern.</p>`, { accent: C.menues });

notiz('a-neben', 'Übersichtskarte · Meldungen · Kontextmenü', `
<h3>#minimap</h3>
<p>Zeichnet alle Fenster als Rechtecke in der Farbe ihres Moduls, Rahmen blass darunter,
dazu der Ausschnitt der Sicht. Klicken springt dorthin.</p>
<h3>#toasts</h3>
<p><code>GD.ui.toast(text, kind)</code> — <code>ok</code>, <code>err</code> oder neutral.
Alles, was schiefgehen kann, meldet sich hier statt in der Konsole.</p>
<h3>#ctxmenu</h3>
<p>Drei Fassungen: auf einem <b>Pfeil</b> (beschriften, Richtung umkehren, löschen), auf
einem <b>Fenster</b> (duplizieren, ein-/ausklappen, nach vorn/hinten, einpassen, löschen)
und auf <b>leerer Fläche</b> (jedes Modul einfügen, alles auswählen, einpassen, 100 %).</p>
<h3>#modal-root</h3>
<p>Trägt die vier Dialoge. <code>GD.ui.modal(node, opts)</code> und
<code>GD.ui.confirm(titel, text, okLabel)</code>.</p>`, { accent: C.menues });

notiz('a-dlg-projekte', 'Dialog „Projekte" — Strg+P', `
<p>Die Tafeln im Bibliotheksordner mit Namen, Datum, Umfang und Modul-Aufteilung.</p>
<ul>
<li>öffnen · umbenennen · kopieren · löschen</li>
<li>neues Projekt anlegen</li>
<li>„aktuelles Board hier ablegen"</li>
</ul>
<p>Ein geöffnetes Projekt bleibt mit seiner Datei <b>verknüpft</b> — der Speichern-Knopf
schreibt danach direkt dorthin.</p>`, { accent: C.menues });

notiz('a-dlg-aend', 'Dialog „Änderungen" — Strg+Umschalt+A', `
<p>Was seit dem letzten Commit offen ist, als Liste einzelner Befunde: Klasse
(neu · entfernt · Inhalt · Titel · Größe · verschoben · Darstellung), betroffene Kachel,
je ein <b>„zeigen"</b>-Knopf.</p>
<ul>
<li>Schalter <b>Änderungssicht an/aus</b></li>
<li><b>Stand festschreiben</b> — Titel, Text und <i>wer</i> (Mensch oder KI)</li>
<li>darunter der Commit-Verlauf; jeder Commit zeigt seine Änderungsliste und lässt sich
löschen</li>
</ul>
<p>Aus einem Skript heraus geht dasselbe über
<code>GD.aenderungen.festschreiben({ titel, wer: 'ki' })</code>, außerhalb des Browsers
über <code>tools/festschreiben.mjs</code>.</p>`, { accent: C.menues });

notiz('a-dlg-einst', 'Dialog „Einstellungen" — ⚙', `
<h3>Projektordner</h3>
<p>Zugriff über <b>GameDesk-Server</b> (Pfad frei eintippen, wird in
<code>tools/bibliothek.json</code> gemerkt) oder <b>Ordnerdialog des Browsers</b>.
Dazu: welche Datei mit diesem Board verknüpft ist, Verknüpfung lösen und
<b>„Automatisch in die Datei"</b> (Vorgabe: aus).</p>
<h3>Darstellung</h3>
<p>Hell/Dunkel, Übersichtskarte, Raster anzeigen, Einrasten, Rastermaß.</p>
<h3>Anordnung</h3>
<p>Der Prüfbericht aus <code>GD.layout.pruefe()</code>: was die fünf Regeln gerade
bemängeln, je mit einem <b>„zeigen"</b>-Knopf, der zur Stelle springt, plus
„Jetzt anordnen" und „Erneut prüfen".</p>
<h3>Speicher</h3>
<p>Wie viel dieses Board im Browser-Speicher belegt, Anzahl Module und Fenster,
„Als Datei exportieren".</p>`, { accent: C.menues });

notiz('a-dlg-hilfe', 'Dialog „Hilfe" — ?', `
<p>Fünf Blöcke Tastenkürzel: <b>Board</b>, <b>Fenster</b>, <b>Pfeile</b>,
<b>3D-Modell</b>, <b>Allgemein</b>.</p>
<p>Die Tastenbindung selbst sitzt in <code>ui.js</code> und fragt <b>zuerst das aktive
Modul</b>: liefert <code>inst.onKey(ev)</code> ein <code>true</code>, ist die Taste
verbraucht. So darf das Wireframe <code>R</code> für „Rechteck" belegen, ohne dem Board
etwas wegzunehmen.</p>
<p>Getippt wird nie in die Kürzel hinein — <code>U.isTyping()</code> hält jede Eingabe
in Feldern und <code>contenteditable</code> heraus.</p>`, { accent: C.menues });

/* Wireframe: die Bildschirmaufteilung */
const S = [];
const sh = (o) => { S.push(Object.assign({ type: 'rect' }, o)); };
const T = (o) => { S.push(Object.assign({ type: 'text', pad: 0, strokeOn: false, fillOn: false }, o)); };

sh({ x: 0, y: 0, w: 1280, h: 800, radius: 0, fill: '#0f1218', strokeOn: false });
/* Werkzeugleiste */
sh({ x: 0, y: 0, w: 1280, h: 46, radius: 0, fill: '#171b23', stroke: '#252a35',
  text: '◈  GameDesk  ｜  ↺ ↻   − 100 % + ⤢   ▦ ⊹ ◱   ⤡ Anordnen   ⬚ Änderungen ③',
  font: { size: 12, color: '#c9d3e4', align: 'left', weight: 600 }, pad: 16 });
T({ x: 720, y: 12, w: 544, h: 22, text: '🗀 Projekte    Neu    Öffnen…    ▮ Speichern      ⚙  ◐  ?',
  font: { size: 12, color: '#9aa4b6', align: 'right' } });
/* Palette */
sh({ x: 0, y: 46, w: 104, h: 754, radius: 0, fill: '#141821', stroke: '#252a35' });
T({ x: 0, y: 60, w: 104, h: 16, text: 'MODULE', font: { size: 9, color: '#6d778b', align: 'center' } });
const palette = ['▢ Rahmen', '▧ Wireframe', '≡ Notiz', '⌗ Quelltext', '▣ Medien',
  '⬢ 3D-Modell', '◈ 3D-Ansicht', '‹› Sandbox', '🗂 Projekt', '⚗ Worker'];
palette.forEach((p, i) => {
  sh({ x: 10, y: 84 + i * 40, w: 84, h: 32, radius: 8, fill: '#1b2029', stroke: '#2a3140',
    text: p, font: { size: 9, color: '#c9d3e4', align: 'left' }, pad: 7 });
});
/* Board */
sh({ x: 104, y: 46, w: 940, h: 754, radius: 0, fill: '#0f1218', strokeOn: false });
/* ein Rahmen mit zwei Kacheln */
sh({ x: 150, y: 120, w: 470, h: 330, radius: 10, fill: '#1a2436', stroke: '#3d6ea8', dash: 'dashed' });
T({ x: 168, y: 136, w: 300, h: 26, text: 'Bereich  ·  Menüs', font: { size: 15, weight: 700, color: '#6ea8fe', align: 'left' } });
T({ x: 168, y: 162, w: 300, h: 16, text: 'Untertitel des Rahmens', font: { size: 9.5, color: '#7a8499', align: 'left' } });
sh({ x: 176, y: 240, w: 200, h: 180, radius: 8, fill: '#1b2029', stroke: '#57c98a',
  text: '≡  Notiz', font: { size: 11, color: '#c9d3e4', align: 'left', valign: 'top' }, pad: 10 });
sh({ x: 396, y: 240, w: 200, h: 180, radius: 8, fill: '#1b2029', stroke: '#8fa4c4',
  text: '⌗  Quelltext', font: { size: 11, color: '#c9d3e4', align: 'left', valign: 'top' }, pad: 10 });
/* eine Kachel rechts, dazwischen ein Pfeil */
sh({ x: 790, y: 240, w: 200, h: 180, radius: 8, fill: '#1b2029', stroke: '#4fd1c5',
  text: '⬢  3D-Modell', font: { size: 11, color: '#c9d3e4', align: 'left', valign: 'top' }, pad: 10 });
S.push({ type: 'line', x: 596, y: 330, w: 194, h: 0, stroke: '#6ea8fe', strokeW: 2, fillOn: false });
sh({ x: 646, y: 312, w: 96, h: 22, radius: 5, fill: '#171b23', stroke: '#2f3a4d',
  text: 'liefert Netz', font: { size: 9, color: '#9aa4b6' } });
/* Änderungssicht: roter Kasten mit Reiter um eine Kachel */
sh({ x: 168, y: 232, w: 216, h: 196, radius: 6, fill: '#00000000', fillOn: false,
  stroke: '#ff3b30', strokeW: 2 });
sh({ x: 168, y: 210, w: 84, h: 20, radius: 4, fill: '#ff3b30', strokeOn: false,
  text: 'Inhalt', font: { size: 9.5, color: '#ffffff', weight: 700 } });
/* Übersichtskarte */
sh({ x: 884, y: 660, w: 144, h: 100, radius: 8, fill: '#141821', stroke: '#2a3140',
  text: '◱', font: { size: 18, color: '#3f4a5e' } });
/* Inspector */
sh({ x: 1044, y: 46, w: 236, h: 754, radius: 0, fill: '#141821', stroke: '#252a35' });
T({ x: 1060, y: 66, w: 204, h: 16, text: 'FENSTER', font: { size: 9, color: '#6d778b', align: 'left' } });
['Titel', 'X / Y', 'Breite / Höhe', 'Farbe', 'Einklappen'].forEach((r, i) => {
  sh({ x: 1060, y: 90 + i * 38, w: 204, h: 28, radius: 6, fill: '#1b2029', stroke: '#2a3140',
    text: r, font: { size: 9.5, color: '#9aa4b6', align: 'left' }, pad: 8 });
});
T({ x: 1060, y: 296, w: 204, h: 16, text: 'NOTIZ', font: { size: 9, color: '#6d778b', align: 'left' } });
sh({ x: 1060, y: 320, w: 204, h: 28, radius: 6, fill: '#1b2029', stroke: '#2a3140',
  text: 'Grundgröße   13 px', font: { size: 9.5, color: '#9aa4b6', align: 'left' }, pad: 8 });
/* Beschriftungen */
T({ x: 120, y: 58, w: 240, h: 16, text: '↑ #topbar', font: { size: 10, color: '#e8b45c', align: 'left' } });
T({ x: 150, y: 470, w: 300, h: 16, text: '#diff-layer  ·  rot = seit dem letzten Commit', font: { size: 10, color: '#e8b45c', align: 'left' } });
T({ x: 150, y: 492, w: 300, h: 16, text: '#win-layer  ·  zwei Stapelbänder', font: { size: 10, color: '#e8b45c', align: 'left' } });
T({ x: 660, y: 288, w: 220, h: 16, text: '#conn-layer  liegt darüber', font: { size: 10, color: '#e8b45c', align: 'left' } });
T({ x: 884, y: 640, w: 144, h: 16, text: '#minimap', font: { size: 10, color: '#e8b45c', align: 'left' } });
T({ x: 1060, y: 776, w: 204, h: 16, text: '#inspector', font: { size: 10, color: '#e8b45c', align: 'left' } });

fenster('a-wire', 'wireframe', 'Bildschirmaufteilung', 780, 540, {
  canvas: { w: 1280, h: 800, bg: '#0f1218' },
  shapes: S, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true }
}, C.menues);

/* ===================================================================== */
/* B · Kern                                                              */
/* ===================================================================== */

notiz('b-util', 'util.js — das Fundament', `
<h3>js/core/util.js · 304 Zeilen · <code>GD.util</code></h3>
<p>Hat <b>keine</b> Abhängigkeit und legt den Namensraum <code>window.GD</code> an.</p>
<ul>
<li><code>el()</code> / <code>svg()</code> — DOM und SVG bauen, mit
<code>class · text · html · style · dataset · on*</code></li>
<li><code>drag(ev, {onMove, onEnd, cursor})</code> — <b>jede</b> Zieherei im Haus.
Lauscht auf <code>window</code> mit <code>capture</code>, deshalb funktioniert Ziehen
auch über fremde Elemente hinweg</li>
<li><code>debounce(fn, ms)</code> mit <code>.cancel()</code> und <code>.flush()</code>,
<code>raf(fn)</code>, <code>nextFrame(fn)</code> — <b>letzteres fällt im versteckten Tab
auf einen Timer zurück</b>, weil <code>requestAnimationFrame</code> dort nicht feuert</li>
<li><code>emitter()</code> — die Ereignisbusse von store, board, library, models,
aenderungen</li>
<li><code>download · pickFile · readAsDataURL · readAsText</code></li>
<li><code>wrapText · measureText · rotate · boundsOf · shade · withAlpha · clamp · uid · clone</code></li>
<li><code>isTyping()</code> — hält die Tastenkürzel aus Eingabefeldern heraus</li>
</ul>`, { accent: C.technik });

notiz('b-registry', 'registry.js — die Modul-Registry', `
<h3>js/core/registry.js · 83 Zeilen · <code>GD.modules</code></h3>
<ul>
<li><code>register(def)</code> — <code>id · label · icon · description · accent ·
defaultSize · defaultTitle · create(ctx)</code></li>
<li><code>get(id)</code> · <code>list()</code> — die Palette liest hier</li>
<li><code>fallback(id)</code> — <b>der wichtigste Teil</b>: Ein Board mit einem noch
nicht geladenen Modultyp verliert nichts. Das Fenster zeigt einen Platzhalter und gibt
seinen Zustand unverändert wieder heraus</li>
</ul>
<p>Ein neues Modul = eine Datei in <code>js/modules/</code> + ein
<code>&lt;script&gt;</code>-Tag. Kein Eintrag in einer Liste, keine Registrierung
anderswo — so ist zuletzt <code>worker.js</code> dazugekommen.</p>`, { accent: C.technik });

notiz('b-store', 'store.js — Dokument, Historie, Persistenz', `
<h3>js/core/store.js · 328 Zeilen · <code>GD.store</code></h3>
<ul>
<li><code>doc</code> — das ganze Board: <code>name · view · grid · windows ·
connections · bundles · models · aenderungen · nextZ</code></li>
<li><code>serialize()</code> — sammelt zuerst über <code>GD.windows.syncStates()</code>
alle Modulzustände ein und gibt dann einen Klon</li>
<li><code>commit(label)</code> — Schnappschuss in die Rückgängig-Historie (höchstens 60);
identische Zustände werden nicht doppelt abgelegt. <b>Nicht zu verwechseln</b> mit einem
Commit der Änderungsverfolgung</li>
<li><code>touch()</code> — Änderung <b>ohne</b> Historieneintrag (Kameraposition)</li>
<li><code>undo() / redo()</code> → Ereignis <code>doc:restored</code></li>
<li><code>save()</code> — 600 ms entprellt nach <code>localStorage</code>;
Medien liegen dabei nur als <code>depot:</code>-Verweis darin</li>
<li><code>load(raw)</code> → <code>normalize()</code> → Ereignis <code>doc:replaced</code></li>
<li>beim Schreiben in eine Datei bläst <code>GD.depot.aufblasen()</code> die Verweise
wieder zu <code>data:</code>-URLs auf — die <code>.json</code> bleibt in sich
geschlossen</li>
</ul>`, { accent: C.technik });

notiz('b-board', 'board.js — die Kamera', `
<h3>js/core/board.js · 260 Zeilen · <code>GD.board</code></h3>
<p><code>#world</code> trägt <b>eine</b> Transformation; alles andere rechnet in
Weltkoordinaten.</p>
<ul>
<li><code>setView(x, y, scale)</code> — <b>drei Zahlen, kein Objekt.</b> Ein Objekt macht
<code>view.x</code> still zu <code>NaN</code> und wird so mitgespeichert</li>
<li><code>panBy · zoomAt(clientX, clientY, faktor) · zoomBy · resetZoom · zoomToFit(rect)
· centerOn</code></li>
<li><code>screenToWorld · worldToScreen · viewCenter · viewRect · contentBounds</code></li>
<li><code>scale()</code> — der Maßstab, an dem sich Rahmenköpfe, Pfeilbeschriftungen,
Diff-Reiter und die 3D-Auflösung ausrichten</li>
<li><code>apply()</code> ist <code>raf</code>-gedrosselt und meldet <code>view</code></li>
</ul>
<p>Ziehen auf leerer Fläche, mittlere Taste und <code>Leertaste</code> verschieben;
Mausrad zoomt <b>an der Mausposition</b>, nicht in der Mitte.</p>`, { accent: C.technik });

notiz('b-windows', 'windows.js — die Fenster', `
<h3>js/core/windows.js · 708 Zeilen · <code>GD.windows</code></h3>
<ul>
<li><code>add(type, x, y, opts)</code> · <code>remove · duplicate · removeSelected</code></li>
<li><code>mount(data)</code> — holt die Moduldefinition, baut <code>ctx</code>, ruft
<code>create(ctx)</code> und hängt die Instanz ein</li>
<li><code>setGeometry(id, patch) · setTitle · setAccent · setCollapsed ·
bringToFront · sendToBack</code></li>
<li><code>select(ids, additive) · selectAll · selection · activeInstance</code></li>
<li><code>syncStates()</code> — <code>inst.getState()</code> zurück in
<code>doc.windows[].state</code></li>
<li><code>reconcile()</code> — nach Rückgängig: bestehende Instanzen behalten und mit
<code>setState()</code> füttern, statt alles neu zu bauen</li>
</ul>
<p><b>Falle:</b> <code>reconcile()</code> hängt einen <b>frischen</b> Datensatz in
<code>rec.data</code>. Closures aus <code>mount()</code> dürfen <code>data</code> nicht
einfangen — sie müssen über <code>rec.data</code> gehen.</p>
<p>Beim Verschieben rasten Kanten und Mittelachsen an anderen Fenstern ein (rosa
Hilfslinien), <code>Alt</code> schaltet das kurz aus. Ein <b>Klick</b> auf den Titel
benennt um, Ziehen an derselben Stelle verschiebt — entschieden wird beim Loslassen.</p>`, { accent: C.technik });

notiz('b-connections', 'connections.js — Pfeile und Bündel', `
<h3>js/core/connections.js · 892 Zeilen · <code>GD.connections</code></h3>
<ul>
<li><code>add(fromWin, fromSide, toWin, toSide, fromShape, toShape)</code> —
die beiden <code>shape</code>-Felder hängen ein Ende an eine <b>einzelne
Wireframe-Form</b> statt an das Fenster</li>
<li><code>update(id, patch) · remove · removeForWindow · select · editLabel</code></li>
<li><code>addBundle(ids, name) · updateBundle · toggleBundle · removeBundle ·
mitglieder(id)</code></li>
<li><code>redraw()</code> (gedrosselt) und <code>redrawNow()</code></li>
</ul>
<p><b>Pfeile laufen im rechten Winkel:</b> senkrecht aus der Kante, höchstens zweimal
abgebogen, senkrecht in die Gegenkante. Der Weg entsteht im Weltraum, die
<b>Beschriftung im Bildschirmraum</b> — sie behält ihre Pixelgröße.</p>
<p>Steht <code>t</code> auf <code>null</code>, sucht sich die Beschriftung selbst das
längste gerade Stück, das <b>neben</b> den Kacheln liegt. Eine Zahl ist eine von Hand
gesetzte Stelle und bleibt. Unter etwa 30 % Zoom blenden alle Beschriftungen aus.</p>`, { accent: C.technik });

notiz('b-minimap', 'minimap.js — die Übersichtskarte', `
<h3>js/core/minimap.js · 101 Zeilen · <code>GD.minimap</code></h3>
<p>Ein Canvas: alle Fenster als Rechtecke in der Farbe ihres Moduls, Rahmen blass
darunter, dazu der Ausschnitt der aktuellen Sicht. Klicken springt dorthin.</p>
<p>Dieselbe Idee steckt in der Vorschau der <b>Projekt-Kachel</b> — nur zeichnet die
eine <i>fremde</i> Tafel.</p>`, { accent: C.technik });

notiz('b-library', 'library.js — der Projektordner', `
<h3>js/core/library.js · 439 Zeilen · <code>GD.library</code></h3>
<p>Bildet einen Ordner auf der Platte als Projektliste ab. Zwei Wege, je nachdem wie
GameDesk läuft — Einzelheiten im Bereich <b>Bibliothek &amp; Server</b>.</p>
<ul>
<li><code>init() · status() · setModus('server' | 'ordner')</code></li>
<li><code>liste(neu) · lesen · schreiben · loeschen · umbenennen</code></li>
<li><code>oeffnen · sichern · neu · dateiName(name, vorlage)</code></li>
<li><code>hinein(datei) · zurueck() · verlauf()</code> — der Weg durch ineinander­
liegende Projekte</li>
<li><code>link() · verknuepfen() · entkoppeln()</code></li>
</ul>`, { accent: C.technik });

notiz('b-layout', 'layout.js — das automatische Layout', `
<h3>js/core/layout.js · 608 Zeilen · <code>GD.layout</code></h3>
<p>Setzt die fünf Regeln durch — siehe Bereich <b>Regeln &amp; Gestaltung</b>.</p>
<ul>
<li><code>textHoehe(html, breite, size)</code> — <b>gemessen</b> an einem versteckten
Knoten außerhalb des Boards; dort greift die Zoom-Transformation nicht, der
<code>scrollHeight</code> ist also eine echte Pixelzahl</li>
<li><code>passeHoehenAn(ids) · entwirre(ids) · rahmenNachziehen(gemerkt) ·
rahmenAnpassen(id) · kopfFreiRaeumen() · bloeckeFliessen()</code></li>
<li><code>aufraeumen(ids)</code> — alles in der richtigen Folge, <b>ein</b>
Historieneintrag</li>
<li><code>pruefe()</code> — der Bericht für den Einstellungsdialog</li>
<li><code>BEREICHE · bereichVon · merkeBereich · bereich(id, titel, kacheln) ·
kopfVon(rahmenId)</code></li>
</ul>
<p><b>Die Reihenfolge ist alles:</b> Höhen → Köpfe freiräumen → entwirren → Rahmen
nachziehen. Das Freiräumen erzeugt absichtlich Überlappungen, die das Entwirren danach
auflöst.</p>`, { accent: C.technik });

notiz('b-ui', 'ui.js — Oberfläche und Bedienung', `
<h3>js/core/ui.js · 1 477 Zeilen · <code>GD.ui</code></h3>
<p>Die größte Kerndatei, weil hier alles zusammenläuft, was man anfassen kann.</p>
<ul>
<li><b>Palette</b> aus <code>GD.modules.list()</code>, klick- und ziehbar</li>
<li><b>Werkzeugleiste</b> mit <code>runAction(name)</code></li>
<li><b>Inspector</b> in fünf Fassungen + <code>GD.ui.fields</code> als Baukasten</li>
<li><b>Kontextmenü</b> in drei Fassungen</li>
<li><b>Tastenkürzel</b> — fragt zuerst <code>inst.onKey(ev)</code></li>
<li><b>Dialoge</b>: Projekte, Änderungen, Einstellungen, Hilfe; dazu <code>toast ·
modal · confirm</code></li>
<li><code>updateSaveButton() · updateBackButton()</code> und die Zahl am
Änderungen-Knopf</li>
</ul>`, { accent: C.technik });

notiz('b-app', 'app.js — der Start', `
<h3>js/core/app.js · 273 Zeilen · <code>GD.app</code></h3>
<ol>
<li><code>store.init()</code> — Einstellungen und letztes Board aus
<code>localStorage</code></li>
<li><code>depot.init()</code> — die Medien-Datenbank öffnen</li>
<li><code>board.init() · windows.init() · connections.init() · minimap.init() ·
aenderungen.init() · ui.init()</code></li>
<li><code>library.init()</code> — prüft Server und Ordnerdialog, stellt den Modus ein</li>
<li>war nichts gespeichert: <code>seedStarterBoard()</code></li>
</ol>
<ul>
<li><code>undo() / redo()</code> → <code>windows.reconcile()</code> +
<code>connections.redraw()</code></li>
<li><code>saveBoard() · importBoard() · toggleTheme()</code></li>
<li><b>Dateien ablegen</b>: eine <code>.json</code> auf das Board gezogen wird geladen,
Bilder/Video/Ton werden zu Medien-Kacheln</li>
<li><b>Einfügen</b> (<code>Strg+V</code>): Bild aus der Zwischenablage → Medien-Kachel</li>
<li><code>autoInDatei()</code> — schreibt, wenn eingeschaltet, wenige Sekunden nach
jeder Änderung auch in die Projektdatei</li>
</ul>`, { accent: C.technik });

/* ===================================================================== */
/* C · Module                                                            */
/* ===================================================================== */

quell('c-vertrag', 'Der ganze Modulvertrag', 'js/core/registry.js', `
GD.modules.register({
  id: 'timeline',
  label: 'Zeitstrahl',
  icon: '⏱',
  description: 'Ablauf einer Mission',   // Kurztext in der Palette
  accent: '#57c98a',                     // Fensterfarbe
  defaultSize: { w: 500, h: 260 },

  create(ctx) {
    const state = Object.assign({ items: [] }, ctx.state || {});
    const el = GD.util.el('div', { class: 'tl-root' });

    return {
      el,                                // Pflicht
      getState: () => state,             // wird gespeichert und exportiert
      setState: (s) => { },              // nach Rueckgaengig / Laden
      onResize: (w, h) => { },           // optional
      onZoom:   (scale) => { },          // optional
      onSelect: (an) => { },             // optional
      onTitle:  (text) => { },           // optional
      onKey:    (ev) => false,           // true = Taste verbraucht
      headerTools: () => [],             // Knoepfe in der Titelleiste
      inspector: (host) => { },          // Felder im rechten Bereich
      inhaltsHoehe: (breite) => 0,       // fuer GD.layout, Regel 1
      overlayEl: () => null,             // Ebene ueber den Kacheln (Rahmen)
      dragCompanions: () => [],          // zieht mit (Rahmen)
      destroy: () => { }
    };
  }
});

/* ctx: id · state · win.get/setTitle/setSize/select ·
        changed() · commit(label) · refreshInspector() · toast(text, kind) */`, {
  w: 560, size: 10.5, marks: [15, 16, 17, 26],
  caption: 'Das Fenster drumherum — Verschieben, Größe, Pfeile, Auswahl, Speichern, Historie — kommt automatisch. Nur die Rückgabewerte el und getState sind Pflicht.',
  accent: C.game
});

notiz('c-frame', 'Rahmen — Bereiche gruppieren', `
<h3>frame.js · 236 Zeilen · <code>▢</code> · 680 × 440</h3>
<p>Getönte Fläche hinter den Fenstern, mit Titel und Untertitel. <b>Fängt keine
Mausklicks</b> — über seiner Fläche bleibt das Board verschieb- und aufziehbar.</p>
<ul>
<li><code>dragCompanions()</code> = alles, was <b>vollständig</b> in ihm liegt; das
wandert beim Verschieben mit. <b>Über dieselbe Auskunft liest der Worker-Connector die
Ideen aus dem Rahmen</b></li>
<li><code>overlayEl()</code> — die Überschrift hängt in <code>#frame-layer</code>,
<b>über</b> den Kacheln, damit sie auf Distanz lesbar bleibt</li>
<li><code>kopfHoehe()</code> — misst Titelleiste + Wasserzeichen + Untertitel und
meldet das Kopfband an <code>GD.layout</code></li>
<li>Inspector: Bereich aus der Taxonomie, Farbe, Deckkraft, gestrichelt, Untertitel,
„Inhalt auswählen", „Um den Inhalt legen"</li>
</ul>
<p>Die Überschrift wächst gegen den Zoom (Ziel ~20 px, höchstens 14×) — über
<code>transform: scale</code>, <b>nie</b> über die Schriftgröße: sonst rechnet das
Layout neu und <code>kopfHoehe()</code> misst mitten in die Animation.</p>`, { accent: C.game });

notiz('c-notes', 'Notiz — Text im Notizstil', `
<h3>notes.js · 249 Zeilen · <code>≡</code> · 380 × 300</h3>
<p>Ein <code>contenteditable</code> mit eigener Leiste: H1–H3, Fließtext, Zitat, Code,
Aufzählung, nummerierte Liste, <b>Aufgabenliste zum Abhaken</b>, fett/kursiv/
unterstrichen/durchgestrichen, Textfarbe, Markierung, Ausrichtung, Links.</p>
<ul>
<li>Grundschriftgröße pro Fenster (10–32 px), Export als Textdatei</li>
<li><code>inhaltsHoehe(breite)</code> = Leiste + <code>GD.layout.textHoehe(...)</code></li>
<li>Beim Einfügen wird <b>nur Text</b> übernommen — fremdes HTML sprengte sonst das
Layout</li>
</ul>
<p>Das ist das Modul, aus dem diese Tafel zum größten Teil besteht — und das Modul, aus
dem der Worker-Connector seine Ideen liest.</p>`, { accent: C.game });

notiz('c-wireframe', 'Wireframe — Seiten skizzieren', `
<h3>wireframe.js · 1 394 Zeilen · <code>▧</code> · 760 × 520</h3>
<p>Das größte Modul. Werkzeuge: Auswahl (<code>V</code>), Rechteck (<code>R</code>),
Ellipse (<code>O</code>), Linie (<code>L</code>), Text (<code>T</code>),
Bild (<code>I</code>).</p>
<ul>
<li><b>Form</b> — Eckenradius, Füllung als Farbe oder 2-Stopp-Verlauf mit Winkel,
Kontur mit Stärke und Strichart</li>
<li><b>Effekte</b> — Deckkraft, Schlagschatten, Weichzeichner</li>
<li><b>Text in Objekten</b> — Doppelklick; Größe, Familie, Stärke, Ausrichtung
waagerecht und senkrecht, Zeilenhöhe, Innenabstand, Umbruch, „Höhe an Text anpassen"</li>
<li><b>Führungslinien</b> aus den Linealen; Einrasten an Führungslinien,
Artboard-Kanten und -Mitte, Kanten und Mitten anderer Objekte, Raster</li>
<li><b>Bausteine</b> — Button, Eingabefeld, Karte, Kopfzeile, Listenzeile,
Bildplatzhalter, Überschrift, Textblock</li>
<li>Ausrichten/Verteilen, Ebenen (<code>[</code>/<code>]</code>), Sperren, Drehen
(<code>Umschalt</code> rastet auf 15°)</li>
<li><b>Export</b> als SVG und PNG @2×</li>
</ul>
<p>Formate: A4 quer, Desktop 1280, Full HD, Tablet, Handy, Quadrat, frei.</p>
<p>Einzigartig: An einer <b>einzelnen Form</b> darf ein Pfeil hängen
(<code>connection.from.shape</code>). Er wandert mit, wenn sie verschoben, skaliert oder
gedreht wird, und fällt sauber auf den Fensterrand zurück, wenn sie verschwindet.</p>`, { accent: C.game });

notiz('c-code', 'Quelltext — Ausschnitt mit Herkunft', `
<h3>code.js · 173 Zeilen · <code>⌗</code> · 520 × 300</h3>
<p>Zum <b>Dokumentieren</b>, nicht zum Ausführen — dafür gibt es die Sandbox.</p>
<ul>
<li>Dateipfad, Zeilennummern ab einer wählbaren Startzeile, hervorgehobene Zeilen
(<code>marks</code>), Bildunterschrift</li>
<li>leichte Einfärbung für Kommentare, Zeichenketten, Schlüsselwörter, Zahlen</li>
<li>Knöpfe zum Kopieren von Code und Pfad, Stift zum Bearbeiten</li>
<li><code>inhaltsHoehe(breite)</code> — deshalb misst „Anordnen" auch Quelltext richtig</li>
</ul>`, { accent: C.game });

notiz('c-media', 'Bild / Video / Ton — Referenzen', `
<h3>media.js · 535 Zeilen · <code>▣</code> · 420 × 320</h3>
<p>Dateien hineinziehen, einfügen (<code>Strg+V</code>) oder aus einer Adresse laden.
Mehrere Medien pro Fenster mit Vorschaustreifen und Bildunterschrift.</p>
<ul>
<li><b>Bild</b> — einpassen / füllend / verzerrt / Original, Hintergrundfarbe</li>
<li><b>Video</b> — Bedienelemente, Schleife, stumm, Autostart, Lautstärke</li>
<li><b>Ton</b> (mp3, wav, ogg, m4a, flac) — die <b>Wellenform ist der Inhalt</b> der
Kachel. 220 Stützstellen, einmal je Datei aus dem dekodierten Ton gerechnet und im
Arbeitsspeicher gehalten, <b>nicht</b> im Board. Klicken springt an die Stelle;
<code>Leertaste</code> startet und stoppt. Geht es nicht, sagt die Kachel das hin
(„Wellenform nicht lesbar") statt eine leere Linie zu zeigen</li>
</ul>
<p>Die Bytes selbst liegen seit dem Medienlager <b>nicht mehr im Dokument</b>, sondern
in einer eigenen IndexedDB; im Board steht nur <code>depot:&lt;sha256&gt;</code>.
Beim Schreiben in eine Datei werden sie wieder eingebettet.</p>`, { accent: C.game });

notiz('c-model3d', '3D-Modell — bauen und beleuchten', `
<h3>model3d.js · 1 011 Zeilen · <code>⬢</code> · 760 × 520</h3>
<p>Grundkörper: Würfel, Quader, Ebene, Dreieck, Pyramide, Zylinder, Kegel, Kugel, Torus.
Je Form Position, Drehung, <b>Größe pro Achse</b> und Formparameter.</p>
<ul>
<li><b>Kanten rund</b> — echte Verrundung in der Geometrie, kein Shading-Trick</li>
<li><b>Material</b> — Farbe, Rauheit, Metallisch, Deckkraft, Leuchten</li>
<li><b>Sonne</b> als anfassbares Objekt: der Stern im Bild lässt sich ziehen, sie läuft
auf einer Kugelbahn um den Nullpunkt. Im Inspector zusätzlich als
Richtung / Höhe / Abstand in Grad</li>
<li><b>Texturen</b> — Bild oder eingebautes Muster, Projektion als <b>Netz-UV</b>,
<b>Box (dreiachsig)</b> oder <b>Ebene von oben</b>. Box hält die Kachel quadratisch, egal
wie die Form gestreckt wird</li>
<li><code>G</code>/<code>R</code>/<code>S</code>, Achssperren über
<code>Strg</code>/<code>Alt</code>, <code>Umschalt</code> schaltet Einrasten aus</li>
<li><b>„Als Modell speichern"</b> legt die Szene in <code>GD.models</code> ab</li>
</ul>`, { accent: C.game });

notiz('c-modelview', '3D-Ansicht — Modell als Kachel', `
<h3>modelview.js · 290 Zeilen · <code>◈</code> · 340 × 280</h3>
<p>Zeigt ein gespeichertes Modell. Ziehen dreht, Mausrad ändert den Abstand, ein
Schalter oben rechts startet eine langsame Kamerafahrt (Tempo einstellbar).
Doppelklick öffnet das Modell zum Bearbeiten.</p>
<p>Die Auflösung folgt dem Board-Zoom und ist gedeckelt — für viele Kacheln reicht
„normal".</p>`, { accent: C.game });

notiz('c-sandbox', 'Code-Sandbox — Features vorführen', `
<h3>sandbox.js · 428 Zeilen · <code>‹›</code> · 620 × 400</h3>
<p>HTML-, CSS- und JS-Tab, Vorschau daneben (Trennlinie verschiebbar), Konsole darunter.
<code>Strg+Enter</code> oder „Ausführen", optional Neustart beim Tippen.</p>
<ul>
<li>läuft in einem <code>sandbox="allow-scripts"</code>-iframe <b>ohne Zugriff auf das
Board</b></li>
<li><code>console.log/warn/error</code>, Laufzeitfehler und abgelehnte Promises werden
in die Konsole gespiegelt</li>
<li>Vorlagen: Minimal, Canvas-Animation, UI-Interaktion, „3D-Modell verwenden"</li>
<li>Export als eigenständige <code>.html</code></li>
</ul>
<p>Im Sandbox-Code steht <code>GameDesk</code> bereit — der einzige Weg von innen nach
außen, und er führt nur zu den 3D-Modellen.</p>`, { accent: C.game });

notiz('c-project', 'Projekt — eine andere Tafel als Kachel', `
<h3>project.js · 248 Zeilen · <code>🗂</code> · 360 × 300</h3>
<p>Zeigt, <b>dass</b> es ein zweites Projekt gibt, ohne dessen Innenleben auszubreiten:
Name, Dateiname, Anzahl Fenster/Pfeile/Modelle, Modul-Aufteilung, Änderungsdatum und
eine kleine Vorschau, die die Fenster der anderen Tafel als Rechtecke zeichnet.</p>
<ul>
<li>Datei im Inspector aus dem Bibliotheksordner wählen, „Auffrischen" liest neu ein</li>
<li><b>Alles Angezeigte liegt im Zustand der Kachel</b> — damit steht auch ohne
Ordnerzugriff etwas da (über <code>file://</code> oder wenn die Tafel weitergegeben wurde)</li>
<li>„Öffnen" geht hinein (<code>GD.library.hinein</code>), „← Zurück" wieder heraus;
das geht mehrere Ebenen tief</li>
<li>Vor jedem Wechsel wird die aktuelle Tafel in ihre eigene Datei geschrieben</li>
</ul>`, { accent: C.game });

notiz('c-worker', 'Worker — Gegenstelle zum Broweg', `
<h3>worker.js · 472 Zeilen · <code>⚗</code> · 400 × 380</h3>
<p>Der <b>bro-server</b> aus dem Broweg-Projekt verteilt Aufgaben an Worker-PCs: Jeder
Worker hängt per WebSocket am Gateway, meldet Herzschläge und nimmt Aufträge entgegen;
Ergebnis, Verbrauch und Commit-Hash laufen zurück.</p>
<p>Diese Kachel ist die Gegenstelle auf der Tafel:</p>
<ul>
<li>wer <b>online</b> ist (online · arbeitet · Kontingent aufgebraucht · offline), mit
Fähigkeiten, erledigten Aufgaben, Token-Verbrauch und letztem Herzschlag</li>
<li>die letzten <b>Aufgaben</b> (wartet · zugeteilt · läuft · fertig · gescheitert ·
abgebrochen) mit Worker, Repo und Commit-Hash</li>
<li><b>„Aufgabe geben…"</b> — Titel, Auftrag (geht als Prompt an Claude auf dem
Worker-PC) und freiwillig ein Repo; der Server sucht einen freien Worker, sonst wartet
die Aufgabe in der Queue</li>
<li>Anmelden/Abmelden, neuen Worker anlegen — <b>der Klartext-Token kommt genau
einmal</b> zurück, danach kennt der Server nur seinen Hash</li>
<li>Abfragetakt in Sekunden; <code>0</code> schaltet das Nachladen ab, im unsichtbaren
Tab wird ohnehin nicht gefragt</li>
</ul>
<p>Der Zustand hält <code>letzte</code> — das zuletzt Gesehene. Ohne Server
(<code>file://</code>) bleibt die Kachel bei diesem Stand stehen, statt leer zu sein.</p>`, { accent: C.game });

/* ===================================================================== */
/* D · 3D-Maschine                                                       */
/* ===================================================================== */

notiz('d-geom3d', 'geom3d.js — die Grundkörper', `
<h3>js/core/geom3d.js · 347 Zeilen · <code>GD.geom3d</code></h3>
<p><b>Verrundung entsteht in der Geometrie</b>, nicht im Shader: Ein geschlossener
Querschnitt (Kreis oder verrundetes n-Eck) wird entlang eines Profils (verrundetes
Rechteck bzw. Dreieck) rotiert. Beim Quader laufen so alle zwölf Kanten und acht Ecken
rund, beim Kegel zusätzlich die Spitze.</p>
<ul>
<li><code>KINDS</code> — die neun Formen mit ihren Parametern</li>
<li><code>key(kind, params)</code> · <code>get(kind, params)</code> —
<b>Netze werden geteilt</b>: hundert gleiche Würfel belegen ein Netz und einen
GPU-Puffer. Der Zwischenspeicher hält 160 Einträge</li>
<li><code>stats()</code> — Netze und Dreiecke; ein Grundkörper hat typisch 300–1 300</li>
</ul>`, { accent: C.mechanik });

notiz('d-gl3d', 'gl3d.js — der Renderer', `
<h3>js/core/gl3d.js · 803 Zeilen · <code>GD.gl3d</code> · <code>GD.m4</code></h3>
<p>Kein three.js, keine Abhängigkeit — rund 800 Zeilen WebGL2.</p>
<ul>
<li><b>Ein einziger GL-Kontext</b> für das ganze Board. Jede Kachel lässt in einen
versteckten Puffer zeichnen und kopiert das Bild per <code>drawImage</code> in ihr
eigenes 2D-Canvas. Browser erlauben nur rund 16 Kontexte — so sind beliebig viele
3D-Fenster möglich</li>
<li>Schattenkarte, Strahlentreffer (<code>ray</code>) fürs Anfassen von Objekten</li>
<li><code>M4</code> — <code>perspective · ortho · lookAt · compose · invert ·
normalMatrix</code></li>
<li><code>orbitPos(cam) · addAnimator(fn) · stats()</code></li>
</ul>
<p><b>Gezeichnet wird nur bei Bedarf:</b> Kacheln außerhalb des Sichtfelds pausieren
(<code>IntersectionObserver</code>), im Hintergrundtab läuft keine Animation, die
Kamerafahrt begnügt sich mit 30 Bildern/s, und die Auflösung folgt dem Board-Zoom.</p>`, { accent: C.mechanik });

notiz('d-models', 'models.js — die Modell-Bibliothek', `
<h3>js/core/models.js · 336 Zeilen · <code>GD.models</code></h3>
<p>Die gespeicherten Szenen liegen in <code>doc.models</code> — sie gehören zur Tafel,
nicht zu einem Fenster.</p>
<ul>
<li><code>all · get · byName · save · remove · rename · usage(id)</code></li>
<li><code>flatten(scene)</code> — löst <code>ref</code>-Knoten auf: Ein Modell darf ein
anderes als <b>eine Form</b> enthalten. Der Verweis lässt sich als Ganzes bewegen,
drehen und skalieren; Änderungen am Original wirken überall</li>
<li><code>bake(scene)</code> — alle Formen zu <b>einem</b> Netz, in Modellkoordinaten,
mit <code>groups</code> je Form und den Lichtern</li>
<li><code>bounds · normScene · normNode · defaultScene · defaultEnv</code></li>
<li><code>applySunPos(env)</code> — die Sonne scheint immer zum Nullpunkt, ihre
Position legt also die Einstrahlung fest</li>
<li><code>describe()</code> — kompakte Liste für die Sandbox</li>
</ul>`, { accent: C.mechanik });

quell('d-bruecke', 'GameDesk — die Brücke in die Sandbox', 'js/modules/sandbox.js', `
/* Im Sandbox-Code steht GameDesk bereit. Es ist der EINZIGE Weg
   von innen nach aussen - und er fuehrt nur zu den 3D-Modellen. */

GameDesk.models                  // [{ id, name, updated, shapes, lights }]
GameDesk.getModel('Turm')        // Formen, Transformationen, Material
await GameDesk.geometry('Turm')  // fertig gebackenes Netz:

{
  id, name,
  position: Float32Array,   // x,y,z je Ecke
  normal:   Float32Array,
  uv:       Float32Array,
  index:    Uint32Array,    // Dreiecke
  groups:   [{ start, count, name, shape, color,
               opacity, emissive, emissiveStrength }],
  lights:   [{ pos, color, intensity, range }],
  vertices, triangles
}

// Texturbilder werden aus Groessengruenden NICHT uebergeben -
// nur material.hasTexture.`, {
  w: 520, size: 10.5, marks: [1, 2],
  caption: 'Die Vorlage „3D-Modell verwenden" zeichnet damit ein rotierendes Modell auf ein 2D-Canvas — ohne WebGL, ohne Zugriff auf das Board.',
  accent: C.mechanik
});

/* ===================================================================== */
/* E · Daten & Format                                                    */
/* ===================================================================== */

quell('e-doc', 'Das Dokument — .gamedesk.json', 'js/core/store.js', `
{
  "format":  "gamedesk-board",   // Pflicht - sonst wird nichts geladen
  "version": 1,
  "name":    "GameDesk — Funktionsweise",

  "view": { "x": 0, "y": 0, "scale": 0.34 },   // Kamera
  "grid": { "size": 20, "show": true, "snap": true },

  "windows":     [ … ],   // die Kacheln UND die Rahmen
  "connections": [ … ],   // die Pfeile
  "bundles":     [ … ],   // gemeinsame Strecken mehrerer Pfeile
  "models":      [ … ],   // 3D-Szenen der ganzen Tafel

  "aenderungen": {        // Aenderungsverfolgung
    "basis":   { id, zeit, titel, wer, abzug },   // letzter Commit
    "commits": [ … ]                              // aeltere, je mit Liste
  },

  "nextZ": 1              // laufende Nummer fuer bringToFront
}`, {
  w: 520, size: 10.5, marks: [2, 15],
  caption: 'Ein Rahmen ist kein Sonderfall, sondern ein Fenster vom Typ frame. Deshalb kann an ihm auch ein Pfeil hängen — genau so hängt der Worker-Connector am Ideen-Rahmen.',
  accent: C.daten
});

quell('e-window', 'Ein Fenster', 'js/core/store.js', `
{
  "id":    "win_gd_1",
  "type":  "notes",        // Modul-id; unbekannt -> Platzhalter, Zustand bleibt
  "title": "Werkzeugleiste",
  "x": -1560, "y": -960, "w": 440, "h": 330,
  "z": 112,                // zwei Baender: frame 0+z, alles andere 100000+z
  "accent": "#6ea8fe",
  "collapsed": false,
  "state": { … }           // gehoert dem Modul, der Kern liest es nie
}

/* normalize() erzwingt beim Laden: w >= 140, h >= 80, Zahlen sind
   Zahlen, ids sind eindeutig. Ein doppeltes id bekommt ein neues. */`, {
  w: 520, size: 10.5, marks: [7],
  caption: 'z darf beim Nach-hinten-Legen bis 0 fallen — deshalb steht nirgends w.z || 1: das machte aus einer 0 eine 1 und risse die Ordnung ein.',
  accent: C.daten
});

quell('e-conn', 'Ein Pfeil und ein Bündel', 'js/core/store.js', `
// Verbindung
{
  "id": "con_gd_7",
  "from": { "win": "win_a", "side": "r", "shape": null },
  "to":   { "win": "win_b", "side": "l", "shape": "sh_12" },
  "label": "liefert Netz",
  "labelSize": 12,          // feste Pixelgroesse, zoomt nicht mit
  "t": null,                // null = steht frei, Zahl = von Hand gesetzt
  "color": "#6ea8fe", "width": 2,
  "dash":  "solid",         // solid | dashed | dotted
  "curve": "ortho",         // ortho | straight | bezier
  "heads": "end",           // none | end | both
  "bundle": null
}

// Buendel - reine Wegfuehrung, es traegt keine Enden
{
  "id": "bnd_1", "name": "Aktionen", "collapsed": true,
  "color": "#8fa4c4", "width": 2.5,
  "spreizung": 11,          // Abstand der Adern im Kanal
  "laenge": 260,            // Laenge des gemeinsamen Stuecks
  "mitte": { "x": 0, "y": 0 }   // null = selbst gewaehlt
}`, {
  w: 520, size: 10.5, marks: [5, 8],
  caption: 'shape hängt ein Ende an eine einzelne Wireframe-Form statt an das ganze Fenster.',
  accent: C.daten
});

notiz('e-orte', 'Vier Speicherorte', `
<h3>1 · Browser-Speicher <span style="color:#8a93a5">(immer)</span></h3>
<p><code>localStorage['gamedesk.doc.v1']</code> — jede Änderung landet 600 ms später hier.
Daneben <code>gamedesk.prefs.v1</code> für Thema, Übersichtskarte, Bibliotheksmodus,
Verknüpfung und „Automatisch in die Datei".</p>
<h3>2 · Das Medienlager <span style="color:#8a93a5">(IndexedDB)</span></h3>
<p><code>gamedesk-medien</code> — die Bytes von Bildern, Ton und Video. Im Dokument steht
nur <code>depot:&lt;sha256&gt;</code>.</p>
<h3>3 · Die Projektdatei <span style="color:#8a93a5">(auf Knopfdruck)</span></h3>
<p><code>Strg+S</code> schreibt in die <b>verknüpfte</b> Datei; ist keine verknüpft, legt
es sie im Bibliotheksordner an; gibt es keinen, lädt es eine <code>.gamedesk.json</code>
herunter. Die Medien werden dabei wieder eingebettet.</p>
<h3>4 · Die Rückgängig-Historie <span style="color:#8a93a5">(Arbeitsspeicher)</span></h3>
<p>Bis zu 60 Schnappschüsse als Zeichenketten. Sie überlebt kein Neuladen — das ist
Absicht: Rückgängig gehört zur Sitzung. Was die Tafel <i>dauerhaft</i> über ihre
Geschichte weiß, steht in <code>doc.aenderungen</code>.</p>`, { accent: C.daten });

notiz('e-historie', 'changed() oder commit()?', `
<p>Zwei Wege, und die Wahl ist keine Geschmacksfrage:</p>
<ul>
<li><code>ctx.changed()</code> — <b>„es hat sich etwas geändert"</b>. Löst das
Autospeichern aus, <b>kein</b> Historieneintrag. Das Richtige beim Tippen, beim Ziehen
eines Reglers, bei jedem Zwischenschritt.</li>
<li><code>ctx.commit('Notiz bearbeitet')</code> — <b>„das war eine Handlung"</b>. Ein
Schnappschuss in die Rückgängig-Historie, <code>Strg+Z</code> springt genau hierher
zurück. Das Richtige beim Loslassen, beim Schließen eines Dialogs, nach einer
abgeschlossenen Eingabe.</li>
</ul>
<p>Die Notiz macht beides: <code>changed()</code> nach 250 ms,
<code>commit()</code> erst nach 1 400 ms Ruhe. So entsteht pro Absatz ein
Rückgängig-Schritt, nicht pro Buchstabe.</p>
<p><code>GD.store.touch()</code> ist der dritte Weg: speichern <b>ohne</b> Historie —
für die Kameraposition. Sonst wäre der Rückgängig-Stapel voll mit Scrollen.</p>
<p><b>Ein Vierter, ganz anderer:</b> <code>GD.aenderungen.festschreiben()</code> schreibt
einen Stand fest. Das ist kein Rückgängig-Schritt, sondern ein Merkzeichen in der
Geschichte der Tafel.</p>`, { accent: C.daten });

notiz('e-normalize', 'normalize() — fremde Daten hereinlassen', `
<p>Jedes Dokument von außen geht durch <code>normalize(raw)</code>. Es gibt
<code>null</code> zurück, wenn etwas grundsätzlich nicht stimmt, und repariert sonst
still:</p>
<ul>
<li>falsches <code>format</code> oder fehlendes <code>windows</code> → <code>null</code></li>
<li>doppelte oder fehlende <code>id</code> → neue über <code>U.uid()</code></li>
<li>Zahlen, die keine sind → Vorgabe; <code>scale</code> auf 0,05–6 begrenzt</li>
<li>Pfeile auf nicht vorhandene Fenster → <b>weg</b> (sonst zeigt ein Pfeil ins Leere)</li>
<li>Bündelzugehörigkeit auf ein unbekanntes Bündel → <code>null</code></li>
<li><code>aenderungen.basis</code> ohne <code>abzug</code> → <code>null</code></li>
<li><code>state</code> bleibt <b>unangetastet</b> — der Kern weiß nicht, was drinsteht,
und darf es deshalb auch nicht anfassen</li>
</ul>
<p><code>nextZ</code> wird auf das Maximum aller vorhandenen <code>z</code> gezogen —
sonst läge das nächste nach vorn geholte Fenster hinter den alten.</p>`, { accent: C.daten });

/* ===================================================================== */
/* J · Änderungsverfolgung & Medienlager                                 */
/* ===================================================================== */

notiz('j-vergleich', 'vergleich.js — der Abzug', `
<h3>js/core/vergleich.js · 320 Zeilen · <code>GD.vergleich</code></h3>
<p>Rein rechnend, <b>ohne einen einzigen Zugriff auf <code>window</code> oder
<code>document</code></b> — und deshalb in beiden Welten lauffähig: als klassisches
<code>&lt;script&gt;</code> im Browser und als <code>require()</code> in Node.</p>
<ul>
<li><code>abzug(doc)</code> — ein schlanker Fingerabdruck: je Fenster nur Lage, Größe,
Titel und eine <b>Prüfsumme des Inhalts</b>, rund 90 Byte pro Kachel. Eine zweite Kopie
des ganzen Dokuments wären bei den großen Tafeln mehrere MB</li>
<li><code>punkte(alt, neu)</code> — was sich geändert hat, als Liste einzelner Befunde
mit Klasse und Kasten</li>
</ul>
<p><b>Absichtlich nicht verfolgt:</b> <code>view</code> (die Kamera ist keine Änderung an
der Tafel), <code>z</code> (jeder Klick hebt ein Fenster nach vorn — nur Rauschen) und
die Anzeigeschalter <code>grid.show/snap</code>.</p>
<p>Sieben Klassen mit Rang, alle im roten Feld, unterschieden über den Ton:
<b>Neu · Entfernt · Inhalt · Titel · Größe · Verschoben · Darstellung</b>. Ein Kasten
trägt genau eine — wie bei einer Objekterkennung.</p>`, { accent: C.daten });

notiz('j-aenderungen', 'aenderungen.js — Verlauf und Sicht', `
<h3>js/core/aenderungen.js · 288 Zeilen · <code>GD.aenderungen</code></h3>
<p>Die Tafel führt einen eigenen, kleinen Verlauf <b>neben</b> der Rückgängig-Historie:</p>
<ul>
<li><b>Commit</b> — ein festgeschriebener Stand: der Abzug, wer ihn geschrieben hat
(<code>mensch</code> oder <code>ki</code>), Titel, Text und die Liste der Änderungen, die
zu ihm geführt haben</li>
<li><b>Basis</b> — der Abzug des <i>jüngsten</i> Commits. Alles danach ist „offen"</li>
</ul>
<p><b>Warum nicht jeder Commit mit vollem Abzug?</b> Ein Abzug wiegt bei den großen
Tafeln rund 12 KB; vierzig davon lägen dauerhaft in jeder <code>.gamedesk.json</code>.
Vollständig gehalten wird nur die Basis, ältere Commits behalten ihre fertige
Änderungsliste. Das beantwortet „was ist seither passiert" und „was steckte in Commit X"
— nur nicht „zeig mir alles seit vorletzter Woche".</p>
<p><b>Die Änderungssicht</b> (⬚ in der Leiste, <code>Strg+Umschalt+D</code>) legt über
jede geänderte Kachel einen roten Kasten mit beschriftetem Reiter. Die Kästen liegen in
<code>#diff-layer</code> und wandern mit Zoom und Verschieben mit; die Reiter hängen in
<code>#label-layer</code> und behalten ihre Pixelgröße.</p>
<p>Höchstens 60 Commits, höchstens 300 mitgeschriebene Befunde je Commit.</p>`, { accent: C.daten });

notiz('j-depot', 'depot.js — das Medienlager', `
<h3>js/core/depot.js · 372 Zeilen · <code>GD.depot</code></h3>
<p><b>Das Problem:</b> Bilder, Ton und Video sind Bytes, keine Zeichen. Sie standen als
<code>data:</code>-URL mitten im Dokument — und landeten damit bei jedem Autospeichern im
<code>localStorage</code>, der pro Herkunft rund <b>5 MB</b> fasst. Ein einziges Foto
sprengte ihn, und danach ließ sich <i>gar nichts</i> mehr sichern. Schlimmer noch: Der
Verlaufsstapel hält bis zu 60 Abzüge als Text — mit eingebetteten Medien schnell
Gigabyte.</p>
<p><b>Die Lösung:</b> Die Bytes liegen in einer eigenen IndexedDB. Im Dokument steht nur
noch <code>depot:&lt;id&gt;</code> — und die <b>id ist der Inhalt selbst</b> (SHA-256).
Dasselbe Bild zweimal eingefügt belegt darum nur einmal Platz.</p>
<p>Drei Übersetzungen halten das zusammen:</p>
<ul>
<li><code>aufloesen(v)</code> — <code>depot:</code> → <code>blob:</code>-URL (zum Anzeigen)</li>
<li><code>einlesen(doc)</code> — <code>data:</code> → <code>depot:</code> (beim Öffnen
fremder Tafeln)</li>
<li><code>aufblasen(doc)</code> — <code>depot:</code> → <code>data:</code> (beim
Schreiben in die Datei)</li>
</ul>
<p>Die Dateien auf der Platte bleiben dadurch <b>in sich geschlossen</b>: Eine
<code>.gamedesk.json</code> trägt ihre Medien mit sich, man kann sie verschicken. Nur der
Browser-Zwischenstand ist schlank. Kurze <code>data:</code>-URLs unter 4 kB bleiben, wo
sie sind.</p>`, { accent: C.daten });

quell('j-festschreiben', 'festschreiben.mjs — Commit ohne Browser', 'gamedesk/tools/festschreiben.mjs', `
/**
 * Einen Stand festschreiben - ohne Browser.
 *
 * Tafeln wachsen auch ausserhalb von GameDesk: Ein Umbauskript in
 * boards/ legt Kacheln um, benennt Abschnitte um, zieht Rahmen nach.
 * Damit die Aenderungssicht danach nicht die GANZE Tafel rot
 * einrahmt, gehoert zu so einem Lauf ein Commit.
 *
 *   node tools/festschreiben.mjs <datei.gamedesk.json>
 *        --titel "Abschnitte umgebaut"
 *        [--text "…"] [--wer ki|mensch] [--zeigen]
 *
 *   --zeigen   nur auflisten, was offen ist; nichts schreiben
 *
 * Gerechnet wird mit DEMSELBEN Kern wie im Browser
 * (js/core/vergleich.js) - ein zweiter Abgleich, der auseinanderliefe,
 * waere schlimmer als keiner.
 */
const V = require(join(HEIM, 'js', 'core', 'vergleich.js'));`, {
  w: 520, size: 10.5, marks: [16, 17, 18, 20],
  caption: 'Deshalb der Doppelkopf in vergleich.js: dieselbe Datei ist module.exports in Node und GD.vergleich im Browser.',
  accent: C.daten
});

/* ===================================================================== */
/* F · Bibliothek & Server                                               */
/* ===================================================================== */

notiz('f-zwei', 'Zwei Wege zum Ordner', `
<h3>server — <code>tools/serve.mjs</code></h3>
<p>Start über <code>GameDesk starten.bat</code>. Der Pfad wird <b>frei eingetippt</b>, in
<code>tools/bibliothek.json</code> gemerkt und gilt beim nächsten Start wieder — ohne
Nachfrage.</p>
<h3>ordner — File System Access API</h3>
<p>Chrome oder Edge über http/https. Ein echter Ordnerdialog, der Ordner darf überall
liegen. Der Griff wird in <b>IndexedDB</b> gemerkt; nach einem Neustart des Browsers
fragt Chrome einmal nach der Erlaubnis — eine Sicherheitsvorgabe, kein Fehler.</p>
<h3>keiner — <code>file://</code></h3>
<p>Beim Doppelklick auf <code>index.html</code> steht keiner von beiden zur Verfügung.
Dann bleibt der Weg über „Öffnen…" und „Speichern" als Datei — und die Tafel
funktioniert trotzdem vollständig. Nur die Worker-Kachel bleibt bei dem stehen, was sie
zuletzt gesehen hat.</p>`, { accent: C.betrieb });

quell('f-api', 'Die Endpunkte der Bibliothek', 'gamedesk/tools/serve.mjs', `
GET    /api/bibliothek          -> { ordner, existiert, schreibbar }
POST   /api/bibliothek          <- { ordner, anlegen }   Ordner festlegen
GET    /api/bibliothek/liste    -> { …, projekte: [ … ] }
GET    /api/bibliothek/datei?name=…
PUT    /api/bibliothek/datei?name=…   <- die ganze .json
DELETE /api/bibliothek/datei?name=…

/* Ein Projekt in der Liste:
   { datei, name, groesse, geaendert, fenster, pfeile, modelle, module } */

// Auch unter einem Unterpfad erreichbar (/gamedesk/api/…), damit
// GameDesk und andere Seiten aus derselben Herkunft laufen koennen.
const treffer = /(\\/api\\/.*)$/.exec(url.pathname);`, {
  w: 520, size: 10.5, marks: [12],
  caption: 'Der Server lauscht nur auf 127.0.0.1. Er sucht bis zu zwei Ebenen tief und nimmt nur Dateien, in denen format: "gamedesk-board" steht.',
  accent: C.betrieb
});

quell('f-sicher', 'sicherePfad() — kein Ausbruch aus dem Ordner', 'gamedesk/tools/serve.mjs', `
/** Nur Namen innerhalb des Bibliotheksordners, keine Ausbrueche. */
function sicherePfad(name) {
  if (typeof name !== 'string' || !name) return null;
  if (!/\\.json$/i.test(name)) return null;
  if (/[:*?"<>|]/.test(name)) return null;      // keine Laufwerke, keine Wildcards
  const rein = normalize(name).replace(/^([/\\\\])+/, '');
  if (rein.split(/[/\\\\]/).includes('..')) return null;
  const voll = resolve(join(ordner, rein));
  if (voll !== ordner && !voll.startsWith(ordner + sep)) return null;
  return voll;
}`, {
  w: 520, size: 10.5, marks: [8, 9],
  caption: 'Der Ordner wird einmal gesetzt; jeder weitere Aufruf nennt nur noch einen Namen darin. Geprüft mit ../../x.json, ..\\..\\x.json und C:\\Windows\\x.json.',
  accent: C.betrieb
});

quell('f-broweg', 'Die Brücke nach Broweg', 'gamedesk/tools/serve.mjs', `
/*
 * Die Worker-Kachel spricht mit dem bro-server (Worker-Modul:
 * /workers, /tasks). Direkt aus der Seite heraus ginge das nicht -
 * der bro-server schickt keine CORS-Koepfe und haengt seine Sitzung
 * an ein Cookie, das ein fremder Ursprung nicht mitschicken darf.
 * Also laeuft alles ueber diesen Server: gleiche Herkunft, kein CORS,
 * und das Sitzungs-Cookie liegt hier statt im Browser.
 *
 * Das Cookie bleibt ABSICHTLICH nur im Arbeitsspeicher. Auf die
 * Platte geht nur die Adresse (tools/broweg.json) - nie E-Mail, nie
 * Passwort, nie das Cookie.
 *
 * Weitergereicht werden ausschliesslich die Pfade in ERLAUBT.
 * Die Bruecke ist kein offener Weiterleiter.
 */
const ERLAUBT = [
  /^\\/health$/,
  /^\\/auth\\/session$/,
  /^\\/workers$/,          /^\\/workers\\/[\\w-]+$/,
  /^\\/tasks$/,            /^\\/tasks\\/[\\w-]+$/,
  /^\\/tasks\\/[\\w-]+\\/(followup|feedback)$/
];

GET  /api/broweg            -> { basis, angemeldet, benutzer }
POST /api/broweg            <- { basis }
POST /api/broweg/anmelden   <- { email, passwort }
POST /api/broweg/abmelden
*/  /api/broweg/ruf?pfad=…  -> weitergereicht, wenn ERLAUBT`, {
  w: 520, size: 10.5, marks: [10, 11, 13, 14],
  caption: 'Nach einem Neustart des Servers muss man sich neu anmelden — das ist der Preis dafür, dass kein Zugangsdatum die Platte berührt.',
  accent: C.betrieb
});

notiz('f-reise', 'Die Reise durch die Projekte', `
<p>Eine Projekt-Kachel führt in eine andere Tafel <b>hinein</b>; „← Zurück" bringt einen
wieder heraus. Das geht mehrere Ebenen tief — <code>GD.library.verlauf()</code> ist der
Stapel.</p>
<ul>
<li><code>hinein(datei)</code> — sichert <b>zuerst</b> die aktuelle Tafel in ihre eigene
Datei, legt sie auf den Stapel, lädt die neue, passt den Zoom ein</li>
<li><code>zurueck()</code> — dasselbe rückwärts</li>
</ul>
<p><b>Warum das Sichern davor sein muss:</b> Sonst stünde beim Zurückkommen der Stand von
zuletzt gespeichert da — die Arbeit von eben wäre still weg.</p>
<p>In <code>brauweg-funktionsweise.gamedesk.json</code> sitzt so eine Kachel im Bereich
<i>Spielmodule</i> und führt nach Feldherr.</p>`, { accent: C.betrieb });

notiz('f-serve', 'tools/serve.mjs — drei Aufgaben', `
<h3>1 · Ausliefern</h3>
<p>Ein Dateiserver ohne jedes Paket — Node bringt alles mit.
<code>node tools/serve.mjs [port] [wurzel]</code>.</p>
<p><b>Wichtig ist <code>Cache-Control: no-store</code>.</b> Ohne diesen Kopf liefert der
Browser nach einer Änderung weiter die alte <code>.js</code> aus dem Speicher — und man
sucht den Fehler im Quelltext statt im Cache. (Ein Aufruf mit anderem Abfrageteil,
<code>?frisch=2</code>, hilft ebenfalls.)</p>
<h3>2 · Die Bibliothek</h3>
<p>Ein Ordner auf der Platte als Projektliste, gemerkt in
<code>tools/bibliothek.json</code>. Vorgabe ist <code>gamedesk/boards</code>.</p>
<p>Ein zweiter Pfad als Argument legt statt GameDesk einen beliebigen Ordner offen —
praktisch, um fremde Seiten daneben zu betrachten.</p>
<h3>3 · Die Brücke nach Broweg <span style="color:#e8b45c">(neu)</span></h3>
<p><code>/api/broweg/*</code> — der Weg der Worker-Kachel zum bro-server. Adresse in
<code>tools/broweg.json</code>, Sitzung nur im Arbeitsspeicher.</p>`, { accent: C.betrieb });

/* ===================================================================== */
/* G · Regeln & Gestaltung                                               */
/* ===================================================================== */

notiz('g-regeln', 'Die fünf Anordnungsregeln', `
<p>Der Knopf <b>„⤡ Anordnen"</b> setzt sie durch. Sind Fenster ausgewählt, gilt er nur
für diese, sonst für das ganze Board.</p>
<ol>
<li><b>Text vollständig sichtbar.</b> Die Höhe wird <b>gemessen</b>, nicht geschätzt:
der Inhalt wird versteckt außerhalb des Boards gerendert, sein
<code>scrollHeight</code> ist die Antwort.</li>
<li><b>Keine Überlappungen.</b> Kollidierende Kacheln weichen <b>nur nach unten</b> aus —
so bleibt die Leserichtung, und das Verfahren endet garantiert. Rahmen zählen nicht mit.</li>
<li><b>Rahmen sitzen am Inhalt.</b> 44 px Luft ringsum, oben zusätzlich das Kopfband.</li>
<li><b>Bereiche benannt.</b> Jeder Rahmen gehört zu einem Bereich aus der Taxonomie.</li>
<li><b>Überschriften frei.</b> Im Kopfband eines Rahmens liegt nichts. Was hineinragt,
wandert nach unten — als <b>Gruppe</b>, nicht Kachel für Kachel.</li>
</ol>
<p>Der Bericht steht unter <b>⚙ Einstellungen → Anordnung</b>, mit einem „zeigen"-Knopf
je Befund.</p>`, { accent: C.gamedesign });

notiz('g-bereiche', 'Die Bereichs-Taxonomie', `
<p>Zehn Bereiche, je mit Farbe und Ordnungszahl. Die Zahl bestimmt, in welcher Folge
<code>GD.layout.bereich()</code> neue Bereiche untereinanderlegt.</p>
<ul>
<li><span style="color:#b78cf7">■</span> Gamedesign · 10</li>
<li><span style="color:#6ea8fe">■</span> Menüs · 20</li>
<li><span style="color:#57c98a">■</span> Game · 30</li>
<li><span style="color:#f78ca0">■</span> Charaktere · 40</li>
<li><span style="color:#4fd1c5">■</span> Mechanik · 50</li>
<li><span style="color:#8fa4c4">■</span> Technik · 60</li>
<li><span style="color:#e8b45c">■</span> Daten · 70</li>
<li><span style="color:#ef6b6b">■</span> Betrieb · 80</li>
<li><span style="color:#e0a0c8">■</span> Medien · 90</li>
<li><span style="color:#94a3b8">■</span> Sonstiges · 100</li>
</ul>
<p>Erweitern über <code>GD.layout.merkeBereich({ id, label, tint, ordnung })</code>.
Gewählt wird der Bereich im Inspector eines Rahmens.</p>
<p><b>Zwei Regeln halten das lesbar:</b> Verschachtelte Rahmen sind <b>immer</b> neutral
(<code>#94a3b8</code>) und erben den Bereich ihrer Fläche — und ein Rahmen ohne
Untertitel bekommt ein flacheres Kopfband als einer mit.</p>`, { accent: C.gamedesign });

notiz('g-z', 'Zwei Stapelbänder', `
<p>Die Fenster liegen in zwei getrennten Bändern:</p>
<ul>
<li><b>Rahmen</b> — <code>0 + z</code></li>
<li><b>alles andere</b> — <code>100 000 + z</code></li>
</ul>
<p>Damit kann ein Rahmen seinen Inhalt <b>nie</b> verdecken, egal wie oft man ihn nach
vorn holt. <code>bringToFront</code> und <code>sendToBack</code> nehmen den Rahmeninhalt
mit.</p>
<p><b>Ein Pfeil darf verdecken.</b> <code>#conn-layer</code> liegt bei z-index
2 500 000 — über den Fenstern: Er soll die Verbindung zeigen, nicht dahinter
verschwinden. Getroffen wird trotzdem nur der Strich selbst.</p>
<p>Die Rahmenüberschriften liegen dazwischen, bei 2 400 000 — sie müssen die Kacheln
überlagern dürfen, sonst sind sie auf Distanz weg.</p>`, { accent: C.gamedesign });

notiz('g-schrift', 'Schrift — drei Familien, vier Regeln', `
<p>Alle drei liegen lokal in <code>fonts/</code> unter der SIL Open Font License, nur die
latin-Untermenge, zusammen rund 370 kB — kein fremder Server, damit GameDesk ohne Netz
und über <code>file://</code> gleich aussieht.</p>
<ul>
<li><b>Inter</b> — Oberfläche und Fließtext</li>
<li><b>Space Grotesk</b> — Überschriften, Marke, Fenster- und Rahmentitel</li>
<li><b>JetBrains Mono</b> — Quelltext, Pfade, Dateinamen</li>
</ul>
<ol>
<li>Jede Abschnitts-Überschrift wird gleich gesetzt: 10,5 px, Versalien, gesperrt.</li>
<li>Zahlen, die untereinanderstehen, bekommen <b>Tabellenziffern</b>; im Fließtext
bleiben sie proportional.</li>
<li><b>Die Laufweite gehört zur Größe, nicht zur Schriftart.</b> Große Schrift wird enger
gestellt (−0,022 em), kleine Zahlenschrift bekommt Luft (+0,006 em). Der Zeilenabstand
läuft gegenläufig.</li>
<li><b>Jede Schrift hält Mindestabstand</b> — 14 px (<code>--schrift-luft</code>). Nur
Lineale und Chips dürfen auf 6 px (<code>--schrift-luft-eng</code>); Lesetext nie.</li>
</ol>`, { accent: C.gamedesign });

notiz('g-raum', 'Abstände und Bewegung', `
<p>Alle Abstände kommen aus einer Leiter in <code>:root</code> —
<code>--luft-1</code> (4 px) bis <code>--luft-6</code> (28 px). <i>Wer eine Zahl direkt
ins Blatt schreibt, hat sich nicht entschieden.</i></p>
<p>Bewegung läuft über drei Zeiten und <b>eine</b> Kurve:</p>
<ul>
<li><code>--zeit-druck</code> 120 ms — Knopfdruck, Hover-Farbe</li>
<li><code>--zeit-klein</code> 160 ms — kleine Einblendungen</li>
<li><code>--zeit-gross</code> 220 ms — Meldungen, Überlagerungen</li>
<li><code>--aus</code> <code>cubic-bezier(.23,1,.32,1)</code></li>
</ul>
<p>Drei Grundsätze: Rückmeldung kommt <b>beim Herunterdrücken</b>
(<code>:active { scale(.97) }</code>), nicht beim Loslassen. Bewegt wird nur
<code>transform</code> und <code>opacity</code> — beides läuft am Layout vorbei. Und
Vergrößern beim Überfahren steht hinter
<code>@media (hover: hover) and (pointer: fine)</code>, sonst zuckt die Fläche unter dem
Finger. <code>prefers-reduced-motion</code> nimmt alle Wege heraus und lässt Farbe und
Deckkraft stehen.</p>`, { accent: C.gamedesign });

notiz('g-gasse', 'Verdrahtete Spalten brauchen eine Gasse', `
<p><b>Die Pfeilbeschriftung behält ihre Pixelgröße</b> — beim Herauszoomen wird sie
nicht kleiner, der Abstand zwischen den Pfeilen aber schon. Deshalb blenden alle
Beschriftungen unter etwa 30 % Zoom aus; sonst läge alles übereinander.</p>
<p>Von allein stellt sich eine Beschriftung auf das längste gerade Stück, das
<b>neben</b> den Kacheln verläuft und breit genug für sie ist. Findet sie keins, sitzt
sie auf der Nachbarkachel.</p>
<blockquote>Zwischen zwei Spalten, zwischen denen Pfeile laufen, gehören rund
<b>460 Welteinheiten</b> Platz. Das reicht für eine Zeile bei 32 % Zoom. Kacheln direkt
nebeneinander bekommen ihre Beschriftung nie unter.</blockquote>
<p>Diese Tafel hält <b>520</b> — ein bisschen mehr, weil einige Beschriftungen lang
sind.</p>`, { accent: C.gamedesign });

/* ===================================================================== */
/* H · Ablauf einer Änderung                                             */
/* ===================================================================== */

const schritte = [
  ['h-1', 'Tippen im Modul', 'Die Notiz hört auf <code>input</code>. Sie schreibt <b>nicht</b> sofort in den Zustand — erst 250 ms nach dem letzten Anschlag.'],
  ['h-2', 'ctx.changed()', 'Das Fenster meldet dem Kern: „hier hat sich etwas geändert". <b>Kein</b> Historieneintrag — sonst stünde jeder Buchstabe im Rückgängig-Stapel.'],
  ['h-3', 'store.save()', '600 ms entprellt. <code>serialize()</code> holt über <code>windows.syncStates()</code> jeden Modulzustand ab und schreibt das Ganze nach <code>localStorage</code> — Medien nur als <code>depot:</code>-Verweis.'],
  ['h-4', 'ctx.commit(label)', 'Nach 1 400 ms Ruhe: ein Schnappschuss in die Rückgängig-Historie, höchstens 60. Identische Zustände werden nicht doppelt abgelegt.'],
  ['h-5', 'Strg+Z', '<code>store.undo()</code> setzt <code>doc</code> zurück und meldet <code>doc:restored</code>. <code>windows.reconcile()</code> behält bestehende Instanzen und füttert sie mit <code>setState()</code> — kein Neuaufbau.'],
  ['h-6', 'Strg+S', '<code>library.sichern()</code> → <code>depot.aufblasen()</code> → <code>PUT api/bibliothek/datei</code>. Ist „Automatisch in die Datei" an, passiert das ohnehin wenige Sekunden nach jeder Änderung.'],
  ['h-7', 'Festschreiben', 'Wenn ein Arbeitsschritt fertig ist: <code>GD.aenderungen.festschreiben({ titel, wer })</code>. Danach ist die Änderungssicht wieder leer — und die nächste Runde beginnt bei einer sauberen Basis.']
];
schritte.forEach(([k, titel, html], i) => {
  notiz(k, (i + 1) + '. ' + titel, '<p>' + html + '</p>', { w: 380, fontSize: 12.5, accent: '#9aa4b6' });
});

/* ===================================================================== */
/* I · Weiterentwicklung — Ideen und der Worker                          */
/* ===================================================================== */

/* Eine echte Worker-Kachel. takt: 0 heisst „nicht von selbst abfragen" —
   eine Dokumentationstafel soll nicht alle 15 Sekunden an einem Server
   klopfen, der vielleicht gar nicht laeuft. */
fenster('i-worker', 'worker', 'Worker (Broweg)', 420, 400, {
  takt: 0, zeigeAufgaben: true, maxAufgaben: 6, letzte: null
}, C.mechanik);

notiz('i-anforderung', '✉ Anforderung: Ideen → Auftrag', `
<h2>Nachricht an die Sitzung, die am Worker arbeitet</h2>
<p>Die Worker-Kachel steht und kann Aufträge geben. Was fehlt, ist der <b>Weg von diesem
Rahmen dorthin</b>: Heute muss man den Auftrag von Hand abtippen, obwohl die Ideen
nebenan schon geschrieben stehen.</p>
<h3>Gewünscht: „Rahmen als Auftrag"</h3>
<p>Ein Knopf — in <code>headerTools()</code> der Worker-Kachel oder im Inspector —, der
aus einem <b>gewählten Rahmen</b> einen strukturierten Prompt baut und damit den
vorhandenen Dialog <code>aufgabeGeben()</code> <b>vorbefüllt</b> öffnet. Nicht absenden:
vorbefüllen. Der Mensch drückt „Absenden".</p>
<h3>Die sechs Schritte</h3>
<ol>
<li><b>Rahmen wählen</b> — im Inspector eine Liste aller Fenster mit
<code>type === 'frame'</code>; die Wahl liegt als <code>state.rahmenId</code>.</li>
<li><b>Zustände einsammeln</b> — <b>zuerst</b> <code>GD.windows.syncStates()</code>,
sonst steht im Dokument noch der Stand von vor dem letzten Tastenanschlag.</li>
<li><b>Ideen lesen</b> —
<code>GD.windows.get(rahmenId).inst.dragCompanions()</code> liefert die Ids aller
Kacheln, die <b>vollständig</b> im Rahmen liegen (dieselbe Prüfung, die auch das
Mitziehen benutzt). Danach über <code>GD.store.getWindow(id)</code> an
<code>title</code> und <code>state.html</code>.</li>
<li><b>Sortieren</b> — nach <code>y</code>, bei gleicher Höhe nach <code>x</code>.
<b>Die Anordnung auf der Tafel <i>ist</i> die Reihenfolge.</b></li>
<li><b>Prompt bauen</b> — Kopf (Tafelname, Rahmentitel, Untertitel, Datum, Anzahl),
Kontext, die Ideen als nummerierte Abschnitte, zum Schluss der Auftrag. Aufzählungen
bleiben Aufzählungen; abgehakte Aufgaben (<code>li[data-done="1"]</code>) werden als
<i>erledigt</i> gekennzeichnet. Der Text muss <b>ohne</b> diese Tafel verständlich sein.
Der Prototyp nebenan macht genau das — er lässt sich fast unverändert übernehmen.</li>
<li><b>Zeigen und geben</b> — <code>aufgabeGeben()</code> öffnen mit
<code>title</code> = Rahmentitel und <code>prompt</code> = gebautem Text, beides noch
änderbar. Kam eine Aufgabe zurück, gehört ihr Ergebnis wieder auf die Tafel: eine neue
Notiz im selben Rahmen oder eine Statuszeile in der Kachel.</li>
</ol>
<h3>Zwei Fallen, die hier schon jemanden erwischt haben</h3>
<ul>
<li>Closures aus <code>create()</code> dürfen den Datensatz <b>nicht einfangen</b> —
<code>windows.reconcile()</code> hängt nach Rückgängig einen frischen in
<code>rec.data</code>. Immer über <code>ctx.win.get()</code> gehen.</li>
<li>Ein Rahmen, dessen Kacheln beim Anordnen aus dem Kasten gerutscht sind, gibt über
<code>dragCompanions()</code> weniger zurück, als man erwartet. Vor dem Sammeln lohnt
<code>GD.layout.rahmenAnpassen(rahmenId)</code>.</li>
</ul>
<p style="color:#8a93a5">Der Pfeil von diesem Rahmen zur Kachel liegt schon; er heißt
„Notizen → strukturierter Prompt". Wenn der Knopf da ist, ist auf dieser Tafel nichts
weiter zu tun.</p>`, { w: 560, accent: '#e8b45c' });

fenster('i-prototyp', 'sandbox', 'Prompt-Bauer — lauffähiger Prototyp', 620, 460, {
  tab: 'js', autorun: false, split: 0.42, showConsole: false,
  html: '<pre id="out"></pre>',
  css: `body{margin:0;font:11.5px/1.5 ui-monospace,Consolas,monospace;background:#12151c;color:#e6eaf2;padding:10px}
pre{margin:0;white-space:pre-wrap}`,
  js: `/* Was der Knopf „Rahmen als Auftrag" tun soll.
   Hier mit erfundenen Kacheln; im Modul kommen sie aus dem Rahmen:

     GD.windows.syncStates();
     const ids = GD.windows.get(rahmenId).inst.dragCompanions();
     const kacheln = ids.map(GD.store.getWindow)
                        .filter(w => w.type === 'notes');
*/

const tafel  = 'GameDesk — Funktionsweise';
const rahmen = { titel: 'Ideen — hier sammeln', note: 'eine Notiz je Idee' };

const kacheln = [
  { y:  0, x:   0, title: 'Suche über alle Kacheln',
    html: '<h3>Strg+F</h3><p>Volltext über Titel, Notizen und Quelltext.</p>' +
          '<ul><li>Treffer in der Übersichtskarte</li><li>Enter springt weiter</li></ul>' },
  { y:  0, x: 480, title: 'Tafel als Bild ausgeben',
    html: '<p>PNG und SVG des ganzen Boards.</p>' +
          '<ul><li data-done="1">Wireframe kann es schon</li>' +
          '<li data-done="0">für das ganze Board fehlt es</li></ul>' }
];

/* --- 1 · Lesereihenfolge: erst y, dann x ------------------------------ */
const sortiert = kacheln.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));

/* --- 2 · HTML zu Klartext -------------------------------------------- */
function klartext(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  const zeilen = [];
  for (const el of d.children) {
    const t = el.tagName.toLowerCase();
    if (t === 'ul' || t === 'ol') {
      [...el.children].forEach((li, i) => {
        const hak = li.dataset.done === '1' ? '[erledigt] '
                  : li.dataset.done === '0' ? '[offen] ' : '';
        zeilen.push('  ' + (t === 'ol' ? (i + 1) + '.' : '-') + ' ' + hak + li.innerText.trim());
      });
    } else if (t[0] === 'h') {
      zeilen.push(el.innerText.trim() + ':');
    } else {
      const s = el.innerText.trim();
      if (s) zeilen.push(s);
    }
  }
  return zeilen.join('\\n');
}

/* --- 3 · Prompt bauen ------------------------------------------------- */
const heute = new Date().toLocaleDateString('de-DE');
const teile = [
  '# Auftrag aus GameDesk',
  '',
  'Tafel:   ' + tafel,
  'Rahmen:  ' + rahmen.titel + '  (' + rahmen.note + ')',
  'Datum:   ' + heute,
  'Ideen:   ' + sortiert.length,
  '',
  '## Kontext',
  'GameDesk ist ein Board zum Entwerfen von Spielen: eine unendliche Flaeche mit',
  'modularen Fenstern, verbunden durch beschriftete Pfeile. Kein Build, keine',
  'Abhaengigkeit, klassische script-Dateien, lauffaehig auch ueber file://.',
  'Ordner: SPIDERVISION/gamedesk',
  '',
  '## Gesammelte Ideen'
];

sortiert.forEach((k, i) => {
  teile.push('', '### ' + (i + 1) + '. ' + k.title, klartext(k.html));
});

teile.push('', '## Auftrag',
  'Pruefe die Ideen einzeln auf Aufwand und Wirkung, schlage eine Reihenfolge vor',
  'und setze die erste um. Halte dich an die Hausregeln der Tafel (fuenf',
  'Anordnungsregeln, zwei Stapelbaender, Abstandsleiter, drei Schriftfamilien)',
  'und schreibe den Stand am Ende fest:',
  '  node tools/festschreiben.mjs <datei> --titel "…" --wer ki');

const prompt = teile.join('\\n');

/* --- 4 · So kaeme er in den vorhandenen Dialog ------------------------ */
// aufgabeGeben({ title: rahmen.titel, prompt: prompt, repo: 'gamedesk' })

out.textContent = prompt;
console.log('Zeichen im Prompt:', prompt.length);`
}, '#e8b45c');

/* ---------------------------------------------------- die Ideen selbst */

const ideen = [
  ['id-rahmenauftrag', 'Rahmen als Auftrag geben', `
<p><b>Die Idee, aus der dieser Rahmen entstanden ist.</b></p>
<p>Ein Knopf an der Worker-Kachel, der die Notizen aus einem gewählten Rahmen zu einem
strukturierten Prompt zusammenfasst und den Dialog „Aufgabe geben" damit vorbefüllt.</p>
<p>Einzelheiten in der Anforderung darüber, Prototyp daneben.</p>`],

  ['id-suche', 'Suche über alle Kacheln', `
<h3><code>Strg+F</code></h3>
<p>Volltext über Fenstertitel, Notizen und Quelltext.</p>
<ul><li>Trefferliste rechts, Enter springt weiter</li>
<li>Treffer in der Übersichtskarte markieren</li>
<li>bei großen Tafeln (109 Fenster) die häufigste Handbewegung</li></ul>`],

  ['id-bild', 'Tafel als Bild ausgeben', `
<p>PNG und SVG des ganzen Boards oder einer Auswahl.</p>
<ul><li>das Wireframe-Modul kann das für sein Artboard bereits</li>
<li>für das ganze Board fehlt es — bisher hilft nur ein Bildschirmfoto</li>
<li>nützlich für Handzettel und für Fragen an eine KI</li></ul>`],

  ['id-vorlagen', 'Kachel-Vorlagen', `
<p>Eine fertige Kachel als <b>Vorlage</b> ablegen und aus der Palette wieder einsetzen —
mit Inhalt, Farbe und Größe.</p>
<p>Die Muster wiederholen sich ohnehin: „Baustein" (2D-Bild, 3D-Modell, Werte),
„Ablaufschritt", „Datei mit Kurzbeschreibung".</p>`],

  ['id-tabelle', 'Modul „Tabelle"', `
<p>Werte in Zeilen und Spalten — Schaden, Reichweite, Kosten.</p>
<ul><li>heute steht das als Aufzählung in einer Notiz</li>
<li>Sortieren, einfache Summen</li>
<li>Export als CSV</li></ul>`],

  ['id-zeitstrahl', 'Modul „Zeitstrahl"', `
<p>Ablauf einer Mission, Kampagnenstruktur, Meilensteine.</p>
<p>Steht seit jeher als Beispiel im Modulvertrag — gebaut ist es nie worden.</p>`],

  ['id-transklusion', 'Dieselbe Notiz auf zwei Tafeln', `
<p>Eine Kachel als <b>Verweis</b> auf eine Kachel in einer anderen Tafel, so wie ein
3D-Modell schon in mehreren Fenstern stecken darf.</p>
<p>Heute wird kopiert — und läuft danach auseinander.</p>`],

  ['id-diff-zweitafeln', 'Zwei Tafeln vergleichen', `
<p><code>GD.vergleich.punkte(alt, neu)</code> kann bereits zwei Abzüge gegeneinander
rechnen. Bisher nur für <i>dieselbe</i> Tafel zu zwei Zeitpunkten.</p>
<p>Denkbar: zwei Dateien aus dem Projektordner wählen und die Unterschiede in derselben
roten Sicht zeigen.</p>`],

  ['id-tastatur', 'Ohne Maus von Kachel zu Kachel', `
<p>Tab/Pfeile springen zur nächsten Kachel in Blickrichtung, Enter geht hinein,
Escape wieder heraus.</p>
<p>Verschieben mit Pfeiltasten gibt es schon — das Auswählen fehlt.</p>`],

  ['id-pfeile', 'Pfeile automatisch entzerren', `
<p>Regel 2 löst Überlappungen von <b>Kacheln</b> auf. Pfeile, die übereinanderliegen
oder eine Kachel kreuzen, bleiben, wie sie sind.</p>
<p>Denkbar: eine sechste Regel, die Ankerseiten neu wählt und Beschriftungen freistellt.</p>`],

  ['id-zusammen', 'Zwei Fenster auf derselben Datei', `
<p>Zwei Browserfenster auf dieselbe <code>.gamedesk.json</code> — das zweite bemerkt
die Änderung nicht und überschreibt sie beim Speichern.</p>
<p>Kleinste Lösung: Der Server meldet die Änderungszeit, und „Speichern" fragt nach,
wenn die Datei jünger ist als der eigene Stand.</p>
<p><span style="color:#e8b45c">Dringlich geworden</span>, seit mehrere KI-Sitzungen
gleichzeitig an derselben Tafel arbeiten.</p>`],

  ['id-hier', 'Neue Idee hier', `
<p style="color:#8a93a5">Doppelklick auf die leere Fläche im Rahmen legt eine neue Notiz
an. Der <b>Titel</b> wird zur Überschrift des Abschnitts im Prompt — also einen wählen,
der für sich steht.</p>`]
];
ideen.forEach(([k, titel, html]) => notiz(k, titel, html, { w: 400, fontSize: 12.5, accent: NEUTRAL }));

/* ===================================================================== */
/* Anordnen                                                              */
/* ===================================================================== */

const ABSTAND_REIHE = 420;        // zwischen zwei Abschnittsreihen
let reiheY = 0;

/* ---- Reihe 1: Seiten & Oberfläche | Kern ---------------------------- */

const kastenA = setze(0, 0, [
  ['a-index', 'a-topbar', 'a-palette'],
  ['a-wire', 'a-board', 'a-inspector'],
  ['a-neben', 'a-dlg-projekte', 'a-dlg-aend', 'a-dlg-einst', 'a-dlg-hilfe']
]);
const rahmenA = lege('f-seiten', 'Seiten & Oberfläche', kastenA, {
  tint: C.menues, bereich: 'menues', z: 2, strength: 0.07,
  note: 'index.html · eine Seite, sechs Flächen, vier Dialoge'
});

const xB = rahmenA.x + rahmenA.w + GASSE;
const kastenB = setze(xB, 0, [
  ['b-util', 'b-registry', 'b-store'],
  ['b-board', 'b-windows', 'b-connections', 'b-minimap'],
  ['b-library', 'b-layout'],
  ['b-ui', 'b-app']
], GASSE);
const rahmenB = lege('f-kern', 'Kern', kastenB, {
  tint: C.technik, bereich: 'technik', z: 3, strength: 0.07,
  note: '17 Kerndateien, eine Ladekette, ein Namensraum GD — hier elf davon'
});

reiheY = Math.max(rahmenA.y + rahmenA.h, rahmenB.y + rahmenB.h) + ABSTAND_REIHE;

/* ---- Reihe 2: Module | 3D-Maschine ---------------------------------- */

const kastenC = setze(0, reiheY, [
  ['c-vertrag', 'c-frame', 'c-notes'],
  ['c-wireframe', 'c-code', 'c-media'],
  ['c-model3d', 'c-modelview', 'c-sandbox', 'c-project', 'c-worker']
]);
const rahmenC = lege('f-module', 'Module', kastenC, {
  tint: C.game, bereich: 'game', z: 4, strength: 0.07,
  note: 'Der Inhalt eines Fensters · zehn Stück in js/modules/'
});

const xD = rahmenC.x + rahmenC.w + GASSE;
const kastenD = setze(xD, reiheY, [
  ['d-geom3d', 'd-gl3d'],
  ['d-models', 'd-bruecke']
]);
const rahmenD = lege('f-3d', '3D-Maschine', kastenD, {
  tint: C.mechanik, bereich: 'mechanik', z: 5, strength: 0.07,
  note: 'Kein three.js — rund 1 490 Zeilen WebGL2 und Geometrie'
});

reiheY = Math.max(rahmenC.y + rahmenC.h, rahmenD.y + rahmenD.h) + ABSTAND_REIHE;

/* ---- Reihe 3: Daten | Änderungsverfolgung | Bibliothek -------------- */

const kastenE = setze(0, reiheY, [
  ['e-doc', 'e-window', 'e-conn'],
  ['e-orte', 'e-historie', 'e-normalize']
]);
const rahmenE = lege('f-daten', 'Daten & Format', kastenE, {
  tint: C.daten, bereich: 'daten', z: 6, strength: 0.07,
  note: '.gamedesk.json · localStorage · Historie'
});

const xJ = rahmenE.x + rahmenE.w + GASSE;
const kastenJ = setze(xJ, reiheY, [
  ['j-vergleich', 'j-festschreiben'],
  ['j-aenderungen', 'j-depot']
]);
const rahmenJ = lege('f-aend', 'Änderungsverfolgung & Medienlager', kastenJ, {
  tint: C.daten, bereich: 'daten', z: 11, strength: 0.07,
  note: 'Was sich geändert hat — und wo die Bytes liegen'
});

const xF = rahmenJ.x + rahmenJ.w + GASSE;
const kastenF = setze(xF, reiheY, [
  ['f-zwei', 'f-serve', 'f-reise'],
  ['f-api', 'f-sicher', 'f-broweg']
]);
const rahmenF = lege('f-bib', 'Bibliothek & Server', kastenF, {
  tint: C.betrieb, bereich: 'betrieb', z: 7, strength: 0.07,
  note: 'Ein Ordner auf der Platte · 127.0.0.1 · Brücke nach Broweg'
});

reiheY = Math.max(rahmenE.y + rahmenE.h, rahmenJ.y + rahmenJ.h, rahmenF.y + rahmenF.h) + ABSTAND_REIHE;

/* ---- Reihe 4: Regeln & Gestaltung | Ablauf einer Änderung ------------ */

const kastenG = setze(0, reiheY, [
  ['g-regeln', 'g-bereiche', 'g-z'],
  ['g-schrift', 'g-raum', 'g-gasse']
]);
const rahmenG = lege('f-regeln', 'Regeln & Gestaltung', kastenG, {
  tint: C.gamedesign, bereich: 'gamedesign', z: 8, strength: 0.07,
  note: 'Was das Bild ruhig hält'
});

const xH = rahmenG.x + rahmenG.w + GASSE;
const kastenH = setze(xH, reiheY, schritte.map(([k]) => [k]), GASSE * 0.75);
const rahmenH = lege('f-ablauf', 'Ablauf einer Änderung', kastenH, {
  tint: C.mechanik, bereich: 'mechanik', z: 9, strength: 0.07,
  note: 'Vom Tastenanschlag bis in die Datei — und wieder zurück'
});

reiheY = Math.max(rahmenG.y + rahmenG.h, rahmenH.y + rahmenH.h) + ABSTAND_REIHE;

/* ---- Reihe 5: Weiterentwicklung ------------------------------------- */

/* Zuerst die Ideen in ihrem eigenen, verschachtelten Rahmen. Er liegt
   UNTER der Worker-Kachel — der Pfeil läuft von hier nach oben. */
const kastenIdeen = setze(0, reiheY + 800, [
  ideen.slice(0, 4).map((i) => i[0]),
  ideen.slice(4, 8).map((i) => i[0]),
  ideen.slice(8).map((i) => i[0])
]);
const rahmenIdeen = lege('f-ideen', 'Ideen — hier sammeln', kastenIdeen, {
  tint: NEUTRAL, bereich: 'sonstiges', z: 30, strength: 0.11, dashed: true,
  note: 'eine Notiz je Idee · Reihenfolge auf der Tafel = Reihenfolge im Prompt'
});

/* Die Worker-Kachel, ihre Anforderung und der Prototyp darüber */
setze(0, reiheY, [['i-worker'], ['i-anforderung'], ['i-prototyp']], SPALTE * 3);

const kastenI = {
  x: 0, y: reiheY,
  w: Math.max(rahmenIdeen.x + rahmenIdeen.w, holen('i-prototyp').x + holen('i-prototyp').w),
  h: (rahmenIdeen.y + rahmenIdeen.h) - reiheY
};
lege('f-weiter', 'Weiterentwicklung', kastenI, {
  tint: C.sonstiges, bereich: 'sonstiges', z: 10, strength: 0.06,
  note: 'Ideensammlung und der Weg von hier zu einem Worker'
});

/* ---- Titel ---------------------------------------------------------- */

notiz('titel', 'GameDesk', `
<h1>GameDesk — Funktionsweise</h1>
<p><b>Ein Board zum Entwerfen von Spielen.</b> Eine unendliche Fläche, auf der modulare
Fenster liegen, die mit beschrifteten Pfeilen verbunden werden.</p>
<p>Läuft komplett lokal im Browser — <b>kein Build, keine Abhängigkeit, kein Netz</b>.
Rund 13 000 Zeilen JavaScript in 27 klassischen <code>&lt;script&gt;</code>-Dateien
(17 im Kern, 10 Module), dazu 1 830 Zeilen Blatt, 130 Zeilen <code>index.html</code> und
zwei Werkzeuge in Node, die ohne ein einziges Paket auskommen.</p>
<p>Diese Tafel bildet GameDesk mit seinen eigenen Mitteln ab: die <b>Seiten</b> der
Oberfläche, die <b>Ladekette des Kerns</b>, die zehn <b>Module</b>, die
<b>3D-Maschine</b>, das <b>Dateiformat</b>, die <b>Änderungsverfolgung</b> samt
Medienlager, den <b>Projektordner</b> mit Server und Broweg-Brücke und die <b>Regeln</b>,
die das Bild ruhig halten. Ganz unten sammelt ein Rahmen die
<b>Weiterentwicklungsideen</b>; ein Pfeil führt von dort zur Worker-Kachel.</p>
<p style="color:#8a93a5;font-size:.9em">Stand des Quelltextes: 11.08.2026, 00:32 Uhr ·
10 Module · 17 Kerndateien · 10 Bereiche in der Taxonomie · 5 Anordnungsregeln ·
2 Stapelbänder · 7 Änderungsklassen</p>`,
  { w: 900, fontSize: 14, accent: C.menues });
const titel = holen('titel');
titel.x = rahmenA.x;
titel.y = rahmenA.y - titel.h - 200;

/* ===================================================================== */
/* Verbindungen                                                          */
/* ===================================================================== */

/* --- innerhalb des Kerns: die Abhängigkeitskette --------------------- */

link('b-util', 'b-store', 'uid · clone · debounce · emitter', { from: 'r', to: 'l', size: 11, color: '#8fa4c4' });
link('b-util', 'b-registry', 'el() · svg()', { from: 'b', to: 't', size: 11, color: '#8fa4c4', dash: 'dotted' });
link('b-store', 'b-board', 'doc.view', { from: 'r', to: 'l', size: 11, color: '#e8b45c' });
link('b-store', 'b-windows', 'doc.windows', { from: 'r', to: 'l', color: '#e8b45c', width: 2.5 });
link('b-store', 'b-connections', 'doc.connections · doc.bundles', { from: 'r', to: 'l', size: 11, color: '#e8b45c' });
link('b-registry', 'b-windows', 'modules.get(type).create(ctx)', { from: 'r', to: 'l', color: '#57c98a', width: 2.5 });
link('b-board', 'b-windows', 'onZoom(scale)', { from: 'b', to: 't', size: 11, color: '#8fa4c4', dash: 'dashed' });
link('b-windows', 'b-connections', 'Geometrie der Enden', { from: 'b', to: 't', size: 11, color: '#8fa4c4' });
link('b-windows', 'b-minimap', 'zeichnet doc.windows', { from: 'b', to: 't', size: 11, color: '#8fa4c4', dash: 'dotted' });
link('b-windows', 'b-layout', 'setGeometry() · inst.inhaltsHoehe()', { from: 'r', to: 'l', color: '#b78cf7', width: 2.5 });
link('b-store', 'b-library', 'serialize() beim Sichern', { from: 'r', to: 'l', size: 11, color: '#ef6b6b' });
link('b-layout', 'b-ui', 'pruefe() → Einstellungen', { from: 'r', to: 'l', size: 11, color: '#b78cf7' });
link('b-library', 'b-ui', 'Dialog „Projekte"', { from: 'r', to: 'l', size: 11, color: '#ef6b6b' });
link('b-ui', 'b-app', 'runAction() · Tasten', { from: 'b', to: 't', size: 11, color: '#8fa4c4' });
link('b-app', 'b-store', 'undo · redo · Datei-Drop · Startboard', { from: 'b', to: 'b', size: 11, color: '#9aa4b6', dash: 'dashed' });

/* --- zwischen den Abschnitten ---------------------------------------- */

link('a-index', 'f-kern', 'lädt in dieser Folge', { from: 'r', to: 'l', color: '#6ea8fe', width: 2.5 });
link('b-ui', 'f-seiten', 'baut Palette, Leiste, Inspector, Dialoge', { from: 't', to: 'r', size: 11, color: '#6ea8fe', dash: 'dashed' });
link('b-registry', 'c-vertrag', 'GD.modules.register()', { from: 'b', to: 't', color: '#57c98a', width: 2.5 });
link('b-windows', 'c-vertrag', 'mount(): ctx · getState · setState', { from: 'b', to: 't', size: 11, color: '#57c98a' });
link('b-store', 'f-daten', 'doc · Historie · localStorage', { from: 'b', to: 't', color: '#e8b45c', width: 2.5 });
link('b-connections', 'e-conn', 'connections + bundles', { from: 'b', to: 't', size: 11, color: '#e8b45c', dash: 'dotted' });
link('b-layout', 'f-regeln', 'setzt die fünf Regeln durch', { from: 'b', to: 't', color: '#b78cf7', width: 2.5 });
link('b-library', 'f-bib', 'liste · lesen · schreiben · hinein', { from: 'b', to: 't', color: '#ef6b6b', width: 2.5 });
link('f-bib', 'b-library', 'api/bibliothek/*', { from: 'l', to: 'b', size: 11, color: '#ef6b6b', dash: 'dashed' });

link('c-model3d', 'f-3d', 'geom3d · gl3d · models', { from: 'r', to: 'l', color: '#4fd1c5', width: 2.5 });
link('c-modelview', 'd-models', 'zeigt ein gespeichertes Modell', { from: 'r', to: 'l', size: 11, color: '#4fd1c5' });
link('c-sandbox', 'd-bruecke', 'GameDesk.geometry()', { from: 'r', to: 'l', size: 11, color: '#4fd1c5', dash: 'dashed' });
link('d-geom3d', 'd-gl3d', 'geteilte Netze', { from: 'b', to: 't', size: 11, color: '#4fd1c5' });
link('d-models', 'd-geom3d', 'bake() über geom3d.get()', { from: 't', to: 'r', size: 11, color: '#4fd1c5', dash: 'dotted' });

link('c-project', 'f-bib', 'liest fremde Tafeln', { from: 'b', to: 't', size: 11, color: '#ef6b6b' });
link('c-worker', 'f-broweg', 'api/broweg/ruf', { from: 'b', to: 't', color: '#ef6b6b', width: 2.5 });
link('c-media', 'j-depot', 'depot:<sha256> statt data:', { from: 'b', to: 't', color: '#e8b45c', width: 2.5 });
link('c-frame', 'g-regeln', 'kopfHoehe() meldet das Kopfband', { from: 'b', to: 't', size: 11, color: '#b78cf7', dash: 'dotted' });
link('c-notes', 'g-gasse', 'inhaltsHoehe() — Regel 1', { from: 'b', to: 't', size: 11, color: '#b78cf7', dash: 'dotted' });

link('b-store', 'j-aenderungen', 'doc.aenderungen', { from: 'b', to: 't', size: 11, color: '#e8b45c' });
link('j-aenderungen', 'j-vergleich', 'abzug() · punkte()', { from: 'l', to: 'r', color: '#e8b45c', width: 2.5 });
link('j-festschreiben', 'j-vergleich', 'derselbe Kern in Node', { from: 't', to: 'b', size: 11, color: '#e8b45c', dash: 'dashed' });
link('j-depot', 'b-store', 'aufblasen() beim Schreiben', { from: 't', to: 'b', size: 11, color: '#e8b45c', dash: 'dotted' });

/* --- der Ablauf: eine Kette ------------------------------------------ */

for (let i = 0; i < schritte.length - 1; i++) {
  link(schritte[i][0], schritte[i + 1][0], '', { from: 'r', to: 'l', color: '#4fd1c5', width: 2.5, curve: 'straight' });
}
link('h-7', 'h-1', 'nächste Runde', { from: 'b', to: 'b', size: 11, color: '#4fd1c5', dash: 'dashed' });
link('e-historie', 'h-4', 'changed() oder commit()?', { from: 'b', to: 't', size: 11, color: '#e8b45c', dash: 'dotted' });
link('j-aenderungen', 'h-7', 'festschreiben({ titel, wer })', { from: 'b', to: 't', size: 11, color: '#e8b45c', dash: 'dotted' });

/* --- der Worker-Connector -------------------------------------------- */

link('f-ideen', 'i-worker', 'Notizen → strukturierter Prompt', {
  from: 't', to: 'b', color: '#e8b45c', width: 3, size: 14
});
link('i-anforderung', 'i-worker', 'was noch zu bauen ist', { from: 'l', to: 'r', size: 11, color: '#e8b45c', dash: 'dashed' });
link('i-prototyp', 'i-worker', 'so sieht der Prompt aus', { from: 'l', to: 'r', size: 11, color: '#e8b45c', dash: 'dashed' });
link('i-worker', 'c-worker', 'dieselbe Kachel, dort beschrieben', { from: 't', to: 'b', size: 11, color: '#57c98a', dash: 'dotted' });
link('f-ideen', 'c-frame', 'dragCompanions() liefert die Ideen', { from: 'l', to: 'b', size: 11, color: '#57c98a', dash: 'dotted' });

/* ===================================================================== */
/* Ausgabe                                                               */
/* ===================================================================== */

/* Alles ins Positive schieben — negative Koordinaten sind zwar erlaubt,
   erschweren aber jedes spätere Umbauskript. */
const minX = Math.min.apply(null, wins.map((w) => w.x));
const minY = Math.min.apply(null, wins.map((w) => w.y));
for (const w of wins) { w.x = Math.round(w.x - minX + 200); w.y = Math.round(w.y - minY + 200); }

const doc = {
  format: 'gamedesk-board',
  version: 1,
  name: 'GameDesk — Funktionsweise',
  view: { x: 120, y: 90, scale: 0.15 },
  grid: { size: 20, show: true, snap: true },
  windows: wins,
  connections: conns,
  bundles: [],
  models: [],
  aenderungen: { basis: null, commits: [] },
  nextZ: wins.length + 200
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 1), 'utf8');

const typen = {};
for (const w of wins) typen[w.type] = (typen[w.type] || 0) + 1;
console.log('geschrieben:', OUT);
console.log('Fenster:', wins.length, '· Verbindungen:', conns.length);
console.log('Typen:', JSON.stringify(typen));
console.log('Ausdehnung:',
  Math.round(Math.max.apply(null, wins.map((w) => w.x + w.w))), '×',
  Math.round(Math.max.apply(null, wins.map((w) => w.y + w.h))));
