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
  arenaNachbarnFuer,
  gegenseite,
  gespiegelterPlatz,
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
  it('ist zwei Bretthaelften plus der Luecke hoch und genauso breit', () => {
    assert.equal(ARENA_REIHEN, BRETT_REIHEN * 2 + ARENA_LUECKE);
    assert.equal(ARENA_SPALTEN, BRETT_SPALTEN);
    assert.equal(ARENA_FELDER, ARENA_REIHEN * ARENA_SPALTEN);
    assert.equal(ARENA_FELDER, BRETT_FELDER * 2 + ARENA_LUECKE * ARENA_SPALTEN);
  });

  /**
   * Die Zahl, an der die Fairness haengt, als eigene Probe — damit sie beim
   * naechsten Drehen an der Geometrie nicht erst in "erhaelt alle Abstaende"
   * auffaellt, wo man sie fuer einen Rechenfehler halten koennte.
   *
   * Nur eine GERADE Reihenzahl macht die Punktspiegelung zu einer Drehung
   * (siehe Kopf von arena.ts). `ARENA_REIHEN` ist `BRETT_REIHEN * 2 +
   * ARENA_LUECKE`, also haengt alles an der Luecke: Eine Luecke von 1 waere
   * die kleinste denkbare — und die einzige Zahl in dieser Datei, die den
   * Kampf still unfair machen wuerde.
   */
  it('hat eine gerade Reihenzahl, sonst waere die Spiegelung keine Drehung', () => {
    assert.equal(ARENA_LUECKE % 2, 0, 'die Luecke muss gerade sein');
    assert.equal(ARENA_REIHEN % 2, 0);
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
    assert.equal(belegt.size, BRETT_FELDER * 2);

    // Was uebrig bleibt, sind genau die Reihen der Luecke — nicht irgendwelche
    // Felder verstreut ueber die Arena.
    const frei = ALLE.filter((platz) => !belegt.has(platz));
    assert.equal(frei.length, ARENA_LUECKE * ARENA_SPALTEN);
    for (const platz of frei) {
      const reihe = Math.floor(platz / ARENA_SPALTEN);
      assert.ok(
        reihe >= BRETT_REIHEN && reihe < BRETT_REIHEN + ARENA_LUECKE,
        `Platz ${platz} liegt in Reihe ${reihe} und nicht in der Luecke`,
      );
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

  /**
   * Der dritte Fall, den es vor der Luecke nicht gab: Eine Arenareihe gehoert
   * zu KEINER Seite. Waere `haelfteVon` dafuer bei "Seite 0" geblieben, haette
   * `vonArena` fuer die Mittelreihen einen negativen Brettplatz geliefert —
   * still, ohne zu werfen, und der Aufrufer haette ihn als Feld benutzt.
   */
  it('gibt fuer die leeren Reihen dazwischen keine Seite zurueck', () => {
    for (let reihe = BRETT_REIHEN; reihe < BRETT_REIHEN + ARENA_LUECKE; reihe++) {
      for (let spalte = 0; spalte < ARENA_SPALTEN; spalte++) {
        const platz = reihe * ARENA_SPALTEN + spalte;
        assert.equal(haelfteVon(platz), null, `Platz ${platz} in Reihe ${reihe}`);
        for (const seite of SEITEN) {
          assert.throws(() => vonArena(platz, seite), /gehoert nicht zu Seite/);
        }
      }
    }
  });

  it('wirft, wenn ein Arenaplatz nicht zur Haelfte dieser Seite gehoert', () => {
    const fremd = nachArena(0, 0);
    assert.throws(() => vonArena(fremd, 1), /gehoert nicht zu Seite 1/);
    assert.throws(() => vonArena(ARENA_FELDER, 0), /gibt es nicht/);
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

  it('legt die eigene Reihe 0 bei beiden Seiten an die Luecke', () => {
    /*
     * Reihe 0 ist die vorderste Reihe. Wer dort steht, hat den Gegner direkt
     * gegenueber — allerdings SPIEGELVERKEHRT: Die eigene linke Spalte trifft
     * auf die rechte des anderen, wie zwei Leute, die sich an einem Tisch
     * gegenuebersitzen.
     *
     * BIS ZUM 06.09.2026 STAND HIER 1 — Kopf an Kopf ueber die Mittellinie.
     * Genau das war der gemessene Grund, aus dem im Kampf kaum gelaufen wurde
     * (docs/TAFELRUNDE-LAUFWEGE.md): Jede Reichweite ab 2 stand vom ersten
     * Takt an im Ziel. Der Sollwert ist jetzt die Luecke plus eins, und diese
     * Zeile ist die Stelle, an der man es sieht.
     */
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

// ---------------------------------------------------------------------------
// Die Nachbarordnung je Seite
// ---------------------------------------------------------------------------

describe('Arena — die Nachbarordnung je Seite', () => {
  /**
   * Die Spiegelung ist eine Abbildung der Arena auf sich selbst: Sie trifft
   * jeden Platz genau einmal, und zweimal angewandt landet man wieder da, wo
   * man losgelaufen ist. Ohne das waere alles Weitere hier bedeutungslos.
   */
  it('spiegelt jeden Platz genau einmal und ist ihre eigene Umkehrung', () => {
    const getroffen = new Set(ALLE.map(gespiegelterPlatz));
    assert.equal(getroffen.size, ARENA_FELDER);
    for (const platz of ALLE) {
      assert.ok(istArenaplatz(gespiegelterPlatz(platz)));
      assert.equal(gespiegelterPlatz(gespiegelterPlatz(platz)), platz);
    }
  });

  /**
   * Sie ist DIESELBE Abbildung, mit der `nachArena` Seite 1 einlegt — sonst
   * spiegelte der Kampf um eine andere Achse als das Brett.
   */
  it('ist genau die Abbildung, mit der Seite 1 in die Arena kommt', () => {
    for (let platz = 0; platz < BRETT_FELDER; platz++) {
      assert.equal(nachArena(platz, 1), gespiegelterPlatz(nachArena(platz, 0)));
    }
  });

  /**
   * Die MENGE der Nachbarn haengt an keiner Seite — nur ihre Reihenfolge.
   * Waere auch die Menge verschieden, waere es kein Gleichstandsbruch mehr,
   * sondern ein zweites Brett.
   */
  it('liefert fuer beide Seiten dieselben Nachbarn, nur anders sortiert', () => {
    for (const platz of ALLE) {
      for (const seite of SEITEN) {
        assert.deepEqual(
          new Set(arenaNachbarnFuer(platz, seite)),
          new Set(arenaNachbarn(platz)),
          `Platz ${platz}, Seite ${seite}`,
        );
      }
    }
    assert.deepEqual(arenaNachbarnFuer(0, 0), arenaNachbarn(0));
  });

  /**
   * DIE PROBE, UM DIE ES GEHT: Die Ordnung ist unter der Punktspiegelung
   * invariant. Wer auf Seite 1 auf dem gespiegelten Platz steht, sieht seine
   * Nachbarn in der gespiegelten Reihenfolge derer, die Seite 0 auf dem
   * Urbild saehe.
   *
   * Daran haengt die Zusicherung im Kopf von arena.ts. Mit `arenaNachbarn`
   * (ohne Seite) faellt sie sofort: Die Spiegelung wechselt die Paritaet der
   * Reihe, und `hexNachbarn` sortiert gerade und ungerade Reihen
   * verschieden. Gemessen liefen deshalb 498 von 500 vertauschten
   * Aufstellungen auseinander — den ganzen Ablauf prueft
   * kampf.test.ts, "laeuft mit vertauschten Aufstellungen gespiegelt ab".
   *
   * Die Probe ist ausdruecklich nicht auf Seite 1 beschraenkt: Auch von Seite
   * 0 aus gesehen muss sie gelten, sonst haenge die Ordnung doch an einer
   * bevorzugten Seite.
   */
  it('haelt die Reihenfolge unter der Spiegelung fest', () => {
    for (const platz of ALLE) {
      for (const seite of SEITEN) {
        assert.deepEqual(
          arenaNachbarnFuer(gespiegelterPlatz(platz), gegenseite(seite)),
          arenaNachbarnFuer(platz, seite).map(gespiegelterPlatz),
          `Platz ${platz} von Seite ${seite} aus`,
        );
      }
    }
  });

  /**
   * Und die Gegenprobe, damit die Probe darueber nicht bloss zwei gleiche
   * Listen vergleicht: Die alte, seitenlose Ordnung erfuellt sie NICHT. Faende
   * sich hier kein einziger Platz, an dem die Reihenfolge auseinanderginge,
   * waere die ganze Aenderung ohne Gegenstand.
   */
  it('waere mit der seitenlosen Ordnung verletzt', () => {
    const abweichend = ALLE.filter((platz) => {
      const gedreht = arenaNachbarn(platz).map(gespiegelterPlatz);
      const direkt = arenaNachbarn(gespiegelterPlatz(platz));
      return gedreht.join(',') !== direkt.join(',');
    });
    assert.ok(abweichend.length > 0, 'die seitenlose Ordnung waere schon spiegeltreu');
  });
});
