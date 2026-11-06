#!/usr/bin/env node
/*
 * Physik-Vergleich für Flying Bro: planck, matter-js, rapier2d.
 *
 *   node werkzeug/physik-messung/messen.mjs [--ordner <pfad>] [--drossel 1,4] [--sekunden 6]
 *        [--wiederholungen 3] [--json <datei>]
 *
 * Was es tut, in dieser Reihenfolge:
 *   1. Legt im Arbeitsordner (Vorgabe: ~/brauweg-physik-messung) die drei
 *      Bibliotheken samt esbuild an — mit FESTEN Versionen, damit eine
 *      Wiederholung dieselben Bytes misst. Bewusst AUSSERHALB des Repos: Die
 *      Spezifikation entscheidet erst, welche Bibliothek in den Client kommt;
 *      ein Eintrag in packages/client/package.json wäre diese Entscheidung.
 *   2. Bündelgröße je Bibliothek: einmal alles (`export *`), einmal nur das,
 *      was der Adapter benutzt (Tree-Shaking), jeweils minifiziert und mit
 *      gzip — gzip, weil der Server so ausliefert und die App-Größe im Store
 *      ebenfalls komprimiert gerechnet wird.
 *   3. Je Bibliothek eine Seite (buehne.js + Adapter), ausgeliefert über einen
 *      kleinen HTTP-Server auf 127.0.0.1.
 *   4. Chrome/Edge kopflos, je Drosselstufe und Bibliothek ein frischer Tab:
 *      Ansicht 390 × 844 bei Pixeldichte 3 (ein aktuelles iPhone), Touch an,
 *      CPU-Drossel über CDP. Stufe 4 steht für ein Mittelklasse-Handy — eine
 *      Annahme, keine Messung an einem Gerät; die Zahlen sind Vergleichswerte
 *      UNTEREINANDER, nicht die Bildrate auf einem echten iPhone.
 *
 * Kein Playwright: Node 24 hat WebSocket eingebaut, mehr braucht CDP nicht.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const HIER = dirname(fileURLToPath(import.meta.url));

/** Feste Versionen — Stand der Messung vom 06.11.2026. */
const PAKETE = {
  planck: '1.5.1',
  'matter-js': '0.20.0',
  '@dimforge/rapier2d-compat': '0.21.0',
  '@dimforge/rapier2d': '0.21.0',
  '@dimforge/rapier2d-deterministic-compat': '0.21.0',
  esbuild: '0.28.2',
};

const BIBLIOTHEKEN = [
  { kennung: 'planck', paket: 'planck', adapter: 'planck.js' },
  { kennung: 'matter-js', paket: 'matter-js', adapter: 'matter.js' },
  { kennung: 'rapier2d-compat', paket: '@dimforge/rapier2d-compat', adapter: 'rapier.js' },
];

const BROWSER = [
  process.env.BROWEG_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function argumente() {
  const a = process.argv.slice(2);
  const wert = (name, vorgabe) => {
    const i = a.indexOf(`--${name}`);
    return i >= 0 ? a[i + 1] : vorgabe;
  };
  return {
    ordner: wert('ordner', join(homedir(), 'brauweg-physik-messung')),
    drossel: wert('drossel', '1,4').split(',').map(Number),
    sekunden: Number(wert('sekunden', '6')),
    json: wert('json', null),
    wiederholungen: Number(wert('wiederholungen', '3')),
  };
}

// ---------------------------------------------------------------------------
// 1. Arbeitsordner
// ---------------------------------------------------------------------------

function arbeitsordner(ordner) {
  mkdirSync(ordner, { recursive: true });
  const fehlt = Object.entries(PAKETE).filter(([name, version]) => {
    const pj = join(ordner, 'node_modules', name, 'package.json');
    return !existsSync(pj) || JSON.parse(readFileSync(pj, 'utf8')).version !== version;
  });
  if (fehlt.length === 0) return;
  if (!existsSync(join(ordner, 'package.json'))) {
    writeFileSync(join(ordner, 'package.json'), JSON.stringify({ name: 'physik-messung', private: true }, null, 2));
  }
  console.error(`Installiere in ${ordner}: ${fehlt.map(([n, v]) => `${n}@${v}`).join(' ')}`);
  execSync(`npm install --no-audit --no-fund ${fehlt.map(([n, v]) => `${n}@${v}`).join(' ')}`, {
    cwd: ordner,
    stdio: 'inherit',
  });
}

// ---------------------------------------------------------------------------
// 2. Bündeln und Größen
// ---------------------------------------------------------------------------

async function buendeln(ordner, inhalt, format = 'iife') {
  const esbuild = await import(pathToFileURL(join(ordner, 'node_modules', 'esbuild', 'lib', 'main.js')).href);
  const r = await esbuild.build({
    stdin: { contents: inhalt, resolveDir: HIER, loader: 'js' },
    nodePaths: [join(ordner, 'node_modules')],
    bundle: true,
    minify: true,
    write: false,
    format,
    target: 'es2020',
    logLevel: 'silent',
  });
  return Buffer.from(r.outputFiles[0].contents);
}

const kb = (n) => Math.round(n / 102.4) / 10;

async function groessen(ordner) {
  const ergebnis = {};
  for (const b of BIBLIOTHEKEN) {
    const voll = await buendeln(ordner, `export * from '${b.paket}';`, 'esm');
    // „Genutzt" = nur der Adapter, ohne Bühne: was das Spiel mindestens mitbringt.
    const genutzt = await buendeln(
      ordner,
      `import a from './${b.adapter}'; globalThis.__a = a;`,
      'iife',
    );
    ergebnis[b.kennung] = {
      vollKb: kb(voll.length),
      vollGzipKb: kb(gzipSync(voll, { level: 9 }).length),
      genutztKb: kb(genutzt.length),
      genutztGzipKb: kb(gzipSync(genutzt, { level: 9 }).length),
    };
  }
  // Rapier ohne compat: getrennte .wasm-Datei plus Klebecode. Nur als Zahl —
  // gemessen wird die compat-Ausgabe, weil sie ohne Vite-WASM-Plugin läuft.
  const wasmOrdner = join(ordner, 'node_modules', '@dimforge', 'rapier2d');
  const wasm = readdirSync(wasmOrdner).find((d) => d.endsWith('.wasm'));
  if (wasm) {
    const roh = readFileSync(join(wasmOrdner, wasm));
    ergebnis['rapier2d (.wasm getrennt)'] = {
      wasmKb: kb(roh.length),
      wasmGzipKb: kb(gzipSync(roh, { level: 9 }).length),
    };
  }
  // Die deterministische Ausgabe rechnet auf jedem Gerät bitgleich (laut
  // Hersteller) — Voraussetzung, falls der Server einen Schuss je nachrechnen
  // soll. Nur die Größe: Die API ist dieselbe wie bei compat.
  const det = await buendeln(ordner, `export * from '@dimforge/rapier2d-deterministic-compat';`, 'esm');
  ergebnis['rapier2d-deterministic-compat'] = {
    vollKb: kb(det.length),
    vollGzipKb: kb(gzipSync(det, { level: 9 }).length),
    genutztKb: '—',
    genutztGzipKb: '—',
  };
  return ergebnis;
}

// ---------------------------------------------------------------------------
// 3. Seiten und Server
// ---------------------------------------------------------------------------

async function seiten(ordner) {
  const dateien = new Map();
  for (const b of BIBLIOTHEKEN) {
    const js = await buendeln(
      ordner,
      `import { bereitstellen } from './buehne.js'; import a from './${b.adapter}'; bereitstellen(a);`,
    );
    dateien.set(`/${b.kennung}.js`, { typ: 'text/javascript', inhalt: js });
    dateien.set(
      `/${b.kennung}.html`,
      {
        typ: 'text/html; charset=utf-8',
        inhalt: Buffer.from(
          `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">` +
            `<style>html,body{margin:0;overflow:hidden;background:#000}canvas{display:block}</style>` +
            `<canvas id="leinwand"></canvas><script src="/${b.kennung}.js"></script>`,
        ),
      },
    );
  }
  return dateien;
}

function server(dateien) {
  return new Promise((fertig) => {
    const s = createServer((anfrage, antwort) => {
      const d = dateien.get(anfrage.url.split('?')[0]);
      if (!d) {
        antwort.writeHead(404).end();
        return;
      }
      antwort.writeHead(200, { 'content-type': d.typ, 'cache-control': 'no-store' }).end(d.inhalt);
    });
    s.listen(0, '127.0.0.1', () => fertig(s));
  });
}

// ---------------------------------------------------------------------------
// 4. Browser über CDP
// ---------------------------------------------------------------------------

async function browserStarten() {
  const programm = BROWSER.find((p) => existsSync(p));
  if (!programm) throw new Error('Kein Chrome/Edge gefunden — BROWEG_BROWSER setzen.');
  const profil = mkdtempSync(join(tmpdir(), 'physik-profil-'));
  const prozess = spawn(
    programm,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profil}`,
      '--no-first-run',
      '--no-default-browser-check',
      // Ohne diese drei drosselt Chrome Zeitgeber und rAF eines Tabs, den es
      // für unsichtbar hält — gemessen würde dann die Drossel, nicht die Physik.
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portDatei = join(profil, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portDatei); i++) await new Promise((r) => setTimeout(r, 100));
  const port = readFileSync(portDatei, 'utf8').split('\n')[0].trim();
  return {
    port,
    programm,
    beenden() {
      prozess.kill();
      try {
        rmSync(profil, { recursive: true, force: true });
      } catch {
        /* Windows hält das Profil manchmal noch kurz fest — es liegt im Temp. */
      }
    },
  };
}

async function tab(port) {
  const info = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((r, f) => {
    ws.onopen = r;
    ws.onerror = f;
  });
  let n = 0;
  const offen = new Map();
  const horcher = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && offen.has(m.id)) {
      const { r, f } = offen.get(m.id);
      offen.delete(m.id);
      if (m.error) f(new Error(m.error.message));
      else r(m.result);
    } else if (m.method) {
      for (const h of horcher) h(m);
    }
  };
  const senden = (method, params = {}) =>
    new Promise((r, f) => {
      const id = ++n;
      offen.set(id, { r, f });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return {
    senden,
    warteAuf: (method) => new Promise((r) => horcher.push((m) => m.method === method && r(m.params))),
    async schliessen() {
      ws.close();
      await fetch(`http://127.0.0.1:${port}/json/close/${info.id}`).catch(() => {});
    },
  };
}

async function messeSeite(port, adresse, drossel, sekunden) {
  const t = await tab(port);
  try {
    await t.senden('Page.enable');
    await t.senden('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await t.senden('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await t.senden('Emulation.setFocusEmulationEnabled', { enabled: true });
    await t.senden('Emulation.setCPUThrottlingRate', { rate: drossel });
    const geladen = t.warteAuf('Page.loadEventFired');
    await t.senden('Page.navigate', { url: adresse });
    await geladen;
    const r = await t.senden('Runtime.evaluate', {
      expression: `(async () => { while (!window.bereit) await new Promise(r => setTimeout(r, 20)); return await window.messen({ sekunden: ${sekunden} }); })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  } finally {
    await t.schliessen();
  }
}

// ---------------------------------------------------------------------------
// Wiederholungen zusammenfassen
// ---------------------------------------------------------------------------

function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Zeiten schwanken von Lauf zu Lauf (JIT, Drossel in Zeitscheiben), also
 * zählt der Median. Das Physik-ERGEBNIS dagegen darf nicht schwanken: Gleiche
 * Szene, gleiche Schritte, gleicher Browser muss dieselben Lagen liefern.
 * Tut es das nicht, kann man einen Schuss weder wiederholen noch auf dem
 * Server nachrechnen — deshalb steht der Vergleich mit in der Tabelle.
 */
function zusammenfassen(laeufe) {
  const erster = laeufe[0];
  const ergebnisGleich = laeufe.every(
    (l) => JSON.stringify([l.ruhe, l.schuss]) === JSON.stringify([erster.ruhe, erster.schuss]),
  );
  const m = (f) => median(laeufe.map(f));
  return {
    ...erster,
    laeufe: laeufe.length,
    ergebnisGleich,
    initMs: m((l) => l.initMs),
    schritt: {
      mittelMs: m((l) => l.schritt.mittelMs),
      p95Ms: m((l) => l.schritt.p95Ms),
      maxMs: m((l) => l.schritt.maxMs),
    },
    bild: Object.fromEntries(
      Object.entries(erster.bild).map(([k, v]) => [k, typeof v === 'number' ? m((l) => l.bild[k]) : v]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

function tabelle(ergebnis) {
  const z = [];
  z.push('Bündelgröße (minifiziert, KB; gzip -9)');
  z.push('| Bibliothek | alles | alles gzip | genutzt | genutzt gzip |');
  z.push('| --- | ---: | ---: | ---: | ---: |');
  for (const [name, g] of Object.entries(ergebnis.groessen)) {
    if (g.wasmKb) z.push(`| ${name} | .wasm ${g.wasmKb} | ${g.wasmGzipKb} | | |`);
    else z.push(`| ${name} | ${g.vollKb} | ${g.vollGzipKb} | ${g.genutztKb} | ${g.genutztGzipKb} |`);
  }
  z.push('');
  z.push('Stabilität (hängt nicht an der Drossel — gleiche Schritte, gleiche Lagen)');
  z.push('| Bibliothek | Ruhe: Versatz Turm / Pyramide / Gerüst (cm) | gekippt | schläft nach s | Schuss: bewegt | Turm | schläft nach s | durchgefallen | gleich in allen Läufen |');
  z.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const m of ergebnis.messungen.filter((x) => x.drossel === ergebnis.messungen[0].drossel)) {
    const v = m.ruhe.versatzJeBauformM;
    const cm = (x) => Math.round(x * 1000) / 10;
    z.push(
      `| ${m.bibliothek} | ${cm(v.turm)} / ${cm(v.pyramide)} / ${cm(v.geruest)} | ${m.ruhe.gekippt} | ${m.ruhe.schlaeftNachS ?? '—'} | ${m.schuss.bewegt}/29 | ${m.schuss.turmBewegt}/8 | ${m.schuss.schlaeftNachS ?? 'nicht in 8 s'} | ${m.schuss.durchgefallen} | ${m.ergebnisGleich ? 'ja' : 'NEIN'} |`,
    );
  }
  z.push('');
  z.push(`Zeiten (Median aus ${ergebnis.messungen[0].laeufe} Läufen; Arbeit je Bild = Physik + Zeichnen auf 1170×2532 px)`);
  z.push('| Drossel | Bibliothek | Start ms | Schritt Ø ms | Schritt p95 ms | Arbeit je Bild p95 ms | Arbeit max ms | Bilder/s (ungebremst) | Ruckelanteil >20 ms |');
  z.push('| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const m of ergebnis.messungen) {
    z.push(
      `| ${m.drossel}× | ${m.bibliothek} | ${m.initMs} | ${m.schritt.mittelMs} | ${m.schritt.p95Ms} | ${m.bild.arbeitJeBildP95Ms} | ${m.bild.arbeitJeBildMaxMs} | ${m.bild.bilderJeS} | ${m.bild.ruckelAnteil} |`,
    );
  }
  return z.join('\n');
}

async function main() {
  const opt = argumente();
  arbeitsordner(opt.ordner);
  const g = await groessen(opt.ordner);
  const dateien = await seiten(opt.ordner);
  const s = await server(dateien);
  const adresse = `http://127.0.0.1:${s.address().port}`;
  const b = await browserStarten();
  const messungen = [];
  try {
    for (const drossel of opt.drossel) {
      for (const bib of BIBLIOTHEKEN) {
        console.error(`messe ${bib.kennung} bei Drossel ${drossel}× …`);
        const laeufe = [];
        for (let i = 0; i < opt.wiederholungen; i++) {
          laeufe.push(await messeSeite(b.port, `${adresse}/${bib.kennung}.html`, drossel, opt.sekunden));
        }
        messungen.push({ drossel, ...zusammenfassen(laeufe) });
      }
    }
  } finally {
    b.beenden();
    s.close();
  }
  const ergebnis = {
    datum: new Date().toISOString(),
    browser: b.programm,
    node: process.version,
    pakete: PAKETE,
    groessen: g,
    messungen,
  };
  if (opt.json) writeFileSync(opt.json, JSON.stringify(ergebnis, null, 2));
  console.log(tabelle(ergebnis));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
