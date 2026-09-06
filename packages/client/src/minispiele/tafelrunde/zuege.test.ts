import { describe, expect, it } from 'vitest';

import {
  type Aufstellung,
  type Kaempfer,
  type Ort,
  bestandVon,
  darfSchieben,
  fehlendeKopien,
  neuVerschmolzen,
  ortLesen,
  ortSchluessel,
  platzVon,
  rastermass,
  tippfolge,
  wabenLage,
} from './zuege';

/*
 * Die Rechnerei der Ruestkammer.
 *
 * Sie steht unter Pruefung, weil sie an genau der Stelle sitzt, an der ein
 * Fehler still bleibt: Ein Zug, den der Bildschirm faelschlich verbietet,
 * kommt nie beim Server an — er kommt beim Spieler an, als „geht nicht".
 */

const WACHE: Kaempfer = { id: 'dorfwache', stufe: 1 };
const SCHUETZE: Kaempfer = { id: 'astschuetze', stufe: 1 };

function aufstellung(teil: Partial<Aufstellung> = {}): Aufstellung {
  return {
    bank: [WACHE, null, null],
    brett: [null, null, null, null],
    feldplaetze: 3,
    belegt: 0,
    ...teil,
  };
}

const BANK0: Ort = { bereich: 'bank', platz: 0 };
const BRETT0: Ort = { bereich: 'brett', platz: 0 };
const BRETT1: Ort = { bereich: 'brett', platz: 1 };

describe('Orte lesen und schreiben', () => {
  it('geht verlustfrei hin und zurück', () => {
    expect(ortLesen(ortSchluessel(BRETT1))).toEqual(BRETT1);
    expect(ortLesen(ortSchluessel(BANK0))).toEqual(BANK0);
  });

  it('gibt null für alles, was kein Ort ist', () => {
    // Beim Ziehen liegt unter dem Finger oft irgendetwas anderes. Das ist der
    // Normalfall und darf nicht werfen.
    expect(ortLesen(undefined)).toBeNull();
    expect(ortLesen('')).toBeNull();
    expect(ortLesen('laden:2')).toBeNull();
    expect(ortLesen('brett:x')).toBeNull();
    expect(ortLesen('brett:-1')).toBeNull();
  });
});

describe('darfSchieben', () => {
  it('lässt von der Bank aufs freie Feld, solange ein Platz frei ist', () => {
    expect(darfSchieben(aufstellung(), BANK0, BRETT0)).toBe(true);
  });

  it('verbietet den letzten Schritt über die Feldgrenze', () => {
    const voll = aufstellung({ feldplaetze: 2, belegt: 2, brett: [WACHE, SCHUETZE, null, null] });
    expect(darfSchieben(voll, BANK0, { bereich: 'brett', platz: 2 })).toBe(false);
  });

  it('erlaubt bei vollem Brett trotzdem den Tausch', () => {
    // Wer sich verbaut hat, muss umbauen können — sonst ist ein volles Brett
    // ein Gefängnis. Der Tausch ändert die Belegung nicht.
    const voll = aufstellung({ feldplaetze: 2, belegt: 2, brett: [WACHE, SCHUETZE, null, null] });
    expect(darfSchieben(voll, BANK0, BRETT0)).toBe(true);
  });

  it('erlaubt bei vollem Brett den Weg zurück auf die Bank', () => {
    const voll = aufstellung({
      feldplaetze: 2,
      belegt: 2,
      bank: [null, null, null],
      brett: [WACHE, SCHUETZE, null, null],
    });
    expect(darfSchieben(voll, BRETT0, { bereich: 'bank', platz: 0 })).toBe(true);
  });

  it('bewegt nichts von einem leeren Platz und nicht auf sich selbst', () => {
    expect(darfSchieben(aufstellung(), { bereich: 'bank', platz: 1 }, BRETT0)).toBe(false);
    expect(darfSchieben(aufstellung(), BANK0, BANK0)).toBe(false);
  });
});

describe('tippfolge', () => {
  it('wählt eine besetzte Stelle aus', () => {
    expect(tippfolge(aufstellung(), null, BANK0)).toEqual({ art: 'waehlen', ort: BANK0 });
  });

  it('tut ohne Auswahl an einer leeren Stelle nichts', () => {
    expect(tippfolge(aufstellung(), null, BRETT0)).toEqual({ art: 'nichts' });
  });

  it('hebt die Auswahl auf, wenn dieselbe Stelle noch einmal kommt', () => {
    expect(tippfolge(aufstellung(), BANK0, BANK0)).toEqual({ art: 'abwaehlen' });
  });

  it('schiebt auf die zweite angetippte Stelle', () => {
    expect(tippfolge(aufstellung(), BANK0, BRETT0)).toEqual({
      art: 'schieben',
      von: BANK0,
      nach: BRETT0,
    });
  });

  it('gibt bei einem verbotenen Ziel die Auswahl frei, statt sie stehen zu lassen', () => {
    // Eine Auswahl, die nach einem Tipp weiterleuchtet, sieht aus, als wäre
    // der Tipp nicht angekommen.
    const voll = aufstellung({ feldplaetze: 1, belegt: 1, brett: [WACHE, null, null, null] });
    expect(tippfolge(voll, BANK0, BRETT1)).toEqual({ art: 'abwaehlen' });
  });
});

describe('Verschmelzen zählen', () => {
  it('zählt Bank und Brett zusammen', () => {
    const auf = aufstellung({ bank: [WACHE, WACHE, null], brett: [WACHE, null, null, null] });
    expect(bestandVon(auf).get('dorfwache@1')).toBe(3);
  });

  it('hält Stufen auseinander', () => {
    const auf = aufstellung({
      bank: [WACHE, { id: 'dorfwache', stufe: 2 }, null],
      brett: [null, null, null, null],
    });
    const bestand = bestandVon(auf);
    expect(bestand.get('dorfwache@1')).toBe(1);
    expect(bestand.get('dorfwache@2')).toBe(1);
  });

  it('rechnet die fehlenden Kopien mit der Zahl aus der Sicht', () => {
    const bestand = bestandVon(aufstellung({ bank: [WACHE, WACHE, null] }));
    expect(fehlendeKopien(bestand, 3, 'dorfwache')).toBe(1);
    // Dieselbe Lage bei einer anderen Verschmelzzahl ergibt eine andere
    // Antwort — genau deshalb ist die Zahl ein Parameter und keine 3.
    expect(fehlendeKopien(bestand, 4, 'dorfwache')).toBe(2);
    expect(fehlendeKopien(bestand, 3, 'astschuetze')).toBe(3);
  });
});

describe('neuVerschmolzen', () => {
  const leer = new Map<string, number>();

  it('erkennt die frisch entstandene Stufe 2', () => {
    const vorher = new Map([['dorfwache@1', 3]]);
    const jetzt = new Map([['dorfwache@2', 1]]);
    expect(neuVerschmolzen(vorher, jetzt)).toEqual({ id: 'dorfwache', stufe: 2 });
  });

  it('meldet einen gewöhnlichen Kauf nicht', () => {
    // Eine neue Stufe-1-Einheit entsteht durch Kaufen. Wer sie als
    // Verschmelzung meldet, ruft bei jedem Kauf „verschmolzen".
    expect(neuVerschmolzen(leer, new Map([['dorfwache@1', 1]]))).toBeNull();
  });

  it('meldet nichts, wenn eine Einheit nur von der Bank aufs Feld wandert', () => {
    const gleich = new Map([['dorfwache@2', 1]]);
    expect(neuVerschmolzen(gleich, new Map(gleich))).toBeNull();
  });

  it('meldet nichts beim Verkaufen', () => {
    expect(neuVerschmolzen(new Map([['dorfwache@2', 2]]), new Map([['dorfwache@2', 1]]))).toBeNull();
  });

  it('kommt mit einem @ in der Kennung zurecht', () => {
    // Heute hat keine Einheit eins. Der Schlüssel wird trotzdem von hinten
    // getrennt: Ein Katalogeintrag mit @ im Namen ergäbe sonst die Stufe NaN
    // und eine Meldung, die nie wieder verschwindet.
    expect(neuVerschmolzen(leer, new Map([['dorf@wache@3', 1]]))).toEqual({
      id: 'dorf@wache',
      stufe: 3,
    });
  });
});

describe('Rastermaß', () => {
  it('füllt den Behälter genau aus', () => {
    const mass = rastermass(2, 5);
    // Die letzte Reihe endet unten bündig, die letzte Spalte der versetzten
    // Reihe rechts bündig. Bleibt Luft, hängt das Brett schief im Rahmen.
    const untenLinks = wabenLage(mass, 1, 4);
    expect(untenLinks.oben + mass.wabenHoehe).toBeCloseTo(100, 6);
    expect(untenLinks.links + mass.wabenBreite).toBeCloseTo(100, 6);
    const obenLinks = wabenLage(mass, 0, 0);
    expect(obenLinks.links).toBe(0);
    expect(obenLinks.oben).toBe(0);
  });

  it('versetzt nur die ungeraden Reihen, und zwar um eine halbe Wabe', () => {
    const mass = rastermass(4, 5);
    expect(wabenLage(mass, 0, 0).links).toBe(0);
    expect(wabenLage(mass, 1, 0).links).toBeCloseTo(mass.wabenBreite / 2, 6);
    expect(wabenLage(mass, 2, 0).links).toBe(0);
  });

  it('lässt die Reihen ineinandergreifen', () => {
    // Ohne die drei Viertel stehen die Sechsecke untereinander statt
    // versetzt — dann ist es ein Schachbrett mit schrägen Ecken.
    const mass = rastermass(4, 5);
    expect(wabenLage(mass, 1, 0).oben).toBeCloseTo(0.75 * mass.wabenHoehe, 6);
  });
});

describe('platzVon', () => {
  it('lässt das eigene Brett, wie es ist', () => {
    expect(platzVon(0, 2, 5, false)).toBe(0);
    expect(platzVon(9, 2, 5, false)).toBe(9);
  });

  it('dreht das gegnerische Brett um 180 Grad', () => {
    expect(platzVon(0, 2, 5, true)).toBe(9);
    expect(platzVon(9, 2, 5, true)).toBe(0);
  });

  it('ist beim Spiegeln seine eigene Umkehrung', () => {
    for (let i = 0; i < 10; i++) {
      expect(platzVon(platzVon(i, 2, 5, true), 2, 5, true)).toBe(i);
    }
  });
});
