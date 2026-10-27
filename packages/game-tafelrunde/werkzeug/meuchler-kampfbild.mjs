/**
 * Was ein Meuchler im Kampf wirklich ausrichtet — gelesen aus den
 * Ablaufprotokollen echter Bot-Partien.
 *
 *     npm run build --workspace @brauweg/game-api
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/meuchler-kampfbild.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --partien 1000          Wie viele Partien.
 *     --sitze 4               Sitze am Tisch, 2 bis 8.
 *     --besetzung normal      normal | sanft | hart | gemischt
 *     --saat meuchler-kampfbild-v1   Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --einheiten a,b,...     Welche Einheiten ausgewertet werden (Vorgabe unten).
 *     --stufe 1               Nur Auftritte dieser Sternstufe (Vorgabe: alle).
 *     --meuchlerziel naechster   naechster | fernkaempfer — `meuchlerZielwahl`
 *                             im Kampfregler, ein Vergleichsschalter
 *                             (docs/TAFELRUNDE-MEUCHLER-ZIELWAHL-PROBE.md).
 *     --json                  Statt der Tabellen die rohe Auswertung als JSON.
 *
 * WARUM DIE PROTOKOLLE UND KEIN NACHGEBAUTER KAMPF: Jeder Kampfbericht traegt
 * `start` (wer steht wo, mit wie viel Leben) und die vollstaendige
 * Ereignisliste. Daraus laesst sich jede Frage dieses Werkzeugs beantworten —
 * erster Hieb, Hiebe, Schaden, Tod, Ziel —, ohne eine Zeile von kampf.ts
 * nachzubauen. Ein Messstand mit eigener Kampfrechnung misst seine Kopie.
 *
 * WARUM ECHTE PARTIEN und nicht das Monokultur-Turnier (werkzeug/turnier.mjs):
 * Die Marke Meuchler faellt in der Partie ab (x0,63), und dort stehen Meuchler
 * zwischen Wachen, Schuetzen und Heilern, so aufgestellt, wie der Bot sie
 * aufstellt (`wunschreihe` in bot.ts: Reihe 1, am Rand). Drei gegen drei
 * derselben Einheit kennt weder eine Front noch eine hintere Reihe — und die
 * Frage "wen trifft er" hat dort nur eine Antwort.
 *
 * SCHADEN IST WIRKSAMER SCHADEN: Ein Treffer auf ein Ziel mit 20 Leben zaehlt
 * 20, nicht 68. Das Protokoll nennt den Rohwert (`schaden`) und das Leben
 * danach; wirksam ist die Differenz zum Leben davor, mitgefuehrt ueber
 * Treffer UND Heilungen.
 *
 * Der Lauf ist vollstaendig bestimmt: dieselben Schalter ergeben dieselben
 * Tabellen, auf jedem Rechner (game-api, Grundsatz 1).
 */

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const MESSSTAND = resolve(HIER, '../dist/test/messen.js');

if (!existsSync(MESSSTAND)) {
  console.error('Der Messstand fehlt: ' + MESSSTAND);
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

// Ueber `pathToFileURL`: unter Windows haelt der ESM-Lader "C:" sonst fuer
// ein Protokoll (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, gangartFuer } = await laden(MESSSTAND);
const {
  DEFAULT_REGELN,
  STANDARD_REGLER,
  darfHandeln,
  einheit,
  erstellePartie,
  fuehreAus,
  gesamtkosten,
  lebendeSitze,
  loeseKampfAuf,
  sichtFuer,
  vonArena,
} = await laden(resolve(HIER, '../dist/src/index.js'));
const { botZug } = await laden(resolve(HIER, '../dist/src/bot.js'));

// ---------------------------------------------------------------------------
// Schalter
// ---------------------------------------------------------------------------

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const PARTIEN = Number(schalter('partien', '1000'));
const SITZZAHL = Number(schalter('sitze', '4'));
const BESETZUNG = schalter('besetzung', 'normal');
const SAAT_BASIS = schalter('saat', 'meuchler-kampfbild-v1');
const ALS_JSON = process.argv.includes('--json');
const NUR_STUFE = schalter('stufe', null) === null ? null : Number(schalter('stufe', null));

/*
 * Die vier Einheiten mit der ROLLE Meuchler, dazu der Nachtpfeil: Er traegt
 * die MARKE Meuchler (und zaehlt damit in der Markenquote x0,63 mit), kaempft
 * aber als Schuetze mit Reichweite 3. Der Knochenspaeher ist umgekehrt Rolle
 * Meuchler mit Marke Untot. Zum Vergleich je Kostenstufe eine Wache und ein
 * Schuetze — die Einheit, die die Front haelt, und die, die ein Meuchler
 * treffen SOLLTE.
 */
const EINHEITEN = schalter(
  'einheiten',
  [
    'gassendieb',
    'dorfwache',
    'astschuetze',
    'schattenklinge',
    'knochenspaeher',
    'nachtpfeil',
    'grimmbart',
    'bogenmeisterin',
    'klingentaenzerin',
    'wurzelriese',
    'drachenkind',
  ].join(','),
)
  .split(',')
  .filter(Boolean);

if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}
for (const id of EINHEITEN) einheit(id); // wirft bei einem Tippfehler
const REGLER = {
  ...STANDARD_REGLER,
  meuchlerZielwahl: schalter('meuchlerziel', STANDARD_REGLER.meuchlerZielwahl),
};
if (!['naechster', 'fernkaempfer'].includes(REGLER.meuchlerZielwahl)) {
  console.error('--meuchlerziel kennt nur naechster und fernkaempfer');
  process.exit(1);
}

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);
const MAX_SCHLEIFEN = 400;
const MAX_ZUEGE_JE_SITZ = 200;
const BRETT_SPALTEN = 5;

// ---------------------------------------------------------------------------
// Sammeln
// ---------------------------------------------------------------------------

/** Je Einheit eine Liste von Auftritten — ein Auftritt = eine Einheit in einem Kampf. */
const auftritte = new Map(EINHEITEN.map((id) => [id, []]));

/** Brettreihe (0 = vorn) und Randlage eines Startplatzes. */
function lage(stand) {
  const brettPlatz = vonArena(stand.platz, stand.seite);
  const spalte = brettPlatz % BRETT_SPALTEN;
  return {
    reihe: Math.floor(brettPlatz / BRETT_SPALTEN),
    rand: spalte === 0 || spalte === BRETT_SPALTEN - 1,
  };
}

function werteBerichtAus(bericht) {
  const start = new Map(bericht.start.map((s) => [s.id, s]));
  const leben = new Map(bericht.start.map((s) => [s.id, s.leben]));
  const rolleVon = (id) => einheit(start.get(id).einheitId).rolle;
  const fernVon = (id) => einheit(start.get(id).einheitId).reichweite > 1;
  const lageVon = new Map(bericht.start.map((s) => [s.id, lage(s)]));

  // Nur fuer die beobachteten Einheiten wird mitgeschrieben.
  const spur = new Map();
  for (const s of bericht.start) {
    if (!auftritte.has(s.einheitId)) continue;
    if (NUR_STUFE !== null && s.stufe !== NUR_STUFE) continue;
    const gegner = bericht.start.filter((g) => g.seite !== s.seite);
    spur.set(s.id, {
      einheitId: s.einheitId,
      stufe: s.stufe,
      kosten: gesamtkosten(s.einheitId, s.stufe),
      startReihe: lageVon.get(s.id).reihe,
      amRand: lageVon.get(s.id).rand,
      gegnerHatFern: gegner.some((g) => fernVon(g.id)),
      ersterHieb: null,
      schritteVorHieb: 0,
      schritte: 0,
      hiebe: 0,
      schaden: 0,
      eingesteckt: 0,
      kills: 0,
      tod: null,
      toeterRolle: null,
      zielRolle: {},
      zielVorn: 0,
      zielFern: 0,
      zielErstesFern: null,
      dauer: bericht.dauerMs,
    });
  }
  let letzterTreffer = null;

  for (const e of bericht.ereignisse) {
    if (e.art === 'bewegung') {
      const t = spur.get(e.wer);
      if (t) {
        t.schritte++;
        if (t.ersterHieb === null) t.schritteVorHieb++;
      }
    } else if (e.art === 'heilung') {
      leben.set(e.ziel, e.lebenDanach);
    } else if (e.art === 'treffer') {
      const wirksam = leben.get(e.ziel) - e.lebenDanach;
      leben.set(e.ziel, e.lebenDanach);
      letzterTreffer = e;
      const opfer = spur.get(e.ziel);
      if (opfer) opfer.eingesteckt += wirksam;
      const t = spur.get(e.wer);
      if (!t) continue;
      if (t.ersterHieb === null) {
        t.ersterHieb = e.zeitMs;
        t.zielErstesFern = fernVon(e.ziel);
      }
      t.hiebe++;
      t.schaden += wirksam;
      if (e.lebenDanach === 0) t.kills++;
      const r = rolleVon(e.ziel);
      t.zielRolle[r] = (t.zielRolle[r] ?? 0) + 1;
      if (lageVon.get(e.ziel).reihe === 0) t.zielVorn++;
      if (fernVon(e.ziel)) t.zielFern++;
    } else if (e.art === 'tod') {
      const t = spur.get(e.wer);
      if (!t) continue;
      t.tod = e.zeitMs;
      // `tod` kommt immer unmittelbar nach dem toedlichen Treffer (kampf.ts).
      if (letzterTreffer && letzterTreffer.ziel === e.wer) {
        t.toeterRolle = rolleVon(letzterTreffer.wer);
      }
    }
  }
  for (const t of spur.values()) auftritte.get(t.einheitId).push(t);
}

const beginn = Date.now();
let kaempfe = 0;
for (let i = 0; i < PARTIEN; i++) {
  let p = erstellePartie(DEFAULT_REGELN, SITZE, `${SAAT_BASIS}-${i}`, REGLER);
  for (let schleife = 0; schleife < MAX_SCHLEIFEN && !p.fertig; schleife++) {
    for (const sitz of lebendeSitze(p)) {
      for (let z = 0; z < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); z++) {
        p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), gangartFuer(BESETZUNG, sitz)));
      }
    }
    if (p.phase !== 'kampf') break;
    for (const k of p.kaempfe) {
      kaempfe++;
      werteBerichtAus(k.bericht);
    }
    p = loeseKampfAuf(p);
  }
}
const rechenzeit = Date.now() - beginn;

// ---------------------------------------------------------------------------
// Verdichten
// ---------------------------------------------------------------------------

function median(zahlen) {
  if (zahlen.length === 0) return NaN;
  const s = [...zahlen].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function perzentil(zahlen, anteil) {
  if (zahlen.length === 0) return NaN;
  const s = [...zahlen].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(anteil * s.length))];
}
const summe = (xs) => xs.reduce((a, b) => a + b, 0);
const schnitt = (xs) => (xs.length === 0 ? NaN : summe(xs) / xs.length);

function verdichte(id, liste) {
  const n = liste.length;
  const gehauen = liste.filter((t) => t.ersterHieb !== null);
  const tot = liste.filter((t) => t.tod !== null);
  const totOhneHieb = liste.filter((t) => t.tod !== null && t.ersterHieb === null);
  const hiebeGesamt = summe(liste.map((t) => t.hiebe));
  const zielRolle = {};
  for (const t of liste) {
    for (const [r, z] of Object.entries(t.zielRolle)) zielRolle[r] = (zielRolle[r] ?? 0) + z;
  }
  const mitFern = liste.filter((t) => t.gegnerHatFern);
  const mitFernGehauen = mitFern.filter((t) => t.ersterHieb !== null);
  const toeter = {};
  for (const t of tot) if (t.toeterRolle) toeter[t.toeterRolle] = (toeter[t.toeterRolle] ?? 0) + 1;
  const e = einheit(id);
  return {
    id,
    rolle: e.rolle,
    kosten: e.kosten,
    auftritte: n,
    stufeSchnitt: schnitt(liste.map((t) => t.stufe)),
    startReihe: schnitt(liste.map((t) => t.startReihe)),
    amRand: liste.filter((t) => t.amRand).length / n,
    ersterHiebMedian: median(gehauen.map((t) => t.ersterHieb)),
    ersterHiebP10: perzentil(gehauen.map((t) => t.ersterHieb), 0.1),
    ersterHiebP90: perzentil(gehauen.map((t) => t.ersterHieb), 0.9),
    schritteVorHieb: schnitt(gehauen.map((t) => t.schritteVorHieb)),
    nieGehauen: (n - gehauen.length) / n,
    totVorHieb: totOhneHieb.length / n,
    hiebe: hiebeGesamt / n,
    schaden: schnitt(liste.map((t) => t.schaden)),
    schadenJeGold: summe(liste.map((t) => t.schaden)) / summe(liste.map((t) => t.kosten)),
    eingestecktJeGold: summe(liste.map((t) => t.eingesteckt)) / summe(liste.map((t) => t.kosten)),
    // Schaden je Sekunde, die die Einheit im Kampf stand — trennt "trifft
    // hart" von "lebt lange".
    schadenJeSekunde:
      summe(liste.map((t) => t.schaden)) / (summe(liste.map((t) => t.tod ?? t.dauer)) / 1000),
    // Wie schnell die Einheit Leben verliert, solange sie steht: misst, ob der
    // Gegner sie ins Visier nimmt — unabhaengig davon, wie viel sie aushaelt.
    eingestecktJeSekunde:
      summe(liste.map((t) => t.eingesteckt)) / (summe(liste.map((t) => t.tod ?? t.dauer)) / 1000),
    kills: schnitt(liste.map((t) => t.kills)),
    stirbt: tot.length / n,
    lebensdauerMedianTote: median(tot.map((t) => t.tod)),
    // Lebensdauer im Kampf: bis zum Tod, sonst bis zum Kampfende (zensiert).
    lebensdauerSchnitt: schnitt(liste.map((t) => t.tod ?? t.dauer)),
    zielVorn: summe(liste.map((t) => t.zielVorn)) / hiebeGesamt,
    zielFern: summe(liste.map((t) => t.zielFern)) / hiebeGesamt,
    zielRolle: Object.fromEntries(
      Object.entries(zielRolle).map(([r, z]) => [r, z / hiebeGesamt]),
    ),
    gegnerHatFern: mitFern.length / n,
    erstesZielFernWennDa:
      mitFernGehauen.filter((t) => t.zielErstesFern).length / Math.max(1, mitFernGehauen.length),
    zielFernWennDa:
      summe(mitFern.map((t) => t.zielFern)) / Math.max(1, summe(mitFern.map((t) => t.hiebe))),
    toeter: Object.fromEntries(Object.entries(toeter).map(([r, z]) => [r, z / tot.length])),
  };
}

const befund = EINHEITEN.map((id) => verdichte(id, auftritte.get(id)));

if (ALS_JSON) {
  console.log(JSON.stringify({ partien: PARTIEN, sitze: SITZZAHL, kaempfe, befund }, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const pz = (x) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '-');
const s1 = (ms) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(1)} s` : '-');
const z1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
// Ohne Tausenderpunkt: `komma` unten macht aus jedem Punkt zwischen Ziffern ein Komma.
const z0 = (x) => (Number.isFinite(x) ? String(Math.round(x)) : '-');
const komma = (s) => s.replace(/(\d)\.(\d)/g, '$1,$2');

function tabelle(kopf, zeilen) {
  console.log('| ' + kopf.join(' | ') + ' |');
  console.log('|' + kopf.map(() => '---').join('|') + '|');
  for (const z of zeilen) console.log('| ' + z.map((x) => komma(String(x))).join(' | ') + ' |');
  console.log('');
}

console.log('');
console.log('Tafelrunde — Kampfbild der Meuchler (aus den Ablaufprotokollen)');
console.log(
  `${PARTIEN} Partien zu ${SITZZAHL}, ${kaempfe} Kaempfe, Besetzung ${BESETZUNG}, ` +
    `Saatbasis "${SAAT_BASIS}", ${NUR_STUFE === null ? "alle Stufen" : "nur Stufe " + NUR_STUFE}, ${(rechenzeit / 1000).toFixed(1)} s`,
);
// Wie in ausgewogenheit.mjs: Ein abweichender Stand sagt es in der Kopfzeile.
if (REGLER.meuchlerZielwahl !== STANDARD_REGLER.meuchlerZielwahl) {
  console.log(`ABWEICHENDER STAND: Meuchler-Zielwahl ${REGLER.meuchlerZielwahl}`);
}
console.log('');

const name = (b) => `${b.id} (${b.rolle}, ${b.kosten})`;

console.log('Anmarsch und Wirkung');
tabelle(
  [
    'Einheit',
    'Auftritte',
    'Stufe',
    'Startreihe',
    'am Rand',
    '1. Hieb Median',
    '1. Hieb P10–P90',
    'Schritte bis Hieb',
    'tot vor 1. Hieb',
    'nie gehauen',
    'Hiebe',
    'Schaden',
    'Schaden je Gold',
    'Schaden je s',
    'eingesteckt je Gold',
    'Kills',
  ],
  befund.map((b) => [
    name(b),
    b.auftritte,
    z1(b.stufeSchnitt),
    z1(b.startReihe),
    pz(b.amRand),
    s1(b.ersterHiebMedian),
    `${s1(b.ersterHiebP10)}–${s1(b.ersterHiebP90)}`,
    z1(b.schritteVorHieb),
    pz(b.totVorHieb),
    pz(b.nieGehauen),
    z1(b.hiebe),
    z0(b.schaden),
    z0(b.schadenJeGold),
    z0(b.schadenJeSekunde),
    z0(b.eingestecktJeGold),
    z1(b.kills),
  ]),
);

console.log('Lebensdauer');
tabelle(
  ['Einheit', 'stirbt', 'Tod Median (Tote)', 'Lebensdauer Schnitt', 'eingesteckt je s', 'getoetet von'],
  befund.map((b) => [
    name(b),
    pz(b.stirbt),
    s1(b.lebensdauerMedianTote),
    s1(b.lebensdauerSchnitt),
    z0(b.eingestecktJeSekunde),
    Object.entries(b.toeter)
      .sort((x, y) => y[1] - x[1])
      .map(([r, a]) => `${r} ${pz(a)}`)
      .join(', '),
  ]),
);

console.log('Zielwahl (Anteil der Hiebe)');
tabelle(
  [
    'Einheit',
    'auf Reihe 0',
    'auf Fernkaempfer',
    'Gegner hat Fernkaempfer',
    'davon: 1. Hieb auf Fern',
    'davon: Hiebe auf Fern',
    'nach Rolle',
  ],
  befund.map((b) => [
    name(b),
    pz(b.zielVorn),
    pz(b.zielFern),
    pz(b.gegnerHatFern),
    pz(b.erstesZielFernWennDa),
    pz(b.zielFernWennDa),
    Object.entries(b.zielRolle)
      .sort((x, y) => y[1] - x[1])
      .map(([r, a]) => `${r} ${pz(a)}`)
      .join(', '),
  ]),
);
