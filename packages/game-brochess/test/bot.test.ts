import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BotLevel } from '@brauweg/game-api';

import { brochess } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { angegriffen, ausFen, feldIndex, wendeAn } from '../src/brett.js';
import { amZug, erstellePartie, fuehreAus } from '../src/partie.js';
import { DEFAULT_REGELN } from '../src/regeln.js';

/*
 * Der Computergegner (bot.ts). Geprueft wird, was ein Mensch am Brett sofort
 * merkt: Er nimmt, was haengt, setzt matt, wenn es geht, und laesst die Dame
 * nicht stehen. Und was der Server braucht: derselbe Zug bei derselben Sicht,
 * und eine Partie Bot gegen Bot kommt in endlicher Zeit zu Ende.
 */

const STUFEN: readonly BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];

/** Sicht des Sitzes am Zug in einer Stellung. */
function sichtAus(fen: string) {
  const partie = erstellePartie(DEFAULT_REGELN, 0, fen);
  return brochess.viewFor(partie, amZug(partie)!);
}

test('jede Stufe nimmt eine haengende Dame', () => {
  // Weisser Turm auf d1, schwarze Dame ungedeckt auf d5.
  const sicht = sichtAus('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
  for (const stufe of STUFEN) {
    const zug = botZug(sicht, stufe);
    assert.deepEqual([zug.von, zug.nach], ['d1', 'd5'], stufe);
  }
});

test('ab Standard setzt der Bot in einem Zug matt', () => {
  // Grundreihenmatt: Ta1-a8.
  const sicht = sichtAus('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  for (const stufe of STUFEN) {
    const zug = botZug(sicht, stufe);
    assert.deepEqual([zug.von, zug.nach], ['a1', 'a8'], stufe);
  }
});

test('ab Standard laesst der Bot seine Dame nicht stehen', () => {
  // Die weisse Dame auf d4 steht im Angriff von Bauer e5 und Springer c6.
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 3';
  for (const stufe of ['standard', 'experte', 'genie'] as const) {
    const zug = botZug(sichtAus(fen), stufe);
    assert.equal(zug.von, 'd4', `${stufe} zieht die Dame weg (statt ${zug.von}-${zug.nach})`);
    const danach = wendeAn(ausFen(fen), { von: feldIndex(zug.von), nach: feldIndex(zug.nach) });
    assert.ok(!angegriffen(danach.brett, feldIndex(zug.nach), 'b'), `${stufe}: Dame auf ${zug.nach} haengt`);
  }
});

test('gleiche Sicht, gleiche Stufe, gleicher Zug', () => {
  const sicht = sichtAus('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  for (const stufe of STUFEN) {
    assert.deepEqual(botZug(sicht, stufe), botZug(sicht, stufe), stufe);
  }
});

test('ohne Stufe zieht er wie Standard (Ersatzzug der Plattform)', () => {
  const sicht = sichtAus('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
  assert.deepEqual(brochess.botAction(sicht), botZug(sicht, 'standard'));
});

test('Genie gegen Anfaenger: eine ganze Partie, jeder Zug legal und schnell genug', () => {
  let partie = erstellePartie(DEFAULT_REGELN, 0);
  let langsamster = 0;
  for (let halbzug = 0; halbzug < 400 && partie.ende === null; halbzug += 1) {
    const sitz = amZug(partie)!;
    const stufe: BotLevel = sitz === partie.weissSitz ? 'genie' : 'anfaenger';
    const start = performance.now();
    const aktion = brochess.botAction(brochess.viewFor(partie, sitz), stufe);
    langsamster = Math.max(langsamster, performance.now() - start);
    // fuehreAus wirft bei einem illegalen Zug.
    partie = fuehreAus(partie, sitz, aktion);
  }
  assert.ok(partie.ende !== null, 'Partie endet');
  assert.equal(partie.ende?.sieger ?? null, partie.weissSitz, `Genie gewinnt (Ende: ${JSON.stringify(partie.ende)})`);
  // Der Bot rechnet im Serverprozess; ein Zug darf die anderen Tische nicht
  // spuerbar anhalten. Grosszuegig bemessen, weil CI-Rechner langsamer sind.
  assert.ok(langsamster < 3000, `langsamster Zug ${Math.round(langsamster)} ms`);
});
