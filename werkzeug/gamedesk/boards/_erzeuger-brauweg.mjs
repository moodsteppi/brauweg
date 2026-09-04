/*
 * Erzeugt die GameDesk-Tafel „Brauweg — Funktionsweise".
 *
 * Diese Tafel ist zugleich die Visual-Building-Tafel des Systems: Der
 * Orchestrator sucht sie ueber den Namen (er muss „brauweg" enthalten) und
 * gibt ihr Destillat jedem Auftrag mit — siehe `docs/TAFEL.md`.
 *
 * Zwei Dinge folgen daraus und sehen im Editor wie eine Marotte aus:
 *
 *   1. Alles Wissen steht in NOTIZ-Kacheln. Das Destillat des Servers liest
 *      nur `frame` und `notes` (bro-server/src/lib/tafel-wissen.ts); der
 *      Inhalt von Code-, Skizzen- und Sandkasten-Kacheln erreicht keinen
 *      Auftrag. Sie bleiben als Anschauung stehen, tragen aber keine Aussage,
 *      die es nicht daneben als Notiz gibt.
 *   2. Befunde heissen „⚠ …". Wer einen behebt, meldet den Kacheltitel im
 *      TAFEL-Block; der Server macht daraus ein „✓" samt Datum. Ein Befund
 *      ohne ⚠ im Titel ist von einem Baustein nicht zu unterscheiden.
 */
import { writeFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Neben das Skript, nicht auf einen Desktop-Pfad: Die Tafel liegt im Repo
   (werkzeug/gamedesk/boards/), und dort soll der naechste Lauf sie auch
   ablegen — sonst schreibt der Erzeuger ins Leere und die eingecheckte Datei
   bleibt still auf altem Stand. */
const OUT = fileURLToPath(new URL('./brauweg-funktionsweise.gamedesk.json', import.meta.url));

let n = 0;
const uid = (p) => p + '_bw_' + (++n).toString(36);

const wins = [];
const conns = [];
const key = new Map();          // Kurzname -> Fenster-ID

function win(k, type, title, x, y, w, h, state, accent, z) {
  const id = uid('win');
  key.set(k, id);
  wins.push({ id, type, title, x, y, w, h, z: z || 10 + wins.length, accent: accent || null, collapsed: false, state });
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
    z: 1 + wins.length * 0, accent: tint, collapsed: false,
    state: { tint, strength: 0.075, dashed: false, note, bereich: bereich || null }
  });
  return id;
}

function link(a, b, label, opts = {}) {
  conns.push({
    id: uid('con'),
    from: { win: key.get(a), side: opts.from || 'auto' },
    to: { win: key.get(b), side: opts.to || 'auto' },
    label, labelSize: opts.size || 12, t: opts.t === undefined ? 0.5 : opts.t,
    color: opts.color || '#6ea8fe', width: opts.width || 2,
    dash: opts.dash || 'solid', curve: opts.curve || 'bezier', heads: opts.heads || 'end'
  });
}

/* ------------------------------------------------------------ Bausteine */

/*
 * `boardRef` ist keine GameDesk-Eigenschaft, sondern eine des Tafel-Servers:
 * Das Destillat haengt an so eine Notiz die Zeile „[Verweis auf Tafel X —
 * wie: … — warum: …]" (bro-server/src/lib/tafel-wissen.ts). Nur so erfaehrt
 * ein Auftrag ueberhaupt, dass es eine Nachbartafel gibt — die Projekt-Kachel
 * daneben sieht er naemlich nicht.
 *
 * ACHTUNG: GameDesk kennt das Feld nicht. Sein Notiz-Modul gibt beim
 * Speichern nur `{ html, fontSize }` zurueck (js/modules/notes.js,
 * `getState`) — wer diese Kachel im Editor bearbeitet und speichert, loescht
 * den Verweis, ohne dass etwas danach aussieht. Danach hilft nur ein neuer
 * Erzeugerlauf.
 */
const note = (html, fontSize = 13, boardRef = null) =>
  (boardRef ? { html, fontSize, boardRef } : { html, fontSize });
/*
 * Vorschau auf eine Nachbartafel. Baut denselben Zustand, den GameDesks
 * Projekt-Modul beim „Auffrischen" schreibt (js/modules/project.js,
 * `ausTafel`) — sonst stuende die Kachel nach jedem Erzeugerlauf leer da und
 * jemand muesste sie von Hand nachziehen.
 */
function projekt(datei) {
  const pfad = fileURLToPath(new URL('./' + datei, import.meta.url));
  const doc = JSON.parse(readFileSync(pfad, 'utf8'));
  const fenster = Array.isArray(doc.windows) ? doc.windows : [];
  const module = {};
  for (const w of fenster) module[w.type] = (module[w.type] || 0) + 1;
  // Rahmen zuerst, damit die Kacheln in der Vorschau darueber liegen.
  const sortiert = fenster.slice().sort((a, b) => (a.type === 'frame' ? 0 : 1) - (b.type === 'frame' ? 0 : 1));
  return {
    datei,
    name: typeof doc.name === 'string' ? doc.name : datei,
    fenster: fenster.length,
    pfeile: (doc.connections || []).length,
    modelle: (doc.models || []).length,
    module,
    boxen: sortiert.slice(0, 400).map((w) => ({
      x: Math.round(w.x), y: Math.round(w.y),
      w: Math.round(w.w), h: Math.round(w.collapsed ? 34 : w.h), t: w.type
    })),
    geaendert: statSync(pfad).mtimeMs,
    groesse: statSync(pfad).size,
    // Bewusst die Dateizeit statt Date.now(): Sonst erzeugt jeder Lauf einen
    // Unterschied in der eingecheckten Tafel, und man sieht im Diff nicht
    // mehr, ob sich etwas Inhaltliches geaendert hat.
    geholt: statSync(pfad).mtimeMs
  };
}

const code = (path, src, opts = {}) => ({
  path, code: src.replace(/^\n/, '').replace(/\s+$/, ''),
  firstLine: opts.firstLine || 1, size: opts.size || 11,
  wrap: false, marks: opts.marks || [], caption: opts.caption || ''
});

/* =======================================================================
   1  Nutzer & Client
   ===================================================================== */

win('client-app', 'notes', 'Client — React-PWA', -1560, -960, 430, 340, note(`
<h2>packages/client</h2>
<p>React + Vite, als PWA gebaut. <b>Ein</b> Bündel für Web und iOS-App.</p>
<h3>Bildschirme</h3>
<ul><li>Lobby, Spielauswahl, Tisch</li>
<li>WizardTable, FeldherrTisch</li>
<li>Profil, Verein, Aufgaben, Shop, Runner</li></ul>
<p><b>Der Client bildet keine Regel nach.</b> Schaltflächen entstehen aus
<code>legalActions</code>, die Kartenreihenfolge kommt als <code>order</code>
vom Server.</p>`), '#57c98a');

win('client-usetable', 'code', 'useTable.ts — die Leitung hält sich selbst am Leben',
  -1560, -580, 430, 330,
  code('packages/client/src/useTable.ts', `
/**
 * Verbindung zum Tisch.
 *
 * Der Client haelt keinen eigenen Verlauf: Beim Verbinden
 * schickt der Server die vollstaendige Sicht. Nachrichten
 * mit kleinerer Revisionsnummer sind ueberholt und werden
 * verworfen.
 *
 *   1. Bricht die Leitung ab, verbindet der Client von
 *      selbst neu - mit wachsender Wartezeit.
 *   2. Kommt der Tab zurueck, wird sofort abgeglichen.
 *   3. reconnect() macht dasselbe auf Knopfdruck.
 */
const MAX_BACKOFF_MS   = 15_000;
const RESYNC_WATCHDOG_MS = 3_000;
const RESYNC_THROTTLE_MS =   800;`,
    { marks: [15, 16, 17], caption: 'Handybrowser kappen die WebSocket, sobald der Tab in den Hintergrund geht.' }),
  '#8fa4c4');

win('client-decks', 'notes', 'Kartenblätter', -1560, -210, 430, 250, note(`
<h3>Vier Blätter, Wahl am Konto</h3>
<ul><li><code>text</code> — Zeichen (♣D), lädt nichts nach</li>
<li><code>minimal2</code> / <code>minimal4</code> — flache Bildkarten</li>
<li><code>klassisch</code> — gezeichnet</li></ul>
<p><b>Der Server kennt nur die Kennungen.</b> Wie ein Blatt aussieht, weiß
allein der Client. Ein neues Blatt = ein Bildordner + je ein Listeneintrag.</p>
<p>Der ausgeschriebene Kartenname steht im <code>alt</code>-Text — Vorlese­gerät
und fehlendes Bild ergeben dieselbe Ausgabe wie das Textblatt.</p>`), '#57c98a');

/* Wireframe: Skizze des Tischbildschirms */
const S = [];
const sh = (o) => { S.push(Object.assign({ type: 'rect' }, o)); };
sh({ x: 0, y: 0, w: 900, h: 64, fill: '#ffffff', stroke: '#e2e6ee', radius: 0, text: 'Brauweg  ·  Tisch „Feierabend"  ·  Runde 3/8', font: { size: 15, weight: 650, align: 'left' }, pad: 20 });
sh({ x: 760, y: 16, w: 120, h: 32, radius: 8, fill: '#eef1f7', stroke: '#d2d8e2', text: 'Verlassen', font: { size: 12, color: '#5a6479' } });
sh({ type: 'ellipse', x: 250, y: 120, w: 400, h: 300, fill: '#2f6b46', strokeOn: false });
const seats = [[380, 84, 'Nils'], [660, 240, 'Bot 2'], [380, 430, 'Anni'], [100, 240, 'Bot 4']];
for (const [x, y, name] of seats) {
  sh({ x, y, w: 140, h: 46, radius: 10, fill: '#ffffff', stroke: '#d2d8e2', text: name, font: { size: 13, weight: 600 }, shadow: { on: true, x: 0, y: 3, blur: 10, color: '#0f172a26' } });
}
for (let i = 0; i < 3; i++) {
  sh({ x: 360 + i * 66, y: 230, w: 56, h: 80, radius: 6, fill: '#ffffff', stroke: '#b9c2d0', text: ['♣D', '♥10', '♠A'][i], font: { size: 16, weight: 700, color: '#1b2029' } });
}
sh({ type: 'text', x: 250, y: 434, w: 400, h: 22, text: 'Nils spielt aus  ·  noch 0:23', font: { size: 12, color: '#5a6479' }, pad: 0 });
for (let i = 0; i < 8; i++) {
  sh({ x: 120 + i * 78, y: 480, w: 68, h: 96, radius: 7, fill: '#ffffff', stroke: '#b9c2d0', text: ['♣9', '♣K', '♠9', '♠D', '♥A', '♥9', '♦B', '♦A'][i], font: { size: 15, weight: 700 } });
}
sh({ x: 20, y: 500, w: 84, h: 40, radius: 9, fill: '#2f6fe4', strokeOn: false, text: 'Re', font: { size: 14, weight: 650, color: '#ffffff' } });
sh({ x: 796, y: 500, w: 84, h: 40, radius: 9, fill: '#eef1f7', stroke: '#d2d8e2', text: 'Kontra', font: { size: 13, color: '#8a93a5' } });
sh({ type: 'text', x: 20, y: 548, w: 300, h: 20, text: 'Schaltflächen kommen aus legalActions', font: { size: 11, color: '#8a93a5', align: 'left' }, pad: 0 });

win('client-wire', 'wireframe', 'Tisch — Bildschirmskizze', -1060, -960, 700, 500, {
  canvas: { w: 900, h: 600, bg: '#f6f7f9' },
  shapes: S, guides: { v: [], h: [] }, grid: { size: 10, show: false, snap: true }
}, '#6ea8fe');

win('client-sandbox', 'sandbox', 'Sichtbarkeit ausprobieren', -1060, -420, 700, 460, {
  tab: 'js', autorun: true, split: 0.46, showConsole: true,
  html: '<div id="a"></div><div id="b"></div>',
  css: `body{margin:0;font:12px/1.5 system-ui;background:#12151c;color:#e6eaf2;padding:10px}
h4{margin:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9aa4b6}
pre{margin:0 0 12px;padding:8px;border-radius:6px;background:#1b1f28;overflow:auto}
.w{color:#e8b45c}`,
  js: `// Grundsatz 2: Sichtbarkeit entsteht ausschliesslich in viewFor.
// Der Client bekommt nie den vollen Zustand.
const partie = {
  seed: 4711,
  haende: { 0:['♣D','♥10','♠A'], 1:['♠9','♦9','♥K'],
            2:['♥A','♣9','♦B'],  3:['♦A','♠10','♣K'] },
  stich:  ['♣D'],
  punkte: { 0:0, 1:0, 2:0, 3:0 }
};

function viewFor(p, sitz) {
  return {
    hand: p.haende[sitz],
    stich: p.stich,
    punkte: p.punkte,
    andere: Object.keys(p.haende).filter(s => +s !== sitz)
      .map(s => ({ sitz: +s, karten: p.haende[s].length }))
  };
}

a.innerHTML = '<h4>Partiezustand (nur Server)</h4><pre class="w">'
  + JSON.stringify(partie, null, 1) + '</pre>';
b.innerHTML = '<h4>viewFor(partie, 0) — was Sitz 0 sieht</h4><pre>'
  + JSON.stringify(viewFor(partie, 0), null, 1) + '</pre>';

console.log('Fremde Haende in der Sicht:',
  JSON.stringify(viewFor(partie,0)).includes('♠9') ? 'JA (Fehler!)' : 'keine');`
}, '#e8b45c');

frame('f-client', 'Nutzer & Client', 'React-PWA · packages/client', '#57c98a',
  ['client-app', 'client-usetable', 'client-decks', 'client-wire', 'client-sandbox'], 'technik');

/* =======================================================================
   2  Server
   ===================================================================== */

const SX = -180;   // Server-Spalte

win('server-http', 'notes', 'HTTP-API', SX + 320, -960, 440, 330, note(`
<h2>packages/server · http/app.ts</h2>
<p>Fastify, rund 60 Endpunkte. Sitzung als Cookie, in der iOS-App als
<code>Authorization</code>-Kopf.</p>
<ul>
<li><code>/api/auth/*</code> — Registrierung, Bestätigung, Anmeldung</li>
<li><code>/api/me</code>, <code>/api/players</code>, <code>/api/friends</code></li>
<li><code>/api/games</code>, <code>/api/rulesets</code>, <code>/api/tables</code></li>
<li><code>/api/clubs/*</code> — Vereine, Chat, Clan-Krieg</li>
<li><code>/api/shop</code>, <code>/api/chests</code>, <code>/api/quests</code>, <code>/api/runner/*</code></li>
<li><code>/api/rankings</code>, <code>/api/health</code></li>
</ul>`), '#6ea8fe');

win('server-gateway', 'notes', 'WebSocket-Gateway', SX + 800, -960, 440, 330, note(`
<h2>realtime/gateway.ts</h2>
<p>Eine Verbindung je Gerät, Sitzungstoken aus Cookie oder Unterprotokoll
<code>brauweg-token</code>.</p>
<ul>
<li><code>join</code> — prüft Modulversion, schickt die volle Sicht</li>
<li><code>action</code> — reicht an die Laufzeit weiter</li>
<li><code>leave</code>, <code>addBot</code> / <code>removeBot</code></li>
<li><code>emote</code> — feste Liste, nie Freitext</li>
<li><code>takt</code> — Herzschlag für Feldherr, <b>keine</b> Aktion:
kein Partiestand, kein Snapshot, kein Rundruf</li>
</ul>
<p>Nach jeder Änderung: <code>broadcast</code> → je Sitz eine eigene Sicht.</p>`), '#6ea8fe');

win('server-protocol', 'code', 'protocol.ts — jeder Umschlag trägt Spiel und Version',
  SX + 320, -600, 440, 350,
  code('packages/server/src/realtime/protocol.ts', `
/** Version des Rahmenprotokolls. */
export const ENVELOPE_VERSION = 1;
/** Wie viele Versionen zurueck ein Modul bedient wird. */
export const SUPPORTED_MODULE_VERSIONS = 2;

export type ClientMessage =
  | { v: number; game: GameId; type: 'join';
      tableId: string; moduleVersion: number }
  | { v: number; game: GameId; type: 'action';
      tableId: string; action: unknown }
  | { v: number; game: GameId; type: 'leave'; tableId: string }
  | { v: number; game: GameId; type: 'emote';
      tableId: string; emote: string }
  | { v: number; game: GameId; type: 'takt';
      tableId: string; takt: number;
      grenzTakt: number; pruef: string };`,
    { marks: [2, 4], caption: 'Nur additive Änderungen. Die Mindestversion wird beim Beitritt erzwungen, nie mitten in der Partie.' }),
  '#8fa4c4');

win('server-registry', 'code', 'registry.ts — die einzige Stelle, die ein Spiel kennt',
  SX + 800, -600, 440, 350,
  code('packages/server/src/games/registry.ts', `
/**
 * DIESE DATEI IST DIE EINZIGE STELLE IM SERVER,
 * DIE EIN KONKRETES SPIEL KENNT.
 *
 * Alles andere - Lobby, Tische, WebSocket, Ranglisten -
 * arbeitet ausschliesslich gegen GameModule.
 */
const MODULES: readonly AnyGameModule[] = [
  doppelkopf, wizard, cambio, feldherr, skat,
  mememory, easypoker, filler, eiland, tafelrunde,
];

/** Spiele ohne Modul: sichtbar, nicht startbar, abstimmbar. */
const PREVIEW = ['schafkopf','romme','maumau','schwimmen',
  'backgammon','bauernskat','werwolf','phase10','drecksau'];`,
    { marks: [8, 9, 10], caption: 'Ein neues Spiel = eine Zeile in MODULES. Kein weiterer Eingriff in Server oder Client.' }),
  '#8fa4c4');

/* Dieselbe Aussage noch einmal als Notiz — und nicht aus Bequemlichkeit:
   Das Tafel-Destillat liest nur Notizen, die Code-Kachel daneben ist fuer
   einen Auftrag unsichtbar (siehe Kopf dieser Datei). */
win('server-registry-note', 'notes', 'Die Registrierung — der einzige Ort mit Spielnamen',
  SX + 1280, -600, 440, 350, note(`
<h2>packages/server/src/games/registry.ts</h2>
<p><b>Die einzige Stelle im Server, die ein konkretes Spiel kennt.</b> Lobby,
Tische, Gateway, Laufzeit und Ranglisten arbeiten ausschließlich gegen
<code>GameModule</code>.</p>
<p><b>Warum das zählt:</b> Wird irgendwo sonst ein Spielpaket importiert, ist
die Trennung gebrochen — und das nächste Spiel wird teuer, weil es dann nicht
mehr ein Paket ist, sondern ein Eingriff in Server und Client.</p>
<p>Zwei Listen: <code>MODULES</code> (spielbar, zehn Stück) und
<code>PREVIEW</code> (in der Lobby sichtbar, nicht startbar, aber
abstimmbar — der günstigste Marktforschungsmoment, den es gibt).</p>
<p><b>Ein neues Spiel</b> = ein neues Paket + eine Zeile in
<code>MODULES</code> + der Eintrag aus <code>PREVIEW</code> raus.</p>`), '#6ea8fe');

win('server-runtime', 'notes', 'Laufzeit — laufende Partien', SX + 320, -190, 440, 320, note(`
<h2>runtime/party.ts</h2>
<p>Die Partie liegt <b>maßgeblich im Arbeitsspeicher</b>; nach <b>jeder</b>
Aktion geht ein Schnappschuss in die Datenbank. Railway startet Container
jederzeit neu — ohne das wäre jeder Tisch weg.</p>
<ul>
<li><code>start</code> / <code>resume</code> — Partie anlegen oder aus dem
Schnappschuss holen</li>
<li><code>act</code> — <code>module.act()</code>, Snapshot, Rundruf</li>
<li><code>schedule</code> — Zugtimer; läuft er ab, zieht der Bot</li>
<li><code>scheduleInterlude</code> — Schaupause: das Modul nennt nur die
Dauer, die Zeit misst die Plattform</li>
<li><code>markLeft</code> — Aussteiger, die Partie läuft mit Bot weiter</li>
</ul>`), '#6ea8fe');

win('server-economy', 'notes', 'Wirtschaft, Fortschritt, Sozial', SX + 800, -190, 440, 320, note(`
<h3>Plattform, nicht Spiel</h3>
<ul>
<li><b>Trophäen</b> — aus der Platzierung, nie aus Punkten (eigene Kachel
unter „Grundsätze").</li>
<li><b>Münzen und Edelsteine</b> — Edelsteine kaufen alles, Münzen nicht
alles. Der Umtausch ist <b>einseitig</b>; eine Gegenrichtung machte jede
Truhe zur Geldquelle.</li>
<li><b>Preise stehen im Katalog</b> (<code>kosmetik.ts</code>,
<code>tischware.ts</code>), nie in der Datenbank — eine neue Warenart ist
eine Datei, keine Migration.</li>
<li>Truhen, Aufgaben, Stufen, Runner, Vereine samt Krieg und Chat.</li>
</ul>`), '#6ea8fe');

frame('f-server', 'Server', 'Ein Dienst · packages/server', '#6ea8fe',
  ['server-http', 'server-gateway', 'server-protocol', 'server-registry', 'server-registry-note',
   'server-runtime', 'server-economy'], 'technik');

/* =======================================================================
   3  Spielmodule
   ===================================================================== */

/* Rechte Spalte. Sie ist am 05.09.2026 von 1560 nach rechts gerueckt, weil
   der Server eine dritte Kachelspalte bekommen hat — Rahmen duerfen sich
   nicht ueberlappen, sonst zaehlt das Tafel-Destillat eine Kachel dem
   falschen Bereich zu (es ordnet nach Koordinaten, nicht nach Zugehoerigkeit). */
const GX = 2100;

win('api-module', 'code', 'GameModule — die ganze Schnittstelle', GX, -960, 520, 620,
  code('packages/game-api/src/index.ts', `
/**
 * Server, Lobby und Client kennen NUR diese Schnittstelle.
 * Sie wissen nicht, dass es Doppelkopf gibt.
 */
export interface GameModule<TParty, TAction, TView, TConfig> {
  readonly meta: GameMeta;
  readonly protocolVersion: number;

  // Regelsatz
  defaultConfig(): TConfig;
  validateConfig(config: unknown, seats: number,
                 rounds: number): ConfigProblem[];

  // Ablauf
  createParty(options: CreatePartyOptions<TConfig>): TParty;
  act(party: TParty, seat: number, action: TAction): TParty;
  currentActor(party: TParty): number | null;
  legalActions(party: TParty, seat: number): TAction[];
  isFinished(party: TParty): boolean;
  interludeMs?(party: TParty): number | null;
  advanceInterlude?(party: TParty): TParty;
  standings(party: TParty): PartyStanding[];
  markLeft(party: TParty, seat: number): TParty;

  // Sichtbarkeit
  viewFor(party: TParty, seat: number): TView;
  spectatorView(party: TParty): TView;

  // Bot - bekommt NUR die gefilterte Sicht
  botAction(view: TView): TAction;

  // Persistenz
  serialize(party: TParty): unknown;
  deserialize(raw: unknown): TParty;
  completedSegments?(party: TParty): readonly unknown[];
  xpBasis?(party: TParty): Readonly<Record<number, number>>;
}`,
    { marks: [26, 27, 30], size: 10.5, caption: 'viewFor und spectatorView sind die einzigen Wege nach draußen — der Bot sieht dasselbe wie ein Mensch.' }),
  '#b78cf7');

/* Der Vertrag als Notiz. Die Code-Kachel links daneben zeigt dieselbe
   Schnittstelle im Original — aber nur diese hier steht spaeter im
   Tafel-Destillat eines Auftrags. */
win('api-vertrag', 'notes', 'Der Vertrag — was jedes Modul zusagt', GX + 570, -960, 460, 620, note(`
<h2>packages/game-api</h2>
<p><b>Die einzige Schnittstelle zwischen Plattform und Spiel.</b> Server,
Lobby und Client wissen nicht, dass es Doppelkopf gibt.</p>
<h3>Pflicht</h3>
<ul>
<li><code>meta</code>, <code>protocolVersion</code> — steigt, sobald sich
Aktion oder Sicht ändern; der Server weist zu alte Clients beim
<i>Beitritt</i> ab, nicht mitten in der Partie</li>
<li><code>defaultConfig</code>, <code>validateConfig</code> — nimmt bewusst
<code>unknown</code>: Der Regelsatz kommt als JSON von außen, ihn schon als
gültig zu typisieren hieße anzunehmen, was die Methode feststellen soll</li>
<li><code>createParty</code>, <code>act</code>, <code>currentActor</code>,
<code>legalActions</code>, <code>isFinished</code>, <code>standings</code>,
<code>markLeft</code></li>
<li><code>viewFor</code>, <code>spectatorView</code> — die einzigen Wege
nach draußen</li>
<li><code>botAction(view)</code> — nur die gefilterte Sicht</li>
<li><code>serialize</code> / <code>deserialize</code></li>
</ul>
<h3>Freiwillig</h3>
<ul>
<li><code>interludeMs</code> / <code>advanceInterlude</code> — Schaupause.
Das Modul nennt <b>nur die Dauer</b>, die Zeit misst die Plattform</li>
<li><code>viewCursor</code> — anwachsende Sicht, nur Feldherr</li>
<li><code>completedSegments</code> — Zwischenabrechnungen; die Plattform
speichert sie unverändert und wertet sie <b>nicht</b> aus</li>
<li><code>xpBasis</code> — gelegte Karten je Sitz. Fehlt sie, gibt es keine
Punkte: lieber gar keine als geratene</li>
</ul>
<h3>Drei Schalter in der Meta</h3>
<p><code>xpBasisZaehltKarten</code> (Feldherr: nein — sonst füllt jedes
Gefecht die Kartenaufgabe des Tages) ·
<code>legalActionsUnvollstaendig</code> (nur Tafelrunde) ·
<code>chipStackField</code> (nur Easy Poker: die Plattform zieht den
Startstapel in BroJetons ein und zahlt den Rest zurück — das Modul rechnet
weiter mit blanken Zahlen)</p>`), '#b78cf7');

win('api-invarianten', 'notes', 'Wer den Vertrag durchsetzt', GX + 570, -290, 460, 250, note(`
<h3>packages/server/test/plattform-invarianten.test.ts</h3>
<p>Läuft über <code>registry.all()</code> und spielt je Modul vollständige
Bot-Partien durch. <b>Ein neues Modul wird automatisch mitgeprüft</b>, ohne
dass jemand dort eine Zeile ergänzt.</p>
<p>Geprüft wird, worauf sich Lobby, Laufzeit und Client verlassen, ohne das
Spiel zu kennen: dass der Bot immer handeln kann, dass <code>act</code>
jeden unerlaubten Zug abweist, dass die Platzfolge in sich stimmt und dass
die Zuschauersicht nichts Persönliches trägt.</p>
<p>Entstanden aus einer Nachtdurchsicht am 01.09.2026 — 215.000 simulierte
Züge fanden keinen Regelfehler. <b>Genau deshalb</b> steht die Prüfung
dauerhaft im Repo: damit das nächste Spiel sie beim ersten Lauf spürt und
nicht im Betrieb.</p>`), '#b78cf7');

win('game-liste', 'notes', 'Zehn Module, eine Schnittstelle', GX + 1080, -960, 420, 290, note(`
<p>Stand 05.09.2026 — alle zehn spielbar:</p>
<ul>
<li><b>Doppelkopf</b> 4–5 · <b>Zauberer</b> 3–6 · <b>Skat</b> 3</li>
<li><b>Cambio</b> 2–6 · <b>Easy Poker</b> 2–6 · <b>Mememory</b> 2–4</li>
<li><b>Filler</b> 2 · <b>Eiland</b> 2 · <b>Feldherr</b> 2</li>
<li><b>Tafelrunde</b> 2–8</li>
</ul>
<p>Dazu neun Vorschau-Spiele: in der Lobby sichtbar, nicht startbar,
abstimmbar.</p>
<p><b>Fünf der zehn sind keine Kartenspiele</b> (Feldherr, Mememory, Filler,
Eiland, Tafelrunde) — die Schnittstelle trägt sie trotzdem.</p>`), '#b78cf7');

win('game-doko', 'notes', 'Doppelkopf', GX + 1080, -640, 420, 300, note(`
<h3>packages/game-doppelkopf</h3>
<p>Die größte Engine im Haus: <code>round.ts</code> allein 43 kB.</p>
<ul><li><code>ruleset.ts</code>, <code>validator.ts</code> — Regelsatz</li>
<li><code>deal.ts</code>, <code>order.ts</code>, <code>trick.ts</code></li>
<li>Vorbehalte, Hochzeit, <b>Armut</b>, Pflichtsolo, Schmeiß, Bock</li>
<li><code>scoring.ts</code>, <code>trophies.ts</code>, <code>bot.ts</code></li></ul>
<p>4 oder 5 Sitze. Die Engine kann auch 3 (Validator und Tests), aber die
Lobby bietet es nicht mehr an: Ein Dreiertisch war ohnehin ein Vierertisch
mit Dauerbot, und genau das verwirrte.</p>
<p>Wertet die <b>Bot-Stufe</b> in
<code>botAction</code> aus — wie Easy Poker; Mememory zieht sie schon beim
Aufbau der Partie heran, weil sein Bot ein Gedächtnis hat. Die übrigen
sieben Module ignorieren sie.</p>
<p>Bei der <b>Armut</b> ist <code>legalActions</code> leer, obwohl jemand am
Zug ist — siehe Befund.</p>`), '#b78cf7');

win('game-wizard', 'notes', 'Zauberer', GX + 1080, -310, 420, 270, note(`
<h3>packages/game-wizard</h3>
<p>Stichansage-Spiel, 3 bis 6 Sitze.</p>
<p>Die xp-Basis ist hier die <b>Summe der Rundennummern</b>, beim Doppelkopf
Blattgröße mal Runden — <b>nur das Modul weiß das.</b> Genau dafür gibt es
<code>xpBasis</code> statt einer Formel in der Plattform.</p>
<p>„Wizard" ist ein eingetragenes Markenzeichen (AMIGO); im Produkt heißt
das Spiel <b>Zauberer</b>. Dieselbe Lage wie bei Cambio/Cabo und
Stufenrommé/Phase 10.</p>`), '#b78cf7');

win('game-skat', 'notes', 'Skat', GX + 1550, -610, 420, 270, note(`
<h3>packages/game-skat</h3>
<p>Drei Sitze, fest. Reizen, Skatwahl, Drücken, Ansage, Stich.</p>
<p><b>Reizen, Skatwahl und Stich</b> liefert die Engine als fertige Aktionen.
<b>Drücken und Ansage</b> baut der Client aus der Sicht; dort ist
<code>legalActions</code> leer, obwohl jemand am Zug ist — genau wie bei der
Armut im Doppelkopf. Siehe Befunde.</p>`), '#b78cf7');

win('game-cambio', 'notes', 'Cambio — wenig ist gut', GX + 1550, -310, 420, 270, note(`
<h3>packages/game-cambio</h3>
<p>Ablegespiel mit vier verdeckten Karten, 2 bis 6 Sitze. Werte
<b>minimieren</b>.</p>
<p><b>Der Endstand ist aufsteigend sortiert</b> — die niedrigste Punktzahl
gewinnt. Der einzige Punkt, an dem Cambio von allen anderen Spielen abweicht;
deshalb hängen die Trophäen am <b>Platz</b>, nie an den Punkten.</p>
<p>„Cabo" ist ein Markenzeichen (AMIGO); Cambio ist der markenfreie Name
der Spielfamilie.</p>`), '#b78cf7');

win('game-eiland', 'notes', 'Eiland — beide ziehen gleichzeitig', GX + 2020, -960, 420, 300, note(`
<h3>packages/game-eiland</h3>
<p>Landnahme zu zweit auf 10×10 aus Gras, Seen und Bergen.</p>
<p><b>Beide wählen gleichzeitig.</b> Wollen beide dasselbe Feld, entscheidet
ein Münzwurf. Eine Aktion ist eine <b>Menge</b> von Feldern, deshalb ist
<code>legalActions</code> leer; wer ziehen darf, entscheidet allein
<code>amZug</code> in <code>partie.ts</code>.</p>
<p><code>currentActor</code> nennt trotzdem einen Sitz — siehe Befunde.</p>`), '#b78cf7');

win('game-tafelrunde', 'notes', 'Tafelrunde — Auto-Battler', GX + 2020, -630, 420, 320, note(`
<h3>packages/game-tafelrunde</h3>
<p>2 bis 8 Sitze, seit 04.09.2026. <b>Ohne Blatt</b>: Jeder
kauft zwischen den Runden aus einem eigenen Laden ein Heer, drei gleiche
Einheiten verschmelzen zur nächsten Stufe, danach kämpfen die Bretter
automatisch.</p>
<p>Wie Eiland: <b>alle rüsten gleichzeitig</b>, <code>currentActor</code>
nennt trotzdem einen Sitz.</p>
<p>Eigener Dreh: <code>legalActions</code> ist hier weder leer noch
vollständig — das Verschieben fehlt darin, und die Meta sagt es
(<code>legalActionsUnvollstaendig: true</code>). Siehe Befunde.</p>`), '#b78cf7');

win('game-klein', 'notes', 'Mememory · Filler · Easy Poker', GX + 2020, -280, 420, 240, note(`
<p><b>Mememory</b> (2–4) — Memory-Duell auf 5×8 Meme-Bildern. Nutzt die
Schnittstelle vollständig, sogar die Schaupause (das Zurückdrehen zweier
ungleicher Karten). Sein Bot hat ein <b>Gedächtnis</b> — deshalb nennt
<code>createParty</code> die Bot-Sitze: später gibt es keine Stelle mehr,
an der Zustand entsteht.</p>
<p><b>Filler</b> (2) — Flächenduell auf 8×7. Die ganze Abwandlung steckt in
<code>viewFor</code>: sichtbar ist nur das eigene Gebiet und dessen Rand.</p>
<p><b>Easy Poker</b> (2–6) — Texas Hold'em auf vier Schaltflächen. Einziges
Modul mit <code>chipStackField</code>.</p>`), '#b78cf7');

win('game-feldherr', 'notes', 'Feldherr — Echtzeit im Gleichschritt', GX + 1550, -960, 420, 320, note(`
<h3>packages/game-feldherr</h3>
<p>Kein Kartenspiel, aber dieselbe Schnittstelle — <b>ohne</b> Zugfolge und
Runden. Beide Geräte rechnen gleichzeitig aus demselben Saatkorn und
derselben Aktionsliste weiter.</p>
<p><code>currentActor</code> ist <b>immer null</b> und
<code>legalActions</code> <b>immer leer</b>: In Echtzeit ist niemand am Zug.
Ein Tisch ohne Aktion ist hier der Normalfall, kein hängender Spieler — die
Laufzeit darf daraus keinen Zugtimer ableiten.</p>
<p>Über die Leitung gehen <b>nur Handlungen, nie Zustände</b>: eine Partie
kommt mit einigen Dutzend Aktionen aus statt mit zwanzig Zuständen je
Sekunde. Die Sicht wächst dabei mit — deshalb als einziges Modul
<code>viewCursor</code>: 800 Züge wären sonst 40 MB über die Leitung statt
0,1 MB.</p>
<p>Der Kern zieht seinen Zufall ausschließlich aus <code>saat()</code>
(mulberry32). Wer daran etwas ändert, bricht jedes Netzspiel — sichtbar
erst daran, dass beide einen anderen Sieger sehen.</p>
<p><code>kern.js</code> und <code>feldherr.html</code> sind <b>gebaut, nicht
geschrieben</b> (Quelle: <code>quelle/teile/</code>).</p>`, 13, {
  board: 'Feldherr — Funktionsweise',
  wie: 'eigene Tafel im selben Ordner (feldherr-funktionsweise.gamedesk.json)',
  warum: 'Das Echtzeitspiel hat eine eigene Mechanik-Ebene — Takt, Vorlauf, Prüfsumme, Diagnose. Sie hier unterzubringen hieße, die Plattformtafel um ein einzelnes Spiel herum zu bauen.'
}), '#b78cf7');

win('projekt-feldherr', 'project', 'Feldherr — Funktionsweise', GX + 2490, -960, 400, 340,
  projekt('feldherr-funktionsweise.gamedesk.json'), '#e8b45c');

win('game-adapter', 'code', 'adapter.ts — die einzige Brücke je Spiel',
  GX, -290, 520, 250,
  code('packages/game-doppelkopf/src/adapter.ts', `
/**
 * Diese Datei ist die EINZIGE Stelle, an der Plattform und
 * Doppelkopf-Engine einander kennen. Die Engine bleibt
 * unveraendert; sie weiss nichts von Tischen, Konten oder
 * Trophaeen.
 *
 *   1. Die Engine liefert die Sicht auf RUNDEN-Ebene. Die
 *      Plattform braucht sie samt Partiestand -> DokoView.
 *   2. Eine Zuschauersicht gibt es in der Engine nicht. Sie
 *      entsteht hier, indem Hand und alles daraus
 *      Abgeleitete weggelassen werden.
 */`, { caption: 'Die Spiel-Engine kennt die Plattform nicht — und umgekehrt.' }),
  '#8fa4c4');

frame('f-games', 'Spielmodule', 'Reine Logik · kein Netz, keine Uhr, kein Zufall außer dem Seed', '#b78cf7',
  ['api-module', 'api-vertrag', 'api-invarianten', 'game-adapter', 'game-liste',
   'game-doko', 'game-wizard', 'game-feldherr', 'game-skat', 'game-cambio',
   'game-eiland', 'game-tafelrunde', 'game-klein', 'projekt-feldherr'], 'game');

/* =======================================================================
   4  Grundsätze
   ===================================================================== */

win('rules-core', 'notes', 'Grundsätze, die nicht aufgeweicht werden', -1560, 260, 460, 430, note(`
<ol>
<li>Ein Spielmodul ist eine <b>reine Logikbibliothek</b> — kein Netzwerk,
keine Datenbank, keine Uhr, kein Zufall außer dem Seed. Gleicher Zustand
plus gleiche Aktion ergibt immer dasselbe Ergebnis.</li>
<li>Sichtbarkeit entsteht <b>ausschließlich in <code>viewFor</code></b>.
Der Client bekommt nie den vollen Zustand und blendet nichts selbst aus.</li>
<li>Trophäen sind <b>nicht</b> Teil eines Spielmoduls. Module liefern
Platzierungen, die Plattform rechnet die Wertung.</li>
<li>Regelsatz und Währung bleiben getrennt.</li>
<li>Jede WebSocket-Nachricht trägt Spielkennung und Protokollversion,
jeder Zustand eine Revisionsnummer.</li>
<li>Der Client baut seine Schaltflächen aus <code>legalActions</code> und
<code>viewFor</code> und bildet keine Regeln nach.</li>
</ol>`), '#ef6b6b');

win('rules-spectator', 'notes', 'Warum Zuschauer keine Hand sehen', -1050, 260, 420, 200, note(`
<p><code>spectatorView</code> ist bewusst von <code>viewFor</code> getrennt:</p>
<p>Bei verdeckter Partnerschaft wäre ein Zuschauer mit Handeinsicht ein
perfekter Komplize. Er müsste einem Spieler nur mitteilen, wer die zweite
Kreuz-Dame hält.</p>`), '#ef6b6b');

win('rules-bot', 'notes', 'Warum der Bot nicht schummeln kann', -1050, 490, 420, 200, note(`
<p><code>botAction(view)</code> nimmt <b>ausschließlich die gefilterte
Sicht</b> entgegen, nie den Partiezustand.</p>
<p>Damit ist Chancengleichheit keine Frage der Disziplin beim Programmieren,
sondern eine Frage der Signatur.</p>`), '#ef6b6b');

win('rules-trophies', 'notes', 'Trophäen hängen am Platz, nie an den Punkten', -580, 260, 440, 430, note(`
<h3>packages/server/src/trophies.ts</h3>
<p>Ein Modul liefert <code>standings</code> mit <code>points</code> und
<code>place</code>. Die Plattform rechnet <b>ausschließlich mit
<code>place</code></b>.</p>
<h4>Warum nicht mit Punkten</h4>
<ul>
<li>Punktzahlen sind spielabhängig und maßstabslos: Beim Doppelkopf gewinnt
die höchste, bei <b>Cambio die niedrigste</b>. Eine Wertung über Punkte
müsste jedes Spiel kennen — dann trüge keine Rangliste mehr über alle.</li>
<li>Ein Tisch mit hohen Multiplikatoren würde zur Trophäenfarm. Man suchte
den varianzreichsten Regelsatz statt der besten Gegner.</li>
</ul>
<h4>Die Verteilung</h4>
<p>Fester Abstand 6 zwischen zwei Plätzen, 2 bis 6 Sitze
(<code>2: [3, -3]</code> … <code>6: [15, 9, 3, -3, -9, -15]</code>). Bei
Gleichstand teilen sich die Beteiligten den Mittelwert — die Werte sind so
gewählt, dass das <b>ganzzahlig</b> bleibt.</p>
<p>Die Grundverteilung ist eine Nullsumme. Verlassen-Strafe (−10) und
Checkpoints durchbrechen sie bewusst: Der höchste erreichte Stand ist die
Untergrenze für künftige Verluste. Die Inflation ist in Kauf genommen, weil
ein Absturz unter eine erreichte Marke Spieler verlässlich vertreibt.</p>`), '#ef6b6b');

frame('f-rules', 'Grundsätze', 'Was die Trennung trägt', '#ef6b6b',
  ['rules-core', 'rules-spectator', 'rules-bot', 'rules-trophies'], 'gamedesign');

/* =======================================================================
   5  Daten
   ===================================================================== */

win('db-schema', 'notes', 'PostgreSQL — 36 Tabellen', SX + 320, 260, 440, 430, note(`
<h3>db/schema.ts (Drizzle)</h3>
<p><b>Konto:</b> account, session, auth_token, account_game_stat,
account_game_theme, account_cosmetic, account_avatar</p>
<p><b>Tisch und Partie:</b> game_table, table_seat, party, party_snapshot,
round_summary, rule_set, trophy_ledger, pairing_log, chip_lock</p>
<p><b>Verein:</b> club, club_member, club_join_request, club_message,
club_war, club_war_score</p>
<p><b>Fortschritt:</b> chest_claim, quest_progress, runner_day, runner_best,
stat_counter, purchase</p>
<p><b>Sozial:</b> friendship, block, report, game_vote, invite_code</p>
<p><b>Spielnah, aber kein Regelwissen</b> — Inhalt und Mitschnitte, kein
Spielzustand: mememory_motiv, mememory_sammlung, feldherr_diagnose (die
Zeilen verfallen nach zwei Wochen)</p>
<p>Ohne installierte Datenbank: <code>DATABASE_URL=pglite</code> startet
PostgreSQL als WebAssembly im selben Prozess. In Produktion gesperrt.</p>`), '#4fd1c5');

win('db-snapshot', 'notes', 'Der Schnappschuss', SX + 800, 260, 440, 210, note(`
<p><code>module.serialize(party)</code> nach <b>jeder</b> Aktion in
<code>party_snapshot</code>.</p>
<p>Dass alle Mitspieler dasselbe sehen, folgt <b>nicht</b> aus der
Speicherung, sondern aus dem Rundruf: eine Sicht je Sitz, jede mit
Revisionsnummer.</p>`), '#4fd1c5');

win('db-migrations', 'notes', 'Migrationen von Hand', SX + 800, 500, 440, 190, note(`
<p><code>drizzle-kit generate</code> ist hier unbrauchbar — die Snapshots
unter <code>drizzle/meta/</code> sind veraltet.</p>
<p>Selbst schreiben, <code>_journal.json</code> selbst ergänzen, und
<b>vorher prüfen, welche Nummer auf <code>origin/staging</code> schon
vergeben ist</b>. Zwei Sitzungen hatten schon dieselbe 0012.</p>`), '#4fd1c5');

frame('f-data', 'Daten', 'PostgreSQL · Drizzle · pglite für lokal', '#4fd1c5',
  ['db-schema', 'db-snapshot', 'db-migrations'], 'daten');

/* =======================================================================
   6  Betrieb
   ===================================================================== */

win('ops-deploy', 'notes', 'Ein Dienst, eine Domain', GX, 260, 460, 300, note(`
<p>In Produktion liefert der <b>Server den gebauten Client selbst aus</b>.
Damit gibt es genau einen Ursprung: Das Sitzungs-Cookie gilt ohne Sonderfall
auch für den WebSocket, es braucht kein CORS und keine zweite Domain.</p>
<p>In der Entwicklung übernimmt Vite diese Rolle und reicht <code>/api</code>
und <code>/ws</code> weiter.</p>
<p>Railway: <code>npm install --include=dev &amp;&amp; npm run build</code>,
Start <code>node packages/server/dist/src/index.js</code>, Health-Check auf
<code>/api/health</code>.</p>`), '#e8b45c');

win('ops-ios', 'notes', 'iOS-App — die eine Ausnahme', GX, 600, 460, 250, note(`
<p>Eigenes Repository <code>Brauweg-spiel-ios</code>: eine Hülle um einen
<code>WKWebView</code>, die <b>genau diesen Client</b> aus dem App-Paket
ausliefert. Keine zweite Oberfläche.</p>
<p>Damit ist sie eine zweite Herkunft (<code>brauweg://app</code>). Cookies
gehen dorthin nicht — sie trägt ihr Sitzungstoken selbst: per
<code>Authorization</code>-Kopf und am WebSocket als Unterprotokoll.</p>`), '#e8b45c');

win('ops-pitfalls', 'notes', 'Fallen, die Zeit gekostet haben', GX + 510, 260, 460, 590, note(`
<ul>
<li><b>Watch Paths müssen leer bleiben.</b> Railway setzt beim Import
<code>/packages/server/**</code>. Damit werden Client-Änderungen still
übersprungen und <b>nie ausgeliefert</b> — ohne Fehlermeldung.</li>
<li><b>Build im Wurzelverzeichnis</b>, nie <code>--workspace</code>: sonst
ist die <code>.d.ts</code> von <code>game-api</code> alt und
<code>tsc</code> meldet Felder als fehlend, die längst da sind.</li>
<li><b>Supabase:</b> Session Pooler (5432), nicht Transaction Pooler (6543)
— der kann keine Prepared Statements.</li>
<li><b>Zonen-Apex:</b> ein CNAME ist dort nicht erlaubt, Strato bietet kein
ALIAS — deshalb <code>www</code> als Ziel und 301 davor.</li>
</ul>
<p style="color:#8a93a5">Die Fallen im Code selbst — React-Effekte an einen
Schlüssel statt an ein Objekt hängen, am Tisch nichts stumm verwerfen, vor
jedem Commit <code>git diff --cached --stat</code> lesen — stehen in
<code>CLAUDE.md</code> und bewusst nicht doppelt hier: Zwei Fassungen
derselben Warnung laufen auseinander, und dann glaubt man der falschen.</p>`), '#e8b45c');

frame('f-ops', 'Betrieb & Auslieferung', 'www.brauweg-spielen.de · Railway', '#e8b45c',
  ['ops-deploy', 'ops-ios', 'ops-pitfalls'], 'betrieb');

/* =======================================================================
   7  Ablauf einer Aktion
   ===================================================================== */

const FY = 1120;
const steps = [
  ['flow-1', 'Karte antippen', 'Der Client zeigt nur, was <code>legalActions</code> hergibt. Ein Klick erzeugt keine Regel, sondern eine <b>Aktion</b>.'],
  ['flow-2', 'action über die Leitung', '<code>{ v, game, type:"action", tableId, action }</code><br>Beim Beitritt wurde die Modulversion geprüft; jetzt nicht mehr.'],
  ['flow-3', 'Gateway prüft', 'Sitzung → Konto, Konto → Sitz. Kein Sitz, keine Aktion. Weiter an die Laufzeit.'],
  ['flow-4', 'module.act(...)', 'Die <b>einzige</b> Stelle, die Zustand ändert. Sie prüft die Regel erneut, auch wenn der Client schon geprüft hat, und wirft bei Verstoß.'],
  ['flow-5', 'Schnappschuss', '<code>serialize()</code> → <code>party_snapshot</code>. Danach überlebt der Tisch einen Neustart des Containers.'],
  ['flow-6', 'viewFor je Sitz', 'Ein Rundruf, aber <b>vier verschiedene Nachrichten</b>: jeder bekommt nur seine Sicht, dazu <code>legalActions</code> und eine neue Revision.'],
  ['flow-7', 'Client zeichnet neu', 'Kleinere Revision als die zuletzt gesehene? Verworfen. Ist ein Bot am Zug, läuft derselbe Weg vom Zugtimer aus.']
];
steps.forEach(([k, title, html], i) => {
  win(k, 'notes', (i + 1) + '. ' + title, -1560 + i * 470, FY, 400, 230, note('<p>' + html + '</p>', 12.5), '#9aa4b6');
});
frame('f-flow', 'Ablauf einer Aktion', 'Vom Antippen bis zum neuen Bild — der Weg, den jede Regel nimmt', '#9aa4b6',
  steps.map((s) => s[0]), 'mechanik');

/* =======================================================================
   8  Bekannte Widersprüche

   Kacheln mit ⚠ im Titel. Der Titel ist die Kennung, unter der ein Worker
   sie im TAFEL-Block als behoben meldet — er muss deshalb eindeutig sein
   und darf sich nicht beiläufig ändern.
   ===================================================================== */

const WY = 1900;
const befunde = [
  ['warn-legal-leer', '⚠ legalActions ist leer, obwohl jemand am Zug ist', `
<p><b>Wo:</b> Skat (Drücken, Ansage), Doppelkopf (Armut), Eiland.</p>
<p><b>Warum:</b> Die Aktion ist dort eine <b>Menge</b> von Karten oder
Feldern. Sie aufzuzählen hieße, alle Kombinationen aufzuzählen — bei Eiland
alle Teilmengen von bis zu sechs freien Feldern.</p>
<p><b>Folge:</b> Der Client baut diese Aktion selbst aus der Sicht — die
dokumentierte Ausnahme vom Grundsatz „der Client bildet keine Regel nach".
Wer den Tisch umbaut und sich allein auf <code>legalActions</code> verlässt,
macht genau diese Züge unspielbar und merkt es nicht: Eine leere Liste sieht
aus wie „nichts erlaubt".</p>
<p><b>Was trotzdem trägt:</b> <code>act</code> weist jeden unerlaubten Zug
ab, und die Invariantenprüfung verlangt, dass der Bot hier handeln kann —
sonst hängt der Tisch, sobald ein Mensch aussteigt.</p>`],

  ['warn-legal-halb', '⚠ legalActions kann auch nur halb gefüllt sein', `
<p><b>Wo:</b> Tafelrunde, und nur dort.</p>
<p>Kaufen, Würfeln, Aufsteigen und Verkaufen stehen in der Liste, das
<b>Verschieben</b> nicht: Es wäre ein Paar aus 19 Plätzen, bis zu 342
Einträge in jeder Sicht, die über die Leitung geht.</p>
<p><b>Warum das gefährlicher ist als Fall 1:</b> Eine leere Liste sagt schon
selbst, dass sie nichts aufzählt. Eine halbe Liste sieht aus wie eine ganze.
Deshalb sagt das Modul es in seiner Meta:
<code>legalActionsUnvollstaendig: true</code>.</p>
<p>Wer das Feld setzt, nimmt sich damit eine Prüfung weg
(<code>plattform-invarianten.test.ts</code>) und muss dafür sicherstellen,
dass <code>act</code> jeden unerlaubten Zug abweist.</p>`],

  ['warn-currentactor', '⚠ currentActor nennt einen Sitz, obwohl alle gleichzeitig ziehen', `
<p><b>Wo:</b> Eiland und Tafelrunde.</p>
<p>Beide Spiele haben <b>keine Zugfolge</b> — alle handeln gleichzeitig.
<code>currentActor</code> nennt trotzdem einen Sitz (den kleinsten, der noch
nicht abgegeben hat).</p>
<p><b>Warum die Notlüge:</b> Ohne einen genannten Sitz bekäme der Tisch von
der Plattform keinen einzigen Timer — Zugzeit, Bot-Übernahme nach Ablauf und
die Verlassen-Regel hängen alle daran.</p>
<p><b>Warum es gutgeht:</b> Der Server prüft <code>currentActor</code> beim
Handeln gar nicht. Er prüft nur, dass jemand für den <i>eigenen</i> Sitz
zieht; wer dran ist, entscheidet allein das Modul.</p>
<p><b>Gegenprobe:</b> Feldherr liefert null und bekommt deshalb keinen
Zugtimer — dort hält der <code>takt</code>-Herzschlag den Tisch am Leben.</p>`],

  ['warn-feldherr-ausgang', '⚠ Feldherr: der Server glaubt dem gemeldeten Ausgang', `
<p>Feldherr rechnet auf beiden Geräten; über die Leitung gehen nur
Handlungen. <b>Der Server kennt den Spielstand nicht mit</b> — der Preis von
Weg B (<code>docs/FELDHERR-PLAN.md</code>).</p>
<p><b>Absicherung:</b> Beide Geräte melden den Ausgang getrennt. Weichen sie
ab, gilt die Partie als strittig, <code>standings</code> meldet Gleichstand,
und daraus werden null Trophäen.</p>
<p><b>Seit dem 04.09.2026 gibt es hier Trophäen wie überall.</b> Die
Doppelmeldung ist die einzige Absicherung, die dahintersteht. Wer beide
Geräte in der Hand hat, kann melden, was er will.</p>
<p>Vor der Behebung prüfen, ob die Trophäen-Entscheidung noch gilt — sie ist
bewusst so getroffen worden, nicht übersehen.</p>`],

  ['warn-punkte-platz', '⚠ Punkte sagen nichts über den Platz', `
<p>Beim Doppelkopf gewinnt die <b>höchste</b> Punktzahl, bei <b>Cambio die
niedrigste</b>. <code>standings</code> liefert beides —
<code>points</code> und <code>place</code> — und nur
<code>place</code> ist über alle Spiele hinweg vergleichbar.</p>
<p><b>Der Fehler, der hier gebaut wird:</b> aus <code>points</code> eine
Rangfolge ableiten. Das dreht Cambio um, und zwar lautlos — die Zahlen sehen
plausibel aus, nur der falsche gewinnt. Trophäen und Invariantenprüfung
rechnen deshalb ausschließlich mit <code>place</code>.</p>`],

  ['warn-karten-ids', '⚠ Karten-IDs werden je Runde neu vergeben', `
<p><code>createDeck()</code> läuft bei <b>jedem Geben</b> und zählt die
Kennungen von 0 hoch. Karte 12 aus Runde 1 ist nicht dieselbe Karte wie
Karte 12 aus Runde 2.</p>
<p><b>Wozu es sie gibt:</b> Im Doppelkopf kommt jede Karte doppelt vor — die
laufende Nummer unterscheidet die Exemplare (erste/zweite Dulle).</p>
<p><b>Folge:</b> Eine Karten-ID ist nur innerhalb der laufenden Runde
gültig. Wer sie über den Rundenwechsel hinweg als Schlüssel benutzt — als
React-<code>key</code>, in einer Animation, in einer Statistik —, bekommt
keine Fehlermeldung, sondern still verwechselte Karten.</p>`],

  ['warn-client-ungeprueft', '⚠ Der Client baut die Sichten nach, fast ohne Test', `
<p><code>packages/client</code> hat rund <b>44.500 Zeilen</b> und
<b>sieben</b> Testdateien (Eiland, Tafelrunde, Druckabbruch, Tischauswahl).
Am 01.09.2026 waren es 36.368 Zeilen und <b>null</b> Tests — der Befund ist
kleiner geworden, nicht erledigt.</p>
<p><b>Warum das hier steht:</b> Der Client bildet zwar keine Regeln nach,
aber sehr wohl die Darstellung jeder Sicht. Eine gebrochene Annahme über
<code>viewFor</code> zeigt sich deshalb erst im Browser — und dort erst,
wenn jemand genau diesen Bildschirm öffnet.</p>`],

  ['warn-feldherr-artefakte', '⚠ Feldherrs kern.js und feldherr.html sind gebaut, nicht geschrieben', `
<p>Quelle ist <code>packages/game-feldherr/quelle/teile/</code>, gebaut wird
mit <code>node packages/game-feldherr/werkzeug/bauen.mjs</code>.</p>
<p><b>Die Falle:</b> Beide Artefakte sehen wie gewöhnlicher Quelltext aus.
Der nächste Bau überschreibt jede Änderung kommentarlos — und wer sie liest,
liest einen Stand, der niemandes Absicht ist.</p>
<p>Gleiches Muster: die Drizzle-Snapshots unter <code>drizzle/meta/</code>
und diese Tafel selbst (Erzeuger unter
<code>werkzeug/gamedesk/boards/</code>).</p>`]
];
befunde.forEach(([k, title, html], i) => {
  win(k, 'notes', title, -1560 + (i % 4) * 500, WY + Math.floor(i / 4) * 360,
    460, 320, note(html, 12.5), '#ef6b6b');
});
frame('f-warn', 'Bekannte Widersprüche',
  'Absicht, nicht Versehen — aber jedes Mal teuer, wenn es jemand nicht weiß', '#ef6b6b',
  befunde.map((b) => b[0]), 'mechanik');

/* =======================================================================
   Überschrift
   ===================================================================== */

win('titel', 'notes', 'Brauweg', -1560, -1420, 900, 300, note(`
<h1>Brauweg — Funktionsweise</h1>
<p><b>Kartenspiel-Plattform mit frei konfigurierbaren Regelsätzen.</b> Mehrere
klassische Spiele unter einem Dach, eigene Rangliste je Spiel plus
spielübergreifende Gesamtwertung.</p>
<p>Das Produktversprechen ist nicht „viele Spiele", sondern <i>„spiel nach
euren Regeln, über alle Spiele hinweg gewertet"</i>. Der ganze Aufbau folgt
daraus: Server und Client kennen kein einzelnes Kartenspiel.</p>
<p><b>Diese Tafel ist zugleich die Visual-Building-Tafel des Repos.</b> Der
Orchestrator findet sie über den Namen und gibt ihr Destillat jedem Auftrag
mit; deshalb steht alles Wissen in Notiz-Kacheln und jeder Befund trägt ein
⚠ im Titel. Erzeugt wird sie aus
<code>werkzeug/gamedesk/boards/_erzeuger-brauweg.mjs</code> — von Hand
geänderte Kacheln überschreibt der nächste Lauf.</p>
<p style="color:#8a93a5;font-size:.9em">Stand 05.09.2026: zehn Spiele
spielbar (Doppelkopf, Zauberer, Skat, Cambio, Easy Poker, Mememory, Filler,
Eiland, Feldherr, Tafelrunde) · neun weitere als Vorschau zur Abstimmung ·
1.297 Tests in den Paketen (402 davon im Server) plus sieben Testdateien im
Client · live auf www.brauweg-spielen.de</p>`, 14), '#6ea8fe');

/* =======================================================================
   Verbindungen
   ===================================================================== */

link('client-app', 'server-http', 'REST: Konto, Lobby, Tische', { from: 'r', to: 'l' });
link('client-usetable', 'server-gateway', 'WebSocket  /ws', { from: 'r', to: 'l', color: '#57c98a', width: 2.5 });
link('server-gateway', 'client-usetable', 'view · table · party  (mit Revision)', { from: 'b', to: 'b', color: '#57c98a', dash: 'dashed', t: 0.5 });
link('server-gateway', 'server-runtime', 'join / action / leave', { from: 'b', to: 'r' });
link('server-protocol', 'server-gateway', 'Umschlag', { from: 't', to: 'l', size: 11, color: '#8fa4c4', dash: 'dotted' });
link('server-runtime', 'api-module', 'act · viewFor · legalActions · standings', { from: 'r', to: 'l', color: '#b78cf7', width: 2.5 });
link('server-registry', 'api-module', 'verdrahtet die Module', { from: 'r', to: 'l', color: '#b78cf7' });
link('server-registry-note', 'api-vertrag', 'kennt Spielnamen — damit sonst niemand sie kennen muss',
  { from: 'r', to: 'l', color: '#b78cf7', size: 11, dash: 'dashed' });
link('game-doko', 'api-vertrag', 'erfüllt', { from: 'l', to: 'r', size: 11 });
link('game-wizard', 'api-vertrag', 'erfüllt — eigene xpBasis', { from: 'l', to: 'r', size: 11 });
link('game-skat', 'api-vertrag', 'erfüllt — legalActions beim Drücken leer', { from: 'l', to: 'r', size: 11 });
link('game-cambio', 'api-vertrag', 'erfüllt — Endstand aufsteigend', { from: 'l', to: 'r', size: 11 });
link('game-feldherr', 'api-vertrag', 'erfüllt — ohne Zugfolge, mit viewCursor', { from: 'l', to: 'r', size: 11 });
link('game-eiland', 'api-vertrag', 'erfüllt — gleichzeitig, currentActor als Timer-Haken', { from: 'l', to: 'r', size: 11 });
link('game-tafelrunde', 'api-vertrag', 'erfüllt — legalActionsUnvollstaendig', { from: 'l', to: 'r', size: 11 });
link('game-klein', 'api-vertrag', 'erfüllt', { from: 'l', to: 'r', size: 11 });
link('api-invarianten', 'api-vertrag', 'spielt jedes Modul durch — damit das nächste Spiel den Vertrag beim ersten Lauf spürt',
  { from: 't', to: 'b', color: '#b78cf7', width: 2.5, size: 11 });
link('game-adapter', 'game-doko', 'Engine ⇄ Plattform', { from: 'r', to: 'b', size: 11, color: '#8fa4c4' });
link('game-feldherr', 'projekt-feldherr', 'eigene Tafel', { from: 'r', to: 'l', color: '#e8b45c', dash: 'dashed' });
link('server-runtime', 'db-snapshot', 'Snapshot nach jeder Aktion', { from: 'b', to: 't', color: '#4fd1c5', width: 2.5 });
link('server-http', 'db-schema', 'Drizzle', { from: 'b', to: 't', color: '#4fd1c5' });
link('server-economy', 'db-schema', 'Trophäen, Münzen, Truhen', { from: 'b', to: 'r', color: '#4fd1c5', size: 11 });
link('db-migrations', 'db-schema', 'von Hand', { from: 'l', to: 'r', size: 11, color: '#4fd1c5', dash: 'dashed' });
link('ops-deploy', 'server-http', 'liefert den gebauten Client mit aus', { from: 'l', to: 'b', color: '#e8b45c', curve: 'ortho' });
link('ops-ios', 'client-app', 'WKWebView — derselbe Client', { from: 'l', to: 'b', color: '#e8b45c', dash: 'dashed' });
link('rules-core', 'api-module', 'gilt für jedes Modul', { from: 'r', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('rules-bot', 'api-module', 'botAction(view)', { from: 'r', to: 'b', color: '#ef6b6b', size: 11 });
link('client-sandbox', 'rules-spectator', 'Grundsatz 2 zum Anfassen', { from: 'b', to: 'l', size: 11, color: '#ef6b6b', dash: 'dotted' });
link('client-wire', 'client-app', 'gebaut aus legalActions', { from: 'l', to: 'r', size: 11, dash: 'dotted' });
link('client-decks', 'client-app', 'decks.ts', { from: 't', to: 'b', size: 11, dash: 'dotted' });

for (let i = 0; i < steps.length - 1; i++) {
  link(steps[i][0], steps[i + 1][0], '', { from: 'r', to: 'l', color: '#9aa4b6', width: 2.5, curve: 'straight' });
}
link('flow-7', 'flow-1', 'nächster Zug', { from: 'b', to: 'b', color: '#9aa4b6', dash: 'dashed', size: 11 });

/* Befunde an die Stelle hängen, an der sie weh tun. Ein Befund ohne Anker
   liest sich wie eine Meinung; erst die Kante sagt, wen es angeht. */
link('warn-legal-leer', 'flow-1', 'hier greift die Ausnahme: der Client baut die Aktion selbst',
  { from: 't', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('warn-legal-halb', 'api-vertrag', 'deshalb das Meta-Feld legalActionsUnvollstaendig',
  { from: 'r', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('warn-currentactor', 'server-runtime', 'der Sitz existiert nur für Zugzeit, Bot-Übernahme und Verlassen-Regel',
  { from: 't', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('warn-feldherr-ausgang', 'game-feldherr', 'Weg B: kein Spielstand im Server, nur die Doppelmeldung',
  { from: 'r', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('warn-punkte-platz', 'rules-trophies', 'genau deshalb rechnet die Plattform mit place',
  { from: 't', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('warn-karten-ids', 'client-app', 'trifft den Client: IDs taugen nicht als Schlüssel über Runden hinweg',
  { from: 't', to: 'b', color: '#ef6b6b', dash: 'dashed', size: 11 });
link('warn-client-ungeprueft', 'client-app', 'ungeprüfte Fläche',
  { from: 't', to: 'b', color: '#ef6b6b', dash: 'dotted', size: 11 });
link('warn-feldherr-artefakte', 'game-feldherr', 'kern.js ist ein Erzeugnis, keine Quelle',
  { from: 'r', to: 'b', color: '#ef6b6b', dash: 'dotted', size: 11 });

/* ------------------------------------------------------------- Ausgabe */

const doc = {
  format: 'gamedesk-board',
  version: 1,
  name: 'Brauweg — Funktionsweise',
  view: { x: 900, y: 700, scale: 0.34 },
  grid: { size: 20, show: true, snap: true },
  windows: wins,
  connections: conns,
  models: [],
  nextZ: wins.length + 10
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 1), 'utf8');
console.log('geschrieben:', OUT);
console.log('Fenster:', wins.length, '· davon Rahmen:', wins.filter((w) => w.type === 'frame').length);
console.log('Verbindungen:', conns.length);
const types = {};
for (const w of wins) types[w.type] = (types[w.type] || 0) + 1;
console.log('Typen:', JSON.stringify(types));

/*
 * Zwei Proben, die den Weg zum Orchestrator absichern. Beide sind hier und
 * nicht im Kopf des naechsten Lesers, weil beide Fehler stumm sind: Die
 * Tafel sieht im Editor tadellos aus und liefert dem Auftrag trotzdem
 * weniger, als draufsteht.
 */

/* 1. Ueberlappende Rahmen. Das Destillat ordnet eine Kachel dem ERSTEN
      Rahmen zu, in dem ihre linke obere Ecke liegt — bei Ueberlappung also
      unter Umstaenden dem falschen Bereich, ohne dass es jemand sieht. */
const rahmen = wins.filter((w) => w.type === 'frame');
for (let i = 0; i < rahmen.length; i++) {
  for (let j = i + 1; j < rahmen.length; j++) {
    const a = rahmen[i], b = rahmen[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
      console.warn(`WARNUNG: Rahmen ueberlappen — „${a.title}" und „${b.title}"`);
    }
  }
}

/* 2. Laenge des Destillats. Der Tafel-Server deckelt bei 32.000 Zeichen
      (TAFEL_MAX_ZEICHEN) und schneidet am Ende ab — dort stehen die
      Verknuepfungen. Gerechnet wird hier grob wie dort: Notizen als
      Klartext, Rahmen als Ueberschrift, Kanten als eine Zeile. */
const klartext = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
let zeichen = 0;
for (const w of wins) {
  if (w.type === 'frame') zeichen += (w.title + (w.state?.note ?? '')).length + 8;
  if (w.type === 'notes') zeichen += w.title.length + klartext(w.state?.html ?? '').length + 8;
}
const titelVon = new Map(wins.map((w) => [w.id, w.title]));
for (const c of conns) {
  zeichen += (titelVon.get(c.from.win) ?? '').length + (titelVon.get(c.to.win) ?? '').length +
    (c.label ?? '').length + 8;
}
/*
 * Die Schwelle ist gerechnet, nicht geraten: Der Deckel liegt bei 32.000,
 * und obendrauf kommen spaeter die gemeldeten Aenderungen aus Auftraegen —
 * hoechstens 14 (TAFEL_MAX_AUFTRAGSNOTIZEN), erfahrungsgemaess je rund 350
 * Zeichen, also gut 5.000. Was darueber hinausgeht, faellt am ENDE weg, und
 * am Ende stehen die Verknuepfungen.
 */
const SCHWELLE = 32000 - 14 * 350;
console.log(`Destillat (geschaetzt): ${zeichen} Zeichen — Deckel des Tafel-Servers: 32000.`);
if (zeichen > SCHWELLE) {
  console.warn(`WARNUNG: ueber ${SCHWELLE} Zeichen — zusammen mit den Aenderungsmeldungen ` +
    'reisst das den Deckel, und abgeschnitten werden zuerst die Verknuepfungen.');
}
