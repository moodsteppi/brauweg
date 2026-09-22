import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_REGELN,
  type GolfAktion,
  type GolfPartie,
  bestleistungenJeSitz,
  golf,
  pruefsummeDerTafel,
  waehleLochwerte,
  zaehltFuerBestleistung,
} from '../src/index.js';

/*
 * Bestleistung je Bahn (seit dem 22.09.2026): Was Golf im Endstand meldet.
 *
 * Die Plattformseite — Gast am Tisch, Training, Konten — prueft
 * packages/server/test/golf-bestleistung.test.ts mit diesem Modul. Hier geht
 * es nur um die Zusage des Moduls: gemeldet wird genau die Tafel, die auch
 * den Platz entschieden hat, Richtung `tief`, und sonst nichts.
 */

const start = (opts: { sitze?: number; loecher?: number; botSitze?: number[] } = {}) =>
  golf.createParty({
    config: DEFAULT_REGELN,
    seats: opts.sitze ?? 2,
    rounds: opts.loecher ?? 3,
    seed: 4711,
    botSeats: opts.botSitze,
  });

function summen(tafel: number[][], sitze: number): number[] {
  return Array.from({ length: sitze }, (_, s) => tafel.reduce((a, reihe) => a + reihe[s]!, 0));
}

/** Eine ehrliche Meldung, wie `meldeErgebnis` in screens/Golf.tsx sie baut. */
function meldung(tafel: number[][], sitze: number, eingelocht = alleGefallen(tafel)): GolfAktion {
  return {
    art: 'ergebnis',
    schlaege: summen(tafel, sitze),
    pruef: pruefsummeDerTafel(tafel),
    jeLoch: tafel,
    eingelocht,
  };
}

function alleGefallen(tafel: number[][]): boolean[][] {
  return tafel.map((reihe) => reihe.map(() => true));
}

// Loch 1: Anna 2, Bert 3 · Loch 2: 4 / 1 (Hole-in-one) · Loch 3: 3 / 5
const TAFEL = [
  [2, 3],
  [4, 1],
  [3, 5],
];

function gemeldet(p: GolfPartie, aktionen: [number, GolfAktion][]): GolfPartie {
  let q = p;
  for (const [sitz, a] of aktionen) q = golf.act(q, sitz, a);
  return q;
}

test('meldet je Sitz und Loch die Schlagzahl unter der Bahnkennung, Richtung tief', () => {
  const p = gemeldet(start(), [
    [0, meldung(TAFEL, 2)],
    [1, meldung(TAFEL, 2)],
  ]);
  assert.equal(p.ausgang?.strittig, false);

  const stand = golf.standings(p);
  const anna = stand.find((s) => s.seat === 0) as { bestleistungen?: unknown };
  const bert = stand.find((s) => s.seat === 1) as { bestleistungen?: unknown };
  assert.deepEqual(anna.bestleistungen, [
    { inhaltId: p.bahnen[0], wert: 2, richtung: 'tief' },
    { inhaltId: p.bahnen[1], wert: 4, richtung: 'tief' },
    { inhaltId: p.bahnen[2], wert: 3, richtung: 'tief' },
  ]);
  assert.deepEqual(bert.bestleistungen, [
    { inhaltId: p.bahnen[0], wert: 3, richtung: 'tief' },
    { inhaltId: p.bahnen[1], wert: 1, richtung: 'tief' },
    { inhaltId: p.bahnen[2], wert: 5, richtung: 'tief' },
  ]);
  // Die Kennungen sind die Bahnen der Partie, nicht erfunden.
  for (const id of p.bahnen) assert.match(id, /^k\d\d-/);
});

test('nur im klassischen Modus — der Haken fuer den Fun-Modus sagt heute fuer den Standard ja', () => {
  assert.equal(zaehltFuerBestleistung(DEFAULT_REGELN), true);
  assert.equal(zaehltFuerBestleistung(golf.defaultConfig()), true);
});

test('strittiger Ausgang: kein Platz, also auch keine Bestleistung', () => {
  const anders = [
    [2, 3],
    [4, 1],
    [3, 6],
  ];
  const p = gemeldet(start(), [
    [0, meldung(TAFEL, 2)],
    [1, meldung(anders, 2)],
  ]);
  assert.equal(p.ausgang?.strittig, true);
  assert.equal(waehleLochwerte(p), null);
  assert.ok(golf.standings(p).every((s) => !('bestleistungen' in s)));
});

test('Geraet ohne Tafel (Stand vor dem 22.09.2026): Platz wie immer, keine Bestleistung', () => {
  const alt: GolfAktion = { art: 'ergebnis', schlaege: [9, 9], pruef: pruefsummeDerTafel(TAFEL) };
  const p = gemeldet(start(), [
    [0, alt],
    [1, alt],
  ]);
  assert.deepEqual(p.ausgang, { schlaege: [9, 9], strittig: false });
  assert.equal(p.meldungen[0]?.jeLoch, undefined);
  assert.ok(golf.standings(p).every((s) => !('bestleistungen' in s)));
});

test('der niedrigste Sitz ohne Tafel sperrt den Tisch nicht — der naechste der Gruppe liefert sie', () => {
  const ohne: GolfAktion = {
    art: 'ergebnis',
    schlaege: summen(TAFEL, 2),
    pruef: pruefsummeDerTafel(TAFEL),
    eingelocht: alleGefallen(TAFEL),
  };
  const p = gemeldet(start(), [
    [0, ohne],
    [1, meldung(TAFEL, 2)],
  ]);
  assert.deepEqual(waehleLochwerte(p)?.schlaege, TAFEL);
});

test('erfundene Tafel neben abgeschriebener Pruefsumme zaehlt nicht', () => {
  // Sitz 0 schreibt die ehrliche Pruefsumme ab, schickt aber eine schoenere
  // Tafel mit derselben Summe. Er ist der niedrigste Sitz der Gruppe.
  const geschoent = [
    [1, 3],
    [5, 1],
    [3, 5],
  ];
  const falsch: GolfAktion = {
    art: 'ergebnis',
    schlaege: summen(TAFEL, 2),
    pruef: pruefsummeDerTafel(TAFEL),
    jeLoch: geschoent,
    eingelocht: alleGefallen(TAFEL),
  };
  const nurFalsch = gemeldet(start(), [
    [0, falsch],
    [1, { ...falsch }],
  ]);
  assert.equal(nurFalsch.ausgang?.strittig, false);
  assert.equal(waehleLochwerte(nurFalsch), null, 'passt zu keiner Pruefsumme');

  // Mit einem ehrlichen Geraet in derselben Gruppe gilt dessen Tafel.
  const mitEhrlichem = gemeldet(start(), [
    [0, falsch],
    [1, meldung(TAFEL, 2)],
  ]);
  assert.deepEqual(waehleLochwerte(mitEhrlichem)?.schlaege, TAFEL);
});

test('eine Tafel, deren Summen nicht die Schlaege des Ausgangs sind, zaehlt nicht', () => {
  // Pruefsumme passt zur Tafel, aber die gemeldeten Schlaege — die, nach
  // denen der Platz vergeben wird — sind andere.
  const schief: GolfAktion = {
    art: 'ergebnis',
    schlaege: [8, 8],
    pruef: pruefsummeDerTafel(TAFEL),
    jeLoch: TAFEL,
    eingelocht: alleGefallen(TAFEL),
  };
  const p = gemeldet(start(), [
    [0, schief],
    [1, schief],
  ]);
  assert.deepEqual(p.ausgang, { schlaege: [8, 8], strittig: false });
  assert.equal(waehleLochwerte(p), null);
});

test('die Minderheit meldet nicht mit, auch wenn ihre Tafel in sich stimmt', () => {
  const mehrheit = [
    [2, 3, 2],
    [4, 1, 2],
    [3, 5, 2],
  ];
  const minderheit = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ];
  const p = gemeldet(start({ sitze: 3 }), [
    [0, meldung(minderheit, 3)],
    [1, meldung(mehrheit, 3)],
    [2, meldung(mehrheit, 3)],
  ]);
  assert.deepEqual(p.ausgang?.schlaege, [9, 9, 6]);
  assert.deepEqual(waehleLochwerte(p)?.schlaege, mehrheit);
});

test('Bots und Ausgestiegene bekommen nichts, null Schlaege auch nicht', () => {
  // Sitz 1 Bot, Sitz 2 steigt aus (sein Geraet traegt danach Strafwerte ein),
  // Sitz 3 hat ein Loch mit 0 — so etwas spielt niemand.
  const tafel = [
    [2, 3, 4, 0],
    [3, 2, 10, 3],
    [2, 2, 10, 2],
  ];
  let p = start({ sitze: 4, botSitze: [1] });
  p = golf.markLeft!(p, 2);
  p = gemeldet(p, [
    [0, meldung(tafel, 4)],
    [3, meldung(tafel, 4)],
  ]);
  assert.equal(p.ausgang?.strittig, false);
  const jeSitz = bestleistungenJeSitz(p);
  assert.equal(jeSitz[0]!.length, 3);
  assert.equal(jeSitz[1]!.length, 0, 'Bot');
  assert.equal(jeSitz[2]!.length, 0, 'ausgestiegen');
  assert.deepEqual(
    jeSitz[3]!.map((m) => m.wert),
    [3, 2],
    'das Loch mit 0 faellt weg',
  );
});

test('kaputte Tafel: die Meldung zaehlt fuer den Platz, die Tafel wird nicht gespeichert', () => {
  const kaputt = [
    [[2, 3], [4, 1]], // ein Loch zu wenig
    [[2, 3], [4], [3, 5]], // eine Zeile zu kurz
    [[2, 3], [4, 1.5], [3, 5]], // keine ganze Zahl
    [[2, 3], [4, -1], [3, 5]], // negativ
    [[2, 3], [4, 1000], [3, 5]], // keine Golfpartie
    'Tafel',
    null,
  ];
  for (const jeLoch of kaputt) {
    const a = { art: 'ergebnis', schlaege: [9, 9], pruef: 'x', jeLoch } as unknown as GolfAktion;
    const p = gemeldet(start(), [
      [0, a],
      [1, a],
    ]);
    assert.deepEqual(p.ausgang, { schlaege: [9, 9], strittig: false }, JSON.stringify(jeLoch));
    assert.equal('jeLoch' in p.meldungen[0]!, false, JSON.stringify(jeLoch));
  }
});

test('die Tafel uebersteht den Schnappschuss', () => {
  const p = gemeldet(start(), [
    [0, meldung(TAFEL, 2)],
    [1, meldung(TAFEL, 2)],
  ]);
  const zurueck = golf.deserialize(golf.serialize(p));
  assert.deepEqual(golf.standings(zurueck), golf.standings(p));
});

test('nicht eingelocht: kein Loch mit Schlaglimit + 1 wird gemeldet', () => {
  // Bert locht Loch 2 nicht ein — sein Geraet traegt dort Limit + 1 ein.
  const tafel = [
    [2, 3],
    [4, 8],
    [3, 5],
  ];
  const gefallen = [
    [true, true],
    [true, false],
    [true, true],
  ];
  const p = gemeldet(start(), [
    [0, meldung(tafel, 2, gefallen)],
    [1, meldung(tafel, 2, gefallen)],
  ]);
  const jeSitz = bestleistungenJeSitz(p);
  assert.deepEqual(
    jeSitz[0]!.map((m) => m.wert),
    [2, 4, 3],
  );
  assert.deepEqual(
    jeSitz[1]!.map((m) => [m.inhaltId, m.wert]),
    [
      [p.bahnen[0], 3],
      [p.bahnen[2], 5],
    ],
    'Loch 2 faellt weg',
  );
});

test('ohne Eingelocht-Kennzeichen keine Bestleistung — ein Strafwert saehe aus wie ein Ergebnis', () => {
  const ohneKennzeichen: GolfAktion = {
    art: 'ergebnis',
    schlaege: summen(TAFEL, 2),
    pruef: pruefsummeDerTafel(TAFEL),
    jeLoch: TAFEL,
  };
  const p = gemeldet(start(), [
    [0, ohneKennzeichen],
    [1, ohneKennzeichen],
  ]);
  assert.equal(p.ausgang?.strittig, false);
  assert.equal(waehleLochwerte(p), null);
});

test('ein einzelnes Geraet kann eingelocht nicht erfinden, nur wegnehmen', () => {
  const ehrlich = [
    [true, true],
    [true, false],
    [true, true],
  ];
  const gelogen = [
    [true, true],
    [true, true],
    [true, true],
  ];
  const tafel = [
    [2, 3],
    [4, 8],
    [3, 5],
  ];
  const p = gemeldet(start(), [
    [0, meldung(tafel, 2, gelogen)],
    [1, meldung(tafel, 2, ehrlich)],
  ]);
  assert.deepEqual(waehleLochwerte(p)?.eingelocht, ehrlich);
});

test('Pruefsumme mit festen Zahlen — dieselbe Rechnung wie pruefsumme() im Client', () => {
  // Haelt die Abschrift fest; der Vertrag im Client vergleicht beide direkt.
  assert.equal(pruefsummeDerTafel([]), '811c9dc5');
  assert.equal(pruefsummeDerTafel(TAFEL), pruefsummeDerTafel([[2, 3], [4, 1], [3, 5]]));
  assert.notEqual(pruefsummeDerTafel(TAFEL), pruefsummeDerTafel([[3, 2], [4, 1], [3, 5]]));
});
