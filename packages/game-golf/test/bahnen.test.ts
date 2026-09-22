import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BAHNEN_KATALOG,
  type Bahneintrag,
  golf,
  sollStufe,
  waehleBahnen,
} from '../src/index.js';

/*
 * Katalog und Bahnwahl des Moduls (seit dem 22.09.2026 — vorher zog jedes
 * Geraet die Folge selbst, siehe Kopf von bahnen.ts). Dass jede Kennung hier
 * auch eine Geometrie im Client hat, prueft der Vertrag
 * `packages/client/src/vertrag/golf-bahnen.test.ts`; hier geht es um das,
 * was das Modul allein verantwortet.
 */

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

test('Katalog: keine Kennung doppelt, jede mit Nummer vorn', () => {
  const ids = BAHNEN_KATALOG.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte Kennung');
  for (const id of ids) assert.match(id, /^k\d{2}-[a-z0-9-]+$/, id);
});

test('Katalog: nach Kennung geordnet — eine neue Bahn wird einsortiert, nicht irgendwo angehaengt', () => {
  const ids = BAHNEN_KATALOG.map((b) => b.id);
  assert.deepEqual(ids, [...ids].sort());
});

test('Katalog: jede Stufe 1..5 ist besetzt, sonst liefe die Rampe ins Leere', () => {
  for (let stufe = 1; stufe <= 5; stufe += 1) {
    assert.ok(
      BAHNEN_KATALOG.some((b) => b.schwierigkeit === stufe),
      `keine Bahn der Stufe ${stufe}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Bahnwahl
// ---------------------------------------------------------------------------

test('Bahnwahl ist deterministisch aus der Saat und haengt an ihr', () => {
  assert.deepEqual(waehleBahnen(5, 6), waehleBahnen(5, 6));
  assert.notDeepEqual(waehleBahnen(5, 6), waehleBahnen(6, 6));
});

/**
 * Festgehalten mit Werten, die der alte Client-Weg (`waehleKarten` in
 * physik.ts, gegen den damaligen Katalog k01..k40) am 22.09.2026 geliefert
 * hat — bei der Umstellung ueber 6.006 Saat/Lochzahl-Paare verglichen, alle
 * gleich. Bricht dieser Test, ziehen alte Schnappschuesse beim Laden andere
 * Bahnen als ihre Geraete damals (siehe `deserialize` in adapter.ts), und
 * die mulberry32-Abschrift in bahnen.ts ist nicht mehr dieselbe Rechnung.
 */
test('Bahnwahl trifft genau die Folge, die die Geraete vor der Umstellung selbst gezogen haben', () => {
  assert.deepEqual(waehleBahnen(4711, 2), ['k01-der-erste-schlag', 'k13-wasserinsel']);
  assert.deepEqual(waehleBahnen(4711, 9), [
    'k01-der-erste-schlag',
    'k05-der-pilzwald',
    'k09-der-uferweg',
    'k13-wasserinsel',
    'k19-sprungtrichter',
    'k26-sprung-ueber-die-wasserzunge',
    'k29-schmales-sprungtor',
    'k31-zwillingsstrom',
    'k39-drehkreuzgasse',
  ]);
  assert.deepEqual(waehleBahnen(20260922, 5), [
    'k08-der-strudelgarten',
    'k13-wasserinsel',
    'k24-drehkreuz-vorm-loch',
    'k31-zwillingsstrom',
    'k38-sprungfeldkaskade',
  ]);
});

test('Bahnwahl: verschiedene Bahnen, aufsteigend nach Schwierigkeit, nur Kennungen aus dem Katalog', () => {
  const stufe = new Map(BAHNEN_KATALOG.map((b) => [b.id, b.schwierigkeit]));
  for (const saat of [1, 2, 99, 20260906]) {
    for (let loecher = 2; loecher <= 15; loecher += 1) {
      const wahl = waehleBahnen(saat, loecher);
      assert.equal(wahl.length, loecher);
      assert.equal(new Set(wahl).size, loecher, 'eine Bahn doppelt');
      for (const id of wahl) assert.ok(stufe.has(id), `unbekannte Kennung ${id}`);
      for (let i = 1; i < wahl.length; i += 1) {
        assert.ok(stufe.get(wahl[i]!)! >= stufe.get(wahl[i - 1]!)!, `Rampe faellt bei ${saat}/${loecher}`);
      }
    }
  }
});

test('Rampe: ein kurzes Match beginnt leicht, ein langes steigt bis zur Spitze', () => {
  // 40 Attrappen, acht je Stufe — wie im echten Katalog ungefaehr.
  const katalog: Bahneintrag[] = [];
  for (let i = 0; i < 40; i += 1) {
    katalog.push({ id: `s${String(i).padStart(2, '0')}`, schwierigkeit: (1 + (i % 5)) as 1 | 2 | 3 | 4 | 5 });
  }
  const stufen = (loecher: number) =>
    waehleBahnen(11, loecher, katalog).map((id) => katalog.find((b) => b.id === id)!.schwierigkeit);
  assert.deepEqual(stufen(2), [1, 2]);
  assert.deepEqual(stufen(9), [1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.deepEqual(stufen(15), [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  assert.equal(sollStufe(0, 9), 1);
  assert.equal(sollStufe(8, 9), 5);
});

test('Bahnwahl mit mehr Loechern als Bahnen wiederholt statt abzubrechen (nur Testaufbau)', () => {
  const katalog: Bahneintrag[] = [{ id: 'k01-allein', schwierigkeit: 1 }];
  assert.deepEqual(waehleBahnen(3, 2, katalog), ['k01-allein', 'k01-allein']);
});

// ---------------------------------------------------------------------------
// Partie und Sicht
// ---------------------------------------------------------------------------

test('Die Partie zieht ihre Bahnen einmal beim Start, die Sicht liefert sie mit', () => {
  const p = golf.createParty({ config: {}, seats: 2, rounds: 7, seed: 4711 });
  assert.equal(p.bahnen.length, 7);
  assert.deepEqual(p.bahnen, waehleBahnen(p.saat, 7));
  const sicht = golf.viewFor(p, 1);
  assert.deepEqual(sicht.bahnen, p.bahnen);
  // Auch ein Ausschnitt der Zugliste traegt die ganze Folge.
  assert.deepEqual(golf.viewFor(p, 0, 99).bahnen, p.bahnen);
  // Ein Schlag aendert die Folge nicht — sie steht ab dem Start fest.
  const nach = golf.act(p, 0, { art: 'zug', zug: { takt: 3, nr: 0, rx: 1, ry: 0, kraft: 0.5 } });
  assert.deepEqual(nach.bahnen, p.bahnen);
});

test('Die Saat 0 wird wie ueberall zu 1 — und die Bahnen kommen aus der normierten Saat', () => {
  const p = golf.createParty({ config: {}, seats: 1, rounds: 3, seed: 0 });
  assert.equal(p.saat, 1);
  assert.deepEqual(p.bahnen, waehleBahnen(1, 3));
});

test('Ein Schnappschuss von vor dem 22.09.2026 (ohne bahnen) laedt und bekommt die alte Folge', () => {
  const p = golf.createParty({ config: {}, seats: 2, rounds: 9, seed: 4711 });
  const roh = JSON.parse(JSON.stringify(golf.serialize(p))) as Record<string, unknown>;
  delete roh.bahnen;
  const wieder = golf.deserialize(roh);
  assert.deepEqual(wieder.bahnen, waehleBahnen(4711, 9));
  assert.deepEqual(wieder, p);
});
