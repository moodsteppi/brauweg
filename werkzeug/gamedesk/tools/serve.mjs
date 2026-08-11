/**
 * Dateiserver und Projekt-Bibliothek für GameDesk.
 *
 * Node bringt alles mit, es braucht kein Paket.
 *
 *   node tools/serve.mjs [port] [wurzel]
 *
 * `wurzel` ist normalerweise der GameDesk-Ordner; ein zweiter Pfad legt
 * stattdessen einen beliebigen Ordner offen (praktisch, um fremde Seiten
 * daneben zu betrachten). Die Bibliotheks-API bleibt davon unberührt.
 *
 * Zwei Aufgaben:
 *
 *   1. Die Anwendung ausliefern. Wichtig ist `Cache-Control: no-store` —
 *      ohne diesen Kopf liefert der Browser nach einer Änderung weiter die
 *      alte .js aus dem Speicher, und man sucht den Fehler im Quelltext
 *      statt im Cache.
 *
 *   2. Einen Ordner auf der Platte als Projektbibliothek bereitstellen
 *      (`/api/bibliothek/*`). Der Ordner wird EINMAL gesetzt und in
 *      tools/bibliothek.json gemerkt; alle weiteren Aufrufe nennen nur noch
 *      Dateinamen INNERHALB dieses Ordners. Damit kann keine Anfrage einen
 *      beliebigen Pfad auf der Platte lesen oder schreiben.
 *
 * Der Server lauscht bewusst nur auf 127.0.0.1.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, stat, readdir, mkdir, unlink, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { extname, join, normalize, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEIM = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.argv[2]) || 5190;
const ROOT = process.argv[3] ? resolve(process.argv[3]) : HEIM;
const CONFIG = join(HEIM, 'tools', 'bibliothek.json');
const MAX_TIEFE = 2;
/* Tafeln tragen ihre Medien als data:-URL in sich (siehe js/core/depot.js).
   Ein Board mit ein paar Tonspuren ist darum schnell dreistellig in MB —
   die alten 64/96 MB waren nach zwei Bildern erreicht. */
const MAX_TAFEL = 512 * 1024 * 1024;

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8'
};

/* ------------------------------------------------------ Bibliothek --- */

let ordner = join(HEIM, 'boards');

async function ladeConfig() {
  try {
    const roh = JSON.parse(await readFile(CONFIG, 'utf8'));
    if (typeof roh.ordner === 'string' && roh.ordner) ordner = resolve(roh.ordner);
  } catch (e) { /* Vorgabe bleibt */ }
}

async function speichereConfig() {
  await mkdir(dirname(CONFIG), { recursive: true });
  await writeFile(CONFIG, JSON.stringify({ ordner }, null, 1), 'utf8');
}

/** Nur Namen innerhalb des Bibliotheksordners, keine Ausbrüche. */
function sicherePfad(name) {
  if (typeof name !== 'string' || !name) return null;
  if (!/\.json$/i.test(name)) return null;
  if (/[:*?"<>|]/.test(name)) return null;          // keine Laufwerke, keine Wildcards
  const rein = normalize(name).replace(/^([/\\])+/, '');
  if (rein.split(/[/\\]/).includes('..')) return null;
  const voll = resolve(join(ordner, rein));
  if (voll !== ordner && !voll.startsWith(ordner + sep)) return null;
  return voll;
}

/** Alle GameDesk-Tafeln im Ordner, bis zu zwei Ebenen tief. */
async function liste() {
  const out = [];
  async function lauf(pfad, rel, tiefe) {
    let eintraege;
    try { eintraege = await readdir(pfad, { withFileTypes: true }); }
    catch (e) { return; }
    for (const e of eintraege) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const voll = join(pfad, e.name);
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) {
        if (tiefe < MAX_TIEFE) await lauf(voll, r, tiefe + 1);
        continue;
      }
      if (!/\.json$/i.test(e.name)) continue;
      try {
        const s = await stat(voll);
        if (s.size > MAX_TAFEL) continue;
        const doc = JSON.parse(await readFile(voll, 'utf8'));
        if (!doc || doc.format !== 'gamedesk-board') continue;
        const module = {};
        for (const w of doc.windows || []) module[w.type] = (module[w.type] || 0) + 1;
        out.push({
          datei: r,
          name: typeof doc.name === 'string' ? doc.name : e.name.replace(/\.gamedesk\.json$|\.json$/i, ''),
          groesse: s.size,
          geaendert: s.mtimeMs,
          fenster: (doc.windows || []).length,
          pfeile: (doc.connections || []).length,
          modelle: (doc.models || []).length,
          module
        });
      } catch (err) { /* keine Tafel, überspringen */ }
    }
  }
  await lauf(ordner, '', 0);
  out.sort((a, b) => b.geaendert - a.geaendert);
  return out;
}

async function ordnerStatus() {
  let existiert = false, schreibbar = false;
  try { const s = await stat(ordner); existiert = s.isDirectory(); } catch (e) { /* nein */ }
  if (existiert) {
    try { await access(ordner, constants.W_OK); schreibbar = true; } catch (e) { /* nur lesen */ }
  }
  return { ordner, existiert, schreibbar };
}

/* ------------------------------------------------ Brücke nach Broweg --- */
/*
 * Die Worker-Kachel spricht mit dem bro-server aus dem Broweg-Projekt
 * (Worker-Modul: /workers, /tasks). Direkt aus der Seite heraus ginge das
 * nicht — der bro-server schickt keine CORS-Köpfe und hängt seine Sitzung an
 * ein Cookie, das ein fremder Ursprung nicht mitschicken darf. Also läuft
 * alles über diesen Server: gleiche Herkunft, kein CORS, und das Sitzungs-
 * Cookie liegt hier statt im Browser.
 *
 * Das Cookie bleibt ABSICHTLICH nur im Arbeitsspeicher: Nach einem Neustart
 * des Servers muss man sich neu anmelden. Auf die Platte geht nur die Adresse
 * des Servers (tools/broweg.json) — nie E-Mail, nie Passwort, nie das Cookie.
 *
 * Weitergereicht werden ausschließlich die Pfade in ERLAUBT. Die Brücke ist
 * kein offener Weiterleiter.
 */

const BROWEG_CONFIG = join(HEIM, 'tools', 'broweg.json');
const ERLAUBT = [
  /^\/health$/,
  /^\/auth\/session$/,
  /^\/workers$/,
  /^\/workers\/[\w-]+$/,
  /^\/tasks$/,
  /^\/tasks\/[\w-]+$/,
  /^\/tasks\/[\w-]+\/(followup|feedback)$/
];

let browegBasis = 'http://localhost:4000';
let browegCookie = '';            // nur im Speicher
let browegBenutzer = '';

async function ladeBroweg() {
  try {
    const roh = JSON.parse(await readFile(BROWEG_CONFIG, 'utf8'));
    if (typeof roh.basis === 'string' && roh.basis) browegBasis = roh.basis;
  } catch (e) { /* Vorgabe bleibt */ }
}

async function speichereBroweg() {
  await mkdir(dirname(BROWEG_CONFIG), { recursive: true });
  await writeFile(BROWEG_CONFIG, JSON.stringify({ basis: browegBasis }, null, 1), 'utf8');
}

function browegZiel(pfad) {
  const basis = browegBasis.replace(/\/+$/, '');
  return basis + pfad;
}

function nimmCookie(antwort) {
  const liste = typeof antwort.headers.getSetCookie === 'function'
    ? antwort.headers.getSetCookie()
    : [antwort.headers.get('set-cookie')].filter(Boolean);
  for (const eintrag of liste) {
    const paar = String(eintrag).split(';')[0].trim();
    if (paar) browegCookie = paar;         // der bro-server setzt genau eines
  }
}

async function browegApi(req, res, url) {
  const p = url.pathname;

  if (p === '/api/broweg' && req.method === 'GET') {
    return json(res, 200, { basis: browegBasis, angemeldet: !!browegCookie, benutzer: browegBenutzer });
  }

  if (p === '/api/broweg' && req.method === 'POST') {
    let daten;
    try { daten = JSON.parse(await koerper(req)); } catch (e) { return json(res, 400, { fehler: 'ungültige Anfrage' }); }
    const neu = typeof daten.basis === 'string' ? daten.basis.trim() : '';
    if (!/^https?:\/\/[^\s]+$/i.test(neu)) return json(res, 400, { fehler: 'Adresse muss mit http:// oder https:// beginnen' });
    if (neu !== browegBasis) { browegCookie = ''; browegBenutzer = ''; }   // fremder Server, fremde Sitzung
    browegBasis = neu.replace(/\/+$/, '');
    await speichereBroweg();
    return json(res, 200, { basis: browegBasis, angemeldet: !!browegCookie, benutzer: browegBenutzer });
  }

  if (p === '/api/broweg/anmelden' && req.method === 'POST') {
    let daten;
    try { daten = JSON.parse(await koerper(req)); } catch (e) { return json(res, 400, { fehler: 'ungültige Anfrage' }); }
    try {
      const antwort = await fetch(browegZiel('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: daten.email, password: daten.passwort })
      });
      if (!antwort.ok) {
        const text = await antwort.text();
        let m = 'Anmeldung abgelehnt';
        try { m = JSON.parse(text).message || m; } catch (e) { /* Rohtext */ }
        return json(res, antwort.status, { fehler: m });
      }
      nimmCookie(antwort);
      browegBenutzer = typeof daten.email === 'string' ? daten.email : '';
      if (!browegCookie) return json(res, 502, { fehler: 'Der Server hat kein Sitzungs-Cookie geschickt.' });
      return json(res, 200, { angemeldet: true, benutzer: browegBenutzer });
    } catch (e) {
      return json(res, 502, { fehler: 'Kein Kontakt zu ' + browegBasis + ' (' + e.message + ')' });
    }
  }

  if (p === '/api/broweg/abmelden' && req.method === 'POST') {
    if (browegCookie) {
      try { await fetch(browegZiel('/auth/logout'), { method: 'POST', headers: { Cookie: browegCookie } }); }
      catch (e) { /* egal — lokal vergessen reicht */ }
    }
    browegCookie = ''; browegBenutzer = '';
    return json(res, 200, { angemeldet: false });
  }

  if (p === '/api/broweg/ruf') {
    const pfad = url.searchParams.get('pfad') || '';
    if (!ERLAUBT.some((r) => r.test(pfad))) return json(res, 400, { fehler: 'Pfad nicht freigegeben: ' + pfad });
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) return json(res, 405, { fehler: 'Methode nicht erlaubt' });

    const kopf = { Accept: 'application/json' };
    if (browegCookie) kopf.Cookie = browegCookie;
    let text = null;
    if (req.method === 'POST') { text = await koerper(req); kopf['Content-Type'] = 'application/json'; }

    try {
      const antwort = await fetch(browegZiel(pfad), { method: req.method, headers: kopf, body: text });
      const roh = await antwort.text();
      if (antwort.status === 401) { browegCookie = ''; browegBenutzer = ''; }
      res.writeHead(antwort.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(roh || '{}');
    } catch (e) {
      return json(res, 502, { fehler: 'Kein Kontakt zu ' + browegBasis + ' (' + e.message + ')' });
    }
  }

  return json(res, 404, { fehler: 'unbekannter Endpunkt' });
}

/* ----------------------------------------------------------- Server --- */

function json(res, code, daten) {
  const text = JSON.stringify(daten);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

/* Stücke sammeln und EINMAL zusammensetzen. Das frühere `s += c` machte aus
   einer 200-MB-Tafel während des Empfangs ein Vielfaches an Zeichenketten. */
function koerper(req) {
  return new Promise((ok, fehler) => {
    const teile = [];
    let laenge = 0;
    req.on('data', (c) => {
      laenge += c.length;
      if (laenge > MAX_TAFEL) { fehler(new Error('zu groß (' + laenge + ' Bytes)')); req.destroy(); return; }
      teile.push(c);
    });
    req.on('end', () => ok(Buffer.concat(teile).toString('utf8')));
    req.on('error', fehler);
  });
}

async function api(req, res, url) {
  const p = url.pathname;

  if (p === '/api/broweg' || p.startsWith('/api/broweg/')) return await browegApi(req, res, url);

  if (p === '/api/bibliothek' && req.method === 'GET') {
    return json(res, 200, await ordnerStatus());
  }

  if (p === '/api/bibliothek' && req.method === 'POST') {
    let daten;
    try { daten = JSON.parse(await koerper(req)); } catch (e) { return json(res, 400, { fehler: 'ungültige Anfrage' }); }
    const neu = typeof daten.ordner === 'string' ? daten.ordner.trim() : '';
    if (!neu) return json(res, 400, { fehler: 'kein Ordner angegeben' });
    const ziel = resolve(neu);
    if (daten.anlegen) {
      try { await mkdir(ziel, { recursive: true }); } catch (e) { return json(res, 400, { fehler: 'Ordner ließ sich nicht anlegen: ' + e.message }); }
    }
    try {
      const s = await stat(ziel);
      if (!s.isDirectory()) return json(res, 400, { fehler: 'Das ist kein Ordner' });
    } catch (e) {
      return json(res, 404, { fehler: 'Ordner nicht gefunden: ' + ziel });
    }
    ordner = ziel;
    await speichereConfig();
    return json(res, 200, await ordnerStatus());
  }

  if (p === '/api/bibliothek/liste' && req.method === 'GET') {
    return json(res, 200, { ...(await ordnerStatus()), projekte: await liste() });
  }

  if (p === '/api/bibliothek/datei') {
    const ziel = sicherePfad(url.searchParams.get('name'));
    if (!ziel) return json(res, 400, { fehler: 'unzulässiger Name' });

    if (req.method === 'GET') {
      try {
        const text = await readFile(ziel, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(text);
      } catch (e) { return json(res, 404, { fehler: 'Datei nicht gefunden' }); }
    }

    if (req.method === 'PUT') {
      const text = await koerper(req);
      try {
        /* Kleine Tafeln werden ganz geprüft. Bei großen (eingebettete Medien)
           kostet das Parsen ein zweites Mal denselben Speicher — dort reicht
           die Klammerprobe, um Abbruchmüll abzufangen. */
        if (text.length <= 8 * 1024 * 1024) JSON.parse(text);
        else if (!/^\s*\{/.test(text) || !/\}\s*$/.test(text)) throw new Error('kein vollständiges JSON');
        await mkdir(dirname(ziel), { recursive: true });
        await writeFile(ziel, text, 'utf8');
        const s = await stat(ziel);
        return json(res, 200, { ok: true, groesse: s.size, geaendert: s.mtimeMs });
      } catch (e) { return json(res, 400, { fehler: 'Schreiben fehlgeschlagen: ' + e.message }); }
    }

    if (req.method === 'DELETE') {
      try { await unlink(ziel); return json(res, 200, { ok: true }); }
      catch (e) { return json(res, 400, { fehler: 'Löschen fehlgeschlagen: ' + e.message }); }
    }

  }

  return json(res, 404, { fehler: 'unbekannter Endpunkt' });
}

await ladeConfig();
await ladeBroweg();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    // Auch unter einem Unterpfad erreichbar (/gamedesk/api/…), damit GameDesk
    // und andere Seiten aus derselben Herkunft laufen können.
    const treffer = /(\/api\/.*)$/.exec(url.pathname);
    if (treffer) {
      url.pathname = treffer[1];
      return await api(req, res, url);
    }

    let pfad = decodeURIComponent(url.pathname);
    if (pfad.endsWith('/')) pfad += 'index.html';

    const ziel = join(ROOT, normalize(pfad).replace(/^([/\\])+/, ''));
    if (!ziel.startsWith(ROOT)) { res.writeHead(403).end('verboten'); return; }

    const s = await stat(ziel);
    if (s.isDirectory()) { res.writeHead(404).end('nicht gefunden'); return; }

    const daten = await readFile(ziel);
    res.writeHead(200, {
      'Content-Type': TYPEN[extname(ziel).toLowerCase()] || 'application/octet-stream',
      'Content-Length': daten.length,
      'Cache-Control': 'no-store'
    });
    res.end(daten);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500).end(String(err.message || err));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('GameDesk läuft auf http://localhost:' + PORT);
  console.log('Projektordner: ' + ordner);
  console.log('Broweg-Brücke:  ' + browegBasis + ' (Anmeldung nur im Speicher)');
});
