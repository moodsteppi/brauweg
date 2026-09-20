/**
 * Wie gross die Sicht ist, die ein Spieler je Runde bekommt — roh und
 * komprimiert.
 *
 *     npm run build --workspace @brauweg/game-tafelrunde
 *     node packages/game-tafelrunde/werkzeug/sichtgroesse.mjs
 *
 * Schalter (alle mit Vorgabe):
 *
 *     --sitze 8            Sitze am Tisch, 2 bis 8.
 *     --besetzung normal   normal | sanft | hart | gemischt
 *     --saat 7             Saat der Partie.
 *
 * WARUM ES DIESES WERKZEUG GIBT. Seit dem 06.09.2026 bekommt jeder Spieler
 * ALLE Kaempfe der Runde mit vollem Ablaufprotokoll (src/sicht.ts) — die
 * Grundlage des Zusehens. Die Frage danach war, ob das am Handy und im
 * Mobilfunk vertretbar ist. Beantworten laesst sie sich nur gemessen, und eine
 * Zahl, die jemand einmal von Hand ermittelt und in einen Kommentar schreibt,
 * altert mit der naechsten Regelaenderung still vor sich hin. Hier steht
 * stattdessen der Weg, sie neu zu erheben.
 *
 * GEMESSEN WIRD IN DREI SCHNITTEN, weil erst der Vergleich die Frage
 * beantwortet, ob es einen billigeren gibt:
 *
 *   - `voll`   — die Sicht, wie sie heute herausgeht.
 *   - `eigen`  — nur der eigene Kampf im Protokoll, alles andere gleich.
 *                Das ist der Stand vor dem 06.09.2026 und zugleich die
 *                Obergrenze dessen, was ein Nachliefern auf Anforderung
 *                einsparen koennte.
 *   - `ohne`   — gar kein Protokoll. Der Boden: So viel kostet eine Sicht,
 *                auch wenn man am Kampf nichts mehr spart.
 *
 * Und JE SCHNITT ZWEIMAL: roh und mit `deflateRaw` gepackt. Der zweite Wert
 * ist der, auf den es ankommt — der Gateway komprimiert seit dem 19.09.2026
 * jede Nachricht ueber einem Kilobyte (`perMessageDeflate` in
 * packages/server/src/realtime/gateway.ts). Gepackt wird hier mit denselben
 * Einstellungen wie dort: Stufe 6, jede Nachricht fuer sich (kein
 * Kontextuebertrag). Wer die Zahlen mit denen im Kommentar von sicht.ts
 * vergleicht, vergleicht also dasselbe.
 */

import { existsSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
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
  darfHandeln,
  erstellePartie,
  fuehreAus,
  lebendeSitze,
  loeseKampfAuf,
  sichtFuer,
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

const SITZZAHL = Number(schalter('sitze', '8'));
const BESETZUNG = schalter('besetzung', 'normal');
const SAAT = schalter('saat', '7');

if (!Number.isInteger(SITZZAHL) || SITZZAHL < 2 || SITZZAHL > 8) {
  console.error('--sitze braucht eine ganze Zahl von 2 bis 8');
  process.exit(1);
}

const SITZE = ACHT_SITZE.slice(0, SITZZAHL);
const MAX_SCHLEIFEN = 400;
const MAX_ZUEGE_JE_SITZ = 200;

// ---------------------------------------------------------------------------
// Messen
// ---------------------------------------------------------------------------

const roh = (o) => Buffer.byteLength(JSON.stringify(o));
// Dieselben Einstellungen wie im Gateway: Stufe 6, kein Kontextuebertrag —
// deshalb jede Nachricht einzeln und nicht als Strom.
const gepackt = (o) => deflateRawSync(Buffer.from(JSON.stringify(o)), { level: 6 }).length;

/**
 * `seit = 1` und nicht 0: Katalog, Synergietabelle und Stufenwerte gehen nur
 * beim allerersten Ausliefern heraus (SICHT_MARKE in sicht.ts). Sie in jede
 * Runde einzurechnen hiesse, eine einmalige Last siebzehnmal zu zaehlen.
 */
const SEIT = 1;

let p = erstellePartie(DEFAULT_REGELN, SITZE, SAAT);
const runden = [];

for (let schleife = 0; schleife < MAX_SCHLEIFEN && !p.fertig; schleife++) {
  for (const sitz of lebendeSitze(p)) {
    for (let z = 0; z < MAX_ZUEGE_JE_SITZ && darfHandeln(p, sitz); z++) {
      p = fuehreAus(p, sitz, botZug(sichtFuer(p, sitz, SEIT), gangartFuer(BESETZUNG, sitz)));
    }
  }
  if (p.phase !== 'kampf') break;

  /*
   * ALLE Sitze, nicht nur die lebenden: Wer ausgeschieden ist, sieht weiter zu
   * und bekommt genau dieselbe Sicht. Nur ueber die Lebenden zu messen hiesse,
   * die Last des Zusehens aus der Rechnung zu nehmen — und die ist der Grund,
   * aus dem die fremden Protokolle ueberhaupt mitgehen.
   */
  for (const sitz of SITZE) {
    const voll = sichtFuer(p, sitz, SEIT);
    const eigen = { ...voll, kaempfe: voll.kaempfe.filter((k) => k.a === sitz || k.b === sitz) };
    const ohne = { ...voll, kaempfe: [] };
    runden.push({
      runde: p.runde,
      sitz,
      lebende: lebendeSitze(p).length,
      ereignisse: voll.kaempfe.reduce((n, k) => n + k.bericht.ereignisse.length, 0),
      voll: roh(voll),
      vollGepackt: gepackt(voll),
      eigen: roh(eigen),
      eigenGepackt: gepackt(eigen),
      ohne: roh(ohne),
      ohneGepackt: gepackt(ohne),
    });
  }
  p = loeseKampfAuf(p);
}

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

const kB = (bytes) => (bytes / 1024).toFixed(1).padStart(6);
const groesste = runden.reduce((a, x) => (x.voll > a.voll ? x : a));
const kampfrunden = new Set(runden.map((r) => r.runde)).size;
// Je Spieler und nicht in Summe: Gefragt ist, was EIN Handy ueber die Partie
// laedt. Gemessen wird jede Runde fuer jeden Sitz, also ist die Summe durch
// die Sitzzahl genau das, was einer von ihnen bekommt.
const jeSpieler = (feld) => runden.reduce((s, r) => s + r[feld], 0) / SITZE.length;

console.log(`Tafelrunde, ${SITZZAHL} Sitze, Saat ${SAAT}, Besetzung ${BESETZUNG}`);
console.log(`${kampfrunden} Kampfrunden, ${runden.length} gemessene Sichten\n`);
console.log('                        roh       gepackt');
console.log(`groesste Sicht   voll ${kB(groesste.voll)} kB  ${kB(groesste.vollGepackt)} kB`
  + `   (Runde ${groesste.runde}, ${groesste.ereignisse} Ereignisse)`);
console.log(`                 eigen${kB(groesste.eigen)} kB  ${kB(groesste.eigenGepackt)} kB`);
console.log(`                 ohne ${kB(groesste.ohne)} kB  ${kB(groesste.ohneGepackt)} kB`);
console.log(`\nganze Partie je Spieler`);
console.log(`                 voll ${kB(jeSpieler('voll'))} kB  ${kB(jeSpieler('vollGepackt'))} kB`);
console.log(`                 eigen${kB(jeSpieler('eigen'))} kB  ${kB(jeSpieler('eigenGepackt'))} kB`);
console.log(`                 ohne ${kB(jeSpieler('ohne'))} kB  ${kB(jeSpieler('ohneGepackt'))} kB`);
