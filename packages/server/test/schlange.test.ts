/**
 * Die Suchschlange allein, ohne Datenbank und ohne Vermittlung: ein Konto,
 * das in ZWEI Spielen zugleich sucht.
 *
 * Erreichbar mit zwei Reitern oder zwei Geraeten am selben Konto. Die
 * Fenster sind je Spiel getrennt; die Karte `imBau` war es bis zum
 * 09.09.2026 nicht — nur nach Konto geschluesselt. Reifte Spiel B, nachdem
 * Spiel A schon im Bau war, ueberschrieb es den Eintrag von A; das Ende des
 * einen Tischbaus loeschte den Eintrag des anderen; eine neue Suche in B
 * raeumte den Bau von A weg. Fuer Spiel A hiess es dann wieder "sucht nicht"
 * — der Client meldete "Suche beendet" und fragte nie wieder, sass aber
 * laengst am Tisch. Die Probe mit Datenbank steht in suche.test.ts; hier
 * reicht die Buchhaltung, weil der Fehler allein in ihr lag.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { Suchschlange } from '../src/suche/schlange.js';

const FENSTER_MS = 30_000;
/** Kein Spiel wird hier voll: Jede Runde geht erst mit dem Ablauf des Fensters los. */
const NIE_VOLL = () => 8;

const NIEMAND = { sucht: false, suchende: 0, restMs: 0, tischId: null };

function aufbau() {
  let uhr = 1_000_000;
  // Die Stille-Frist steht ueber dem Fenster, damit die Uhr in einem Schritt
  // vorgestellt werden kann, ohne dass die Konten als still hinausfliegen —
  // geprueft wird hier der Schluessel der Karte, nicht die Stille-Regel.
  const schlange = new Suchschlange({
    jetzt: () => uhr,
    fensterMs: FENSTER_MS,
    stilleMs: FENSTER_MS * 2,
  });
  return {
    schlange,
    vor(ms: number) {
      uhr += ms;
    },
  };
}

test('Spiel A reift, danach Spiel B: Spiel A bleibt im Bau, bis vermittelt oder bauBeendet fuer A kommt', () => {
  const { schlange, vor } = aufbau();
  schlange.betritt('filler', 'anna');
  vor(10_000);
  schlange.betritt('eiland', 'anna');
  vor(FENSTER_MS - 10_000);

  // Erst reift Filler; Eiland hat noch zehn Sekunden.
  const erste = schlange.faellig(NIE_VOLL);
  assert.deepEqual(erste.map((runde) => runde.gameId), ['filler']);
  assert.deepEqual(schlange.stand('filler', 'anna'), {
    sucht: true,
    suchende: 1,
    restMs: 0,
    tischId: null,
  });
  assert.equal(schlange.stand('eiland', 'anna').sucht, true);
  assert.ok(schlange.stand('eiland', 'anna').restMs > 0, 'Eiland wartet noch im Fenster');

  // Dann reift Eiland — der Filler-Bau laeuft derweil noch.
  vor(10_000);
  const zweite = schlange.faellig(NIE_VOLL);
  assert.deepEqual(zweite.map((runde) => runde.gameId), ['eiland']);
  assert.deepEqual(
    schlange.stand('filler', 'anna'),
    { sucht: true, suchende: 1, restMs: 0, tischId: null },
    'Filler ist weiter im Bau — vorher ueberschrieb Eiland den Eintrag, und hier stand "sucht nicht"',
  );
  assert.deepEqual(schlange.stand('eiland', 'anna'), {
    sucht: true,
    suchende: 1,
    restMs: 0,
    tischId: null,
  });
  assert.equal(schlange.lebenszeichen('filler', 'anna'), true, 'im Bau zaehlt als Suche');

  // Der Eiland-Bau scheitert: Nur Eiland faengt von vorn an.
  schlange.bauBeendet('eiland', ['anna']);
  assert.deepEqual(schlange.stand('eiland', 'anna'), NIEMAND);
  assert.equal(schlange.stand('filler', 'anna').sucht, true, 'Filler bleibt im Bau');

  // Der Filler-Tisch steht.
  schlange.vermittelt('filler', ['anna'], 'tisch-filler');
  assert.equal(schlange.stand('filler', 'anna').tischId, 'tisch-filler');
});

test('Beide Spiele reifen im selben Durchlauf: das Ende des einen Tischbaus laesst das andere im Bau', () => {
  const { schlange, vor } = aufbau();
  schlange.betritt('filler', 'anna');
  schlange.betritt('eiland', 'anna');
  vor(FENSTER_MS);

  const runden = schlange.faellig(NIE_VOLL);
  assert.deepEqual(
    runden.map((runde) => runde.gameId).sort(),
    ['eiland', 'filler'],
    'beide Runden gehen los',
  );
  assert.equal(schlange.stand('filler', 'anna').sucht, true, 'Filler: im Bau, sucht noch');
  assert.equal(schlange.stand('eiland', 'anna').sucht, true, 'Eiland: im Bau, sucht noch');

  // Der Filler-Tisch ist gescheitert, der Eiland-Tisch entsteht noch.
  schlange.bauBeendet('filler', ['anna']);
  assert.equal(schlange.stand('filler', 'anna').sucht, false, 'Filler: von vorn');
  assert.equal(
    schlange.stand('eiland', 'anna').sucht,
    true,
    'Eiland: weiter im Bau — vorher hiess es hier "sucht nicht"',
  );
  assert.equal(schlange.lebenszeichen('eiland', 'anna'), true);

  schlange.vermittelt('eiland', ['anna'], 'tisch-eiland');
  assert.equal(schlange.stand('eiland', 'anna').tischId, 'tisch-eiland');
});

test('Eine neue Suche in Spiel B raeumt den Bau-Eintrag von Spiel A nicht weg', () => {
  const { schlange, vor } = aufbau();
  schlange.betritt('filler', 'anna');
  vor(FENSTER_MS);
  schlange.faellig(NIE_VOLL);
  assert.equal(schlange.stand('filler', 'anna').sucht, true, 'Filler ist im Bau');

  schlange.betritt('eiland', 'anna');
  assert.equal(schlange.stand('eiland', 'anna').sucht, true);
  assert.deepEqual(
    schlange.stand('filler', 'anna'),
    { sucht: true, suchende: 1, restMs: 0, tischId: null },
    'Filler ist weiter im Bau — vorher loeschte betritt() den Eintrag ohne Blick auf das Spiel',
  );

  // Dieselbe Suche noch einmal: DIESEN Bau-Eintrag raeumt sie weg — ein
  // altes "im Bau" waere sonst die Antwort auf die neue Suche.
  schlange.betritt('filler', 'anna');
  assert.equal(schlange.stand('filler', 'anna').sucht, true);
  assert.ok(schlange.stand('filler', 'anna').restMs > 0, 'Filler steht wieder im Fenster, nicht im Bau');
});

test('Vom Tisch her (verlaesstUeberall) ist das Konto in jedem Spiel draussen: Fenster, Bau und Ergebnis', () => {
  const { schlange, vor } = aufbau();
  schlange.betritt('filler', 'anna');
  schlange.betritt('eiland', 'anna');
  vor(FENSTER_MS);
  schlange.faellig(NIE_VOLL);
  schlange.vermittelt('filler', ['anna'], 'tisch-filler');
  // Eiland bleibt im Bau; in einem dritten Spiel steht sie noch im Fenster.
  schlange.betritt('mememory', 'anna');

  schlange.verlaesstUeberall('anna');
  for (const gameId of ['filler', 'eiland', 'mememory'] as const) {
    assert.deepEqual(schlange.stand(gameId, 'anna'), NIEMAND, gameId);
  }
});

test('Ein anderes Konto derselben Runde bleibt vom Austritt eines Kontos unberuehrt', () => {
  const { schlange, vor } = aufbau();
  schlange.betritt('filler', 'anna');
  schlange.betritt('filler', 'bert');
  vor(FENSTER_MS);
  const [runde] = schlange.faellig(NIE_VOLL);
  assert.deepEqual([...(runde?.accountIds ?? [])].sort(), ['anna', 'bert']);

  schlange.verlaesstUeberall('anna');
  assert.deepEqual(schlange.stand('filler', 'anna'), NIEMAND);
  assert.equal(schlange.stand('filler', 'bert').sucht, true, 'Bert ist weiter im Bau');

  schlange.vermittelt('filler', ['bert'], 'tisch-filler');
  assert.equal(schlange.stand('filler', 'bert').tischId, 'tisch-filler');
  assert.deepEqual(schlange.stand('filler', 'anna'), NIEMAND, 'Anna bekommt den Tisch nicht genannt');
});
