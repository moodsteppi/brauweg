import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EINHEITEN,
  einheitVonId,
  type Exemplar,
  HOECHSTE_STUFE,
  JE_VERSCHMELZUNG,
  STUFEN_FAKTOR,
  bausteine,
  bausteineGesamt,
  type Stufe,
  verschmelze,
  werte,
  werteVonExemplar,
  zaehle,
} from '../src/index.js';

/** n Exemplare derselben Einheit auf derselben Stufe. */
function viele(einheitId: string, anzahl: number, stufe: Stufe = 1): Exemplar[] {
  return Array.from({ length: anzahl }, () => ({ einheitId, stufe }));
}

/** Kurzschreibweise fuer die Probe: was steht am Ende da? */
function abbild(bestand: readonly Exemplar[]): string[] {
  return bestand.map((e) => `${e.einheitId}@${e.stufe}`);
}

describe('Verschmelzen: der einfache Fall', () => {
  it('laesst zwei gleiche in Ruhe', () => {
    const ergebnis = verschmelze(viele('moosbart', 2));
    assert.deepEqual(abbild(ergebnis.bestand), ['moosbart@1', 'moosbart@1']);
    assert.deepEqual(ergebnis.verschmelzungen, []);
  });

  it('macht aus drei gleichen eine der naechsten Stufe', () => {
    const ergebnis = verschmelze(viele('moosbart', 3));
    assert.deepEqual(abbild(ergebnis.bestand), ['moosbart@2']);
    assert.deepEqual(ergebnis.verschmelzungen, [
      { einheitId: 'moosbart', vonStufe: 1, nachStufe: 2 },
    ]);
  });

  it('laesst den Rest liegen: vier gleiche ergeben eine Stufe 2 und eine Stufe 1', () => {
    const ergebnis = verschmelze(viele('wildherz', 4));
    assert.deepEqual(abbild(ergebnis.bestand), ['wildherz@2', 'wildherz@1']);
    assert.equal(ergebnis.verschmelzungen.length, 1);
  });

  it('verschmilzt verschiedene Einheiten nicht miteinander', () => {
    const bestand: Exemplar[] = [
      { einheitId: 'moosbart', stufe: 1 },
      { einheitId: 'wildherz', stufe: 1 },
      { einheitId: 'sturmrufer', stufe: 1 },
    ];
    const ergebnis = verschmelze(bestand);
    assert.deepEqual(abbild(ergebnis.bestand), ['moosbart@1', 'wildherz@1', 'sturmrufer@1']);
    assert.deepEqual(ergebnis.verschmelzungen, []);
  });

  it('verschmilzt verschiedene Stufen derselben Einheit nicht miteinander', () => {
    const bestand: Exemplar[] = [
      { einheitId: 'moosbart', stufe: 1 },
      { einheitId: 'moosbart', stufe: 2 },
      { einheitId: 'moosbart', stufe: 1 },
    ];
    const ergebnis = verschmelze(bestand);
    assert.deepEqual(abbild(ergebnis.bestand), ['moosbart@1', 'moosbart@2', 'moosbart@1']);
    assert.deepEqual(ergebnis.verschmelzungen, []);
  });
});

describe('Verschmelzen: die Kettenreaktion', () => {
  it('macht aus neun Stufe-1 eine Stufe-3 in vier Schritten', () => {
    const ergebnis = verschmelze(viele('schildknappe', 9));
    assert.deepEqual(abbild(ergebnis.bestand), ['schildknappe@3']);
    assert.deepEqual(ergebnis.verschmelzungen, [
      { einheitId: 'schildknappe', vonStufe: 1, nachStufe: 2 },
      { einheitId: 'schildknappe', vonStufe: 1, nachStufe: 2 },
      { einheitId: 'schildknappe', vonStufe: 1, nachStufe: 2 },
      { einheitId: 'schildknappe', vonStufe: 2, nachStufe: 3 },
    ]);
  });

  it('macht aus drei Stufe-2 eine Stufe-3', () => {
    const ergebnis = verschmelze(viele('frostkuender', 3, 2));
    assert.deepEqual(abbild(ergebnis.bestand), ['frostkuender@3']);
    assert.deepEqual(ergebnis.verschmelzungen, [
      { einheitId: 'frostkuender', vonStufe: 2, nachStufe: 3 },
    ]);
  });

  it('zieht die letzte Karte nach: zwei Stufe-2 plus drei Stufe-1 ergeben eine Stufe-3', () => {
    // Genau der Fall am Tisch: Es liegen schon zwei Sterne-Zweier, und der
    // dritte entsteht erst durch den gerade getaetigten Kauf.
    const bestand = [...viele('klingentaenzer', 2, 2), ...viele('klingentaenzer', 3, 1)];
    const ergebnis = verschmelze(bestand);
    assert.deepEqual(abbild(ergebnis.bestand), ['klingentaenzer@3']);
    assert.equal(ergebnis.verschmelzungen.length, 2);
  });

  it('verschmilzt ueber die hoechste Stufe hinaus nicht', () => {
    const ergebnis = verschmelze(viele('erzwaechter', 6, HOECHSTE_STUFE));
    assert.equal(ergebnis.bestand.length, 6);
    assert.deepEqual(ergebnis.verschmelzungen, []);
    assert.ok(ergebnis.bestand.every((e) => e.stufe === 3));
  });

  it('raeumt einen gemischten Bestand in einem Durchgang auf', () => {
    const bestand = [
      ...viele('moosbart', 9),
      ...viele('wildherz', 4),
      ...viele('sturmrufer', 2),
      ...viele('frostkuender', 3, 2),
    ];
    const ergebnis = verschmelze(bestand);
    const gezaehlt = zaehle(ergebnis.bestand);
    assert.equal(gezaehlt.get('moosbart@3'), 1);
    assert.equal(gezaehlt.get('wildherz@2'), 1);
    assert.equal(gezaehlt.get('wildherz@1'), 1);
    assert.equal(gezaehlt.get('sturmrufer@1'), 2);
    assert.equal(gezaehlt.get('frostkuender@3'), 1);
    assert.equal(ergebnis.bestand.length, 6);
  });
});

describe('Verschmelzen: Reihenfolge und Reinheit', () => {
  it('setzt die verschmolzene Einheit an die Stelle der ersten von dreien', () => {
    const bestand: Exemplar[] = [
      { einheitId: 'wildherz', stufe: 1 },
      { einheitId: 'moosbart', stufe: 1 },
      { einheitId: 'moosbart', stufe: 1 },
      { einheitId: 'sturmrufer', stufe: 1 },
      { einheitId: 'moosbart', stufe: 1 },
    ];
    const ergebnis = verschmelze(bestand);
    assert.deepEqual(abbild(ergebnis.bestand), ['wildherz@1', 'moosbart@2', 'sturmrufer@1']);
  });

  it('veraendert den uebergebenen Bestand nicht', () => {
    const bestand = viele('moosbart', 9);
    const vorher = abbild(bestand);
    verschmelze(bestand);
    assert.deepEqual(abbild(bestand), vorher);
    assert.equal(bestand.length, 9);
  });

  it('gibt bei nichts zu tun ein neues, gleiches Feld zurueck', () => {
    const bestand = viele('moosbart', 2);
    const ergebnis = verschmelze(bestand);
    assert.notEqual(ergebnis.bestand, bestand);
    assert.deepEqual(abbild(ergebnis.bestand), abbild(bestand));
  });

  it('liefert bei gleichem Bestand zweimal dasselbe Ergebnis', () => {
    // Grundsatz 1 aus game-api: Gleicher Zustand, gleiches Ergebnis. Hier ohne
    // Saat pruefbar, weil das Verschmelzen selbst gar nicht wuerfelt.
    const bestand = [
      ...viele('moosbart', 5),
      ...viele('wildherz', 3),
      ...viele('moosbart', 4),
    ];
    const eins = verschmelze(bestand);
    const zwei = verschmelze(bestand);
    assert.deepEqual(abbild(eins.bestand), abbild(zwei.bestand));
    assert.deepEqual(eins.verschmelzungen, zwei.verschmelzungen);
  });

  it('ist stabil, wenn man es zweimal hintereinander laufen laesst', () => {
    const einmal = verschmelze(viele('moosbart', 9));
    const zweimal = verschmelze(einmal.bestand);
    assert.deepEqual(abbild(zweimal.bestand), abbild(einmal.bestand));
    assert.deepEqual(zweimal.verschmelzungen, []);
  });
});

describe('Verschmelzen: Bausteine', () => {
  it('rechnet eine Stufe in Stufe-1-Karten um', () => {
    assert.equal(bausteine(1), 1);
    assert.equal(bausteine(2), JE_VERSCHMELZUNG);
    assert.equal(bausteine(3), JE_VERSCHMELZUNG * JE_VERSCHMELZUNG);
  });

  it('haelt die Zahl der Karten ueber das Verschmelzen hinweg konstant', () => {
    // Verschmelzen darf nie Karten erzeugen oder vernichten - sonst stimmt
    // die Vorratsrechnung nicht mehr.
    const bestand = [...viele('moosbart', 9), ...viele('wildherz', 7), ...viele('sturmrufer', 3, 2)];
    const ergebnis = verschmelze(bestand);
    assert.equal(bausteineGesamt(ergebnis.bestand), bausteineGesamt(bestand));
    assert.equal(bausteineGesamt(bestand), 9 + 7 + 9);
  });
});

describe('Werte je Stufe', () => {
  it('skaliert Leben und Angriff nicht linear', () => {
    assert.equal(STUFEN_FAKTOR[1], 1);
    assert.equal(STUFEN_FAKTOR[2], 1.8);
    assert.equal(STUFEN_FAKTOR[3], 3.2);

    const moosbart = einheitVonId('moosbart');
    assert.equal(werte(moosbart, 1).leben, 550);
    assert.equal(werte(moosbart, 2).leben, 990); // 550 * 1,8
    assert.equal(werte(moosbart, 3).leben, 1760); // 550 * 3,2
    assert.equal(werte(moosbart, 2).angriff, 72); // 40 * 1,8
    assert.equal(werte(moosbart, 3).angriff, 128); // 40 * 3,2
  });

  it('laesst Tempo, Reichweite und Ruestung unveraendert', () => {
    const erzwaechter = einheitVonId('erzwaechter');
    for (const stufe of [1, 2, 3] as const) {
      const w = werte(erzwaechter, stufe);
      assert.equal(w.tempo, erzwaechter.tempo);
      assert.equal(w.reichweite, erzwaechter.reichweite);
      assert.equal(w.ruestung, erzwaechter.ruestung);
    }
  });

  it('liefert fuer jede Einheit auf jeder Stufe ganze Zahlen', () => {
    for (const einheit of EINHEITEN) {
      for (const stufe of [1, 2, 3] as const) {
        const w = werte(einheit, stufe);
        assert.ok(Number.isInteger(w.leben), `${einheit.id}@${stufe}: Leben ${w.leben}`);
        assert.ok(Number.isInteger(w.angriff), `${einheit.id}@${stufe}: Angriff ${w.angriff}`);
      }
    }
  });

  it('kommt auch ueber ein Exemplar an die Werte', () => {
    const direkt = werte(einheitVonId('sturmrufer'), 2);
    const ueberExemplar = werteVonExemplar({ einheitId: 'sturmrufer', stufe: 2 });
    assert.deepEqual(ueberExemplar, direkt);
  });

  it('wirft bei einer unbekannten Kennung', () => {
    assert.throws(() => werteVonExemplar({ einheitId: 'gibtsnicht', stufe: 1 }), /Unbekannte Einheit/);
  });
});
