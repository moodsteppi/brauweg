import { test } from 'node:test';
import assert from 'node:assert/strict';

import { brochess } from '../src/adapter.js';
import {
  type BroChessAktion,
  type BroChessPartie,
  amZug,
  erlaubteAktionen,
  erstellePartie,
  fuehreAus,
} from '../src/partie.js';
import { type BroChessRegeln, DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

/*
 * Secret Dame (seit dem 02.11.2026). Saat 0: Weiss sitzt auf 0, Schwarz auf 1.
 */

const WEISS = 0;
const SCHWARZ = 1;

function partie(regel: 'A' | 'B' = 'A', fen?: string): BroChessPartie {
  const regeln: BroChessRegeln = { modus: 'secretDame', schachDurchVerdeckte: regel };
  return erstellePartie(regeln, 0, fen);
}

const wahl = (feld: string): BroChessAktion => ({ type: 'wahl', feld });
const zug = (von: string, nach: string, umwandlung?: 'q' | 'r' | 'b' | 'n'): BroChessAktion => ({
  type: 'zug',
  von,
  nach,
  ...(umwandlung ? { umwandlung } : {}),
});

/** Partie, in der beide schon gewaehlt haben. */
function gewaehlt(weiss: string, schwarz: string, regel: 'A' | 'B' = 'A', fen?: string): BroChessPartie {
  return fuehreAus(fuehreAus(partie(regel, fen), WEISS, wahl(weiss)), SCHWARZ, wahl(schwarz));
}

const hat = (p: BroChessPartie, sitz: number, von: string, nach: string): boolean =>
  erlaubteAktionen(p, sitz).some((a) => a.type === 'zug' && a.von === von && a.nach === nach);

// ---------------------------------------------------------------------------
// Regelsatz
// ---------------------------------------------------------------------------

test('Regelsatz: modus und schachDurchVerdeckte werden geprueft, die Vorgabe bleibt normal', () => {
  assert.deepEqual(pruefeRegeln({ modus: 'secretDame', schachDurchVerdeckte: 'B' }, 2, 1), []);
  assert.deepEqual(pruefeRegeln({ modus: 'normal' }, 2, 1), []);
  assert.deepEqual(
    pruefeRegeln({ modus: 'blitzDame' }, 2, 1).map((p) => p.path),
    ['modus'],
  );
  assert.deepEqual(
    pruefeRegeln({ modus: 'secretDame', schachDurchVerdeckte: 'C' }, 2, 1).map((p) => p.path),
    ['schachDurchVerdeckte'],
  );
  const normal = erstellePartie(DEFAULT_REGELN, 0);
  assert.equal(normal.secretDame, undefined);
  assert.equal(sichtFuer(normal, WEISS).secretDame, null);
  assert.throws(() => fuehreAus(normal, WEISS, wahl('b1')), /Unbekannte Aktion/);
});

// ---------------------------------------------------------------------------
// Wahl
// ---------------------------------------------------------------------------

test('Wahl: beide gleichzeitig, jede eigene Figur ausser dem König, erst danach wird gezogen', () => {
  const p = partie();
  assert.equal(amZug(p), WEISS);
  const weiss = erlaubteAktionen(p, WEISS);
  const schwarz = erlaubteAktionen(p, SCHWARZ);
  assert.equal(weiss.length, 15);
  assert.equal(schwarz.length, 15);
  assert.ok(weiss.every((a) => a.type === 'wahl'));
  assert.ok(!weiss.some((a) => a.type === 'wahl' && a.feld === 'e1'), 'der König ist nicht waehlbar');

  assert.throws(() => fuehreAus(p, WEISS, zug('e2', 'e4')), /Erst waehlen/);
  assert.throws(() => fuehreAus(p, WEISS, wahl('e1')), /nicht waehlbar/);
  assert.throws(() => fuehreAus(p, WEISS, wahl('b8')), /nicht waehlbar/);
  assert.throws(() => fuehreAus(p, WEISS, wahl('e4')), /nicht waehlbar/);

  // Schwarz darf zuerst waehlen, obwohl currentActor Weiss nennt.
  const nachSchwarz = fuehreAus(p, SCHWARZ, wahl('g8'));
  assert.equal(amZug(nachSchwarz), WEISS);
  assert.deepEqual(erlaubteAktionen(nachSchwarz, SCHWARZ), []);
  assert.throws(() => fuehreAus(nachSchwarz, SCHWARZ, wahl('b8')), /Schon gewaehlt/);
  assert.throws(() => fuehreAus(nachSchwarz, WEISS, zug('e2', 'e4')), /Erst waehlen/);

  const fertig = fuehreAus(nachSchwarz, WEISS, wahl('b1'));
  assert.equal(amZug(fertig), WEISS);
  assert.equal(erlaubteAktionen(fertig, WEISS).length, 20, 'in der Grundstellung hat die geheime Dame keinen Damenzug');
  assert.ok(erlaubteAktionen(fertig, WEISS).every((a) => a.type === 'zug'));
  assert.deepEqual(fertig.secretDame!.w, { zustand: 'verdeckt', feld: 1, grundfigur: 'n', bekannt: false });
});

// ---------------------------------------------------------------------------
// Damenzuege
// ---------------------------------------------------------------------------

test('Damenzug: jede Grundfigur darf zusaetzlich wie eine Dame ziehen — nur die gewaehlte', () => {
  // Weisse Figur auf d4, ein zweiter weisser Springer auf h1 als Vergleich.
  const faelle: [string, string, string][] = [
    ['N', 'd4', 'd7'], // Springer geradeaus
    ['B', 'd4', 'd7'], // Laeufer geradeaus
    ['R', 'd4', 'g7'], // Turm schraeg
    ['P', 'd4', 'd6'], // Bauer zwei Felder ausserhalb der Grundreihe
    ['P', 'd4', 'd2'], // Bauer rueckwaerts
  ];
  for (const [figur, von, nach] of faelle) {
    const fen = `4k3/p7/8/8/3${figur}4/8/8/4K2N w - - 0 1`;
    const mit = gewaehlt(von, 'a7', 'A', fen);
    assert.ok(hat(mit, WEISS, von, nach), `${figur} ${von}-${nach} als geheime Dame`);
    const ohne = gewaehlt('h1', 'a7', 'A', fen);
    assert.ok(!hat(ohne, WEISS, von, nach), `${figur} ${von}-${nach} ohne Wahl`);
    assert.ok(!hat(mit, WEISS, 'h1', 'h5'), 'der andere Springer bleibt ein Springer');
  }
});

test('Damenzug: eine gewaehlte Dame bekommt nichts dazu', () => {
  const fen = '4k3/p7/8/8/3Q4/8/8/4K3 w - - 0 1';
  const mit = gewaehlt('d4', 'a7', 'A', fen);
  const normal = erstellePartie(DEFAULT_REGELN, 0, fen);
  assert.equal(erlaubteAktionen(mit, WEISS).length, brochess.legalActions(normal, WEISS).length);
});

// ---------------------------------------------------------------------------
// Aufdecken und Schlagen
// ---------------------------------------------------------------------------

test('Aufdecken: ein Zug der Grundfigur verraet nichts, ein Damenzug deckt auf', () => {
  const fen = '4k3/p7/8/8/3N4/8/8/4K3 w - - 0 1';
  let p = gewaehlt('d4', 'a7', 'A', fen);
  p = fuehreAus(p, WEISS, zug('d4', 'f5')); // Springerzug
  assert.equal(p.secretDame!.w.zustand, 'verdeckt');
  assert.equal(p.secretDame!.w.feld, 37);
  assert.deepEqual(p.secretDame!.ereignisse, []);
  assert.equal(sichtFuer(p, SCHWARZ).secretDame!.bekannt.w, null);

  p = fuehreAus(p, SCHWARZ, zug('a7', 'a6'));
  p = fuehreAus(p, WEISS, zug('f5', 'f1')); // Damenzug
  assert.equal(p.secretDame!.w.zustand, 'aufgedeckt');
  assert.deepEqual(p.secretDame!.ereignisse, [
    { art: 'aufgedeckt', farbe: 'w', feld: 'f1', grundfigur: 'n', halbzug: 3 },
  ]);
  assert.equal(p.verlauf.at(-1), 'Nf5-f1');
  const gegner = sichtFuer(p, SCHWARZ).secretDame!;
  assert.deepEqual(gegner.bekannt.w, { zustand: 'aufgedeckt', feld: 'f1', grundfigur: 'n' });
  assert.equal(gegner.ereignisse.length, 1);
  assert.deepEqual(zuschauerSicht(p).secretDame!.ereignisse, gegner.ereignisse);
});

test('Verdeckt geschlagen: das Schlagen der verdeckten Dame wird fuer alle sichtbar', () => {
  const fen = '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1';
  let p = gewaehlt('e4', 'd5', 'A', fen);
  assert.equal(sichtFuer(p, WEISS).secretDame!.bekannt.b, null);
  p = fuehreAus(p, WEISS, zug('e4', 'd5'));
  assert.equal(p.secretDame!.b.zustand, 'geschlagen');
  const ereignis = { art: 'verdecktGeschlagen', farbe: 'b', feld: 'd5', grundfigur: 'p', halbzug: 1 };
  assert.deepEqual(p.secretDame!.ereignisse, [ereignis]);
  for (const sicht of [sichtFuer(p, WEISS), sichtFuer(p, SCHWARZ), zuschauerSicht(p)]) {
    assert.deepEqual(sicht.secretDame!.ereignisse, [ereignis]);
    assert.deepEqual(sicht.secretDame!.bekannt.b, { zustand: 'geschlagen', feld: null, grundfigur: 'p' });
  }
  // Die weisse Dame steht jetzt auf d5 und ist weiterhin verdeckt.
  assert.equal(p.secretDame!.w.feld, 35);
  assert.equal(p.secretDame!.w.zustand, 'verdeckt');
});

test('Rochade: ist der Turm die geheime Dame, zieht sie mit', () => {
  const fen = '4k3/p7/8/8/8/8/8/4K2R w K - 0 1';
  let p = gewaehlt('h1', 'a7', 'A', fen);
  p = fuehreAus(p, WEISS, zug('e1', 'g1'));
  assert.equal(p.secretDame!.w.feld, 5); // f1
  p = fuehreAus(p, SCHWARZ, zug('a7', 'a6'));
  assert.ok(hat(p, WEISS, 'f1', 'b5'), 'der Turm auf f1 zieht schraeg');
});

// ---------------------------------------------------------------------------
// Regel A und Regel B: König in Reichweite der verdeckten Dame
// ---------------------------------------------------------------------------

// Weisser Springer d4 als geheime Dame; der schwarze König auf d8 steht in
// ihrer Linie (d5–d7 frei). Schwarz am Zug.
const IN_REICHWEITE = '3k4/p7/8/8/3N4/8/8/4K3 b - - 0 1';

test('Regel A: die verdeckte Dame gibt kein Schach — schlaegt sie den König, ist die Partie aus', () => {
  const p = gewaehlt('d4', 'a7', 'A', IN_REICHWEITE);
  assert.equal(amZug(p), SCHWARZ);
  assert.equal(sichtFuer(p, SCHWARZ).schach, false);
  assert.equal(sichtFuer(p, WEISS).schach, false);
  assert.ok(hat(p, SCHWARZ, 'a7', 'a6'), 'Schwarz darf den König stehen lassen');
  assert.ok(hat(p, SCHWARZ, 'd8', 'd7'), 'und sogar in die Linie ziehen');

  const danach = fuehreAus(p, SCHWARZ, zug('a7', 'a6'));
  assert.ok(hat(danach, WEISS, 'd4', 'd8'));
  const ende = fuehreAus(danach, WEISS, zug('d4', 'd8'));
  assert.deepEqual(ende.ende, { ausgang: 'matt', sieger: WEISS });
  assert.equal(ende.secretDame!.w.zustand, 'aufgedeckt');
  assert.deepEqual(brochess.standings(ende).map((s) => s.place), [1, 2]);
  assert.equal(brochess.currentActor(ende), null);
});

test('Regel A: eine AUFGEDECKTE Dame gibt Schach wie jede Dame', () => {
  // Weisser Springer b1 als geheime Dame deckt mit b1-b5 auf; e8 ist dann
  // ueber die Schraege b5–e8 angegriffen.
  const fen = '4k3/p7/8/8/8/8/8/1N2K3 w - - 0 1';
  let p = gewaehlt('b1', 'a7', 'A', fen);
  p = fuehreAus(p, WEISS, zug('b1', 'b5'));
  assert.equal(sichtFuer(p, SCHWARZ).schach, true);
  assert.equal(p.verlauf.at(-1), 'Nb1-b5+');
  assert.ok(!hat(p, SCHWARZ, 'a7', 'a6'), 'im Schach muss Schwarz es aufloesen');
});

test('Regel B: die verdeckte Dame zaehlt wie eine Dame — Schach, Legalitaet, kein Königsschlag', () => {
  const p = gewaehlt('d4', 'a7', 'B', IN_REICHWEITE);
  assert.equal(sichtFuer(p, SCHWARZ).schach, true);
  assert.ok(!hat(p, SCHWARZ, 'a7', 'a6'), 'im Schach darf Schwarz nicht a6 ziehen');
  assert.ok(!hat(p, SCHWARZ, 'd8', 'd7'), 'und nicht in die Linie');
  assert.throws(() => fuehreAus(p, SCHWARZ, zug('a7', 'a6')), /nicht erlaubt/);
  const zuege = erlaubteAktionen(p, SCHWARZ).map((a) => (a.type === 'zug' ? `${a.von}${a.nach}` : ''));
  // Koenigszuege aus der Linie — und die eigene geheime Dame a7 darf als
  // Dame schlagen (a7xd4) oder dazwischenziehen (a7-d7).
  assert.deepEqual(zuege.sort(), ['a7d4', 'a7d7', 'd8c7', 'd8c8', 'd8e7', 'd8e8']);
  const danach = fuehreAus(p, SCHWARZ, zug('d8', 'c8'));
  assert.ok(!hat(danach, WEISS, 'd4', 'c8'), 'der König steht nicht mehr in Reichweite');
});

// Weisser Springer b6 als geheime Dame zieht nach a8 (Springerzug, bleibt
// verdeckt) und steht dann auf der achten Reihe dem König h8 gegenueber.
// Die schwarze geheime Dame h3 kommt an keine Stelle dazwischen.
const RUECKREIHE = '7k/6pp/1N6/8/6P1/7p/7P/4K3 w - - 0 1';

test('Regel B: Matt durch die verdeckte Dame', () => {
  const p = fuehreAus(gewaehlt('b6', 'h3', 'B', RUECKREIHE), WEISS, zug('b6', 'a8'));
  assert.equal(p.secretDame!.w.zustand, 'verdeckt');
  assert.deepEqual(p.ende, { ausgang: 'matt', sieger: WEISS });
  assert.equal(p.verlauf.at(-1), 'Na8#');
});

test('Regel A: dieselbe Stellung ist kein Matt — der König faellt einen Zug spaeter', () => {
  let p = fuehreAus(gewaehlt('b6', 'h3', 'A', RUECKREIHE), WEISS, zug('b6', 'a8'));
  assert.equal(p.ende, null);
  assert.equal(p.verlauf.at(-1), 'Na8', 'kein Schachzeichen, das die Dame verriete');
  assert.equal(sichtFuer(p, SCHWARZ).schach, false);
  p = fuehreAus(p, SCHWARZ, zug('g7', 'g6'));
  p = fuehreAus(p, WEISS, zug('a8', 'h8'));
  assert.deepEqual(p.ende, { ausgang: 'matt', sieger: WEISS });
});

// ---------------------------------------------------------------------------
// Umwandlung
// ---------------------------------------------------------------------------

test('Umwandlung: der Bauer als geheime Dame wandelt sich um — danach keine geheime Dame mehr', () => {
  const fen = '4k3/1P5p/8/8/8/8/8/4K3 w - - 0 1';
  let p = gewaehlt('b7', 'h7', 'A', fen);
  assert.throws(() => fuehreAus(p, WEISS, zug('b7', 'b8')), /nicht erlaubt/);
  p = fuehreAus(p, WEISS, zug('b7', 'b8', 'n'));
  assert.equal(p.stellung.brett[57], 'N');
  assert.deepEqual(p.secretDame!.w, { zustand: 'erloschen', feld: null, grundfigur: 'p', bekannt: false });
  // Verdeckt umgewandelt: Das Ereignis sieht nur Weiss.
  assert.equal(sichtFuer(p, WEISS).secretDame!.ereignisse.length, 1);
  assert.deepEqual(sichtFuer(p, SCHWARZ).secretDame!.ereignisse, []);
  assert.deepEqual(zuschauerSicht(p).secretDame!.ereignisse, []);
  assert.equal(sichtFuer(p, SCHWARZ).secretDame!.bekannt.w, null);

  p = fuehreAus(p, SCHWARZ, zug('h7', 'h6'));
  const vonB8 = erlaubteAktionen(p, WEISS)
    .filter((a) => a.type === 'zug' && a.von === 'b8')
    .map((a) => (a.type === 'zug' ? a.nach : ''))
    .sort();
  assert.deepEqual(vonB8, ['a6', 'c6', 'd7'], 'der neue Springer ist nur ein Springer');
});

test('Umwandlung: auch ein Damenzug auf die letzte Reihe wandelt um — und deckt auf', () => {
  const fen = '4k3/7p/1P6/8/8/8/8/4K3 w - - 0 1';
  const p = gewaehlt('b6', 'h7', 'A', fen);
  assert.ok(!erlaubteAktionen(p, WEISS).some((a) => a.type === 'zug' && a.nach === 'b8' && !a.umwandlung));
  const danach = fuehreAus(p, WEISS, zug('b6', 'b8', 'q'));
  assert.equal(danach.stellung.brett[57], 'Q');
  assert.equal(danach.secretDame!.w.zustand, 'erloschen');
  assert.deepEqual(
    danach.secretDame!.ereignisse.map((e) => e.art),
    ['aufgedeckt', 'umgewandelt'],
  );
  assert.equal(sichtFuer(danach, SCHWARZ).secretDame!.ereignisse.length, 2, 'aufgedeckt umgewandelt ist oeffentlich');
});

// ---------------------------------------------------------------------------
// Was der Gegner sieht
// ---------------------------------------------------------------------------

test('Gegnersicht verraet die Wahl nicht: sie ist gleich, egal welche Figur gewaehlt wurde', () => {
  const mitB1 = gewaehlt('b1', 'a7');
  const mitG1 = gewaehlt('g1', 'a7');
  assert.deepEqual(sichtFuer(mitB1, SCHWARZ), sichtFuer(mitG1, SCHWARZ));
  assert.deepEqual(zuschauerSicht(mitB1), zuschauerSicht(mitG1));

  const json = JSON.stringify(sichtFuer(mitB1, SCHWARZ));
  assert.ok(!json.includes('"b1"'), 'das Feld der Wahl steht nicht in der Gegnersicht');
  assert.ok(!json.includes('grundfigur":"n'), 'die Grundfigur auch nicht');
  assert.ok(!JSON.stringify(zuschauerSicht(mitB1)).includes('"b1"'));
  // Der Besitzer sieht sie.
  assert.deepEqual(sichtFuer(mitB1, WEISS).secretDame!.meine, { zustand: 'verdeckt', feld: 'b1', grundfigur: 'n' });

  // Auch nach Zuegen der Grundfigur und mit der Dame in Schlagreichweite
  // (Regel A): Schach, Zugliste und Vorab-Ziele bleiben stumm.
  const ohneWahl = gewaehlt('h1', 'a7', 'A', '3k4/p7/8/8/3N4/8/8/4K2N b - - 0 1');
  const mitWahl = gewaehlt('d4', 'a7', 'A', '3k4/p7/8/8/3N4/8/8/4K2N b - - 0 1');
  assert.deepEqual(sichtFuer(mitWahl, SCHWARZ), sichtFuer(ohneWahl, SCHWARZ));
  const weiter = (p: BroChessPartie): BroChessPartie =>
    fuehreAus(fuehreAus(p, SCHWARZ, zug('a7', 'a6')), WEISS, zug('d4', 'f5'));
  assert.deepEqual(sichtFuer(weiter(mitWahl), SCHWARZ), sichtFuer(weiter(ohneWahl), SCHWARZ));
});

// ---------------------------------------------------------------------------
// Modul: Snapshot und Ersatzzug
// ---------------------------------------------------------------------------

test('Snapshot traegt die geheimen Damen mit', () => {
  const p = gewaehlt('b1', 'g8');
  const zurueck = brochess.deserialize(brochess.serialize(p));
  assert.deepEqual(zurueck, p);
});

test('Ersatzzug waehrend der Wahl: waehlt eine Figur statt eines Zuges', () => {
  const regeln: BroChessRegeln = { modus: 'secretDame' };
  const p = brochess.createParty({ config: regeln, seats: 2, rounds: 1, seed: 0 });
  const aktion = brochess.botAction(brochess.viewFor(p, WEISS), 'standard');
  assert.deepEqual(aktion, { type: 'wahl', feld: 'b1' });
  assert.doesNotThrow(() => brochess.act(p, WEISS, aktion));
});
