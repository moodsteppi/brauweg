/**
 * Filler: Warum gewinnt Sitz 0 (zieht zuerst) oefter — und was gleicht das aus?
 *
 *     npm run build --workspace @brauweg/game-api
 *     npm run build --workspace @brauweg/game-filler
 *     node packages/game-filler/werkzeug/anzug.mjs [--n 200] [--faeden 15] [--nur klar,build,extreme] [--json]
 *
 * Frage von Niklas (06.11.2026): Bot gegen Bot gewinnt Sitz 0 in Extreme
 * 60 % zu 34,5 %, in Build und Klar 52 % zu 36 %
 * (MESSUNG-2026-11-06-bot-mauert.md). Dieses Skript misst zuerst die
 * URSACHE (Abschnitt 1) und probiert dann AUSGLEICHE als Regelvarianten
 * (Abschnitt 2) — alles auf denselben Saaten (`saatHex(i)`, dieselbe Folge
 * wie simulation.mjs und bot-duell.mjs), also gepaart.
 *
 * WAS ES NICHT TUT: Es aendert keine Spielregel und keinen Bot. Jede
 * Variante entsteht HIER, entweder ueber den Regelsatz (`config`, so wie ein
 * Tisch ihn mitschicken koennte: Brettgroesse, mauerfreie Zuege, faire
 * Ecken) oder als Eingriff in den Zustand vor bzw. waehrend der Partie
 * (Mauervorrat, Startfeld, Sterne weg, erster Zug beschnitten). Das Modul
 * spielt danach unveraendert weiter — `fuehreAus` prueft jeden Zug wie am
 * echten Tisch. Wer eine Variante als Regel will, baut sie in src/ ein und
 * misst mit simulation.mjs nach.
 *
 * WARUM PUNKTEAUSGLEICH UND TAUSCHREGEL OHNE EIGENE PARTIEN: Der Bot liest
 * keine Punkte, ein Punkteausgleich aendert also keinen einzigen Zug — nur
 * die Wertung am Ende. Er wird deshalb aus den Grundpartien gerechnet. Die
 * Tauschregel aendert ebenfalls keinen Zug (die Sitze tauschen die
 * MENSCHEN, nicht das Brett), nur welchen ersten Zug Sitz 0 waehlt — und
 * dafuer spielt der "Faecher" ohnehin jede erlaubte erste Farbe einmal durch.
 *
 * Laufzeit mit --n 200 auf 15 Faeden: rund eine Viertelstunde, fast alles
 * Extreme (eine Partie dort ~2,7 s, weil der Bot jede erlaubte Wand bewertet).
 */

import { existsSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const hier = dirname(fileURLToPath(import.meta.url));
const dist = resolve(hier, '..', 'dist', 'src');
if (!existsSync(resolve(dist, 'partie.js'))) {
  console.error(
    'dist fehlt. Erst bauen:\n  npm run build --workspace @brauweg/game-api\n  npm run build --workspace @brauweg/game-filler',
  );
  process.exit(2);
}
const laden = (datei) => import(pathToFileURL(resolve(dist, datei)).href);
const P = await laden('partie.js');
const R = await laden('regeln.js');
const S = await laden('sicht.js');
const B = await laden('bot.js');
const { erstellePartie, fuehreAus, gesperrteFarben, nachbarn, startEcke, sieger, STERN_BONUS, STERN_MAUERN } = P;
const { DEFAULT_REGELN, AUFBAU_JE_SPIELART, mitBarrieren } = R;
const { sichtFuer } = S;
const { botZug } = B;

const argv = process.argv.slice(2);
function schalter(name, vorgabe) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return vorgabe;
  return typeof vorgabe === 'number' ? Number(argv[i + 1]) : argv[i + 1];
}
const N = schalter('n', 200);
const MODI = schalter('nur', 'klar,build,extreme').split(',');
const ALS_JSON = argv.includes('--json');

/** Dieselbe Saatfolge wie simulation.mjs — Index i ist dort dieselbe Partie. */
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

// ---------------------------------------------------------------------------
// Varianten — nur hier, nie in src
// ---------------------------------------------------------------------------

/** Aufbau-Eintrag fuer ein anderes Brett; die uebrigen Zahlen bleiben die der Spielart. */
const brett = (modus, spalten, zeilen, mehr = {}) => ({
  aufbauJeSpielart: {
    ...AUFBAU_JE_SPIELART,
    [modus]: {
      ...(AUFBAU_JE_SPIELART[modus] ?? { barrieren: 10, mauernJeZug: 1, sternPaare: 0, mauerfreieZuege: 3 }),
      spalten,
      zeilen,
      ...mehr,
    },
  },
});

/** Sitz 1 bekommt n Mauern mehr in den Vorrat. */
const mauernPlus = (n) => (p) => ({
  ...p,
  barrierenUebrig: { ...p.barrierenUebrig, 1: (p.barrierenUebrig[1] ?? 0) + n },
});

/**
 * Sitz 1 startet mit zwei Feldern statt einem: Der waagrechte Nachbar seiner
 * Ecke gehoert ihm von Anfang an (in seiner Farbe), dazu alles Freie gleicher
 * Farbe, das daran haengt — sonst laege ein Feld seiner Farbe neben seinem
 * Gebiet, das er nie mehr schlucken koennte (die eigene Farbe ist gesperrt).
 */
function feldPlus(p) {
  const { spalten, zeilen } = p.regeln;
  const ecke = startEcke(1, spalten, zeilen);
  const zusatz = nachbarn(ecke, spalten, zeilen).find(
    (n) => Math.floor(n / spalten) === Math.floor(ecke / spalten),
  );
  const besitzer = [...p.besitzer];
  const feld = [...p.feld];
  const f = p.farbe[1];
  besitzer[zusatz] = 1;
  feld[zusatz] = f;
  let dazu = 1;
  const rand = [zusatz];
  while (rand.length) {
    const platz = rand.pop();
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (besitzer[n] !== null || feld[n] !== f) continue;
      besitzer[n] = 1;
      dazu++;
      rand.push(n);
    }
  }
  return { ...p, besitzer, feld, punkte: { ...p.punkte, 1: p.punkte[1] + dazu } };
}

/**
 * Die Kandidaten. `art`: 'diagnose' misst eine Hypothese (KEIN Ausgleich),
 * 'ausgleich' ist ein Regelvorschlag. `modi`: wo die Variante Sinn hat.
 *   config(modus)   — Zusatz zum Regelsatz, wie ihn ein Tisch mitschickt
 *   vorbereiten(p)  — Eingriff in den Zustand nach erstellePartie
 *   nachZug(p)      — Eingriff nach jedem Zug
 *   anfaenger       — wer zuerst zieht (Vorgabe Sitz 0)
 *   doppel          — Sitz 1 faerbt in seinem ersten Zug zweimal
 *
 * NICHT dabei, obwohl naheliegend: "Sitz 0 schluckt im ersten Zug weniger".
 * Kein Brett hat zwei gleichfarbige Nachbarn (baueBrett), also bringt JEDER
 * Farbzug genau die angrenzenden Felder dieser Farbe und nie eine Kette
 * dahinter — der erste Zug von Sitz 0 holt ohnehin nur ein oder zwei Felder.
 * Die Probe (nur die Nachbarn der Ecke behalten) war Saat fuer Saat
 * dieselbe Partie wie die Grundregel.
 */
const KANDIDATEN = [
  { id: 'basis', art: 'basis', titel: 'Grundregel (Stand 0b7b4573)', modi: ['klar', 'build', 'extreme'] },
  {
    id: 'anfang1',
    art: 'diagnose',
    titel: 'Sitz 1 zieht zuerst (gleiches Brett)',
    modi: ['klar', 'build', 'extreme'],
    anfaenger: 1,
  },
  {
    id: 'ohneSterne',
    art: 'diagnose',
    titel: 'ohne Sterne',
    modi: ['extreme'],
    vorbereiten: (p) => ({ ...p, sterne: [] }),
  },
  {
    id: 'ohneMauern',
    art: 'diagnose',
    titel: 'ohne Mauern (Vorrat 0, auch keine aus Sternen)',
    modi: ['build', 'extreme'],
    vorbereiten: (p) => ({ ...p, barrierenUebrig: { 0: 0, 1: 0 } }),
    nachZug: (p) => ({ ...p, barrierenUebrig: { 0: 0, 1: 0 } }),
  },
  {
    id: 'brett',
    art: 'diagnose',
    titel: 'anderes Brett (klar/build 12x11, extreme 8x7 mit 10 Mauern, 2 Sternpaaren)',
    modi: ['klar', 'build', 'extreme'],
    config: (m) =>
      m === 'extreme'
        ? brett(m, 8, 7, { barrieren: 10, sternPaare: 2 })
        : brett(m, 12, 11, m === 'build' ? { barrieren: 20 } : {}),
  },
  {
    id: 'brett10',
    art: 'diagnose',
    titel: 'Brett 10x9',
    modi: ['klar'],
    config: (m) => brett(m, 10, 9),
  },
  {
    id: 'ecken',
    art: 'diagnose',
    titel: 'faire Ecken umgeschaltet (klar/build an, extreme aus)',
    modi: ['klar', 'build', 'extreme'],
    config: (m) =>
      m === 'extreme' ? brett(m, 12, 11, { faireEcken: false }) : { faireEcken: true },
  },
  {
    id: 'mauerfrei',
    art: 'ausgleich',
    titel: 'mauerfreie Eroeffnung +1 Zug (build 4, extreme 7: andere Seite mauert zuerst)',
    modi: ['build', 'extreme'],
    config: (m) => (m === 'extreme' ? brett(m, 12, 11, { mauerfreieZuege: 7 }) : { mauerfreieZuege: 4 }),
  },
  {
    id: 'mauer1',
    art: 'ausgleich',
    titel: 'Sitz 1 +1 Mauer',
    modi: ['build', 'extreme'],
    vorbereiten: mauernPlus(1),
  },
  {
    id: 'mauer3',
    art: 'ausgleich',
    titel: 'Sitz 1 +3 Mauern',
    modi: ['build', 'extreme'],
    vorbereiten: mauernPlus(3),
  },
  {
    id: 'stern',
    art: 'ausgleich',
    titel: 'Sitz 1 startet mit einem Stern (+1 Punkt, +1 Mauer)',
    modi: ['build', 'extreme'],
    vorbereiten: (p) => ({
      ...mauernPlus(STERN_MAUERN)(p),
      punkte: { ...p.punkte, 1: p.punkte[1] + STERN_BONUS },
    }),
  },
  {
    id: 'feld',
    art: 'ausgleich',
    titel: 'Sitz 1 startet mit 2 Feldern',
    modi: ['klar', 'build', 'extreme'],
    vorbereiten: feldPlus,
  },
  {
    id: 'doppel',
    art: 'ausgleich',
    titel: 'Sitz 1 faerbt in seinem ersten Zug zweimal (1-2-1-1 …)',
    modi: ['klar', 'build', 'extreme'],
    doppel: true,
  },
];

// ---------------------------------------------------------------------------
// Eine Partie
// ---------------------------------------------------------------------------

const ERFASSE = [1, 2, 5, 10, 20];

function neuePartie(modus, i, k) {
  const config = { ...DEFAULT_REGELN, variante: modus, ...(k.config ? k.config(modus) : {}) };
  let p = erstellePartie(config, [0, 1], saatHex(i));
  if (k.vorbereiten) p = k.vorbereiten(p);
  if (k.anfaenger === 1) p = { ...p, dran: 1 };
  return p;
}

function erlaubteFarben(p) {
  const gesperrt = new Set(gesperrteFarben(p));
  const raus = [];
  for (let f = 0; f < p.regeln.farben; f++) if (!gesperrt.has(f)) raus.push(f);
  return raus;
}

/** Was Farbe f dem Sitz s JETZT einbraechte (Punkte, Sterne mitgezaehlt) — mit dem Modul gerechnet. */
function ausbeute(p, s, f) {
  const q = fuehreAus({ ...p, dran: s, mauernDiesenZug: 0 }, s, { typ: 'faerben', farbe: f });
  return q.punkte[s] - p.punkte[s];
}
const besteAusbeute = (p, s) => Math.max(0, ...erlaubteFarben(p).map((f) => ausbeute(p, s, f)));

/** Freie Felder, die an beide Gebiete grenzen (ohne Mauer dazwischen). */
function grenzfelder(p) {
  const { spalten, zeilen } = p.regeln;
  const sperren = new Set(p.barrieren);
  const raus = [];
  for (let platz = 0; platz < p.besitzer.length; platz++) {
    if (p.besitzer[platz] !== null) continue;
    const an = new Set();
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (sperren.has(P.kante(platz, n))) continue;
      if (p.besitzer[n] !== null) an.add(p.besitzer[n]);
    }
    if (an.size === 2) raus.push(platz);
  }
  return raus;
}

/**
 * Spielt eine Partie Bot gegen Bot. `ersteFarbe` zwingt den ersten Farbzug
 * (Faecher). Gemessen wird nur, was die Auswertung braucht.
 */
function spiele(modus, i, k, ersteFarbe = null) {
  let p = neuePartie(modus, i, k);
  const anfaenger = p.dran;
  const nachzieher = 1 - anfaenger;
  const m = {
    diff: {},
    mauern: [0, 0],
    ersteMauer: null,
    ersterStern: null,
    // Was der Anfaenger auf dem leeren Brett holen koennte, was der Nachzieher.
    bestAnfang: besteAusbeute(p, anfaenger),
    bestNachStart: besteAusbeute(p, nachzieher),
    g: [0, 0],
    antwortBest: null,
    grenze: [0, 0],
    verlauf: [],
  };
  const sterne = new Set(p.sterne);
  let schritte = 0;
  while (!p.fertig) {
    if (++schritte > 500) throw new Error(`${modus}:${i}:${k.id} endet nicht`);
    const s = p.dran;
    const vorher = p;
    const zug =
      p.zug === 0 && ersteFarbe !== null ? { typ: 'faerben', farbe: ersteFarbe } : botZug(sichtFuer(p, s));
    if (zug.typ === 'barriere') {
      m.mauern[s]++;
      if (!m.ersteMauer) m.ersteMauer = { sitz: s, zug: p.zug };
    }
    // Grenzfelder: freie Felder, die an BEIDE Gebiete grenzen — wer sie
    // nimmt, nimmt sie dem anderen weg. Gezaehlt vor dem Zug.
    const grenze = zug.typ === 'faerben' ? grenzfelder(p) : null;
    p = fuehreAus(p, s, zug);
    if (grenze) for (const g of grenze) if (p.besitzer[g] === s) m.grenze[s]++;
    if (k.nachZug) p = k.nachZug(p);
    // Doppelzug: Nach dem ersten Farbzug von Sitz 1 ist er gleich noch einmal dran.
    if (k.doppel && s === 1 && vorher.zug === 1 && !p.fertig) p = { ...p, dran: 1 };
    if (p.zug !== vorher.zug) {
      m.verlauf.push(p.punkte[0] - p.punkte[1]);
      if (vorher.zug < 2) m.g[s] = p.punkte[s] - vorher.punkte[s];
      if (p.zug === 1) m.antwortBest = besteAusbeute(p, nachzieher);
      if (ERFASSE.includes(p.zug)) m.diff[p.zug] = p.punkte[0] - p.punkte[1];
      if (m.ersterStern === null) {
        for (const st of sterne) {
          if (vorher.besitzer[st] === null && p.besitzer[st] !== null) {
            m.ersterStern = p.besitzer[st];
            break;
          }
        }
      }
    }
  }
  const sternZahl = [0, 1].map((s) => [...sterne].filter((st) => p.besitzer[st] === s).length);
  return {
    sieger: sieger(p),
    punkte: [p.punkte[0], p.punkte[1]],
    zuege: p.zug,
    anfaenger,
    sterne: sternZahl,
    ...m,
  };
}

/**
 * Der Faecher: jede erlaubte erste Farbe von Sitz 0 einmal durchgespielt.
 * Daraus kommen "wie oft entscheidet die Eroeffnung" und die Tauschregel.
 */
function faecher(modus, i) {
  const k = KANDIDATEN[0];
  const p = neuePartie(modus, i, k);
  const botWahl = botZug(sichtFuer(p, 0));
  return erlaubteFarben(p).map((f) => {
    const r = spiele(modus, i, k, f);
    return {
      f,
      bot: botWahl.typ === 'faerben' && botWahl.farbe === f,
      g: r.g[0],
      antwort: r.antwortBest,
      sieger: r.sieger,
      diff: r.punkte[0] - r.punkte[1],
      zuege: r.zuege,
    };
  });
}

// ---------------------------------------------------------------------------
// Faeden
// ---------------------------------------------------------------------------

async function hauptfaden() {
  const faeden = schalter('faeden', Math.max(1, os.cpus().length - 1));
  const auftraege = [];
  // Extreme zuerst: Die langen Partien gehoeren an den Anfang, sonst wartet
  // am Ende ein Faden allein auf seine letzte.
  for (const modus of [...MODI].sort((a, b) => (a === 'extreme' ? -1 : b === 'extreme' ? 1 : 0))) {
    for (let i = 0; i < N; i++) auftraege.push({ modus, i, k: 'faecher' });
    for (const k of KANDIDATEN) {
      if (!k.modi.includes(modus)) continue;
      for (let i = 0; i < N; i++) auftraege.push({ modus, i, k: k.id });
    }
  }
  const roh = [];
  let naechster = 0;
  const start = Date.now();
  await Promise.all(
    Array.from(
      { length: faeden },
      () =>
        new Promise((fertig, fehler) => {
          const w = new Worker(fileURLToPath(import.meta.url), { argv });
          const gib = () => w.postMessage(naechster < auftraege.length ? auftraege[naechster++] : null);
          w.on('message', (m) => {
            if (m !== 'bereit') {
              roh.push(m);
              if (roh.length % 500 === 0) {
                process.stderr.write(`${roh.length}/${auftraege.length} (${Math.round((Date.now() - start) / 1000)} s)\n`);
              }
            }
            gib();
          });
          w.on('error', fehler);
          w.on('exit', fertig);
        }),
    ),
  );
  const daten = {};
  for (const r of roh) {
    daten[r.modus] ??= {};
    daten[r.modus][r.k] ??= [];
    daten[r.modus][r.k][r.i] = r.ergebnis;
  }
  if (ALS_JSON) {
    console.log(JSON.stringify(daten));
    return;
  }
  bericht(daten, Math.round((Date.now() - start) / 1000));
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

const pct = (x, n) => (n ? `${((100 * x) / n).toFixed(1)} %` : '–');
const zahl = (x, st = 2) => (Number.isFinite(x) ? x.toFixed(st) : '–');
const mittel = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const vz = (sieg) => (sieg === 0 ? 1 : sieg === 1 ? -1 : 0);

function tabelle(kopf, zeilen) {
  console.log(`| ${kopf.join(' | ')} |`);
  console.log(`|${kopf.map(() => '---').join('|')}|`);
  for (const z of zeilen) console.log(`| ${z.join(' | ')} |`);
  console.log('');
}

/** Sieg Sitz 0 / Sitz 1 / remis, Zuege — und gegen die Grundregel gepaart: Saaten mit Sitz-0-Sieg mehr/weniger. */
function quote(liste, basis) {
  const n = liste.length;
  const z = { s0: 0, s1: 0, r: 0, zuege: 0, mehr: 0, weniger: 0 };
  liste.forEach((r, i) => {
    if (r.sieger === 0) z.s0++;
    else if (r.sieger === 1) z.s1++;
    else z.r++;
    z.zuege += r.zuege;
    if (basis) {
      const a = basis[i].sieger === 0;
      const b = r.sieger === 0;
      if (b && !a) z.mehr++;
      if (a && !b) z.weniger++;
    }
  });
  return { n, ...z, zuege: z.zuege / n };
}

/** Punkteausgleich: Sitz 1 bekommt k Punkte dazu. Aus den Grundpartien gerechnet, siehe Kopf. */
function komi(basis, k) {
  const z = { s0: 0, s1: 0, r: 0 };
  for (const r of basis) {
    const d = r.punkte[0] - r.punkte[1] - k;
    if (d > 0) z.s0++;
    else if (d < 0) z.s1++;
    else z.r++;
  }
  return z;
}

/**
 * Tauschregel: Nach dem ersten Zug darf Sitz 1 die Seiten tauschen. Der Bot
 * kennt sie nicht, also braucht es ein Modell beider Menschen:
 *
 * - Sitz 1 schaetzt die Lage aus dem, was er SIEHT: Vorsprung des ersten
 *   Zuges minus seine eigene beste Antwort (`g - antwort`). Er tauscht, wenn
 *   Sitz 0 mit diesem Wert erfahrungsgemaess mehr als die Haelfte holt.
 * - Sitz 0 weiss das und waehlt die erste Farbe, deren Schaetzwert am
 *   naechsten an 50 % liegt — er spielt absichtlich "nur so gut, dass sich
 *   das Tauschen nicht lohnt".
 *
 * "Erfahrungsgemaess" ist eine Tabelle aus den Faecher-Partien der ANDEREN
 * Haelfte der Saaten (gerade gegen ungerade), damit der Tauschende nicht die
 * Partie kennt, ueber die er entscheidet. Ergebnis aus Sicht des Menschen,
 * der den ersten Zug gemacht hat (Anziehender), nicht des Sitzes.
 */
function tausch(faecherListe) {
  const schluessel = (e) => Math.max(-6, Math.min(12, e.g - e.antwort));
  const lerne = (rest) => {
    const t = new Map();
    let summe = 0;
    let n = 0;
    for (const facher of rest) {
      for (const e of facher) {
        const w = (vz(e.sieger) + 1) / 2;
        const s = schluessel(e);
        const alt = t.get(s) ?? { w: 0, n: 0 };
        t.set(s, { w: alt.w + w, n: alt.n + 1 });
        summe += w;
        n++;
      }
    }
    const grund = n ? summe / n : 0.5;
    return (e) => {
      const x = t.get(schluessel(e)) ?? { w: 0, n: 0 };
      return (x.w + 2 * grund) / (x.n + 2);
    };
  };
  const z = { an: 0, nach: 0, r: 0, getauscht: 0, zuege: 0, n: 0 };
  for (const halb of [0, 1]) {
    const schaetze = lerne(faecherListe.filter((_, i) => i % 2 !== halb));
    faecherListe.forEach((facher, i) => {
      if (i % 2 !== halb || !facher.length) return;
      let wahl = null;
      for (const e of facher) {
        const w = schaetze(e);
        const guete = Math.min(w, 1 - w);
        if (!wahl || guete > wahl.guete + 1e-9 || (Math.abs(guete - wahl.guete) < 1e-9 && e.bot)) {
          wahl = { e, w, guete };
        }
      }
      const tauscht = wahl.w > 0.5;
      const fuerAnzieher = tauscht ? -vz(wahl.e.sieger) : vz(wahl.e.sieger);
      if (fuerAnzieher > 0) z.an++;
      else if (fuerAnzieher < 0) z.nach++;
      else z.r++;
      if (tauscht) z.getauscht++;
      z.zuege += wahl.e.zuege;
      z.n++;
    });
  }
  return { ...z, zuege: z.zuege / z.n };
}

function bericht(daten, sekunden) {
  const modi = MODI.filter((m) => daten[m]);
  console.log(`# Anzug im Farbduell — Messung (n = ${N} Saaten je Spielart, ${sekunden} s)\n`);

  // 1a Vorsprung
  console.log('## 1a. Vorsprung Sitz 0 minus Sitz 1 (Punkte) nach Zug k — Grundregel\n');
  console.log('Zug = Farbzuege ueber beide Sitze; Zug 1 ist der erste von Sitz 0, Zug 2 die Antwort.\n');
  tabelle(
    ['Spielart', ...ERFASSE.map((k) => `nach Zug ${k}`), 'Ende', 'Sitz 0 vorn nach Zug 2', 'Vorn nach Zug 2 gewinnt auch'],
    modi.map((m) => {
      const b = daten[m].basis;
      const vorn2 = b.filter((r) => r.diff[2] > 0).length;
      const entsch = b.filter((r) => r.sieger !== null && r.diff[2] !== undefined && r.diff[2] !== 0);
      const haelt = entsch.filter((r) => Math.sign(r.diff[2]) === vz(r.sieger)).length;
      return [
        m,
        ...ERFASSE.map((k) => zahl(mittel(b.filter((r) => r.diff[k] !== undefined).map((r) => r.diff[k])), 1)),
        zahl(mittel(b.map((r) => r.punkte[0] - r.punkte[1])), 1),
        pct(vorn2, b.length),
        `${pct(haelt, entsch.length)} (n=${entsch.length})`,
      ];
    }),
  );

  console.log('Derselbe Vorsprung ueber die Partiedauer (Anteil der Farbzuege) — und wer die umkaempften Grenzfelder nimmt:\n');
  tabelle(
    ['Spielart', '25 %', '50 %', '75 %', '90 %', 'Ende', 'nach dem letzten Zug von S1 (gleich viele Zuege)', 'Grenzfelder S0 / S1', 'Partien mit ungerader Zugzahl (S0 zieht zuletzt)', 'Sieg S0 dann / sonst'],
    modi.map((m) => {
      const b = daten[m].basis;
      const an = (q) => zahl(mittel(b.map((r) => r.verlauf[Math.max(0, Math.ceil(q * r.verlauf.length) - 1)])), 1);
      // Gleich viele Farbzuege: nach Zug 2k. Endet die Partie mit einem Zug von S0, ist das der vorletzte Stand.
      const gleich = b.map((r) => r.verlauf[r.verlauf.length % 2 === 0 ? r.verlauf.length - 1 : r.verlauf.length - 2] ?? 0);
      const ungerade = b.filter((r) => r.zuege % 2 === 1);
      const gerade = b.filter((r) => r.zuege % 2 === 0);
      const s0 = (xs) => pct(xs.filter((r) => r.sieger === 0).length, xs.length);
      return [m, an(0.25), an(0.5), an(0.75), an(0.9), an(1), zahl(mittel(gleich), 1), `${zahl(mittel(b.map((r) => r.grenze[0])), 1)} / ${zahl(mittel(b.map((r) => r.grenze[1])), 1)}`, pct(ungerade.length, b.length), `${s0(ungerade)} / ${s0(gerade)}`];
    }),
  );

  // 1b Anzug oder Ecke
  console.log('## 1b. Anzug oder Ecke? Dasselbe Brett, einmal zieht Sitz 0 zuerst, einmal Sitz 1\n');
  tabelle(
    ['Spielart', 'Anfaenger gewinnt (S0 zuerst / S1 zuerst)', 'Anfaenger gewinnt BEIDE', 'Ecke unten links gewinnt beide', 'Ecke oben rechts gewinnt beide', 'sonst (remis dabei)'],
    modi.map((m) => {
      const a = daten[m].basis;
      const b = daten[m].anfang1;
      let beide = 0;
      let ecke0 = 0;
      let ecke1 = 0;
      let sonst = 0;
      a.forEach((r, i) => {
        const x = r.sieger;
        const y = b[i].sieger;
        if (x === 0 && y === 1) beide++;
        else if (x === 0 && y === 0) ecke0++;
        else if (x === 1 && y === 1) ecke1++;
        else sonst++;
      });
      const anf1 = b.filter((r) => r.sieger === 1).length;
      return [m, `${pct(a.filter((r) => r.sieger === 0).length, a.length)} / ${pct(anf1, b.length)}`, pct(beide, a.length), pct(ecke0, a.length), pct(ecke1, a.length), pct(sonst, a.length)];
    }),
  );

  // 1c Eroeffnung
  console.log('## 1c. Entscheidet der erste Zug? Faecher: jede erlaubte erste Farbe von Sitz 0 durchgespielt\n');
  tabelle(
    ['Spielart', 'Farben im 1. Zug', 'Sitz 0 gewinnt mit JEDER', 'mit KEINER', 'haengt an der Farbe', 'Sitz 0 mit bester Farbe', 'mit Bot-Farbe', 'Erstzug-Ausbeute Bot / beste / Mittel'],
    modi.map((m) => {
      const f = daten[m].faecher;
      let jede = 0;
      let keine = 0;
      let haengt = 0;
      let beste = 0;
      let bot = 0;
      const gBot = [];
      const gMax = [];
      const gAlle = [];
      for (const fa of f) {
        const siege = fa.map((e) => e.sieger === 0);
        if (siege.every(Boolean)) jede++;
        else if (!siege.some(Boolean)) keine++;
        if (new Set(fa.map((e) => e.sieger)).size > 1) haengt++;
        if (siege.some(Boolean)) beste++;
        const b = fa.find((e) => e.bot);
        if (b?.sieger === 0) bot++;
        if (b) gBot.push(b.g);
        gMax.push(Math.max(...fa.map((e) => e.g)));
        gAlle.push(...fa.map((e) => e.g));
      }
      return [m, zahl(mittel(f.map((x) => x.length)), 1), pct(jede, f.length), pct(keine, f.length), pct(haengt, f.length), pct(beste, f.length), pct(bot, f.length), `${zahl(mittel(gBot), 1)} / ${zahl(mittel(gMax), 1)} / ${zahl(mittel(gAlle), 1)}`];
    }),
  );

  // 1d Startfarbe / Wegnehmen
  console.log('## 1d. Startlage: was der erste Zug dem Nachzieher wegnimmt (Grundregel)\n');
  tabelle(
    ['Spielart', 'bester 1. Zug S0 / S1 auf leerem Brett', 'Ausbeute S0 Zug 1 / S1 Zug 2', 'S1 beste Antwort nach Zug 1', 'S1 verliert durch Zug 1 (beste Antwort < vorher)', 'Sieg S0 wenn ja / wenn nein'],
    modi.map((m) => {
      const b = daten[m].basis;
      const raub = b.filter((r) => r.antwortBest < r.bestNachStart);
      const kein = b.filter((r) => r.antwortBest >= r.bestNachStart);
      return [
        m,
        `${zahl(mittel(b.map((r) => r.bestAnfang)), 2)} / ${zahl(mittel(b.map((r) => r.bestNachStart)), 2)}`,
        `${zahl(mittel(b.map((r) => r.g[0])), 2)} / ${zahl(mittel(b.map((r) => r.g[1])), 2)}`,
        zahl(mittel(b.map((r) => r.antwortBest)), 2),
        pct(raub.length, b.length),
        `${pct(raub.filter((r) => r.sieger === 0).length, raub.length)} / ${pct(kein.filter((r) => r.sieger === 0).length, kein.length)}`,
      ];
    }),
  );

  // 1e Sterne und Mauern
  const mitM = modi.filter((m) => m !== 'klar');
  if (mitM.length) {
    console.log('## 1e. Sterne und Mauern (Grundregel)\n');
    tabelle(
      ['Spielart', 'Sterne S0 / S1', 'ersten Stern holt S0', 'Sieg S0 bei mehr / gleich / weniger Sternen', 'Mauern S0 / S1', 'erste Mauer setzt S0 (bei Zug)'],
      mitM.map((m) => {
        const b = daten[m].basis;
        const mehr = b.filter((r) => r.sterne[0] > r.sterne[1]);
        const gleich = b.filter((r) => r.sterne[0] === r.sterne[1]);
        const weniger = b.filter((r) => r.sterne[0] < r.sterne[1]);
        const s0 = (xs) => pct(xs.filter((r) => r.sieger === 0).length, xs.length);
        const mitStern = b.filter((r) => r.ersterStern !== null);
        const mitMauer = b.filter((r) => r.ersteMauer);
        return [
          m,
          `${zahl(mittel(b.map((r) => r.sterne[0])), 2)} / ${zahl(mittel(b.map((r) => r.sterne[1])), 2)}`,
          m === 'extreme' ? pct(mitStern.filter((r) => r.ersterStern === 0).length, mitStern.length) : '–',
          m === 'extreme' ? `${s0(mehr)} (${mehr.length}) / ${s0(gleich)} (${gleich.length}) / ${s0(weniger)} (${weniger.length})` : '–',
          `${zahl(mittel(b.map((r) => r.mauern[0])), 2)} / ${zahl(mittel(b.map((r) => r.mauern[1])), 2)}`,
          `${pct(mitMauer.filter((r) => r.ersteMauer.sitz === 0).length, mitMauer.length)} (${zahl(mittel(mitMauer.map((r) => r.ersteMauer.zug)), 1)})`,
        ];
      }),
    );
  }

  // 2 Kandidaten
  console.log('## 2. Alle Varianten, gepaart auf denselben Saaten\n');
  console.log('"+/−" = Saaten, auf denen Sitz 0 gegenueber der Grundregel einen Sieg dazu- bzw. verliert.\n');
  for (const m of modi) {
    const basis = daten[m].basis;
    const zeilen = [];
    for (const k of KANDIDATEN) {
      if (!daten[m][k.id]) continue;
      const q = quote(daten[m][k.id], basis);
      const nennung = k.id === 'anfang1' ? ' (Sieg S1 = Anfaenger)' : '';
      zeilen.push([`${k.art}: ${k.titel}${nennung}`, pct(q.s0, q.n), pct(q.s1, q.n), pct(q.r, q.n), zahl(q.zuege, 1), k.id === 'basis' ? '' : `+${q.mehr} −${q.weniger}`]);
    }
    // Punkteausgleich: Sitz 1 bekommt k dazu; halbe Punkte schliessen remis aus.
    const kandK = [];
    for (let k = 0.5; k <= 12; k += 0.5) kandK.push(k);
    const besteK = kandK.reduce((best, k) => {
      const z = komi(basis, k);
      const abstand = Math.abs(z.s0 - z.s1);
      return !best || abstand < best.abstand ? { k, abstand } : best;
    }, null);
    for (const k of [...new Set([1, 1.5, 2, besteK.k, besteK.k + 0.5])].sort((a, b) => a - b)) {
      const z = komi(basis, k);
      zeilen.push([`ausgleich: Sitz 1 +${k} Punkte am Ende${k === besteK.k ? ' (bester Wert)' : ''}`, pct(z.s0, basis.length), pct(z.s1, basis.length), pct(z.r, basis.length), zahl(quote(basis).zuege, 1), '']);
    }
    const t = tausch(daten[m].faecher);
    zeilen.push([`ausgleich: Tauschregel (S1 darf nach Zug 1 tauschen; Anziehender / Nachziehender, ${pct(t.getauscht, t.n)} getauscht)`, pct(t.an, t.n), pct(t.nach, t.n), pct(t.r, t.n), zahl(t.zuege, 1), '']);
    console.log(`### ${m}\n`);
    tabelle(['Variante', 'Sieg Sitz 0', 'Sieg Sitz 1', 'remis', 'Farbzuege', '+/− gegen Grundregel'], zeilen);
    console.log('Punkteausgleich je Wert (Sieg S0 / S1 / remis):\n');
    console.log(
      kandK
        .filter((k) => k <= besteK.k + 2)
        .map((k) => {
          const z = komi(basis, k);
          return `+${k}: ${z.s0}/${z.s1}/${z.r}`;
        })
        .join(' · ') + '\n',
    );
    const ds = basis.map((r) => r.punkte[0] - r.punkte[1]).sort((a, b) => a - b);
    console.log(`Endvorsprung S0−S1: Median ${ds[Math.floor(ds.length / 2)]}, Mittel ${zahl(mittel(ds), 2)}, 10.–90. Perzentil ${ds[Math.floor(ds.length * 0.1)]} bis ${ds[Math.floor(ds.length * 0.9)]}\n`);
  }
  console.log('Hinweis zum Rauschen: Bei n = 200 liegt der Standardfehler einer Quote um 50 % bei 3,5 Prozentpunkten; Unterschiede unter etwa 7 Punkten sind nicht belastbar. Die +/−-Spalte zeigt, wie viele Saaten wirklich kippen.');
}

// Erst ganz am Ende starten: Die Auswertung oben braucht ihre Konstanten
// schon initialisiert (sonst ReferenceError aus der zeitlichen Totzone).
if (!isMainThread) {
  parentPort.on('message', (a) => {
    if (a === null) return void process.exit(0);
    const k = KANDIDATEN.find((x) => x.id === a.k);
    const ergebnis = a.k === 'faecher' ? faecher(a.modus, a.i) : spiele(a.modus, a.i, k);
    parentPort.postMessage({ ...a, ergebnis });
  });
  parentPort.postMessage('bereit');
} else {
  await hauptfaden();
}
