import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „regeln-allgemein": Regelnamen und Regelsatz-Meldungen,
 * die mehrere Spiele unter DERSELBEN Kennung melden. Aus dem früheren Bereich
 * „regeln" herausgelöst, Wortlaut unverändert. Wer ihn übersetzt, steht in der
 * Tabelle in `de/index.ts`.
 *
 * Hierher gehört eine Kennung erst, wenn zwei Module sie wirklich bilden
 * (geprüft mit grep über `packages/game-*`); sonst liegt sie in der Datei
 * ihres Spiels (`regeln-<spiel>.ts`). Der Text muss dann für jedes dieser
 * Spiele stimmen — deshalb die neutralen Fassungen.
 *
 * Für alle `regeln-*`-Dateien gilt, was hier einmal steht:
 * - Regelnamen (`regel.*`): Der Editor zeigt jede boolesche Option aus
 *   defaultConfig; fehlt hier ein Eintrag, erscheint der rohe Schluessel -
 *   sichtbar haesslich statt unsichtbar kaputt.
 * - Regelsatz-Meldungen (`ruleset.*`): `t()` gibt bei einem unbekannten
 *   Schlüssel den Schlüssel zurück — im Regelsatz-Editor stand so einmal
 *   wörtlich "ruleset.blindZuKlein" am Feld (Poker, Filler, Mememory und
 *   Feldherr kamen nach der ersten Übersetzungsrunde dazu, ihre Meldungen
 *   wurden nicht nachgetragen). Die Texte nennen die Grenze, statt nur
 *   "ungültig" zu sagen: Wer sie liest, soll wissen, was er eintragen darf.
 */
export default {
  // Tischregeln von Doppelkopf UND Skat.
  'regel.bock': 'Bockrunden',
  'regel.training': 'Training',

  // Zauberer, Cambio und BroChess.
  'ruleset.roundsOutOfRange': 'So viele Runden gibt das Blatt nicht her.',
  'ruleset.tableSizeUnsupported': 'Diese Spielerzahl gibt es bei diesem Spiel nicht.',

  /*
   * Denselben Sachverhalt gibt es unter zwei Präfixen: Doppelkopf, Wizard,
   * Skat und Cambio bilden ihre Meldungen als `ruleset.${code}`, an anderer
   * Stelle steht derselbe Code als `error.…`. Bis das vereinheitlicht ist
   * (eigene Karte), braucht es beide Einträge — sonst steht im Editor der
   * nackte Schlüssel.
   */
  'ruleset.roundsNotMultipleOfRotation': 'Die Rundenzahl muss eine volle Geberrunde ergeben.',

  // Doppelkopf und Skat. TABLE_SIZE darf deshalb nicht "Skat wird zu dritt
  // gespielt." lauten: Am Doppelkopf-Tisch wäre er schlicht falsch. Beide
  // Module bilden ihre Schlüssel als `ruleset.${code}`, und dieselbe Kennung
  // landet damit im selben Eintrag.
  'ruleset.TRAINING': 'Trainingstisch: keine Trophäen, keine Ranglistenwertung.',
  'ruleset.TABLE_SIZE': 'Diese Spielerzahl gibt es bei diesem Spiel nicht.',
  'ruleset.ROUNDS_MULTIPLE': 'Die Rundenzahl muss eine volle Geberrunde ergeben.',

  // Eiland, Farbduell (Filler) und Mememory.
  'ruleset.spaltenAusserhalb': 'Zwischen 4 und 12 Spalten.',
  'ruleset.zeilenAusserhalb': 'Zwischen 4 und 12 Zeilen.',
  // Eiland und Farbduell.
  'ruleset.varianteUnbekannt': 'Diese Spielart gibt es nicht.',

  // Aus `@brauweg/game-api` — jedes Modul, das dessen Prüfhelfer nutzt.
  'ruleset.notAnObject': 'Der Regelsatz fehlt oder ist beschädigt.',
  'ruleset.fieldMissing': 'Dem Regelsatz fehlt ein Feld.',
  'ruleset.fieldWrongType': 'Ein Feld des Regelsatzes hat den falschen Typ.',
} satisfies Woerterbuch;
