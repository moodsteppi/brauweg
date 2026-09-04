import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GRUNDEINKOMMEN,
  HOECHSTES_LEVEL,
  type Level,
  PREIS_LEVEL_AUF,
  PREIS_NEU_WUERFELN,
  SERIEN_STAFFEL,
  STARTGOLD,
  STARTLEVEL,
  ZINS_HOECHSTENS,
  ZINS_JE,
  einheitVonId,
  einkommen,
  kannZahlen,
  preisKaufen,
  preisKaufenVonId,
  preisLevelAuf,
  serieNach,
  serienBonus,
  verkaufsWert,
  zahle,
  zins,
} from '../src/index.js';

const LEVEL: readonly Level[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('Gold: Zins', () => {
  it('gibt ein Gold je volle zehn auf der Hand', () => {
    assert.equal(zins(0), 0);
    assert.equal(zins(9), 0);
    assert.equal(zins(10), 1);
    assert.equal(zins(19), 1);
    assert.equal(zins(20), 2);
    assert.equal(zins(30), 3);
  });

  it('deckelt bei fuenf', () => {
    assert.equal(zins(50), ZINS_HOECHSTENS);
    assert.equal(zins(100), ZINS_HOECHSTENS);
    assert.equal(zins(1000), ZINS_HOECHSTENS);
  });

  it('rechnet nicht mit negativem Gold', () => {
    // Kommt nicht vor - `zahle` laesst es gar nicht zu -, waere aber ein
    // boeser Fehler: Ein negativer Zins zoege Gold ab.
    assert.equal(zins(-30), 0);
  });

  it('haelt die Stellschrauben aus dem Konzept', () => {
    assert.equal(ZINS_JE, 10);
    assert.equal(ZINS_HOECHSTENS, 5);
    assert.equal(GRUNDEINKOMMEN, 5);
  });
});

describe('Gold: Serienbonus', () => {
  it('zahlt fuer Siege und Niederlagen dasselbe', () => {
    for (let laenge = 0; laenge <= 8; laenge++) {
      assert.equal(serienBonus(laenge), serienBonus(-laenge), `Laenge ${laenge}`);
    }
  });

  it('folgt der Staffel', () => {
    assert.equal(serienBonus(0), 0);
    assert.equal(serienBonus(1), 0);
    assert.equal(serienBonus(2), 1);
    assert.equal(serienBonus(3), 1);
    assert.equal(serienBonus(4), 2);
    assert.equal(serienBonus(5), 2);
    assert.equal(serienBonus(6), 3);
    assert.equal(serienBonus(20), 3);
  });

  it('haelt die Staffel aufsteigend - sonst gewaenne die falsche Zeile', () => {
    for (let i = 1; i < SERIEN_STAFFEL.length; i++) {
      assert.ok(SERIEN_STAFFEL[i].ab > SERIEN_STAFFEL[i - 1].ab);
      assert.ok(SERIEN_STAFFEL[i].gold > SERIEN_STAFFEL[i - 1].gold);
    }
  });

  it('schreibt die Serie fort und beginnt bei einem Wechsel neu', () => {
    assert.equal(serieNach(0, true), 1);
    assert.equal(serieNach(3, true), 4);
    assert.equal(serieNach(3, false), -1);
    assert.equal(serieNach(-2, false), -3);
    assert.equal(serieNach(-2, true), 1);
  });
});

describe('Gold: Einkommen', () => {
  it('schluesselt Grund, Zins und Serie einzeln auf', () => {
    const raus = einkommen(23, 4);
    assert.deepEqual(raus, { grund: 5, zins: 2, serie: 2, gesamt: 9 });
  });

  it('zaehlt die Aufschluesselung auch wirklich zusammen', () => {
    for (const gold of [0, 7, 10, 34, 88]) {
      for (const serie of [-6, -2, 0, 1, 5]) {
        const raus = einkommen(gold, serie);
        assert.equal(raus.gesamt, raus.grund + raus.zins + raus.serie, `${gold}/${serie}`);
      }
    }
  });

  it('gibt ohne Ersparnis und ohne Serie genau das Grundeinkommen', () => {
    assert.equal(einkommen(0, 0).gesamt, GRUNDEINKOMMEN);
  });
});

describe('Gold: Preise', () => {
  it('nimmt fuer eine Einheit ihre Kostenstufe', () => {
    assert.equal(preisKaufen(einheitVonId('moosbart')), 1);
    assert.equal(preisKaufenVonId('frostkuender'), 2);
    assert.equal(preisKaufenVonId('erzwaechter'), 3);
  });

  it('kostet zwei Gold fuer einen Wurf', () => {
    assert.equal(PREIS_NEU_WUERFELN, 2);
  });

  it('nennt fuer jedes Level ausser dem hoechsten einen Aufstiegspreis', () => {
    for (const level of LEVEL) {
      const preis = preisLevelAuf(level);
      if (level === HOECHSTES_LEVEL) assert.equal(preis, null, `Level ${level}`);
      else assert.equal(preis, PREIS_LEVEL_AUF[(level + 1) as Exclude<Level, 1>], `Level ${level}`);
    }
  });

  it('laesst den Aufstieg mit jedem Level teurer werden', () => {
    let vorher = 0;
    for (const level of LEVEL) {
      const preis = preisLevelAuf(level);
      if (preis === null) continue;
      assert.ok(preis > vorher, `Level ${level}: ${preis} nach ${vorher}`);
      vorher = preis;
    }
  });

  it('faengt mit Level 2 und drei Gold an', () => {
    // Level 1 haette genau einen Brettplatz - der erste Kampf waere ein
    // Muenzwurf ohne Entscheidung.
    assert.equal(STARTLEVEL, 2);
    assert.equal(STARTGOLD, 3);
  });
});

describe('Gold: Verkaufswert', () => {
  it('gibt genau das zurueck, was der Aufbau gekostet hat', () => {
    assert.equal(verkaufsWert({ einheitId: 'moosbart', stufe: 1 }), 1);
    assert.equal(verkaufsWert({ einheitId: 'moosbart', stufe: 2 }), 3);
    assert.equal(verkaufsWert({ einheitId: 'moosbart', stufe: 3 }), 9);
    assert.equal(verkaufsWert({ einheitId: 'erzwaechter', stufe: 2 }), 9);
    assert.equal(verkaufsWert({ einheitId: 'erzwaechter', stufe: 3 }), 27);
  });

  it('erzeugt kein Gold: verkaufen und neu kaufen ist ein Nullgeschaeft', () => {
    const preis = preisKaufenVonId('klingentaenzer') * 3;
    assert.equal(verkaufsWert({ einheitId: 'klingentaenzer', stufe: 2 }), preis);
  });
});

describe('Gold: Zahlen', () => {
  it('zieht ab, was gedeckt ist', () => {
    assert.equal(zahle(10, 3), 7);
    assert.equal(zahle(3, 3), 0);
  });

  it('wirft bei zu wenig Gold, statt still nichts zu tun', () => {
    assert.throws(() => zahle(1, 2), /Zu wenig Gold: 1 < 2/);
  });

  it('sagt vorher, ob es reicht', () => {
    assert.equal(kannZahlen(2, 2), true);
    assert.equal(kannZahlen(1, 2), false);
  });
});
