/**
 * Die Spielarten von Eiland — offene Karte und Nebel (Robin, 28.11.2026;
 * `GameMeta.spielarten` in game-api). Die erste ist die Vorgabe des
 * Einstiegs.
 *
 * Bis hierher spielte die Mitspielersuche immer im Nebel: Sie baute ihren
 * Tisch mit `defaultConfig()`, und dort steht `variante: 'nebel'`. Jetzt
 * schickt der Bildschirm die gewaehlte Spielart mit, und die Schlange fuehrt
 * je `variante` einen Topf. `klar` steht vorn, weil der Nutzerwunsch vom
 * 04.09.2026 die offene Karte als Einstieg will (Eiland.tsx).
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_REGELN } from './regeln.js';

export const SPIELARTEN: readonly Spielart[] = [
  spielartAus('klar', DEFAULT_REGELN),
  spielartAus('nebel', DEFAULT_REGELN),
];
