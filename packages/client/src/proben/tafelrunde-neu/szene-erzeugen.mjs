/**
 * Erzeugt `szene.json` — die Sichten, mit denen die Probe
 * `/probe/tafelrunde-neu` die neue Oberflaeche zeigt, ohne Server.
 *
 * Aufruf aus dem Wurzelverzeichnis, nachdem `npm run build` gelaufen ist:
 *
 *     node packages/client/src/proben/tafelrunde-neu/szene-erzeugen.mjs
 *
 * Gespielt wird eine echte Partie zu viert mit Bots — mit dem Spielpaket,
 * nicht mit einer Nachbildung (dieselbe Ueberlegung wie bei
 * `proben/kampf/kampf-erzeugen.mjs`). Herausgeschrieben werden die ERSTE
 * Sicht von Sitz 0 in einer spaeten Ruestphase (mit Katalog, Synergietabelle,
 * Stufenwerten und Faehigkeiten, wie sie nur beim Beitritt kommen), die
 * erlaubten Zuege dazu, und die Sicht derselben Runde im Kampf. Gesucht wird
 * eine Saat, in deren Kampf Faehigkeiten wirken — sonst zeigt die Probe den
 * Manabalken nie leer werden.
 *
 * Die Datei wird mitgeliefert, nicht beim Bauen erzeugt: Der Client
 * importiert aus keinem Spielpaket (CLAUDE.md).
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { botZug } from '../../../../game-tafelrunde/dist/src/bot.js';
import {
  DEFAULT_REGELN,
  darfHandeln,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  lebendeSitze,
  loeseKampfAuf,
  sichtFuer,
} from '../../../../game-tafelrunde/dist/src/index.js';

const SITZE = [0, 1, 2, 3];
const ICH = 0;
const GANGART = 'normal';
// Runde 5: Das Feld waechst noch (6 Plaetze, naechste Runde 7) — so zeigt die
// Probe auch die Ankuendigung ueber dem Laden.
const RUNDE = 5;

function allesBereit(p) {
  let q = p;
  for (const sitz of lebendeSitze(q)) {
    for (let i = 0; i < 200 && darfHandeln(q, sitz); i++) q = fuehreAus(q, sitz, botZug(sichtFuer(q, sitz), GANGART));
  }
  return q;
}

function bewerte(ruest, kampf) {
  const e = ruest.eigenes;
  if (!e || e.ausRunde !== null) return -1;
  const brett = e.brett.filter(Boolean).length;
  const bank = e.bank.filter(Boolean).length;
  const eigener = (kampf.kaempfe ?? []).find((k) => k.a === ICH || (k.b === ICH && !k.geist));
  if (!eigener) return -1;
  const faehigkeiten = eigener.bericht.ereignisse.filter((x) => x.art === 'faehigkeit').length;
  const zustaende = eigener.bericht.ereignisse.filter((x) => x.art === 'zustand').length;
  if (brett < 4 || bank < 2 || faehigkeiten < 2) return -1;
  // Ein Kampf bis zur Hoechstdauer zeigt in der Probe vor allem Warten.
  if (eigener.bericht.grund === 'zeit') return -1;
  // Laeuft ein fremder Kampf deutlich laenger als der eigene, zeigt die Probe
  // (Fall `zuschauen`) das Rundenende mit „Die anderen kaempfen noch …".
  const andere = (kampf.paarungen ?? []).filter((p) => p.a !== eigener.a || p.b !== eigener.b);
  const zuschauen = andere.some((p) => p.dauerMs > eigener.bericht.dauerMs + 4000) ? 400 : 0;
  return brett * 2 + bank + faehigkeiten + zustaende + e.synergien.length * 3 + zuschauen;
}

let beste = null;
for (let n = 0; n < 800; n++) {
  const saat = `probe-neu-${n}`;
  let p = erstellePartie(DEFAULT_REGELN, SITZE, saat);
  let ok = true;
  while (p.runde < RUNDE && !p.fertig) {
    p = allesBereit(p);
    if (p.phase !== 'kampf') {
      ok = false;
      break;
    }
    p = loeseKampfAuf(p);
  }
  if (!ok || p.fertig || p.phase !== 'vorbereitung') continue;
  // Sitz 0 macht ein paar Zuege, aber nicht „bereit" — so steht ein Laden da.
  for (let i = 0; i < 4 && darfHandeln(p, ICH); i++) {
    const zug = botZug(sichtFuer(p, ICH), GANGART);
    if (zug.typ === 'bereit') break;
    p = fuehreAus(p, ICH, zug);
  }
  const ruest = sichtFuer(p, ICH, 0);
  const legal = erlaubteZuege(p, ICH);
  const imKampf = allesBereit(p);
  if (imKampf.phase !== 'kampf') continue;
  const kampf = sichtFuer(imKampf, ICH, 1);
  const punkte = bewerte(ruest, kampf);
  if (punkte > (beste?.punkte ?? -1)) beste = { punkte, saat, ruest, legal, kampf };
}

if (!beste) throw new Error('Keine Saat liefert einen brauchbaren Stand');

/* Nur der eigene Kampf mit Protokoll — die drei fremden waeren 70 kB, die
   die Probe nie abspielt (das Ergebnis steht ohnehin in `paarungen`). */
beste.kampf = {
  ...beste.kampf,
  kaempfe: beste.kampf.kaempfe.filter((k) => k.a === ICH || (k.b === ICH && !k.geist)),
};

const ziel = fileURLToPath(new URL('./szene.json', import.meta.url));
writeFileSync(
  ziel,
  `${JSON.stringify({ saat: beste.saat, ruest: beste.ruest, legal: beste.legal, kampf: beste.kampf })}\n`,
);
console.log(`${ziel}\n  Saat ${beste.saat}, Runde ${beste.ruest.runde}, ${beste.punkte} Punkte`);
