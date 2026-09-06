/**
 * Was eine kuerzere Abbruchgrenze am AUSGANG der Kaempfe aendert.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/hoechstdauer.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --partien 300        Wie viele Partien.
 *     --sitze 4            Sitze am Tisch, 2 bis 8.
 *     --besetzung normal   normal | sanft | hart | gemischt
 *     --saat wartezeit-v1  Saatbasis. Andere Basis = unabhaengige Stichprobe.
 *     --grenzen 30,25,20   Kandidaten in Sekunden, mit Komma.
 *
 * WARUM ES NICHT IM SPIELZEIT-WERKZEUG STEHT, obwohl dort eine Gruppe
 * `hoechstdauer` sitzt: Das Werkzeug dort spielt jede Zeile als EIGENE Partie
 * mit der jeweiligen Grenze. Das ist die richtige Messung fuer Spielzeit,
 * Runden und Ausgewogenheit — aber es kann eine Frage nicht beantworten, und
 * zwar die entscheidende: Wuerde derselbe Kampf ANDERS ausgehen? Sobald ein
 * Kampf anders ausgeht, laeuft die Partie auseinander; ab da vergleicht man
 * zwei verschiedene Partien und nicht zwei Grenzen.
 *
 * HIER WIRD DESHALB PAARWEISE GERECHNET. Gespielt wird die Partie EINMAL, mit
 * dem gebauten Regler. Jede Paarung wird danach mit jeder Kandidatengrenze
 * noch einmal simuliert — dieselben zwei Bretter, dieselbe Kampfsaat, nur die
 * Grenze anders. Der Unterschied ist dann die Wirkung der Grenze und sonst
 * nichts.
 *
 * WORAUF ES ANKOMMT: nicht der Anteil "von der Uhr entschieden" allein. Der
 * steigt zwangslaeufig, wenn man die Grenze senkt, und sagt fuer sich genommen
 * nur, dass man die Grenze gesenkt hat. Die Frage ist, ob die Uhr dabei ANDERS
 * urteilt als das Brett — `entscheideNachZeit` vergibt den Sieg naemlich
 * relativ zum verbliebenen Leben und nicht als Unentschieden. Ein echtes
 * Unentschieden entsteht nur bei exaktem Gleichstand.
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

const laden = (pfad) => import(pathToFileURL(pfad).href);

const { ACHT_SITZE, gangartFuer } = await laden(MESSSTAND);
const {
  DEFAULT_REGELN,
  STANDARD_REGLER,
  darfHandeln,
  erstellePartie,
  fuehreAus,
  kampfSaat,
  lebendeSitze,
  loeseKampfAuf,
  sichtFuer,
  simuliereKampf,
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

const PARTIEN = Number(schalter('partien', '300'));
const SITZZAHL = Number(schalter('sitze', '4'));
const BESETZUNG = schalter('besetzung', 'normal');
const SAAT_BASIS = schalter('saat', 'wartezeit-v1');
const GRENZEN = schalter('grenzen', '30,25,20')
  .split(',')
  .filter(Boolean)
  .map((s) => Number(s) * 1000);

if (!Number.isInteger(PARTIEN) || PARTIEN < 1) {
  console.error('--partien braucht eine ganze Zahl ab 1');
  process.exit(1);
}
if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}
if (GRENZEN.some((g) => !Number.isFinite(g) || g <= 0)) {
  console.error('--grenzen braucht Sekundenzahlen, z.B. 30,25,20');
  process.exit(1);
}

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);

/**
 * Notbremse wie im Messstand: Eine Partie, die hier anschlaegt, haengt. Ohne
 * sie faellt das nur als stehengebliebener Lauf auf.
 */
const MAX_SCHLEIFEN = 400;
const MAX_ZUEGE_JE_SITZ = 200;

// ---------------------------------------------------------------------------
// Der Lauf
// ---------------------------------------------------------------------------

const beginn = Date.now();
const stat = new Map(
  GRENZEN.map((g) => [g, { uhr: 0, anders: 0, unentschieden: 0, dauerSumme: 0 }]),
);
let kaempfe = 0;
let uhrHeute = 0;
let unentHeute = 0;
let dauerHeute = 0;

for (let i = 0; i < PARTIEN; i++) {
  let p = erstellePartie(DEFAULT_REGELN, SITZE, `${SAAT_BASIS}-${i}`, STANDARD_REGLER);
  for (let schleife = 0; schleife < MAX_SCHLEIFEN && !p.fertig; schleife++) {
    for (const sitz of lebendeSitze(p)) {
      for (let z = 0; z < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); z++) {
        p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz), gangartFuer(BESETZUNG, sitz)));
      }
    }
    if (p.phase !== 'kampf') break;

    for (const k of p.kaempfe) {
      kaempfe++;
      if (k.bericht.grund === 'zeit') uhrHeute++;
      if (k.bericht.sieger === null) unentHeute++;
      dauerHeute += k.bericht.dauerMs;

      /*
       * Die Bretter stehen JETZT noch vollstaendig da: `loeseKampfAuf` raeumt
       * gleich die der Ausgeschiedenen ab. Und die Kampfsaat entsteht aus
       * Partiesaat, Runde und den beiden Sitzen — dieselbe Rechnung wie in
       * `beginneKampf`, deshalb ist der Nachlauf ereignisgleich.
       */
      const bretter = [p.heere[k.a].brett, p.heere[k.b].brett];
      const saat = kampfSaat(p.saat, p.runde, k.a, k.b);
      for (const grenze of GRENZEN) {
        const s = stat.get(grenze);
        const kurz = simuliereKampf(bretter, saat, {
          ...STANDARD_REGLER,
          hoechstdauerMs: grenze,
        });
        if (kurz.grund === 'zeit') s.uhr++;
        if (kurz.sieger === null) s.unentschieden++;
        if (kurz.sieger !== k.bericht.sieger) s.anders++;
        s.dauerSumme += kurz.dauerMs;
      }
    }
    p = loeseKampfAuf(p);
  }
}
const dauer = Date.now() - beginn;

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const p1 = (zahl) => `${((zahl / kaempfe) * 100).toFixed(1)} %`;
const sek = (ms) => `${(ms / kaempfe / 1000).toFixed(1)} s`;

console.log('');
console.log('Tafelrunde — was eine kuerzere Abbruchgrenze am Ausgang aendert');
console.log(
  `${PARTIEN} Partien zu ${SITZE.length}, ${kaempfe} Kaempfe, Besetzung ${BESETZUNG}, ` +
    `Saatbasis "${SAAT_BASIS}", ${(dauer / 1000).toFixed(1)} s`,
);
console.log('');

const kopf = ['Grenze', 'Kampf', 'von der Uhr', 'anderer Sieger', 'unentschieden'];
const zeilen = [
  [
    `${STANDARD_REGLER.hoechstdauerMs / 1000} s (gebaut)`,
    sek(dauerHeute),
    p1(uhrHeute),
    '-',
    p1(unentHeute),
  ],
  ...GRENZEN.map((g) => {
    const s = stat.get(g);
    return [
      `${g / 1000} s`,
      sek(s.dauerSumme),
      p1(s.uhr),
      p1(s.anders),
      p1(s.unentschieden),
    ];
  }),
];
const breiten = kopf.map((_, spalte) =>
  Math.max(...[kopf, ...zeilen].map((z) => String(z[spalte]).length)),
);
const schreib = (z) =>
  console.log(
    '  ' +
      z
        .map((wert, spalte) =>
          spalte === 0
            ? String(wert).padEnd(breiten[spalte])
            : String(wert).padStart(breiten[spalte]),
        )
        .join('  '),
  );
schreib(kopf);
console.log('  ' + breiten.map((b) => '-'.repeat(b)).join('  '));
for (const z of zeilen) schreib(z);

console.log('');
console.log('  "Kampf" ist der MITTELWERT und nicht der Median: Gemessen wird hier die');
console.log('  Wirkung auf den Schwanz, und den sieht ein Median nicht.');
console.log('  "anderer Sieger" ist die Zahl, auf die es ankommt — sie sagt, wie oft');
console.log('  die Uhr anders urteilt als das Brett. Der Anteil "von der Uhr" allein');
console.log('  steigt zwangslaeufig und sagt nur, dass die Grenze gesenkt wurde.');
console.log('');
console.log('  Spielzeit, Runden und Ausgewogenheit stehen NICHT hier, sondern in');
console.log('  werkzeug/spielzeit.mjs --nur hoechstdauer: Dort spielt jede Zeile ihre');
console.log('  eigenen Partien, und nur so misst man die Wirkung auf eine ganze Partie.');
console.log('');
