/**
 * Extreme auf dem grossen Brett (Wunsch Niklas, 05.11.2026): 12 x 11,
 * zwanzig Mauern, bis zu zwei je Zug mit Pause danach, acht Sterne als
 * punktgespiegelte Paare.
 *
 * Geprueft wird ausserdem, was sich NICHT aendern darf: Nebel, Klar und Build
 * bauen aus derselben Saat dasselbe Brett und spielen mit dem Bot dieselbe
 * Partie wie vor der Aenderung — gemessen an Fingerabdruecken, die mit dem
 * Stand 75dff13 erzeugt wurden.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { filler } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import {
  type FillerAktion,
  type FillerPartie,
  erlaubteZuege,
  mauerSperre,
  erstellePartie,
  fuehreAus,
  kante,
  moeglicheBarrieren,
  nachbarn,
  spiegelPlatz,
  startEcke,
  erreichbareFreie,
  vonIrgendwemErreichbareFreie,
} from '../src/partie.js';
import { AUFBAU_JE_SPIELART, DEFAULT_REGELN, pruefeRegeln } from '../src/regeln.js';
import { sichtFuer } from '../src/sicht.js';

/** Wie der Bildschirm einen Extreme-Tisch aufmacht: Vorgabe plus Spielart. */
const EXTREME = { ...DEFAULT_REGELN, variante: 'extreme' } as const;
const SAAT = 'c0ffee1234567890abcdef0123456789';

/** Die Faerbe-Zuege, die gerade gehen. */
function farbzug(partie: FillerPartie): { typ: 'faerben'; farbe: number } {
  const zug = erlaubteZuege(partie, partie.dran).find((z) => z.typ === 'faerben');
  assert.ok(zug && zug.typ === 'faerben');
  return zug;
}

/** Eine Extreme-Partie, an der die Eroeffnung vorbei ist (Mauern frei). */
function nachEroeffnung(saat: string | number = SAAT): FillerPartie {
  let p = erstellePartie(EXTREME, [0, 1], saat);
  while (mauerSperre(p) > 0) p = fuehreAus(p, p.dran, farbzug(p));
  return p;
}

function mauer(partie: FillerPartie, sitz: number, nr = 0): FillerPartie {
  const ziel = moeglicheBarrieren(partie, sitz)[nr];
  assert.ok(ziel, 'es gibt eine erlaubte Mauer');
  return fuehreAus(partie, sitz, { typ: 'barriere', von: ziel[0], nach: ziel[1] });
}

describe('Extreme gross: Aufbau', () => {
  it('spielt auf 12 x 11 mit zwanzig Mauern je Spieler', () => {
    assert.deepEqual(filler.validateConfig(EXTREME, 2, 1), []);
    const partie = filler.createParty({ config: EXTREME, seats: 2, seed: 7, seedHex: SAAT } as never);
    assert.equal(partie.regeln.spalten, 12);
    assert.equal(partie.regeln.zeilen, 11);
    assert.equal(partie.feld.length, 132);
    assert.equal(partie.barrierenUebrig[0], 20);
    assert.equal(partie.barrierenUebrig[1], 20);
    assert.equal(partie.regeln.mauernJeZug, 2);
    // Die Tabelle steht nicht im Snapshot, nur das, was sie festgelegt hat.
    assert.equal('aufbauJeSpielart' in partie.regeln, false);
    const sicht = sichtFuer(partie, 0);
    assert.equal(sicht.spalten, 12);
    assert.equal(sicht.zeilen, 11);
    assert.equal(sicht.mauernJeZug, 2);
    assert.equal(sicht.mauernDiesenZug, 0);
    assert.deepEqual([...sicht.mauerPause], []);
  });

  it('legt acht Sterne als vier Spiegelpaare, fern der Ecken und mit Abstand drei', () => {
    const schritte = (a: number, b: number): number =>
      Math.abs((a % 12) - (b % 12)) + Math.abs(Math.floor(a / 12) - Math.floor(b / 12));
    const tabu = new Set<number>();
    for (const sitz of [0, 1]) {
      const ecke = startEcke(sitz, 12, 11);
      tabu.add(ecke);
      for (const n of nachbarn(ecke, 12, 11)) tabu.add(n);
    }
    for (let saat = 0; saat < 300; saat++) {
      const { sterne } = erstellePartie(EXTREME, [0, 1], saat);
      assert.equal(sterne.length, 8, `Saat ${saat}`);
      assert.equal(new Set(sterne).size, 8);
      for (const s of sterne) {
        assert.ok(sterne.includes(131 - s), `Saat ${saat}: ${s} ohne Gegenstueck`);
        assert.equal(spiegelPlatz(s, 12, 11), 131 - s);
        assert.ok(!tabu.has(s), `Saat ${saat}: Stern ${s} an einer Ecke`);
        for (const t of sterne) {
          if (s !== t) assert.ok(schritte(s, t) >= 3, `Saat ${saat}: ${s} und ${t} zu nah`);
        }
      }
    }
  });

  it('gibt beiden Sitzen dieselben Wege zu den Sternen', () => {
    const partie = erstellePartie(EXTREME, [0, 1], SAAT);
    const weg = (sitz: number, s: number): number => {
      const ecke = startEcke(sitz, 12, 11);
      return Math.abs((ecke % 12) - (s % 12)) + Math.abs(Math.floor(ecke / 12) - Math.floor(s / 12));
    };
    const fuer0 = partie.sterne.map((s) => weg(0, s)).sort((a, b) => a - b);
    const fuer1 = partie.sterne.map((s) => weg(1, s)).sort((a, b) => a - b);
    assert.deepEqual(fuer0, fuer1);
  });

  it('weist eine dritte Mauer je Zug in der Tabelle ab', () => {
    const kaputt = {
      ...EXTREME,
      aufbauJeSpielart: { extreme: { ...AUFBAU_JE_SPIELART.extreme, mauernJeZug: 3 } },
    };
    assert.deepEqual(
      pruefeRegeln(kaputt).map((p) => p.path),
      ['aufbauJeSpielart.extreme.mauernJeZug'],
    );
  });
});

describe('Extreme gross: zwei Mauern je Zug', () => {
  it('erlaubt eine zweite Mauer im selben Zug, aber keine dritte', () => {
    const p0 = nachEroeffnung();
    const sitz = p0.dran;
    const eine = mauer(p0, sitz);
    assert.equal(eine.dran, sitz, 'die Mauer gibt nicht ab');
    assert.equal(eine.mauernDiesenZug, 1);
    assert.equal(sichtFuer(eine, sitz).mauernDiesenZug, 1);
    assert.ok((sichtFuer(eine, sitz).barrierenMoeglich?.length ?? 0) > 0, 'die zweite wird angeboten');

    const zwei = mauer(eine, sitz);
    assert.equal(zwei.mauernDiesenZug, 2);
    assert.equal(zwei.barrieren.length, 2);
    assert.equal(zwei.barrierenUebrig[sitz], 18);
    assert.deepEqual(moeglicheBarrieren(zwei, sitz), []);
    assert.equal(sichtFuer(zwei, sitz).barrierenMoeglich, undefined);
    const irgendeine = moeglicheBarrieren(eine, sitz).find(
      ([a, b]) => !zwei.barrieren.includes(kante(a, b)),
    )!;
    assert.throws(
      () => fuehreAus(zwei, sitz, { typ: 'barriere', von: irgendeine[0], nach: irgendeine[1] }),
      /nicht erlaubt/,
    );
  });

  it('sperrt nach zwei Mauern das Bauen im naechsten eigenen Zug, danach wieder frei', () => {
    const p0 = nachEroeffnung();
    const ich = p0.dran;
    const gegner = 1 - ich;
    const gefaerbt = fuehreAus(mauer(mauer(p0, ich), ich), ich, farbzug(mauer(mauer(p0, ich), ich)));
    assert.deepEqual([...gefaerbt.mauerPause], [ich]);
    assert.equal(gefaerbt.mauernDiesenZug, 0);

    // Der Gegner ist nicht betroffen: Er darf bauen.
    assert.equal(gefaerbt.dran, gegner);
    assert.ok(moeglicheBarrieren(gefaerbt, gegner).length > 0);
    assert.deepEqual([...sichtFuer(gefaerbt, gegner).mauerPause], [ich]);
    const zurueck = fuehreAus(gefaerbt, gegner, farbzug(gefaerbt));

    // Mein naechster Zug: nur faerben.
    assert.equal(zurueck.dran, ich);
    assert.deepEqual(moeglicheBarrieren(zurueck, ich), []);
    assert.ok(erlaubteZuege(zurueck, ich).every((z) => z.typ === 'faerben'));
    const sicht = sichtFuer(zurueck, ich);
    assert.equal(sicht.barrierenMoeglich, undefined);
    assert.deepEqual([...sicht.mauerPause], [ich]);
    const frei = moeglicheBarrieren(gefaerbt, gegner)[0]!;
    assert.throws(() => fuehreAus(zurueck, ich, { typ: 'barriere', von: frei[0], nach: frei[1] }));

    // Abgesessen: Nach dem Faerben faellt die Pause, und im uebernaechsten
    // Zug darf wieder gebaut werden.
    const abgesessen = fuehreAus(zurueck, ich, farbzug(zurueck));
    assert.deepEqual([...abgesessen.mauerPause], []);
    const wieder = fuehreAus(abgesessen, gegner, farbzug(abgesessen));
    assert.ok(moeglicheBarrieren(wieder, ich).length > 0);
  });

  it('Gegenprobe: eine Mauer allein bringt keine Pause', () => {
    const p0 = nachEroeffnung();
    const ich = p0.dran;
    const eine = mauer(p0, ich);
    const gefaerbt = fuehreAus(eine, ich, farbzug(eine));
    assert.deepEqual([...gefaerbt.mauerPause], []);
    const zurueck = fuehreAus(gefaerbt, 1 - ich, farbzug(gefaerbt));
    assert.ok(moeglicheBarrieren(zurueck, ich).length > 0);
  });

  it('prueft Einmauer- und Einsperr-Regel fuer die zweite Mauer gegen den Stand mit der ersten', () => {
    const p0 = nachEroeffnung();
    const ich = p0.dran;
    const eine = mauer(p0, ich);
    const sperren = new Set(eine.barrieren);
    const vorher = vonIrgendwemErreichbareFreie(eine, sperren);
    for (const [a, b] of moeglicheBarrieren(eine, ich)) {
      const probe = new Set(sperren).add(kante(a, b));
      assert.equal(vonIrgendwemErreichbareFreie(eine, probe), vorher, `${a}:${b} mauert ein`);
      for (const s of [0, 1]) {
        if (erreichbareFreie(eine, s, sperren) > 0) {
          assert.ok(erreichbareFreie(eine, s, probe) > 0, `${a}:${b} sperrt Sitz ${s} ein`);
        }
      }
    }
  });
});

describe('Extreme gross: Bot', () => {
  it('zieht eine ganze Partie lang nur erlaubt, auch mit Doppelmauern und Pause', () => {
    let doppel = 0;
    let pausiert = 0;
    /*
     * Bis zum 06.11.2026 baute der Bot auf Saat 12 eine Doppelmauer. Seit eine
     * Mauer nie den letzten Weg schliessen darf, findet er keine Wand mehr
     * ueber seiner Schwelle (seine Wandrechnung lebt vom Abschneiden). Damit
     * Doppelmauer und Pause trotzdem eine ganze Partie lang durchlaufen,
     * mauert in jedem Zug zuerst ein Baumeister, solange das Modul etwas
     * anbietet — immer die erste angebotene Kante —, und erst dann zieht der
     * Bot. Geprueft wird dabei jeder Zug gegen `legalActions`.
     */
    for (const saat of [SAAT, 12]) {
      let p = erstellePartie(EXTREME, [0, 1], saat);
      let n = 0;
      while (!p.fertig && n++ < 600) {
        const sitz = p.dran;
        const angebot = moeglicheBarrieren(p, sitz);
        const zug: FillerAktion =
          angebot.length > 0
            ? { typ: 'barriere', von: angebot[0]![0], nach: angebot[0]![1] }
            : botZug(sichtFuer(p, sitz));
        const erlaubt = filler.legalActions(p, sitz);
        assert.ok(
          erlaubt.some((z) => JSON.stringify(z) === JSON.stringify(zug)) ||
            (zug.typ === 'barriere' &&
              erlaubt.some(
                (z) => z.typ === 'barriere' && kante(z.von, z.nach) === kante(zug.von, zug.nach),
              )),
          `Saat ${saat}, Zug ${p.zug}: ${JSON.stringify(zug)} ist nicht erlaubt`,
        );
        if (zug.typ === 'barriere' && p.mauernDiesenZug === 1) doppel++;
        if (p.mauerPause.includes(sitz)) {
          pausiert++;
          assert.equal(zug.typ, 'faerben', `Saat ${saat}: Bot mauert in der Pause`);
        }
        p = fuehreAus(p, sitz, zug);
      }
      assert.ok(p.fertig, `Saat ${saat}: Partie endet`);
    }
    assert.ok(doppel >= 1, 'die Probe beruehrt die Doppelmauer');
    assert.ok(pausiert >= 1, 'die Probe beruehrt die Pause');
  });

  it('faerbt in der Pause, auch wenn er noch Mauern hat', () => {
    const p0 = nachEroeffnung();
    const ich = p0.dran;
    const zwei = mauer(mauer(p0, ich), ich);
    const gefaerbt = fuehreAus(zwei, ich, farbzug(zwei));
    const zurueck = fuehreAus(gefaerbt, 1 - ich, farbzug(gefaerbt));
    assert.ok(zurueck.barrierenUebrig[ich]! > 0);
    assert.equal(botZug(sichtFuer(zurueck, ich)).typ, 'faerben');
  });
});

describe('Extreme gross: alte Tische', () => {
  it('ein Extreme-Tisch ohne Aufbau-Tabelle bleibt bei 8 x 7, drei Sternen, einer Mauer je Zug', () => {
    const { aufbauJeSpielart: _weg, ...damals } = EXTREME;
    void _weg;
    let p = erstellePartie(damals, [0, 1], SAAT);
    assert.equal(p.regeln.spalten, 8);
    assert.equal(p.regeln.zeilen, 7);
    assert.equal(p.sterne.length, 3);
    assert.equal(p.barrierenUebrig[0], 10);
    assert.equal(sichtFuer(p, 0).mauernJeZug, 1);
    while (p.zug < 3) p = fuehreAus(p, p.dran, farbzug(p));
    const eine = mauer(p, p.dran);
    assert.deepEqual(moeglicheBarrieren(eine, eine.dran), []);
  });

  it('liest einen Snapshot der Fassung 5 mit halbem Zug: Ja wird eine Mauer, keine Pause', () => {
    const { aufbauJeSpielart: _weg, ...damals } = EXTREME;
    void _weg;
    let p = erstellePartie(damals, [0, 1], SAAT);
    while (p.zug < 3) p = fuehreAus(p, p.dran, farbzug(p));
    const eine = mauer(p, p.dran);
    const { mauernDiesenZug: _z, mauerPause: _p, ...rest } = eine;
    void _z;
    void _p;
    const alt = JSON.parse(JSON.stringify({ v: 5, ...rest, mauerDiesenZug: true }));
    const geladen = filler.deserialize(alt);
    assert.equal(geladen.mauernDiesenZug, 1);
    assert.deepEqual([...geladen.mauerPause], []);
    assert.equal('mauerDiesenZug' in geladen, false);
    assert.deepEqual(moeglicheBarrieren(geladen, geladen.dran), []);
    assert.deepEqual(filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(eine)))), eine);
  });
});

describe('Andere Spielarten unveraendert', () => {
  /*
   * Fingerabdruecke (sha256, 16 Zeichen) des Anfangszustands und des
   * Endstands einer reinen Bot-Partie, erzeugt mit dem Stand 75dff13 — vor
   * dem grossen Extreme-Brett. Gleiche Saat muss dasselbe Brett, dieselben
   * Regeln und dieselbe Partie ergeben.
   *
   * Ausnahme seit dem 06.11.2026: der ENDSTAND in Build. Die Mauerregeln
   * "nur an einem freien Feld" und "nie den letzten Weg schliessen" gelten
   * auch dort, und mit ihnen setzt der Bot keine Mauer mehr. Das Brett (der
   * erste Abdruck) ist unveraendert, die Partie eine andere.
   */
  const VORHER: Record<string, readonly [string, string]> = {
    'nebel/c0ffee1234567890abcdef0123456789': ['b99a18adf10e9de9', '98e749e08f84d18f'],
    'nebel/1': ['eeedc71a3248a231', 'ac0da056946f5b48'],
    'nebel/2': ['680061190f22f502', '6e352359a28deba3'],
    'nebel/42': ['0bd75121dd43d5c2', 'de070f42a48dd38c'],
    'klar/c0ffee1234567890abcdef0123456789': ['3b8468d928997ec9', '76e4bf8407cc3fa8'],
    'klar/1': ['5ada94f15c79cd12', '18449abd965255ab'],
    'klar/2': ['9488e3949af834bf', 'd45b908bf92f460c'],
    'klar/42': ['a54e26fc806530fd', '9f0adb58cb89de3d'],
    'build/c0ffee1234567890abcdef0123456789': ['8e2077a6200c183c', '3859712d06eaf6a7'],
    'build/1': ['3fbf3266569e124c', 'e3af59053946588d'],
    'build/2': ['ea5de89035bc8107', '23e13cffeee5ac48'],
    'build/42': ['736271c48db7a257', 'f1f155f7b35480b7'],
  };
  const hash = (x: unknown): string =>
    createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
  const kern = (p: FillerPartie) => ({
    regeln: p.regeln,
    feld: p.feld,
    grau: p.grau,
    besitzer: p.besitzer,
    farbe: p.farbe,
    punkte: p.punkte,
    dran: p.dran,
    zug: p.zug,
    fertig: p.fertig,
    barrieren: p.barrieren,
    barrierenUebrig: p.barrierenUebrig,
    sterne: p.sterne,
  });

  for (const [schluessel, [anfang, ende]] of Object.entries(VORHER)) {
    it(`${schluessel}: gleiches Brett, gleiche Regeln, gleiche Bot-Partie`, () => {
      const [variante, saatText] = schluessel.split('/') as ['nebel' | 'klar' | 'build', string];
      const saat = /^\d+$/.test(saatText) ? Number(saatText) : saatText;
      let p = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], saat);
      assert.equal(p.regeln.spalten, 8);
      assert.equal(p.regeln.zeilen, 7);
      assert.equal(hash(kern(p)), anfang);
      let n = 0;
      while (!p.fertig && n++ < 400) p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
      assert.equal(hash(kern(p)), ende);
      assert.deepEqual([...p.mauerPause], [], 'bei einer Mauer je Zug gibt es keine Pause');
    });
  }
});
