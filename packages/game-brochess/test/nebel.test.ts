import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BotLevel } from '@brauweg/game-api';

import { ausFen, feldIndex, feldName } from '../src/brett.js';
import { brochess } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { gemeinsameFelder, nebelZuege, sichtbareFelder } from '../src/nebel.js';
import {
  type BroChessAktion,
  type BroChessPartie,
  amZug,
  erlaubteAktionen,
  erstellePartie,
  fuehreAus,
  verbraucheZeit,
} from '../src/partie.js';
import { type BroChessRegeln, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

/*
 * Nebelschach (seit dem 17.11.2026). Saat 0: Weiss sitzt auf 0, Schwarz auf 1.
 */

const WEISS = 0;
const SCHWARZ = 1;
const NEBEL: BroChessRegeln = { modus: 'nebel' };

const partie = (fen?: string, regeln: BroChessRegeln = NEBEL): BroChessPartie => erstellePartie(regeln, 0, fen);

const zug = (von: string, nach: string, umwandlung?: 'q' | 'r' | 'b' | 'n'): BroChessAktion => ({
  type: 'zug',
  von,
  nach,
  ...(umwandlung ? { umwandlung } : {}),
});

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

const zieleVon = (p: BroChessPartie, sitz: number, von?: string): string[] =>
  erlaubteAktionen(p, sitz).flatMap((a) => (a.type === 'zug' && (von === undefined || a.von === von) ? [a.nach] : []));

// ---------------------------------------------------------------------------
// Regelsatz und Zugerzeugung
// ---------------------------------------------------------------------------

test('Nebel: der Modus ist ein gueltiger Regelsatz', () => {
  assert.deepEqual(pruefeRegeln({ modus: 'nebel' }, 2, 1), []);
  assert.equal(pruefeRegeln({ modus: 'gibtEsNicht' }, 2, 1).length, 1);
});

test('Nebel: kein Schach — ein König im Schach darf stehen bleiben, ein Zug ins Schach ist erlaubt', () => {
  // Der weisse König steht im Schach des Turms a1. Normal waere h2-h3 verboten.
  const p = partie('k7/8/8/8/8/8/7P/r3K3 w - - 0 1');
  const ziele = zieleVon(p, WEISS);
  assert.ok(ziele.includes('h3'), 'ein Zug, der das Schach nicht abwehrt');
  assert.ok(ziele.includes('d1') && ziele.includes('d2'), 'der König darf auf ein angegriffenes Feld');
  assert.equal(sichtFuer(p, WEISS).schach, false, 'die Sicht kennt kein Schach');
  const normal = erstellePartie({}, 0, 'k7/8/8/8/8/8/7P/r3K3 w - - 0 1');
  assert.ok(!zieleVon(normal, WEISS).includes('h3'), 'Gegenprobe: normales Schach verbietet es');
});

test('Nebel: gewonnen hat, wer den König schlaegt', () => {
  const p = fuehreAus(partie('K7/1k6/8/8/8/8/8/8 w - - 0 1'), WEISS, zug('a8', 'b7'));
  assert.deepEqual(p.ende, { ausgang: 'koenigGeschlagen', sieger: WEISS });
  assert.equal(amZug(p), null);
  assert.deepEqual(
    brochess.standings(p).map((s) => [s.seat, s.place, s.points]),
    [[0, 1, 2], [1, 2, 0]],
  );
});

test('Nebel: ein Matt im alten Sinn gibt es nicht — die Partie laeuft weiter', () => {
  // Normal waere das Rd8 ein Matt (Kb1 ... ) — hier steht nur der König im Schach, und er darf ziehen.
  const p = fuehreAus(partie('3r2k1/8/8/8/8/8/5PPP/6K1 b - - 0 1'), SCHWARZ, zug('d8', 'd1'));
  assert.equal(p.ende, null);
  assert.equal(amZug(p), WEISS);
  assert.ok(zieleVon(p, WEISS, 'g1').includes('h1'));
});

test('Nebel: ein Zug, der keine Figur schlaegt, aber den eigenen König ungedeckt laesst, ist erlaubt und kostet ihn', () => {
  // Weiss laesst den König im Schach stehen (h2-h3); Schwarz schlaegt ihn.
  let p = partie('k7/8/8/8/8/8/7P/r3K3 w - - 0 1');
  p = fuehreAus(p, WEISS, zug('h2', 'h3'));
  p = fuehreAus(p, SCHWARZ, zug('a1', 'e1'));
  assert.deepEqual(p.ende, { ausgang: 'koenigGeschlagen', sieger: SCHWARZ });
});

test('Nebel: Rochade auch durch angegriffene Felder und aus dem Schach', () => {
  // Schwarzer Turm f8 greift f1 und g1 an.
  const durch = partie('r3kr2/8/8/8/8/8/8/R3K2R w KQq - 0 1');
  assert.ok(zieleVon(durch, WEISS, 'e1').includes('g1'), 'kurz durch f1/g1');
  // Schwarzer Turm e8 gibt Schach, trotzdem geht die Rochade.
  const schach = partie('4r2k/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  const ziele = zieleVon(schach, WEISS, 'e1');
  assert.ok(ziele.includes('g1') && ziele.includes('c1'));
  const nachher = fuehreAus(schach, WEISS, zug('e1', 'g1'));
  assert.equal(nachher.stellung.brett[feldIndex('f1')], 'R');
  assert.equal(nachher.stellung.brett[feldIndex('g1')], 'K');
  // Gegenprobe: normales Schach verbietet beides.
  assert.ok(!zieleVon(erstellePartie({}, 0, 'r3kr2/8/8/8/8/8/8/R3K2R w KQq - 0 1'), WEISS, 'e1').includes('g1'));
});

test('Nebel: Rochade braucht freie Zwischenfelder und das Recht', () => {
  const p = partie('r3k2r/8/8/8/8/8/8/RN2K2R w Kkq - 0 1');
  assert.ok(zieleVon(p, WEISS, 'e1').includes('g1'));
  assert.ok(!zieleVon(p, WEISS, 'e1').includes('c1'), 'Springer b1 und kein Recht');
});

test('Nebel: en passant wie normal', () => {
  let p = partie('k7/8/8/3pP3/8/8/8/K7 w - d6 0 1');
  assert.ok(zieleVon(p, WEISS, 'e5').includes('d6'));
  p = fuehreAus(p, WEISS, zug('e5', 'd6'));
  assert.equal(p.stellung.brett[feldIndex('d5')], '', 'der Bauer neben dem Ziel ist weg');
  assert.deepEqual(sichtFuer(p, WEISS).geschlagen.b, ['p']);
});

test('Nebel: Bauernumwandlung in vier Figuren, auch mit Schlag', () => {
  let p = partie('k2r4/4P3/8/8/8/8/8/K7 w - - 0 1');
  const umwandlungen = erlaubteAktionen(p, WEISS).filter((a) => a.type === 'zug' && a.von === 'e7');
  assert.equal(umwandlungen.length, 8, 'e8 und exd8, je vier');
  p = fuehreAus(p, WEISS, zug('e7', 'd8', 'n'));
  assert.equal(p.stellung.brett[feldIndex('d8')], 'N');
});

test('Nebel: ein Zug, der nicht in legalActions steht, wird abgewiesen', () => {
  const p = partie();
  assert.throws(() => fuehreAus(p, WEISS, zug('e2', 'e5')), /nicht erlaubt/);
  assert.throws(() => fuehreAus(p, SCHWARZ, zug('e7', 'e5')), /Nicht am Zug/);
});

// ---------------------------------------------------------------------------
// Remis
// ---------------------------------------------------------------------------

test('Nebel: 50-Zuege-Regel greift', () => {
  const p = fuehreAus(partie('k7/8/8/8/8/8/8/K6R w - - 99 80'), WEISS, zug('h1', 'h2'));
  assert.deepEqual(p.ende, { ausgang: 'fuenfzigZuege', sieger: null });
});

test('Nebel: dreifache Wiederholung greift', () => {
  const p = spiele(partie('k7/8/8/8/8/8/8/K6R w - - 0 1'), [
    'h1h2', 'a8b8', 'h2h1', 'b8a8',
    'h1h2', 'a8b8', 'h2h1', 'b8a8',
  ]);
  assert.deepEqual(p.ende, { ausgang: 'wiederholung', sieger: null });
});

test('Nebel: zu wenig Material gibt es nie — Koenig gegen Koenig laeuft weiter', () => {
  const p = fuehreAus(partie('k7/8/8/8/8/8/8/K7 w - - 0 1'), WEISS, zug('a1', 'a2'));
  assert.equal(p.ende, null);
});

test('Nebel: Zeitablauf verliert immer, auch gegen einen nackten König', () => {
  const p = verbraucheZeit(
    erstellePartie({ modus: 'nebel', bedenkzeitMs: 60_000 }, 0, 'k7/8/8/8/8/8/8/K7 w - - 0 1'),
    SCHWARZ,
    60_000,
  );
  assert.deepEqual(p.ende, { ausgang: 'zeit', sieger: WEISS });
});

test('Nebel: Aufgeben geht', () => {
  const p = fuehreAus(partie(), SCHWARZ, { type: 'aufgeben' });
  assert.deepEqual(p.ende, { ausgang: 'aufgabe', sieger: WEISS });
});

// ---------------------------------------------------------------------------
// Sicht: Was ein Sitz sehen darf
// ---------------------------------------------------------------------------

test('Sicht: in der Grundstellung sieht jede Seite die eigenen Reihen und die Zugziele bis Reihe 4', () => {
  const p = partie();
  const weiss = sichtFuer(p, WEISS);
  assert.equal(weiss.nebel!.verborgen.length, 32);
  assert.ok(weiss.nebel!.verborgen.includes('a5') && weiss.nebel!.verborgen.includes('h8'));
  assert.ok(!weiss.nebel!.verborgen.includes('e4') && !weiss.nebel!.verborgen.includes('e3'));
  // Alle schwarzen Figuren sind verdeckt.
  assert.ok(weiss.brett.slice(48).every((f) => f === ''));
  const schwarz = sichtFuer(p, SCHWARZ);
  assert.equal(schwarz.nebel!.verborgen.length, 32);
  assert.ok(schwarz.nebel!.verborgen.includes('a4') && !schwarz.nebel!.verborgen.includes('a5'));
  assert.ok(schwarz.brett.slice(0, 16).every((f) => f === ''));
});

test('Sicht: ein blockierender Gegner wird gesehen, auch vor dem Bauern; Bauern sehen ihre Schlagfelder', () => {
  const p = partie('k7/8/8/4p3/4P3/8/8/K7 w - - 0 1');
  const sicht = sichtFuer(p, WEISS);
  assert.equal(sicht.brett[feldIndex('e5')], 'p', 'das Feld vor dem Bauern');
  const felder = sichtbareFelder(p.stellung.brett, 'w');
  assert.ok(felder.has(feldIndex('d5')) && felder.has(feldIndex('f5')), 'Schlagfelder, auch leer');
  assert.ok(!felder.has(feldIndex('e6')), 'dahinter ist wieder Nebel');
});

test('Sicht: Springer und Laeufer — das Ziel zaehlt, der Blocker auch, dahinter Nebel', () => {
  const p = partie('k7/8/8/8/8/2p5/8/B6K w - - 0 1');
  const felder = sichtbareFelder(p.stellung.brett, 'w');
  assert.ok(felder.has(feldIndex('b2')) && felder.has(feldIndex('c3')), 'bis zum Blocker');
  assert.ok(!felder.has(feldIndex('d4')), 'hinter dem Blocker');
});

test('Sicht: Nach dem Ende sieht jeder alles', () => {
  const p = fuehreAus(partie('K7/1k6/8/8/6r1/8/8/8 w - - 0 1'), WEISS, zug('a8', 'b7'));
  for (const sitz of [WEISS, SCHWARZ]) {
    const s = sichtFuer(p, sitz);
    assert.deepEqual(s.nebel, { verborgen: [] });
    assert.equal(s.brett[feldIndex('g4')], 'r');
  }
  assert.deepEqual(zuschauerSicht(p).brett, p.stellung.brett);
});

test('Leak: die Sicht aendert sich nicht, wenn nur Verborgenes anders ist (Grundstellung)', () => {
  // Schwarz vertauscht Springer und Laeufer — alles auf Reihe 8, fuer Weiss im Nebel.
  const a = partie('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const b = partie('rbnqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1');
  assert.deepEqual(sichtFuer(a, WEISS), sichtFuer(b, WEISS));
  // Und umgekehrt fuer Schwarz.
  const c = partie('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RBNQKBNR w kq - 0 1');
  assert.deepEqual(sichtFuer(a, SCHWARZ), sichtFuer(c, SCHWARZ));
});

test('Leak: ein Zug im Nebel — zwei verschiedene Gegnerzuege, gleiche Sicht von Weiss', () => {
  const start = spiele(partie(), ['e2e4']);
  const a = fuehreAus(start, SCHWARZ, zug('b8', 'c6'));
  const b = fuehreAus(start, SCHWARZ, zug('g8', 'h6'));
  const c = fuehreAus(start, SCHWARZ, zug('g8', 'f6'));
  const sa = sichtFuer(a, WEISS);
  assert.deepEqual(sa, sichtFuer(b, WEISS));
  assert.deepEqual(sa, sichtFuer(c, WEISS));
  assert.deepEqual(sa.verlauf, ['e4', '…'], 'der Zug im Nebel steht nicht in der Zugliste');
  assert.equal(sa.letzterZug, null);
  assert.equal(sa.fen.includes('n'), false, 'auch die FEN kennt keine schwarzen Figuren');
  assert.deepEqual(sa.geschlagen, { w: [], b: [] });
  // Schwarz dagegen sieht seinen eigenen Zug.
  // Schwarz sah Weisses e4 nicht (Reihe 4 ist fuer ihn Nebel), seinen eigenen Zug aber schon.
  assert.deepEqual(sichtFuer(a, SCHWARZ).verlauf, ['…', 'Nc6']);
});

test('Leak: ein Gegnerzug im Sichtfeld erscheint in der Zugliste', () => {
  const p = spiele(partie(), ['e2e4', 'd7d5']);
  const weiss = sichtFuer(p, WEISS);
  assert.equal(weiss.brett[feldIndex('d5')], 'p');
  assert.deepEqual(weiss.verlauf, ['e4', 'd5']);
  // Das Startfeld d7 ist Nebel: der Pfeil beginnt nicht im Nebel.
  assert.deepEqual(weiss.letzterZug, { von: 'd5', nach: 'd5' });
});

test('Leak: halbzugUhr, gegnerische Rochaderechte und Wiederholungen stehen nicht in der Sicht', () => {
  const p = spiele(partie(), ['g1f3', 'g8f6']);
  const weiss = sichtFuer(p, WEISS);
  assert.equal(weiss.fen.split(' ')[4], '0', 'Uhr in der FEN immer 0');
  assert.equal(weiss.fen.split(' ')[2], 'KQ', 'nur die eigenen Rechte');
  assert.equal(JSON.stringify(weiss).includes('wiederholung'), false);
});

test('Material: genommene Figuren sind oeffentlich und stehen in der Sicht beider', () => {
  // Weiss schlaegt einen Turm; der Vorsprung kommt aus dem Genommenen, nicht aus dem Brett.
  const p = fuehreAus(partie('k6r/8/8/8/8/8/8/K6R w - - 0 1'), WEISS, zug('h1', 'h8'));
  for (const sitz of [WEISS, SCHWARZ]) {
    const s = sichtFuer(p, sitz);
    assert.deepEqual(s.geschlagen, { w: [], b: ['r'] });
    assert.equal(s.vorsprung, 5);
  }
});

test('Zuschauer sehen waehrend der Partie nur, was beide Seiten sehen', () => {
  const p = spiele(partie(), ['e2e4', 'e7e5']);
  const z = zuschauerSicht(p);
  assert.equal(z.zuschauer, true);
  const gemeinsam = gemeinsameFelder(p.stellung.brett);
  for (let f = 0; f < 64; f += 1) {
    assert.equal(z.brett[f] !== '', gemeinsam.has(f) && p.stellung.brett[f] !== '', feldName(f));
  }
  // Der Bauer e4 und e5 stehen einander gegenueber und sind fuer beide sichtbar.
  assert.equal(z.brett[feldIndex('e4')], 'P');
  assert.equal(z.brett[feldIndex('e5')], 'p');
  // Weder Weiss' noch Schwarz' Grundreihe.
  assert.ok(z.nebel!.verborgen.includes('a1') && z.nebel!.verborgen.includes('a8') === true);
  // Ein Zug, den eine Seite nicht sah, bleibt fuer Zuschauer im Nebel.
  const q = fuehreAus(spiele(partie(), ['e2e4']), SCHWARZ, zug('b8', 'c6'));
  assert.deepEqual(zuschauerSicht(q).verlauf, ['…', '…']);
  // Gegenprobe: e4 und e5 stehen einander gegenueber, beide Seiten sehen sie — das sehen auch Zuschauer.
  assert.deepEqual(zuschauerSicht(p).verlauf, ['…', 'e5']);
});

// ---------------------------------------------------------------------------
// Die Zuege des Betrachters folgen aus seiner Sicht (Voraussetzung fuer den Bot)
// ---------------------------------------------------------------------------

/** Ein einfacher Zufallsgenerator, damit die Probe wiederholbar bleibt. */
function zufall(saat: number): () => number {
  let s = saat >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('Sicht: die Zuege auf dem verdeckten Brett sind genau legalActions (zufaellige Partien)', () => {
  let geprueft = 0;
  for (let saat = 0; saat < 12; saat += 1) {
    const wuerfel = zufall(saat + 7);
    let p = erstellePartie(NEBEL, saat);
    for (let h = 0; h < 120 && !p.ende; h += 1) {
      const sitz = amZug(p)!;
      const legal = erlaubteAktionen(p, sitz);
      const ausSicht = nebelZuege(ausFen(sichtFuer(p, sitz).fen)).map((z) => `${feldName(z.von)}${feldName(z.nach)}${z.umwandlung ?? ''}`);
      const echt = legal.flatMap((a) => (a.type === 'zug' ? [`${a.von}${a.nach}${a.umwandlung ?? ''}`] : []));
      assert.deepEqual([...ausSicht].sort(), [...echt].sort(), `Saat ${saat}, Halbzug ${h}`);
      geprueft += 1;
      // Zufaellig, mit Vorliebe fuer Schlaege, damit der Nebel sich oft lichtet.
      const zuege = legal.filter((a) => a.type === 'zug');
      const schlaege = zuege.filter((a) => a.type === 'zug' && p.stellung.brett[feldIndex(a.nach)] !== '');
      const pool = schlaege.length > 0 && wuerfel() < 0.5 ? schlaege : zuege;
      const wahl = pool[Math.floor(wuerfel() * pool.length)]!;
      p = fuehreAus(p, sitz, wahl);
    }
  }
  assert.ok(geprueft > 500);
});

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

test('Leak: das En-passant-Feld steht nur in der FEN, wenn ein eigener Bauer schlagen kann', () => {
  // Weisser Laeufer a3 sieht d6, hat aber keinen Bauern daneben. Schwarz zieht d7-d5 im Nebel.
  const doppelt = fuehreAus(partie('7k/3p4/8/8/8/B7/8/K7 b - - 0 1'), SCHWARZ, zug('d7', 'd5'));
  assert.ok(sichtbareFelder(doppelt.stellung.brett, 'w').has(feldIndex('d6')), 'Voraussetzung: Weiss sieht d6');
  const ohneDoppelschritt = partie('7k/8/8/3p4/8/B7/8/K7 w - - 0 1');
  const sicht = sichtFuer(doppelt, WEISS);
  assert.equal(sicht.fen.split(' ')[3], '-', 'kein ep-Feld ohne eigenen Bauern');
  // Die Zugnummer ist oeffentlich und darf abweichen; Figuren, Seite, Rochade und ep-Feld nicht.
  const feste = (fen: string): string => fen.split(' ').slice(0, 4).join(' ');
  assert.equal(feste(sicht.fen), feste(sichtFuer(ohneDoppelschritt, WEISS).fen), 'gleich der Sicht ohne Doppelschritt');
  assert.deepEqual(sicht.brett, sichtFuer(ohneDoppelschritt, WEISS).brett);
  assert.deepEqual(sicht.verlauf, ['…']);

  // Gegenprobe: mit weissem Bauern auf e5 ist der Schlag moeglich, also steht d6 in der FEN.
  const mitBauer = fuehreAus(partie('7k/3p4/8/4P3/8/B7/8/K7 b - - 0 1'), SCHWARZ, zug('d7', 'd5'));
  const s2 = sichtFuer(mitBauer, WEISS);
  assert.equal(s2.fen.split(' ')[3], 'd6');
  assert.ok(erlaubteAktionen(mitBauer, WEISS).some((a) => a.type === 'zug' && a.von === 'e5' && a.nach === 'd6'));
  // Der Bot sieht den Schlag ebenfalls und spielt einen Zug aus der Liste.
  for (const stufe of ['anfaenger', 'standard', 'experte', 'genie'] as BotLevel[]) {
    const a = botZug(s2, stufe);
    assert.ok(
      erlaubteAktionen(mitBauer, WEISS).some((l) => l.type === 'zug' && l.von === (a as { von: string }).von && l.nach === (a as { nach: string }).nach),
      `Bot ${stufe}: legaler Zug`,
    );
  }
});

test('Bot: nimmt den König, wenn er ihn sieht', () => {
  const p = partie('K7/1k6/8/8/8/8/8/8 w - - 0 1');
  for (const stufe of ['anfaenger', 'standard', 'experte', 'genie'] as BotLevel[]) {
    const a = botZug(sichtFuer(p, WEISS), stufe);
    assert.deepEqual(a, { type: 'zug', von: 'a8', nach: 'b7' }, stufe);
  }
});

test('Bot: laesst seinen König nicht stehen, wenn er ihn sichtbar retten kann', () => {
  // Der schwarze Turm a1 greift e1 an; Weiss kann den Turm schlagen (Kxd1 geht nicht, aber Kd2/Kf2 entkommt).
  const p = partie('k7/8/8/8/8/8/8/r3K3 w - - 0 1');
  const danach = fuehreAus(p, WEISS, botZug(sichtFuer(p, WEISS), 'standard'));
  assert.equal(danach.ende, null, 'der Bot hat seinen König nicht eingestellt');
});

test('Bot: jeder Zug ist ein Zug aus legalActions (alle Stufen, mehrere Partien)', () => {
  const stufen: BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];
  for (let i = 0; i < 8; i += 1) {
    let p = brochess.createParty({ config: NEBEL, seats: 2, rounds: 1, seed: i });
    const stufe = [stufen[i % 4]!, stufen[(i + 1) % 4]!];
    for (let h = 0; h < 80 && !brochess.isFinished(p); h += 1) {
      const sitz = brochess.currentActor(p)!;
      const aktion = brochess.botAction(brochess.viewFor(p, sitz), stufe[sitz]!);
      p = brochess.act(p, sitz, aktion);
    }
  }
});

test('Bot: auf der Zuschauersicht verweigert er', () => {
  assert.throws(() => brochess.botAction(zuschauerSicht(partie()), 'standard'));
});

// ---------------------------------------------------------------------------
// Andere Modi bleiben unberuehrt
// ---------------------------------------------------------------------------

test('Normales Schach: die Sicht hat keinen Nebel und zeigt das ganze Brett', () => {
  const p = erstellePartie({}, 0);
  const s = sichtFuer(p, WEISS);
  assert.equal(s.nebel, null);
  assert.deepEqual(s.brett, p.stellung.brett);
});

test('Snapshot: eine Nebelpartie ueberlebt Speichern und Laden', () => {
  const p = spiele(partie(), ['e2e4', 'b8c6']);
  const geladen = brochess.deserialize(JSON.parse(JSON.stringify(brochess.serialize(p))));
  assert.deepEqual(sichtFuer(geladen, WEISS), sichtFuer(p, WEISS));
  assert.deepEqual(sichtFuer(geladen, SCHWARZ), sichtFuer(p, SCHWARZ));
});

// ---------------------------------------------------------------------------
// Zugliste: die Kurzschrift darf nichts verraten, was die Sicht verbirgt
// ---------------------------------------------------------------------------

test('Nebel: Bauernschlag im Nebel nennt dem Gegner die Ausgangslinie nicht', () => {
  // Weiss e6xd7: Schwarz sieht d7 (Koenig e8), aber nicht e6 (Startfeld).
  const p = spiele(partie('r3k3/3p4/4P3/8/8/8/8/4K3 w - - 0 1'), ['e6d7']);
  const schwarz = sichtFuer(p, SCHWARZ);
  assert.ok(schwarz.nebel!.verborgen.includes('e6'), 'Voraussetzung: das Startfeld liegt fuer Schwarz im Nebel');
  assert.deepEqual(schwarz.verlauf, ['xd7'], 'keine Linie e vor dem x');
  assert.equal(schwarz.letzterZug!.von, 'd7', 'der Pfeil verbirgt das Startfeld ebenfalls');
  assert.deepEqual(sichtFuer(p, WEISS).verlauf, ['exd7'], 'der Ziehende sieht die volle Schreibweise');
  assert.ok(!JSON.stringify(schwarz).includes('exd7'), 'nirgends in der Sicht des Gegners');
});

test('Nebel: Rochade, deren Turm im Nebel liegt, erscheint dem Gegner nur als Koenigszug', () => {
  // Schwarz sieht nur g1 (Laeufer a7), nicht f1 und h1.
  const p = spiele(partie('4k3/b7/8/8/8/8/8/4K2R w K - 0 1'), ['e1g1']);
  const schwarz = sichtFuer(p, SCHWARZ);
  assert.ok(schwarz.nebel!.verborgen.includes('f1') && !schwarz.nebel!.verborgen.includes('g1'));
  assert.deepEqual(schwarz.verlauf, ['Kg1'], 'kein O-O');
  assert.deepEqual(sichtFuer(p, WEISS).verlauf, ['O-O']);
  assert.ok(!JSON.stringify(schwarz).includes('O-O'));
});

test('Nebel: sieht der Gegner Start- und Zielfeld, steht die volle Schreibweise in der Zugliste', () => {
  const p = spiele(partie('r3k3/3p4/4P3/8/8/8/8/4K3 w - - 0 1'), ['e6d7']);
  // Die Zuschauer sehen nur die Schnittmenge beider Sichten: e6 sieht Schwarz nicht.
  assert.deepEqual(zuschauerSicht(p).verlauf, ['xd7']);
  const q = spiele(partie('4k3/8/5n2/3p4/4P3/8/8/4K3 w - - 0 1'), ['e4d5']);
  assert.deepEqual(sichtFuer(q, SCHWARZ).verlauf, ['exd5']);
});
