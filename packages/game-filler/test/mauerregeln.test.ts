/**
 * Die vier Regeln vom 06.11.2026 (Wunsch Niklas, 05.11.2026):
 *
 *   1. Faire Startecken — keine zwei gleichfarbigen Nachbarn an einer Ecke
 *      (nur Extreme, Regelsatz `faireEcken`).
 *   2. Eine Mauer schliesst nie den letzten Weg (Build und Extreme).
 *   3. Eine Mauer nur an einer Kante mit mindestens einem freien Feld
 *      (Build und Extreme).
 *   4. Hoechstens zwei Mauern je Feld, der Rand zaehlt mit (nur Extreme,
 *      Regelsatz `mauernJeFeld`).
 *
 * Die Stellungen fuer 2 bis 4 sind auf einem 6 x 5-Brett nachgebaut:
 *
 *      0  1  2  3  4  5
 *      6  7  8  9 10 11
 *     12 13 14 15 16 17
 *     18 19 20 21 22 23
 *     24 25 26 27 28 29
 *
 * Sitz 0 sitzt unten links (24), Sitz 1 oben rechts (5).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filler } from '../src/adapter.js';
import {
  type FillerPartie,
  erlaubteZuege,
  erreichbareFreie,
  erstellePartie,
  fuehreAus,
  kante,
  mauernAmFeld,
  moeglicheBarrieren,
  nachbarn,
  startEcke,
  vonIrgendwemErreichbareFreie,
} from '../src/partie.js';
import { AUFBAU_JE_SPIELART, DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';

const SP = 6;
const ZE = 5;

/**
 * Eine Stellung auf dem 6 x 5-Brett, nach der Eroeffnung, Sitz `dran` am Zug.
 *
 * Freie Felder tragen das Muster (x + 2y) mod 5 — waagrechte Nachbarn
 * unterscheiden sich um 1, senkrechte um 2, also nie gleich. Die Gebiete
 * tragen die Farben 5 (Sitz 0) und 6 (Sitz 1), die im Muster nicht
 * vorkommen: So ist keine Farbe des Musters gesperrt.
 */
function stellung(
  variante: 'build' | 'extreme',
  besitz: { 0: number[]; 1: number[] },
  waende: readonly (readonly [number, number])[] = [],
  zusatz: { mauernJeFeld?: number } = {},
  dran = 0,
): FillerPartie {
  const regeln = { spalten: SP, zeilen: ZE, farben: 7, variante, barrieren: 10, ...zusatz };
  const basis = erstellePartie(regeln, [0, 1], 7);
  const feld = Array.from({ length: SP * ZE }, (_, p) => ((p % SP) + 2 * Math.floor(p / SP)) % 5);
  const besitzer: (number | null)[] = new Array(SP * ZE).fill(null);
  for (const sitz of [0, 1] as const) {
    for (const p of besitz[sitz]) {
      besitzer[p] = sitz;
      feld[p] = 5 + sitz;
    }
  }
  return {
    ...basis,
    feld,
    besitzer,
    farbe: { 0: 5, 1: 6 },
    punkte: { 0: besitz[0].length, 1: besitz[1].length },
    dran,
    zug: 10,
    sterne: [],
    barrieren: waende.map(([a, b]) => kante(a, b)),
    barrierenUebrig: { 0: 10, 1: 10 },
  };
}

const angeboten = (p: FillerPartie, sitz: number): Set<string> =>
  new Set(moeglicheBarrieren(p, sitz).map(([a, b]) => kante(a, b)));

// ---------------------------------------------------------------------------
// Regel 1: faire Startecken
// ---------------------------------------------------------------------------

describe('Regel 1: faire Startecken (Extreme)', () => {
  const EXTREME = { ...DEFAULT_REGELN, variante: 'extreme' } as const;
  /** Hexsaaten wie vom Server, fest und reproduzierbar. */
  const saaten = Array.from({ length: 400 }, (_, i) =>
    ((i * 2654435761) >>> 0).toString(16).padStart(8, '0').repeat(4),
  );

  const eckNachbarn = (p: FillerPartie, sitz: number): number[] => {
    const { spalten, zeilen } = p.regeln;
    return nachbarn(startEcke(sitz, spalten, zeilen), spalten, zeilen);
  };

  it('steht im Regelsatz einer neuen Extreme-Partie, nicht in Build', () => {
    assert.equal(erstellePartie(EXTREME, [0, 1], saaten[0]!).regeln.faireEcken, true);
    const build = erstellePartie({ ...DEFAULT_REGELN, variante: 'build' }, [0, 1], saaten[0]!);
    assert.equal(build.regeln.faireEcken, undefined);
  });

  it('gibt keiner Ecke zwei gleichfarbige Nachbarn, in 400 Saaten', () => {
    for (const saat of saaten) {
      const p = erstellePartie(EXTREME, [0, 1], saat);
      for (const sitz of [0, 1]) {
        const [a, b] = eckNachbarn(p, sitz);
        assert.notEqual(p.feld[a!], p.feld[b!], `Saat ${saat}, Sitz ${sitz}`);
      }
    }
  });

  it('haelt das Brett dabei frei von gleichfarbigen Nachbarn und die Ecken verschieden', () => {
    for (const saat of saaten) {
      const p = erstellePartie(EXTREME, [0, 1], saat);
      const { spalten, zeilen } = p.regeln;
      for (let platz = 0; platz < p.feld.length; platz++) {
        for (const n of nachbarn(platz, spalten, zeilen)) {
          assert.notEqual(p.feld[platz], p.feld[n], `Saat ${saat}: ${platz} und ${n} gleich`);
        }
      }
      assert.notEqual(p.farbe[0], p.farbe[1]);
    }
  });

  it('laesst den Anfaenger in Zug 1 und den Nachzieher nach JEDEM ersten Zug etwas holen', () => {
    for (const saat of saaten.slice(0, 150)) {
      const p = erstellePartie(EXTREME, [0, 1], saat);
      // Zug 1: Sitz 0 hat mindestens eine Farbe, die ihm ein Feld bringt.
      const bringt = (q: FillerPartie, sitz: number): boolean =>
        erlaubteZuege(q, sitz).some(
          (z) => z.typ === 'faerben' && (fuehreAus(q, sitz, z).punkte[sitz] ?? 0) > (q.punkte[sitz] ?? 0),
        );
      assert.ok(bringt(p, 0), `Saat ${saat}: Sitz 0 ohne nutzbare Farbe in Zug 1`);
      // Egal, was Sitz 0 waehlt: Sitz 1 hat danach eine nutzbare Farbe.
      for (const zug of erlaubteZuege(p, 0)) {
        if (zug.typ !== 'faerben') continue;
        assert.ok(bringt(fuehreAus(p, 0, zug), 1), `Saat ${saat}: Farbe ${zug.farbe} sperrt Sitz 1`);
      }
    }
  });

  it('ohne den Schalter bleibt das alte Brett — dort kommen gleiche Nachbarn vor', () => {
    // Ein Extreme-Tisch, dessen Aufbau-Tabelle `faireEcken` noch nicht kennt
    // (aufgemacht zwischen dem 05. und dem 06.11.2026).
    const { mauernJeFeld: _a, faireEcken: _b, ...alterAufbau } = AUFBAU_JE_SPIELART.extreme;
    void _a;
    void _b;
    const alt = { ...EXTREME, aufbauJeSpielart: { extreme: alterAufbau } };
    let gleich = 0;
    let anders = 0;
    for (const saat of saaten.slice(0, 100)) {
      const vorher = erstellePartie(alt, [0, 1], saat);
      const neu = erstellePartie(EXTREME, [0, 1], saat);
      assert.equal(vorher.regeln.faireEcken, undefined);
      const [a, b] = eckNachbarn(vorher, 1);
      const [c, d] = eckNachbarn(vorher, 0);
      if (vorher.feld[a!] === vorher.feld[b!] || vorher.feld[c!] === vorher.feld[d!]) {
        gleich++;
        // Umgefaerbt wird hoechstens je Ecke der senkrechte Nachbar.
        const unterschiede = vorher.feld.filter((f, i) => f !== neu.feld[i]).length;
        assert.ok(unterschiede <= 2, `Saat ${saat}: ${unterschiede} Felder anders`);
      } else {
        anders++;
        // Ohne Anlass bleibt das Brett Feld fuer Feld gleich.
        assert.deepEqual(neu.feld, vorher.feld, `Saat ${saat}`);
      }
    }
    assert.ok(gleich > 0, 'die alte Regel liess gleiche Nachbarn zu');
    assert.ok(anders > 0);
  });
});

// ---------------------------------------------------------------------------
// Regel 2: Eine Mauer schliesst nie den letzten Weg
// ---------------------------------------------------------------------------

describe('Regel 2: keine Mauer schliesst den letzten Weg', () => {
  it('IMG_1497: Sitz in zwei Spalten eingemauert — die letzte Mauer ist verboten', () => {
    // Spalte 0/1 ist zur Mitte hin zugemauert, offen nur noch oben (1|2).
    const p = stellung('build', { 0: [24], 1: [5] }, [
      [7, 8],
      [13, 14],
      [19, 20],
      [25, 26],
    ]);
    assert.ok(!angeboten(p, 1).has(kante(1, 2)), 'die Mauer 1|2 trennt Sitz 0 ab');
    assert.throws(() => fuehreAus(p, 1, { typ: 'barriere', von: 1, nach: 2 }));

    // Die alten Regeln haetten sie durchgelassen: Sitz 0 erreicht danach noch
    // Felder, und kein Feld ist fuer niemanden mehr erreichbar.
    const probe = new Set([...p.barrieren, kante(1, 2)]);
    assert.ok(erreichbareFreie(p, 0, probe) > 0);
    assert.equal(
      vonIrgendwemErreichbareFreie(p, probe),
      vonIrgendwemErreichbareFreie(p, new Set(p.barrieren)),
    );
    // Eine Mauer daneben, die nichts abtrennt, bleibt erlaubt.
    assert.ok(angeboten(p, 1).has(kante(0, 1)));
  });

  it('IMG_1500: Rest der Umrandung ist Koerper — die Mauer in den letzten Durchgang ist verboten', () => {
    // Sitz 1 haelt Zeile 0 ab Spalte 2 und Spalte 2 darunter, ausser Feld 14:
    // Der einzige Durchgang von links nach rechts ist 13 -> 14 -> 15.
    const p = stellung('build', { 0: [24], 1: [2, 3, 4, 5, 8, 20, 26] }, [], {}, 1);
    const moeglich = angeboten(p, 1);
    assert.ok(!moeglich.has(kante(13, 14)), '13|14 schliesst den letzten Durchgang');
    assert.ok(!moeglich.has(kante(14, 15)), '14|15 ebenso — Sitz 0 verloere alles rechts');
    assert.throws(() => fuehreAus(p, 1, { typ: 'barriere', von: 13, nach: 14 }));
    // Erlaubt bleibt, was nur einen Umweg macht.
    assert.ok(moeglich.has(kante(12, 13)));
  });

  it('IMG_1502 -> 1503: Mauer verengt, danach schliesst der Koerper — beides erlaubt', () => {
    // Wie oben, aber der Durchgang ist zwei Felder breit: 14 UND 20 sind frei.
    const p = stellung('build', { 0: [24], 1: [2, 3, 4, 5, 8, 26] }, [], {}, 1);
    assert.ok(angeboten(p, 1).has(kante(13, 14)), 'die Mauer laesst 19 -> 20 offen');
    const gemauert = fuehreAus(p, 1, { typ: 'barriere', von: 13, nach: 14 });
    assert.equal(gemauert.dran, 1, 'die Mauer beendet den Zug nicht');

    // Im selben Zug Feld 20 einnehmen: Es grenzt an 26 (Sitz 1).
    const vorher = erreichbareFreie(gemauert, 0, new Set(gemauert.barrieren));
    const farbe20 = gemauert.feld[20]!;
    const zu = fuehreAus(gemauert, 1, { typ: 'faerben', farbe: farbe20 });
    assert.equal(zu.besitzer[20], 1);
    const nachher = erreichbareFreie(zu, 0, new Set(zu.barrieren));
    assert.ok(nachher < vorher, 'Sitz 0 ist jetzt durch Koerper abgetrennt — und das ist erlaubt');
  });

  it('Gelb am rechten Rand: auch eine Tasche nur dem Gegner wegnehmen ist verboten', () => {
    // Feld 11 haengt an 5 (Sitz 1), an 10 (zugemauert) und an 17. Die Mauer
    // 11|17 liesse 11 nur noch Sitz 1 — fuer Sitz 0 ist der Weg zu.
    const p = stellung('build', { 0: [24], 1: [5] }, [[10, 11]]);
    assert.ok(!angeboten(p, 0).has(kante(11, 17)));
    // Die alte Einsperr- und Einmauer-Regel liessen sie zu: Beide erreichen
    // danach noch Felder, und 11 bleibt fuer Sitz 1 erreichbar.
    const probe = new Set([...p.barrieren, kante(11, 17)]);
    assert.ok(erreichbareFreie(p, 0, probe) > 0 && erreichbareFreie(p, 1, probe) > 0);
    assert.equal(
      vonIrgendwemErreichbareFreie(p, probe),
      vonIrgendwemErreichbareFreie(p, new Set(p.barrieren)),
    );
  });

  it('prueft die zweite Mauer eines Zuges gegen den Stand mit der ersten (Extreme)', () => {
    // Zwei Wege um Feld 14 herum; die erste Mauer schliesst einen, die zweite
    // duerfte den anderen nicht schliessen.
    const p = stellung('extreme', { 0: [24], 1: [2, 3, 4, 5, 8, 26] }, [], {}, 1);
    const erste = fuehreAus(p, 1, { typ: 'barriere', von: 13, nach: 14 });
    assert.ok(!angeboten(erste, 1).has(kante(19, 20)), '19|20 waere jetzt der letzte Weg');
    assert.ok(angeboten(p, 1).has(kante(19, 20)), 'ohne die erste Mauer war 19|20 erlaubt');
  });
});

// ---------------------------------------------------------------------------
// Regel 3: nur an einer Kante mit freiem Feld
// ---------------------------------------------------------------------------

describe('Regel 3: Mauer nur an einem freien Feld', () => {
  for (const variante of ['build', 'extreme'] as const) {
    it(`${variante}: nicht zwischen zwei besetzten Feldern (IMG_1498)`, () => {
      const p = stellung(variante, { 0: [24, 18, 25], 1: [5, 19] });
      const moeglich = angeboten(p, 0);
      assert.ok(!moeglich.has(kante(24, 25)), 'beide gehoeren Sitz 0');
      assert.ok(!moeglich.has(kante(18, 19)), 'Sitz 0 gegen Sitz 1');
      assert.throws(() => fuehreAus(p, 0, { typ: 'barriere', von: 18, nach: 19 }));
      // Zwischen eigenem und freiem Feld geht es.
      assert.ok(moeglich.has(kante(25, 26)));
    });
  }
});

// ---------------------------------------------------------------------------
// Regel 4: hoechstens zwei Mauern je Feld, der Rand zaehlt mit
// ---------------------------------------------------------------------------

describe('Regel 4: zwei Mauern je Feld, Rand zaehlt mit (nur Extreme)', () => {
  const MIT = { mauernJeFeld: 2 };

  it('zaehlt den Rand als Mauer', () => {
    const leer = new Set<string>();
    assert.equal(mauernAmFeld(0, SP, ZE, leer), 2, 'Ecke');
    assert.equal(mauernAmFeld(2, SP, ZE, leer), 1, 'Rand oben');
    assert.equal(mauernAmFeld(14, SP, ZE, leer), 0, 'innen');
    assert.equal(mauernAmFeld(14, SP, ZE, new Set([kante(8, 14), kante(14, 15)])), 2);
  });

  it('ein Eckfeld bekommt keine Mauer', () => {
    const p = stellung('extreme', { 0: [24], 1: [5] }, [], MIT);
    const moeglich = angeboten(p, 0);
    for (const k of [kante(0, 1), kante(0, 6), kante(28, 29), kante(23, 29)]) {
      assert.ok(!moeglich.has(k), `${k} liegt an einer Ecke`);
    }
    assert.throws(() => fuehreAus(p, 0, { typ: 'barriere', von: 0, nach: 1 }));
  });

  it('ein Randfeld hoechstens eine, ein inneres hoechstens zwei', () => {
    // Randfeld 2 hat schon 2|8: 1|2 und 2|3 gehen nicht mehr.
    const rand = angeboten(stellung('extreme', { 0: [24], 1: [5] }, [[2, 8]], MIT), 0);
    assert.ok(!rand.has(kante(1, 2)) && !rand.has(kante(2, 3)));
    // Ohne 2|8 gingen beide.
    const ohne = angeboten(stellung('extreme', { 0: [24], 1: [5] }, [], MIT), 0);
    assert.ok(ohne.has(kante(1, 2)) && ohne.has(kante(2, 3)));

    // Inneres Feld 15 mit 9|15 und 14|15: voll — 15|16 und 15|21 gehen nicht.
    const innen = angeboten(stellung('extreme', { 0: [24], 1: [5] }, [[9, 15], [14, 15]], MIT), 0);
    assert.ok(!innen.has(kante(15, 16)) && !innen.has(kante(15, 21)));
  });

  it('eine Mauer belegt bei BEIDEN Feldern einen Platz', () => {
    // 14|15 und 15|16 setzen 15 voll; 14 und 16 haben je einen Platz frei.
    // Mit 8|14 ist auch 14 voll: 13|14 ginge an 13 noch, an 14 nicht mehr.
    const p = stellung('extreme', { 0: [24], 1: [5] }, [[8, 14], [14, 15]], MIT);
    const moeglich = angeboten(p, 0);
    assert.ok(!moeglich.has(kante(13, 14)), '14 ist voll, obwohl 13 noch Platz hat');
    assert.ok(moeglich.has(kante(16, 22)), 'anderswo geht es weiter');
  });

  it('Build bleibt ohne diese Regel', () => {
    const p = stellung('build', { 0: [24], 1: [5] });
    assert.ok(angeboten(p, 0).has(kante(0, 1)), 'Build mauert auch an der Ecke');
    const build = erstellePartie({ ...DEFAULT_REGELN, variante: 'build' }, [0, 1], 3);
    assert.equal(build.regeln.mauernJeFeld, undefined);
  });

  it('ein Extreme-Tisch ohne die Zahl spielt ohne Grenze', () => {
    const p = stellung('extreme', { 0: [24], 1: [5] });
    assert.ok(angeboten(p, 0).has(kante(0, 1)));
  });

  it('steht im Regelsatz einer neuen Extreme-Partie und ueberlebt den Snapshot', () => {
    const p = erstellePartie({ ...DEFAULT_REGELN, variante: 'extreme' }, [0, 1], 'ab'.repeat(16));
    assert.equal(p.regeln.mauernJeFeld, 2);
    const zurueck = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(p))));
    assert.equal(zurueck.regeln.mauernJeFeld, 2);
    assert.equal(zurueck.regeln.faireEcken, true);
  });

  it('prueft die Zahl und den Schalter im Regelsatz', () => {
    const extreme = { ...DEFAULT_REGELN, variante: 'extreme' };
    assert.deepEqual(pruefeRegeln(extreme), []);
    assert.ok(pruefeRegeln({ ...extreme, mauernJeFeld: 5 }).some((x) => x.path === 'mauernJeFeld'));
    assert.ok(pruefeRegeln({ ...extreme, mauernJeFeld: 'zwei' }).length > 0);
    const kaputt = {
      ...extreme,
      aufbauJeSpielart: { extreme: { ...AUFBAU_JE_SPIELART.extreme, faireEcken: 'ja' } },
    };
    assert.ok(
      pruefeRegeln(kaputt).some((x) => x.path === 'aufbauJeSpielart.extreme.faireEcken'),
    );
    // Eine Tabelle von vor dem 06.11.2026 ohne beide Felder bleibt gueltig.
    const { mauernJeFeld: _a, faireEcken: _b, ...alt } = AUFBAU_JE_SPIELART.extreme;
    void _a;
    void _b;
    assert.deepEqual(pruefeRegeln({ ...extreme, aufbauJeSpielart: { extreme: alt } }), []);
  });
});
