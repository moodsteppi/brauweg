/**
 * Levelformat: Jede mitgelieferte Datei ist gültig beschrieben, die
 * Höchstpunkte stimmen mit der Rechnung der Spezifikation überein, und die
 * Prüfung fängt die Fehler, für die es sie gibt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GIRAFFEN_WERTE,
  hoechstpunkte,
  LEVEL_JE_WELT,
  LEVELS,
  LevelFehler,
  levelIndex,
  levelNach,
  levelsDerWelt,
  naechstesLevel,
  pruefeLevel,
  SPIELABLAUF,
  tragendeTeile,
} from '../src/index.js';

// dist/test → Paketwurzel: Die JSON-Dateien liegen im Quellbaum, nicht nur in dist.
const LEVEL_ORDNER = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'levels');

function lade(datei: string): unknown {
  return JSON.parse(readFileSync(join(LEVEL_ORDNER, datei), 'utf8'));
}

/** Das Beispiel aus der Spezifikation, Abschnitt „Levelformat" — mit Pfosten 1,6 m (siehe Test unten). */
function beispiel(): any {
  return {
    fassung: 1,
    id: 'w1-07',
    welt: 1,
    nr: 7,
    titel: 'Die Glasveranda',
    breite: 30,
    boden: 0,
    schleuder: { x: 2.0, y: 1.2 },
    bros: ['pelle', 'malve', 'pelle'],
    sterne: [0, 8000, 11000],
    teile: [
      { stoff: 'holz', form: 'quader', x: 16.0, y: 0.6, b: 0.2, h: 1.2 },
      { stoff: 'holz', form: 'quader', x: 18.0, y: 0.6, b: 0.2, h: 1.2 },
      { stoff: 'glas', form: 'quader', x: 17.0, y: 1.3, b: 2.4, h: 0.2 },
      { stoff: 'stein', form: 'dreieck', x: 17.0, y: 1.75, b: 0.8, h: 0.7 },
      { stoff: 'holz', form: 'kreis', x: 21.0, y: 0.3, r: 0.3, winkel: 0 },
    ],
    giraffen: [
      { groesse: 'giraffe', x: 17.0, y: 0.0, blick: 'links' },
      { groesse: 'kalb', x: 21.6, y: 0.0, blick: 'links' },
    ],
    deko: [{ bild: 'busch-1', x: 25, y: 0, ebene: 'hinten' }],
  };
}

function fehlerVon(roh: unknown): string[] {
  try {
    pruefeLevel(roh);
  } catch (e) {
    assert.ok(e instanceof LevelFehler, String(e));
    return e.fehler;
  }
  return [];
}

test('alle Dateien unter levels/ sind eingetragen und gültig', () => {
  const dateien = readdirSync(LEVEL_ORDNER).filter((d) => d.endsWith('.json')).sort();
  assert.equal(dateien.length, 3 * LEVEL_JE_WELT);
  assert.deepEqual(
    dateien.map((d) => d.replace('.json', '')),
    LEVELS.map((l) => l.id),
    'jede Datei steht in levels.ts, in Spielreihenfolge',
  );
  for (const d of dateien) assert.deepEqual(fehlerVon(lade(d)), [], d);
});

test('Spielreihenfolge: drei Welten, je Level 1 bis 15 ohne Lücke', () => {
  assert.deepEqual(
    LEVELS.map((l) => [l.welt, l.nr]),
    Array.from({ length: 3 * LEVEL_JE_WELT }, (_, i) => [Math.floor(i / LEVEL_JE_WELT) + 1, (i % LEVEL_JE_WELT) + 1]),
  );
  assert.equal(levelIndex('w1-01'), 0);
  assert.equal(levelIndex('w9-99'), -1);
  assert.equal(naechstesLevel('w1-01')?.id, 'w1-02');
  // „Weiter" führt über die Weltgrenze ins erste Level der nächsten Welt.
  assert.equal(naechstesLevel('w1-15')?.id, 'w2-01');
  assert.equal(naechstesLevel('w3-15'), undefined);
  for (const w of [1, 2, 3]) assert.equal(levelsDerWelt(w).length, LEVEL_JE_WELT, `Welt ${w}`);
});

test('jedes Level: Sternschwellen erreichbar, mindestens drei Bros', () => {
  for (const l of LEVELS) {
    const h = hoechstpunkte(l);
    assert.ok(l.bros.length >= 3, `${l.id}: mit weniger als drei Bros fallen zweiter und dritter Stern zusammen`);
    assert.ok(l.sterne[2] <= h, `${l.id}: dritter Stern über den Höchstpunkten`);
    assert.ok(l.sterne[1] <= h - (l.bros.length - 2) * SPIELABLAUF.bonusJeUebrigemBro, `${l.id}: zweiter Stern`);
    // Der zweite Stern muss mehr verlangen als „geschafft, aber erst mit dem letzten Bro":
    // Wer nur die Giraffen umwirft und keinen Bro übrig hat, bleibt bei einem Stern.
    const nurGiraffen = l.giraffen.reduce((s, g) => s + GIRAFFEN_WERTE[g.groesse].punkte, 0);
    assert.ok(l.sterne[1] > nurGiraffen, `${l.id}: zweiter Stern schon mit nackten Giraffenpunkten`);
  }
});

test('Malve erst ab w1-06, Tjark erst ab w2-01, Pelle überall', () => {
  for (const l of LEVELS) {
    assert.ok(l.bros.includes('pelle'), l.id);
    if (l.welt === 1) assert.ok(!l.bros.includes('tjark'), `${l.id}: Tjark kommt erst ab w2-01`);
    if (l.welt === 1 && l.nr < 6) assert.ok(!l.bros.includes('malve'), `${l.id}: Malve kommt erst ab w1-06`);
  }
  // Wer freigeschaltet ist, soll auch kommen — sonst wird die Freischaltung nie sichtbar.
  assert.ok(levelNach('w1-06')!.bros.includes('malve'), 'Malve kommt in w1-06');
  assert.ok(levelNach('w2-01')!.bros.includes('tjark'), 'Tjark kommt in w2-01');
});

test('Schwierigkeit: das letzte Level jeder Welt ist ihr schwerstes, Welt für Welt höher', () => {
  // Grobes Maß ohne Physik: die Schätzschwelle des dritten Sterns, die mit Giraffen, Teilen und
  // Bros wächst. Streng steigend ist sie nicht (w1-01 bis w1-10 sind anders geordnet); geprüft
  // wird, was der Spieler merkt: Der Abschluss einer Welt ist ihr Gipfel, und jeder Gipfel liegt
  // über dem vorigen.
  let vorigerGipfel = 0;
  for (const w of [1, 2, 3]) {
    const ls = levelsDerWelt(w);
    const gipfel = ls[ls.length - 1].sterne[2];
    for (const l of ls) assert.ok(l.sterne[2] <= gipfel, `${l.id} (${l.sterne[2]}) schwerer als das Weltende (${gipfel})`);
    assert.ok(gipfel > vorigerGipfel, `Welt ${w} endet nicht schwerer als Welt ${w - 1}`);
    vorigerGipfel = gipfel;
  }
});

test('Höchstpunkte: das Rechenbeispiel der Spezifikation (12 950)', () => {
  // Teile 3 × 200 + 100 + 400 = 1 100, Giraffen 5 500, Treffer 7 × 50 = 350, übrige Bros 2 × 3 000.
  const roh = beispiel();
  // Für die Rechnung genügt die Form der Datei; die Geometrie prüft der nächste Test.
  roh.teile[0].h = roh.teile[1].h = 1.6;
  roh.teile[0].y = roh.teile[1].y = 0.8;
  roh.teile[2].y = 1.7;
  roh.teile[3].y = 2.15;
  roh.giraffen[1].x = 21.8;
  const l = pruefeLevel(roh);
  assert.equal(hoechstpunkte(l), 12_950);
  assert.equal(hoechstpunkte(l, { ersatzPelle: true }), 15_950, 'Ersatz-Pelle zählt einen Bro mehr');
});

test('das Beispiel der Spezifikation fällt wörtlich durch: der Kopf der Giraffe steckt im Dach', () => {
  // Pfosten 1,2 m, Giraffe 1,3 m hoch darunter — 10 cm Überlappung. Deshalb steht
  // w1-07 mit 1,6 m hohen Pfosten im Repo.
  const f = fehlerVon(beispiel());
  assert.ok(f.some((x) => x.includes('Giraffe 1 (giraffe)') && x.includes('überlappen')), f.join('\n'));
});

test('Prüfung: Schema-Fehler werden alle auf einmal gemeldet', () => {
  const roh = beispiel();
  roh.fassung = 2;
  roh.id = 'w1-7';
  roh.bros = ['pelle', 'tjark', 'rabe'];
  roh.teile[0].stoff = 'hloz';
  roh.teile[1].form = 'stern';
  roh.giraffen[0].groesse = 'riese';
  roh.sterne = [0, 9000, 9000];
  const f = fehlerVon(roh);
  for (const teil of ['fassung', 'id muss w1-07', 'Tjark kommt erst ab w2-01', '„rabe"', '„hloz"', '„stern"', '„riese"', 'sterne: 0 <'])
    assert.ok(f.some((x) => x.includes(teil)), `${teil} fehlt in:\n${f.join('\n')}`);
});

test('Prüfung: ohne Pelle, ohne Giraffe, kein Objekt', () => {
  const ohnePelle = beispiel();
  ohnePelle.bros = ['malve', 'malve'];
  assert.ok(fehlerVon(ohnePelle).includes('bros: Pelle fehlt'));
  const ohneGiraffe = beispiel();
  ohneGiraffe.giraffen = [];
  assert.ok(fehlerVon(ohneGiraffe).includes('giraffen: mindestens eine'));
  assert.deepEqual(fehlerVon(null), ['keine JSON-Objekt-Datei']);
});

test('Prüfung: Sternschwellen über den Höchstpunkten', () => {
  const roh = lade('w1-01.json') as any;
  roh.sterne = [0, 5000, 99_999];
  assert.ok(fehlerVon(roh).some((x) => x.startsWith('sterne[2] = 99999 liegt über')));
  roh.sterne = [0, 9000, 9500];
  // Höchstpunkte w1-01: 600 + 2 000 + 4 × 50 + 6 000 = 8 800 → beide Schwellen zu hoch.
  assert.ok(fehlerVon(roh).some((x) => x.startsWith('sterne[1] = 9000 ist mit dem vorletzten Bro nicht erreichbar')));
});

test('Prüfung: schwebendes Teil, Teil auf Dreiecksspitze, Schwerpunkt neben der Auflage', () => {
  const schwebt = lade('w1-01.json') as any;
  schwebt.teile[2].y += 0.3;
  assert.ok(fehlerVon(schwebt).some((x) => x.includes('schwebt')));

  const kippt = lade('w1-01.json') as any;
  // Planke so weit nach rechts, dass ihr Schwerpunkt jenseits des rechten Pfostens liegt.
  kippt.teile[2].x += 1.6;
  assert.ok(fehlerVon(kippt).some((x) => x.includes('kippt')), fehlerVon(kippt).join('\n'));

  const spitze = lade('w1-07.json') as any;
  // Ein Block auf der Steinpyramide: liegt nur auf einem Punkt — und nicht über dem Schwerpunkt, wenn versetzt.
  const d = spitze.teile.find((t: any) => t.form === 'dreieck');
  spitze.teile.push({ stoff: 'holz', form: 'quader', x: d.x + 0.2, y: d.y + d.h / 2 + 0.1, b: 0.8, h: 0.2 });
  assert.ok(fehlerVon(spitze).some((x) => x.includes('kippt')), fehlerVon(spitze).join('\n'));
});

test('Prüfung: Überlappung erst über 1 cm, Boden, Levelrand, Schleuder', () => {
  const knapp = lade('w1-01.json') as any;
  knapp.teile[2].y -= 0.005; // 5 mm in die Pfosten — lässt die Prüfung durch
  assert.deepEqual(fehlerVon(knapp), []);

  const tief = lade('w1-01.json') as any;
  tief.teile[0].y -= 0.05;
  assert.ok(fehlerVon(tief).some((x) => x.includes('steckt im Boden')));

  const rand = lade('w1-01.json') as any;
  rand.breite = 18;
  assert.ok(fehlerVon(rand).some((x) => x.includes('ragt aus dem Level')));

  const schleuder = lade('w1-01.json') as any;
  schleuder.schleuder.x = 17;
  assert.ok(fehlerVon(schleuder).includes('schleuder muss links vor dem Bauwerk stehen'));
});

test('Prüfung: Quader nur in 90°-Schritten, gedrehter Quader tauscht Breite und Höhe', () => {
  const schraeg = lade('w1-01.json') as any;
  schraeg.teile[0].winkel = 30;
  assert.ok(fehlerVon(schraeg).includes('Teil 1: Quader nur in 90°-Schritten'));

  const liegend = lade('w1-01.json') as any;
  // Der linke Pfosten (0,2 × 1,2) um 90° gelegt, Mitte so, dass er auf dem Boden liegt —
  // dann trägt er die Planke nicht mehr, und sie kippt über den rechten Pfosten.
  liegend.teile[0] = { ...liegend.teile[0], y: 0.1, winkel: 90, x: 15.5 };
  const f = fehlerVon(liegend);
  assert.ok(!f.some((x) => x.includes('Teil 1 ') && x.includes('Boden')), f.join('\n'));
  assert.ok(f.some((x) => x.includes('Teil 3') && x.includes('kippt')), f.join('\n'));
});

test('Bauplan: tragende Teile sind die mit der meisten Last, Giraffen zuerst', () => {
  // Beispiel ohne die Giraffe im Dach: zwei Pfosten tragen die Glasplatte,
  // die Platte trägt das Steindreieck; Kreis und Kalb stehen am Boden.
  const l = beispiel();
  const id = tragendeTeile(l);
  // Pfosten (Platte + Dreieck darüber, je 2) vor der Platte (nur das Dreieck).
  assert.deepEqual(id, [0, 1, 2]);
  assert.deepEqual(tragendeTeile(l, 1), [0]);
});

test('Bauplan: ein Teil unter einer Giraffe geht vor, auch mit weniger Last', () => {
  const l = beispiel();
  l.giraffen = [{ groesse: 'kalb', x: 21.0, y: 0.6, blick: 'links' }];
  l.teile[4] = { stoff: 'holz', form: 'quader', x: 21.0, y: 0.3, b: 1.0, h: 0.6 };
  assert.equal(tragendeTeile(l)[0], 4);
});

test('Bauplan: was nichts trägt, wird nie gezeigt', () => {
  const l = beispiel();
  l.teile = [{ stoff: 'holz', form: 'quader', x: 16.0, y: 0.5, b: 1, h: 1 }];
  assert.deepEqual(tragendeTeile(l), []);
});

test('Bauplan: jedes mitgelieferte Level zeigt drei Teile, alle mit gültiger Nummer', () => {
  for (const level of LEVELS) {
    const id = tragendeTeile(level);
    assert.ok(id.length > 0 && id.length <= 3, `${level.id}: ${id.length} tragende Teile`);
    assert.equal(new Set(id).size, id.length, level.id);
    for (const i of id) assert.ok(i >= 0 && i < level.teile.length, `${level.id}: Teil ${i}`);
  }
});
