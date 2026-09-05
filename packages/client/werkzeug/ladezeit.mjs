/*
 * Wie lange dauert es, bis ueberhaupt etwas auf dem Bildschirm steht?
 *
 *   npm run build --workspace @brauweg/client
 *   node packages/client/werkzeug/ladezeit.mjs packages/client/dist [--roh]
 *
 * Der Anlass ist Robins Satz vom 05.09.2026: "bei mir ist wieder nicht schnell
 * genug heruntergeladen." Die Antwort darauf ist eine Zahl und keine Meinung,
 * und weil sie sich mit jeder Aenderung am Buendel verschiebt, steht hier das
 * Werkzeug und nicht nur das Ergebnis.
 *
 * Gemessen wird mit echtem Chrome ueber das DevTools-Protokoll, gedrosselt auf
 * Chromes Profil "Slow 3G" — 400 kbit/s bei 2000 ms Latenz, dieselben Werte,
 * die der Netzwerk-Reiter unter diesem Namen setzt. Genommen wird
 * `firstContentfulPaint`: der erste Pixel, den ein Mensch sieht. Drei Laeufe
 * mit leerem Zwischenspeicher, berichtet wird der mittlere.
 *
 * Es wird NICHT geklickt und nichts angemeldet. Das ist Absicht: Die Wartezeit,
 * um die es Robin geht, liegt VOR dem ersten Bild — vor Anmeldung, vor Hub,
 * vor jedem Antippen. Was danach kommt, steht als Stueckgroesse im
 * Bauprotokoll und braucht keine Uhr.
 *
 * `--roh` schaltet gzip ab. Beide Zahlen sind interessant, weil der
 * Brauweg-Server selbst nicht komprimiert (kein @fastify/compress) und offen
 * ist, ob die Kante davor es tut.
 *
 * Ergebnis am 06.09.2026, Chrome 141, Windows:
 *
 *                          mit gzip     ohne gzip
 *   vor der Aufteilung      16,79 s       49,83 s
 *   danach                   7,63 s       17,22 s
 */
import { createReadStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createGzip } from 'node:zlib';
import { spawn } from 'node:child_process';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';

const [, , ordner, ...rest] = process.argv;
if (!ordner) {
  console.error('Aufruf: node ladezeit.mjs <dist-ordner> [--roh]');
  process.exit(1);
}
const rohModus = rest.includes('--roh');
const CHROME =
  process.env.CHROME_PFAD ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LAEUFE = 3;

const TYPEN = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};
/* Was schon komprimiert ist, wird nicht noch einmal gepackt — genau so haelt
   es jede Kante, und sonst zaehlte die Messung Bilder doppelt guenstig. */
const PACKBAR = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);

const server = createServer((anfrage, antwort) => {
  const pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
  let datei = join(ordner, pfad.split('/').filter((t) => t !== '..').join('/'));
  if (!existsSync(datei) || statSync(datei).isDirectory()) datei = join(ordner, 'index.html');
  const endung = extname(datei).toLowerCase();
  antwort.setHeader('content-type', TYPEN[endung] ?? 'application/octet-stream');
  antwort.setHeader('cache-control', 'no-store');
  if (!rohModus && PACKBAR.has(endung)) {
    antwort.setHeader('content-encoding', 'gzip');
    createReadStream(datei).pipe(createGzip()).pipe(antwort);
    return;
  }
  createReadStream(datei).pipe(antwort);
});
await new Promise((f) => server.listen(0, '127.0.0.1', f));
const adresse = `http://127.0.0.1:${server.address().port}/`;

async function einLauf() {
  const profil = mkdtempSync(join(tmpdir(), 'chrome-messung-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', `--user-data-dir=${profil}`,
    'about:blank',
  ]);
  const wsUrl = await new Promise((erfuellen, ablehnen) => {
    const uhr = setTimeout(() => ablehnen(new Error('Chrome meldet sich nicht')), 30_000);
    chrome.stderr.on('data', (b) => {
      const treffer = /ws:\/\/[^\s]+/.exec(String(b));
      if (treffer) { clearTimeout(uhr); erfuellen(treffer[0]); }
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((f) => ws.addEventListener('open', f, { once: true }));
  let nr = 0;
  const offen = new Map();
  const horcher = [];
  ws.addEventListener('message', (e) => {
    const n = JSON.parse(e.data);
    if (n.id && offen.has(n.id)) { offen.get(n.id)(n.result); offen.delete(n.id); }
    if (n.method) for (const h of horcher) h(n);
  });
  const ruf = (method, params = {}, sessionId) =>
    new Promise((f) => { const id = ++nr; offen.set(id, f); ws.send(JSON.stringify({ id, method, params, sessionId })); });

  const { targetId } = await ruf('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await ruf('Target.attachToTarget', { targetId, flatten: true });

  await ruf('Network.enable', {}, sessionId);
  await ruf('Page.enable', {}, sessionId);
  await ruf('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId);
  await ruf('Network.clearBrowserCache', {}, sessionId);
  // Chromes Profil „Slow 3G": 400 kbit/s, 2000 ms Latenz.
  await ruf('Network.emulateNetworkConditions', {
    offline: false, latency: 2000,
    downloadThroughput: (400 * 1000) / 8, uploadThroughput: (400 * 1000) / 8,
  }, sessionId);

  let uebertragen = 0;
  const ersterPixel = new Promise((erfuellen) => {
    horcher.push((n) => {
      if (n.method === 'Network.loadingFinished') uebertragen += n.params.encodedDataLength ?? 0;
      if (n.method === 'Page.lifecycleEvent' && n.params.name === 'firstContentfulPaint') {
        erfuellen();
      }
    });
  });

  await ruf('Page.navigate', { url: adresse }, sessionId);
  await ersterPixel;
  /* Die Zahl kommt aus der Seite selbst und nicht aus einer eigenen Stoppuhr:
     `startTime` zaehlt ab dem Beginn der Navigation, also einschliesslich der
     zwei Sekunden Latenz fuer die index.html. */
  const { result } = await ruf('Runtime.evaluate', {
    expression: `performance.getEntriesByName('first-contentful-paint')[0].startTime`,
    returnByValue: true,
  }, sessionId);

  /* Kurz nachlaufen lassen: Die letzten `loadingFinished` treffen erst nach
     dem ersten Pixel ein, und sie gehoeren in die uebertragene Menge. */
  await new Promise((f) => setTimeout(f, 500));
  ws.close();
  chrome.kill();
  try { rmSync(profil, { recursive: true, force: true }); } catch { /* Windows haelt Dateien fest */ }
  return { fcpMs: result.value, uebertragen };
}

const ergebnisse = [];
for (let i = 0; i < LAEUFE; i += 1) ergebnisse.push(await einLauf());
server.close();

const mitte = (werte) => [...werte].sort((a, b) => a - b)[Math.floor(werte.length / 2)];
const zeiten = ergebnisse.map((e) => e.fcpMs);
console.log(`${ordner}   ${rohModus ? '[ohne gzip]' : '[mit gzip]'}   Slow 3G`);
console.log(`  erster Pixel (Median von ${LAEUFE}): ${(mitte(zeiten) / 1000).toFixed(2)} s`);
console.log(`  alle Laeufe: ${zeiten.map((z) => (z / 1000).toFixed(2)).join(' / ')} s`);
console.log(
  `  bis dahin uebertragen: ${(mitte(ergebnisse.map((e) => e.uebertragen)) / 1024).toFixed(1)} kB`,
);
