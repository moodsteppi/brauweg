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
  mauernAmFeld,
  moeglicheBarrieren,
  nachbarn,
  sitzeVon,
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
    let volleFelder = 0;
    /*
     * Der BAUMEISTER: In jedem Zug mauert zuerst er, solange das Modul etwas
     * anbietet — immer die erste angebotene Kante —, und erst dann zieht der
     * Bot. Entstanden am 06.11.2026, als der Bot unter Regel 2 gar nicht mehr
     * mauerte; er bleibt, weil er Doppelmauer und Pause in JEDEM Zug
     * erzwingt und Kanten nimmt, die kein Bot waehlen wuerde (die erste der
     * Liste, oft am Rand). Geprueft wird dabei jeder Zug gegen `legalActions`.
     * Nach JEDER Mauer wird nachgerechnet: Kein Sitz erreicht weniger freie
     * Felder als davor (Regel 2), und kein Feld traegt mehr als zwei Mauern,
     * den Rand mitgezaehlt (Regel 4). Dass die Grenze dabei wirklich erreicht
     * wird, zaehlt `volleFelder`. Dieselbe Probe mit dem echten Bot steht
     * darunter.
     */
    let mauernGesamt = 0;
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
        const vorher = sitzeVon(p).map((s) => erreichbareFreie(p, s, new Set(p.barrieren)));
        if (p.mauerPause.includes(sitz)) {
          pausiert++;
          assert.equal(zug.typ, 'faerben', `Saat ${saat}: Bot mauert in der Pause`);
        }
        p = fuehreAus(p, sitz, zug);
        if (zug.typ === 'barriere') {
          mauernGesamt++;
          const gesetzt = new Set(p.barrieren);
          sitzeVon(p).forEach((s, i) =>
            assert.ok(
              erreichbareFreie(p, s, gesetzt) >= vorher[i]!,
              `Saat ${saat}, Zug ${p.zug}: Mauer ${zug.von}|${zug.nach} trennt Sitz ${s} ab (Regel 2)`,
            ),
          );
          for (const platz of [zug.von, zug.nach]) {
            assert.ok(
              mauernAmFeld(platz, p.regeln.spalten, p.regeln.zeilen, gesetzt) <= 2,
              `Saat ${saat}: Feld ${platz} traegt mehr als zwei Mauern (Regel 4)`,
            );
          }
        }
      }
      assert.ok(p.fertig, `Saat ${saat}: Partie endet`);
      // Felder, die durch gesetzte Mauern (nicht nur den Rand) voll sind.
      const { spalten, zeilen } = p.regeln;
      const gesetzt = new Set(p.barrieren);
      const leer = new Set<string>();
      for (let platz = 0; platz < spalten * zeilen; platz++) {
        const voll = mauernAmFeld(platz, spalten, zeilen, gesetzt);
        if (voll === 2 && mauernAmFeld(platz, spalten, zeilen, leer) < 2) volleFelder++;
        assert.ok(voll <= 2, `Saat ${saat}: Feld ${platz} hat ${voll} Mauern`);
      }
    }
    assert.ok(doppel >= 1, 'die Probe beruehrt die Doppelmauer');
    assert.ok(pausiert >= 1, 'die Probe beruehrt die Pause');
    assert.ok(mauernGesamt >= 20, `nur ${mauernGesamt} Mauern — die Probe mauert zu wenig`);
    assert.ok(volleFelder >= 1, 'die Probe erreicht die Grenze von zwei Mauern je Feld nie');
  });

  /*
   * Dieselbe Nachrechnung mit dem ECHTEN Bot auf beiden Sitzen (seit dem
   * 06.11.2026, Niklas' Entscheidung "b+"): Der Bot mauert jetzt nach seiner
   * eigenen Bewertung (Wegterm, Plaetze je Feld) — also an genau den Stellen,
   * an denen Regel 2 und 4 am ehesten zuschlagen: eng am Gegner, wo eine
   * Mauer gern den letzten Durchgang schliessen wuerde. Die Kanten nimmt er
   * nur aus `barrierenMoeglich`; hier wird nachgerechnet, dass das Modul ihm
   * dort nichts Verbotenes anbietet.
   */
  it('mauert mit dem echten Bot eine ganze Partie lang nach Regel 2 und Regel 4', () => {
    let mauernGesamt = 0;
    let doppel = 0;
    let volleFelder = 0;
    for (const saat of [SAAT, 12, 7]) {
      let p = erstellePartie(EXTREME, [0, 1], saat);
      let n = 0;
      while (!p.fertig && n++ < 600) {
        const sitz = p.dran;
        const zug = botZug(sichtFuer(p, sitz));
        const erlaubt = filler.legalActions(p, sitz);
        assert.ok(
          erlaubt.some(
            (z) =>
              (z.typ === 'faerben' && zug.typ === 'faerben' && z.farbe === zug.farbe) ||
              (z.typ === 'barriere' &&
                zug.typ === 'barriere' &&
                kante(z.von, z.nach) === kante(zug.von, zug.nach)),
          ),
          `Saat ${saat}, Zug ${p.zug}: ${JSON.stringify(zug)} ist nicht erlaubt`,
        );
        if (zug.typ === 'barriere' && p.mauernDiesenZug === 1) doppel++;
        const vorher = sitzeVon(p).map((s) => erreichbareFreie(p, s, new Set(p.barrieren)));
        p = fuehreAus(p, sitz, zug);
        if (zug.typ !== 'barriere') continue;
        mauernGesamt++;
        const gesetzt = new Set(p.barrieren);
        sitzeVon(p).forEach((s, i) =>
          assert.ok(
            erreichbareFreie(p, s, gesetzt) >= vorher[i]!,
            `Saat ${saat}, Zug ${p.zug}: Mauer ${zug.von}|${zug.nach} trennt Sitz ${s} ab (Regel 2)`,
          ),
        );
        const { spalten, zeilen } = p.regeln;
        for (const platz of [zug.von, zug.nach]) {
          const zahl = mauernAmFeld(platz, spalten, zeilen, gesetzt);
          assert.ok(zahl <= 2, `Saat ${saat}: Feld ${platz} traegt ${zahl} Mauern (Regel 4)`);
          if (zahl === 2 && mauernAmFeld(platz, spalten, zeilen, new Set()) < 2) volleFelder++;
        }
      }
      assert.ok(p.fertig, `Saat ${saat}: Partie endet`);
    }
    // Untergrenzen weit unter dem Gemessenen (rund 43 Mauern je Partie, siehe
    // "Der Bot mauert in ganzen Partien" in barrieren.test.ts): Sie sollen
    // nur sicherstellen, dass hier wirklich gemauert wird — sonst prueft die
    // Probe Regel 2 und 4 an nichts.
    assert.ok(mauernGesamt >= 30, `nur ${mauernGesamt} Mauern in drei Partien`);
    assert.ok(volleFelder >= 1, 'der Bot bringt nie ein Feld an die Grenze von zwei Mauern');
    assert.ok(doppel >= 1, 'der Bot baut nie eine zweite Mauer im selben Zug');
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
   * Ausnahme seit dem 06.11.2026: der ENDSTAND in Build. Dort haben sich die
   * Mauerregeln (Regel 2 und 3 gelten auch in Build, fae4a420) UND die
   * Mauerwahl des Bots (eac0ba11) geaendert. Damit ein neuer Abdruck nicht
   * offenlaesst, was ihn verschoben hat, steht der Build-Endstand in drei
   * Schichten — dieselbe Aufteilung wie in eroeffnung-aufgeben.test.ts:
   *
   * - BUILD_OHNE_MAUERN: Der Bot faerbt nur. Auf `staging` (bc73140f) und
   *   hier gemessen, gleich — Brett und Farbwahl sind unberuehrt.
   * - BUILD_BAUMEISTER: Jede angebotene Mauer wird gebaut. Haengt nur an den
   *   Mauerregeln; auf `staging` waren es 257e798944492321,
   *   1b6d416e6b9414dc, c84c3ebf59971ab7, 3b0943faaab76099 (Reihenfolge wie
   *   unten), verschoben allein durch Regel 2 und 3.
   * - VORHER (zweiter Wert): der echte Bot. Auf `staging` 29546ff352efc2ea,
   *   daec5b1bbc50b669, b42532c7d1c2b279, 1ed530456700461b; nach dem
   *   Regelfix mauerte der alte Bot nicht mehr und landete GENAU auf
   *   BUILD_OHNE_MAUERN; seit dem Wegterm mauert er wieder.
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
    'build/c0ffee1234567890abcdef0123456789': ['8e2077a6200c183c', '791dfe9216ff083d'],
    'build/1': ['3fbf3266569e124c', '7a26d141e9121b74'],
    'build/2': ['ea5de89035bc8107', '455d6b589aac310c'],
    'build/42': ['736271c48db7a257', '9501469822898af3'],
  };
  const BUILD_OHNE_MAUERN: Record<string, string> = {
    'build/c0ffee1234567890abcdef0123456789': '3859712d06eaf6a7',
    'build/1': 'e3af59053946588d',
    'build/2': '23e13cffeee5ac48',
    'build/42': 'f1f155f7b35480b7',
  };
  const BUILD_BAUMEISTER: Record<string, string> = {
    'build/c0ffee1234567890abcdef0123456789': 'c7c8c4252572cd2e',
    'build/1': '99542da1bbe15441',
    'build/2': '5471b6a80cbc5ff2',
    'build/42': 'ac1bb2abfc527721',
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

  type Wahl = (p: FillerPartie) => FillerAktion;
  const echterBot: Wahl = (p) => botZug(sichtFuer(p, p.dran));
  const nurFarbe: Wahl = (p) => {
    const { barrierenMoeglich: _weg, ...sicht } = sichtFuer(p, p.dran);
    void _weg;
    return botZug(sicht);
  };
  const baumeister: Wahl = (p) => {
    const angebot = moeglicheBarrieren(p, p.dran);
    return angebot.length > 0
      ? { typ: 'barriere', von: angebot[0]![0], nach: angebot[0]![1] }
      : nurFarbe(p);
  };

  function spiele(schluessel: string, wahl: Wahl): { anfang: string; ende: string } {
    const [variante, saatText] = schluessel.split('/') as ['nebel' | 'klar' | 'build', string];
    const saat = /^\d+$/.test(saatText) ? Number(saatText) : saatText;
    let p = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], saat);
    assert.equal(p.regeln.spalten, 8);
    assert.equal(p.regeln.zeilen, 7);
    const anfang = hash(kern(p));
    let n = 0;
    while (!p.fertig && n++ < 400) p = fuehreAus(p, p.dran, wahl(p));
    assert.deepEqual([...p.mauerPause], [], 'bei einer Mauer je Zug gibt es keine Pause');
    return { anfang, ende: hash(kern(p)) };
  }

  for (const [schluessel, [anfang, ende]] of Object.entries(VORHER)) {
    it(`${schluessel}: gleiches Brett, gleiche Regeln, gleiche Bot-Partie`, () => {
      const ist = spiele(schluessel, echterBot);
      assert.equal(ist.anfang, anfang);
      assert.equal(ist.ende, ende);
    });
  }
  for (const [schluessel, ende] of Object.entries(BUILD_OHNE_MAUERN)) {
    it(`${schluessel} ohne Mauern: Endstand wie auf staging`, () => {
      assert.equal(spiele(schluessel, nurFarbe).ende, ende);
    });
  }
  for (const [schluessel, ende] of Object.entries(BUILD_BAUMEISTER)) {
    it(`${schluessel} mit Baumeister: Mauerregeln ohne Mauerwahl des Bots`, () => {
      assert.equal(spiele(schluessel, baumeister).ende, ende);
    });
  }
});
