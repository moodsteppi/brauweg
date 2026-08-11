/* ÜBERHOLT — NICHT MEHR LAUFEN LASSEN.
 *
 * Dieses Skript hat die Tafel am 10.8.2026 einmal erzeugt. Danach ist sie in
 * GameDesk weitergewachsen (Bauten und Truppen, 3D-Modelle, Handy-Aufnahmen,
 * Spielmechanik) und am selben Tag in zwei Abschnitte umgebaut worden. Ein
 * Lauf hier überschriebe all das mit dem alten Stand von 30 Kacheln.
 *
 * Quelle ist die JSON-Datei. Änderungen laufen als Umbauskript darauf —
 * Vorbild: `_umbau-feldherr-abschnitte.mjs`.
 *
 * Bleibt liegen, weil hier die Struktur ablesbar ist, mit der die Tafel
 * angefangen hat.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = 'C:/Users/freyd/Desktop/SPIDERVISION/gamedesk/boards/feldherr-funktionsweise.gamedesk.json';

let n = 0;
const uid = (p) => p + '_fh_' + (++n).toString(36);
const wins = [];
const conns = [];
const key = new Map();

function win(k, type, title, x, y, w, h, state, accent) {
  const id = uid('win');
  key.set(k, id);
  wins.push({ id, type, title, x, y, w, h, z: 10 + wins.length, accent: accent || null, collapsed: false, state });
  return id;
}

/* bereich: id aus GD.layout.BEREICHE (js/core/layout.js). Die Farbe bleibt
   die hier gesetzte — der Bereich ordnet ein, er färbt nicht nach. */
function frame(k, title, note, tint, members, bereich, pad = 46) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const m of members) {
    const w = wins.find((v) => v.id === key.get(m));
    if (!w) throw new Error('unbekannt: ' + m);
    x1 = Math.min(x1, w.x); y1 = Math.min(y1, w.y);
    x2 = Math.max(x2, w.x + w.w); y2 = Math.max(y2, w.y + w.h);
  }
  const id = uid('win');
  key.set(k, id);
  wins.unshift({
    id, type: 'frame', title,
    x: x1 - pad, y: y1 - pad - 34, w: (x2 - x1) + pad * 2, h: (y2 - y1) + pad * 2 + 34,
    z: 1, accent: tint, collapsed: false,
    state: { tint, strength: 0.075, dashed: false, note, bereich: bereich || null }
  });
}

/** a/b dürfen „fenster" oder „fenster#formId" sein. */
function link(a, b, label, opts = {}) {
  const split = (s) => {
    const i = s.indexOf('#');
    return i < 0 ? [s, null] : [s.slice(0, i), s.slice(i + 1)];
  };
  const [aw, as] = split(a), [bw, bs] = split(b);
  conns.push({
    id: uid('con'),
    from: { win: key.get(aw), side: opts.from || 'auto', shape: as },
    to: { win: key.get(bw), side: opts.to || 'auto', shape: bs },
    label, labelSize: opts.size || 12, t: opts.t === undefined ? 0.5 : opts.t,
    color: opts.color || '#6ea8fe', width: opts.width || 2,
    dash: opts.dash || 'solid', curve: opts.curve || 'bezier', heads: opts.heads || 'end'
  });
}

const note = (html, fontSize = 13) => ({ html, fontSize });
const code = (path, src, o = {}) => ({
  path, code: src.replace(/^\n/, '').replace(/\s+$/, ''),
  firstLine: o.firstLine || 1, size: o.size || 11, wrap: false,
  marks: o.marks || [], caption: o.caption || ''
});

/* ===================================================================== */
/* 1  Bildschirme mit verdrahteten Knöpfen                               */
/* ===================================================================== */

const BTN = { radius: 10, fill: '#1d2b33', stroke: '#3d5361', font: { size: 14, weight: 650, color: '#dfd6c2' } };
const CARD = { radius: 8, fill: '#22323b', stroke: '#46606f', font: { size: 12, weight: 600, color: '#dfd6c2' } };

/* --- Vor dem Gefecht --- */
const A = [];
const pushA = (o) => A.push(Object.assign({ type: 'rect' }, o));
pushA({ id: 'a_bg', x: 0, y: 0, w: 640, h: 460, fill: '#101922', strokeOn: false, radius: 0 });
pushA({ id: 'a_titel', type: 'text', x: 40, y: 30, w: 560, h: 46, text: 'FELDHERR', font: { size: 34, weight: 800, color: '#dfd6c2', align: 'left' }, pad: 0 });
pushA({ id: 'a_sub', type: 'text', x: 40, y: 76, w: 560, h: 24, text: 'Echtzeitduell · zwei Feldherren, ein Brett', font: { size: 13, color: '#7c8f9b', align: 'left' }, pad: 0 });

pushA(Object.assign({ id: 'a_ki', x: 40, y: 130, w: 260, h: 52, text: 'Gegen die KI' }, BTN));
pushA(Object.assign({ id: 'a_zuzweit', x: 40, y: 196, w: 260, h: 52, text: 'Zu zweit am Gerät' }, BTN));
pushA(Object.assign({ id: 'a_online', x: 40, y: 262, w: 260, h: 52, radius: 10, fill: '#2f6fe4', stroke: '#5b8ff0', text: 'Online spielen', font: { size: 14, weight: 700, color: '#ffffff' } }));
pushA(Object.assign({ id: 'a_zurueck', x: 40, y: 340, w: 150, h: 40, text: 'Zurück', font: { size: 12, weight: 600, color: '#9fb0ba' }, fill: '#16222b', stroke: '#2b3d48', radius: 9 }));

pushA({ id: 'a_feldlabel', type: 'text', x: 340, y: 132, w: 260, h: 20, text: 'Feldgröße', font: { size: 11, color: '#7c8f9b', align: 'left' }, pad: 0 });
['klein', 'mittel', 'groß'].forEach((t, i) => {
  pushA(Object.assign({ id: 'a_feld' + i, x: 340 + i * 88, y: 156, w: 80, h: 36, radius: 8, text: t },
    { fill: i === 1 ? '#2a4a3a' : '#1a2730', stroke: i === 1 ? '#4d8a68' : '#2b3d48', font: { size: 12, color: '#cfd6e4' } }));
});

/* Münzwurf-Auflage */
pushA({ id: 'a_ov', x: 330, y: 230, w: 280, h: 190, radius: 14, fill: '#16232c', stroke: '#3d5361', shadow: { on: true, x: 0, y: 8, blur: 24, color: '#00000066' } });
pushA({ id: 'a_ovtitel', type: 'text', x: 350, y: 248, w: 240, h: 24, text: 'Wer beginnt?', font: { size: 15, weight: 700, color: '#dfd6c2', align: 'left' }, pad: 0 });
pushA(Object.assign({ id: 'a_kopf', x: 352, y: 290, w: 110, h: 46, text: 'Kopf' }, CARD, { font: { size: 13, weight: 700, color: '#dfd6c2' } }));
pushA(Object.assign({ id: 'a_zahl', x: 478, y: 290, w: 110, h: 46, text: 'Zahl' }, CARD, { font: { size: 13, weight: 700, color: '#dfd6c2' } }));
pushA({ id: 'a_ovhint', type: 'text', x: 352, y: 350, w: 240, h: 40, text: 'Der Wurf entscheidet, wer sein Haupthaus zuerst setzt.', font: { size: 11, color: '#7c8f9b', align: 'left', valign: 'top' }, pad: 0 });

win('wf-vor', 'wireframe', 'Vor dem Gefecht', -1620, -900, 620, 470, {
  canvas: { w: 640, h: 460, bg: '#101922' },
  shapes: A, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true }
}, '#6ea8fe');

/* --- Im Gefecht --- */
const B = [];
const pushB = (o) => B.push(Object.assign({ type: 'rect' }, o));
pushB({ id: 'b_bg', x: 0, y: 0, w: 640, h: 470, fill: '#0e1a14', strokeOn: false, radius: 0 });
pushB({ id: 'b_hudtop', x: 0, y: 0, w: 640, h: 44, fill: '#10202a', strokeOn: false, radius: 0, text: 'Gegner  ▮▮▮▮▮▯▯   ·   Takt 412', font: { size: 12, color: '#9fb0ba' } });
pushB({ id: 'b_feld', x: 60, y: 62, w: 520, h: 250, radius: 6, fill: '#1b3527', stroke: '#2f5a41' });
for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
  pushB({ id: 'b_z' + r + c, x: 72 + c * 64, y: 74 + r * 60, w: 56, h: 52, radius: 4, fill: '#20402e', stroke: '#2c5540', strokeW: 0.5 });
}
pushB({ id: 'b_haus', x: 72, y: 194, w: 56, h: 52, radius: 4, fill: '#5c4a2a', stroke: '#8a6f3d', text: '⌂', font: { size: 20, color: '#e8d9b0' } });
pushB({ id: 'b_gegnerhaus', x: 520, y: 74, w: 56, h: 52, radius: 4, fill: '#4a2c2c', stroke: '#8a3d3d', text: '⌂', font: { size: 20, color: '#e8b0b0' } });

pushB({ id: 'b_gold', x: 60, y: 326, w: 130, h: 34, radius: 8, fill: '#1a2a20', stroke: '#2f5a41', text: '⛁ 240', font: { size: 13, weight: 700, color: '#e8d9b0' } });

['Schwert', 'Bogen', 'Mauer', 'Turm'].forEach((t, i) => {
  pushB(Object.assign({ id: 'b_karte_' + i, x: 60 + i * 108, y: 374, w: 96, h: 76, text: t }, CARD));
});
pushB(Object.assign({ id: 'b_halt', x: 500, y: 326, w: 80, h: 34, text: 'HALT', radius: 8, fill: '#3a2020', stroke: '#7a3b3b', font: { size: 12, weight: 700, color: '#e8b0b0' } }));
pushB(Object.assign({ id: 'b_abriss', x: 500, y: 374, w: 80, h: 34, text: 'Abriss' }, BTN, { font: { size: 12, weight: 600, color: '#dfd6c2' } }));
pushB(Object.assign({ id: 'b_drehen', x: 500, y: 416, w: 80, h: 34, text: 'Drehen' }, BTN, { font: { size: 12, weight: 600, color: '#dfd6c2' } }));
pushB(Object.assign({ id: 'b_pause', x: 588, y: 6, w: 44, h: 32, text: '❚❚', radius: 8, fill: '#16222b', stroke: '#2b3d48', font: { size: 12, color: '#9fb0ba' } }));

win('wf-gefecht', 'wireframe', 'Im Gefecht — HUD', -1620, -380, 620, 480, {
  canvas: { w: 640, h: 470, bg: '#0e1a14' },
  shapes: B, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true }
}, '#6ea8fe');

/* --- Wirkungen --- */
win('w-oertlich', 'notes', 'Örtlich — der Server sieht nichts', -900, -900, 400, 200, note(`
<p>Modus <code>ki</code> und <code>zuZweit</code> laufen <b>allein im Kern</b>.
Kein Tisch, keine WebSocket, kein Saatkorn vom Server — die Partie zieht ihre
Bildzeit aus der Wanduhr.</p>
<p>Erst am Ende bucht die Plattform Erfahrung und Münzen.</p>`), '#9aa4b6');

win('w-netz', 'notes', 'Online — Tisch anlegen und beitreten', -900, -670, 400, 220, note(`
<p><code>POST /api/tables</code> mit <code>game: "feldherr"</code>, dann
<code>join</code> über die WebSocket. Genau <b>zwei</b> Sitze — das Brett hat
zwei Hälften.</p>
<p>Der Server würfelt das <b>Saatkorn</b> und schickt es in der Sicht. Ab da
rechnen beide Geräte dieselbe Partie.</p>`), '#57c98a');

win('w-muenze', 'notes', 'Zug: muenze', -900, -420, 400, 180, note(`
<p>Der Wurf ist ein <b>Zug wie jeder andere</b> — <code>{ art: 'muenze',
wahl: 'kopf' | 'zahl', takt }</code>.</p>
<p>Sein Ausgang kommt nicht vom Server, sondern aus dem Saatkorn: beide
Geräte würfeln dieselbe Münze.</p>`), '#e8b45c');

win('w-karte', 'notes', 'Zug: karte / haus', -900, -210, 400, 230, note(`
<p><code>{ art: 'karte', karte: 'schwert', r: 7, c: 3, takt: 412 }</code></p>
<p><code>haus</code> ist ein eigener Zug und keine Karte: Das Haupthaus steht
in keinem Kontingent und wird nicht bezahlt — es fällt nur einmal, nach dem
Münzwurf.</p>
<p><b>Ob Gold reicht, prüft der Server nicht.</b> Das weiß nur der Spielkern,
und der läuft dort nicht mit.</p>`), '#e8b45c');

win('w-halt', 'notes', 'Zug: halt / abriss / drehen', -900, 10, 400, 200, note(`
<p>Alle drei sind dieselbe Art Nachricht — ein <code>Zug</code> mit
<code>art</code> und Feldkoordinaten, verankert an einem Takt.</p>
<p><code>art</code> bleibt bewusst grob: Der Server prüft <b>Form und
Reihenfolge</b>, nie die Spielregel.</p>`), '#e8b45c');

win('w-aufgabe', 'notes', 'Aufgeben', -900, 240, 400, 210, note(`
<p><code>{ art: 'aufgabe' }</code> beendet die Partie sofort zugunsten des
anderen.</p>
<p>Bei den Kartenspielen übernimmt hier ein Bot. Bei Feldherr geht das nicht:
Die Gegner-KI lebt im Spielkern auf den Geräten, ein Bot im Server müsste die
ganze Echtzeitpartie mitrechnen. <b>Wer geht, verliert.</b></p>`), '#ef6b6b');

frame('f-ui', 'Was der Spieler tut — und was daraus wird',
  'Jeder Pfeil hängt an genau dem Knopf, der ihn auslöst', '#6ea8fe',
  ['wf-vor', 'wf-gefecht', 'w-oertlich', 'w-netz', 'w-muenze', 'w-karte', 'w-halt', 'w-aufgabe'], 'menues');

/* ===================================================================== */
/* 2  Der Kern                                                           */
/* ===================================================================== */

const KX = -320;

win('k-kern', 'notes', 'Der Spielkern', KX, -900, 420, 300, note(`
<h3>packages/client/src/minispiele/feldherr/kern.js</h3>
<p>Rund 208 kB, <b>maschinell erzeugt</b> aus
<code>packages/game-feldherr/quelle/feldherr.html</code> — einer einzelnen
HTML-Datei ohne Abhängigkeiten.</p>
<p>Er bleibt bewusst reines JavaScript. Eine Übersetzung nach TypeScript wäre
genau die Art Änderung, die den Gleichlauf unbemerkt bricht; daneben steht
deshalb nur eine <code>.d.ts</code> als Beschreibung.</p>`), '#b78cf7');

win('k-determinismus', 'notes', 'Bitgenau gleich rechnen', KX, -560, 420, 300, note(`
<p>Alle <b>45</b> Aufrufe von <code>Math.random()</code> sind durch einen
Seed-Zufall (mulberry32) ersetzt; <code>saat(wert)</code> setzt den Anfang.</p>
<p>Nachgewiesen: zwei Läufe mit demselben Saatkorn ergeben nach 90 simulierten
Sekunden dasselbe Gelände, dieselbe KI-Taktik, denselben Sieger und Zeichen für
Zeichen dieselbe Objektliste.</p>
<p><b>Wer daran etwas ändert, bricht jedes Netzspiel</b> — nicht sofort
sichtbar, sondern erst daran, dass beide einen anderen Sieger sehen.</p>`), '#b78cf7');

win('k-draht', 'code', 'kern.d.ts — der Draht nach draußen', KX, -220, 420, 380,
  code('packages/client/src/minispiele/feldherr/kern.d.ts', `
/**
 * Der Kern entscheidet WAS gesendet wird (fertige Zuege
 * samt Takt, Herzschlaege); der Bildschirm entscheidet nur
 * WOHIN - er reicht alles unveraendert an den Tisch weiter.
 */
export interface FeldherrNetz {
  melde(zug: FeldherrZug): void;
  /** Herzschlag, alle 200 ms nach Wanduhr. */
  puls(daten: FeldherrPuls): void;
  aufgabe?(): void;
  verlassen?(): void;
}

export interface FeldherrSitzung {
  beenden(): void;
  zugAnnehmen(zug: FeldherrZug, sitz: number): void;
  pulsAnnehmen(sitz: number, daten: FeldherrPuls): void;
  takt(): number;
  pruefsumme(): string;
}`, { marks: [7, 9], caption: 'Wer im Bildschirm Spiellogik ergänzt, baut sie am Gleichschritt vorbei.' }),
  '#8fa4c4');

win('k-takt', 'code', 'regeln.ts — Takt und Vorlauf', KX, 200, 420, 330,
  code('packages/game-feldherr/src/regeln.ts', `
/**
 * Beide Geraete rechnen in festen Schritten, damit gleiche
 * Aktionsfolgen gleiche Ergebnisse liefern. 50 ms sind fein
 * genug fuer fluessiges Spiel und grob genug, dass ein Handy
 * auch bei Bildratenschwankungen mitkommt.
 */
export const TAKT_MS = 50;

/**
 * Eine Aktion gilt nicht sofort, sondern erst einige Takte
 * spaeter - so lange braucht sie ueber Server und Leitung zum
 * Gegner. Ohne diesen Vorlauf muesste das schnellere Geraet
 * auf jede Aktion warten und das Spiel ruckelte bei jedem
 * Kartenlegen.
 */
export const VORLAUF_TAKTE = 6;`,
    { marks: [7, 16], caption: '6 Takte × 50 ms = 300 ms Polster für den Weg über den Server.' }),
  '#8fa4c4');

frame('f-kern', 'Der Kern — beide Geräte rechnen dieselbe Partie',
  'Gleichschritt (Lockstep) · Weg B aus docs/FELDHERR-PLAN.md', '#b78cf7',
  ['k-kern', 'k-determinismus', 'k-draht', 'k-takt'], 'mechanik');

/* ===================================================================== */
/* 3  Über die Leitung                                                   */
/* ===================================================================== */

const LX = 300;

win('l-zug', 'code', 'Ein Zug geht als action über die Leitung', LX, -900, 460, 300,
  code('packages/server/src/realtime/protocol.ts', `
{ v: 1, game: 'feldherr', type: 'action',
  tableId: 't_9f3…',
  action: { art: 'zug', zug: {
    takt: 412, art: 'karte',
    karte: 'schwert', r: 7, c: 3
  }} }`, { caption: 'Nur Handlungen gehen über die Leitung, nie Zustände.' }),
  '#8fa4c4');

win('l-takt', 'code', 'takt — Herzschlag, ausdrücklich keine Aktion', LX, -560, 460, 400,
  code('packages/server/src/realtime/protocol.ts', `
/**
 * Takt-Herzschlag eines Echtzeitspiels (Feldherr). Bewusst
 * KEINE Aktion: Er aendert keinen Partiestand, wird nicht
 * gespeichert und loest keinen Sicht-Rundruf aus - er wird
 * nur an die anderen am Tisch weitergereicht, wie ein Zuruf.
 *
 * Liefe er durch das Spielmodul, schriebe jeder
 * Feldherr-Tisch fuenfmal je Sekunde einen Schnappschuss in
 * die Datenbank und funkte jedes Mal die volle Zugliste an
 * alle.
 */
type: 'takt';
takt: number;        // Takt, bis zu dem gerechnet wurde
grenzTakt: number;   // 40er-Grenze der Pruefsumme
pruef: string;       // Zustandsprobe an dieser Grenze`,
    { marks: [2, 3, 4, 5], caption: 'Der Sitz wird vom Server gestempelt, nie vom Client behauptet.' }),
  '#ef6b6b');

win('l-warum', 'notes', 'Warum überhaupt ein Herzschlag?', LX, -120, 460, 220, note(`
<p>Ohne ihn wandert die <b>Wissensgrenze</b> der Gegenseite nicht — und ihre
Partie stünde still, sobald niemand etwas tut.</p>
<p>Alle 200 ms nach Wanduhr, ohne Warteschlange: Ein Puls, der erst nach dem
Wiederverbinden ankäme, beschriebe einen Stand, den es nicht mehr gibt. Der
nächste ist ohnehin in 200 ms da.</p>`), '#ef6b6b');

win('l-jitter', 'notes', 'Was schon schiefging', LX, 140, 460, 390, note(`
<ul>
<li><b>Schwebende Züge deckeln den Herzschlag.</b> Der Puls überholte den
Zug — die Gegenseite rechnete über einen Takt hinaus, für den noch eine
Aktion unterwegs war.</li>
<li><b>Drei Takte Polster gegen Funkjitter</b>, dazu die Lege-Vorschau im
selben Bild.</li>
<li><b>Engine-feste Mischung statt <code>Array.sort</code> mit Zufall</b> —
iPhone und Desktop sortierten gleiche Werte verschieden, und damit lief die
Partie auseinander.</li>
<li><b><code>beenden()</code> hängt die Fenster-Horcher jetzt wirklich ab</b>,
und die Bildschleife startet nicht mehr doppelt.</li>
</ul>`), '#ef6b6b');

frame('f-leitung', 'Über die Leitung', 'Zwei Nachrichtenarten, mehr braucht es nicht', '#ef6b6b',
  ['l-zug', 'l-takt', 'l-warum', 'l-jitter'], 'technik');

/* ===================================================================== */
/* 4  Das Modul auf dem Server                                           */
/* ===================================================================== */

const MX = 900;

win('m-partie', 'notes', 'Der Partiezustand ist dünn', MX, -900, 420, 260, note(`
<h3>packages/game-feldherr/src/partie.ts</h3>
<p>Saatkorn · Zugliste · Meldungen · Ausgang · Ausgestiegene. Mehr verwahrt
der Server nicht.</p>
<p>Er kennt den Spielstand <b>nicht</b> — er verwahrt nur, was beide brauchen,
um zum selben Ergebnis zu kommen.</p>`), '#57c98a');

win('m-verarbeite', 'code', 'verarbeite() — was der Server prüft', MX, -600, 420, 400,
  code('packages/game-feldherr/src/partie.ts', `
/**
 * Geprueft wird Form und Reihenfolge, NICHT die Spielregel.
 * Der Server weiss nicht, ob der Spieler sich die Karte
 * leisten kann - das entscheidet der Spielkern auf beiden
 * Geraeten gleich. Was er verhindern kann und muss:
 * Aktionen in der Vergangenheit und Aktionen nach dem Ende.
 */
if (partie.ausgang) throw new RegelverstossError('partieBeendet');
if (sitz !== 0 && sitz !== 1) throw ... ('sitzUnbekannt');

if (zug.takt <= letzterTakt(partie, sitz)) {
  throw new RegelverstossError('taktNichtAufsteigend');
}
return { ...partie, zuege: [...partie.zuege, { ...zug, sitz }] };`,
    { marks: [12, 13, 14], caption: 'Niemand kann nachträglich in einen bereits gerechneten Takt hineinschreiben.' }),
  '#8fa4c4');

win('m-adapter', 'notes', 'Dieselbe Schnittstelle, andere Gattung', MX, -160, 420, 330, note(`
<p>Feldherr erfüllt <code>GameModule</code> wie jedes Kartenspiel — nutzt aber
weder Zugfolge noch Runden:</p>
<ul>
<li><code>currentActor</code> → immer <code>null</code>, beide handeln
gleichzeitig</li>
<li><code>legalActions</code> → leer, der Kern baut die Oberfläche</li>
<li><code>xpBasisZaehltKarten: false</code> — sonst füllte jedes Gefecht die
Kartenaufgabe des Tages</li>
<li><code>seatCounts: [2]</code>, keine <code>rotationSize</code> im
üblichen Sinn</li>
</ul>`), '#57c98a');

frame('f-modul', 'Das Modul auf dem Server', 'packages/game-feldherr — reine Logik, kein Netz, keine Uhr', '#57c98a',
  ['m-partie', 'm-verarbeite', 'm-adapter'], 'technik');

/* ===================================================================== */
/* 5  Ausgang                                                            */
/* ===================================================================== */

win('e-melden', 'code', 'Beide melden getrennt', MX, 240, 420, 330,
  code('packages/game-feldherr/src/partie.ts', `
// Beide melden getrennt. Stimmen sie ueberein, steht das
// Ergebnis fest; weichen sie ab, sind die Laeufe
// auseinandergelaufen und die Partie gilt als strittig.
// Ohne diesen Abgleich haette schlicht der schnellere
// Client recht.
const einig = a.sieger === b.sieger && a.pruef === b.pruef;
return { ...partie, meldungen, ausgang: {
  sieger:  einig ? a.sieger : null,
  takte:   Math.max(a.takt, b.takt),
  strittig: !einig,
  aufgegeben: false,
}};`, { marks: [6, 10], caption: 'Die Prüfsumme des Endzustands macht ein Auseinanderlaufen sichtbar.' }),
  '#8fa4c4');

win('e-xp', 'notes', 'Erfahrung nach Dauer, mit fallendem Ertrag', LX, 600, 460, 300, note(`
<p>Die ersten <b>drei Minuten</b> bringen den vollen Satz (20 je Minute),
danach halbiert sich der Wert jeder weiteren Minute.</p>
<p style="font-family:monospace;font-size:.9em">3 min → 60 · 4 min → 70 ·
5 min → 75 · 6 min → 77 · ab 8 min → 78</p>
<p>Zwei Gründe: Eine Partie hinzuziehen soll sich nicht lohnen, und kurze,
entschiedene Gefechte sollen die bessere Wahl sein.</p>`), '#4fd1c5');

win('e-strittig', 'notes', 'Strittig — und dann?', -900, 600, 400, 300, note(`
<p>Weichen die Prüfsummen an derselben Taktgrenze ab, hält der Kern an und
meldet über <code>aufStrittig</code>. Der Ausgang bekommt
<code>sieger: null</code> und <code>strittig: true</code>.</p>
<p>Das ist kein Fehlerfall, den man wegdrücken kann: Er bedeutet, dass beide
Geräte verschiedene Partien gerechnet haben. Eine Wertung wäre geraten.</p>
<p style="color:#8a93a5">Gelöst am 7. August durch Absender-Deckel und
Selbstheilungs-Replay.</p>`), '#4fd1c5');

frame('f-ende', 'Ausgang und Wertung', 'Zwei Meldungen, eine Prüfsumme', '#4fd1c5',
  ['e-melden', 'e-xp', 'e-strittig'], 'mechanik');

/* ===================================================================== */
/* 6  Warum so                                                           */
/* ===================================================================== */

win('z-wege', 'notes', 'Drei Wege — und warum es B wurde', -1620, 600, 620, 300, note(`
<table style="width:100%;border-collapse:collapse;font-size:.92em">
<tr><td style="padding:3px 6px 3px 0"><b>A — nur örtlich</b></td>
<td>Klein zu bauen, aber kein Online, keine Rangliste. Der
Belohnungsendpunkt wäre eine Behauptung des Clients.</td></tr>
<tr><td style="padding:3px 6px 3px 0;color:#57c98a"><b>B — Gleichschritt</b></td>
<td style="color:#57c98a">Der Server bleibt Schiedsrichter für Tisch, Sitze,
Start, Ende und Belohnung. Die Partie rechnen beide Geräte.
<b>Der einzige Weg zu Online, ohne dass der Server 20-mal je Sekunde je Tisch
rechnet.</b></td></tr>
<tr><td style="padding:3px 6px 3px 0"><b>C — Server rechnet mit</b></td>
<td>Echte Server-Autorität, Betrug bauartbedingt ausgeschlossen — und
Rechenlast auf dem Server. Richtig, wenn Feldherr ein Wettbewerbsspiel mit
Rangliste werden soll. Als erster Schritt zu teuer.</td></tr>
</table>`, 12.5), '#e8b45c');

win('z-passt', 'notes', 'Was an GameModule nicht passte', -1620, 940, 620, 290, note(`
<table style="width:100%;border-collapse:collapse;font-size:.92em">
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6"><code>currentActor</code></td><td>beide handeln gleichzeitig, immer</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6"><code>legalActions</code></td><td>jede Karte auf jedes freie Feld — hunderte je Bild</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6">„uhrlos"</td><td>die Partie rechnet 20-mal je Sekunde weiter, auch wenn niemand etwas tut</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6">Runden</td><td>eine durchgehende Partie ohne Runden</td></tr>
<tr><td style="padding:2px 8px 2px 0;color:#9aa4b6"><code>xpBasis</code></td><td>gelegte Karten gibt es, aber sie sind keine Leistung</td></tr>
</table>
<p style="margin-top:8px">Wer das übergeht und Feldherr in die vorhandene Form
presst, baut <code>currentActor: () =&gt; null</code> und
<code>legalActions: () =&gt; []</code> — und hat ein Modul, das der Server
nicht mehr vorantreiben kann.</p>`, 12.5), '#e8b45c');

frame('f-warum', 'Warum es so gebaut ist', 'Feldherr ist die erste Echtzeitgattung im Haus', '#e8b45c',
  ['z-wege', 'z-passt'], 'gamedesign');

/* ===================================================================== */
/* Überschrift                                                           */
/* ===================================================================== */

win('titel', 'notes', 'Feldherr', -1620, -1320, 900, 260, note(`
<h1>Feldherr — Funktionsweise</h1>
<p><b>Echtzeitduell für genau zwei Feldherren</b>, eingebaut in die
Kartenspiel-Plattform Brauweg. Kein Kartenspiel, aber dasselbe
<code>GameModule</code>.</p>
<p>Der Kniff: Über die Leitung gehen <b>nur Handlungen, nie Zustände</b>.
Beide Geräte rechnen aus demselben Saatkorn und derselben Zugliste dieselbe
Partie — eine Partie kommt mit einigen Dutzend Aktionen aus statt mit zwanzig
Zuständen je Sekunde.</p>
<p style="color:#8a93a5;font-size:.9em">packages/game-feldherr ·
packages/client/src/screens/FeldherrTisch.tsx ·
packages/client/src/minispiele/feldherr/kern.js · docs/FELDHERR-PLAN.md</p>`, 14), '#6ea8fe');

/* ===================================================================== */
/* Pfeile — Knöpfe an ihre Wirkung                                       */
/* ===================================================================== */

link('wf-vor#a_ki', 'w-oertlich', 'startet den Kern ohne Netz', { from: 'r', to: 'l', color: '#9aa4b6', size: 11.5 });
link('wf-vor#a_zuzweit', 'w-oertlich', 'zwei am selben Gerät', { from: 'r', to: 'l', color: '#9aa4b6', size: 11.5, t: 0.62 });
link('wf-vor#a_online', 'w-netz', 'Tisch anlegen · join', { from: 'r', to: 'l', color: '#57c98a', width: 2.5, size: 12 });
link('wf-vor#a_kopf', 'w-muenze', "art: 'muenze'", { from: 'b', to: 'l', color: '#e8b45c', size: 11.5 });
link('wf-vor#a_zahl', 'w-muenze', '', { from: 'b', to: 'l', color: '#e8b45c', size: 11.5 });

link('wf-gefecht#b_karte_0', 'w-karte', "art: 'karte'", { from: 'r', to: 'l', color: '#e8b45c', size: 11.5 });
link('wf-gefecht#b_haus', 'w-karte', "art: 'haus' — einmalig", { from: 't', to: 'l', color: '#e8b45c', size: 11.5, t: 0.35 });
link('wf-gefecht#b_halt', 'w-halt', "art: 'halt'", { from: 'r', to: 'l', color: '#e8b45c', size: 11.5 });
link('wf-gefecht#b_abriss', 'w-halt', "'abriss'", { from: 'r', to: 'l', color: '#e8b45c', size: 11.5, t: 0.6 });
link('wf-gefecht#b_drehen', 'w-halt', "'drehen'", { from: 'r', to: 'l', color: '#e8b45c', size: 11.5, t: 0.72 });
link('wf-gefecht#b_pause', 'w-aufgabe', 'Pausenmenü → Aufgeben', { from: 'r', to: 't', color: '#ef6b6b', size: 11.5 });

/* Ebenen untereinander */
link('w-netz', 'k-kern', 'Saatkorn aus der Sicht', { from: 'r', to: 'l', color: '#b78cf7' });
link('w-karte', 'k-draht', 'melde(zug)', { from: 'r', to: 'l', color: '#b78cf7', width: 2.5 });
link('k-draht', 'l-zug', 'reicht unverändert weiter', { from: 'r', to: 'l', width: 2.5 });
link('k-draht', 'l-takt', 'puls alle 200 ms', { from: 'r', to: 'l', color: '#ef6b6b', dash: 'dashed' });
link('k-takt', 'k-draht', 'Takt 50 ms · Vorlauf 6', { from: 't', to: 'b', color: '#8fa4c4', size: 11 });
link('l-zug', 'm-verarbeite', 'act(party, seat, action)', { from: 'r', to: 'l', color: '#57c98a', width: 2.5 });
link('m-verarbeite', 'm-partie', 'Zug an die Liste', { from: 't', to: 'b', color: '#57c98a', size: 11 });
link('m-partie', 'e-melden', 'Meldungen · Ausgang', { from: 'b', to: 't', color: '#4fd1c5' });
link('l-takt', 'l-warum', 'weitergereicht wie ein Zuruf', { from: 'b', to: 't', color: '#ef6b6b', size: 11 });
link('e-melden', 'e-strittig', 'Prüfsummen weichen ab', { from: 'l', to: 'r', color: '#4fd1c5', dash: 'dashed', size: 11.5 });
link('e-melden', 'e-xp', 'takte → Punkte', { from: 'b', to: 'r', color: '#4fd1c5', size: 11.5 });
link('m-adapter', 'z-passt', 'was nicht passte', { from: 'b', to: 'r', color: '#e8b45c', dash: 'dotted', size: 11 });
link('z-wege', 'k-kern', 'Weg B', { from: 't', to: 'b', color: '#e8b45c', dash: 'dashed', size: 11.5 });
link('l-jitter', 'k-determinismus', 'brach den Gleichlauf', { from: 'l', to: 'b', color: '#ef6b6b', dash: 'dotted', size: 11 });

/* ------------------------------------------------------------- Ausgabe */

const doc = {
  format: 'gamedesk-board', version: 1,
  name: 'Feldherr — Funktionsweise',
  view: { x: 1100, y: 620, scale: 0.38 },
  grid: { size: 20, show: true, snap: true },
  windows: wins, connections: conns, models: [],
  nextZ: wins.length + 10
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 1), 'utf8');
const anShape = conns.filter((c) => c.from.shape || c.to.shape).length;
console.log('geschrieben:', OUT);
console.log('Fenster:', wins.length, '· Rahmen:', wins.filter((w) => w.type === 'frame').length);
console.log('Pfeile:', conns.length, '· davon an einzelnen Elementen:', anShape);
