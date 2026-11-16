import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BotLevel } from '@brauweg/game-api';

import { brochess } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { dreiSchachSchluessel } from '../src/dreischach.js';
import {
  type BroChessAktion,
  type BroChessPartie,
  amZug,
  erlaubteAktionen,
  erstellePartie,
  fuehreAus,
  verbraucheZeit,
} from '../src/partie.js';
import { type BroChessRegeln, DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

/*
 * Drei-Schach (seit dem 14.11.2026). Saat 0: Weiss sitzt auf 0, Schwarz auf 1.
 */

const WEISS = 0;
const SCHWARZ = 1;
const DREI: BroChessRegeln = { modus: 'dreiSchach' };

const partie = (fen?: string, regeln: BroChessRegeln = DREI): BroChessPartie => erstellePartie(regeln, 0, fen);

/** Partie aus einer Stellung, in der schon Schachs gegeben wurden. */
const mitZaehler = (fen: string, w: number, b: number): BroChessPartie => ({
  ...partie(fen),
  dreiSchach: { gegeben: { w, b } },
});

const zug = (von: string, nach: string): BroChessAktion => ({ type: 'zug', von, nach });

/** Spielt Zuege abwechselnd, Weiss zuerst; jeder muss in `legalActions` stehen. */
function spiele(p: BroChessPartie, zuege: readonly string[]): BroChessPartie {
  for (const z of zuege) {
    const sitz = amZug(p)!;
    const [von, nach] = [z.slice(0, 2), z.slice(2, 4)];
    assert.ok(
      erlaubteAktionen(p, sitz).some((a) => a.type === 'zug' && a.von === von && a.nach === nach),
      `${z} muss erlaubt sein`,
    );
    p = fuehreAus(p, sitz, zug(von, nach));
  }
  return p;
}

// 1.e4 e5 2.Bc4 Nc6 3.Bxf7+ Kxf7 4.Qh5+ g6 5.Qxg6+ — drei Schachs von Weiss, keins davon matt.
const DREI_SCHACHS = ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'c4f7', 'e8f7', 'd1h5', 'g7g6', 'h5g6'];

// ---------------------------------------------------------------------------
// Regelsatz und Zugerzeugung
// ---------------------------------------------------------------------------

test('Drei-Schach: Regelsatz nimmt den Modus an, normal bleibt ohne Zaehler', () => {
  assert.deepEqual(pruefeRegeln({ modus: 'dreiSchach' }, 2, 1), []);
  assert.deepEqual(pruefeRegeln({ modus: 'dreiSchach', bedenkzeitMs: 180_000, zuschlagMs: 2_000 }, 2, 1), []);
  assert.deepEqual(partie().dreiSchach, { gegeben: { w: 0, b: 0 } });
  const normal = erstellePartie(DEFAULT_REGELN, 0);
  assert.equal(normal.dreiSchach, undefined);
  assert.equal(sichtFuer(normal, 0).dreiSchach, null);
  // Der normale Modus schreibt die Wiederholungen weiter ohne Zaehler.
  assert.deepEqual(Object.keys(normal.wiederholungen), Object.keys(erstellePartie({}, 0).wiederholungen));
  assert.ok(!Object.keys(normal.wiederholungen)[0]!.includes('+'));
});

test('Drei-Schach: die Zuege sind dieselben wie im normalen Schach', () => {
  const stellungen = [
    undefined,
    // Schach durch den Laeufer: nur Abwehrzuege
    'rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3',
    // Rochade, en passant und Umwandlung in einer Stellung
    'r3k2r/1P6/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1',
  ];
  for (const fen of stellungen) {
    const drei = partie(fen);
    const normal = partie(fen, DEFAULT_REGELN);
    const sitz = amZug(drei)!;
    assert.equal(sitz, amZug(normal));
    assert.deepEqual(erlaubteAktionen(drei, sitz), erlaubteAktionen(normal, sitz), fen ?? 'Grundstellung');
    assert.deepEqual(erlaubteAktionen(drei, 1 - sitz), []);
  }
});

// ---------------------------------------------------------------------------
// Zaehler und Siegbedingung
// ---------------------------------------------------------------------------

test('Drei-Schach: jedes Schach zaehlt fuer den, der es gibt — ein ruhiger Zug zaehlt nicht', () => {
  let p = spiele(partie(), ['e2e4', 'e7e5', 'f1c4', 'b8c6']);
  assert.deepEqual(p.dreiSchach!.gegeben, { w: 0, b: 0 });
  p = spiele(p, ['c4f7']);
  assert.deepEqual(p.dreiSchach!.gegeben, { w: 1, b: 0 });
  p = spiele(p, ['e8f7', 'd1h5']);
  assert.deepEqual(p.dreiSchach!.gegeben, { w: 2, b: 0 });
  assert.equal(p.ende, null);
  assert.deepEqual(sichtFuer(p, SCHWARZ).dreiSchach, { gegeben: { w: 2, b: 0 }, ziel: 3 });
  assert.deepEqual(zuschauerSicht(p).dreiSchach, { gegeben: { w: 2, b: 0 }, ziel: 3 });
  assert.equal(sichtFuer(p, SCHWARZ).schach, true);
});

test('Drei-Schach: das dritte Schach gewinnt, auch wenn es kein Matt ist', () => {
  const p = spiele(partie(), DREI_SCHACHS);
  assert.deepEqual(p.dreiSchach!.gegeben, { w: 3, b: 0 });
  assert.deepEqual(p.ende, { ausgang: 'dreiSchach', sieger: WEISS });
  assert.deepEqual(brochess.standings(p).map((s) => s.place), [1, 2]);
  // Dieselben Zuege im normalen Schach: Die Partie laeuft weiter.
  assert.equal(spiele(partie(undefined, DEFAULT_REGELN), DREI_SCHACHS).ende, null);
});

test('Drei-Schach: Matt gewinnt weiterhin sofort, schon mit dem ersten Schach', () => {
  // Narrenmatt: 1.f3 e5 2.g4 Qh4#
  const p = spiele(partie(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.deepEqual(p.ende, { ausgang: 'matt', sieger: SCHWARZ });
  assert.deepEqual(p.dreiSchach!.gegeben, { w: 0, b: 1 });
});

test('Drei-Schach: Ist das dritte Schach zugleich Matt, heisst der Ausgang Matt', () => {
  const p = fuehreAus(mitZaehler('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 2, 0), WEISS, zug('a1', 'a8'));
  assert.deepEqual(p.ende, { ausgang: 'matt', sieger: WEISS });
  assert.equal(p.dreiSchach!.gegeben.w, 3);
});

test('Drei-Schach: das dritte Schach geht der 50-Zuege-Regel vor', () => {
  const fen = '4k3/8/8/8/8/8/8/R3K3 w - - 99 80';
  assert.deepEqual(fuehreAus(mitZaehler(fen, 2, 1), WEISS, zug('a1', 'a8')).ende, {
    ausgang: 'dreiSchach',
    sieger: WEISS,
  });
  // Mit erst einem Schach ist es das zweite — dann greift die 50-Zuege-Regel.
  assert.deepEqual(fuehreAus(mitZaehler(fen, 1, 1), WEISS, zug('a1', 'a8')).ende, {
    ausgang: 'fuenfzigZuege',
    sieger: null,
  });
});

test('Drei-Schach: Schwarz gewinnt genauso mit seinem dritten Schach', () => {
  const p = fuehreAus(mitZaehler('r3k3/8/8/8/8/8/8/4K3 b - - 0 1', 0, 2), SCHWARZ, zug('a8', 'a1'));
  assert.deepEqual(p.ende, { ausgang: 'dreiSchach', sieger: SCHWARZ });
});

// ---------------------------------------------------------------------------
// Remis
// ---------------------------------------------------------------------------

test('Drei-Schach Remis: Patt bleibt Patt', () => {
  const p = fuehreAus(partie('7k/8/5QK1/8/8/8/8/8 w - - 0 1'), WEISS, zug('f6', 'f7'));
  assert.deepEqual(p.ende, { ausgang: 'patt', sieger: null });
});

test('Drei-Schach Remis: dreifache Wiederholung bei gleichem Zaehlerstand', () => {
  const p = spiele(partie(), ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']);
  assert.deepEqual(p.ende, { ausgang: 'wiederholung', sieger: null });
});

test('Drei-Schach Remis: der Zaehlerstand gehoert zur Stellung', () => {
  const schluessel = 'stellung';
  assert.notEqual(
    dreiSchachSchluessel(schluessel, { gegeben: { w: 1, b: 0 } }),
    dreiSchachSchluessel(schluessel, { gegeben: { w: 2, b: 0 } }),
  );
  // Nach einem Schach steht dieselbe Figurenstellung mit anderem Zaehler unter einem anderen Schluessel.
  const p = spiele(partie(), ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'c4f7']);
  assert.ok(Object.keys(p.wiederholungen).every((k) => / \+\d\+\d$/.test(k)));
  assert.ok(Object.keys(p.wiederholungen).at(-1)!.endsWith(' +1+0'));
});

test('Drei-Schach Remis: zu wenig Material erst, wenn nur noch die Könige stehen', () => {
  // Kxd2: König und Laeufer gegen König. Im normalen Schach remis, hier nicht — der Laeufer gibt noch Schach.
  const fen = '4k3/8/8/8/8/8/3p4/4KB2 w - - 0 1';
  assert.deepEqual(fuehreAus(partie(fen, DEFAULT_REGELN), WEISS, zug('e1', 'd2')).ende, {
    ausgang: 'material',
    sieger: null,
  });
  assert.equal(fuehreAus(partie(fen), WEISS, zug('e1', 'd2')).ende, null);
  // Nur noch die Könige: remis in beiden Modi.
  assert.deepEqual(fuehreAus(partie('4k3/8/8/8/8/8/3p4/4K3 w - - 0 1'), WEISS, zug('e1', 'd2')).ende, {
    ausgang: 'material',
    sieger: null,
  });
});

test('Drei-Schach Remis: 50-Zuege-Regel ohne Schach', () => {
  const p = fuehreAus(mitZaehler('4k3/8/8/8/8/8/8/R3K3 w - - 99 80', 2, 2), WEISS, zug('a1', 'a2'));
  assert.deepEqual(p.ende, { ausgang: 'fuenfzigZuege', sieger: null });
});

test('Drei-Schach Zeit: wer noch eine Figur hat, gewinnt — auch mit einem einsamen Laeufer', () => {
  const uhr = { bedenkzeitMs: 60_000 };
  const fen = '4k3/8/8/8/8/8/8/4KB2 b - - 0 1';
  const drei = verbraucheZeit(erstellePartie({ ...DREI, ...uhr }, 0, fen), SCHWARZ, 60_000);
  assert.deepEqual(drei.ende, { ausgang: 'zeit', sieger: WEISS });
  const normal = verbraucheZeit(erstellePartie(uhr, 0, fen), SCHWARZ, 60_000);
  assert.deepEqual(normal.ende, { ausgang: 'zeit', sieger: null });
  // Nur der König: remis wie im normalen Schach.
  const nackt = verbraucheZeit(erstellePartie({ ...DREI, ...uhr }, 0, '4k3/8/8/8/8/8/8/4K3 b - - 0 1'), SCHWARZ, 60_000);
  assert.deepEqual(nackt.ende, { ausgang: 'zeit', sieger: null });
});

test('Drei-Schach: der Zaehler uebersteht den Snapshot', () => {
  const p = spiele(partie(), ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'c4f7']);
  const geladen = brochess.deserialize(JSON.parse(JSON.stringify(brochess.serialize(p))));
  assert.deepEqual(geladen.dreiSchach, { gegeben: { w: 1, b: 0 } });
  assert.deepEqual(geladen.wiederholungen, p.wiederholungen);
});

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

test('Drei-Schach Bot: mit zwei Schachs gibt jede Stufe das dritte, statt die Dame zu nehmen', () => {
  // Weiss kann die freie Dame auf d5 nehmen (Rxd5) oder mit Ra8+ das dritte Schach geben.
  const p = mitZaehler('6k1/8/8/3q4/8/8/8/R2RK3 w - - 0 1', 2, 0);
  for (const stufe of ['anfaenger', 'standard', 'experte', 'genie'] as BotLevel[]) {
    const aktion = botZug(sichtFuer(p, WEISS), stufe);
    const danach = fuehreAus(p, WEISS, aktion);
    assert.deepEqual(danach.ende, { ausgang: 'dreiSchach', sieger: WEISS }, stufe);
  }
});

test('Drei-Schach Bot: im normalen Schach nimmt dieselbe Stellung die Dame', () => {
  const p = partie('6k1/8/8/3q4/8/8/8/R2RK3 w - - 0 1', DEFAULT_REGELN);
  assert.deepEqual(botZug(sichtFuer(p, WEISS), 'standard'), zug('d1', 'd5'));
});

test('Drei-Schach Bot: ab Standard laesst er dem Gegner kein drittes Schach', () => {
  /*
   * Schwarz hat schon zwei Schachs gegeben. Weiss kann den Turm auf a5 mit
   * Qxa5 nehmen — dann gibt Schwarz mit Rb1+ das dritte Schach. Der Bot muss
   * stattdessen die b-Linie schliessen oder das Feld decken.
   */
  const p = mitZaehler('1r4k1/8/8/r7/8/8/5PPP/3Q2K1 w - - 0 1', 0, 2);
  for (const stufe of ['standard', 'experte', 'genie'] as BotLevel[]) {
    const q = fuehreAus(p, WEISS, botZug(sichtFuer(p, WEISS), stufe));
    assert.equal(q.ende, null, stufe);
    // Was Schwarz auch zieht: Ein drittes Schach darf es im naechsten Zug nicht geben.
    for (const antwort of erlaubteAktionen(q, SCHWARZ)) {
      const r = fuehreAus(q, SCHWARZ, antwort);
      assert.notDeepEqual(r.ende, { ausgang: 'dreiSchach', sieger: SCHWARZ }, `${stufe}: ${JSON.stringify(antwort)}`);
    }
  }
});

test('Drei-Schach Bot: gleiche Sicht, gleicher Zug', () => {
  const p = spiele(partie(), ['e2e4', 'e7e5', 'f1c4']);
  const sicht = sichtFuer(p, SCHWARZ);
  assert.deepEqual(botZug(sicht, 'experte'), botZug(sicht, 'experte'));
});

test('Drei-Schach Bot gegen Bot: Stichprobe, jeder Zug legal, jede Partie endet', () => {
  /*
   * Klein gehalten, damit der Lauf schnell bleibt: Genie steckt schon in den
   * Stellungstests oben. Die grosse Probe (200 Partien, alle Stufen) steht in
   * werkzeug/drei-schach-probe.mjs.
   */
  const stufen: BotLevel[] = ['anfaenger', 'standard', 'experte'];
  let dreiSchach = 0;
  for (let i = 0; i < 9; i += 1) {
    let p = brochess.createParty({ config: DREI, seats: 2, rounds: 1, seed: i });
    const stufe = [stufen[i % 3]!, stufen[Math.floor(i / 3)]!];
    for (let halbzug = 0; halbzug < 400 && !brochess.isFinished(p); halbzug += 1) {
      const sitz = brochess.currentActor(p)!;
      const aktion = brochess.botAction!(brochess.viewFor(p, sitz), stufe[sitz]!);
      assert.equal(aktion.type, 'zug');
      // `act` wirft bei einem illegalen Zug — wie der Server, der dann den Tisch abbricht.
      p = brochess.act(p, sitz, aktion);
    }
    assert.ok(brochess.isFinished(p), `Partie ${i} endet`);
    if (p.ende?.ausgang === 'dreiSchach') dreiSchach += 1;
  }
  // Der Bot sucht Schachgebote: Die meisten Partien enden mit dem dritten.
  assert.ok(dreiSchach >= 5, `nur ${dreiSchach} von 9 durch drittes Schach`);
});
