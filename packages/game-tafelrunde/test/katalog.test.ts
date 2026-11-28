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
import { PREIS_JE_KOSTEN, erloes } from '../src/katalog.js';
import { FELD_HOECHSTENS, levelFuerRunde, levelstufe } from '../src/regeln.js';

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
    // Seit dem 28.11.2026 verschmelzen zwei (vorher drei): Stufe 2 steckt
    // voller zwei Karten, Stufe 3 voller vier (vorher 3 und 9).
    assert.deepEqual([kartenZahl(1), kartenZahl(2), kartenZahl(3)], [1, 2, 4]);
    // Seit dem 27.11.2026 ueber den PREIS und nicht mehr ueber die
    // Kostenstufe: Eine Stufe-3-Dorfwache steckt voller vier Karten zu je
    // 2 Gold, ein Stufe-2-Sturmrufer voller zwei zu je 4 Gold.
    assert.equal(gesamtkosten('dorfwache', 3), 8);
    assert.equal(gesamtkosten('sturmrufer', 2), 8);
  });

  /*
   * Robin, 27.11.2026: "Mindestpreis fuer Units ist 2". Die Kostenstufe
   * (`kosten`) bleibt 1 bis 3 und steuert weiter Rahmen, Ladenchancen und
   * Vorrat; was Gold kostet, steht in `preis`. Die Probe haelt beides
   * auseinander — wer `kosten` wieder als Goldbetrag liest, verbilligt jede
   * Einheit um einen Gold.
   */
  it('gibt jeder Einheit den Preis 2, 3 oder 4 nach ihrer Kostenstufe', () => {
    assert.deepEqual({ ...PREIS_JE_KOSTEN }, { 1: 2, 2: 3, 3: 4 });
    for (const e of KATALOG) {
      assert.equal(e.preis, e.kosten + 1, e.id);
      assert.equal(gesamtkosten(e.id, 1), e.preis, e.id);
    }
  });

  it('gibt beim Verkauf einer einfachen Einheit einen Gold weniger, bei verschmolzenen den vollen Preis', () => {
    // Der Abschlag nur auf Stufe 1: Er soll Kaufen-und-Verkaufen als Ersatz
    // fuers abgeschaffte Neuwuerfeln teuer machen, nicht das Aufraeumen nach
    // dem Verschmelzen.
    for (const e of KATALOG) {
      assert.equal(erloes(e.id, 1), e.preis - 1, e.id);
      assert.ok(erloes(e.id, 1) >= 1, `${e.id} bringt beim Verkauf nichts`);
      // Seit dem 28.11.2026 zwei bzw. vier Kopien je Stufe (vorher 3 und 9).
      assert.equal(erloes(e.id, 2), 2 * e.preis, e.id);
      assert.equal(erloes(e.id, 3), 4 * e.preis, e.id);
    }
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

  /*
   * Ersetzt am 27.11.2026 "macht jeden Aufstieg teurer als den vorigen": Den
   * Aufstieg kauft niemand mehr, die Spalte `aufstieg` liest kein Zug mehr.
   * Was jetzt zaehlt, ist die Rundenfolge: zwei Plaetze in Runde 1, einer
   * mehr je Runde, ab Runde 6 sieben — und jeder Level, den sie erreicht,
   * muss in der Tabelle stehen, sonst wirft `levelstufe` mitten in der
   * Partie.
   */
  it('fuehrt die Feldplaetze ueber die Runden von zwei bis sieben und bleibt in der Tabelle', () => {
    const folge = Array.from({ length: 10 }, (_, i) => levelFuerRunde(i + 1));
    assert.deepEqual(folge, [2, 3, 4, 5, 6, 7, 7, 7, 7, 7]);
    for (let runde = 1; runde <= 100; runde++) {
      const level = levelFuerRunde(runde);
      assert.equal(levelstufe(level).feldplaetze, level, `Runde ${runde}`);
      assert.ok(level <= FELD_HOECHSTENS && level <= MAX_LEVEL, `Runde ${runde}: Level ${level}`);
    }
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
