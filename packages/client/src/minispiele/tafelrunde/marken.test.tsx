import { describe, expect, it } from 'vitest';

/*
 * Die Synergie-Anzeige.
 *
 * Der eine Satz, um den es geht: Diese Anzeige RECHNET NICHT. Sie zeigt, was
 * das Spielmodul in die Sicht gelegt hat — Anzahl, erreichte Schwelle,
 * naechste Schwelle, Bonus. Genau das laesst sich pruefen, indem man ihr
 * Zahlen gibt, die sich NICHT nachrechnen lassen: Steht dann trotzdem da, was
 * die Sicht sagt, kann die Anzeige es nicht selbst ausgerechnet haben.
 *
 * Dazu die zweite Zusage aus der Aufgabe: Die Hervorhebung im Laden greift
 * genau bei Schwellenerreichen — nicht davor, nicht darueber hinaus.
 */

import {
  type Markentraeger,
  type Synergie,
  type Synergiestand,
  type Wertebonus,
  bonusSatz,
  markenFarbe,
  markennamen,
  schwellenPruefer,
  traegerVon,
  trifftSchwelle,
} from './marken';

function bonus(teil: Partial<Wertebonus> = {}): Wertebonus {
  return { lebenProzent: 0, angriffProzent: 0, tempoProzent: 0, ruestung: 0, ...teil };
}

/** Die Tabelle, wie sie einmalig mit der ersten Sicht kommt (synergien.ts). */
const TABELLE: Synergie[] = [
  {
    marke: 'krieger',
    name: 'Krieger',
    wirkung: 'Jeder Krieger bekommt Rüstung dazu.',
    stufen: [
      { schwelle: 2, bonus: bonus({ ruestung: 10 }) },
      { schwelle: 4, bonus: bonus({ ruestung: 20 }) },
      { schwelle: 6, bonus: bonus({ ruestung: 30 }) },
    ],
  },
  {
    marke: 'naturwesen',
    name: 'Naturwesen',
    wirkung: 'Jedes Naturwesen bekommt Leben dazu.',
    stufen: [
      { schwelle: 2, bonus: bonus({ lebenProzent: 15 }) },
      { schwelle: 4, bonus: bonus({ lebenProzent: 30 }) },
      { schwelle: 6, bonus: bonus({ lebenProzent: 50 }) },
    ],
  },
];

/**
 * Der Katalog, wie er mit der ersten Sicht kommt — nur die Felder, die das
 * Blatt braucht. Zwei Kriegereinheiten, eine davon mit zweiter Marke, und
 * eine, die die Marke gar nicht traegt.
 */
const KATALOG: Record<string, Markentraeger> = {
  dorfwache: { id: 'dorfwache', name: 'Dorfwache', kosten: 1, marken: ['krieger'] },
  hauptmann: { id: 'hauptmann', name: 'Hauptmann', kosten: 3, marken: ['krieger', 'waechter'] },
  wildling: { id: 'wildling', name: 'Wildling', kosten: 2, marken: ['naturwesen'] },
};

function stand(teil: Partial<Synergiestand> = {}): Synergiestand {
  return {
    marke: 'krieger',
    name: 'Krieger',
    anzahl: 3,
    schwelle: 2,
    naechsteSchwelle: 4,
    bonus: bonus({ ruestung: 10 }),
    ...teil,
  };
}

// ---------------------------------------------------------------------------

describe('bonusSatz', () => {
  it('nennt jeden Wert mit seiner Einheit — Prozent bei dreien, Punkte bei der Rüstung', () => {
    expect(bonusSatz(bonus({ lebenProzent: 15 }))).toBe('+15 % Leben');
    expect(bonusSatz(bonus({ ruestung: 10 }))).toBe('+10 Rüstung');
    expect(bonusSatz(bonus({ angriffProzent: 25, tempoProzent: 10 }))).toBe(
      '+25 % Angriff · +10 % Tempo',
    );
  });

  it('lässt weg, was null ist — sonst stünde an jeder Marke dreimal +0 %', () => {
    expect(bonusSatz(bonus())).toBe('');
    expect(bonusSatz(bonus({ lebenProzent: 10, ruestung: 5 }))).toBe(
      '+10 % Leben · +5 Rüstung',
    );
  });

  it('verträgt den fehlenden Bonus unterhalb der ersten Schwelle', () => {
    expect(bonusSatz(null)).toBe('');
  });
});

describe('trifftSchwelle', () => {
  it('greift genau dann, wenn der nächste Träger die Schwelle voll macht', () => {
    // 3 von 4: der Kauf macht die vier voll.
    expect(trifftSchwelle('krieger', [stand({ anzahl: 3, naechsteSchwelle: 4 })], TABELLE)).toBe(
      true,
    );
    // 2 von 4: danach sind es drei, die Schwelle bleibt offen.
    expect(
      trifftSchwelle('krieger', [stand({ anzahl: 2, naechsteSchwelle: 4 })], TABELLE),
    ).toBe(false);
  });

  it('eine Einheit, die schon gezaehlt ist, bringt die Marke nicht voran', () => {
    /*
     * Seit dem 27.11.2026 nachts zaehlt jede Einheit fuer eine Marke nur
     * einmal (Robin). 1 von 2 mit der Pinguinwache: Eine zweite Pinguinwache
     * fuellt nichts, ein anderer Krieger schon. Die Liste kommt aus der Sicht
     * (`traeger`), gezaehlt wird hier nichts.
     */
    const staende = [stand({ anzahl: 1, naechsteSchwelle: 2, traeger: ['dorfwache'] })];
    expect(trifftSchwelle('krieger', staende, TABELLE, 'dorfwache')).toBe(false);
    expect(trifftSchwelle('krieger', staende, TABELLE, 'grimmbart')).toBe(true);
    // Ohne Kennung bleibt es die alte Frage „irgendein neuer Traeger".
    expect(trifftSchwelle('krieger', staende, TABELLE)).toBe(true);
    expect(schwellenPruefer(staende, TABELLE)('krieger', 'dorfwache')).toBe(false);
  });

  it('greift auch bei der ersten Schwelle, obwohl die Marke noch gar nicht in der Sicht steht', () => {
    /*
     * Das Modul schickt nur Marken mit mindestens einem Traeger. Bei genau
     * einem steht die Marke also drin (1 + 1 >= 2 → wahr), bei keinem fehlt
     * sie — und dann darf auch nichts leuchten, denn aus null wird eins.
     */
    expect(trifftSchwelle('krieger', [stand({ anzahl: 1, naechsteSchwelle: 2 })], TABELLE)).toBe(
      true,
    );
    expect(trifftSchwelle('krieger', [], TABELLE)).toBe(false);
  });

  it('leuchtet nicht mehr, wenn es über der höchsten Schwelle nichts zu holen gibt', () => {
    expect(
      trifftSchwelle('krieger', [stand({ anzahl: 6, schwelle: 6, naechsteSchwelle: null })], TABELLE),
    ).toBe(false);
  });

  it('nimmt die erste Schwelle aus der Tabelle und nicht aus einer 2 im Client', () => {
    // Dieselbe Marke, aber eine Tabelle mit verschobenen Stufen: Bei einer
    // ersten Schwelle von 3 macht der zweite Träger sie noch nicht voll.
    const verschoben: Synergie[] = [
      {
        marke: 'drache',
        name: 'Drache',
        wirkung: 'Jeder Drache schlägt härter zu.',
        stufen: [{ schwelle: 3, bonus: bonus({ ruestung: 5 }) }],
      },
    ];
    expect(trifftSchwelle('drache', [], verschoben)).toBe(false);
    expect(
      trifftSchwelle('drache', [stand({ marke: 'drache', anzahl: 2, naechsteSchwelle: 3 })], verschoben),
    ).toBe(true);
  });

  it('kennt eine Marke ohne Eintrag in der Tabelle nicht und behauptet nichts', () => {
    expect(trifftSchwelle('einhorn', [], TABELLE)).toBe(false);
  });

  it('schwellenPruefer bindet dieselbe Frage einmal', () => {
    const pruefer = schwellenPruefer([stand({ anzahl: 3, naechsteSchwelle: 4 })], TABELLE);
    expect(pruefer('krieger')).toBe(true);
    expect(pruefer('naturwesen')).toBe(false);
  });
});

describe('traegerVon', () => {
  it('nennt alle Einheiten der Marke, die Günstigsten zuerst', () => {
    // ALLE, nicht nur die eigenen: Die Frage des Blattes ist, was man noch
    // kaufen müsste.
    expect(traegerVon(KATALOG, 'krieger').map((e) => e.name)).toEqual([
      'Dorfwache',
      'Hauptmann',
    ]);
  });

  it('zählt eine Einheit für jede ihrer Marken', () => {
    expect(traegerVon(KATALOG, 'waechter').map((e) => e.name)).toEqual(['Hauptmann']);
  });

  it('bleibt ohne Katalog leer, statt eine Liste zu erfinden', () => {
    expect(traegerVon({}, 'krieger')).toEqual([]);
  });
});

describe('markennamen und markenFarbe', () => {
  it('liest die Namen aus der Tabelle und hat fuer eine unbekannte Marke eine Ersatzfarbe', () => {
    expect(markennamen(TABELLE)).toEqual({ krieger: 'Krieger', naturwesen: 'Naturwesen' });
    expect(markenFarbe('krieger')).toMatch(/^#/);
    expect(markenFarbe('gibtsnicht')).toBe('#8fa3ad');
  });
});
