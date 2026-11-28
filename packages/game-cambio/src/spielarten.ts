/**
 * Die Spielarten von Cambio — fertige Regelsaetze fuer den Einstieg
 * (Robin, 28.11.2026; `GameMeta.spielarten` in game-api). Die erste ist die
 * Vorgabe.
 *
 * „Hart" nimmt den Blick auf zwei eigene Karten zu Beginn weg und verdoppelt
 * die Strafe fuer einen misslungenen Ruf. Die eigenen Karten lernt man dann
 * nur noch ueber die Aktionskarte „eigene ansehen" — die Vorgabe hat sie an,
 * sonst warnte der Validator (`noWayToLearnOwnCards`).
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_RULESET } from './ruleset.js';

export const SPIELARTEN: readonly Spielart[] = [
  spielartAus('normal', DEFAULT_RULESET),
  spielartAus('hart', DEFAULT_RULESET, { failPenalty: 10, peekTwoAtStart: false }),
];
