/* Erzeugt die GameDesk-Tafel „Brauweg — Funktionsweise". */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = 'C:/Users/freyd/Desktop/SPIDERVISION/gamedesk/boards/brauweg-funktionsweise.gamedesk.json';

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

const note = (html, fontSize = 13) => ({ html, fontSize });
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
  doppelkopf as unknown as AnyGameModule,
  wizard     as unknown as AnyGameModule,
  feldherr   as unknown as AnyGameModule,
];

/** Spiele ohne Modul: sichtbar, nicht startbar, abstimmbar. */
const PREVIEW = ['skat','schafkopf','romme','maumau',
                 'schwimmen','backgammon','bauernskat'];`,
    { marks: [8, 9, 10, 11, 12], caption: 'Ein neues Spiel = eine Zeile in MODULES. Kein weiterer Eingriff in Server oder Client.' }),
  '#8fa4c4');

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
<li><b>Trophäen</b> — Module liefern nur Platzierungen, die Wertung rechnet
die Plattform. Deshalb trägt eine Rangliste über alle Spiele.</li>
<li><b>Münzen und Edelsteine</b> — Edelsteine kaufen alles, Münzen nicht
alles. Der Umtausch ist <b>einseitig</b>; eine Gegenrichtung machte jede
Truhe zur Geldquelle.</li>
<li><b>Preise stehen im Katalog</b> (<code>kosmetik.ts</code>,
<code>tischware.ts</code>), nie in der Datenbank — eine neue Warenart ist
eine Datei, keine Migration.</li>
<li>Truhen, Aufgaben, Stufen, Runner, Vereine samt Krieg und Chat.</li>
</ul>`), '#6ea8fe');

frame('f-server', 'Server', 'Ein Dienst · packages/server', '#6ea8fe',
  ['server-http', 'server-gateway', 'server-protocol', 'server-registry', 'server-runtime', 'server-economy'], 'technik');

/* =======================================================================
   3  Spielmodule
   ===================================================================== */

const GX = 1560;

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

win('game-doko', 'notes', 'Doppelkopf', GX + 570, -960, 400, 300, note(`
<h3>packages/game-doppelkopf</h3>
<p>Die größte Engine im Haus: <code>round.ts</code> allein 43 kB.</p>
<ul><li><code>ruleset.ts</code>, <code>validator.ts</code> — Regelsatz</li>
<li><code>deal.ts</code>, <code>order.ts</code>, <code>trick.ts</code></li>
<li>Vorbehalte, Hochzeit, Armut, Pflichtsolo, Schmeiß, Bock</li>
<li><code>scoring.ts</code>, <code>trophies.ts</code>, <code>bot.ts</code></li></ul>
<p>3 bis 5 Sitze · 128 Tests</p>`), '#b78cf7');

win('game-wizard', 'notes', 'Zauberer', GX + 570, -630, 400, 190, note(`
<h3>packages/game-wizard</h3>
<p>Stichansage-Spiel. Die xp-Basis ist hier die Summe der Rundennummern,
beim Doppelkopf Blattgröße mal Runden — <b>nur das Modul weiß das.</b></p>
<p>117 Tests</p>`), '#b78cf7');

win('game-feldherr', 'notes', 'Feldherr — Echtzeit im Gleichschritt', GX + 570, -410, 400, 300, note(`
<h3>packages/game-feldherr</h3>
<p>Kein Kartenspiel, aber dieselbe Schnittstelle — <b>ohne</b> Zugfolge und
Runden. Beide Geräte rechnen gleichzeitig aus demselben Saatkorn und
derselben Aktionsliste weiter.</p>
<p>Über die Leitung gehen <b>nur Handlungen, nie Zustände</b>: eine Partie
kommt mit einigen Dutzend Aktionen aus statt mit zwanzig Zuständen je
Sekunde.</p>
<p>Der Kern zieht seinen Zufall ausschließlich aus <code>saat()</code>
(mulberry32). Wer daran etwas ändert, bricht jedes Netzspiel — sichtbar
erst daran, dass beide einen anderen Sieger sehen.</p>`), '#b78cf7');

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
  ['api-module', 'game-doko', 'game-wizard', 'game-feldherr', 'game-adapter'], 'game');

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

frame('f-rules', 'Grundsätze', 'Was die Trennung trägt', '#ef6b6b',
  ['rules-core', 'rules-spectator', 'rules-bot'], 'gamedesign');

/* =======================================================================
   5  Daten
   ===================================================================== */

win('db-schema', 'notes', 'PostgreSQL — 32 Tabellen', SX + 320, 260, 440, 430, note(`
<h3>db/schema.ts (Drizzle)</h3>
<p><b>Konto:</b> account, session, auth_token, account_game_stat,
account_game_theme, account_cosmetic, account_avatar</p>
<p><b>Tisch und Partie:</b> game_table, table_seat, party, party_snapshot,
round_summary, rule_set, trophy_ledger, pairing_log</p>
<p><b>Verein:</b> club, club_member, club_join_request, club_message,
club_war, club_war_score</p>
<p><b>Fortschritt:</b> chest_claim, quest_progress, runner_day, runner_best,
stat_counter, purchase</p>
<p><b>Sozial:</b> friendship, block, report, game_vote, invite_code</p>
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
<li><b>React-Effekte an einen Schlüssel hängen</b>, nicht an ein Objekt.
Sonst läuft der Effekt bei jedem Serverfunk neu und räumt seine Timer ab —
so blieb der Rundenabschluss einmal unsichtbar.</li>
<li><b>Am Tisch nichts stumm verwerfen.</b> <code>send()</code> verschluckte
Aktionen bei toter Verbindung; jetzt hält eine Warteschlange sie kurz fest.</li>
<li><b>Vor jedem Commit <code>git diff --cached --stat</code> lesen.</b> Am
5. August löschte ein Commit 932 Dateien mit — Build und alle 541 Tests
liefen grün durch, weil sie von der Platte lesen, nicht aus dem Index.</li>
</ul>`), '#e8b45c');

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
   Überschrift
   ===================================================================== */

win('titel', 'notes', 'Brauweg', -1560, -1420, 900, 260, note(`
<h1>Brauweg — Funktionsweise</h1>
<p><b>Kartenspiel-Plattform mit frei konfigurierbaren Regelsätzen.</b> Mehrere
klassische Spiele unter einem Dach, eigene Rangliste je Spiel plus
spielübergreifende Gesamtwertung.</p>
<p>Das Produktversprechen ist nicht „viele Spiele", sondern <i>„spiel nach
euren Regeln, über alle Spiele hinweg gewertet"</i>. Der ganze Aufbau folgt
daraus: Server und Client kennen kein einzelnes Kartenspiel.</p>
<p style="color:#8a93a5;font-size:.9em">Stand: Doppelkopf, Zauberer und
Feldherr spielbar · sieben weitere als Vorschau zur Abstimmung ·
504 Tests · live auf www.brauweg-spielen.de</p>`, 14), '#6ea8fe');

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
link('game-doko', 'api-module', 'erfüllt', { from: 'l', to: 'r', size: 11 });
link('game-wizard', 'api-module', 'erfüllt', { from: 'l', to: 'r', size: 11 });
link('game-feldherr', 'api-module', 'erfüllt', { from: 'l', to: 'r', size: 11 });
link('game-adapter', 'game-doko', 'Engine ⇄ Plattform', { from: 'r', to: 'b', size: 11, color: '#8fa4c4' });
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
