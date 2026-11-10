/**
 * Filler: neuer Bot gegen bisherigen Bot, gepaart auf denselben Saaten.
 *
 *     npm run build --workspace @brauweg/game-filler
 *     node packages/game-filler/werkzeug/bot-duell.mjs --alt <ordner> [--neu <ordner>] [--klar 0] [--build 200] [--extreme 200] [--start 0] [--faeden 15]
 *
 * `--start` verschiebt die Saaten (Partie i spielt auf saatHex(i), i = start
 * .. start+n-1) — fuer eine Bestaetigung auf Saaten, an denen nicht
 * eingestellt wurde. Der p-Wert ist der exakte zweiseitige Vorzeichentest
 * auf Siegen neu gegen alt (Remis fallen heraus).
 *
 * `--alt` zeigt auf eine KOPIE von `dist/src` eines frueheren Stands (vor dem
 * Umbau angelegt: `cp -r dist/src <ordner>`). Gespielt wird mit Regeln und
 * Zustand des AKTUELLEN Stands — nur `botZug` kommt je Sitz aus der einen
 * oder der anderen Kopie. Jede Saat zweimal: neu auf Sitz 0 gegen alt auf
 * Sitz 1, dann umgekehrt. So hebt sich der Anzugsvorteil heraus, und 50 %
 * heisst "gleich stark".
 *
 * Warum ein eigenes Skript neben simulation.mjs: Das misst Bot gegen SICH
 * SELBST (Mauern je Partie, Siegquote Sitz 0) — ob ein geaenderter Bot
 * besser spielt, sagt es nicht. Ein Bot, der viel mauert und dabei verliert,
 * saehe dort genauso gut aus wie einer, der gewinnt.
 */

import { dirname, resolve } from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const hier = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const schalter = (name, vorgabe) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return vorgabe;
  return typeof vorgabe === 'number' ? Number(argv[i + 1]) : argv[i + 1];
};

/** Dieselbe Saatfolge wie simulation.mjs (`saatHex`) — Index i ist dort dieselbe Partie. */
function saatHex(i) {
  let a = (0x9e3779b9 ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0;
  const wort = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0).toString(16).padStart(8, '0');
  };
  return wort() + wort() + wort() + wort();
}

if (isMainThread) {
  const alt = schalter('alt', null);
  if (!alt) {
    console.error('--alt <ordner> fehlt (Kopie von dist/src des frueheren Stands)');
    process.exit(2);
  }
  const anzahl = { klar: schalter('klar', 0), build: schalter('build', 200), extreme: schalter('extreme', 200) };
  const start = schalter('start', 0);
  const faeden = schalter('faeden', Math.max(1, os.cpus().length - 1));
  const auftraege = [];
  for (const [variante, n] of Object.entries(anzahl)) {
    for (let i = start; i < start + n; i++) auftraege.push({ variante, i });
  }
  const ergebnisse = [];
  let naechster = 0;
  await Promise.all(
    Array.from({ length: faeden }, () =>
      new Promise((fertig, fehler) => {
        const w = new Worker(fileURLToPath(import.meta.url), {
          workerData: { alt: resolve(alt), neu: resolve(schalter('neu', resolve(hier, '..', 'dist', 'src'))) },
        });
        const gib = () => {
          if (naechster >= auftraege.length) return void w.postMessage(null);
          w.postMessage(auftraege[naechster++]);
        };
        w.on('message', (m) => {
          if (m !== 'bereit') ergebnisse.push(m);
          gib();
        });
        w.on('error', fehler);
        w.on('exit', fertig);
      }),
    ),
  );
  /** Exakter zweiseitiger Binomialtest gegen 1/2: k Erfolge aus n. */
  const vorzeichenP = (k, n) => {
    if (n === 0) return 1;
    const logC = [];
    // log C(n, i) fortlaufend, damit auch n = 400 nicht ueberlaeuft
    logC[0] = 0;
    for (let i = 1; i <= n; i++) logC[i] = logC[i - 1] + Math.log(n - i + 1) - Math.log(i);
    const m = Math.max(k, n - k);
    let summe = 0;
    for (let i = m; i <= n; i++) summe += Math.exp(logC[i] - n * Math.LN2);
    return Math.min(1, 2 * summe);
  };
  console.log(`Saaten ${start} bis ${start + Math.max(...Object.values(anzahl)) - 1}\n`);
  console.log('| Spielart | Partien | Siege neu | Siege alt | remis | p (Vorzeichentest) | Punkte neu/alt | Mauern je Partie neu/alt |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const variante of Object.keys(anzahl)) {
    const rs = ergebnisse.filter((r) => r.variante === variante);
    if (rs.length === 0) continue;
    const s = { neu: 0, alt: 0, remis: 0, pNeu: 0, pAlt: 0, mNeu: 0, mAlt: 0 };
    for (const r of rs) {
      for (const p of r.partien) {
        if (p.sieger === null) s.remis++;
        else if (p.sieger === p.neuSitz) s.neu++;
        else s.alt++;
        s.pNeu += p.punkte[p.neuSitz];
        s.pAlt += p.punkte[1 - p.neuSitz];
        s.mNeu += p.mauern[p.neuSitz];
        s.mAlt += p.mauern[1 - p.neuSitz];
      }
    }
    const n = rs.length * 2;
    const q = (x) => `${((100 * x) / n).toFixed(1)} %`;
    console.log(
      `| ${variante} | ${n} | ${q(s.neu)} | ${q(s.alt)} | ${q(s.remis)} | ${vorzeichenP(s.neu, s.neu + s.alt).toFixed(3)} | ${(s.pNeu / n).toFixed(1)} / ${(s.pAlt / n).toFixed(1)} | ${(s.mNeu / n).toFixed(2)} / ${(s.mAlt / n).toFixed(2)} |`,
    );
  }
} else {
  const laden = (ordner, datei) => import(pathToFileURL(resolve(ordner, datei)).href);
  const P = await laden(workerData.neu, 'partie.js');
  const R = await laden(workerData.neu, 'regeln.js');
  const S = await laden(workerData.neu, 'sicht.js');
  const neu = (await laden(workerData.neu, 'bot.js')).botZug;
  const alt = (await laden(workerData.alt, 'bot.js')).botZug;
  const spiele = (variante, i, neuSitz) => {
    let p = P.erstellePartie({ ...R.DEFAULT_REGELN, variante }, [0, 1], saatHex(i));
    const mauern = [0, 0];
    let schritte = 0;
    while (!p.fertig) {
      if (++schritte > 400) throw new Error(`${variante}:${i} endet nicht`);
      const s = p.dran;
      const zug = (s === neuSitz ? neu : alt)(S.sichtFuer(p, s));
      if (zug.typ === 'barriere') mauern[s]++;
      p = P.fuehreAus(p, s, zug);
    }
    return { neuSitz, sieger: P.sieger(p), punkte: [p.punkte[0], p.punkte[1]], mauern };
  };
  parentPort.on('message', (a) => {
    if (a === null) return void process.exit(0);
    parentPort.postMessage({ variante: a.variante, partien: [spiele(a.variante, a.i, 0), spiele(a.variante, a.i, 1)] });
  });
  parentPort.postMessage('bereit');
}
