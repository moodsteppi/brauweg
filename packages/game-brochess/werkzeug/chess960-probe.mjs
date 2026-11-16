/**
 * Bot-Probe fuer Chess960: N Partien Bot gegen Bot ueber alle Stufen,
 * gespielt ueber das Spielmodul wie am Server (`botAction` auf der Sicht des
 * Sitzes, dann `act`). Zaehlt illegale Zuege (`act` wirft) und Abstuerze
 * (`botAction` wirft) getrennt — der Server braeche in beiden Faellen den
 * Tisch ab.
 *
 * Aufruf nach dem Bau des Pakets (npm run build im Wurzelverzeichnis):
 *   node packages/game-brochess/werkzeug/chess960-probe.mjs [partien=200]
 * Beendet sich mit 1, sobald ein illegaler Zug oder ein Absturz vorkam.
 */

import { brochess } from '../dist/src/index.js';

const PARTIEN = Number(process.argv[2] ?? 200);
const STUFEN = ['anfaenger', 'standard', 'experte', 'genie'];
const GRENZE = 400;

let illegal = 0;
let abstuerze = 0;
let halbzuege = 0;
let langsamster = 0;
let offen = 0;
const ausgaenge = {};
const start = performance.now();

for (let i = 0; i < PARTIEN; i += 1) {
  // Alle 16 Paarungen der Stufen reihum, die Saat wechselt die Farben.
  const stufe = [STUFEN[i % 4], STUFEN[Math.floor(i / 4) % 4]];
  let p = brochess.createParty({ config: { modus: 'chess960' }, seats: 2, rounds: 1, seed: i * 7919 + 13 });
  for (let h = 0; h < GRENZE && !brochess.isFinished(p); h += 1) {
    const sitz = brochess.currentActor(p);
    let aktion;
    const t0 = performance.now();
    try {
      aktion = brochess.botAction(brochess.viewFor(p, sitz), stufe[sitz]);
    } catch (fehler) {
      abstuerze += 1;
      console.error(`Partie ${i}, Halbzug ${h}: Absturz`, fehler);
      break;
    }
    langsamster = Math.max(langsamster, performance.now() - t0);
    try {
      p = brochess.act(p, sitz, aktion);
    } catch (fehler) {
      illegal += 1;
      console.error(`Partie ${i}, Halbzug ${h}: illegal ${JSON.stringify(aktion)}`, fehler.message);
      break;
    }
    halbzuege += 1;
  }
  if (brochess.isFinished(p)) ausgaenge[p.ende.ausgang] = (ausgaenge[p.ende.ausgang] ?? 0) + 1;
  else offen += 1;
}

console.log(`Chess960 Bot-Probe: ${PARTIEN} Partien, ${halbzuege} Halbzuege, ${((performance.now() - start) / 1000).toFixed(0)} s`);
console.log(`illegale Zuege: ${illegal}, Abstuerze: ${abstuerze}, nach ${GRENZE} Halbzuegen offen: ${offen}`);
console.log(`Ausgaenge: ${JSON.stringify(ausgaenge)}`);
console.log(`langsamster Botzug: ${langsamster.toFixed(0)} ms`);
process.exit(illegal + abstuerze > 0 ? 1 : 0);
