import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filler } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import {
  type FillerPartie,
  LEERZUEGE_MAX,
  autoEndeVerteilung,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  gesperrteFarben,
  kante,
  leerzuegeGrenze,
  mauerSperre,
  moeglicheBarrieren,
  nachbarn,
  platzierungen,
  sieger,
  spiegelPlatz,
  startEcke,
  viertelBilder,
} from '../src/partie.js';
import { AUFBAU_JE_SPIELART, DEFAULT_REGELN, SITZE_JE_SPIELART } from '../src/regeln.js';
import { sichtFuer } from '../src/sicht.js';

/*
 * Extreme zu viert, jeder gegen jeden (Wunsch Niklas, 21.11.2026). Das
 * Brett bleibt 12 x 11, zu dritt gibt es nicht, freie Plaetze fuellen Bots.
 */

const EXTREME = { ...DEFAULT_REGELN, variante: 'extreme' } as const;
const SAAT = 'c0ffee1234567890abcdef0123456789';
const VIER = [0, 1, 2, 3] as const;

function vierer(saat: string | number = SAAT): FillerPartie {
  return filler.createParty({ config: EXTREME, seats: 4, rounds: 1, seed: 1, seedHex: typeof saat === 'string' ? saat : undefined } as never);
}

/** Eine Saatfolge wie in den Messwerkzeugen, damit viele Bretter geprueft werden. */
function saatHex(i: number): string {
  return (i * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(4);
}

describe('Zu viert: welche Tische es gibt', () => {
  it('Extreme nimmt zwei und vier Sitze, nie drei', () => {
    assert.deepEqual(filler.validateConfig(EXTREME, 2, 1), []);
    assert.deepEqual(filler.validateConfig(EXTREME, 4, 1), []);
    const drei = filler.validateConfig(EXTREME, 3, 1);
    assert.ok(drei.some((p) => p.path === 'seats'), 'drei Sitze sind unbalanciert');
  });

  it('die anderen Spielarten bleiben bei zwei', () => {
    for (const variante of ['nebel', 'klar', 'build'] as const) {
      const config = { ...DEFAULT_REGELN, variante };
      assert.deepEqual(filler.validateConfig(config, 2, 1), [], variante);
      assert.ok(
        filler.validateConfig(config, 4, 1).some((p) => p.path === 'seats'),
        `${variante} zu viert`,
      );
      assert.deepEqual(SITZE_JE_SPIELART[variante], [2]);
    }
  });

  it('ein Extreme-Tisch mit ausdruecklich sechs Farben bleibt ein Zweiertisch', () => {
    const alt = { ...EXTREME, farben: 6 };
    assert.deepEqual(filler.validateConfig(alt, 2, 1), []);
    assert.ok(filler.validateConfig(alt, 4, 1).some((p) => p.path === 'farben'));
  });

  /*
   * seatCounts verspricht: Die Vorgabe gilt auf jeder Zahl (game-api). Die
   * Vier steht darum in sitzeNurMitRegelsatz — sonst baute die Suche jede
   * Filler-Suche als Vierertisch, und plattform-invarianten.test.ts spielte
   * die Vorgabe (Nebel) zu viert durch, was validateConfig abweist.
   */
  it('die Meta bietet [2] an, die Vier nur mit Regelsatz — und die Vorgabe traegt genau die [2]', () => {
    assert.deepEqual(filler.meta.seatCounts, [2]);
    assert.deepEqual(filler.meta.sitzeNurMitRegelsatz, [4]);
    for (const sitze of filler.meta.seatCounts) {
      assert.deepEqual(filler.validateConfig(filler.defaultConfig(), sitze, 1), []);
    }
    assert.ok(filler.validateConfig(filler.defaultConfig(), 4, 1).some((p) => p.path === 'seats'));
    // Jede Zahl aus SITZE_JE_SPIELART ist an genau einer der beiden Stellen gemeldet.
    const gemeldet = [...filler.meta.seatCounts, ...(filler.meta.sitzeNurMitRegelsatz ?? [])].sort();
    const erlaubt = [...new Set(Object.values(SITZE_JE_SPIELART).flat())].sort();
    assert.deepEqual(gemeldet, erlaubt);
  });
});

describe('Zu viert: Aufbau', () => {
  it('vier Sitze in vier Ecken, jede mit eigener Farbe, auf 12 x 11', () => {
    const p = vierer();
    assert.equal(p.regeln.spalten, 12);
    assert.equal(p.regeln.zeilen, 11);
    assert.equal(p.regeln.farben, 7);
    const ecken = VIER.map((s) => startEcke(s, 12, 11));
    assert.deepEqual([...ecken].sort((a, b) => a - b), [0, 11, 120, 131]);
    for (const s of VIER) {
      assert.equal(p.besitzer[ecken[s]!], s);
      assert.equal(p.punkte[s], 1);
      assert.equal(p.farbe[s], p.feld[ecken[s]!]);
    }
    assert.equal(new Set(VIER.map((s) => p.farbe[s])).size, 4, 'vier verschiedene Startfarben');
    assert.equal(p.besitzer.filter((b) => b !== null).length, 4);
  });

  it('die Ecken sind dieselben vier Spiegelbilder', () => {
    assert.deepEqual(
      viertelBilder(startEcke(0, 12, 11), 12, 11).sort((a, b) => a - b),
      VIER.map((s) => startEcke(s, 12, 11)).sort((a, b) => a - b),
    );
  });

  it('kein Ausgleich zu viert: jeder bringt dieselben zwanzig Mauern mit', () => {
    const p = vierer();
    for (const s of VIER) assert.equal(p.barrierenUebrig[s], AUFBAU_JE_SPIELART.extreme.barrieren);
    assert.equal('barrierenZuschlagSitz1' in p.regeln, false);
    assert.equal('punkteZuschlagSitz1' in p.regeln, false);
    assert.equal(sichtFuer(p, 1).punkteZuschlagSitz1, 0);
    // Auch ein ausdruecklich mitgeschickter Zuschlag faellt weg.
    const mitZuschlag = erstellePartie(
      { ...EXTREME, barrierenZuschlagSitz1: 3, punkteZuschlagSitz1: 2 },
      VIER,
      SAAT,
    );
    for (const s of VIER) assert.equal(mitZuschlag.barrierenUebrig[s], 20);
    assert.equal(platzierungen(mitZuschlag).find((e) => e.seat === 1)?.points, 1);
  });

  it('zu zweit bleibt der Ausgleich, wie er war', () => {
    const p = erstellePartie(EXTREME, [0, 1], SAAT);
    assert.equal(p.barrierenUebrig[0], 20);
    assert.equal(p.barrierenUebrig[1], 22);
    assert.equal(p.regeln.mauerfreieZuege, 6);
  });

  it('die mauerfreie Eroeffnung sind drei Runden je Spieler, also zwoelf Zuege', () => {
    const p = vierer();
    assert.equal(p.regeln.mauerfreieZuege, 12);
    assert.equal(mauerSperre(p), 12);
  });

  it('die Leerzug-Grenze sind drei Runden: sechs zu zweit, zwoelf zu viert', () => {
    assert.equal(leerzuegeGrenze(2), LEERZUEGE_MAX);
    assert.equal(leerzuegeGrenze(4), 2 * LEERZUEGE_MAX);
  });

  it('Snapshot kommt unveraendert zurueck', () => {
    const p = vierer();
    const zurueck = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(p))));
    assert.deepEqual(zurueck, p);
  });
});

describe('Zu viert: Sterne', () => {
  const spiegelX = (p: number) => Math.floor(p / 12) * 12 + (11 - (p % 12));
  const spiegelY = (p: number) => (10 - Math.floor(p / 12)) * 12 + (p % 12);
  const abstand = (a: number, b: number) =>
    Math.abs((a % 12) - (b % 12)) + Math.abs(Math.floor(a / 12) - Math.floor(b / 12));

  it('acht Sterne, an beiden Mittelachsen gespiegelt — jede Ecke sieht dasselbe', () => {
    for (let i = 0; i < 200; i++) {
      const p = vierer(saatHex(i));
      const sterne = new Set(p.sterne);
      assert.equal(p.sterne.length, 8, `Saat ${i}`);
      assert.equal(sterne.size, 8, `Saat ${i}: keine doppelten`);
      for (const s of p.sterne) {
        assert.ok(sterne.has(spiegelX(s)), `Saat ${i}: ${s} links-rechts`);
        assert.ok(sterne.has(spiegelY(s)), `Saat ${i}: ${s} oben-unten`);
        assert.ok(sterne.has(spiegelPlatz(s, 12, 11)), `Saat ${i}: ${s} punkt`);
      }
    }
  });

  it('kein Stern auf oder neben einer Ecke, keine zwei naeher als drei', () => {
    const ecken = VIER.map((s) => startEcke(s, 12, 11));
    const verboten = new Set(ecken.flatMap((e) => [e, ...nachbarn(e, 12, 11)]));
    for (let i = 0; i < 200; i++) {
      const { sterne } = vierer(saatHex(i));
      for (const s of sterne) assert.ok(!verboten.has(s), `Saat ${i}: ${s} an einer Ecke`);
      for (let a = 0; a < sterne.length; a++) {
        for (let b = a + 1; b < sterne.length; b++) {
          assert.ok(abstand(sterne[a]!, sterne[b]!) >= 3, `Saat ${i}: ${sterne[a]} ${sterne[b]}`);
        }
      }
    }
  });

  it('jede Ecke hat dieselben Abstaende zu ihren Sternen', () => {
    for (let i = 0; i < 50; i++) {
      const { sterne } = vierer(saatHex(i));
      const profil = (s: number) =>
        sterne.map((st) => abstand(startEcke(s, 12, 11), st)).sort((a, b) => a - b).join(',');
      const erstes = profil(0);
      for (const s of VIER) assert.equal(profil(s), erstes, `Saat ${i}, Sitz ${s}`);
    }
  });
});

describe('Zu viert: Zugfolge und Farben', () => {
  it('reihum 0, 1, 2, 3, dann wieder 0', () => {
    let p = vierer();
    const folge: number[] = [];
    for (let i = 0; i < 9; i++) {
      folge.push(p.dran);
      assert.equal(filler.currentActor(p), p.dran);
      const zug = erlaubteZuege(p, p.dran).find((z) => z.typ === 'faerben');
      assert.ok(zug);
      p = fuehreAus(p, p.dran, zug);
    }
    assert.deepEqual(folge, [0, 1, 2, 3, 0, 1, 2, 3, 0]);
    assert.equal(p.zug, 9);
  });

  it('alle vier Gebietsfarben sind gesperrt, drei bleiben zur Wahl', () => {
    const p = vierer();
    const gesperrt = gesperrteFarben(p);
    assert.equal(new Set(gesperrt).size, 4);
    const farben = erlaubteZuege(p, 0).filter((z) => z.typ === 'faerben');
    assert.equal(farben.length, 3);
    for (const z of farben) assert.ok(z.typ === 'faerben' && !gesperrt.includes(z.farbe));
    // Die Farbe eines beliebigen Gegners ist verboten, nicht nur die des naechsten.
    assert.throws(() => fuehreAus(p, 0, { typ: 'faerben', farbe: p.farbe[3]! }), /gesperrt/);
    // Wer nicht dran ist, hat keine Zuege und darf nicht ziehen.
    assert.deepEqual(erlaubteZuege(p, 2), []);
    assert.throws(() => fuehreAus(p, 2, { typ: 'faerben', farbe: farben[0]!.typ === 'faerben' ? farben[0]!.farbe : 0 }), /Nicht am Zug/);
  });

  it('gemauert wird erst ab dem dreizehnten Zug, also der vierten eigenen Runde', () => {
    let p = vierer();
    while (mauerSperre(p) > 0) {
      for (const s of VIER) assert.deepEqual(moeglicheBarrieren(p, s), [], `Zug ${p.zug}`);
      p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
      if (p.fertig) return;
    }
    assert.equal(p.zug, 12);
    assert.equal(p.dran, 0);
    assert.ok(moeglicheBarrieren(p, 0).length > 0, 'ab jetzt darf gebaut werden');
  });
});

describe('Zu viert: Bot und Ende', () => {
  // Eine Partie: Zu viert auf 12 x 11 dauert sie gut zehn Sekunden.
  it('vier Bots spielen eine Partie zu Ende, jeder Zug ist erlaubt', () => {
    for (let i = 0; i < 1; i++) {
      let p = vierer(saatHex(1000 + i));
      let schritte = 0;
      while (!p.fertig) {
        assert.ok(++schritte < 800, `Saat ${i} endet nicht`);
        const sitz = filler.currentActor(p)!;
        const zug = filler.botAction!(filler.viewFor(p, sitz), { level: 'normal' } as never);
        p = filler.act(p, sitz, zug);
      }
      const reihe = filler.standings(p);
      assert.equal(reihe.length, 4);
      assert.deepEqual(reihe.map((e) => e.seat).sort(), [0, 1, 2, 3]);
      // Punkte absteigend, Plaetze passen dazu.
      for (let k = 1; k < reihe.length; k++) {
        assert.ok(reihe[k - 1]!.points >= reihe[k]!.points);
        assert.equal(reihe[k]!.place === reihe[k - 1]!.place, reihe[k]!.points === reihe[k - 1]!.points);
      }
      const erster = reihe[0]!;
      assert.equal(sieger(p), reihe[1]!.place === 1 ? null : erster.seat);
    }
  });

  it('Aufgeben beendet die Partie, wer aufgab, steht hinten', () => {
    const p = fuehreAus(vierer(), 2, { typ: 'aufgeben' });
    assert.ok(p.fertig);
    const reihe = platzierungen(p);
    assert.equal(reihe[3]!.seat, 2);
    assert.equal(reihe[3]!.place, 4);
    assert.equal(sieger(p), null, 'die anderen drei stehen bei je einem Punkt gleich');
  });

  /*
   * Das automatische Ende zu viert, auf einem 6 x 4-Brett (Platz = y * 6 + x),
   * Spielart Build (keine Sterne). Mauern teilen es in vier Viertel; nur die
   * Kante 6:12 zwischen oben links (Sitz 2) und unten links (Sitz 0) ist offen.
   *
   *     y0:   2  2  2 | .  .  1
   *     y1:   F  2  2 | .  .  .
   *           ─  ─  ─   ─  ─  ─      (6:12 offen)
   *     y2:   0  .  . | .  .  .
   *     y3:   0  .  . | .  .  3
   *
   * F (= 6) ist frei und das einzige Feld, das zwei Sitze erreichen (0 ueber
   * 12, 2 ueber 0 und 7). Holt Sitz 0 es, ist nichts mehr umkaempft: Jedes
   * Viertel geht an seinen Sitz.
   */
  it('greift, sobald kein Feld mehr zwischen zwei von vieren umkaempft ist', () => {
    const grund = erstellePartie(
      { ...DEFAULT_REGELN, variante: 'build', spalten: 6, zeilen: 4 },
      VIER,
      SAAT,
    );
    assert.deepEqual(
      VIER.map((s) => startEcke(s, 6, 4)),
      [18, 5, 0, 23],
    );
    const besitzer: (number | null)[] = new Array(24).fill(null);
    for (const pl of [0, 1, 2, 7, 8]) besitzer[pl] = 2;
    for (const pl of [12, 18]) besitzer[pl] = 0;
    besitzer[5] = 1;
    besitzer[23] = 3;
    const farbe = { 0: 0, 1: 1, 2: 2, 3: 3 };
    const feld = besitzer.map((b) => (b === null ? 5 : b));
    feld[6] = 4;
    const lage: FillerPartie = {
      ...grund,
      besitzer,
      feld,
      farbe,
      punkte: { 0: 2, 1: 1, 2: 5, 3: 1 },
      dran: 0,
      barrieren: [
        kante(2, 3), kante(8, 9), kante(14, 15), kante(20, 21),
        kante(7, 13), kante(8, 14), kante(9, 15), kante(10, 16), kante(11, 17),
      ],
    };
    assert.equal(autoEndeVerteilung(lage), null, 'F ist noch umkaempft');

    const danach = fuehreAus(lage, 0, { typ: 'faerben', farbe: 4 });
    assert.ok(danach.fertig);
    const verteilt = danach.autoEnde;
    assert.ok(verteilt);
    const an = (s: number) => verteilt.filter((f) => f.sitz === s).map((f) => f.platz).sort((a, b) => a - b);
    assert.deepEqual(an(0), [13, 14, 19, 20]);
    assert.deepEqual(an(1), [3, 4, 9, 10, 11]);
    assert.deepEqual(an(2), []);
    assert.deepEqual(an(3), [15, 16, 17, 21, 22]);
    assert.deepEqual(danach.punkte, { 0: 7, 1: 6, 2: 5, 3: 6 });
    assert.ok(danach.besitzer.every((b) => b !== null));
    assert.deepEqual(
      platzierungen(danach).map((e) => [e.seat, e.place]),
      [[0, 1], [1, 2], [3, 2], [2, 4]],
    );
    assert.equal(sieger(danach), 0);
  });
});
