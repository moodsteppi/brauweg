/**
 * Ausgleich fuer den Nachziehenden (07.11.2026, Karte 03b3a41f).
 *
 * Sitz 0 zieht zuerst und hat meist auch den letzten Farbzug; Bot gegen Bot
 * gewann er in Klar 52 zu 36, in Build 53,5 zu 44, in Extreme 60,5 zu 37
 * (werkzeug/MESSUNG-2026-11-07-anzug.md). Ausgeglichen wird mit zwei
 * Regelfeldern: `barrierenZuschlagSitz1` (Build +1, Extreme +2) und
 * `punkteZuschlagSitz1` (Klar +2, Weg B vom 06.11.2026 — er ersetzt
 * "Gleichstand zaehlt fuer Sitz 1"). Die Nachmessung steht in
 * werkzeug/MESSUNG-2026-11-07-ausgleich.md.
 *
 * Zu jeder Probe die Gegenprobe: Ein Tisch, der OHNE die Tabelle
 * aufgemacht wurde, und der Nebel bleiben, wie sie waren.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { filler } from '../src/adapter.js';
import { botZug } from '../src/bot.js';
import {
  type FillerPartie,
  erstellePartie,
  fuehreAus,
  platzierungen,
  sieger,
} from '../src/partie.js';
import {
  AUSGLEICH_JE_SPIELART,
  DEFAULT_REGELN,
  type FillerRegeln,
  type FillerVariante,
  pruefeRegeln,
} from '../src/regeln.js';
import { sichtFuer, zuschauerSicht } from '../src/sicht.js';

const SAAT = 'c0ffee1234567890abcdef0123456789';

/** Die Vorgabe, wie ein Tisch von vor dem 07.11.2026 sie mitgeschickt hat. */
const { ausgleichJeSpielart: _ausgleich, ...OHNE_AUSGLEICH } = DEFAULT_REGELN;
void _ausgleich;

function neu(variante: FillerVariante, regeln: FillerRegeln = DEFAULT_REGELN): FillerPartie {
  return erstellePartie({ ...regeln, variante }, [0, 1], SAAT);
}

/** Dieselbe Partie, fertig gestellt mit einem ausgedachten Punktestand. */
function endstand(p: FillerPartie, null_: number, eins: number): FillerPartie {
  return { ...p, punkte: { 0: null_, 1: eins }, fertig: true };
}

describe('Ausgleich: Vorgabe und Pruefung', () => {
  it('steht je Spielart in der Vorgabe: Klar +2 Punkte, Build +1 Mauer, Extreme +2, Nebel nichts', () => {
    assert.deepEqual(DEFAULT_REGELN.ausgleichJeSpielart, AUSGLEICH_JE_SPIELART);
    assert.deepEqual(AUSGLEICH_JE_SPIELART, {
      klar: { punkteZuschlagSitz1: 2 },
      build: { barrierenZuschlagSitz1: 1 },
      extreme: { barrierenZuschlagSitz1: 2 },
    });
    assert.equal('nebel' in AUSGLEICH_JE_SPIELART, false);
    // Die Einzelfelder stehen NICHT in der Vorgabe, sonst gaelten sie ueberall.
    assert.equal('barrierenZuschlagSitz1' in DEFAULT_REGELN, false);
    assert.equal('punkteZuschlagSitz1' in DEFAULT_REGELN, false);
  });

  it('nimmt die Vorgabe und gueltige Felder an', () => {
    assert.deepEqual(pruefeRegeln(DEFAULT_REGELN), []);
    assert.deepEqual(pruefeRegeln(OHNE_AUSGLEICH), []);
    assert.deepEqual(
      pruefeRegeln({ ...OHNE_AUSGLEICH, barrierenZuschlagSitz1: 5, punkteZuschlagSitz1: 5 }),
      [],
    );
    // Die Grenzen selbst: 0 und 5 sind gueltig, null heisst "fehlt".
    for (const punkte of [0, 5, null]) {
      assert.deepEqual(pruefeRegeln({ ...OHNE_AUSGLEICH, punkteZuschlagSitz1: punkte }), [], String(punkte));
    }
    for (const variante of ['nebel', 'klar', 'build', 'extreme'] as const) {
      assert.deepEqual(filler.validateConfig({ ...DEFAULT_REGELN, variante }, 2, 1), [], variante);
    }
  });

  it('weist kaputte Werte ab, auch in der Tabelle', () => {
    const pfade = (config: unknown) => pruefeRegeln(config).map((p) => p.path);
    for (const zuschlag of [-1, 6, 1.5, '1', true]) {
      assert.deepEqual(pfade({ ...OHNE_AUSGLEICH, barrierenZuschlagSitz1: zuschlag }), [
        'barrierenZuschlagSitz1',
      ]);
    }
    for (const punkte of [-1, 6, 2.5, '2', true]) {
      assert.deepEqual(pfade({ ...OHNE_AUSGLEICH, punkteZuschlagSitz1: punkte }), [
        'punkteZuschlagSitz1',
      ]);
    }
    assert.deepEqual(pfade({ ...OHNE_AUSGLEICH, ausgleichJeSpielart: 3 }), ['ausgleichJeSpielart']);
    // Ein Array ist auch ein "object" — darf trotzdem nicht als Tabelle durchgehen.
    assert.deepEqual(pfade({ ...OHNE_AUSGLEICH, ausgleichJeSpielart: [] }), ['ausgleichJeSpielart']);
    assert.deepEqual(pfade({ ...OHNE_AUSGLEICH, ausgleichJeSpielart: { klar: [2] } }), [
      'ausgleichJeSpielart.klar',
    ]);
    assert.deepEqual(pfade({ ...OHNE_AUSGLEICH, ausgleichJeSpielart: { build: 1 } }), [
      'ausgleichJeSpielart.build',
    ]);
    assert.deepEqual(
      pfade({
        ...OHNE_AUSGLEICH,
        ausgleichJeSpielart: { build: { barrierenZuschlagSitz1: 9 }, klar: { punkteZuschlagSitz1: 6 } },
      }),
      ['ausgleichJeSpielart.klar.punkteZuschlagSitz1', 'ausgleichJeSpielart.build.barrierenZuschlagSitz1'],
    );
  });
});

describe('Ausgleich: Mauerzuschlag fuer Sitz 1', () => {
  it('Build: Sitz 0 zehn, Sitz 1 elf', () => {
    const p = neu('build');
    assert.deepEqual(p.barrierenUebrig, { 0: 10, 1: 11 });
    assert.equal(p.regeln.barrierenZuschlagSitz1, 1);
    // Die Tabelle steht nicht im Snapshot, nur was sie festgelegt hat.
    assert.equal('ausgleichJeSpielart' in p.regeln, false);
    assert.equal('punkteZuschlagSitz1' in p.regeln, false);
  });

  it('Extreme: Sitz 0 zwanzig, Sitz 1 zweiundzwanzig', () => {
    const p = neu('extreme');
    assert.deepEqual(p.barrierenUebrig, { 0: 20, 1: 22 });
    assert.equal(p.regeln.barrierenZuschlagSitz1, 2);
  });

  it('zeigt Sitz 1 seinen groesseren Vorrat — in seiner, der fremden und der Zuschauersicht', () => {
    const p = neu('extreme');
    for (const sicht of [sichtFuer(p, 1), sichtFuer(p, 0), zuschauerSicht(p)]) {
      assert.deepEqual(sicht.barrierenUebrig, { 0: 20, 1: 22 });
    }
  });

  it('kommt mit Bots zu Ende, und Sitz 1 kann den Zuschlag verbauen', () => {
    let p = neu('build');
    let n = 0;
    while (!p.fertig && n++ < 600) p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
    assert.equal(p.fertig, true);
    const gebaut1 = 11 - p.barrierenUebrig[1]!;
    assert.ok(gebaut1 >= 0 && gebaut1 <= 11);
  });

  it('gilt auch als Einzelfeld ohne Tabelle (ein selbstgebauter Tisch)', () => {
    const p = neu('build', { ...OHNE_AUSGLEICH, barrierenZuschlagSitz1: 2 });
    assert.deepEqual(p.barrierenUebrig, { 0: 10, 1: 12 });
  });

  it('gibt ohne Mauern keinen Vorrat aus, auch nicht mit Zuschlag', () => {
    const p = neu('klar', { ...OHNE_AUSGLEICH, barrierenZuschlagSitz1: 3 });
    assert.deepEqual(p.barrierenUebrig, { 0: 0, 1: 0 });
  });

  it('Gegenprobe: ein Tisch ohne Tabelle bleibt bei gleichem Vorrat und ohne neue Schluessel', () => {
    for (const variante of ['build', 'extreme'] as const) {
      const p = neu(variante, OHNE_AUSGLEICH);
      assert.equal(p.barrierenUebrig[0], p.barrierenUebrig[1], variante);
      assert.equal('barrierenZuschlagSitz1' in p.regeln, false, variante);
    }
  });

  it('Gegenprobe: das Brett aendert sich durch den Ausgleich nicht', () => {
    for (const variante of ['klar', 'build', 'extreme'] as const) {
      const mit = neu(variante);
      const ohne = neu(variante, OHNE_AUSGLEICH);
      assert.deepEqual(mit.feld, ohne.feld, variante);
      assert.deepEqual(mit.sterne, ohne.sterne, variante);
      assert.deepEqual(mit.grau, ohne.grau, variante);
    }
  });

  it('Gegenprobe: der Nebel bekommt nichts, sein Regelsatz sieht aus wie vorher', () => {
    const mit = neu('nebel');
    const ohne = neu('nebel', OHNE_AUSGLEICH);
    assert.deepEqual(mit, ohne);
  });
});

describe('Ausgleich: Punktzuschlag fuer Sitz 1', () => {
  const plaetze = (p: FillerPartie) =>
    platzierungen(p).map(({ seat, points, place }) => [seat, points, place]);

  it('Klar: Sitz 1 bekommt zwei Punkte in der Wertung, das Brett bleibt', () => {
    const p = endstand(neu('klar'), 28, 28);
    assert.equal(p.regeln.punkteZuschlagSitz1, 2);
    assert.deepEqual(p.punkte, { 0: 28, 1: 28 });
    assert.deepEqual(plaetze(p), [
      [1, 30, 1],
      [0, 28, 2],
    ]);
    assert.equal(sieger(p), 1);
    assert.deepEqual(
      filler.standings(p).map((s) => [s.seat, s.points, s.place]),
      [
        [1, 30, 1],
        [0, 28, 2],
      ],
    );
  });

  it('Klar: Remis bleibt Remis — zwei Felder Vorsprung gleicht der Zuschlag genau aus', () => {
    const p = endstand(neu('klar'), 29, 27);
    assert.equal(sieger(p), null);
    assert.deepEqual(
      platzierungen(p).map((e) => [e.points, e.place]),
      [
        [29, 1],
        [29, 1],
      ],
    );
    assert.equal(sichtFuer(p, 0).sieger, null);
  });

  it('Klar: drei Felder Vorsprung reichen Sitz 0 weiter, und Sitz 1 gewinnt mit einem weniger', () => {
    assert.equal(sieger(endstand(neu('klar'), 30, 26)), 0);
    assert.equal(sieger(endstand(neu('klar'), 29, 26)), 0);
    assert.equal(sieger(endstand(neu('klar'), 28, 27)), 1);
  });

  it('Klar: die Aufgabe geht vor — gibt Sitz 1 auf, gewinnt Sitz 0, auch mit weniger Punkten', () => {
    const p = { ...endstand(neu('klar'), 20, 25), aufgegeben: 1 };
    assert.equal(sieger(p), 0);
    assert.deepEqual(plaetze(p), [
      [0, 20, 1],
      [1, 27, 2],
    ]);
  });

  it('Klar: laufende Partie hat keinen Sieger, auch mit Zuschlag', () => {
    const p = { ...neu('klar'), punkte: { 0: 5, 1: 9 } };
    assert.equal(sieger(p), null);
  });

  it('steht als Zahl in jeder Sicht — Sitz 0, Sitz 1 und Zuschauer', () => {
    const p = endstand(neu('klar'), 28, 28);
    for (const sicht of [sichtFuer(p, 0), sichtFuer(p, 1), zuschauerSicht(p)]) {
      assert.equal(sicht.punkteZuschlagSitz1, 2);
      // Die Punkte der Sicht bleiben das Brett; der Zuschlag steht daneben.
      assert.deepEqual(sicht.punkte, { 0: 28, 1: 28 });
      assert.equal(sicht.sieger, 1);
    }
  });

  it('gilt auch als Einzelfeld ohne Tabelle (ein selbstgebauter Tisch)', () => {
    const p = endstand(neu('nebel', { ...OHNE_AUSGLEICH, punkteZuschlagSitz1: 3 }), 30, 27);
    assert.equal(sieger(p), null);
    assert.equal(sichtFuer(p, 0).punkteZuschlagSitz1, 3);
  });

  it('Gegenprobe: ohne Zuschlag bleibt alles wie vorher — Sicht 0, Gleichstand Unentschieden', () => {
    for (const p of [
      endstand(neu('klar', OHNE_AUSGLEICH), 28, 28),
      endstand(neu('nebel'), 28, 28),
      endstand(neu('build'), 28, 28),
      endstand(neu('extreme'), 28, 28),
    ]) {
      assert.equal(sieger(p), null, p.regeln.variante);
      assert.deepEqual(
        platzierungen(p).map((e) => [e.points, e.place]),
        [
          [28, 1],
          [28, 1],
        ],
        p.regeln.variante,
      );
      assert.equal(sichtFuer(p, 0).punkteZuschlagSitz1, 0, p.regeln.variante);
      assert.equal('punkteZuschlagSitz1' in p.regeln, false, p.regeln.variante);
    }
    assert.equal(sieger(endstand(neu('klar', OHNE_AUSGLEICH), 28, 27)), 0);
  });

  it('Gegenprobe: der Bot spielt in Klar mit und ohne Zuschlag dieselbe Partie', () => {
    /*
     * Darauf ruht die Messung aus den Punktdifferenzen
     * (werkzeug/ausgleich-messung.mjs): Der Bot liest keine Punkte, der
     * Zuschlag aendert also keinen Zug, nur die Wertung.
     */
    for (const saat of [SAAT, 1, 42]) {
      const spiele = (regeln: FillerRegeln): FillerPartie => {
        let p = erstellePartie({ ...regeln, variante: 'klar' }, [0, 1], saat);
        let n = 0;
        while (!p.fertig && n++ < 600) p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
        return p;
      };
      const mit = spiele(DEFAULT_REGELN);
      const ohne = spiele(OHNE_AUSGLEICH);
      assert.deepEqual(mit.besitzer, ohne.besitzer, String(saat));
      assert.deepEqual(mit.punkte, ohne.punkte, String(saat));
      assert.equal(mit.zug, ohne.zug, String(saat));
    }
  });

  it('ueberlebt Speichern und Laden', () => {
    const p = endstand(neu('klar'), 28, 28);
    const zurueck = filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(p))));
    assert.deepEqual(zurueck, p);
    assert.equal(sieger(zurueck), 1);
    const b = neu('extreme');
    assert.deepEqual(
      filler.deserialize(JSON.parse(JSON.stringify(filler.serialize(b)))).barrierenUebrig,
      { 0: 20, 1: 22 },
    );
  });
});

describe('Ausgleich: Fingerabdruecke der Bot-Partie mit voller Vorgabe', () => {
  /*
   * Echter Bot auf beiden Seiten, volle Vorgabe MIT Ausgleich: Regelsatz,
   * Endstand, Mauern und Wertung (sha256, 16 Zeichen). Der Tisch OHNE
   * Ausgleich ist unveraendert und steht weiter in eroeffnung-aufgeben.test.ts
   * und extreme-gross.test.ts. Nachrechnen fuer jeden gebauten Stand:
   * `node werkzeug/abdruck-schichten.mjs <dist>`, Zeilen "ausgleich".
   *
   * Build und Extreme seit dem 07.11.2026 neu: Der Bot meidet Fallen
   * (MESSUNG-2026-11-07-bot-fallen.md), an Regeln und Ausgleich hat sich
   * nichts geaendert. Klar und Build/c0ffee blieben gleich.
   */
  const ERWARTET: Record<string, string> = {
    'klar/c0ffee1234567890abcdef0123456789': '34f2f10fd363dc4c',
    'klar/1': '92633857f4b8ae7e',
    'klar/2': '83fc314178299c10',
    'klar/42': '1c19ae69e1432e7c',
    'build/c0ffee1234567890abcdef0123456789': '2d0d977ae1bc4954',
    'build/1': '2e9eff63254d1ca3',
    'build/2': '0353ec26440bfbf2',
    'build/42': '70cab1c4ca915d33',
    'extreme/c0ffee1234567890abcdef0123456789': 'ede658b1fbe0d357',
    'extreme/1': 'cfc0fdfcfe77fa10',
    'extreme/2': '458e107503ffe995',
    'extreme/42': '8841720fa5a71e86',
  };
  const hash = (x: unknown): string =>
    createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);

  for (const [schluessel, erwartet] of Object.entries(ERWARTET)) {
    it(`${schluessel}: dieselbe Bot-Partie`, () => {
      const [variante, saatText] = schluessel.split('/') as [FillerVariante, string];
      const saat = /^\d+$/.test(saatText) ? Number(saatText) : saatText;
      let p = erstellePartie({ ...DEFAULT_REGELN, variante }, [0, 1], saat);
      let n = 0;
      while (!p.fertig && n++ < 600) p = fuehreAus(p, p.dran, botZug(sichtFuer(p, p.dran)));
      const ist = hash({
        regeln: p.regeln,
        punkte: p.punkte,
        barrierenUebrig: p.barrierenUebrig,
        barrieren: p.barrieren,
        zug: p.zug,
        platz: platzierungen(p),
        sieger: sieger(p),
      });
      assert.equal(ist, erwartet);
    });
  }
});
