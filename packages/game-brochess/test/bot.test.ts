import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BotLevel } from '@brauweg/game-api';

import { brochess } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { angegriffen, ausFen, feldIndex, wendeAn } from '../src/brett.js';
import {
  type BroChessAktion,
  type BroChessPartie,
  type BroChessZug,
  amZug,
  erlaubteAktionen,
  erstellePartie,
  fuehreAus,
} from '../src/partie.js';
import { type BroChessRegeln, DEFAULT_REGELN } from '../src/regeln.js';
import { type BroChessSicht, sichtFuer } from '../src/sicht.js';

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

/** Im normalen Modus zieht der Bot immer; `botZug` liefert seit Secret Dame auch eine Wahl. */
function zugVon(sicht: BroChessSicht, stufe: BotLevel): BroChessZug {
  const aktion = botZug(sicht, stufe);
  assert.equal(aktion.type, 'zug');
  return aktion as BroChessZug;
}

test('jede Stufe nimmt eine haengende Dame', () => {
  // Weisser Turm auf d1, schwarze Dame ungedeckt auf d5.
  const sicht = sichtAus('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
  for (const stufe of STUFEN) {
    const zug = zugVon(sicht, stufe);
    assert.deepEqual([zug.von, zug.nach], ['d1', 'd5'], stufe);
  }
});

test('ab Standard setzt der Bot in einem Zug matt', () => {
  // Grundreihenmatt: Ta1-a8.
  const sicht = sichtAus('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  for (const stufe of STUFEN) {
    const zug = zugVon(sicht, stufe);
    assert.deepEqual([zug.von, zug.nach], ['a1', 'a8'], stufe);
  }
});

test('ab Standard laesst der Bot seine Dame nicht stehen', () => {
  // Die weisse Dame auf d4 steht im Angriff von Bauer e5 und Springer c6.
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 3';
  for (const stufe of ['standard', 'experte', 'genie'] as const) {
    const zug = zugVon(sichtAus(fen), stufe);
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

// ---------------------------------------------------------------------------
// Secret Dame (seit dem 04.11.2026)
// ---------------------------------------------------------------------------
/*
 * Der Bot laeuft hier direkt ueber `botZug`, nicht ueber `brochess.botAction`:
 * Der Adapter wirft im Modus noch absichtlich ("Secret Dame hat noch keinen
 * Bot"), und ihn freizuschalten gehoert nicht zu diesem Schritt. Saat 0:
 * Weiss sitzt auf 0, Schwarz auf 1.
 */

const WEISS = 0;
const SCHWARZ = 1;

function geheimPartie(regel: 'A' | 'B', fen?: string): BroChessPartie {
  const regeln: BroChessRegeln = { modus: 'secretDame', schachDurchVerdeckte: regel };
  return erstellePartie(regeln, 0, fen);
}

const wahl = (feld: string): BroChessAktion => ({ type: 'wahl', feld });

function gewaehlt(regel: 'A' | 'B', weiss: string, schwarz: string, fen?: string): BroChessPartie {
  return fuehreAus(fuehreAus(geheimPartie(regel, fen), WEISS, wahl(weiss)), SCHWARZ, wahl(schwarz));
}

/** Ein Zug des Bots am Sitz am Zug — aus dessen Sicht, wie am Server. */
function botSchritt(partie: BroChessPartie, stufe: BotLevel = 'standard'): BroChessPartie {
  const sitz = amZug(partie)!;
  return fuehreAus(partie, sitz, botZug(sichtFuer(partie, sitz), stufe));
}

test('Secret Dame: der Bot waehlt selbst eine eigene Figur, nie den König, unter A und B', () => {
  for (const regel of ['A', 'B'] as const) {
    let p = geheimPartie(regel);
    for (const sitz of [WEISS, SCHWARZ]) {
      const aktion = botZug(sichtFuer(p, sitz), 'standard');
      assert.equal(aktion.type, 'wahl', regel);
      assert.ok(
        erlaubteAktionen(p, sitz).some((a) => a.type === 'wahl' && a.feld === (aktion as { feld: string }).feld),
        `${regel}: ${JSON.stringify(aktion)} steht nicht in legalActions`,
      );
      p = fuehreAus(p, sitz, aktion);
      const meine = sichtFuer(p, sitz).secretDame!.meine!;
      assert.notEqual(meine.grundfigur, 'k');
      assert.equal(meine.zustand, 'verdeckt');
    }
    // Hat er gewaehlt und der Gegner noch nicht, gibt es fuer ihn nichts zu tun — kein Ratezug.
    const halb = fuehreAus(geheimPartie(regel), WEISS, wahl('b1'));
    assert.throws(() => botZug(sichtFuer(halb, WEISS), 'standard'), /Schon gewaehlt/);
  }
});

test('Secret Dame: der Bot nutzt die Damenzuege seiner geheimen Figur', () => {
  // Springer d1 ist die geheime Dame; die schwarze Dame auf d4 haengt, erreichbar nur als Dame (d1-d4).
  for (const regel of ['A', 'B'] as const) {
    const p = gewaehlt(regel, 'd1', 'd4', '4k3/8/8/8/3q4/8/8/3NK3 w - - 0 1');
    for (const stufe of STUFEN) {
      const aktion = botZug(sichtFuer(p, WEISS), stufe) as BroChessZug;
      assert.deepEqual([aktion.von, aktion.nach], ['d1', 'd4'], `${regel}/${stufe}`);
      const danach = fuehreAus(p, WEISS, aktion);
      assert.equal(danach.secretDame!.w.zustand, 'aufgedeckt', 'der Damenzug deckt ihn auf');
    }
  }
});

test('Secret Dame, Regel A: der Bot schlaegt den König, den der Gegner in Reichweite stehen liess', () => {
  // Springer b1 ist die geheime Dame, der schwarze König steht auf der freien b-Linie.
  const p = gewaehlt('A', 'b1', 'h7', '1k6/7p/8/8/8/8/8/1N2K3 w - - 0 1');
  for (const stufe of STUFEN) {
    const danach = botSchritt(p, stufe);
    assert.deepEqual(danach.letzterZug, { von: 'b1', nach: 'b8' }, stufe);
    assert.deepEqual(danach.ende, { ausgang: 'matt', sieger: WEISS });
  }
});

test('Secret Dame, Regel A: der Bot stellt seinen König nicht vor eine moegliche verdeckte Dame', () => {
  // Weiss: König e1, Bauer h2 (geheim). Schwarz: König e8, Bauer a7 und Springer d7 (geheim).
  // Jeder Königszug, der auf eine Linie eines Kandidaten tritt, ist ein moeglicher Königsschlag.
  const p = gewaehlt('A', 'h2', 'd7', '4k3/p2n4/8/8/8/8/7P/4K3 w - - 0 1');
  const aktion = botZug(sichtFuer(p, WEISS), 'standard') as BroChessZug;
  const danach = fuehreAus(p, WEISS, aktion);
  const koenig = danach.stellung.brett.indexOf('K');
  // Der echte Kandidat d7 darf den König danach nicht als Dame erreichen.
  const schwarz = erlaubteAktionen(danach, SCHWARZ);
  assert.ok(
    !schwarz.some((a) => a.type === 'zug' && feldIndex(a.nach) === koenig),
    `${aktion.von}-${aktion.nach} laesst den König schlagbar stehen`,
  );
});

test('Secret Dame, Regel B: im Schach durch eine unbekannte Dame zieht der Bot trotzdem legal', () => {
  // Schwarzer Springer a5 ist die geheime Dame und gibt ueber a5-e1 Schach — sichtbar ist nichts.
  const p = gewaehlt('B', 'h2', 'a5', '4k3/7p/8/n7/8/8/7P/4K3 w - - 0 1');
  const sicht = sichtFuer(p, WEISS);
  assert.equal(sicht.schach, true, 'unter B steht Weiss im Schach');
  assert.equal(sicht.secretDame!.bekannt.b, null, 'und weiss nicht, durch wen');
  for (const stufe of STUFEN) {
    // fuehreAus wirft, wenn der Zug das Schach nicht aufhebt.
    botSchritt(p, stufe);
  }
});

test('Secret Dame, Regel B: ist kein Zug sicher legal, gibt der Bot auf, statt zu raten', () => {
  /*
   * König c1 im sichtbaren Schach durch Lb2 (aus einer Probepartie, 04.11.2026).
   * Ist Th8 die verdeckte Dame, ist Kxb2 verboten; ist es Bh7, sind Kb1 und Kc2
   * verboten. Die Sicht ist in beiden Faellen dieselbe — ein geratener Zug
   * waere in einem davon illegal, und der Server braeche den Tisch ab.
   */
  const fen = '3qk1nr/5p1p/4p3/8/2P5/7P/1b2PPBP/2K5 w - - 0 22';
  for (const schwarz of ['h8', 'h7']) {
    const p = gewaehlt('B', 'g2', schwarz, fen);
    const aktion = botZug(sichtFuer(p, WEISS), 'standard');
    assert.deepEqual(aktion, { type: 'aufgeben' }, schwarz);
    assert.deepEqual(fuehreAus(p, WEISS, aktion).ende, { ausgang: 'aufgabe', sieger: SCHWARZ });
  }
  // Unter Regel A haengt die Legalitaet nicht an der verdeckten Dame: Dort zieht er.
  const a = gewaehlt('A', 'g2', 'h8', fen);
  assert.equal(botZug(sichtFuer(a, WEISS), 'standard').type, 'zug');
});

/*
 * Der Beleg, dass der Bot die fremde Wahl nicht liest: Zwei Partien, die sich
 * NUR darin unterscheiden, welche Figur Schwarz verdeckt gewaehlt hat, laufen
 * mit denselben Zuegen. Solange die schwarze Dame verdeckt bleibt, muss der
 * weisse Bot in beiden Partien Zug fuer Zug dasselbe spielen — und seine
 * Sicht muss dieselbe sein. Haette er irgendeinen Weg an die Wahl, liefe er
 * hier auseinander.
 */
test('Secret Dame: der Bot kennt die fremde Wahl nicht — gleiche Zuege bei verschiedener Wahl', () => {
  for (const regel of ['A', 'B'] as const) {
    let eins = gewaehlt(regel, 'f1', 'a8');
    let zwei = gewaehlt(regel, 'f1', 'h7');
    let verglichen = 0;
    for (let halbzug = 0; halbzug < 40 && eins.ende === null && zwei.ende === null; halbzug += 1) {
      const sitz = amZug(eins)!;
      const sichtEins = sichtFuer(eins, sitz);
      const sichtZwei = sichtFuer(zwei, sitz);
      let aktion: BroChessAktion;
      if (sitz === WEISS) {
        // Unter B darf sich die weisse Sicht unterscheiden (Schach durch die verdeckte Dame
        // ist dort Regel) — dann endet der Vergleich, denn dann liegt die Information offen.
        if (JSON.stringify(sichtEins) !== JSON.stringify(sichtZwei)) {
          assert.equal(regel, 'B', `Unter A unterscheidet sich die Sicht nach ${halbzug} Halbzuegen`);
          break;
        }
        aktion = botZug(sichtEins, 'standard');
        assert.deepEqual(botZug(sichtZwei, 'standard'), aktion, `${regel}, Halbzug ${halbzug}`);
        // Nur Daten, keine Verweise: Eine reine JSON-Kopie der Sicht ergibt denselben Zug.
        assert.deepEqual(botZug(JSON.parse(JSON.stringify(sichtEins)) as BroChessSicht, 'standard'), aktion);
        verglichen += 1;
      } else {
        aktion = botZug(sichtEins, 'standard');
      }
      const legal = (p: BroChessPartie): boolean =>
        erlaubteAktionen(p, sitz).some((a) => JSON.stringify(a) === JSON.stringify(aktion));
      if (!legal(eins) || !legal(zwei)) break;
      eins = fuehreAus(eins, sitz, aktion);
      zwei = fuehreAus(zwei, sitz, aktion);
      if (eins.secretDame!.b.zustand !== 'verdeckt' || zwei.secretDame!.b.zustand !== 'verdeckt') break;
    }
    assert.ok(verglichen >= 5, `${regel}: nur ${verglichen} weisse Zuege verglichen`);
  }
});

/**
 * Die Probepartie Bot gegen Bot: von der Wahl bis zum Ende, jede Aktion durch
 * `fuehreAus` (wirft bei allem, was `act` am Server abweisen wuerde).
 */
function probepartie(regel: 'A' | 'B', weiss: BotLevel, schwarz: BotLevel) {
  let p = geheimPartie(regel);
  // Beide waehlen gleichzeitig; jeder aus seiner eigenen Sicht.
  p = fuehreAus(p, WEISS, botZug(sichtFuer(p, WEISS), weiss));
  p = fuehreAus(p, SCHWARZ, botZug(sichtFuer(p, SCHWARZ), schwarz));
  let langsamster = 0;
  for (let halbzug = 0; halbzug < 400 && p.ende === null; halbzug += 1) {
    const sitz = amZug(p)!;
    const start = performance.now();
    const aktion = botZug(sichtFuer(p, sitz), sitz === WEISS ? weiss : schwarz);
    langsamster = Math.max(langsamster, performance.now() - start);
    p = fuehreAus(p, sitz, aktion);
  }
  return { p, langsamster };
}

for (const regel of ['A', 'B'] as const) {
  test(`Secret Dame, Regel ${regel}: Probepartie Bot gegen Bot bis zum Ende`, () => {
    const { p, langsamster } = probepartie(regel, 'standard', 'anfaenger');
    assert.ok(p.ende !== null, `Partie endet (${p.verlauf.length} Halbzuege)`);
    assert.ok(langsamster < 3000, `langsamster Zug ${Math.round(langsamster)} ms`);
    // Fuer die Fertigmeldung: Verlauf und Ausgang stehen im Testprotokoll.
    console.log(
      `Probepartie Regel ${regel}: ${JSON.stringify(p.ende)} nach ${p.verlauf.length} Halbzuegen, ` +
        `Wahl Weiss ${p.secretDame!.w.grundfigur} / Schwarz ${p.secretDame!.b.grundfigur}, ` +
        `langsamster Zug ${Math.round(langsamster)} ms\n  ${p.verlauf.join(' ')}\n  Ereignisse: ${JSON.stringify(p.secretDame!.ereignisse)}`,
    );
  });
}
