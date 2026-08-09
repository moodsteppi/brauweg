import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type FeldherrAktion,
  RegelverstossError,
  TAKT_MS,
  feldherr,
  naechsterTakt,
  punkteFuerDauer,
} from '../src/index.js';

const start = (saat = 4711) =>
  feldherr.createParty({ config: { feld: 'mittel' }, seats: 2, rounds: 1, seed: saat });

const zug = (takt: number, karte = 'schwert'): FeldherrAktion => ({
  art: 'zug',
  zug: { takt, art: 'karte', karte, r: 7, c: 2 },
});

const ergebnis = (sieger: number, takt = 1200, pruef = 'abc'): FeldherrAktion => ({
  art: 'ergebnis',
  sieger,
  takt,
  pruef,
});

test('Regelsatz: nur zu zweit, nur eine Runde, bekannte Feldgroesse', () => {
  assert.equal(feldherr.validateConfig({ feld: 'gross' }, 2, 1).length, 0);
  assert.equal(feldherr.validateConfig({ feld: 'riesig' }, 2, 1).length, 1);
  assert.equal(feldherr.validateConfig({ feld: 'mittel' }, 3, 1).length, 1);
  assert.equal(feldherr.validateConfig({ feld: 'mittel' }, 2, 4).length, 1);
});

test('Saatkorn steht in der Sicht und ist fuer beide gleich', () => {
  const p = start(12345);
  assert.equal(feldherr.viewFor(p, 0).saat, 12345);
  assert.equal(feldherr.viewFor(p, 1).saat, 12345);
});

test('Zuege sammeln sich, Takte muessen aufsteigen', () => {
  let p = start();
  p = feldherr.act(p, 0, zug(10));
  p = feldherr.act(p, 1, zug(12));
  p = feldherr.act(p, 0, zug(30));
  assert.equal(p.zuege.length, 3);
  assert.deepEqual(
    p.zuege.map((z) => `${z.sitz}@${z.takt}`),
    ['0@10', '1@12', '0@30'],
  );
  // In einen bereits gerechneten Takt darf niemand nachtraeglich schreiben.
  assert.throws(() => feldherr.act(p, 0, zug(30)), RegelverstossError);
  assert.throws(() => feldherr.act(p, 0, zug(5)), RegelverstossError);
  // Der andere Sitz ist davon unberuehrt.
  assert.doesNotThrow(() => feldherr.act(p, 1, zug(13)));
});

test('niemand ist am Zug, und es gibt keine Aktionsliste', () => {
  const p = start();
  assert.equal(feldherr.currentActor(p), null);
  assert.deepEqual(feldherr.legalActions(p, 0), []);
});

test('einige Meldung entscheidet die Partie', () => {
  let p = start();
  p = feldherr.act(p, 0, ergebnis(1, 900, 'x7'));
  assert.equal(feldherr.isFinished(p), false, 'eine Meldung genuegt nicht');
  p = feldherr.act(p, 1, ergebnis(1, 900, 'x7'));
  assert.equal(feldherr.isFinished(p), true);
  assert.equal(p.ausgang?.sieger, 1);
  assert.equal(p.ausgang?.strittig, false);
  assert.deepEqual(feldherr.standings(p), [
    { seat: 0, points: 0, place: 2, left: false },
    { seat: 1, points: 1, place: 1, left: false },
  ]);
});

test('widersprechende Meldungen sind strittig, niemand gewinnt', () => {
  let p = start();
  p = feldherr.act(p, 0, ergebnis(0, 800, 'aa'));
  p = feldherr.act(p, 1, ergebnis(1, 800, 'bb'));
  assert.equal(p.ausgang?.strittig, true);
  assert.equal(p.ausgang?.sieger, null);
  assert.deepEqual(feldherr.standings(p), [
    { seat: 0, points: 0, place: 1, left: false },
    { seat: 1, points: 0, place: 1, left: false },
  ]);
});

test('gleicher Sieger, aber andere Pruefsumme: ebenfalls strittig', () => {
  let p = start();
  p = feldherr.act(p, 0, ergebnis(1, 800, 'aa'));
  p = feldherr.act(p, 1, ergebnis(1, 800, 'bb'));
  assert.equal(p.ausgang?.strittig, true);
});

test('Aufgeben und Aussteigen geben dem anderen den Sieg', () => {
  let p = feldherr.act(start(), 0, { art: 'aufgabe' });
  assert.equal(p.ausgang?.sieger, 1);
  assert.equal(p.ausgang?.aufgegeben, true);

  p = feldherr.markLeft(start(), 1);
  assert.equal(p.ausgang?.sieger, 0);
  assert.equal(feldherr.standings(p)[1]?.left, true, 'der Ausstieg steht im Ergebnis');
});

test('nach dem Ende wird nichts mehr angenommen', () => {
  const p = feldherr.act(start(), 0, { art: 'aufgabe' });
  assert.throws(() => feldherr.act(p, 1, zug(50)), RegelverstossError);
});

test('Erfahrung: die ersten drei Minuten bringen am meisten', () => {
  const proMinute = (m: number) => punkteFuerDauer((m * 60_000) / TAKT_MS);
  assert.equal(proMinute(1), 20);
  assert.equal(proMinute(2), 40);
  assert.equal(proMinute(3), 60);
  // Ab hier faellt der Ertrag je Minute.
  assert.equal(proMinute(4), 70);
  assert.equal(proMinute(5), 75);
  assert.equal(proMinute(6), 77);
  // Zwanzig Minuten bringen kaum mehr als sieben — Sitzenbleiben lohnt nicht.
  assert.ok(proMinute(20) - proMinute(7) <= 1);
  // Die Kurve steigt nie wieder an.
  for (let m = 2; m <= 20; m += 1) {
    assert.ok(proMinute(m) - proMinute(m - 1) <= PUNKTE_SCHRITT(m));
  }
});

const PUNKTE_SCHRITT = (m: number): number => (m <= 3 ? 20 : 10);

test('Erfahrung gibt es erst mit dem Ausgang, dann fuer beide', () => {
  const offen = start();
  assert.deepEqual(feldherr.xpBasis?.(offen), {});
  const fertig = feldherr.act(offen, 0, { art: 'aufgabe' });
  const punkte = feldherr.xpBasis?.(fertig) ?? {};
  assert.equal(punkte[0], punkte[1], 'auch der Verlierer bekommt Punkte');
});

test('Snapshot ueberlebt Speichern und Laden', () => {
  let p = start(99);
  p = feldherr.act(p, 0, zug(10));
  p = feldherr.act(p, 1, ergebnis(0, 500, 'q'));
  const wieder = feldherr.deserialize(JSON.parse(JSON.stringify(feldherr.serialize(p))));
  assert.deepEqual(wieder, p);
  assert.throws(() => feldherr.deserialize({ v: 99 }));
});

/**
 * Die Zugliste waechst bis zum Partieende. Sie bei jedem Rundruf ganz zu
 * verschicken kostet das Quadrat der Partielaenge — der Grund fuer das
 * Ruckeln, das mit der Spieldauer schlimmer wurde. Diese Proben halten den
 * Ausschnitt fest, den `viewCursor` moeglich macht, UND die Regel, nach der
 * der Client ihn wieder zusammensetzt.
 */
test('Die Sicht liefert ab der Marke, die der Empfaenger schon hat', () => {
  let p = start();
  for (let i = 0; i < 5; i += 1) p = feldherr.act(p, i % 2, zug(10 + i * 10));

  const voll = feldherr.viewFor(p, 0, 0);
  assert.equal(voll.abIndex, 0);
  assert.equal(voll.zuege.length, 5, 'ohne Marke kommt alles');
  assert.equal(feldherr.viewCursor?.(p), 5, 'die Marke ist die Laenge der Liste');

  const teil = feldherr.viewFor(p, 0, 3);
  assert.equal(teil.abIndex, 3);
  assert.deepEqual(
    teil.zuege.map((z) => z.takt),
    [40, 50],
    'nur der Zuwachs seit der Marke',
  );

  const nichts = feldherr.viewFor(p, 0, 5);
  assert.equal(nichts.zuege.length, 0);
  assert.equal(nichts.abIndex, 5);

  // Alles ausser der Zugliste bleibt in jedem Ausschnitt vollstaendig:
  // Saatkorn, Regeln und Ausgang liest der Client aus JEDER Sicht.
  assert.equal(teil.saat, voll.saat);
  assert.deepEqual(teil.regeln, voll.regeln);
  assert.equal(teil.ausgang, voll.ausgang);

  // Eine Marke jenseits des Endes (frische Partie am selben Tisch, alter
  // Stand in der Verbindung) faellt auf die volle Sicht zurueck, statt eine
  // Luecke zu melden, die es nicht gibt.
  const frisch = start();
  const nachStart = feldherr.viewFor(frisch, 0, 99);
  assert.equal(nachStart.abIndex, 0);
  assert.equal(nachStart.zuege.length, 0);
});

test('Aus lauter Ausschnitten wird wieder die ganze Liste', () => {
  let p = start();
  /** So setzt der Client zusammen — dieselbe Regel wie in FeldherrTisch.tsx. */
  const beim = { liste: [] as { takt: number; sitz: number }[], loch: false };
  const nimm = (sicht: ReturnType<typeof feldherr.viewFor>): void => {
    const ab = sicht.abIndex;
    if (ab > beim.liste.length) {
      beim.loch = true;
      return;
    }
    for (let i = beim.liste.length - ab; i < sicht.zuege.length; i += 1) {
      beim.liste.push({ takt: sicht.zuege[i].takt, sitz: sicht.zuege[i].sitz });
    }
  };

  // Der Server merkt sich je Verbindung, wie weit sie beliefert ist.
  let stand = 0;
  for (let i = 0; i < 8; i += 1) {
    p = feldherr.act(p, i % 2, zug(10 + i * 10));
    nimm(feldherr.viewFor(p, 0, stand));
    stand = feldherr.viewCursor?.(p) ?? 0;
  }
  assert.equal(beim.loch, false);
  assert.deepEqual(
    beim.liste.map((z) => z.takt),
    p.zuege.map((z) => z.takt),
    'Ausschnitt fuer Ausschnitt ergibt genau die Serverliste',
  );

  // Wiederverbinden: Der Server schickt die volle Sicht, der Client haelt
  // sie schon — nichts darf doppelt ankommen.
  nimm(feldherr.viewFor(p, 0, 0));
  assert.equal(beim.liste.length, p.zuege.length, 'kein Zug doppelt nach dem Abgleich');

  // Und ein wirkliches Loch wird erkannt statt still ueberrannt: Der Client
  // fordert dann die volle Sicht an, statt mit einer Luecke weiterzurechnen.
  p = feldherr.act(p, 0, zug(500));
  p = feldherr.act(p, 1, zug(510));
  nimm(feldherr.viewFor(p, 0, p.zuege.length - 1));
  assert.equal(beim.loch, true, 'ein uebersprungener Zug faellt auf');
});

test('Vorlauf haelt Abstand zum letzten eigenen Takt', () => {
  let p = start();
  p = feldherr.act(p, 0, zug(100));
  assert.ok(naechsterTakt(p, 0) > 100);
  assert.equal(naechsterTakt(p, 1), 5, 'ohne eigene Zuege gilt der Vorlauf ab null');
});
