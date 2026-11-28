/**
 * Die Spielarten des Skats — fertige Regelsaetze fuer den Einstieg
 * (Robin, 28.11.2026; `GameMeta.spielarten` in game-api). Die erste ist die
 * Vorgabe.
 *
 * Alle drei setzen auf der Vorgabe des Moduls auf, damit eine neue Regel dort
 * mit ihrem Vorgabewert auch hier steht. Gueltig sind sie nur zusammen mit
 * ihren Voraussetzungen (Bock braucht Kontra/Re, Schieberamsch und Jungfrauen
 * brauchen Ramsch) — das prueft spielarten.test.ts gegen `validateRuleSet`.
 */

import { type Spielart, spielartAus } from '@brauweg/game-api';

import { DEFAULT_RULESET } from './ruleset.js';

export const SPIELARTEN: readonly Spielart[] = [
  // Normal: Kontra/Re und Ramsch, wie die Vorgabe.
  spielartAus('normal', DEFAULT_RULESET),
  // Klassisch: Passen alle, wird eingepasst — kein Ramsch.
  spielartAus('klassisch', DEFAULT_RULESET, { ramsch: false }),
  // Hart: Bockrunden, Schieberamsch und Jungfrauen.
  spielartAus('hart', DEFAULT_RULESET, { bock: true, schieberamsch: true, jungfrauen: true }),
];
