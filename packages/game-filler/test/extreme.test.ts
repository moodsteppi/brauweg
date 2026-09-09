/**
 * Die Spielart Extreme: Build plus drei Sternfelder, sieben Farben.
 *
 * Geprueft wird, was die Spielart von Build unterscheidet — und dass sie
 * Build sonst in Ruhe laesst: gleiches Brett aus gleicher Saat.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { filler } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import {
  STERNE_ANZAHL,
  STERN_BONUS,
  STERN_MAUERN,
  erstellePartie,
  fuehreAus,
  nachbarn,
  startEcke,
} from '../src/partie.js';
import { DEFAULT_REGELN, mitBarrieren, mitSternen } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

const EXTREME = { ...DEFAULT_REGELN, variante: 'extreme', farben: 7, barrieren: 10 } as const;
const SAAT = 'c0ffee1234567890abcdef0123456789';

function abstand(a: number, b: number, spalten: number): number {
  return (
    Math.abs((a % spalten) - (b % spalten)) +
    Math.abs(Math.floor(a / spalten) - Math.floor(b / spalten))
  );
}

describe('Extreme: Aufbau', () => {
  it('ist Build mit Sternen', () => {
    assert.ok(mitBarrieren('extreme'));
    assert.ok(mitSternen('extreme'));
    assert.ok(!mitSternen('build'));
    assert.deepEqual(filler.validateConfig(EXTREME, 2, 1), []);
  });

  it('legt drei Sterne, keinen auf oder neben einer Startecke, keine zwei nah beieinander', () => {
    for (const saat of [SAAT, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const partie = erstellePartie(EXTREME, [0, 1], saat);
      assert.equal(partie.sterne.length, STERNE_ANZAHL);
      const { spalten, zeilen } = partie.regeln;
      const tabu = new Set<number>();
      for (const sitz of [0, 1]) {
        const ecke = startEcke(sitz, spalten, zeilen);
        tabu.add(ecke);
        for (const n of nachbarn(ecke, spalten, zeilen)) tabu.add(n);
      }
      for (const stern of partie.sterne) assert.ok(!tabu.has(stern), `Stern ${stern} liegt an einer Ecke`);
      for (const a of partie.sterne) {
        for (const b of partie.sterne) {
          if (a !== b) assert.ok(abstand(a, b, spalten) >= 3, `Sterne ${a} und ${b} zu nah`);
        }
      }
      // Ein Stern ist ein Feld mit normaler Farbe: kein achter Farbwert.
      for (const stern of partie.sterne) assert.ok(partie.feld[stern]! < 7);
    }
  });

  it('spielt mit sieben Farben und zehn Mauern', () => {
    const partie = erstellePartie(EXTREME, [0, 1], SAAT);
    assert.equal(partie.regeln.farben, 7);
    assert.ok(partie.feld.some((f) => f === 6), 'die siebte Farbe kommt auf dem Brett vor');
    assert.equal(partie.barrierenUebrig[0], 10);
    assert.equal(partie.barrierenUebrig[1], 10);
  });

  it('laesst die anderen Spielarten unberuehrt: keine Sterne, gleiches Brett aus gleicher Saat', () => {
    for (const variante of ['nebel', 'klar', 'build'] as const) {
      const partie = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], SAAT);
      assert.deepEqual([...partie.sterne], []);
    }
    // Die Sterne werden NACH Brett und Grautoenen gezogen — beides muss also
    // mit dem Build-Brett derselben Saat uebereinstimmen.
    const build = erstellePartie({ ...EXTREME, variante: 'build' }, [0, 1], SAAT);
    const extreme = erstellePartie(EXTREME, [0, 1], SAAT);
    assert.deepEqual([...extreme.feld], [...build.feld]);
    assert.deepEqual([...extreme.grau], [...build.grau]);
  });

  it('traegt die Sterne in JEDE Sicht', () => {
    const partie = erstellePartie(EXTREME, [0, 1], SAAT);
    for (const sicht of [sichtFuer(partie, 0), sichtFuer(partie, 1), zuschauerSicht(partie)]) {
      assert.deepEqual([...sicht.sterne], [...partie.sterne]);
      assert.equal(sicht.farbzahl, 7);
    }
  });
});

describe('Extreme: Ein Stern faellt', () => {
  /*
   * Handgelegtes 4x3-Brett, Sitz 0 auf Platz 8 (unten links). Rechts daneben
   * Platz 9 mit Farbe 1 und einem Stern; darueber Platz 4 mit Farbe 2 ohne.
   *
   *   Zeile 0: 3 4 3 4
   *   Zeile 1: 2 4 3 4
   *   Zeile 2: 0 1 3 5   <- Platz 8 gehoert Sitz 0, Platz 11 gehoert Sitz 1
   */
  const regeln = { spalten: 4, zeilen: 3, farben: 7, variante: 'extreme', barrieren: 10 } as const;
  const gelegt = () => ({
    ...erstellePartie(regeln, [0, 1], 3),
    feld: [3, 4, 3, 4, 2, 4, 3, 4, 0, 1, 3, 5],
    besitzer: [null, null, null, null, null, null, null, null, 0, null, null, 1] as (number | null)[],
    farbe: { 0: 0, 1: 5 },
    punkte: { 0: 1, 1: 1 },
    barrierenUebrig: { 0: 10, 1: 10 },
    dran: 0,
    zug: 4,
    sterne: [9],
  });

  it('bringt zwei Punkte und eine Mauer', () => {
    const danach = fuehreAus(gelegt(), 0, { typ: 'faerben', farbe: 1 });
    assert.equal(danach.besitzer[9], 0);
    assert.equal(danach.punkte[0], 1 + 1 + STERN_BONUS, 'das Feld plus der Bonus');
    assert.equal(danach.barrierenUebrig[0], 10 + STERN_MAUERN);
    // Der Stern bleibt liegen; die Punkte sind verbucht und kommen nicht noch einmal.
    assert.deepEqual([...danach.sterne], [9]);
    assert.equal(danach.barrierenUebrig[1], 10);
  });

  it('bringt ohne Stern nur das Feld', () => {
    const danach = fuehreAus(gelegt(), 0, { typ: 'faerben', farbe: 2 });
    assert.equal(danach.besitzer[4], 0);
    assert.equal(danach.punkte[0], 2);
    assert.equal(danach.barrierenUebrig[0], 10);
  });

  it('nimmt der Bot den Stern, wenn beide Farben gleich viel Flaeche bringen', () => {
    const zug = botZug(sichtFuer(gelegt(), 0));
    assert.deepEqual(zug, { typ: 'faerben', farbe: 1 });
  });

  it('entscheidet der Bonus die Wertung: mehr Punkte, nicht mehr Felder', () => {
    const partie = { ...gelegt(), fertig: true, punkte: { 0: 5, 1: 6 }, besitzer: gelegt().besitzer };
    // Sitz 0 hat mit Bonus 5, Sitz 1 sechs — die Zahl entscheidet, nicht die Felder.
    const stand = filler.standings(partie);
    assert.equal(stand.find((s) => s.seat === 1)?.place, 1);
  });
});

describe('Extreme: Snapshot', () => {
  it('ueberlebt Speichern und Laden, und Fassung 4 bekommt eine leere Sternliste', () => {
    const partie = erstellePartie(EXTREME, [0, 1], SAAT);
    const roh = JSON.parse(JSON.stringify(filler.serialize(partie)));
    assert.equal(roh.v, 5);
    assert.deepEqual(filler.deserialize(roh), partie);

    const { sterne: _weg, ...ohne } = partie;
    void _weg;
    const alt = JSON.parse(JSON.stringify({ v: 4, ...ohne }));
    assert.deepEqual([...filler.deserialize(alt).sterne], []);
  });
});
