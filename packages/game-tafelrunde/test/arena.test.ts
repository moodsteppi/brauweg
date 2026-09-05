import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ARENA_FELDER,
  ARENA_LUECKE,
  ARENA_REIHEN,
  ARENA_SPALTEN,
  BRETT_FELDER,
  BRETT_REIHEN,
  BRETT_SPALTEN,
  type Seite,
  SEITEN,
  arenaAbstand,
  arenaNachbarn,
  gegenseite,
  haelfteVon,
  hexAbstand,
  hexNachbarn,
  istArenaplatz,
  nachArena,
  platzNummer,
  vonArena,
} from '../src/index.js';

/** Alle Arenaplaetze, von oben links nach unten rechts. */
const ALLE = Array.from({ length: ARENA_FELDER }, (_, i) => i);

/** Ein Brettplatz ueber Spalte und Reihe — lesbarer als eine Zahl. */
function brettplatz(spalte: number, reihe: number): number {
  return platzNummer(reihe, spalte);
}

describe('Abstand auf dem Sechseckraster', () => {
  it('ist null zu sich selbst und eins zu jedem Nachbarn', () => {
    for (let platz = 0; platz < BRETT_FELDER; platz++) {
      assert.equal(hexAbstand(platz, platz), 0);
      for (const n of hexNachbarn(platz)) assert.equal(hexAbstand(platz, n), 1, `${platz} zu ${n}`);
    }
  });

  it('ist symmetrisch und haelt die Dreiecksungleichung ein', () => {
    for (let a = 0; a < BRETT_FELDER; a++) {
      for (let b = 0; b < BRETT_FELDER; b++) {
        assert.equal(hexAbstand(a, b), hexAbstand(b, a));
        for (let c = 0; c < BRETT_FELDER; c++) {
          assert.ok(hexAbstand(a, c) <= hexAbstand(a, b) + hexAbstand(b, c));
        }
      }
    }
  });

  /**
   * Die Probe, die den versetzten Aufbau wirklich trifft: In einem naiv
   * gerechneten Raster waere der Abstand von Reihe 0 nach Reihe 1 in der
   * falschen Spalte um eins daneben.
   */
  it('zaehlt die Schritte, die man auch gehen muesste', () => {
    for (const platz of ALLE) {
      const gesehen = new Map<number, number>([[platz, 0]]);
      let rand = [platz];
      for (let schritt = 1; rand.length > 0; schritt++) {
        const naechster: number[] = [];
        for (const p of rand) {
          for (const n of arenaNachbarn(p)) {
            if (gesehen.has(n)) continue;
            gesehen.set(n, schritt);
            naechster.push(n);
          }
        }
        rand = naechster;
      }
      for (const [ziel, schritte] of gesehen) {
        assert.equal(arenaAbstand(platz, ziel), schritte, `${platz} nach ${ziel}`);
      }
    }
  });
});

describe('Arena — das Gitter', () => {
  it('ist zwei Bretthaelften hoch plus die Luecke, und genauso breit', () => {
    assert.equal(ARENA_REIHEN, BRETT_REIHEN * 2 + ARENA_LUECKE);
    assert.equal(ARENA_SPALTEN, BRETT_SPALTEN);
    assert.equal(ARENA_FELDER, ARENA_REIHEN * ARENA_SPALTEN);
    assert.equal(ARENA_FELDER, BRETT_FELDER * 2 + ARENA_LUECKE * ARENA_SPALTEN);
  });

  /**
   * Die Luecke muss GERADE sein, aus demselben Grund wie die Reihenzahl: Sie
   * verschiebt Seite 0 nach unten und geht damit in die Punktspiegelung ein.
   * Bei einer ungeraden Luecke waere die Abbildung um ein halbes Feld
   * verschoben, und die Probe "erhaelt alle Abstaende" faende es — aber erst,
   * nachdem jemand die Zahl geaendert hat. Hier steht der Grund dazu.
   */
  it('haelt die Luecke gerade — sonst kippt die Spiegelung', () => {
    assert.equal(ARENA_LUECKE % 2, 0);
    assert.equal(BRETT_REIHEN % 2, 0);
  });

  it('haelt Zahlen ausserhalb heraus', () => {
    for (const platz of ALLE) assert.ok(istArenaplatz(platz));
    for (const falsch of [-1, ARENA_FELDER, 1.5, '3', null, undefined, NaN]) {
      assert.equal(istArenaplatz(falsch), false, String(falsch));
    }
  });

  it('gibt nur Nachbarn zurueck, die in der Arena liegen und einen Schritt weit weg sind', () => {
    for (const platz of ALLE) {
      const nachbarn = arenaNachbarn(platz);
      assert.ok(nachbarn.length >= 2 && nachbarn.length <= 6, `${platz} hat ${nachbarn.length}`);
      for (const n of nachbarn) {
        assert.ok(istArenaplatz(n));
        assert.equal(arenaAbstand(platz, n), 1);
      }
      assert.equal(new Set(nachbarn).size, nachbarn.length);
    }
  });
});

describe('Arena — die Bretter hineinlegen', () => {
  it('legt beide Bretter ueberschneidungsfrei in die Arena und laesst genau die Luecke frei', () => {
    const belegt = new Set<number>();
    for (const seite of SEITEN) {
      for (let platz = 0; platz < BRETT_FELDER; platz++) {
        const arena = nachArena(platz, seite);
        assert.ok(istArenaplatz(arena), `Seite ${seite}: ${platz} landet ausserhalb`);
        assert.ok(!belegt.has(arena), `Seite ${seite}: ${arena} ist doppelt belegt`);
        belegt.add(arena);
      }
    }
    // Nicht mehr lueckenlos: Seit dem 06.09.2026 bleiben `ARENA_LUECKE` Reihen
    // leer. Dass es GENAU die sind, prueft der Rest — sonst waere ein
    // Rechenfehler, der eine Haelfte um eine Reihe verschiebt, hier unsichtbar.
    assert.equal(belegt.size, BRETT_FELDER * 2);
    assert.equal(ARENA_FELDER - belegt.size, ARENA_LUECKE * ARENA_SPALTEN);
    for (let platz = 0; platz < ARENA_FELDER; platz++) {
      assert.equal(belegt.has(platz), haelfteVon(platz) !== null, `Arenaplatz ${platz}`);
    }
  });

  it('findet zu jedem Arenaplatz wieder den Brettplatz', () => {
    for (const seite of SEITEN) {
      for (let platz = 0; platz < BRETT_FELDER; platz++) {
        assert.equal(vonArena(nachArena(platz, seite), seite), platz);
      }
    }
  });

  it('weist jeden Arenaplatz genau der Seite zu, von der er stammt', () => {
    for (const seite of SEITEN) {
      for (let platz = 0; platz < BRETT_FELDER; platz++) {
        assert.equal(haelfteVon(nachArena(platz, seite)), seite);
      }
    }
  });

  it('wirft, wenn ein Arenaplatz nicht zur Haelfte dieser Seite gehoert', () => {
    const fremd = nachArena(0, 0);
    assert.throws(() => vonArena(fremd, 1), /gehoert nicht zu Seite 1/);
    assert.throws(() => vonArena(ARENA_FELDER, 0), /gibt es nicht/);
  });

  /**
   * Der dritte Fall, den die Luecke gebracht hat: Die mittleren Reihen gehoeren
   * KEINER Seite. Ohne diese Probe waere der naheliegende Fehler — `null` still
   * zu Seite 0 zu runden — von aussen nicht zu sehen, weil im Kampf niemand
   * dort startet. Die Anzeige zeichnet die Reihen aber.
   */
  it('gibt fuer die leeren Reihen zwischen den Haelften keine Seite zurueck', () => {
    for (let reihe = BRETT_REIHEN; reihe < BRETT_REIHEN + ARENA_LUECKE; reihe++) {
      for (let spalte = 0; spalte < ARENA_SPALTEN; spalte++) {
        const platz = reihe * ARENA_SPALTEN + spalte;
        assert.equal(haelfteVon(platz), null, `Arenaplatz ${platz}`);
        for (const seite of SEITEN) {
          assert.throws(() => vonArena(platz, seite), /gehoert nicht zu Seite/);
        }
      }
    }
    // Und kein Brettplatz landet je in der Luecke.
    for (const seite of SEITEN) {
      for (let platz = 0; platz < BRETT_FELDER; platz++) {
        assert.notEqual(haelfteVon(nachArena(platz, seite)), null);
      }
    }
  });

  /**
   * Die Zusicherung, auf der die Fairness steht: Beide Seiten werden
   * abstandstreu eingelegt. Waere das nicht so, haette dieselbe Aufstellung je
   * nach Seite eine andere Reichweite — und der Kampf waere nicht fair,
   * sondern nur deterministisch falsch.
   *
   * Diese Probe faellt sofort, wenn jemand `BRETT_REIHEN` auf eine ungerade
   * Zahl stellt: Dann ist die Punktspiegelung keine Drehung mehr, sondern eine
   * um ein halbes Feld verschobene Abbildung (siehe Kopf von arena.ts).
   */
  it('erhaelt alle Abstaende — fuer beide Seiten', () => {
    for (const seite of SEITEN) {
      for (let a = 0; a < BRETT_FELDER; a++) {
        for (let b = 0; b < BRETT_FELDER; b++) {
          assert.equal(
            arenaAbstand(nachArena(a, seite), nachArena(b, seite)),
            hexAbstand(a, b),
            `Seite ${seite}: ${a} zu ${b}`,
          );
        }
      }
    }
  });

  /**
   * Und die Gegenprobe zur Fairness: Die beiden Haelften stehen einander
   * gespiegelt gegenueber. Zwei Einheiten auf demselben eigenen Feld sind
   * voneinander gleich weit entfernt wie ihr vertauschtes Gegenstueck.
   */
  it('spiegelt die Seiten: vertauschte Aufstellungen haben dieselben Abstaende', () => {
    for (let a = 0; a < BRETT_FELDER; a++) {
      for (let b = 0; b < BRETT_FELDER; b++) {
        assert.equal(
          arenaAbstand(nachArena(a, 0), nachArena(b, 1)),
          arenaAbstand(nachArena(b, 0), nachArena(a, 1)),
          `${a} gegen ${b}`,
        );
      }
    }
  });

  it('legt die eigene Reihe 0 bei beiden Seiten an die Mittellinie', () => {
    // Reihe 0 ist die vorderste Reihe. Wer dort steht, hat den Gegner direkt
    // gegenueber — allerdings SPIEGELVERKEHRT: Die eigene linke Spalte trifft
    // auf die rechte des anderen, wie zwei Leute, die sich an einem Tisch
    // gegenuebersitzen.
    //
    // BIS ZUM 06.09.2026 STAND HIER EINE 1 — "Kopf an Kopf". Genau das war der
    // gemessene Befund (docs/TAFELRUNDE-LAUFWEGE.md): Die Fronten begannen in
    // Kontakt, und alles dahinter stand vom ersten Takt an in Reichweite. Mit
    // der Luecke ist der kleinste Startabstand `ARENA_LUECKE + 1`, also 3, und
    // das ist mehr als die groesste Reichweite des Katalogs bis auf eine.
    const kopfAnKopf = ARENA_LUECKE + 1;
    for (let spalte = 0; spalte < BRETT_SPALTEN; spalte++) {
      const vorn0 = nachArena(brettplatz(spalte, 0), 0);
      const vorn1 = nachArena(brettplatz(BRETT_SPALTEN - 1 - spalte, 0), 1);
      assert.equal(
        arenaAbstand(vorn0, vorn1),
        kopfAnKopf,
        `Spalte ${spalte} steht nicht ${kopfAnKopf} Felder auseinander`,
      );
    }
    // Die eigene hinterste Reihe steht entsprechend quer durch die ganze Arena.
    const hinten0 = nachArena(brettplatz(0, BRETT_REIHEN - 1), 0);
    const hinten1 = nachArena(brettplatz(BRETT_SPALTEN - 1, BRETT_REIHEN - 1), 1);
    assert.equal(arenaAbstand(hinten0, hinten1), ARENA_REIHEN - 1);
  });
});

describe('Arena — Seiten', () => {
  it('kennt genau zwei Seiten, und jede hat eine Gegenseite', () => {
    assert.deepEqual([...SEITEN], [0, 1]);
    for (const seite of SEITEN) {
      assert.notEqual(gegenseite(seite), seite);
      assert.equal(gegenseite(gegenseite(seite)), seite);
    }
  });

  it('nimmt jede Seite auch als Zahl entgegen', () => {
    const seite: Seite = 1;
    assert.equal(gegenseite(seite), 0);
  });
});
