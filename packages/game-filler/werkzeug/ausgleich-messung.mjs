/**
 * Filler: Bot gegen Bot mit einem bestimmten Ausgleich fuer Sitz 1 — und
 * dieselben Partien mit anderen Punktzuschlaegen, aus den Punktdifferenzen.
 *
 *     npm run build      (im Wurzelverzeichnis)
 *     node packages/game-filler/werkzeug/ausgleich-messung.mjs --variante extreme --mauern 2
 *     node packages/game-filler/werkzeug/ausgleich-messung.mjs --variante klar
 *
 * Schalter:
 *     --variante klar|build|extreme   (Pflicht)
 *     --mauern k     Mauerzuschlag fuer Sitz 1 (`barrierenZuschlagSitz1`).
 *                    Fehlt er, gilt die Vorgabe (`AUSGLEICH_JE_SPIELART`).
 *     --punkte k     Punktzuschlag fuer Sitz 1 (`punkteZuschlagSitz1`).
 *                    Fehlt er, gilt die Vorgabe.
 *     --n 1000 --start 1000   Partie i spielt auf saatHex(i), i = start .. start+n-1.
 *     --faeden 15    Arbeitsfaeden (Vorgabe: Kerne - 1).
 *     --json         Rohe Zahlen statt Tabelle.
 *
 * Warum es diesen Laeufer neben simulation.mjs gibt (Zweitleser, 06.11.2026):
 * simulation.mjs spielt immer die Vorgabe. Fuer "Extreme mit +2 Mauern" vor
 * der Umstellung und fuer Punktzuschlaege, die es noch nicht als Regel gab,
 * brauchte es einen eigenen Lauf — und solange der nicht im Repo lag, liessen
 * sich die Zahlen der Messdatei nicht nachpruefen.
 *
 * WARUM PUNKTZUSCHLAEGE OHNE EIGENE PARTIEN: Der Bot liest keine Punkte
 * (bot.ts), ein Punktzuschlag aendert also keinen Zug, nur die Wertung am
 * Ende. Die Tabelle "aus den Punktdifferenzen" rechnet deshalb aus
 * `punkte[0] - punkte[1]` jeder Partie, wie sie mit 0..5 Punkten fuer Sitz 1
 * ausgegangen waere. Zur Probe zaehlt der Laeufer daneben, was das Modul
 * selbst wertet (`sieger`); fuer den eingestellten Zuschlag muessen beide
 * Zeilen gleich sein, sonst bricht er ab.
 *
 * Die Saatfolge ist dieselbe wie in simulation.mjs, anzug.mjs und
 * bot-duell.mjs (`saatHex`, hier abgeschrieben, weil simulation.mjs beim
 * Import seine eigene Messung startet).
 */

import { existsSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const hier = dirname(fileURLToPath(import.meta.url));
const dist = resolve(hier, '..', 'dist', 'src');
if (!existsSync(resolve(dist, 'partie.js'))) {
  console.error('dist fehlt. Erst im Wurzelverzeichnis bauen: npm run build');
  process.exit(2);
}
const laden = (datei) => import(pathToFileURL(resolve(dist, datei)).href);

/** Feste 128-Bit-Hexkette je Index — wortgleich mit simulation.mjs. */
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

/** Der Regelsatz des Laufs: Vorgabe, darin der Eintrag der Spielart ueberschrieben. */
function regelnFuer(R, variante, mauern, punkte) {
  const eintrag = { ...(R.DEFAULT_REGELN.ausgleichJeSpielart?.[variante] ?? {}) };
  if (mauern !== null) eintrag.barrierenZuschlagSitz1 = mauern;
  if (punkte !== null) eintrag.punkteZuschlagSitz1 = punkte;
  return {
    ...R.DEFAULT_REGELN,
    variante,
    ausgleichJeSpielart: { ...R.DEFAULT_REGELN.ausgleichJeSpielart, [variante]: eintrag },
  };
}

if (!isMainThread) {
  const P = await laden('partie.js');
  const R = await laden('regeln.js');
  const { sichtFuer } = await laden('sicht.js');
  const { botZug } = await laden('bot.js');
  const { variante, mauern, punkte, von, bis } = workerData;
  const regeln = regelnFuer(R, variante, mauern, punkte);
  const raus = [];
  for (let i = von; i < bis; i++) {
    let p = P.erstellePartie(regeln, [0, 1], saatHex(i));
    let n = 0;
    while (!p.fertig && n++ < 800) p = P.fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
    if (!p.fertig) throw new Error(`Partie ${i} nach ${n} Zuegen nicht fertig`);
    raus.push({
      i,
      p0: p.punkte[0] ?? 0,
      p1: p.punkte[1] ?? 0,
      sieger: P.sieger(p),
      zuege: p.zug,
      mauernSitz1: p.regeln.barrierenZuschlagSitz1 ?? 0,
      punkteSitz1: p.regeln.punkteZuschlagSitz1 ?? 0,
    });
  }
  parentPort.postMessage(raus);
} else {
  const argv = process.argv.slice(2);
  const schalter = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i < 0 ? null : argv[i + 1];
  };
  const zahl = (name, vorgabe) => (schalter(name) === null ? vorgabe : Number(schalter(name)));
  const variante = schalter('variante');
  if (!['klar', 'build', 'extreme'].includes(variante)) {
    console.error('--variante klar|build|extreme fehlt');
    process.exit(2);
  }
  const mauern = zahl('mauern', null);
  const punkte = zahl('punkte', null);
  const N = zahl('n', 1000);
  const START = zahl('start', 1000);
  const FAEDEN = Math.max(1, zahl('faeden', os.cpus().length - 1));

  const teile = [];
  const stueck = Math.max(5, Math.ceil(N / (FAEDEN * 4)));
  for (let von = START; von < START + N; von += stueck) teile.push({ von, bis: Math.min(START + N, von + stueck) });
  const t0 = Date.now();
  let naechster = 0;
  let fertig = 0;
  const ergebnisse = [];
  await Promise.all(
    Array.from({ length: FAEDEN }, async () => {
      while (naechster < teile.length) {
        const t = teile[naechster++];
        const r = await new Promise((ok, fehler) => {
          const w = new Worker(fileURLToPath(import.meta.url), {
            workerData: { variante, mauern, punkte, ...t },
          });
          w.once('message', ok);
          w.once('error', fehler);
        });
        ergebnisse.push(...r);
        fertig++;
        process.stderr.write(`\r${fertig}/${teile.length} Teile, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }),
  );
  process.stderr.write('\n');
  ergebnisse.sort((a, b) => a.i - b.i);

  const n = ergebnisse.length;
  const anteil = (k) => ({ wert: (100 * k) / n, se: 100 * Math.sqrt((k / n) * (1 - k / n) / n) });
  const zaehle = (urteil) => {
    const z = { s0: 0, s1: 0, remis: 0 };
    for (const e of ergebnisse) z[urteil(e)]++;
    return { s0: anteil(z.s0), s1: anteil(z.s1), remis: anteil(z.remis) };
  };
  const mauernIst = ergebnisse[0].mauernSitz1;
  const punkteIst = ergebnisse[0].punkteSitz1;
  const modul = zaehle((e) => (e.sieger === 0 ? 's0' : e.sieger === 1 ? 's1' : 'remis'));
  const ausDifferenz = [0, 1, 2, 3, 4, 5].map((k) => ({
    punkte: k,
    ...zaehle((e) => {
      const d = e.p0 - e.p1 - k;
      return d > 0 ? 's0' : d < 0 ? 's1' : 'remis';
    }),
  }));
  // Probe: Die Wertung des Moduls muss der Rechnung fuer den eingestellten Zuschlag gleichen.
  for (const e of ergebnisse) {
    const d = e.p0 - e.p1 - punkteIst;
    const erwartet = d > 0 ? 0 : d < 0 ? 1 : null;
    if (e.sieger !== erwartet) {
      console.error(`Probe verfehlt: Partie ${e.i}, Punkte ${e.p0}:${e.p1}, Zuschlag ${punkteIst}, Modul ${e.sieger}`);
      process.exit(1);
    }
  }
  const mittel = (f) => ergebnisse.reduce((s, e) => s + f(e), 0) / n;
  const bericht = {
    variante,
    n,
    start: START,
    mauernZuschlagSitz1: mauernIst,
    punkteZuschlagSitz1: punkteIst,
    modul,
    ausDifferenz,
    mittel: { p0: mittel((e) => e.p0), p1: mittel((e) => e.p1), differenz: mittel((e) => e.p0 - e.p1), zuege: mittel((e) => e.zuege) },
    sekunden: Math.round((Date.now() - t0) / 1000),
  };
  if (argv.includes('--json')) {
    console.log(JSON.stringify(bericht, null, 2));
  } else {
    const f = (x) => `${x.wert.toFixed(1).replace('.', ',')} ± ${x.se.toFixed(1).replace('.', ',')}`;
    console.log(
      `# Filler ${variante}, Saaten ${START}..${START + n - 1} (n = ${n}), Sitz 1: +${mauernIst} Mauern, +${punkteIst} Punkte\n`,
    );
    console.log(`Wertung des Moduls: Sitz 0 ${f(modul.s0)} | Sitz 1 ${f(modul.s1)} | remis ${f(modul.remis)}`);
    console.log(
      `Mittel: Punkte ${bericht.mittel.p0.toFixed(1)} : ${bericht.mittel.p1.toFixed(1)}, Differenz S0 - S1 ${bericht.mittel.differenz.toFixed(1)}, Zuege ${bericht.mittel.zuege.toFixed(1)}\n`,
    );
    console.log('Dieselben Partien mit anderem Punktzuschlag fuer Sitz 1 (aus den Punktdifferenzen):\n');
    console.log('| Punkte fuer Sitz 1 | Sitz 0 | Sitz 1 | remis |\n|---|---|---|---|');
    for (const z of ausDifferenz) console.log(`| +${z.punkte} | ${f(z.s0)} | ${f(z.s1)} | ${f(z.remis)} |`);
    console.log(`\n${bericht.sekunden} s`);
  }
}
