/**
 * Filler Extreme zu viert: vier Bots, Siegquote je Sitz.
 *
 *     npm run build --workspace @brauweg/game-filler
 *     node packages/game-filler/werkzeug/zu-viert.mjs [--partien 200] [--start 0] [--faeden 15]
 *
 * Die Grundlage fuer die Ausgleichs-Karte (Wunsch Niklas, 21.11.2026): Zu
 * zweit hat der Anzug einen Ausgleich (AUSGLEICH_JE_SPIELART), zu viert
 * spielt erst einmal jeder ohne. Diese Messung sagt, welcher Sitz wie oft
 * gewinnt, bevor jemand eine Zahl dafuer erfindet.
 *
 * Gespielt wird ueber den ADAPTER (createParty, viewFor, botAction, act) mit
 * der Vorgabe plus Spielart — genau so, wie der Server einen Vierertisch
 * fuehrte. Saaten wie bot-duell.mjs und simulation.mjs (`saatHex`).
 *
 * Ein Sieg ist Platz 1 allein. Teilen sich mehrere Platz 1, zaehlt die
 * Partie bei "geteilt" und bei jedem der Beteiligten als geteilter Sieg —
 * so summieren sich die Siege je Sitz plus "geteilt" nicht auf 100 %, aber
 * keiner bekommt einen halben Sieg zugeschrieben, den es nicht gab.
 */

import { dirname, resolve } from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

const hier = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const schalter = (name, vorgabe) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? vorgabe : Number(argv[i + 1]);
};

/** Dieselbe Saatfolge wie simulation.mjs und bot-duell.mjs. */
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

const SITZE = [0, 1, 2, 3];

if (isMainThread) {
  const partien = schalter('partien', 200);
  const start = schalter('start', 0);
  const faeden = schalter('faeden', Math.max(1, os.cpus().length - 1));
  const auftraege = Array.from({ length: partien }, (_, k) => start + k);
  const ergebnisse = [];
  let naechster = 0;
  const beginn = Date.now();
  await Promise.all(
    Array.from({ length: faeden }, () =>
      new Promise((fertig, fehler) => {
        const w = new Worker(fileURLToPath(import.meta.url));
        const gib = () => w.postMessage(naechster < auftraege.length ? auftraege[naechster++] : null);
        w.on('message', (m) => {
          if (m !== 'bereit') ergebnisse.push(m);
          gib();
        });
        w.on('error', fehler);
        w.on('exit', fertig);
      }),
    ),
  );
  const n = ergebnisse.length;
  const q = (x) => `${((100 * x) / n).toFixed(1)} %`;
  // Standardfehler eines Anteils p bei n Partien, in Prozentpunkten.
  const se = (x) => `±${(100 * Math.sqrt((x / n) * (1 - x / n) / n)).toFixed(1)}`;
  const s = SITZE.map(() => ({ allein: 0, geteilt: 0, punkte: 0, platz: 0, mauern: 0 }));
  let geteilt = 0;
  let autoEnde = 0;
  let zuege = 0;
  let langsamster = 0;
  let msSumme = 0;
  let botzuege = 0;
  for (const r of ergebnisse) {
    const erste = r.reihe.filter((e) => e.place === 1).map((e) => e.seat);
    if (erste.length > 1) geteilt++;
    for (const e of r.reihe) {
      const z = s[e.seat];
      if (e.place === 1) {
        if (erste.length === 1) z.allein++;
        else z.geteilt++;
      }
      z.punkte += e.points;
      z.platz += e.place;
      z.mauern += r.mauern[e.seat];
    }
    if (r.autoEnde) autoEnde++;
    zuege += r.zug;
    langsamster = Math.max(langsamster, r.langsamsterMs);
    msSumme += r.msSumme;
    botzuege += r.botzuege;
  }
  console.log(`Extreme zu viert, ${n} Partien, Saaten ${start} bis ${start + partien - 1}, ${((Date.now() - beginn) / 1000).toFixed(0)} s auf ${faeden} Faeden\n`);
  console.log('| Sitz | Ecke | Sieg allein | Sieg geteilt | Platz (Schnitt) | Punkte (Schnitt) | Mauern je Partie |');
  console.log('|---|---|---|---|---|---|---|');
  const ecke = ['unten links', 'oben rechts', 'oben links', 'unten rechts'];
  for (const sitz of SITZE) {
    const z = s[sitz];
    console.log(
      `| ${sitz} | ${ecke[sitz]} | ${q(z.allein)} ${se(z.allein)} | ${q(z.geteilt)} | ${(z.platz / n).toFixed(2)} | ${(z.punkte / n).toFixed(1)} | ${(z.mauern / n).toFixed(2)} |`,
    );
  }
  console.log(`\nPlatz 1 geteilt: ${q(geteilt)} · Auto-Ende: ${q(autoEnde)} · Zuege je Partie: ${(zuege / n).toFixed(1)}`);
  console.log(`Botzug: Schnitt ${(msSumme / botzuege).toFixed(1)} ms, langsamster ${langsamster.toFixed(0)} ms`);
} else {
  const { filler } = await import(pathToFileURL(resolve(hier, '..', 'dist', 'src', 'adapter.js')).href);
  const { DEFAULT_REGELN } = await import(pathToFileURL(resolve(hier, '..', 'dist', 'src', 'regeln.js')).href);
  const config = { ...DEFAULT_REGELN, variante: 'extreme' };
  const spiele = (i) => {
    let p = filler.createParty({ config, seats: 4, rounds: 1, seed: i, seedHex: saatHex(i) });
    const mauern = [0, 0, 0, 0];
    let schritte = 0;
    let langsamsterMs = 0;
    let msSumme = 0;
    while (!p.fertig) {
      if (++schritte > 1500) throw new Error(`Saat ${i} endet nicht`);
      const sitz = filler.currentActor(p);
      const vorher = performance.now();
      // Die Sicht gehoert zum Botzug: Sie rechnet die erlaubten Mauern.
      const zug = filler.botAction(filler.viewFor(p, sitz));
      const ms = performance.now() - vorher;
      langsamsterMs = Math.max(langsamsterMs, ms);
      msSumme += ms;
      if (zug.typ === 'barriere') mauern[sitz]++;
      p = filler.act(p, sitz, zug);
    }
    return {
      reihe: filler.standings(p),
      mauern,
      autoEnde: p.autoEnde !== undefined,
      zug: p.zug,
      langsamsterMs,
      msSumme,
      botzuege: schritte,
    };
  };
  parentPort.on('message', (i) => {
    if (i === null) return void process.exit(0);
    parentPort.postMessage(spiele(i));
  });
  parentPort.postMessage('bereit');
}
