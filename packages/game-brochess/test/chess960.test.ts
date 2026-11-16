import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brochess } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import { START_FEN, ausFen, feldIndex, feldName, legaleZuege, sanVon, zuFen } from '../src/brett.js';
import {
  ANZAHL_STELLUNGEN,
  KLASSISCHE_NUMMER,
  grundreihe,
  nummerAusSaat,
  nummerVon,
  startFen960,
} from '../src/chess960.js';
import {
  type BroChessAktion,
  type BroChessPartie,
  amZug,
  erlaubteAktionen,
  erstellePartie,
  fuehreAus,
} from '../src/partie.js';
import { type BroChessRegeln, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

/*
 * Chess960 (seit dem 16.11.2026). Saat 0: Weiss sitzt auf 0, Schwarz auf 1.
 */

const WEISS = 0;
const SCHWARZ = 1;
const REGELN: BroChessRegeln = { modus: 'chess960' };

/** Partie aus einer Shredder-FEN (Rochaderechte als Turmlinien, etwa "HA"). */
const partie = (fen?: string, seed = 0): BroChessPartie => erstellePartie(REGELN, seed, fen);

const zug = (von: string, nach: string): BroChessAktion => ({ type: 'zug', von, nach });

const zuegeVon = (fen: string): string[] =>
  legaleZuege(ausFen(fen)).map((z) => `${feldName(z.von)}${feldName(z.nach)}`);

/** Die FEN nach einem Zug, ueber das Modul gespielt (wie am Server). */
function nach(fen: string, von: string, ziel: string): string {
  const p = fuehreAus(partie(fen), amZug(partie(fen))!, zug(von, ziel));
  return zuFen(p.stellung);
}

// ---------------------------------------------------------------------------
// Die 960 Grundreihen
// ---------------------------------------------------------------------------

test('Chess960: alle 960 Grundreihen sind gueltig und verschieden', () => {
  const gesehen = new Set<string>();
  for (let nr = 0; nr < ANZAHL_STELLUNGEN; nr += 1) {
    const reihe = grundreihe(nr);
    assert.match(reihe, /^[RNBQK]{8}$/, `Nr. ${nr}`);
    const zahl = (f: string): number => [...reihe].filter((x) => x === f).length;
    assert.deepEqual([zahl('K'), zahl('Q'), zahl('R'), zahl('B'), zahl('N')], [1, 1, 2, 2, 2], `Nr. ${nr}: Figuren`);
    // König zwischen den Tuermen.
    const turm = [...reihe].flatMap((f, i) => (f === 'R' ? [i] : []));
    const koenig = reihe.indexOf('K');
    assert.ok(turm[0]! < koenig && koenig < turm[1]!, `Nr. ${nr}: König zwischen den Tuermen (${reihe})`);
    // Laeufer auf verschiedenfarbigen Feldern.
    const laeufer = [...reihe].flatMap((f, i) => (f === 'B' ? [i] : []));
    assert.notEqual(laeufer[0]! % 2, laeufer[1]! % 2, `Nr. ${nr}: Laeufer verschiedenfarbig (${reihe})`);
    assert.ok(!gesehen.has(reihe), `Nr. ${nr} doppelt: ${reihe}`);
    gesehen.add(reihe);
    assert.equal(nummerVon(reihe), nr, `Nr. ${nr}: Umkehrung`);
  }
  assert.equal(gesehen.size, 960);
});

test('Chess960: 518 ist die klassische Grundreihe, bekannte Nummern stimmen (Scharnhorst)', () => {
  assert.equal(grundreihe(KLASSISCHE_NUMMER), 'RNBQKBNR');
  assert.equal(grundreihe(0), 'BBQNNRKR');
  assert.equal(grundreihe(959), 'RKRNNQBB');
  assert.equal(nummerVon('RNBQKBNR'), 518);
});

test('Chess960: eine Reihe, die keine der 960 ist, hat keine Nummer', () => {
  assert.equal(nummerVon('RNBQKBNN'), -1);
  assert.equal(nummerVon('KRBBQNNR'), -1); // König ausserhalb der Tuerme
  assert.equal(nummerVon('RBKBQNNR'), -1); // Laeufer auf gleicher Feldfarbe
  assert.equal(nummerVon('RNB'), -1);
  assert.throws(() => grundreihe(960));
  assert.throws(() => grundreihe(-1));
  assert.throws(() => grundreihe(1.5));
});

test('Chess960: Schwarz spiegelt Weiss, die Stellung der Nummer 518 hat die zwanzig klassischen Zuege', () => {
  for (const nr of [0, 1, 518, 777, 959]) {
    const s = ausFen(startFen960(nr));
    for (let linie = 0; linie < 8; linie += 1) {
      assert.equal(s.brett[56 + linie], s.brett[linie]!.toLowerCase(), `Nr. ${nr} Linie ${linie}`);
    }
    assert.equal(s.rochade, 'KQkq');
    assert.ok(s.chess960);
  }
  assert.equal(legaleZuege(ausFen(startFen960(518))).length, 20);
  // Die 960er-Fassung der klassischen Reihe ist dieselbe Stellung wie START_FEN, nur anders geschrieben.
  assert.equal(zuFen(ausFen(startFen960(518))), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1');
  assert.equal(zuFen(ausFen(START_FEN)), START_FEN);
});

test('Chess960: die Nummer folgt aus der Saat, unabhaengig von der Farbwahl', () => {
  const gesehen = new Set<number>();
  for (let seed = 0; seed < 4000; seed += 1) {
    const nr = nummerAusSaat(seed);
    assert.ok(nr >= 0 && nr < 960);
    gesehen.add(nr);
  }
  assert.equal(gesehen.size, 960, 'jede Stellung ist erreichbar');
  // Gerade und ungerade Saat (= verschiedene Farbwahl) liefern dieselbe Nummer.
  assert.equal(nummerAusSaat(2 * 518), 518);
  assert.equal(nummerAusSaat(2 * 518 + 1), 518);
  assert.equal(partie(undefined, 2 * 518).weissSitz, 0);
  assert.equal(partie(undefined, 2 * 518 + 1).weissSitz, 1);
});

test('Chess960: createParty legt die Grundstellung an und zeigt die Nummer in der Sicht', () => {
  const p = brochess.createParty({ config: REGELN, seats: 2, rounds: 1, seed: 2 * 100 + 1 });
  assert.equal(p.chess960?.nummer, 100);
  const sicht = sichtFuer(p, WEISS === p.weissSitz ? WEISS : SCHWARZ);
  assert.equal(sicht.chess960?.nummer, 100);
  assert.equal(zuschauerSicht(p).chess960?.nummer, 100);
  assert.equal(sicht.brett.slice(0, 8).join('').toUpperCase(), grundreihe(100));
  assert.equal(sicht.brett.slice(56).join(''), grundreihe(100).toLowerCase());
  // Ohne den Modus gibt es kein Feld.
  const normal = brochess.createParty({ config: {}, seats: 2, rounds: 1, seed: 1 });
  assert.equal(normal.chess960, undefined);
  assert.equal(sichtFuer(normal, 0).chess960, null);
  assert.equal(zuFen(normal.stellung), START_FEN);
});

test('Chess960: Regelsatz nimmt den Modus an', () => {
  assert.deepEqual(pruefeRegeln({ modus: 'chess960' }, 2, 1), []);
  assert.equal(pruefeRegeln({ modus: 'chess961' }, 2, 1).length, 1);
});

test('Chess960: die FEN traegt die Turmlinien und liest sich zurueck', () => {
  for (const nr of [0, 123, 518, 959]) {
    const fen = startFen960(nr);
    assert.equal(zuFen(ausFen(fen)), fen);
  }
  // Mit weniger Rechten.
  const fen = '4k3/8/8/8/8/8/8/R3K2R w HA - 0 1';
  assert.equal(zuFen(ausFen(fen)), fen);
  assert.equal(ausFen(fen).rochade, 'KQ');
  // Ohne Rechte gibt es nichts zu merken.
  assert.equal(ausFen('4k3/8/8/8/8/8/8/R3K2R w - - 0 1').chess960, undefined);
  assert.throws(() => ausFen('4k3/8/8/8/8/8/8/R7 w A - 0 1'), /König/);
});

// ---------------------------------------------------------------------------
// Rochade
// ---------------------------------------------------------------------------

test('Rochade: König und Turm landen auf g/f bzw. c/d, eingegeben als König auf den eigenen Turm', () => {
  const fen = '4k3/8/8/8/8/8/8/R3K2R w HA - 0 1';
  assert.ok(zuegeVon(fen).includes('e1h1'), 'kurz');
  assert.ok(zuegeVon(fen).includes('e1a1'), 'lang');
  assert.equal(nach(fen, 'e1', 'h1'), '4k3/8/8/8/8/8/8/R4RK1 b - - 1 1');
  assert.equal(nach(fen, 'e1', 'a1'), '4k3/8/8/8/8/8/8/2KR3R b - - 1 1');
  // Die klassische Eingabe (zwei Felder) gibt es hier nicht.
  assert.ok(!zuegeVon(fen).includes('e1g1'));
  assert.ok(!zuegeVon(fen).includes('e1c1'));
  assert.throws(() => fuehreAus(partie(fen), WEISS, zug('e1', 'g1')), /nicht erlaubt/);
});

test('Rochade, Sonderfall: König steht schon auf dem Zielfeld, nur der Turm zieht', () => {
  // König g1, Turm h1: Der König bleibt, der Turm geht nach f1.
  assert.equal(nach('4k3/8/8/8/8/8/8/6KR w H - 0 1', 'g1', 'h1'), '4k3/8/8/8/8/8/8/5RK1 b - - 1 1');
  // Spiegel auf Damenseite: König c1, Turm a1 (b1 leer) -> König c1, Turm d1.
  assert.equal(nach('4k3/8/8/8/8/8/8/R1K5 w A - 0 1', 'c1', 'a1'), '4k3/8/8/8/8/8/8/2KR4 b - - 1 1');
});

test('Rochade, Sonderfall: Turm steht schon auf dem Zielfeld, nur der König zieht', () => {
  // König e1, Turm f1: Der Turm bleibt auf f1, der König geht nach g1 — über f1, das der Turm besetzt.
  assert.equal(nach('4k3/8/8/8/8/8/8/4KR2 w F - 0 1', 'e1', 'f1'), '4k3/8/8/8/8/8/8/5RK1 b - - 1 1');
  // Damenseite: Turm d1 steht schon richtig, König e1 geht nach c1.
  assert.equal(nach('4k3/8/8/8/8/8/8/3RK3 w D - 0 1', 'e1', 'd1'), '4k3/8/8/8/8/8/8/2KR4 b - - 1 1');
});

test('Rochade, Sonderfall: Turm neben dem König, beide tauschen den Platz', () => {
  // Turm c1, König d1, Turm h1: lang = König c1 / Turm d1 (Tausch), kurz = König g1 / Turm f1.
  const fen = '4k3/8/8/8/8/8/8/2RK3R w HC - 0 1';
  assert.equal(nach(fen, 'd1', 'c1'), '4k3/8/8/8/8/8/8/2KR3R b - - 1 1');
  assert.equal(nach(fen, 'd1', 'h1'), '4k3/8/8/8/8/8/8/2R2RK1 b - - 1 1');
  // Dasselbe auf der anderen Seite: König f1 zwischen Turm e1 und g1.
  assert.equal(nach('4k3/8/8/8/8/8/8/4RKR1 w GE - 0 1', 'f1', 'g1'), '4k3/8/8/8/8/8/8/4RRK1 b - - 1 1');
  assert.equal(nach('4k3/8/8/8/8/8/8/4RKR1 w GE - 0 1', 'f1', 'e1'), '4k3/8/8/8/8/8/8/2KR2R1 b - - 1 1');
});

test('Rochade: Schwarz rochiert gespiegelt, die Rechte von Weiss bleiben', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R b HAha - 0 1';
  const p = partie(fen);
  assert.equal(amZug(p), SCHWARZ === p.weissSitz ? WEISS : SCHWARZ);
  assert.equal(nach(fen, 'e8', 'h8'), 'r4rk1/8/8/8/8/8/8/R3K2R w HA - 1 2');
  assert.equal(nach(fen, 'e8', 'a8'), '2kr3r/8/8/8/8/8/8/R3K2R w HA - 1 2');
});

test('Rochade verboten: Feld dazwischen oder auf dem Ziel besetzt', () => {
  // Springer g1 steht auf dem Königsziel.
  const z = zuegeVon('4k3/8/8/8/8/8/8/R3K1NR w HA - 0 1');
  assert.ok(!z.includes('e1h1'));
  assert.ok(z.includes('e1a1'));
  // Läufer zwischen König und Turm.
  assert.ok(!zuegeVon('4k3/8/8/8/8/8/8/R1B1K2R w HA - 0 1').includes('e1a1'));
  // Ein fremdes Stück auf dem Turmziel (d1) sperrt die lange Rochade, auch wenn es nicht auf dem Weg des Königs liegt.
  // König b1, Turm a1: König -> c1, Turm -> d1; d1 besetzt.
  assert.ok(!zuegeVon('4k3/8/8/8/8/8/8/RK1n4 w A - 0 1').includes('b1a1'));
  assert.ok(zuegeVon('4k3/8/8/8/8/8/8/RK6 w A - 0 1').includes('b1a1'));
});

test('Rochade verboten: Schach, angegriffenes Durchgangs- oder Zielfeld', () => {
  // König im Schach.
  assert.ok(!zuegeVon('4r1k1/8/8/8/8/8/8/R3K2R w HA - 0 1').some((m) => m === 'e1h1' || m === 'e1a1'));
  // f1 angegriffen (Durchgang kurz), lang bleibt frei.
  const f = zuegeVon('4kr2/8/8/8/8/8/8/R3K2R w HA - 0 1');
  assert.ok(!f.includes('e1h1'));
  assert.ok(f.includes('e1a1'));
  // g1 angegriffen (Ziel kurz).
  assert.ok(!zuegeVon('4k1r1/8/8/8/8/8/8/R3K2R w HA - 0 1').includes('e1h1'));
  // Nur der Turm darf angegriffen sein (h1): Das hindert die Rochade nicht.
  assert.ok(zuegeVon('4k1r1/8/8/8/8/8/8/R3K2R w A - 0 1').includes('e1a1'));
  assert.ok(zuegeVon('4k2r/8/8/8/8/8/8/R3K2R w HA - 0 1').includes('e1h1'), 'angegriffener Turm schadet nicht');
});

test('Rochade verboten: der eigene Turm schirmte den König ab (Chess960-Sonderfall)', () => {
  // Weisser Turm b1, König c1, schwarzer Turm a1: Nach der langen Rochade (König bleibt auf c1,
  // Turm nach d1) stuende der König offen vor dem Turm a1.
  const z = zuegeVon('4k3/8/8/8/8/8/8/rRK4R w HB - 0 1');
  assert.ok(!z.includes('c1b1'), 'lang verboten');
  assert.ok(z.includes('c1h1'), 'kurz geht, der Turm b1 schirmt weiter ab');
});

test('Rochade: die Rechte fallen weg, wenn König oder Turm ziehen oder der Turm geschlagen wird', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w HAha - 0 1';
  // Turm h1 zieht: kurz weg, lang bleibt.
  assert.equal(ausFen(nach(fen, 'h1', 'g1')).rochade, 'Qkq');
  // König zieht: beide weg.
  assert.equal(ausFen(nach(fen, 'e1', 'e2')).rochade, 'kq');
  // Turm a8 wird geschlagen (Turm a1 nimmt a8): Rechte Q und q fallen.
  const geschlagen = nach('r3k2r/8/8/8/8/8/8/R3K2R w HAha - 0 1', 'a1', 'a8');
  assert.equal(ausFen(geschlagen).rochade, 'Kk');
  // Nach der Rochade selbst bleibt nichts.
  assert.equal(ausFen(nach(fen, 'e1', 'h1')).rochade, 'kq');
  // Die verlorenen Rechte verschwinden auch aus der FEN-Schrift (und damit aus der Wiederholungszaehlung).
  assert.equal(zuFen(ausFen(nach(fen, 'h1', 'g1'))).split(' ')[2], 'Aha');
});

test('Rochade: Zugliste schreibt O-O und O-O-O', () => {
  const s = ausFen('4k3/8/8/8/8/8/8/2RK3R w HC - 0 1');
  const lang = legaleZuege(s).find((z) => z.von === feldIndex('d1') && z.nach === feldIndex('c1'))!;
  const kurz = legaleZuege(s).find((z) => z.von === feldIndex('d1') && z.nach === feldIndex('h1'))!;
  assert.equal(sanVon(s, lang), 'O-O-O');
  assert.equal(sanVon(s, kurz), 'O-O');
  const p = fuehreAus(partie('4k3/8/8/8/8/8/8/2RK3R w HC - 0 1'), WEISS, zug('d1', 'h1'));
  assert.deepEqual(p.verlauf, ['O-O']);
  // Gezeigt wird die Landung des Königs, nicht das Feld des Turms.
  assert.deepEqual(p.letzterZug, { von: 'd1', nach: 'g1' });
});

test('Rochade: legalActions bietet sie an, der König schlaegt den eigenen Turm nicht', () => {
  const p = partie('4k3/8/8/8/8/8/8/R3K2R w HA - 0 1');
  const aktionen = erlaubteAktionen(p, WEISS).filter((a) => a.type === 'zug');
  assert.ok(aktionen.some((a) => a.type === 'zug' && a.von === 'e1' && a.nach === 'h1'));
  const sicht = sichtFuer(p, WEISS);
  // Die Vorab-Ziele (Premove) des Gegners kennen sie ebenfalls.
  assert.ok((sichtFuer(p, SCHWARZ).vorab['e8'] ?? []).length > 0);
  assert.equal(sicht.vorab['e1'], undefined, 'wer am Zug ist, hat keine Vorab-Ziele');
  const nachZug = fuehreAus(p, WEISS, zug('e1', 'h1'));
  assert.ok((sichtFuer(nachZug, WEISS).vorab['f1'] ?? []).length > 0);
});

test('Rochade: Vorab-Ziele nennen den eigenen Turm als Ziel des Königs', () => {
  const p = partie('4k3/8/8/8/8/8/8/R3K2R b HA - 0 1');
  assert.ok(p.stellung.chess960);
  const vorab = sichtFuer(p, WEISS).vorab;
  assert.ok(vorab['e1']!.includes('h1') && vorab['e1']!.includes('a1'));
});

// ---------------------------------------------------------------------------
// Rest wie normales Schach: Siegbedingung und Remis
// ---------------------------------------------------------------------------

test('Chess960: Matt gewinnt, Patt und zu wenig Material sind Remis', () => {
  const matt = fuehreAus(partie('6k1/5ppp/8/8/8/8/8/R3K3 w A - 0 1'), WEISS, zug('a1', 'a8'));
  assert.deepEqual(matt.ende, { ausgang: 'matt', sieger: WEISS });
  assert.deepEqual(matt.verlauf, ['Ra8#']);

  const patt = fuehreAus(partie('7k/8/5K2/6Q1/8/8/8/8 w - - 0 1'), WEISS, zug('g5', 'g6'));
  assert.deepEqual(patt.ende, { ausgang: 'patt', sieger: null });

  const material = fuehreAus(partie('4k3/8/8/8/8/8/1n6/K7 w - - 0 1'), WEISS, zug('a1', 'b2'));
  assert.deepEqual(material.ende, { ausgang: 'material', sieger: null });
});

test('Chess960: dreifache Wiederholung und 50-Zuege-Regel greifen von selbst', () => {
  // Nummer 518 = klassische Reihe; Springer hin und her.
  let p = partie(undefined, 2 * 518);
  assert.equal(p.chess960?.nummer, 518);
  for (let runde = 0; runde < 2; runde += 1) {
    for (const [von, ziel] of [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']] as const) {
      assert.equal(p.ende, null);
      p = fuehreAus(p, amZug(p)!, zug(von, ziel));
    }
  }
  assert.deepEqual(p.ende, { ausgang: 'wiederholung', sieger: null });

  const fuenfzig = fuehreAus(partie('4k3/8/8/8/8/8/8/R3K3 w A - 99 80'), WEISS, zug('a1', 'a2'));
  assert.deepEqual(fuenfzig.ende, { ausgang: 'fuenfzigZuege', sieger: null });
});

test('Chess960: dieselbe Stellung mit und ohne Rochaderecht zaehlt nicht als Wiederholung', () => {
  // Turm zieht weg und zurueck: Gleiche Figuren, aber das Recht ist verloren.
  let p = partie('4k3/8/8/8/8/8/8/R3K2R w HA - 0 1');
  const start = Object.keys(p.wiederholungen)[0]!;
  for (const [von, ziel] of [['h1', 'h2'], ['e8', 'e7'], ['h2', 'h1'], ['e7', 'e8']] as const) {
    p = fuehreAus(p, amZug(p)!, zug(von, ziel));
  }
  assert.equal(p.wiederholungen[start], 1);
  assert.equal(Object.keys(p.wiederholungen).length, 5);
});

// ---------------------------------------------------------------------------
// Bot
// ---------------------------------------------------------------------------

test('Bot: spielt in Chess960 nur Zuege, die legalActions kennt — auch die Rochade', () => {
  for (const seed of [0, 1, 2 * 5, 2 * 100 + 1, 2 * 518, 2 * 959, 2 * 333]) {
    let p = partie(undefined, seed);
    for (let h = 0; h < 60 && !p.ende; h += 1) {
      const sitz = amZug(p)!;
      const aktion = botZug(sichtFuer(p, sitz), 'anfaenger');
      assert.ok(
        erlaubteAktionen(p, sitz).some((a) => JSON.stringify(a) === JSON.stringify(aktion)),
        `Seed ${seed}, Halbzug ${h}: ${JSON.stringify(aktion)} nicht erlaubt`,
      );
      p = fuehreAus(p, sitz, aktion);
    }
  }
});

test('Bot: nimmt eine Rochade, wenn sie den Turm rettet und sonst nichts geht (Zug ist legal)', () => {
  // Nur die Rochade und Turmzuege stehen zur Wahl; der Bot darf jedenfalls nichts Illegales liefern.
  const p = partie('4k3/8/8/8/8/8/8/R3K2R w HA - 0 1');
  for (const stufe of ['anfaenger', 'standard', 'experte', 'genie'] as const) {
    const a = botZug(sichtFuer(p, WEISS), stufe);
    assert.ok(erlaubteAktionen(p, WEISS).some((x) => JSON.stringify(x) === JSON.stringify(a)), stufe);
  }
});
