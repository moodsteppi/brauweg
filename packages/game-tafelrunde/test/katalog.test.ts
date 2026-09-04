import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  KATALOG,
  KOSTENSTUFEN,
  LEVEL_TABELLE,
  MARKEN,
  MAX_LEVEL,
  STUFEN_FAKTOR,
  VORRAT_JE_KOSTEN,
  einheit,
  einheitenMitKosten,
  gesamtkosten,
  istEinheitId,
  kartenZahl,
  werteFuer,
} from '../src/index.js';
import { BRETT_FELDER, hexNachbarn } from '../src/brett.js';

describe('Einheiten-Katalog', () => {
  it('hat mindestens 15 Einheiten ueber drei Kostenstufen', () => {
    assert.ok(KATALOG.length >= 15, `nur ${KATALOG.length} Einheiten`);
    for (const kosten of KOSTENSTUFEN) {
      assert.ok(
        einheitenMitKosten(kosten).length > 0,
        `Kostenstufe ${kosten} ist leer`,
      );
    }
  });

  it('vergibt jede Kennung und jeden Namen genau einmal', () => {
    // Zwei Einheiten mit derselben Kennung waeren zwei, die sich gegenseitig
    // verschmelzen — der Fehler faellt sonst erst im Spiel auf.
    assert.equal(new Set(KATALOG.map((e) => e.id)).size, KATALOG.length);
    assert.equal(new Set(KATALOG.map((e) => e.name)).size, KATALOG.length);
  });

  it('gibt jeder Einheit ein bis zwei bekannte Marken', () => {
    for (const e of KATALOG) {
      assert.ok(e.marken.length >= 1 && e.marken.length <= 2, `${e.id}: ${e.marken.length}`);
      for (const marke of e.marken) {
        assert.ok(MARKEN.includes(marke), `${e.id} traegt unbekannte Marke ${marke}`);
      }
    }
  });

  it('gibt jeder Einheit brauchbare Werte', () => {
    for (const e of KATALOG) {
      assert.ok(e.leben > 0 && Number.isInteger(e.leben), e.id);
      assert.ok(e.angriff > 0 && Number.isInteger(e.angriff), e.id);
      assert.ok(e.tempo > 0, e.id);
      assert.ok(e.reichweite >= 1 && Number.isInteger(e.reichweite), e.id);
      assert.ok(e.ruestung >= 0, e.id);
    }
  });

  it('haelt die Vorratsgroessen aus dem Konzept ein', () => {
    // 30 / 25 / 18 Kopien je Kostenstufe. Die Zahl steht auch im Konzept und
    // ist die Bremse, die das Sammeln ueberhaupt zu einem Wettbewerb macht.
    assert.deepEqual({ ...VORRAT_JE_KOSTEN }, { 1: 30, 2: 25, 3: 18 });
  });

  it('kennt nur Einheiten, die es gibt', () => {
    assert.ok(istEinheitId('dorfwache'));
    assert.ok(!istEinheitId('drachenlord'));
    assert.ok(!istEinheitId(7));
    assert.throws(() => einheit('gibtsnicht' as never));
  });
});

describe('Sternstufen', () => {
  it('skaliert Leben und Angriff nicht linear', () => {
    // Der Grund steht in STUFEN_FAKTOR: Waere es das Doppelte und Dreifache,
    // waere Verschmelzen ein Verlustgeschaeft.
    assert.equal(STUFEN_FAKTOR[1], 1);
    assert.ok(STUFEN_FAKTOR[2] > 1.5 && STUFEN_FAKTOR[2] < 2);
    assert.ok(STUFEN_FAKTOR[3] > 3);

    const eins = werteFuer('dorfwache', 1);
    const zwei = werteFuer('dorfwache', 2);
    const drei = werteFuer('dorfwache', 3);
    assert.equal(zwei.leben, Math.round(eins.leben * 1.8));
    assert.equal(drei.angriff, Math.round(eins.angriff * 3.2));
  });

  it('laesst Tempo, Reichweite und Ruestung unveraendert', () => {
    // Eine Wache, die auf Stufe 3 ploetzlich weit schoesse, waere eine andere
    // Einheit und keine staerkere.
    for (const e of KATALOG) {
      const drei = werteFuer(e.id, 3);
      assert.equal(drei.tempo, e.tempo, e.id);
      assert.equal(drei.reichweite, e.reichweite, e.id);
      assert.equal(drei.ruestung, e.ruestung, e.id);
    }
  });

  it('liefert nur ganze Zahlen fuer Leben und Angriff', () => {
    for (const e of KATALOG) {
      for (const stufe of [1, 2, 3] as const) {
        const w = werteFuer(e.id, stufe);
        assert.ok(Number.isInteger(w.leben), `${e.id} Stufe ${stufe}`);
        assert.ok(Number.isInteger(w.angriff), `${e.id} Stufe ${stufe}`);
      }
    }
  });

  it('rechnet Kartenzahl und Gesamtkosten passend zum Verschmelzen', () => {
    assert.deepEqual([kartenZahl(1), kartenZahl(2), kartenZahl(3)], [1, 3, 9]);
    // Eine Stufe-3-Dorfwache steckt voller neun Ein-Gold-Karten.
    assert.equal(gesamtkosten('dorfwache', 3), 9);
    assert.equal(gesamtkosten('sturmrufer', 2), 9);
  });
});

describe('Leveltabelle', () => {
  it('verteilt genau 100 Prozent auf die Kostenstufen', () => {
    // Ein Tippfehler hier erzeugt still einen Laden, der eine Stufe nie zeigt.
    for (const stufe of LEVEL_TABELLE) {
      const summe = stufe.chancen.reduce((a, b) => a + b, 0);
      assert.equal(summe, 100, `Level ${stufe.level} ergibt ${summe}`);
    }
  });

  it('gibt je Level genau einen Feldplatz mehr und passt aufs Brett', () => {
    LEVEL_TABELLE.forEach((stufe, i) => {
      assert.equal(stufe.level, i + 1);
      assert.equal(stufe.feldplaetze, i + 1);
    });
    assert.ok(
      LEVEL_TABELLE[MAX_LEVEL - 1]!.feldplaetze <= BRETT_FELDER,
      'Der hoechste Level darf nicht mehr Einheiten aufstellen, als das Brett fasst',
    );
  });

  it('macht jeden Aufstieg teurer als den vorigen und endet oben', () => {
    let vorher = 0;
    for (const stufe of LEVEL_TABELLE.slice(0, -1)) {
      assert.ok(stufe.aufstieg !== null, `Level ${stufe.level} ohne Aufstieg`);
      assert.ok(stufe.aufstieg! > vorher, `Level ${stufe.level} ist nicht teurer`);
      vorher = stufe.aufstieg!;
    }
    assert.equal(LEVEL_TABELLE[MAX_LEVEL - 1]!.aufstieg, null);
  });
});

describe('Hex-Brett', () => {
  it('hat sechs Nachbarn in der Mitte und weniger am Rand', () => {
    // Auf der eigenen Haelfte (2 Reihen) kann niemand sechs Nachbarn haben —
    // deshalb wird hier auf der spaeteren Arena (4 Reihen) geprueft.
    const mitte = 2 * 5 + 2; // Reihe 2, Spalte 2
    assert.equal(hexNachbarn(mitte, 4, 5).length, 6);
    assert.ok(hexNachbarn(0, 4, 5).length < 6);
  });

  it('ist symmetrisch: wer mein Nachbar ist, hat mich als Nachbarn', () => {
    // Der haeufigste Fehler am versetzten Raster: Die ungerade Reihe greift
    // in die falsche Richtung, und der Kampf laesst Einheiten aneinander
    // vorbeilaufen.
    for (let platz = 0; platz < 4 * 5; platz++) {
      for (const n of hexNachbarn(platz, 4, 5)) {
        assert.ok(
          hexNachbarn(n, 4, 5).includes(platz),
          `${platz} sieht ${n}, aber nicht umgekehrt`,
        );
      }
    }
  });

  it('verlaesst das Raster nie', () => {
    for (let platz = 0; platz < BRETT_FELDER; platz++) {
      for (const n of hexNachbarn(platz)) {
        assert.ok(n >= 0 && n < BRETT_FELDER, `${platz} -> ${n}`);
      }
    }
  });
});
