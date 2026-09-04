import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BRETT_FELDER,
  DEFAULT_REGELN,
  type EinheitId,
  type Heer,
  type Kaempfer,
  type TafelrundePartie,
  type Stufe,
  erlaubteZuege,
  erstellePartie,
  fuehreAus,
  verschmelze,
} from '../src/index.js';

const SAAT = 'ffee0011223344556677889900aabbcc';

function k(id: EinheitId, stufe: Stufe = 1): Kaempfer {
  return { id, stufe };
}

function leer(laenge: number): (Kaempfer | null)[] {
  return new Array(laenge).fill(null);
}

/** Alles, was auf Bank und Brett steht, als flache Liste. */
function alle(...listen: readonly (readonly (Kaempfer | null)[])[]): Kaempfer[] {
  return listen.flat().filter((x): x is Kaempfer => x !== null);
}

function mitHeer(
  partie: TafelrundePartie,
  sitz: number,
  teil: Partial<Heer>,
): TafelrundePartie {
  return { ...partie, heere: { ...partie.heere, [sitz]: { ...partie.heere[sitz]!, ...teil } } };
}

describe('Verschmelzen', () => {
  it('macht aus drei gleichen der Stufe 1 eine der Stufe 2', () => {
    const bank = leer(9);
    bank[0] = k('dorfwache');
    bank[1] = k('dorfwache');
    bank[2] = k('dorfwache');

    const raus = verschmelze(leer(BRETT_FELDER), bank);
    assert.equal(raus.verschmolzen, 1);
    assert.deepEqual(alle(raus.bank, raus.brett), [k('dorfwache', 2)]);
  });

  it('verschmilzt nur, was WIRKLICH gleich ist', () => {
    const bank = leer(9);
    bank[0] = k('dorfwache');
    bank[1] = k('dorfwache');
    bank[2] = k('schildknappe');
    // Auch verschiedene STUFEN derselben Einheit verschmelzen nicht: Sonst
    // waere eine Stufe-2-Einheit plus zwei Karten so viel wert wie drei.
    bank[3] = k('dorfwache', 2);

    const raus = verschmelze(leer(BRETT_FELDER), bank);
    assert.equal(raus.verschmolzen, 0);
    assert.equal(alle(raus.bank).length, 4);
  });

  it('loest die Kettenreaktion aus: neun gleiche ergeben EINE der Stufe 3', () => {
    // Der Fall, der zaehlt. Ohne die Schleife bekaeme man drei Einheiten der
    // Stufe 2 und muesste sie von Hand weiterverschmelzen — was gar nicht
    // ginge, weil das automatisch passiert.
    const bank = leer(9).map(() => k('gassendieb'));
    const raus = verschmelze(leer(BRETT_FELDER), bank);
    assert.equal(raus.verschmolzen, 4, 'dreimal Stufe 2, einmal Stufe 3');
    assert.deepEqual(alle(raus.bank, raus.brett), [k('gassendieb', 3)]);
  });

  it('laesst den Rest liegen, wenn es fuer die naechste Stufe nicht reicht', () => {
    // Acht gleiche: zwei verschmelzen zu Stufe 2, zwei bleiben auf Stufe 1,
    // und zwei Stufe-2-Einheiten sind noch keine Stufe 3.
    const bank = leer(9);
    for (let i = 0; i < 8; i++) bank[i] = k('irrlicht');
    const raus = verschmelze(leer(BRETT_FELDER), bank);
    const stand = alle(raus.bank, raus.brett);
    assert.equal(stand.filter((e) => e.stufe === 2).length, 2);
    assert.equal(stand.filter((e) => e.stufe === 1).length, 2);
  });

  it('geht ueber Bank UND Brett hinweg', () => {
    // Sonst muesste man vor jedem Kauf erst aufraeumen.
    const brett = leer(BRETT_FELDER);
    brett[3] = k('nachtpfeil');
    const bank = leer(9);
    bank[0] = k('nachtpfeil');
    bank[1] = k('nachtpfeil');

    const raus = verschmelze(brett, bank);
    assert.equal(raus.verschmolzen, 1);
    // Und das Ergebnis bleibt auf dem BRETT: Wer eine Einheit aufgestellt
    // hat, will sie danach nicht auf der Bank suchen muessen.
    assert.deepEqual(raus.brett[3], k('nachtpfeil', 2));
    assert.deepEqual(alle(raus.bank), []);
  });

  it('geht auf der Bank nicht ueber die hoechste Stufe hinaus', () => {
    const bank = leer(9);
    for (let i = 0; i < 3; i++) bank[i] = k('wurzelriese', 3);
    const raus = verschmelze(leer(BRETT_FELDER), bank);
    assert.equal(raus.verschmolzen, 0);
    assert.equal(alle(raus.bank).length, 3);
  });

  it('ist bestimmt: dieselbe Ausgangslage ergibt immer dasselbe', () => {
    const brett = leer(BRETT_FELDER);
    brett[7] = k('frostweberin');
    const bank = leer(9);
    for (let i = 0; i < 5; i++) bank[i] = k('frostweberin');
    assert.deepEqual(verschmelze(brett, bank), verschmelze(brett, bank));
  });
});

describe('Kaufen und Verschmelzen', () => {
  const dreiZumVollen = (partie: TafelrundePartie): TafelrundePartie => {
    // Bank randvoll: zwei Kopien der Zieleinheit und sieben verschiedene
    // andere, damit nichts unbeabsichtigt mitverschmilzt.
    const bank: (Kaempfer | null)[] = [
      k('dorfwache'),
      k('dorfwache'),
      k('schildknappe'),
      k('astschuetze'),
      k('steinschleuderer'),
      k('funkenlehrling'),
      k('irrlicht'),
      k('gassendieb'),
      k('moosheiler'),
    ];
    const laden: (EinheitId | null)[] = ['dorfwache', null, null, null, null];
    return mitHeer(partie, 0, { bank, laden, gold: 10 });
  };

  it('erlaubt bei voller Bank den Kauf, der sofort verschmilzt', () => {
    // Ohne diese Ausnahme stuende man mit vollem Beutel vor der dritten
    // Kopie und koennte sie nicht holen, obwohl sie nirgends Platz braucht.
    const partie = dreiZumVollen(erstellePartie(DEFAULT_REGELN, [0, 1], SAAT));
    assert.ok(
      erlaubteZuege(partie, 0).some((z) => z.typ === 'kaufen' && z.platz === 0),
      'Der Kauf steht nicht in den erlaubten Zuegen',
    );

    const nachher = fuehreAus(partie, 0, { typ: 'kaufen', platz: 0 });
    const heer = nachher.heere[0]!;
    assert.equal(heer.bank.length, DEFAULT_REGELN.bankPlaetze);
    assert.equal(alle(heer.bank).filter((e) => e.id === 'dorfwache').length, 1);
    assert.deepEqual(
      alle(heer.bank).find((e) => e.id === 'dorfwache'),
      k('dorfwache', 2),
    );
    assert.equal(heer.gold, 9, 'Eine Dorfwache kostet 1 Gold');
  });

  it('verbietet bei voller Bank den Kauf, der nichts verschmilzt', () => {
    const roh = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    const bank: (Kaempfer | null)[] = [
      k('dorfwache'),
      k('schildknappe'),
      k('astschuetze'),
      k('steinschleuderer'),
      k('funkenlehrling'),
      k('irrlicht'),
      k('gassendieb'),
      k('moosheiler'),
      k('grimmbart'),
    ];
    const partie = mitHeer(roh, 0, {
      bank,
      laden: ['hainwaechterin', null, null, null, null],
      gold: 10,
    });

    assert.ok(!erlaubteZuege(partie, 0).some((z) => z.typ === 'kaufen'));
    assert.throws(() => fuehreAus(partie, 0, { typ: 'kaufen', platz: 0 }), /Platz/);
  });

  it('verbietet den Kauf ohne genug Gold', () => {
    const roh = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    const partie = mitHeer(roh, 0, {
      laden: ['sturmrufer', null, null, null, null],
      gold: 2,
    });
    assert.ok(!erlaubteZuege(partie, 0).some((z) => z.typ === 'kaufen'));
    assert.throws(() => fuehreAus(partie, 0, { typ: 'kaufen', platz: 0 }), /Gold/);
  });

  it('nimmt keinen leeren Ladenplatz', () => {
    const roh = erstellePartie(DEFAULT_REGELN, [0, 1], SAAT);
    const partie = mitHeer(roh, 0, { laden: [null, null, null, null, null], gold: 10 });
    assert.throws(() => fuehreAus(partie, 0, { typ: 'kaufen', platz: 0 }), /leer/);
    assert.throws(() => fuehreAus(partie, 0, { typ: 'kaufen', platz: 99 }), /gibt es nicht/);
  });
});
