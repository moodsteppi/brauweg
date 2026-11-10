/**
 * Misst die Eingabeverzögerung von BroRemote (Bro Building Battle), Ende zu Ende.
 *
 *   npx tsx werkzeug/broremote-messen.mjs [--ziel lokal|staging] [--anzahl 250] [--aus datei.tsv]
 *
 * Zwei Teile:
 *  1. LEITUNG — Gastgeber und Handy als zwei rohe WebSockets in DIESEM Prozess.
 *     Weil beide dieselbe Uhr haben, ist Handy → Gastgeber hier exakt, und der
 *     Rest nach Abzug beider halben Pings ist die Zeit im Relay.
 *  2. BROWSER — der echte Client (Vite, `?messen=1`) in Edge ohne Fenster: eine
 *     Seite als Gastgeber, eine als Handy (390 px), Druck per CDP auf „Links“.
 *     Ausgelesen wird die Tabelle aus `window.__broremoteMessung`.
 *
 * `lokal` startet das echte `BroRemoteGateway` auf einem freien Port. `staging`
 * geht an staging.brauweg-spielen.de; der Server lässt nur seine eigene
 * Herkunft zu, deshalb setzt der Vite-Proxy (und der rohe Client) sie.
 * Braucht `packages/broremote-kern/dist` (npm run build im Kernpaket genügt).
 */
import { createServer as httpServer } from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, vorgabe) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : vorgabe; };
const ZIEL = arg('ziel', 'lokal'), ANZAHL = Number(arg('anzahl', '250')), AUS = arg('aus', '');
const STAGING = 'staging.brauweg-spielen.de';
const warte = ms => new Promise(r => setTimeout(r, ms));
const quantil = (w, q) => { if (!w.length) return NaN; const s = [...w].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]; };
const zeile = (name, w) => `${name.padEnd(34)} n=${String(w.length).padStart(4)}  median=${quantil(w, .5).toFixed(1).padStart(6)} ms  p95=${quantil(w, .95).toFixed(1).padStart(6)} ms`;

let relayAdresse, relayHerkunft, schliessen = [];
if (ZIEL === 'lokal') {
  const { BroRemoteGateway } = await import('../packages/server/src/realtime/broremote.ts');
  const server = httpServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const gw = new BroRemoteGateway(server, []);
  relayAdresse = `ws://127.0.0.1:${server.address().port}/ws/broremote`;
  relayHerkunft = undefined;
  schliessen.push(async () => { await gw.close(); server.close(); });
} else {
  relayAdresse = `wss://${STAGING}/ws/broremote`;
  relayHerkunft = `https://${STAGING}`;
}

// ---------- 1. LEITUNG ----------
function leitung() {
  const ws = new WebSocket(relayAdresse, relayHerkunft ? { origin: relayHerkunft } : {});
  const zuhoerer = new Set();
  ws.on('message', d => { const n = JSON.parse(String(d)); n.t = performance.now(); for (const f of [...zuhoerer]) f(n); });
  const senden = n => ws.send(JSON.stringify({ v: 1, ...n }));
  const naechste = (pruef, frist = 8000) => new Promise((ok, nein) => {
    const f = n => { if (pruef(n)) { zuhoerer.delete(f); clearTimeout(t); ok(n); } };
    const t = setTimeout(() => { zuhoerer.delete(f); nein(new Error('Frist abgelaufen')); }, frist);
    zuhoerer.add(f);
  });
  return { ws, senden, naechste, zuhoerer, offen: new Promise(r => ws.once('open', r)) };
}
async function pings(l, anzahl) {
  const rtt = [];
  for (let i = 0; i < anzahl; i++) {
    const t0 = performance.now(); l.senden({ art: 'ping' });
    await l.naechste(n => n.art === 'pong'); rtt.push(performance.now() - t0); await warte(40);
  }
  return rtt;
}
async function leitungMessen() {
  const host = leitung(); await host.offen;
  host.senden({ art: 'oeffnen' });
  const w = await host.naechste(n => n.art === 'willkommen');
  const handy = leitung(); await handy.offen;
  handy.senden({ art: 'beitreten', raum: w.raum, einladung: w.einladung, name: 'Messung' });
  await handy.naechste(n => n.art === 'willkommen');
  handy.senden({ art: 'bereit', bereit: true });
  await host.naechste(n => n.art === 'raum' && n.sicht.spieler[0]?.bereit);
  host.senden({ art: 'starten' }); // Verbindungstest: dieselbe Weiterleitung, keine Partie nötig
  const raum = await handy.naechste(n => n.art === 'raum' && n.sicht.phase === 'test');
  const rttHost = await pings(host, 40), rttHandy = await pings(handy, 40);
  const einweg = [], gesendet = new Map();
  host.zuhoerer.add(n => { if (n.art === 'eingabe' && gesendet.has(n.folge)) { einweg.push(n.t - gesendet.get(n.folge)); gesendet.delete(n.folge); } });
  // Ein Gastgeber, der 15 s nichts sagt, gilt im Raum als weg (BroRaum.tick) — der echte Client pingt alle 3 s.
  const lebt = setInterval(() => host.senden({ art: 'ping' }), 2000);
  for (let i = 1; i <= ANZAHL; i++) {
    gesendet.set(i, performance.now());
    handy.senden({ art: 'eingabe', abschnitt: raum.sicht.abschnitt, folge: i, aktion: { art: 'steuerung', x: i % 2 ? -1 : 0, y: 0, tasten: [] } });
    await warte(60 + Math.random() * 60); // unter der Grenze von 80 Nachrichten je Sekunde
  }
  await warte(1500); clearInterval(lebt);
  host.senden({ art: 'verlassen' }); host.ws.close(); handy.ws.close();
  const rest = einweg.map(e => e - quantil(rttHandy, .5) / 2 - quantil(rttHost, .5) / 2);
  return { rttHost, rttHandy, einweg, rest, verloren: ANZAHL - einweg.length };
}

// ---------- 2. BROWSER ----------
async function browserMessen() {
  const { createServer } = await import('vite');
  const ziel = ZIEL === 'lokal' ? relayAdresse.replace('/ws/broremote', '') : `wss://${STAGING}`;
  const vite = await createServer({
    root: join(wurzel, 'packages/client'), configFile: join(wurzel, 'packages/client/vite.config.ts'), logLevel: 'silent', // /api fehlt lokal (Album, Wertung) — für die Messung belanglos
    server: { port: 0, host: '127.0.0.1', proxy: { '/ws': { target: ziel, ws: true, changeOrigin: true, secure: true, ...(relayHerkunft ? { headers: { origin: relayHerkunft } } : {}) } } },
  });
  await vite.listen();
  schliessen.push(() => vite.close());
  const basis = `http://127.0.0.1:${vite.httpServer.address().port}`;
  // Seite einmal vorwärmen: Vite übersetzt beim ersten Abruf, das soll nicht in die Messung.
  await fetch(`${basis}/broremote`);

  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  if (!edge) throw new Error('Kein Edge gefunden.');
  const profil = mkdtempSync(join(tmpdir(), 'broremote-messen-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proz = spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, '--no-first-run',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', 'about:blank'], { stdio: 'ignore' });
  schliessen.push(() => proz.kill());
  let version;
  for (let i = 0; i < 50 && !version; i++) { await warte(200); version = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json()).catch(() => undefined); }
  const cdp = new globalThis.WebSocket(version.webSocketDebuggerUrl);
  await new Promise(r => cdp.addEventListener('open', r, { once: true }));
  let nr = 0; const warten = new Map();
  cdp.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && warten.has(d.id)) { warten.get(d.id)(d); warten.delete(d.id); } });
  const befehl = (method, params = {}, sessionId) => new Promise((ok, nein) => {
    const id = ++nr; warten.set(id, d => d.error ? nein(new Error(`${method}: ${d.error.message}`)) : ok(d.result));
    cdp.send(JSON.stringify({ id, method, params, sessionId }));
  });
  async function seite(breite, hoehe) {
    const { targetId } = await befehl('Target.createTarget', { url: 'about:blank', newWindow: true });
    const { sessionId } = await befehl('Target.attachToTarget', { targetId, flatten: true });
    await befehl('Emulation.setDeviceMetricsOverride', { width: breite, height: hoehe, deviceScaleFactor: 1, mobile: breite < 500 }, sessionId);
    const werte = async (ausdruck) => {
      const r = await befehl('Runtime.evaluate', { expression: ausdruck, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const bis = async (ausdruck, frist = 20000) => {
      for (const ende = Date.now() + frist; Date.now() < ende; await warte(150)) { const v = await werte(ausdruck); if (v) return v; }
      throw new Error(`Frist abgelaufen: ${ausdruck}`);
    };
    const knopf = text => werte(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)}) && !b.disabled); if (!b) return false; b.click(); return true; })()`);
    return { sessionId, werte, bis, knopf, oeffnen: url => befehl('Page.navigate', { url }, sessionId) };
  }

  const host = await seite(1400, 900), handy = await seite(390, 844);
  await host.oeffnen(`${basis}/broremote?messen=1`);
  // Die Startseite zeigt erst die Spielkarte, dann die Lobby-Auswahl.
  await host.bis(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Jetzt spielen'))`, 60000);
  await host.knopf('Jetzt spielen');
  await host.bis(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Lobby eröffnen'))`);
  await host.knopf('Lobby eröffnen');
  const link = await host.bis(`document.querySelector('input[aria-label="Einladungslink zum Kopieren"]')?.value`);
  await handy.oeffnen(link);
  await handy.bis(`!!document.querySelector('input[autocomplete="nickname"]')`, 60000);
  await handy.werte(`(() => { const i = document.querySelector('input[autocomplete="nickname"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'Messhandy'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await handy.bis(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Verbinden' && !b.disabled)`);
  await handy.knopf('Verbinden');
  await handy.bis(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Ich bin bereit') && !b.disabled)`);
  await handy.knopf('Ich bin bereit');
  await host.bis(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Battle starten') && !b.disabled)`);
  await host.knopf('Battle starten');
  await handy.bis(`!!document.querySelector('button[aria-label="Nach links"]:not(:disabled)')`, 60000);
  // Uhrabgleich beider Seiten abwarten, sonst zählt der Gastgeber nichts.
  await host.bis(`window.__broremoteMessung?.uhr.proben.length >= 8`);
  await handy.bis(`window.__broremoteMessung?.uhr.proben.length >= 8`);

  const maus = (type, x, y) => befehl('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1, pointerType: 'mouse' }, handy.sessionId);
  for (let i = 0; i < ANZAHL; i++) {
    const p = await handy.werte(`(() => { const b = document.querySelector('button[aria-label="${i % 2 ? 'Nach rechts' : 'Nach links'}"]:not(:disabled)'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (!p) { await warte(200); continue; }
    await maus('mousePressed', p.x, p.y); await warte(50 + Math.random() * 50);
    await maus('mouseReleased', p.x, p.y); await warte(80 + Math.random() * 120);
  }
  await warte(2500);
  const tabelle = await host.werte('window.__broremoteMessung.tabelle()');
  const abschnitte = await host.werte('window.__broremoteMessung.abschnitte()');
  const rttHost = await host.werte('window.__broremoteMessung.uhr.proben.map(p => p.rtt)');
  const rttHandy = await handy.werte('window.__broremoteMessung.uhr.proben.map(p => p.rtt)');
  const gesendet = await handy.werte('window.__broremoteMessung.gesendet.length');
  cdp.close();
  return { tabelle, abschnitte, rttHost, rttHandy, gesendet };
}

try {
  console.log(`BroRemote-Messung gegen ${ZIEL} (${relayAdresse}), ${ANZAHL} Eingaben je Teil\n`);
  const l = await leitungMessen();
  console.log('LEITUNG (Node, eine Uhr)');
  console.log(zeile('Ping Gastgeber (RTT)', l.rttHost));
  console.log(zeile('Ping Handy (RTT)', l.rttHandy));
  console.log(zeile('Handy → Gastgeber (exakt)', l.einweg));
  console.log(zeile('davon im Relay (Rest)', l.rest));
  if (l.verloren) console.log(`verloren: ${l.verloren}`);
  const b = await browserMessen();
  console.log('\nBROWSER (Client mit ?messen=1, Edge ohne Fenster)');
  console.log(zeile('Ping Gastgeber (RTT)', b.rttHost));
  console.log(zeile('Ping Handy (RTT)', b.rttHandy));
  for (const a of b.abschnitte) console.log(zeile(a.name, a.werte));
  console.log(`Handy hat ${b.gesendet} Eingaben gesendet.`);
  if (AUS) { writeFileSync(AUS, b.tabelle); console.log(`Tabelle: ${AUS}`); }
} finally {
  for (const f of schliessen.reverse()) await Promise.resolve(f()).catch(() => undefined);
  setTimeout(() => process.exit(0), 300);
}
