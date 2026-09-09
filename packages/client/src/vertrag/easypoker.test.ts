import { type EasyPokerSicht as ModulSicht, easypoker } from '@brauweg/game-easypoker';
import { describe, expect, it } from 'vitest';

import type { EasyPokerSicht } from '../minispiele/easypoker/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Easy Poker und dem Modul.
 *
 * Poker ist der Fall, in dem der Bildschirm am wenigsten selbst weiß: Er
 * kennt nicht einmal den Begriff „großer Blind" — er zeigt Zahlen an, die er
 * bekommt. `zuZahlen` und `setzKosten` beschriften die Schaltflächen,
 * `meineStaerke` die eigene Hand, `ergebnis` die Abrechnung. Verschwindet
 * eines davon, steht am Tisch eine leere Zeile, und niemand kann sagen, ob
 * das an den Karten liegt.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<EasyPokerSicht, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof EasyPokerSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `EasyPokerSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'handNr',
  'handMax',
  'strasse',
  'brett',
  'meineKarten',
  'gegnerKarten',
  'gegnerVerdeckt',
  'fremdeKarten',
  'fremdeVerdeckt',
  'sitze',
  'imSpiel',
  'kleinerSitz',
  'grosserSitz',
  'meineStaerke',
  'jetons',
  'einsatz',
  'topf',
  'geber',
  'dran',
  'zuZahlen',
  'setzKosten',
  'letzteAktion',
  'ergebnis',
  'pauseMs',
  'kleinerBlind',
  'grosserBlind',
  'startJetons',
  'namen',
  'fertig',
  'sieger',
  'leftSeats',
  'zuschauer',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof EasyPokerSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof EasyPokerSicht>>;

describe('Vertrag Easy Poker', () => {
  // Sechs Sitze, weil online immer 6-max gespielt wird: `fremdeKarten` und
  // `fremdeVerdeckt` sind zu zweit zwar auch gefüllt, aber erst am vollen
  // Tisch sagen sie etwas.
  const gesehen = felderEinerPartie(easypoker as unknown as Spielmodul, { sitze: 6, runden: 1 });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('spielt weit genug, dass wirklich gesetzt wurde', () => {
    // Ohne diese Schranke wäre der Test oben wertlos: Die erste Sicht einer
    // frischen Hand trägt schon jeden Schlüssel.
    expect(gesehen.schritte).toBeGreaterThan(2);
  });
});
