/**
 * Die Spielarten von Easy Poker — drei Einsaetze (Robin, 28.11.2026;
 * `GameMeta.spielarten` in game-api). Die erste ist die Vorgabe.
 *
 * Bis zum 28.11.2026 standen dieselben drei Zahlenreihen als
 * `EINSATZ_VORGABEN` im Bildschirm (EasyPoker.tsx). Jetzt kommen sie von
 * hier: Ein Einsatz ist ein Regelsatz, und der gehoert dem Modul. Der
 * Bildschirm darf weiter einen eigenen Einsatz zusammenstellen (Einsatzblatt);
 * das ist dann eine Wahl des Spielers, keine Abschrift.
 *
 * Eine Spielart kostet BroJetons: Die Plattform zieht `startJetons` beim
 * Partiestart ein (`chipStackField` in der Meta). Darauf weist die Karte hin.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_REGELN } from './regeln.js';

export const SPIELARTEN: readonly Spielart[] = [
  spielartAus('locker', DEFAULT_REGELN, { startJetons: 200, kleinerBlind: 2, grosserBlind: 4 }),
  spielartAus('abend', DEFAULT_REGELN, { startJetons: 500, kleinerBlind: 5, grosserBlind: 10 }),
  spielartAus('hoch', DEFAULT_REGELN, { startJetons: 2_000, kleinerBlind: 20, grosserBlind: 40 }),
];
