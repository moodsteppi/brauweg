/**
 * Das deutsche Wörterbuch, nach Bereichen.
 *
 * Deutsch ist die Bezugssprache: Es legt fest, welche Bereiche und welche
 * Schlüssel es gibt. Jede andere Sprache wird in `i18n.test.ts` dagegen
 * gehalten. Die Bereiche folgen den Schlüsselvorsilben:
 *
 * - spiele    — Namen der Spiele und Modi (`game.`, `modus.`, `blatt.`)
 * - tisch     — Phasen und Spielarten am Tisch (`phase.`, `spielart.`)
 * - fehler    — Meldungen des Servers (`error.`)
 * - regeln    — Regelnamen und Regelsatz-Meldungen (`regel.`, `ruleset.`,
 *               `feldherr.`, `brocooked.`, `partykiste.`)
 * - golf      — Golf-Anzeigen (`golf.`)
 * - ware      — Währungen, Truhen, Ausstattung, Shop, Aufgaben, Weg, Pakete
 * - einladung — Beitritt per Code (`einladung.`)
 * - karten    — Farb- und Wertnamen (`karte.`)
 * - sprache   — die Sprachwahl selbst (`sprache.`)
 *
 * Ein neuer Bereich ist eine neue Datei plus eine Zeile hier; die Probe
 * verlangt ihn danach von jeder anderen Sprache (oder eine Zeile in deren
 * Liste offener Bereiche).
 */
import { einladung } from './einladung';
import { fehler } from './fehler';
import { golf } from './golf';
import { karten } from './karten';
import { regeln } from './regeln';
import { spiele } from './spiele';
import { sprache } from './sprache';
import { tisch } from './tisch';
import { ware } from './ware';

export const de = {
  spiele,
  tisch,
  fehler,
  regeln,
  golf,
  ware,
  einladung,
  karten,
  sprache,
};

export type Bereich = keyof typeof de;
