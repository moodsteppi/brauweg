import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filler } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import {
  type FillerPartie,
  aktiveSitze,
  autoEndeVerteilung,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  gesperrteFarben,
  kante,
  leerzuegeGrenze,
  platzierungen,
  sieger,
} from '../src/partie.js';
import { DEFAULT_REGELN } from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

/*
 * Zu viert scheidet aus, wer aufgibt — die anderen spielen weiter (Wunsch
 * Niklas, 26.11.2026). Zu zweit beendet Aufgeben weiter die Partie; das
 * halten eroeffnung-aufgeben.test.ts und die Fingerabdruecke fest.
 */

const EXTREME = { ...DEFAULT_REGELN, variante: 'extreme' } as const;
const SAAT = 'c0ffee1234567890abcdef0123456789';
const VIER = [0, 1, 2, 3] as const;
const AUFGEBEN = { typ: 'aufgeben' } as const;

function vierer(saat: string = SAAT): FillerPartie {
  return filler.createParty({ config: EXTREME, seats: 4, rounds: 1, seed: 1, seedHex: saat } as never);
}

/** Ein Botzug des Sitzes am Zug. */
function botZieht(p: FillerPartie): FillerPartie {
  return fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
}

/**
 * Das 6 x 4-Brett aus zu-viert.test.ts (Platz = y * 6 + x), Spielart Build:
 * Mauern teilen es in vier Viertel, nur die Kante 6:12 ist offen.
 *
 *     y0:   2  2  2 | .  .  1
 *     y1:   F  2  2 | .  .  .
 *           ─  ─  ─   ─  ─  ─      (6:12 offen)
 *     y2:   0  .  . | .  .  .
 *     y3:   0  .  . | .  .  3
 *
 * F (= 6) ist das einzige Feld, das zwei Sitze erreichen (0 und 2).
 * Sitz 2 fuehrt mit Abstand, damit die Wertung zeigt, dass das Ausscheiden
 * vor den Punkten zaehlt.
 */
function kleineLage(): FillerPartie {
  const grund = erstellePartie(
    { ...DEFAULT_REGELN, variante: 'build', spalten: 6, zeilen: 4 },
    VIER,
    SAAT,
  );
  const besitzer: (number | null)[] = new Array(24).fill(null);
  for (const pl of [0, 1, 2, 7, 8]) besitzer[pl] = 2;
  for (const pl of [12, 18]) besitzer[pl] = 0;
  besitzer[5] = 1;
  besitzer[23] = 3;
  const feld = besitzer.map((b) => (b === null ? 5 : b));
  feld[6] = 4;
  return {
    ...grund,
    besitzer,
    feld,
    farbe: { 0: 0, 1: 1, 2: 2, 3: 3 },
    punkte: { 0: 2, 1: 1, 2: 50, 3: 1 },
    dran: 1,
    barrieren: [
      kante(2, 3), kante(8, 9), kante(14, 15), kante(20, 21),
      kante(7, 13), kante(8, 14), kante(9, 15), kante(10, 16), kante(11, 17),
    ],
  };
}

describe('Zu viert: Aufgeben laesst nur den Sitz ausscheiden', () => {
  it('die Partie laeuft weiter, der Sitz steht in `ausgeschieden`', () => {
    const vorher = vierer();
    const p = fuehreAus(vorher, 2, AUFGEBEN);
    assert.equal(p.fertig, false);
    assert.deepEqual(p.ausgeschieden, [2]);
    assert.equal(p.aufgegeben, null, '`aufgegeben` bleibt das Ende zu zweit');
    assert.equal(p.dran, vorher.dran, 'wer nicht dran war, nimmt niemandem den Zug');
    assert.equal(p.zug, vorher.zug, 'Aufgeben ist kein Zug');
    assert.deepEqual(p.besitzer, vorher.besitzer, 'sein Gebiet bleibt liegen');
    assert.deepEqual(p.punkte, vorher.punkte);
    assert.deepEqual(aktiveSitze(p), [0, 1, 3]);
  });

  it('zweimal aufgeben geht nicht, und ein Ausgeschiedener hat keine Zuege', () => {
    const p = fuehreAus(vierer(), 2, AUFGEBEN);
    assert.throws(() => fuehreAus(p, 2, AUFGEBEN), /schon ausgeschieden/);
    assert.deepEqual(erlaubteZuege(p, 2), []);
    assert.throws(() => fuehreAus(p, 2, { typ: 'faerben', farbe: 0 }), /Nicht am Zug/);
  });

  it('war er dran, geht der Zug an den naechsten, und sein halber Zug verfaellt', () => {
    const p0 = vierer();
    assert.equal(p0.dran, 0);
    const halb = { ...p0, mauernDiesenZug: 1 };
    const p = fuehreAus(halb, 0, AUFGEBEN);
    assert.equal(p.dran, 1);
    assert.equal(p.mauernDiesenZug, 0);
    assert.equal(filler.currentActor(p), 1);
  });

  it('wer nicht dran war, laesst einen halben Zug des Sitzes am Zug stehen', () => {
    const halb = { ...vierer(), mauernDiesenZug: 1 };
    const p = fuehreAus(halb, 3, AUFGEBEN);
    assert.equal(p.dran, 0);
    assert.equal(p.mauernDiesenZug, 1);
  });

  it('die Zugfolge ueberspringt Ausgeschiedene, auch zwei hintereinander', () => {
    let p = fuehreAus(vierer(), 1, AUFGEBEN);
    p = fuehreAus(p, 2, AUFGEBEN);
    // Nur Farbzuege zaehlen: Eine Mauer laesst den Zug beim selben Sitz.
    const reihe: number[] = [];
    while (reihe.length < 9 && !p.fertig) {
      const zug = botZug(sichtFuer(p, p.dran));
      if (zug.typ === 'faerben') reihe.push(p.dran);
      p = fuehreAus(p, p.dran, zug);
    }
    assert.ok(reihe.length >= 6);
    assert.deepEqual(reihe, [0, 3, 0, 3, 0, 3, 0, 3, 0].slice(0, reihe.length));
  });

  it('seine Farbe ist nicht mehr gesperrt — waehlen nimmt ihm aber kein Feld', () => {
    const vorher = vierer();
    const farbe2 = vorher.farbe[2]!;
    assert.ok(gesperrteFarben(vorher).includes(farbe2));
    const p = fuehreAus(vorher, 2, AUFGEBEN);
    assert.ok(!gesperrteFarben(p).includes(farbe2));
    assert.deepEqual(gesperrteFarben(p), [p.farbe[0], p.farbe[1], p.farbe[3]]);
    assert.ok(erlaubteZuege(p, 0).some((z) => z.typ === 'faerben' && z.farbe === farbe2));

    const danach = fuehreAus(p, 0, { typ: 'faerben', farbe: farbe2 });
    const seineVorher = p.besitzer.filter((b) => b === 2).length;
    assert.equal(danach.besitzer.filter((b) => b === 2).length, seineVorher);
    assert.equal(danach.punkte[2], p.punkte[2]);
  });

  it('die Sicht nennt Ausgeschiedene und die Sperre aus dem Modul', () => {
    const p = fuehreAus(vierer(), 2, AUFGEBEN);
    for (const sicht of [sichtFuer(p, 0), sichtFuer(p, 2), zuschauerSicht(p)]) {
      assert.deepEqual(sicht.ausgeschieden, [2]);
      assert.deepEqual(sicht.gesperrt, gesperrteFarben(p));
    }
    // Er sieht weiter zu: Sein eigenes Gebiet steht in seiner Sicht.
    assert.ok(sichtFuer(p, 2).besitzer.some((b) => b === 2));
    const frisch = sichtFuer(vierer(), 0);
    assert.deepEqual(frisch.ausgeschieden, []);
  });

  it('Speichern und Laden behaelt die Ausgeschiedenen', () => {
    const p = fuehreAus(fuehreAus(vierer(), 3, AUFGEBEN), 1, AUFGEBEN);
    const geladen = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(p))));
    assert.deepEqual(geladen.ausgeschieden, [3, 1]);
    // Ein Snapshot ohne das Feld: niemand ist ausgeschieden.
    const alt = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(vierer()))));
    assert.equal(alt.ausgeschieden, undefined);
    assert.deepEqual(aktiveSitze(alt), [0, 1, 2, 3]);
  });

  it('die Leerzug-Grenze rechnet mit den Sitzen, die noch ziehen', () => {
    const p = vierer();
    // Eine Farbe, die Sitz 0 in seinem ersten Zug nichts bringt.
    const leer = erlaubteZuege(p, 0)
      .filter((z): z is { typ: 'faerben'; farbe: number } => z.typ === 'faerben')
      .find((z) => fuehreAus(p, 0, z).punkte[0] === p.punkte[0]);
    assert.ok(leer, 'eine Farbe ohne Ertrag gibt es auf jedem Brett');
    const knapp = { ...p, leerzuege: leerzuegeGrenze(3) - 1 };
    assert.equal(fuehreAus(knapp, 0, leer).fertig, false, 'zu viert sind es zwoelf');
    const zuDritt = fuehreAus(knapp, 2, AUFGEBEN);
    assert.equal(fuehreAus(zuDritt, 0, leer).fertig, true, 'zu dritt neun');
  });
});

describe('Zu viert: Auto-Ende und Schluss nach dem Ausscheiden', () => {
  it('scheidet aus, wer ein Feld noch umkaempfte, greift das Auto-Ende sofort', () => {
    const lage = kleineLage();
    assert.equal(autoEndeVerteilung(lage), null, 'F ist noch umkaempft');
    const p = fuehreAus(lage, 2, AUFGEBEN);
    assert.ok(p.fertig);
    const verteilt = p.autoEnde;
    assert.ok(verteilt);
    const an = (s: number) => verteilt.filter((f) => f.sitz === s).map((f) => f.platz).sort((a, b) => a - b);
    assert.deepEqual(an(0), [6, 13, 14, 19, 20]);
    assert.deepEqual(an(2), [], 'ein Ausgeschiedener bekommt nichts mehr');
    // Die Wertung: Sitz 2 hat die meisten Felder und steht trotzdem hinten.
    const reihe = platzierungen(p);
    assert.equal(reihe[3]!.seat, 2);
    assert.equal(reihe[3]!.place, 4);
    assert.equal(sieger(p), 0);
  });

  it('was nur ein Ausgeschiedener erreichte, bleibt ein Loch', () => {
    const p = fuehreAus(kleineLage(), 0, AUFGEBEN);
    assert.ok(p.fertig, 'F erreicht nur noch Sitz 2 — nichts ist mehr umkaempft');
    const verteilt = p.autoEnde!;
    assert.deepEqual(verteilt.filter((f) => f.sitz === 0), []);
    assert.ok(verteilt.some((f) => f.platz === 6 && f.sitz === 2));
    for (const loch of [13, 14, 19, 20]) assert.equal(p.besitzer[loch], null, `Platz ${loch}`);
  });

  it('bleibt nur einer uebrig, endet die Partie, und er bekommt, was er erreicht', () => {
    let p = vierer();
    for (let i = 0; i < 8; i++) p = botZieht(p);
    p = fuehreAus(p, 1, AUFGEBEN);
    p = fuehreAus(p, 3, AUFGEBEN);
    assert.equal(p.fertig, false);
    p = fuehreAus(p, 0, AUFGEBEN);
    assert.ok(p.fertig);
    assert.equal(filler.currentActor(p), null);
    assert.ok(p.autoEnde && p.autoEnde.length > 0);
    assert.ok(p.autoEnde.every((f) => f.sitz === 2));
    // Platz 1 der Letzte, dann rueckwaerts in der Reihenfolge des Ausstiegs.
    assert.deepEqual(
      platzierungen(p).map((e) => [e.seat, e.place]),
      [[2, 1], [0, 2], [3, 3], [1, 4]],
    );
    assert.equal(sieger(p), 2);
  });

  it('Ausgeschiedene stehen hinter allen Verbliebenen, die spaeter ausstiegen vorn', () => {
    const p: FillerPartie = {
      ...vierer(),
      punkte: { 0: 30, 1: 10, 2: 40, 3: 5 },
      ausgeschieden: [2, 0],
      fertig: true,
    };
    assert.deepEqual(
      platzierungen(p).map((e) => [e.seat, e.place]),
      [[1, 1], [3, 2], [0, 3], [2, 4]],
    );
    assert.equal(sieger(p), 1);
    // Gleichstand unter Verbliebenen bleibt ein geteilter Platz.
    const gleich = { ...p, punkte: { 0: 30, 1: 10, 2: 40, 3: 10 } };
    assert.deepEqual(
      platzierungen(gleich).map((e) => e.place),
      [1, 1, 3, 4],
    );
    assert.equal(sieger(gleich), null);
  });
});

describe('Zu viert: Bot-Partie mit einem Aufgeben in der Mitte', () => {
  // Eine Partie ueber den Adapter, wie der Server sie fuehrt: gut zehn Sekunden.
  it('der Sitz am Zug gibt nach 40 Schritten auf, die anderen drei spielen zu Ende', () => {
    let p = filler.createParty({
      config: EXTREME,
      seats: 4,
      rounds: 1,
      seed: 1,
      seedHex: 'b0b0cafe1234567890abcdef01234567',
    } as never);
    let schritte = 0;
    let raus: number | null = null;
    while (!filler.isFinished(p)) {
      assert.ok(++schritte < 900, 'die Partie endet nicht');
      const sitz = filler.currentActor(p)!;
      if (raus !== null) assert.notEqual(sitz, raus, 'ein Ausgeschiedener ist nie am Zug');
      if (schritte === 40) {
        raus = sitz;
        p = filler.act(p, sitz, AUFGEBEN);
        continue;
      }
      const sicht = filler.viewFor(p, sitz);
      // Der Bot waehlt nie eine gesperrte Farbe — die des Ausgeschiedenen darf er.
      const zug = filler.botAction!(sicht, { level: 'normal' } as never);
      if (zug.typ === 'faerben') assert.ok(!gesperrteFarben(p).includes(zug.farbe));
      p = filler.act(p, sitz, zug);
    }
    assert.notEqual(raus, null);
    const reihe = filler.standings(p);
    assert.equal(reihe.length, 4);
    assert.equal(reihe[3]!.seat, raus, 'wer aufgab, steht hinten');
    assert.equal(reihe[3]!.place, 4);
    assert.ok(reihe.slice(0, 3).every((e) => e.place <= 3));
  });
});
