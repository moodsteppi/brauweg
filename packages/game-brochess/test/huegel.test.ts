import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BotLevel } from '@brauweg/game-api';

import { feldIndex } from '../src/brett.js';
import { brochess } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { HUEGEL_FELDER, abstandZumHuegel, istHuegel, zugErreichtHuegel } from '../src/huegel.js';
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
 * Koenig des Huegels (seit dem 17.11.2026). Saat 0: Weiss sitzt auf 0, Schwarz auf 1.
 */

const WEISS = 0;
const SCHWARZ = 1;
const HUEGEL: BroChessRegeln = { modus: 'huegel' };

const partie = (fen?: string, regeln: BroChessRegeln = HUEGEL): BroChessPartie => erstellePartie(regeln, 0, fen);

const zug = (von: string, nach: string): BroChessAktion => ({ type: 'zug', von, nach });

/** Spielt Zuege abwechselnd; jeder muss in `legalActions` stehen. */
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

const zieleVon = (p: BroChessPartie, sitz: number): string[] =>
  erlaubteAktionen(p, sitz).flatMap((a) => (a.type === 'zug' ? [a.nach] : []));

// ---------------------------------------------------------------------------
// Regelsatz, Huegel, Zugerzeugung
// ---------------------------------------------------------------------------

test('Huegel: die vier Mittelfelder und ihr Abstand', () => {
  assert.deepEqual([...HUEGEL_FELDER], ['d4', 'e4', 'd5', 'e5']);
  for (const f of HUEGEL_FELDER) {
    assert.ok(istHuegel(feldIndex(f)), f);
    assert.equal(abstandZumHuegel(feldIndex(f)), 0, f);
  }
  for (const f of ['c4', 'f5', 'd3', 'e6', 'c3', 'f6']) {
    assert.ok(!istHuegel(feldIndex(f)), f);
    assert.equal(abstandZumHuegel(feldIndex(f)), 1, f);
  }
  assert.equal(abstandZumHuegel(feldIndex('e1')), 3);
  assert.equal(abstandZumHuegel(feldIndex('a8')), 3);
  assert.equal(abstandZumHuegel(feldIndex('b2')), 2);
  // Nur ein Koenigszug auf den Huegel zaehlt.
  assert.ok(zugErreichtHuegel('K', feldIndex('e4')));
  assert.ok(zugErreichtHuegel('k', feldIndex('d5')));
  assert.ok(!zugErreichtHuegel('Q', feldIndex('e4')));
  assert.ok(!zugErreichtHuegel('K', feldIndex('f4')));
});

test('Huegel: Regelsatz nimmt den Modus an, die Sicht nennt die Felder', () => {
  assert.deepEqual(pruefeRegeln({ modus: 'huegel' }, 2, 1), []);
  assert.deepEqual(pruefeRegeln({ modus: 'huegel', bedenkzeitMs: 180_000, zuschlagMs: 2_000 }, 2, 1), []);
  const p = partie();
  assert.deepEqual(sichtFuer(p, WEISS).huegel, { felder: ['d4', 'e4', 'd5', 'e5'] });
  assert.deepEqual(sichtFuer(p, SCHWARZ).huegel, { felder: ['d4', 'e4', 'd5', 'e5'] });
  assert.deepEqual(zuschauerSicht(p).huegel, { felder: ['d4', 'e4', 'd5', 'e5'] });
  // Die anderen Modi bleiben ohne Huegel.
  assert.equal(sichtFuer(erstellePartie(DEFAULT_REGELN, 0), 0).huegel, null);
  assert.equal(sichtFuer(erstellePartie({ modus: 'dreiSchach' }, 0), 0).huegel, null);
});

test('Huegel: die Zuege sind dieselben wie im normalen Schach', () => {
  const stellungen = [
    undefined,
    'rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3',
    'r3k2r/1P6/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1',
    'k7/8/8/8/r7/4K3/8/8 w - - 0 1',
  ];
  for (const fen of stellungen) {
    const h = partie(fen);
    const normal = partie(fen, DEFAULT_REGELN);
    const sitz = amZug(h)!;
    assert.deepEqual(erlaubteAktionen(h, sitz), erlaubteAktionen(normal, sitz), fen ?? 'Grundstellung');
  }
});

// ---------------------------------------------------------------------------
// Siegbedingung
// ---------------------------------------------------------------------------

test('Huegel: der Koenig auf ein Mittelfeld gewinnt sofort — jedes der vier, beide Farben', () => {
  for (const nach of ['d4', 'e4']) {
    const p = fuehreAus(partie('k7/8/8/8/8/3K4/8/8 w - - 0 1'), WEISS, zug('d3', nach));
    assert.deepEqual(p.ende, { ausgang: 'huegel', sieger: WEISS }, nach);
  }
  for (const nach of ['d5', 'e5']) {
    const p = spiele(partie('8/8/3k4/8/8/8/8/K6R w - - 0 1'), ['h1h2']);
    const q = fuehreAus(p, SCHWARZ, zug('d6', nach));
    assert.deepEqual(q.ende, { ausgang: 'huegel', sieger: SCHWARZ }, nach);
  }
});

test('Huegel: der Koenig nimmt auch eine Figur auf dem Huegel', () => {
  const p = fuehreAus(partie('k7/8/8/8/4p3/4K3/8/8 w - - 0 1'), WEISS, zug('e3', 'e4'));
  assert.deepEqual(p.ende, { ausgang: 'huegel', sieger: WEISS });
});

test('Huegel: keine andere Figur gewinnt dort, und ein Zug daneben auch nicht', () => {
  const dame = fuehreAus(partie('k7/8/8/8/8/8/4Q3/K7 w - - 0 1'), WEISS, zug('e2', 'e4'));
  assert.equal(dame.ende, null);
  const nah = fuehreAus(partie('k7/8/8/8/8/4K3/8/8 w - - 0 1'), WEISS, zug('e3', 'f3'));
  assert.equal(nah.ende, null);
  // 1.e4 besetzt den Huegel mit einem Bauern: normal weiter.
  assert.equal(spiele(partie(), ['e2e4']).ende, null);
});

test('Huegel: legal heisst legal — kein Zug auf ein angegriffenes Mittelfeld', () => {
  // Der Turm auf a4 beherrscht die vierte Reihe: d4 und e4 sind verboten.
  const p = partie('k7/8/8/8/r7/4K3/8/8 w - - 0 1');
  const ziele = zieleVon(p, WEISS);
  assert.ok(!ziele.includes('e4'));
  assert.ok(!ziele.includes('d4'));
  assert.ok(ziele.includes('d3'));
  assert.throws(() => fuehreAus(p, WEISS, zug('e3', 'e4')), /nicht erlaubt/);
  assert.throws(() => fuehreAus(p, WEISS, zug('e3', 'd4')), /nicht erlaubt/);
  // Ein Turm weit weg (a1, beherrscht nur die erste Reihe): e4 ist frei und gewinnt.
  const q = fuehreAus(partie('k7/8/8/8/8/4K3/8/r7 w - - 0 1'), WEISS, zug('e3', 'e4'));
  assert.deepEqual(q.ende, { ausgang: 'huegel', sieger: WEISS });
});

test('Huegel: ein Koenig im Schach muss erst das Schach abwehren — Huegel nur, wenn das der Ausweg ist', () => {
  // Weisser Koenig e3 im Schach vom Turm e8; e4 bliebe auf der Linie (verboten), d4 ist der Ausweg.
  const p = partie('k3r3/8/8/8/8/4K3/8/8 w - - 0 1');
  const ziele = zieleVon(p, WEISS);
  assert.ok(!ziele.includes('e4'));
  assert.ok(ziele.includes('d4'));
  assert.deepEqual(fuehreAus(p, WEISS, zug('e3', 'd4')).ende, { ausgang: 'huegel', sieger: WEISS });
});

test('Huegel: ein Koenig, der schon dort steht, gewinnt erst mit einem Zug auf ein Huegelfeld', () => {
  const start = partie('k7/8/8/4K3/8/8/8/8 w - - 0 1');
  assert.equal(start.ende, null);
  assert.equal(fuehreAus(start, WEISS, zug('e5', 'f5')).ende, null);
  assert.deepEqual(fuehreAus(start, WEISS, zug('e5', 'e4')).ende, { ausgang: 'huegel', sieger: WEISS });
});

test('Huegel: Matt gewinnt weiter', () => {
  const matt = spiele(partie(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.deepEqual(matt.ende, { ausgang: 'matt', sieger: SCHWARZ });
});

// ---------------------------------------------------------------------------
// Remis, Zeit
// ---------------------------------------------------------------------------

test('Huegel Remis: Patt bleibt Patt', () => {
  const p = fuehreAus(partie('7k/8/4Q1K1/8/8/8/8/8 w - - 0 1'), WEISS, zug('e6', 'f7'));
  assert.deepEqual(p.ende, { ausgang: 'patt', sieger: null });
});

test('Huegel Remis: dreifache Wiederholung weit weg vom Huegel', () => {
  const p = spiele(partie('k7/8/8/8/8/8/8/K7 w - - 0 1'), [
    'a1b1', 'a8b8', 'b1a1', 'b8a8', 'a1b1', 'a8b8', 'b1a1', 'b8a8',
  ]);
  assert.deepEqual(p.ende, { ausgang: 'wiederholung', sieger: null });
});

test('Huegel Remis: zu wenig Material gibt es nicht — ein nackter König kann noch hin', () => {
  const fen = 'k7/8/8/8/8/8/8/K7 w - - 0 1';
  assert.deepEqual(fuehreAus(partie(fen, DEFAULT_REGELN), WEISS, zug('a1', 'b1')).ende, {
    ausgang: 'material',
    sieger: null,
  });
  assert.equal(fuehreAus(partie(fen), WEISS, zug('a1', 'b1')).ende, null);
  // Auch König und Läufer gegen König laufen weiter.
  assert.equal(fuehreAus(partie('k7/8/8/8/8/8/8/KB6 w - - 0 1'), WEISS, zug('a1', 'a2')).ende, null);
});

test('Huegel Remis: 50-Zuege-Regel — aber der Huegel geht vor', () => {
  const p = fuehreAus(partie('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'), WEISS, zug('a1', 'a2'));
  assert.deepEqual(p.ende, { ausgang: 'fuenfzigZuege', sieger: null });
  const h = fuehreAus(partie('k7/8/8/8/8/4K3/8/8 w - - 99 80'), WEISS, zug('e3', 'e4'));
  assert.deepEqual(h.ende, { ausgang: 'huegel', sieger: WEISS });
});

test('Huegel Zeit: der Gegner gewinnt immer, auch mit nacktem König', () => {
  const uhr = { bedenkzeitMs: 60_000 };
  const fen = '4k3/8/8/8/8/8/8/4K3 b - - 0 1';
  const h = verbraucheZeit(erstellePartie({ ...HUEGEL, ...uhr }, 0, fen), SCHWARZ, 60_000);
  assert.deepEqual(h.ende, { ausgang: 'zeit', sieger: WEISS });
  // Im normalen Schach bliebe es ein Remis.
  const normal = verbraucheZeit(erstellePartie(uhr, 0, fen), SCHWARZ, 60_000);
  assert.deepEqual(normal.ende, { ausgang: 'zeit', sieger: null });
});

test('Huegel: Snapshot und Wertung', () => {
  const p = fuehreAus(partie('k7/8/8/8/8/4K3/8/8 w - - 0 1'), WEISS, zug('e3', 'e4'));
  const geladen = brochess.deserialize(JSON.parse(JSON.stringify(brochess.serialize(p))));
  assert.deepEqual(geladen.ende, { ausgang: 'huegel', sieger: WEISS });
  assert.equal(brochess.isFinished(geladen), true);
  assert.deepEqual(
    brochess.standings(geladen).map((s) => [s.seat, s.place]),
    [[0, 1], [1, 2]],
  );
});

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

const STUFEN: BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];

test('Huegel Bot: zieht den Koenig auf den Huegel, wenn er kann — auch mit einer Dame zum Nehmen', () => {
  const p = partie('k7/8/8/8/8/3KQ3/8/q7 w - - 0 1');
  for (const stufe of STUFEN) {
    const a = botZug(sichtFuer(p, WEISS), stufe);
    assert.equal(a.type, 'zug');
    assert.ok(HUEGEL_FELDER.includes((a as { nach: string }).nach), `${stufe}: ${JSON.stringify(a)}`);
    assert.equal((a as { von: string }).von, 'd3', stufe);
    assert.deepEqual(fuehreAus(p, WEISS, a).ende, { ausgang: 'huegel', sieger: WEISS }, stufe);
  }
});

test('Huegel Bot: haelt den gegnerischen König vom Huegel fern', () => {
  /*
   * Der schwarze König auf d6 erreicht mit dem naechsten Zug d5 oder e5. Nur
   * Ta5 beherrscht beide Felder; Td1+ und Ta6+ geben Schach, der König
   * weicht aber auf den Huegel aus und gewinnt.
   */
  const p = partie('8/8/3k4/8/8/8/8/R6K w - - 0 1');
  for (const stufe of STUFEN) {
    const a = botZug(sichtFuer(p, WEISS), stufe);
    assert.deepEqual(a, zug('a1', 'a5'), stufe);
    const q = fuehreAus(p, WEISS, a);
    for (const antwort of erlaubteAktionen(q, SCHWARZ)) {
      const r = fuehreAus(q, SCHWARZ, antwort);
      assert.notDeepEqual(r.ende, { ausgang: 'huegel', sieger: SCHWARZ }, `${stufe}: ${JSON.stringify(antwort)}`);
    }
  }
});

test('Huegel Bot: gleiche Sicht, gleicher Zug', () => {
  const p = spiele(partie(), ['e2e4', 'e7e5', 'g1f3']);
  const sicht = sichtFuer(p, SCHWARZ);
  assert.deepEqual(botZug(sicht, 'experte'), botZug(sicht, 'experte'));
});

test('Huegel Bot gegen Bot: Stichprobe, jeder Zug legal, jede Partie endet', () => {
  /*
   * Klein gehalten, damit der Lauf schnell bleibt. Die grosse Probe (200
   * Partien, alle Stufen) steht in werkzeug/huegel-probe.mjs.
   */
  const stufen: BotLevel[] = ['anfaenger', 'standard', 'experte'];
  let huegel = 0;
  for (let i = 0; i < 9; i += 1) {
    let p = brochess.createParty({ config: HUEGEL, seats: 2, rounds: 1, seed: i });
    const stufe = [stufen[i % 3]!, stufen[Math.floor(i / 3)]!];
    for (let halbzug = 0; halbzug < 400 && !brochess.isFinished(p); halbzug += 1) {
      const sitz = brochess.currentActor(p)!;
      const aktion = brochess.botAction!(brochess.viewFor(p, sitz), stufe[sitz]!);
      assert.equal(aktion.type, 'zug');
      // `act` wirft bei einem illegalen Zug — wie der Server, der dann den Tisch abbricht.
      p = brochess.act(p, sitz, aktion);
    }
    assert.ok(brochess.isFinished(p), `Partie ${i} endet`);
    if (p.ende?.ausgang === 'huegel') huegel += 1;
  }
  // Der Bot sucht den Huegel: Ein Teil der Partien endet dort.
  assert.ok(huegel >= 3, `nur ${huegel} von 9 am Huegel`);
});
