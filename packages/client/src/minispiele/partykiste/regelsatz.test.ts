import { describe, expect, it } from 'vitest';

import { MINISPIEL_NAME, ansageFuer, liesRegelsatz, zaehlerWort, type PartyMinispiel, type PartykisteSicht } from './sicht';
import { binReihumDran } from './useTischwache';

/*
 * Der Alkoholfrei-Modus am Bildschirm (22.09.2026).
 *
 * Bis dahin blendete `trinkmodus: false` an drei Stellen ein 🍺 aus und liess
 * den Rest stehen — "Falsch heißt trinken" stand weiter ueber jeder Quizfrage.
 * Diese Tests halten die Woerter fest; ob die Aufgabentexte selbst sauber
 * sind, prueft das Modul (packages/game-partykiste/test/inhalte.test.ts).
 */

const ALLE = Object.keys(MINISPIEL_NAME) as PartyMinispiel[];

describe('Ansagen und Zaehler ohne Trinkmodus', () => {
  it('keine Ansage redet vom Trinken, wenn der Trinkmodus aus ist', () => {
    const treffer = ALLE.filter((art) => /trink|schluck|🍺/i.test(ansageFuer(art, false)));
    expect(treffer).toEqual([]);
  });

  it('mit Trinkmodus bleiben die bisherigen Ansagen unveraendert', () => {
    expect(ansageFuer('quiz', true)).toBe('Eine Frage, vier Antworten. Falsch heißt trinken.');
  });

  it('der Zaehler heisst Schluck bzw. Strafpunkt, nie ein Glas', () => {
    expect([zaehlerWort(true, 1), zaehlerWort(true, 3)]).toEqual(['Schluck', 'Schlücke']);
    expect([zaehlerWort(false, 1), zaehlerWort(false, 3)]).toEqual(['Strafpunkt', 'Strafpunkte']);
  });
});

describe('Regelsatz vom Server lesen', () => {
  it('liest einen vollstaendigen Regelsatz', () => {
    expect(liesRegelsatz({ minispiele: ['quiz', 'imposter'], trinkmodus: false, schluckFaktor: 2 })).toEqual({
      minispiele: ['quiz', 'imposter'],
      trinkmodus: false,
      schluckFaktor: 2,
    });
  });

  it('liefert null statt erfundener Werte, wenn etwas fehlt', () => {
    expect(liesRegelsatz({})).toBeNull();
    expect(liesRegelsatz({ minispiele: ['quiz'], trinkmodus: 'ja', schluckFaktor: 1 })).toBeNull();
  });

  it('laesst unbekannte Minispiele weg, statt einen leeren Namen zu zeigen', () => {
    expect(liesRegelsatz({ minispiele: ['quiz', 'werwolf'], trinkmodus: true, schluckFaktor: 1 })?.minispiele).toEqual([
      'quiz',
    ]);
  });
});

describe('Wann das Handy summt', () => {
  const grund = {
    sitz: 2,
    phase: 'spiel',
    fertig: false,
  } as const;

  it('reihum und dran: ja', () => {
    const sicht = { ...grund, daten: { art: 'werbinich', amZug: 2 } } as unknown as PartykisteSicht;
    expect(binReihumDran(sicht)).toBe(true);
  });

  it('reihum, aber ein anderer ist dran: nein', () => {
    const sicht = { ...grund, daten: { art: 'busfahrer', amZug: 0 } } as unknown as PartykisteSicht;
    expect(binReihumDran(sicht)).toBe(false);
  });

  it('gleichzeitige Runde: nein, auch wenn das obere amZug zufaellig den eigenen Sitz nennt', () => {
    const sicht = { ...grund, amZug: 2, daten: { art: 'quiz' } } as unknown as PartykisteSicht;
    expect(binReihumDran(sicht)).toBe(false);
  });

  it('Zuschauer und Ergebnisphase: nein', () => {
    const zuschauer = { ...grund, sitz: -1, daten: { art: 'werbinich', amZug: -1 } } as unknown as PartykisteSicht;
    const ergebnis = { ...grund, phase: 'ergebnis', daten: { art: 'werbinich', amZug: 2 } } as unknown as PartykisteSicht;
    expect([binReihumDran(zuschauer), binReihumDran(ergebnis), binReihumDran(null)]).toEqual([false, false, false]);
  });
});
