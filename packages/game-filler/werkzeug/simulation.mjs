/**
 * Filler: Bot gegen Bot auf festen Saaten — Messstand fuer Eroeffnung,
 * Einsperren, Anzugsvorteil, Mauern und Fehlzuege des Bots.
 *
 *     npm run build --workspace @brauweg/game-api
 *     npm run build --workspace @brauweg/game-filler
 *     node packages/game-filler/werkzeug/simulation.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --extreme 1000      Partien je Spielart (0 = Spielart auslassen).
 *     --klar 200
 *     --build 200
 *     --start 0           Erster Saatindex. Partie i spielt auf saatHex(i).
 *     --ohne-ausbeuter    Die Gegenproben (Abschnitt 6) weglassen — spart
 *                         drei Viertel der Laufzeit.
 *     --faeden 6          Arbeitsfaeden (Vorgabe: Kerne - 1, hoechstens 6).
 *     --json              Statt der Tabellen die rohen Zahlen als JSON.
 *     --zeige extreme:17  EINE Partie Zug fuer Zug mit Brett ausgeben
 *                         (Spielart:Saatindex). Dafuer sind die Beispiel-
 *                         Saaten in den Tabellen da.
 *
 * LAUFZEIT: Mit allen Vorgaben rund 32 Minuten auf 6 Faeden (Stand
 * 07.11.2026) — fast alles davon sind die Gegenproben in Extreme, weil der
 * Bot jede erlaubte Wand bewertet. Ohne Gegenproben ein Viertel davon. Die
 * Grundmessung dieses Stands liegt in `MESSUNG-2026-11-07.md` daneben; wer
 * Regeln oder Bot aendert, misst auf denselben Saaten nach und vergleicht.
 *
 * WARUM HEXSAATEN UND KEINE ZAHLEN: Der Server eroeffnet jeden Tisch mit
 * `seedHex` (adapter.ts, createParty), also mit sfc32. Mit Zahlensaaten liefe
 * mulberry32, und gemessen waeren Bretter, die so nie gespielt werden.
 * `saatHex(i)` macht aus dem Index eine feste 128-Bit-Kette; derselbe Index
 * ist in jeder Spielart dieselbe Kette (die Bretter unterscheiden sich
 * trotzdem, weil Extreme sieben Farben zieht).
 *
 * WAS DAS SKRIPT NICHT TUT: Es aendert weder Regeln noch Bot. Die Wand-
 * bewertung des Bots steht in `wandBewertung` ein ZWEITES Mal — nur zum
 * Messen, damit sich sagen laesst, WARUM er eine Wand liegen laesst. Ob die
 * Abschrift noch stimmt, prueft der Lauf selbst: Abschnitt 4 zaehlt jede
 * Stelle, an der sie anders entscheidet als `botZug` ("Abweichungen"). Steht
 * dort etwas anderes als 0, ist erst die Abschrift nachzuziehen.
 *
 * Gemessen wird auf dem WAHREN Zustand (Zuschauerblick), entschieden wird
 * vom Bot auf seiner Sicht — wie am echten Tisch. In klar/build/extreme liegt
 * das Brett offen, der Bot sieht dort also dasselbe wie die Messung.
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

const {
  erstellePartie,
  fuehreAus,
  erreichbareFreie,
  gesperrteFarben,
  kante,
  nachbarn,
  offeneNachbarn,
  startEcke,
  sieger,
  STERN_BONUS,
} = P;
const { DEFAULT_REGELN } = R;
const { sichtFuer } = S;
const { botZug, WAND_SCHWELLE } = B;

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
function schalter(name, vorgabe) {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return vorgabe;
  const wert = argv[i + 1];
  if (typeof vorgabe === 'number') return Number(wert);
  return wert;
}
const ANZAHL = {
  extreme: schalter('extreme', 1000),
  klar: schalter('klar', 200),
  build: schalter('build', 200),
};
const START = schalter('start', 0);
const MIT_AUSBEUTERN = !argv.includes('--ohne-ausbeuter');
const ALS_JSON = argv.includes('--json');
const ZEIGE = schalter('zeige', null);
const BEISPIELE = 5;

// ---------------------------------------------------------------------------
// Saaten
// ---------------------------------------------------------------------------

/** Feste 128-Bit-Hexkette je Index — dieselbe Form, die der Server schickt. */
export function saatHex(i) {
  let a = (0x9e3779b9 ^ Math.imul(i + 1, 0x85ebca6b)) >>> 0;
  const wort = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0).toString(16).padStart(8, '0');
  };
  return wort() + wort() + wort() + wort();
}

function neuePartie(variante, i) {
  return erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], saatHex(i));
}

// ---------------------------------------------------------------------------
// Messungen auf dem wahren Zustand
// ---------------------------------------------------------------------------

const gegnerVon = (s) => 1 - s;
const sperrenVon = (p) => new Set(p.barrieren);

function erlaubteFarben(p) {
  const gesperrt = new Set(gesperrteFarben(p));
  const raus = [];
  for (let f = 0; f < p.regeln.farben; f++) if (!gesperrt.has(f)) raus.push(f);
  return raus;
}

/** Spielt einen Farbzug fuer `s`, egal wer gerade dran ist. */
function faerbeFuer(p, s, f) {
  return fuehreAus({ ...p, dran: s, mauerDiesenZug: false, fertig: false }, s, {
    typ: 'faerben',
    farbe: f,
  });
}

/** Punkte, die Farbe f dem Sitz s jetzt einbraechte (Sterne mitgezaehlt). */
function gewinn(p, s, f) {
  return faerbeFuer(p, s, f).punkte[s] - p.punkte[s];
}

const freieDa = (p) => p.besitzer.some((b) => b === null);

/**
 * Hat s noch freie Felder vor sich, aber keine erlaubte Farbe bringt eines?
 * Das ist der Fall aus Niklas' Beobachtung: Jedes freie Grenzfeld traegt die
 * Farbe des Gegners, und die ist gesperrt.
 */
function farbBlockiert(p, s) {
  if (erreichbareFreie(p, s, sperrenVon(p)) === 0) return false;
  return erlaubteFarben(p).every((f) => gewinn(p, s, f) === 0);
}

/** Kein einziges freies Feld mehr erreichbar, obwohl es noch freie gibt. */
function eingeschlossen(p, s) {
  return freieDa(p) && erreichbareFreie(p, s, sperrenVon(p)) === 0;
}

/** Die freien Felder, die s ueber freie Felder und durch keine Mauer erreicht. */
function freieMenge(p, s) {
  const { spalten, zeilen } = p.regeln;
  const sperren = sperrenVon(p);
  const gesehen = new Set();
  const rand = [];
  for (let platz = 0; platz < p.besitzer.length; platz++)
    if (p.besitzer[platz] === s) rand.push(platz);
  while (rand.length > 0) {
    const platz = rand.pop();
    for (const n of offeneNachbarn(platz, spalten, zeilen, sperren)) {
      if (p.besitzer[n] !== null || gesehen.has(n)) continue;
      gesehen.add(n);
      rand.push(n);
    }
  }
  return gesehen;
}

/**
 * Sind die Fronten geschlossen — gibt es kein freies Feld mehr, das BEIDE
 * erreichen? Dann spielt jeder nur noch in seinem eigenen Rest, ohne Weg zum
 * Gegner (aneinanderstossende Gebiete sind kein Weg: Durch fremdes Gebiet
 * kommt niemand). Einmal getrennt, bleibt es so.
 * Gibt [nur 0, nur 1] zurueck oder null, solange noch umkaempft wird.
 */
function getrennt(p) {
  const a = freieMenge(p, 0);
  const b = freieMenge(p, 1);
  for (const x of a) if (b.has(x)) return null;
  return [a.size, b.size];
}

/** Farben, mit denen der Gegner von s den Sitz s sofort sperren koennte. */
function sperrfarbenGegen(p, s) {
  // Nach dem Zug von s ist der Gegner dran; er waehlt g, danach ist s dran.
  const o = gegnerVon(s);
  const gesperrt = new Set(gesperrteFarben(p));
  const raus = [];
  for (let g = 0; g < p.regeln.farben; g++) {
    if (gesperrt.has(g)) continue;
    const q = faerbeFuer(p, o, g);
    if (!q.fertig && farbBlockiert(q, s)) raus.push(g);
  }
  return raus;
}

/** Zwei-Zug-Wert: eigener Gewinn minus der beste Gewinn der Antwort. */
function zweiZugWert(p, s, f) {
  const q = faerbeFuer(p, s, f);
  const eigen = q.punkte[s] - p.punkte[s];
  if (q.fertig) return eigen;
  const o = gegnerVon(s);
  let antwort = 0;
  for (const g of erlaubteFarben(q)) antwort = Math.max(antwort, gewinn(q, o, g));
  return eigen - antwort;
}

// ---------------------------------------------------------------------------
// Abschrift der Wandbewertung (bot.ts, besteWand) — nur zum Messen
// ---------------------------------------------------------------------------

/**
 * Rechnet fuer jede erlaubte Wand dieselbe Zahl wie der Bot und gibt die
 * beste samt ihrer Bestandteile heraus. Die Formel ist bot.ts Zeile fuer
 * Zeile; weicht der Bot spaeter davon ab, meldet Abschnitt 4 Abweichungen.
 */
function wandBewertung(sicht) {
  const { spalten, zeilen, farbzahl, feld, besitzer, farbe } = sicht;
  const ich = sicht.ich ?? 0;
  const sperren = new Set(sicht.barrieren.map(([a, b]) => kante(a, b)));
  const erreichbarMit = (platz, mauern) =>
    nachbarn(platz, spalten, zeilen).filter((n) => !mauern.has(kante(platz, n)));
  const sterne = new Set(sicht.sterne ?? []);
  const gesperrt = new Set(Object.values(farbe));
  const erlaubt = [];
  for (let f = 0; f < farbzahl; f++) if (!gesperrt.has(f)) erlaubt.push(f);
  const felderVon = (sitz) => {
    const raus = [];
    for (let platz = 0; platz < besitzer.length; platz++)
      if (besitzer[platz] === sitz) raus.push(platz);
    return raus;
  };
  const eigen = felderVon(ich);
  const seine = felderVon(gegnerVon(ich));
  const mass = (start, f, mauern) => {
    const genommen = new Set(start);
    const rand = [...start];
    let m = 0;
    while (rand.length > 0) {
      const platz = rand.pop();
      for (const n of erreichbarMit(platz, mauern)) {
        if (genommen.has(n) || besitzer[n] !== null || feld[n] !== f) continue;
        genommen.add(n);
        rand.push(n);
        m += sterne.has(n) ? 1 + STERN_BONUS : 1;
      }
    }
    return m;
  };
  const freieVon = (start, mauern) => {
    const gesehen = new Set(start);
    const frei = new Set();
    const rand = [...start];
    while (rand.length > 0) {
      const platz = rand.pop();
      for (const n of erreichbarMit(platz, mauern)) {
        if (gesehen.has(n) || besitzer[n] !== null) continue;
        gesehen.add(n);
        frei.add(n);
        rand.push(n);
      }
    }
    return frei;
  };
  const besterZug = (start, mauern) =>
    erlaubt.reduce((b, f) => Math.max(b, mass(start, f, mauern)), 0);
  const lage = (mauern) => {
    const meine = freieVon(eigen, mauern);
    const deine = freieVon(seine, mauern);
    let nurMeine = 0;
    let nurDeine = 0;
    for (const p of meine) if (!deine.has(p)) nurMeine++;
    for (const p of deine) if (!meine.has(p)) nurDeine++;
    return {
      nurMeine,
      nurDeine,
      meinZug: besterZug(eigen, mauern),
      seinZug: besterZug(seine, mauern),
    };
  };
  const vorher = lage(sperren);
  let beste = null;
  let besterWert = -Infinity;
  let teile = null;
  for (const kandidat of sicht.barrierenMoeglich ?? []) {
    const probe = new Set(sperren);
    probe.add(kante(kandidat[0], kandidat[1]));
    const n = lage(probe);
    const gebiet = n.nurMeine - vorher.nurMeine + (vorher.nurDeine - n.nurDeine);
    const zuege = 0.5 * (vorher.seinZug - n.seinZug - (vorher.meinZug - n.meinZug));
    const wert = gebiet + zuege;
    if (wert > besterWert) {
      besterWert = wert;
      beste = kandidat;
      teile = { gebiet, zuege };
    }
  }
  return { anzahl: (sicht.barrierenMoeglich ?? []).length, beste, besterWert, teile };
}

// ---------------------------------------------------------------------------
// Spieler
// ---------------------------------------------------------------------------

/**
 * Wer zieht. `bot` ist der echte Bot; die anderen sind der Bot mit EINER
 * geaenderten Entscheidung — sie messen, was eine Schwaeche kostet: Gewinnt
 * der Abweichler gegen den Bot deutlich oefter als der Bot gegen sich selbst,
 * ist die Schwaeche teuer.
 */
let abweichungen = 0; // Zuege, in denen eine Politik anders zog als der Bot
const anders = (zug, bot) => {
  if (
    zug.typ !== bot.typ ||
    zug.farbe !== bot.farbe ||
    zug.von !== bot.von ||
    zug.nach !== bot.nach
  )
    abweichungen++;
  return zug;
};
const POLITIKEN = {
  bot: (p, s) => botZug(sichtFuer(p, s)),
  /** Nimmt jede Farbe, nach der der Gegner keine nutzbare Farbe hat. */
  sperrer: (p, s) => {
    const zug = botZug(sichtFuer(p, s));
    if (zug.typ !== 'faerben') return zug;
    const o = gegnerVon(s);
    let beste = null;
    let besterGewinn = -1;
    for (const f of erlaubteFarben(p)) {
      const q = faerbeFuer(p, s, f);
      if (q.fertig || !farbBlockiert(q, o)) continue;
      const g = q.punkte[s] - p.punkte[s];
      if (g > besterGewinn) {
        besterGewinn = g;
        beste = f;
      }
    }
    return beste === null ? zug : anders({ typ: 'faerben', farbe: beste }, zug);
  },
  /** Wie `sperrer`, aber nur im ersten eigenen Zug (Niklas' Fall). */
  eroeffnungssperre: (p, s) => (p.zug <= 1 ? POLITIKEN.sperrer(p, s) : POLITIKEN.bot(p, s)),
  /** Waehlt die Farbe nach eigenem Gewinn minus bester Antwort. */
  zweizug: (p, s) => {
    const zug = botZug(sichtFuer(p, s));
    if (zug.typ !== 'faerben') return zug;
    let beste = zug.farbe;
    let besterWert = zweiZugWert(p, s, zug.farbe);
    for (const f of erlaubteFarben(p)) {
      const w = zweiZugWert(p, s, f);
      if (w > besterWert) {
        besterWert = w;
        beste = f;
      }
    }
    return anders({ typ: 'faerben', farbe: beste }, zug);
  },
  /** Baut schon ab Wandwert 0,5 statt WAND_SCHWELLE. */
  mauerer: (p, s) => {
    const sicht = sichtFuer(p, s);
    if (sicht.barrierenMoeglich) {
      const w = wandBewertung(sicht);
      if (w.beste && w.besterWert >= 0.5) {
        const zug = { typ: 'barriere', von: w.beste[0], nach: w.beste[1] };
        if (w.besterWert < WAND_SCHWELLE) abweichungen++;
        return zug;
      }
      const { barrierenMoeglich: _weg, ...ohne } = sicht;
      return botZug(ohne);
    }
    return botZug(sicht);
  },
};

// ---------------------------------------------------------------------------
// Eine Partie
// ---------------------------------------------------------------------------

const ZUG_DECKEL = 400;

/**
 * Spielt eine Partie und misst unterwegs. `messen` = false spielt nur (fuer
 * die Gegenproben, dort zaehlt allein das Ergebnis).
 */
function spiele(variante, i, politik = ['bot', 'bot'], messen = true, protokoll = null) {
  let p = neuePartie(variante, i);
  abweichungen = 0;
  const m = messen ? neueMessung(p) : null;
  let schritte = 0;
  while (!p.fertig) {
    if (++schritte > ZUG_DECKEL) throw new Error(`Partie ${variante}:${i} endet nicht`);
    const s = p.dran;
    const sicht = sichtFuer(p, s);
    const zug = POLITIKEN[politik[s]](p, s);
    if (m) messeVorZug(m, p, s, sicht, zug);
    const vorher = p;
    p = fuehreAus(p, s, zug);
    if (m) messeNachZug(m, vorher, p, s, zug);
    if (protokoll) protokoll(vorher, p, s, zug);
  }
  const sieg = sieger(p);
  const ergebnis = { sieger: sieg, punkte: [p.punkte[0], p.punkte[1]], zuege: p.zug, abweichungen };
  abweichungen = 0;
  if (m) abschliessen(m, p);
  return { ergebnis, messung: m };
}

function neueMessung(p) {
  const { spalten, zeilen } = p.regeln;
  const ecke = [0, 1].map((s) => startEcke(s, spalten, zeilen));
  const nachbarFarben = ecke.map((e) => nachbarn(e, spalten, zeilen).map((n) => p.feld[n]));
  const zweiGleich = nachbarFarben.map((fs) => fs.length === 2 && fs[0] === fs[1]);
  // Sitz 1 ist schon vor jedem Zug gesperrt, wenn beide Nachbarn seiner Ecke
  // die Eckfarbe von Sitz 0 tragen — dann ist sein erster Zug ein Leerzug.
  const vonAnfangGesperrt = zweiGleich[1] && nachbarFarben[1][0] === p.farbe[0];
  // Kann Sitz 0 Sitz 1 mit seinem ersten Zug sperren?
  const sperrbar1 = sperrfarbenGegen(p, 1).length > 0 || farbBlockiert(p, 1);
  return {
    zweiGleich,
    vonAnfangGesperrt,
    sperrbarNachZug1: sperrbar1,
    blockiertNachZug: {}, // Zugnummer -> Sitz, der dann am Zug und blockiert ist
    blockadeZuege: [0, 0],
    eingeschlossenAb: [null, null],
    eingeschlossenDurchMauer: [false, false],
    eingeschlossenFrei: [null, null],
    getrenntAb: null,
    getrenntFrei: null,
    getrenntDurchMauer: false,
    getrenntExklusiv: null,
    mauern: [0, 0],
    mauerNachZug: [],
    wand: { entscheidungen: 0, gebaut: 0, abweichung: 0, werte: [], teile: [], gruende: {} },
    fehl: {
      entscheidungen: 0,
      sperreVerpasst: [],
      sperrbarGelassen: [],
      zweiZugVerlust: [],
      gleichstand: 0,
      gleichstandEntscheidend: 0,
      leerzugMitAlternative: 0,
    },
  };
}

function messeVorZug(m, p, s, sicht, zug) {
  const amZugAnfang = !p.mauerDiesenZug;
  if (amZugAnfang) {
    if (p.zug <= 4 && farbBlockiert(p, s)) m.blockiertNachZug[p.zug] = s;
    if (farbBlockiert(p, s)) m.blockadeZuege[s]++;
  }

  // Mauerentscheidung: nur am Zuganfang, und nur wo es Mauern gibt.
  if (amZugAnfang && (p.regeln.variante === 'build' || p.regeln.variante === 'extreme')) {
    let grund = null;
    if (p.zug < 3) grund = 'Eroeffnung (mauerfrei)';
    else if ((p.barrierenUebrig[s] ?? 0) <= 0) grund = 'Vorrat leer';
    else if (!sicht.barrierenMoeglich) grund = 'keine erlaubte Kante';
    if (grund) {
      m.wand.gruende[grund] = (m.wand.gruende[grund] ?? 0) + 1;
    } else {
      const w = wandBewertung(sicht);
      m.wand.entscheidungen++;
      m.wand.werte.push(w.besterWert);
      m.wand.teile.push(w.teile);
      const meint = w.beste !== null && w.besterWert >= WAND_SCHWELLE;
      if (meint !== (zug.typ === 'barriere')) m.wand.abweichung++;
      if (zug.typ === 'barriere') {
        m.wand.gebaut++;
        m.wand.gruende['gebaut'] = (m.wand.gruende['gebaut'] ?? 0) + 1;
      } else {
        const g =
          w.besterWert < 0
            ? 'beste Wand < 0'
            : w.besterWert === 0
              ? 'beste Wand = 0'
              : 'beste Wand 0 < x < 2';
        m.wand.gruende[g] = (m.wand.gruende[g] ?? 0) + 1;
      }
    }
  }

  if (zug.typ !== 'faerben') return;
  // Farbentscheidung des Bots gegen die Alternativen.
  const o = gegnerVon(s);
  const erlaubt = erlaubteFarben(p);
  if (erlaubt.length < 2) return;
  m.fehl.entscheidungen++;
  const gewinne = new Map(erlaubt.map((f) => [f, gewinn(p, s, f)]));
  const sperrend = erlaubt.filter((f) => {
    const q = faerbeFuer(p, s, f);
    return !q.fertig && farbBlockiert(q, o);
  });
  if (sperrend.length > 0 && !sperrend.includes(zug.farbe)) {
    m.fehl.sperreVerpasst.push({ zug: p.zug, sitz: s, gewaehlt: zug.farbe, sperrend });
  }
  // Laesst die Wahl den Bot selbst sperrbar, obwohl eine andere das nicht taete?
  const sperrbar = (f) => {
    const q = faerbeFuer(p, s, f);
    return !q.fertig && sperrfarbenGegen(q, s).length > 0;
  };
  if (sperrbar(zug.farbe)) {
    const sichere = erlaubt.filter((f) => f !== zug.farbe && gewinne.get(f) > 0 && !sperrbar(f));
    if (sichere.length > 0) {
      m.fehl.sperrbarGelassen.push({ zug: p.zug, sitz: s, gewaehlt: zug.farbe, sicher: sichere });
    }
  }
  // Zwei-Zug-Verlust.
  const werte = new Map(erlaubt.map((f) => [f, zweiZugWert(p, s, f)]));
  const bester = Math.max(...werte.values());
  const verlust = bester - werte.get(zug.farbe);
  if (verlust >= 3) {
    const besser = erlaubt.find((f) => werte.get(f) === bester);
    m.fehl.zweiZugVerlust.push({ zug: p.zug, sitz: s, gewaehlt: zug.farbe, besser, verlust });
  }
  // Gleichstand beim gierigen Mass: Der Bot nimmt dann die kleinste Nummer.
  const maxGewinn = Math.max(...gewinne.values());
  const gleich = erlaubt.filter((f) => gewinne.get(f) === maxGewinn);
  if (gleich.length > 1) {
    m.fehl.gleichstand++;
    const ww = gleich.map((f) => werte.get(f));
    if (Math.max(...ww) - werte.get(zug.farbe) >= 2) m.fehl.gleichstandEntscheidend++;
  }
  if (maxGewinn === 0 && erreichbareFreie(p, s, sperrenVon(p)) > 0) m.fehl.leerzugMitAlternative++;
}

function messeNachZug(m, vorher, p, s, zug) {
  if (zug.typ === 'barriere') {
    m.mauern[s]++;
    m.mauerNachZug.push(vorher.zug);
  }
  if (!freieDa(p)) return;
  for (const t of [0, 1]) {
    if (m.eingeschlossenAb[t] === null && eingeschlossen(p, t)) {
      m.eingeschlossenAb[t] = p.zug;
      m.eingeschlossenFrei[t] = p.besitzer.filter((b) => b === null).length;
      m.eingeschlossenDurchMauer[t] = zug.typ === 'barriere';
    }
  }
  if (m.getrenntAb === null) {
    const g = getrennt(p);
    if (g) {
      m.getrenntAb = p.zug;
      m.getrenntDurchMauer = zug.typ === 'barriere';
      m.getrenntExklusiv = g;
      m.getrenntFrei = g[0] + g[1];
    }
  }
}

function abschliessen(m, p) {
  m.fertigMitLeerzuegen = p.leerzuege >= 6 && freieDa(p);
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

const pct = (z, n) => (n === 0 ? '–' : `${((100 * z) / n).toFixed(1)} %`);
const mittel = (xs) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const zahl = (x, st = 2) => (Number.isFinite(x) ? x.toFixed(st) : String(x));

function werteAus(variante, n, partien) {
  const beispiele = (filter, info = () => '') =>
    partien
      .filter(filter)
      .slice(0, BEISPIELE)
      .map((x) => `${x.i}${info(x) ? ` (${info(x)})` : ''}`);

  const r = { variante, n, bereich: `${START}–${START + n - 1}` };
  // 1. Eroeffnung
  r.eckeZweiGleich1 = partien.filter((x) => x.m.zweiGleich[1]).length;
  r.eckeZweiGleich0 = partien.filter((x) => x.m.zweiGleich[0]).length;
  r.vonAnfangGesperrt = partien.filter((x) => x.m.vonAnfangGesperrt).length;
  r.sperrbarNachZug1 = partien.filter((x) => x.m.sperrbarNachZug1).length;
  r.blockiertNachZug = {};
  for (const z of [1, 2, 3, 4]) {
    r.blockiertNachZug[z] = partien.filter((x) => x.m.blockiertNachZug[z] !== undefined).length;
  }
  r.blockiertFrueh = partien.filter((x) =>
    [1, 2].some((z) => x.m.blockiertNachZug[z] !== undefined),
  ).length;
  r.mitBlockade = partien.filter((x) => x.m.blockadeZuege[0] + x.m.blockadeZuege[1] > 0).length;
  r.blockadeZuegeJePartie = mittel(partien.map((x) => x.m.blockadeZuege[0] + x.m.blockadeZuege[1]));
  r.bspSperrbar = beispiele((x) => x.m.sperrbarNachZug1);
  r.bspVonAnfang = beispiele((x) => x.m.vonAnfangGesperrt);
  r.bspBlockiertFrueh = beispiele(
    (x) => [1, 2].some((z) => x.m.blockiertNachZug[z] !== undefined),
    (x) =>
      [1, 2]
        .filter((z) => x.m.blockiertNachZug[z] !== undefined)
        .map((z) => `nach Zug ${z}: Sitz ${x.m.blockiertNachZug[z]}`)
        .join(', '),
  );
  // 2. Einsperren
  r.getrennt = partien.filter((x) => x.m.getrenntAb !== null).length;
  r.getrenntDurchMauer = partien.filter((x) => x.m.getrenntDurchMauer).length;
  r.getrenntZug = mittel(partien.filter((x) => x.m.getrenntAb !== null).map((x) => x.m.getrenntAb));
  r.eingeschlossenSitze = partien.reduce(
    (a, x) => a + (x.m.eingeschlossenAb[0] !== null) + (x.m.eingeschlossenAb[1] !== null),
    0,
  );
  r.eingeschlossenDurchMauer = partien.reduce(
    (a, x) => a + x.m.eingeschlossenDurchMauer[0] + x.m.eingeschlossenDurchMauer[1],
    0,
  );
  r.getrennt10 = partien.filter((x) => (x.m.getrenntFrei ?? 0) >= 10).length;
  r.getrenntFreiMittel = mittel(
    partien.filter((x) => x.m.getrenntAb !== null).map((x) => x.m.getrenntFrei),
  );
  // "Eingesperrt": getrennt mit mind. 10 freien Feldern, und einer hat davon
  // hoechstens ein Viertel — das ist der Fall, den Niklas meint.
  r.eingesperrt = partien.filter(
    (x) =>
      (x.m.getrenntFrei ?? 0) >= 10 && Math.min(...x.m.getrenntExklusiv) * 4 <= x.m.getrenntFrei,
  ).length;
  r.eingesperrtVerlierer = partien.filter((x) => {
    if ((x.m.getrenntFrei ?? 0) < 10 || Math.min(...x.m.getrenntExklusiv) * 4 > x.m.getrenntFrei)
      return false;
    const klein = x.m.getrenntExklusiv[0] < x.m.getrenntExklusiv[1] ? 0 : 1;
    return x.ergebnis.sieger === 1 - klein;
  }).length;
  r.bspEingesperrt = beispiele(
    (x) =>
      (x.m.getrenntFrei ?? 0) >= 10 && Math.min(...x.m.getrenntExklusiv) * 4 <= x.m.getrenntFrei,
    (x) =>
      `ab Zug ${x.m.getrenntAb}${x.m.getrenntDurchMauer ? ' durch Mauer' : ''}, frei ${x.m.getrenntExklusiv.join(':')}, Sieger ${x.ergebnis.sieger}`,
  );
  r.eingeschlossen10 = partien.reduce(
    (a, x) => a + x.m.eingeschlossenFrei.filter((f) => f !== null && f >= 10).length,
    0,
  );
  r.leerzugEnde = partien.filter((x) => x.m.fertigMitLeerzuegen).length;
  r.bspGetrennt = beispiele(
    (x) => x.m.getrenntAb !== null,
    (x) =>
      `ab Zug ${x.m.getrenntAb}${x.m.getrenntDurchMauer ? ' durch Mauer' : ''}, frei ${x.m.getrenntExklusiv.join(':')}`,
  );
  r.bspEingeschlossen = beispiele(
    (x) => x.m.eingeschlossenAb.some((z) => z !== null),
    (x) =>
      [0, 1]
        .filter((s) => x.m.eingeschlossenAb[s] !== null)
        .map((s) => `Sitz ${s} ab Zug ${x.m.eingeschlossenAb[s]}`)
        .join(', '),
  );
  // 3. Anzug
  r.sieg0 = partien.filter((x) => x.ergebnis.sieger === 0).length;
  r.sieg1 = partien.filter((x) => x.ergebnis.sieger === 1).length;
  r.remis = n - r.sieg0 - r.sieg1;
  r.punkte0 = mittel(partien.map((x) => x.ergebnis.punkte[0]));
  r.punkte1 = mittel(partien.map((x) => x.ergebnis.punkte[1]));
  r.zuege = mittel(partien.map((x) => x.ergebnis.zuege));
  // Sieg, wenn Sitz 1 frueh gesperrt war
  const frueh = partien.filter((x) => x.m.blockiertNachZug[1] === 1);
  r.fruehGesperrt1 = frueh.length;
  r.fruehGesperrt1Sieg0 = frueh.filter((x) => x.ergebnis.sieger === 0).length;
  // 4. Mauern
  r.mauernJePartie = mittel(partien.map((x) => x.m.mauern[0] + x.m.mauern[1]));
  r.partienMitMauer = partien.filter((x) => x.m.mauern[0] + x.m.mauern[1] > 0).length;
  r.bspMauer = beispiele(
    (x) => x.m.mauern[0] + x.m.mauern[1] > 0,
    (x) => `Zug ${x.m.mauerNachZug.join(', ')}`,
  );
  const gruende = {};
  let entscheidungen = 0;
  let abweichung = 0;
  const werte = [];
  const teile = [];
  for (const x of partien) {
    for (const [k, v] of Object.entries(x.m.wand.gruende)) gruende[k] = (gruende[k] ?? 0) + v;
    entscheidungen += x.m.wand.entscheidungen;
    abweichung += x.m.wand.abweichung;
    werte.push(...x.m.wand.werte);
    teile.push(...x.m.wand.teile.filter(Boolean));
  }
  r.wandGruende = gruende;
  r.wandEntscheidungen = entscheidungen;
  r.wandAbweichung = abweichung;
  r.wandWertMittel = mittel(werte);
  r.wandWertMax = werte.length ? Math.max(...werte) : null;
  r.wandWertVerteilung = {
    '< 0': werte.filter((w) => w < 0).length,
    '= 0': werte.filter((w) => w === 0).length,
    '0,5': werte.filter((w) => w === 0.5).length,
    '1 bis 1,5': werte.filter((w) => w >= 1 && w < 2).length,
    '>= 2': werte.filter((w) => w >= 2).length,
  };
  r.wandTeileGebietNull = teile.filter((t) => t.gebiet === 0).length;
  r.wandTeile = teile.length;
  r.bspWandKnapp = beispiele(
    (x) => x.m.wand.werte.some((w) => w >= 1 && w < 2),
    (x) => `${x.m.wand.werte.filter((w) => w >= 1 && w < 2).length} Zuege mit Wert 1–1,5`,
  );
  // 5. Fehlzuege
  const f = (k) => partien.reduce((a, x) => a + x.m.fehl[k].length, 0);
  r.farbEntscheidungen = partien.reduce((a, x) => a + x.m.fehl.entscheidungen, 0);
  r.sperreVerpasst = f('sperreVerpasst');
  r.sperreVerpasstPartien = partien.filter((x) => x.m.fehl.sperreVerpasst.length > 0).length;
  r.sperrbarGelassen = f('sperrbarGelassen');
  r.sperrbarGelassenPartien = partien.filter((x) => x.m.fehl.sperrbarGelassen.length > 0).length;
  r.zweiZugVerlust = f('zweiZugVerlust');
  r.zweiZugVerlustPartien = partien.filter((x) => x.m.fehl.zweiZugVerlust.length > 0).length;
  r.zweiZugVerlustMittel = mittel(
    partien.flatMap((x) => x.m.fehl.zweiZugVerlust.map((v) => v.verlust)),
  );
  r.gleichstand = partien.reduce((a, x) => a + x.m.fehl.gleichstand, 0);
  r.gleichstandEntscheidend = partien.reduce((a, x) => a + x.m.fehl.gleichstandEntscheidend, 0);
  const fmt = (v) =>
    `Zug ${v.zug} Sitz ${v.sitz}: ${Object.entries(v)
      .filter(([k]) => !['zug', 'sitz'].includes(k))
      .map(([k, w]) => `${k} ${Array.isArray(w) ? w.join('/') : w}`)
      .join(', ')}`;
  r.bspSperreVerpasst = beispiele(
    (x) => x.m.fehl.sperreVerpasst.length > 0,
    (x) => fmt(x.m.fehl.sperreVerpasst[0]),
  );
  r.bspSperrbarGelassen = beispiele(
    (x) => x.m.fehl.sperrbarGelassen.length > 0,
    (x) => fmt(x.m.fehl.sperrbarGelassen[0]),
  );
  r.bspZweiZug = partien
    .flatMap((x) => x.m.fehl.zweiZugVerlust.map((v) => ({ i: x.i, v })))
    .sort((a, b) => b.v.verlust - a.v.verlust || a.i - b.i)
    .slice(0, BEISPIELE)
    .map(({ i, v }) => `${i} (${fmt(v)})`);
  r.ergebnisse = partien.map((x) => x.ergebnis.sieger);
  return r;
}

/** Gegenproben: eine Politik gegen den Bot, auf beiden Sitzen, gleiche Saaten. */
function gegenprobe(politik, basis, laeufe) {
  const raus = { politik, sitz: [] };
  for (const sitz of [0, 1]) {
    let siege = 0;
    let remis = 0;
    let gedreht = 0; // Saaten, deren Ausgang sich gegen Bot-gegen-Bot aendert
    let verloren = 0; // ... und zwar zuungunsten der Politik
    let anders = 0; // Partien, in denen die Politik mind. einmal anders zog
    const bsp = [];
    for (const { i, ergebnis } of laeufe[sitz]) {
      if (ergebnis.abweichungen > 0) anders++;
      if (ergebnis.sieger === sitz) siege++;
      else if (ergebnis.sieger === null) remis++;
      const vorher = basis[i - START];
      if (vorher !== sitz && ergebnis.sieger === sitz) {
        gedreht++;
        if (bsp.length < BEISPIELE) bsp.push(i);
      }
      if (vorher === sitz && ergebnis.sieger !== sitz) verloren++;
    }
    raus.sitz.push({ siege, remis, gedreht, verloren, anders, bsp });
  }
  return raus;
}

// ---------------------------------------------------------------------------
// Einzelpartie zeigen
// ---------------------------------------------------------------------------

function brett(p) {
  const { spalten, zeilen } = p.regeln;
  const sterne = new Set(p.sterne);
  const sperren = sperrenVon(p);
  const zeilenText = [];
  for (let y = 0; y < zeilen; y++) {
    let z = '  ';
    let unten = '  ';
    for (let x = 0; x < spalten; x++) {
      const platz = y * spalten + x;
      const b = p.besitzer[platz];
      const c = b === null ? String(p.feld[platz]) : b === 0 ? 'A' : 'B';
      z += c + (sterne.has(platz) ? '*' : ' ');
      if (x < spalten - 1) z += sperren.has(kante(platz, platz + 1)) ? '|' : ' ';
      if (y < zeilen - 1) unten += (sperren.has(kante(platz, platz + spalten)) ? '--' : '  ') + ' ';
    }
    zeilenText.push(z);
    if (y < zeilen - 1 && unten.trim()) zeilenText.push(unten);
  }
  return zeilenText.join('\n');
}

function zeige(arg) {
  const [variante, nr] = arg.split(':');
  const i = Number(nr);
  console.log(`Filler ${variante}, Saatindex ${i}, Saat ${saatHex(i)}`);
  console.log(
    'Brett: Ziffer = freies Feld dieser Farbe, A = Sitz 0, B = Sitz 1, * = Stern, | und -- = Mauer\n',
  );
  const p0 = neuePartie(variante, i);
  console.log(brett(p0));
  console.log(`Startfarben: A ${p0.farbe[0]}, B ${p0.farbe[1]}\n`);
  spiele(variante, i, ['bot', 'bot'], false, (vorher, p, s, zug) => {
    const wer = s === 0 ? 'A' : 'B';
    if (zug.typ === 'barriere') {
      console.log(`Zug ${vorher.zug} ${wer}: Mauer ${zug.von}|${zug.nach}`);
      return;
    }
    const blockiert =
      !vorher.mauerDiesenZug && farbBlockiert(vorher, s) ? '  [war ohne nutzbare Farbe]' : '';
    const erlaubt = erlaubteFarben(vorher)
      .map((f) => `${f}:${gewinn(vorher, s, f)}`)
      .join(' ');
    console.log(
      `Zug ${vorher.zug} ${wer}: Farbe ${zug.farbe} (+${p.punkte[s] - vorher.punkte[s]})  Auswahl ${erlaubt}${blockiert}`,
    );
    if (vorher.zug < 6 || p.fertig) console.log(brett(p) + '\n');
  });
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

if (!isMainThread) {
  // Arbeitsfaden: spielt einen Saatbereich und schickt die Rohdaten zurueck.
  const { variante, von, bis, politiken, messen } = workerData;
  const raus = [];
  for (let i = von; i < bis; i++) {
    const { ergebnis, messung } = spiele(variante, i, politiken, messen);
    raus.push({ i, ergebnis, m: messung });
  }
  parentPort.postMessage(raus);
} else {
  await hauptlauf();
}

async function hauptlauf() {
  if (ZEIGE) {
    zeige(ZEIGE);
    return;
  }

  /*
   * Parallel in Arbeitsfaeden: Eine Extreme-Partie kostet rund eine Sekunde
   * (der Bot bewertet jede erlaubte Wand), die Gegenproben verneunfachen das.
   * Die Saaten haengen am Index, nicht am Faden — das Ergebnis ist bei jeder
   * Fadenzahl dasselbe.
   */
  const FAEDEN = Math.max(1, schalter('faeden', Math.min(6, os.cpus().length - 1)));
  const auftraege = [];
  const auftrag = (variante, politiken, messen) => {
    const n = ANZAHL[variante];
    const stueck = Math.max(10, Math.ceil(n / (FAEDEN * 4)));
    const teile = [];
    for (let von = START; von < START + n; von += stueck) {
      const t = {
        variante,
        von,
        bis: Math.min(START + n, von + stueck),
        politiken,
        messen,
        raus: null,
      };
      auftraege.push(t);
      teile.push(t);
    }
    return () => teile.flatMap((t) => t.raus);
  };
  const plan = [];
  for (const variante of ['extreme', 'klar', 'build']) {
    if (!ANZAHL[variante]) continue;
    const basis = auftrag(variante, ['bot', 'bot'], true);
    const liste = [];
    if (MIT_AUSBEUTERN) {
      const politiken = ['eroeffnungssperre', 'sperrer', 'zweizug'];
      if (variante !== 'klar') politiken.push('mauerer');
      for (const pol of politiken) {
        liste.push({
          pol,
          laeufe: [auftrag(variante, [pol, 'bot'], false), auftrag(variante, ['bot', pol], false)],
        });
      }
    }
    plan.push({ variante, basis, liste });
  }
  const t0 = Date.now();
  let naechster = 0;
  let fertig = 0;
  await Promise.all(
    Array.from({ length: FAEDEN }, async () => {
      while (naechster < auftraege.length) {
        const t = auftraege[naechster++];
        const { raus: _r, ...daten } = t;
        t.raus = await new Promise((ok, fehler) => {
          const w = new Worker(fileURLToPath(import.meta.url), { workerData: daten, argv });
          w.once('message', ok);
          w.once('error', fehler);
        });
        fertig++;
        process.stderr.write(
          `\r${fertig}/${auftraege.length} Teilauftraege, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
        );
      }
    }),
  );
  process.stderr.write('\n');

  const ergebnisse = [];
  const proben = {};
  for (const { variante, basis, liste } of plan) {
    const r = werteAus(variante, ANZAHL[variante], basis());
    ergebnisse.push(r);
    proben[variante] = liste.map(({ pol, laeufe }) =>
      gegenprobe(
        pol,
        r.ergebnisse,
        laeufe.map((l) => l()),
      ),
    );
  }

  if (ALS_JSON) {
    console.log(
      JSON.stringify(
        { ergebnisse: ergebnisse.map(({ ergebnisse: _e, ...r }) => r), proben },
        null,
        2,
      ),
    );
    return;
  }

  const tabelle = (kopf, zeilen) => {
    const breiten = kopf.map((k, j) =>
      Math.max(k.length, ...zeilen.map((z) => String(z[j]).length)),
    );
    const linie = (z) => '| ' + z.map((c, j) => String(c).padEnd(breiten[j])).join(' | ') + ' |';
    console.log(linie(kopf));
    console.log('|' + breiten.map((b) => '-'.repeat(b + 2)).join('|') + '|');
    for (const z of zeilen) console.log(linie(z));
    console.log('');
  };
  const spalteJe = (f) => ergebnisse.map((r) => f(r));
  const kopf = ['Messgroesse', ...ergebnisse.map((r) => `${r.variante} (#${r.bereich}, n=${r.n})`)];

  console.log(`# Filler: Bot gegen Bot (Saat i = saatHex(i), Mauerschwelle ${WAND_SCHWELLE})\n`);

  console.log('## 1. Eroeffnung: Sitz ohne nutzbare Farbe\n');
  tabelle(kopf, [
    ['Ecke Sitz 1: beide Nachbarn gleichfarbig', ...spalteJe((r) => pct(r.eckeZweiGleich1, r.n))],
    ['Ecke Sitz 0: beide Nachbarn gleichfarbig', ...spalteJe((r) => pct(r.eckeZweiGleich0, r.n))],
    [
      'Eckfarbe 0 = beide Nachbarn 1 (harmlos: 0 muss umfaerben)',
      ...spalteJe((r) => pct(r.vonAnfangGesperrt, r.n)),
    ],
    ['Sitz 0 KOENNTE Sitz 1 mit Zug 1 sperren', ...spalteJe((r) => pct(r.sperrbarNachZug1, r.n))],
    [
      'ohne nutzbare Farbe nach Zug 1 (Sitz 1 am Zug)',
      ...spalteJe((r) => pct(r.blockiertNachZug[1], r.n)),
    ],
    [
      'ohne nutzbare Farbe nach Zug 2 (Sitz 0 am Zug)',
      ...spalteJe((r) => pct(r.blockiertNachZug[2], r.n)),
    ],
    [
      'ohne nutzbare Farbe nach Zug 3 (Sitz 1 am Zug)',
      ...spalteJe((r) => pct(r.blockiertNachZug[3], r.n)),
    ],
    ['ohne nutzbare Farbe nach Zug 1 oder 2', ...spalteJe((r) => pct(r.blockiertFrueh, r.n))],
    [
      'Partien mit mind. einem Zug ohne nutzbare Farbe',
      ...spalteJe((r) => pct(r.mitBlockade, r.n)),
    ],
    ['solche Zuege je Partie', ...spalteJe((r) => zahl(r.blockadeZuegeJePartie))],
  ]);

  console.log('## 2. Abgetrennt und eingeschlossen (solange noch freie Felder liegen)\n');
  tabelle(kopf, [
    [
      'Partien: kein freies Feld mehr fuer beide (Fronten zu)',
      ...spalteJe((r) => pct(r.getrennt, r.n)),
    ],
    [
      '  ab Zug / freie Felder dann (Mittel)',
      ...spalteJe((r) => `${zahl(r.getrenntZug, 1)} / ${zahl(r.getrenntFreiMittel, 1)}`),
    ],
    ['  davon direkt durch eine Mauer', ...spalteJe((r) => pct(r.getrenntDurchMauer, r.n))],
    ['  davon mit >= 10 freien Feldern', ...spalteJe((r) => pct(r.getrennt10, r.n))],
    [
      'EINGESPERRT: >= 10 frei, einer hat <= 1/4 davon',
      ...spalteJe((r) => pct(r.eingesperrt, r.n)),
    ],
    [
      '  davon gewinnt der Eingesperrte nicht',
      ...spalteJe((r) => `${r.eingesperrtVerlierer} von ${r.eingesperrt}`),
    ],
    [
      'Sitze ohne erreichbares Feld (von 2n), Endspiel mitgezaehlt',
      ...spalteJe((r) => pct(r.eingeschlossenSitze, 2 * r.n)),
    ],
    [
      '  davon mit >= 10 freien Feldern auf dem Brett',
      ...spalteJe((r) => String(r.eingeschlossen10)),
    ],
    ['  davon direkt durch eine Mauer', ...spalteJe((r) => String(r.eingeschlossenDurchMauer))],
    ['Ende ueber Leerzug-Deckel mit freien Feldern', ...spalteJe((r) => pct(r.leerzugEnde, r.n))],
  ]);

  console.log('## 3. Anzug: Sitz 0 gegen Sitz 1\n');
  tabelle(kopf, [
    ['Sieg Sitz 0 (zieht zuerst)', ...spalteJe((r) => pct(r.sieg0, r.n))],
    ['Sieg Sitz 1', ...spalteJe((r) => pct(r.sieg1, r.n))],
    ['Unentschieden', ...spalteJe((r) => pct(r.remis, r.n))],
    [
      'Punkte Sitz 0 / Sitz 1 im Mittel',
      ...spalteJe((r) => `${zahl(r.punkte0, 1)} / ${zahl(r.punkte1, 1)}`),
    ],
    ['Zuege je Partie', ...spalteJe((r) => zahl(r.zuege, 1))],
    [
      'Sitz 1 nach Zug 1 gesperrt: Partien / davon Sieg 0',
      ...spalteJe((r) => `${r.fruehGesperrt1} / ${pct(r.fruehGesperrt1Sieg0, r.fruehGesperrt1)}`),
    ],
  ]);

  const mitMauern = ergebnisse.filter((r) => r.variante !== 'klar');
  if (mitMauern.length) {
    console.log('## 4. Mauern des Bots\n');
    const k2 = ['Messgroesse', ...mitMauern.map((r) => `${r.variante} (n=${r.n})`)];
    const je = (f) => mitMauern.map(f);
    const alleGruende = [...new Set(mitMauern.flatMap((r) => Object.keys(r.wandGruende)))].sort();
    tabelle(k2, [
      ['Mauern je Partie (beide Sitze)', ...je((r) => zahl(r.mauernJePartie))],
      ['Partien mit mind. einer Mauer', ...je((r) => pct(r.partienMitMauer, r.n))],
      ['Zuganfaenge mit Kandidaten', ...je((r) => String(r.wandEntscheidungen))],
      [
        'bester Wandwert im Mittel / hoechstens',
        ...je((r) => `${zahl(r.wandWertMittel)} / ${zahl(r.wandWertMax)}`),
      ],
      ...Object.keys(mitMauern[0].wandWertVerteilung).map((k) => [
        `  bester Wert ${k}`,
        ...je((r) => pct(r.wandWertVerteilung[k], r.wandEntscheidungen)),
      ]),
      [
        'beste Wand ohne Gebietsanteil (nur Zugterm)',
        ...je((r) => pct(r.wandTeileGebietNull, r.wandTeile)),
      ],
      ...alleGruende.map((g) => [`Grund: ${g}`, ...je((r) => String(r.wandGruende[g] ?? 0))]),
      ['Abweichung Abschrift gegen botZug (muss 0 sein)', ...je((r) => String(r.wandAbweichung))],
    ]);
  }

  console.log('## 5. Farbwahl des Bots gegen Alternativen\n');
  tabelle(kopf, [
    ['Farbentscheidungen (>= 2 erlaubte Farben)', ...spalteJe((r) => String(r.farbEntscheidungen))],
    [
      'Sperre verpasst (Zuege / Partien)',
      ...spalteJe((r) => `${r.sperreVerpasst} / ${pct(r.sperreVerpasstPartien, r.n)}`),
    ],
    [
      'sich sperrbar gemacht, sichere Farbe da (Zuege / Partien)',
      ...spalteJe((r) => `${r.sperrbarGelassen} / ${pct(r.sperrbarGelassenPartien, r.n)}`),
    ],
    [
      '2-Zug-Verlust >= 3 Punkte (Zuege / Partien)',
      ...spalteJe((r) => `${r.zweiZugVerlust} / ${pct(r.zweiZugVerlustPartien, r.n)}`),
    ],
    ['  Verlust im Mittel', ...spalteJe((r) => zahl(r.zweiZugVerlustMittel, 1))],
    [
      'Gleichstand beim Gewinn (kleinste Nummer gewinnt)',
      ...spalteJe((r) => String(r.gleichstand)),
    ],
    ['  davon 2-Zug-Wert >= 2 schlechter', ...spalteJe((r) => String(r.gleichstandEntscheidend))],
  ]);

  if (MIT_AUSBEUTERN) {
    console.log('## 6. Gegenproben: eine geaenderte Entscheidung gegen den Bot (gleiche Saaten)\n');
    for (const r of ergebnisse) {
      const basis0 = pct(r.sieg0, r.n);
      const basis1 = pct(r.sieg1, r.n);
      tabelle(
        [
          `${r.variante} (#${r.bereich})`,
          `als Sitz 0 (Bot-Bot ${basis0})`,
          `als Sitz 1 (Bot-Bot ${basis1})`,
          'Partien mit Abweichung 0 / 1',
          'gewonnene Saaten (Bsp.)',
        ],
        proben[r.variante].map((pr) => [
          pr.politik,
          `${pct(pr.sitz[0].siege, r.n)} (+${pr.sitz[0].gedreht} −${pr.sitz[0].verloren})`,
          `${pct(pr.sitz[1].siege, r.n)} (+${pr.sitz[1].gedreht} −${pr.sitz[1].verloren})`,
          `${pct(pr.sitz[0].anders, r.n)} / ${pct(pr.sitz[1].anders, r.n)}`,
          [
            ...pr.sitz[0].bsp.slice(0, 3).map((i) => `${i}@0`),
            ...pr.sitz[1].bsp.slice(0, 2).map((i) => `${i}@1`),
          ].join(' '),
        ]),
      );
    }
  }

  console.log('## 7. Beispiel-Saaten (Saatindex; nachspielen mit --zeige <spielart>:<index>)\n');
  for (const r of ergebnisse) {
    console.log(`### ${r.variante}`);
    const liste = [
      ['Sitz 0 koennte Sitz 1 mit Zug 1 sperren', r.bspSperrbar],
      ['Eckfarbe 0 = beide Nachbarn 1', r.bspVonAnfang],
      ['ohne nutzbare Farbe nach Zug 1/2', r.bspBlockiertFrueh],
      ['Fronten zu', r.bspGetrennt],
      ['eingesperrt (>= 10 frei, <= 1/4)', r.bspEingesperrt],
      ['Sitz eingeschlossen', r.bspEingeschlossen],
      ['Partie mit Mauer', r.bspMauer],
      ['Wand knapp unter Schwelle', r.bspWandKnapp],
      ['Sperre verpasst', r.bspSperreVerpasst],
      ['sich sperrbar gemacht', r.bspSperrbarGelassen],
      ['groesster 2-Zug-Verlust', r.bspZweiZug],
    ];
    for (const [titel, bsp] of liste) {
      if (r.variante === 'klar' && /Mauer|Wand/.test(titel)) continue;
      console.log(`- ${titel}: ${bsp.length ? bsp.join('; ') : '—'}`);
    }
    console.log('');
  }
}
