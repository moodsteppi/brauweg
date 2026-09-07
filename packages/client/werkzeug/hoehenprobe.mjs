/**
 * Der Bildtest zur Partieansicht von Tafelrunde: Passt sie auf einen
 * Bildschirm?
 *
 *   node packages/client/werkzeug/hoehenprobe.mjs
 *   node packages/client/werkzeug/hoehenprobe.mjs --bilder /pfad/zum/ordner
 *
 * WARUM ES DIESES WERKZEUG GIBT. Robin hat dreimal gemeldet, dass die
 * laufende Partie nicht auf einen Bildschirm passt, zuletzt am 06.09.2026.
 * Gemessen war es eindeutig: 1229 Pixel Inhalt in einem 720 Pixel hohen
 * Notebook-Schirm, der Laden komplett unter der Kante — und der Laden ist die
 * einzige Stelle, an der man ueberhaupt etwas kauft. Behoben ist es dadurch,
 * dass Brett und Bank ihre Groesse aus der freien HOEHE ziehen
 * (`.tr-spielflaeche` in styles.css, `.arena` in KampfAnzeige.module.css).
 *
 * WARUM ES KEIN VITEST IST. Die Rechnung steht im Stylesheet und benutzt
 * Container-Anfragen (`cqh`). jsdom hat weder Layout noch Container: Dort ist
 * jedes Element null Pixel gross, und ein Test daraus waere gruen, egal was
 * im Stylesheet steht. Was sich in jsdom pruefen laesst — dass die
 * Verdrahtung ueberhaupt noch steht —, prueft
 * `src/screens/Tafelrunde.hoehe.test.tsx`. Die HOEHE misst nur ein echter
 * Browser, und den bringt die Pruefstrecke nicht mit.
 *
 * WAS ES BRAUCHT: einen laufenden Vite (`npm run dev --workspace
 * @brauweg/client`, Vorgabe-Port 5173) und Playwright samt Chromium. Beides
 * ist Handwerkszeug und keine Abhaengigkeit des Clients — deshalb bricht das
 * Werkzeug mit einem Satz ab, wenn eines fehlt, statt still nichts zu tun.
 *
 * WAS ES PRUEFT, an `/probe/ruestkammer` (Ruestphase) und `/probe/kampf`
 * (Kampfphase):
 *   1. Der Tisch rollt nicht — `scrollHeight` gleich `clientHeight`.
 *   2. Nichts liegt unter der Unterkante: Bereit-Knopf, Ladenkarten und Bank
 *      stehen vollstaendig im Bild.
 *   3. Nichts liegt seitlich draussen.
 * Und es legt je Groesse ein Bild ab, damit man auch hinsieht.
 *
 * DIE GROESSEN sind die aus der Aufgabe vom 06.09.2026: zwei kleine
 * Notebooks, ein MacBook, ein iPhone, ein Android. 720 und 850 sind die
 * beiden Hoehen, um die es geht.
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

const GROESSEN = [
  { name: '1366x768', breite: 1366, hoehe: 768 },
  { name: '1280x720', breite: 1280, hoehe: 720 },
  { name: '1512x850', breite: 1512, hoehe: 850 },
  { name: '390x844', breite: 390, hoehe: 844 },
  { name: '360x740', breite: 360, hoehe: 740 },
];

const SEITEN = [
  { name: 'ruestkammer', pfad: '/probe/ruestkammer' },
  { name: 'kampf', pfad: '/probe/kampf' },
];

function argument(flagge, vorgabe) {
  const i = process.argv.indexOf(flagge);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : vorgabe;
}

const basis = argument('--url', 'http://localhost:5173');
const bilder = argument('--bilder', join(tmpdir(), 'tafelrunde-hoehenprobe'));

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'Playwright fehlt. Es ist Absicht, dass der Client es nicht als Abhaengigkeit fuehrt:\n' +
      'Die Pruefstrecke laedt sonst bei jedem Lauf einen Browser. Einmalig einrichten mit\n' +
      '  npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

mkdirSync(bilder, { recursive: true });

/**
 * Was am Bildschirm steht und wo — alles in einem Rutsch, damit zwischen zwei
 * Messungen kein Umbruch passiert.
 *
 * Die Toleranz von einem Pixel ist kein Schlendrian: Browser runden
 * Teilpixel, und ein Kasten, der rechnerisch bei 719,6 endet, meldet 720,04.
 */
async function messen(seite) {
  return seite.evaluate(() => {
    const tisch = document.querySelector('.tr-tisch');
    if (!tisch) return { fehler: 'kein .tr-tisch auf der Seite' };
    const schirm = { breite: window.innerWidth, hoehe: window.innerHeight };

    // Was sichtbar sein MUSS. Fehlt eines, ist es kein Fehler — die
    // Kampfphase hat weder Laden noch Bank; gemessen wird, was da ist.
    const pflicht = [
      ['Bereit-Knopf', '.tr-bereitknopf'],
      ['Ladenkarte', '.tr-karte'],
      ['Bank', '.tr-bank'],
      ['Brett', '.tr-brett'],
      ['Arena', '[aria-label="Kampf"]'],
      ['Kopfleiste', '.tr-oben'],
    ];
    const draussen = [];
    for (const [was, wahl] of pflicht) {
      for (const el of document.querySelectorAll(wahl)) {
        const k = el.getBoundingClientRect();
        if (k.width === 0 && k.height === 0) continue;
        if (k.bottom > schirm.hoehe + 1) draussen.push(`${was} endet bei ${Math.round(k.bottom)}`);
        if (k.top < -1) draussen.push(`${was} beginnt bei ${Math.round(k.top)}`);
        if (k.right > schirm.breite + 1) draussen.push(`${was} reicht bis ${Math.round(k.right)}`);
        if (k.left < -1) draussen.push(`${was} beginnt links bei ${Math.round(k.left)}`);
      }
    }

    /*
     * Und die Probe auf die Rechnung selbst: Passen Bretter und Bank in den
     * Kasten, aus dessen Hoehe sie gerechnet sind?
     *
     * Sie ist noetig, weil der Kasten `container-type: size` traegt und damit
     * `contain: layout`: Was ueber ihn hinausgeht, taucht in KEINEM
     * `scrollHeight` auf. Es wird nur gezeichnet — quer ueber den Laden.
     * Ohne diese Zeilen bliebe genau dieser Fehler unsichtbar, und er ist der
     * wahrscheinlichste: Er tritt ein, sobald jemand einen der Abzuege
     * (`--tr-kopfhoehe`, `--tr-bankhoehe`, `--tr-brettluft`) zu klein setzt.
     */
    const flaeche = document.querySelector('.tr-spielflaeche');
    const teile = ['.tr-bretter', '.tr-bank']
      .map((w) => flaeche?.querySelector(`:scope > ${w}`))
      .filter(Boolean);
    if (flaeche && teile.length > 0) {
      const gebraucht = teile.reduce((s, e) => s + e.getBoundingClientRect().height, 0);
      const frei = flaeche.getBoundingClientRect().height;
      if (gebraucht > frei + 1) {
        draussen.push(`Bretter und Bank brauchen ${Math.round(gebraucht)} in ${Math.round(frei)}`);
      }
    }

    const brett = document.querySelector('.tr-bretter') ?? document.querySelector('.tr-brett');
    return {
      schirm,
      rollt: tisch.scrollHeight > tisch.clientHeight + 1,
      inhalt: tisch.scrollHeight,
      klient: tisch.clientHeight,
      feld: brett ? Math.round(brett.getBoundingClientRect().width) : null,
      draussen,
    };
  });
}

const browser = await chromium.launch();
let schlecht = 0;

for (const seite of SEITEN) {
  console.log(`\n=== ${seite.pfad}`);
  for (const g of GROESSEN) {
    const blatt = await browser.newPage({
      viewport: { width: g.breite, height: g.hoehe },
      deviceScaleFactor: 1,
    });
    let mass;
    try {
      await blatt.goto(basis + seite.pfad, { waitUntil: 'networkidle', timeout: 20000 });
      // Der Ladevorhang der Ruestkammer und die Rundenansage der Buehne
      // brauchen beide unter einer Sekunde; danach steht das Bild.
      await blatt.waitForTimeout(1500);
      mass = await messen(blatt);
      await blatt.screenshot({ path: join(bilder, `${seite.name}-${g.name}.png`) });
    } finally {
      await blatt.close();
    }

    if (mass.fehler) {
      console.log(`  ${g.name.padEnd(9)} ✗ ${mass.fehler}`);
      schlecht++;
      continue;
    }
    const heil = !mass.rollt && mass.draussen.length === 0;
    if (!heil) schlecht++;
    console.log(
      `  ${g.name.padEnd(9)} ${heil ? '✓' : '✗'} Inhalt ${mass.inhalt} von ${mass.klient}` +
        (mass.feld === null ? '' : `, Spielflaeche ${mass.feld} px breit`),
    );
    for (const satz of mass.draussen) console.log(`              ↳ ${satz}`);
  }
}

await browser.close();

console.log(`\nBilder: ${bilder}`);
if (schlecht > 0) {
  console.error(`${schlecht} Groesse(n) passen nicht auf ihren Bildschirm.`);
  process.exit(1);
}
console.log('Alle Groessen passen.');
