/**
 * Proben fuer den Partiezustand.
 *
 * Geprueft wird das, was das Modul WIRKLICH entscheidet: welche Eingabe
 * durchkommt, welche nicht, und wie aus Meldungen ein Ausgang wird. Die
 * Kueche selbst rechnet das Geraet — dafuer stehen die Proben unter
 * `packages/client/src/minispiele/brocooked/`.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RegelverstossError,
  ausstieg,
  erzeugePartie,
  platzierungen,
  schliesseAb,
  verarbeite,
} from '../src/partie.js';
import { DEFAULT_REGELN, type BroCookedAktion, type Eingabe } from '../src/regeln.js';

function partie(sitze = 2, runden = 2, botSitze: number[] = []) {
  return erzeugePartie({ regeln: DEFAULT_REGELN, saat: 7, sitze, runden, botSitze });
}

function eingabe(e: Eingabe): BroCookedAktion {
  return { art: 'eingabe', eingabe: e };
}

const MELDUNG = { punkte: 120, sterne: [2, 3], pruef: 'abc' };

describe('erzeugePartie', () => {
  it('haelt Saatkorn, Sitze und Runden und beginnt leer', () => {
    const p = partie(3, 4);
    assert.equal(p.saat, 7);
    assert.equal(p.sitze, 3);
    assert.equal(p.runden, 4);
    assert.deepEqual(p.eingaben, []);
    assert.equal(p.ausgang, null);
  });

  it('macht aus dem Saatkorn 0 eine 1 — mulberry32 liefert damit sonst eine eintoenige Folge', () => {
    const p = erzeugePartie({ regeln: DEFAULT_REGELN, saat: 0, sitze: 2, runden: 1 });
    assert.equal(p.saat, 1);
  });
});

describe('Eingaben', () => {
  it('nimmt Richtung, Greifen, Werken und Spurt an', () => {
    let p = partie();
    p = verarbeite(p, 0, eingabe({ takt: 3, nr: 0, art: 'richtung', dx: 1, dy: 0 }));
    p = verarbeite(p, 0, eingabe({ takt: 4, nr: 1, art: 'greifen' }));
    p = verarbeite(p, 1, eingabe({ takt: 5, nr: 0, art: 'werken', an: true }));
    p = verarbeite(p, 1, eingabe({ takt: 9, nr: 1, art: 'spurt' }));
    assert.equal(p.eingaben.length, 4);
    assert.deepEqual(
      p.eingaben.map((e) => [e.sitz, e.art]),
      [
        [0, 'richtung'],
        [0, 'greifen'],
        [1, 'werken'],
        [1, 'spurt'],
      ],
    );
  });

  it('nimmt Stillstand (0,0) an, aber keine halbe Richtung', () => {
    let p = partie();
    p = verarbeite(p, 0, eingabe({ takt: 1, nr: 0, art: 'richtung', dx: 0, dy: 0 }));
    assert.equal(p.eingaben.length, 1);
    assert.throws(
      () => verarbeite(p, 0, eingabe({ takt: 2, nr: 1, art: 'richtung', dx: 0.5, dy: 0 })),
      RegelverstossError,
    );
  });

  it('weist unfertige Eingaben ab', () => {
    const p = partie();
    const schlecht: unknown[] = [
      { takt: -1, nr: 0, art: 'greifen' },
      { takt: 1.5, nr: 0, art: 'greifen' },
      { takt: 1, nr: -2, art: 'greifen' },
      { takt: 1, nr: 0, art: 'werken' },
      { takt: 1, nr: 0, art: 'tanzen' },
      null,
    ];
    for (const s of schlecht) {
      assert.throws(
        () => verarbeite(p, 0, { art: 'eingabe', eingabe: s as Eingabe }),
        RegelverstossError,
      );
    }
  });

  it('verwirft die zweite Eingabe mit derselben Nummer still — sie kommt vom Server zurueck', () => {
    let p = partie();
    p = verarbeite(p, 0, eingabe({ takt: 1, nr: 0, art: 'greifen' }));
    p = verarbeite(p, 0, eingabe({ takt: 1, nr: 0, art: 'greifen' }));
    assert.equal(p.eingaben.length, 1);
    // Derselbe Zaehler an einem anderen Sitz ist eine andere Eingabe.
    p = verarbeite(p, 1, eingabe({ takt: 1, nr: 0, art: 'greifen' }));
    assert.equal(p.eingaben.length, 2);
  });

  it('weist einen unbekannten Sitz ab', () => {
    const p = partie(2);
    assert.throws(() => verarbeite(p, 5, eingabe({ takt: 1, nr: 0, art: 'greifen' })), RegelverstossError);
  });

  it('nimmt nach dem Abschluss nichts mehr an', () => {
    let p = partie(1, 2);
    p = verarbeite(p, 0, { art: 'ergebnis', meldung: MELDUNG });
    assert.notEqual(p.ausgang, null);
    const nachher = verarbeite(p, 0, eingabe({ takt: 99, nr: 9, art: 'greifen' }));
    assert.equal(nachher.eingaben.length, 0);
  });
});

describe('Ergebnis und Abschluss', () => {
  it('schliesst ab, sobald alle menschlichen Sitze gemeldet haben', () => {
    let p = partie(2, 2, [1]);
    p = verarbeite(p, 0, { art: 'ergebnis', meldung: MELDUNG });
    assert.deepEqual(p.ausgang, { punkte: 120, sterne: [2, 3], strittig: false });
  });

  it('wartet auf den zweiten Menschen', () => {
    let p = partie(2, 2);
    p = verarbeite(p, 0, { art: 'ergebnis', meldung: MELDUNG });
    assert.equal(p.ausgang, null);
    p = verarbeite(p, 1, { art: 'ergebnis', meldung: MELDUNG });
    assert.equal(p.ausgang?.punkte, 120);
  });

  it('nimmt bei verschiedenen Meldungen die haeufigste und nennt den Ausgang strittig', () => {
    let p = partie(3, 2);
    p = verarbeite(p, 0, { art: 'ergebnis', meldung: MELDUNG });
    p = verarbeite(p, 1, { art: 'ergebnis', meldung: { punkte: 80, sterne: [1, 1], pruef: 'xyz' } });
    p = verarbeite(p, 2, { art: 'ergebnis', meldung: MELDUNG });
    assert.equal(p.ausgang?.punkte, 120);
    assert.equal(p.ausgang?.strittig, true);
  });

  it('weist kaputte Meldungen ab — auch eine mit falscher Rundenzahl', () => {
    const p = partie(1, 2);
    const schlecht: unknown[] = [
      { punkte: 1.5, sterne: [1, 1], pruef: 'a' },
      { punkte: 10, sterne: [1], pruef: 'a' },
      { punkte: 10, sterne: [1, 9], pruef: 'a' },
      { punkte: 10, sterne: [1, 1], pruef: '' },
      null,
    ];
    for (const s of schlecht) {
      assert.throws(
        () => verarbeite(p, 0, { art: 'ergebnis', meldung: s as typeof MELDUNG }),
        RegelverstossError,
      );
    }
  });

  it('schliesst ohne jede Meldung mit null Punkten ab (Stillstand)', () => {
    const p = schliesseAb(partie(2, 3));
    assert.deepEqual(p.ausgang, { punkte: 0, sterne: [0, 0, 0], strittig: false });
  });
});

describe('Ausstieg', () => {
  it('merkt sich Sitz und Stelle in der Eingabeliste', () => {
    let p = partie(2);
    p = verarbeite(p, 0, eingabe({ takt: 1, nr: 0, art: 'greifen' }));
    p = ausstieg(p, 1);
    assert.deepEqual(p.ausstiege, [{ sitz: 1, abEingabe: 1 }]);
    // Zweimal aussteigen aendert nichts.
    assert.equal(ausstieg(p, 1).ausstiege.length, 1);
  });

  it('laesst die Uebrigen abschliessen — ein Ausgestiegener meldet nicht mehr', () => {
    let p = partie(2, 1);
    p = ausstieg(p, 1);
    p = verarbeite(p, 0, { art: 'ergebnis', meldung: { punkte: 40, sterne: [1], pruef: 'q' } });
    assert.equal(p.ausgang?.punkte, 40);
  });
});

describe('platzierungen', () => {
  it('setzt alle auf Platz 1 mit derselben Punktzahl — gekocht wird miteinander', () => {
    const p = platzierungen({ punkte: 90, sterne: [2], strittig: false }, 3);
    assert.deepEqual(p, [
      { sitz: 0, platz: 1, punkte: 90 },
      { sitz: 1, platz: 1, punkte: 90 },
      { sitz: 2, platz: 1, punkte: 90 },
    ]);
  });

  it('ohne Ausgang null Punkte', () => {
    assert.deepEqual(platzierungen(null, 1), [{ sitz: 0, platz: 1, punkte: 0 }]);
  });
});
