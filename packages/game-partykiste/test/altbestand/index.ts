/**
 * Der Altbestand: die 918 Eintraege, wie sie am 22.09.2026 als TS-Quelltext
 * unter `src/inhalte/` standen — unveraendert hierher verschoben (nur der
 * Importpfad der Typen ist angepasst).
 *
 * WARUM das Original liegen bleibt: Beim Umzug nach JSON (Entscheidung P4)
 * ist die Gefahr nicht ein fehlender Eintrag, sondern ein verschobener. Die
 * Ziehung haengt an der Katalogreihenfolge; ein Eintrag an der falschen Stelle
 * oder mit einem anderen Feld zoege bei derselben Saat andere Inhalte, und
 * eine alte Partie zeigte auf einen fremden Text. `inhalte-json.test.ts`
 * vergleicht deshalb jeden alten Eintrag Feld fuer Feld mit dem, was heute aus
 * der JSON-Datei kommt.
 *
 * Wer einen alten Eintrag BEWUSST korrigiert (ein Tippfehler in einer
 * Quizfrage — die Kennung bleibt), korrigiert ihn hier mit. Der Test soll
 * Versehen fangen, nicht Pflege verhindern.
 */

import type { Inhalt } from '../../src/inhalte/typen.js';
import type { KatalogName } from '../../src/inhalte/schema.js';

import { ENTWEDER_ODER } from './entweder.js';
import { IDENTITAETEN } from './identitaeten.js';
import { IMPOSTER_WOERTER } from './imposter.js';
import { NIEMALS_SPRUECHE } from './niemals.js';
import { QUIZ_FRAGEN } from './quiz.js';
import { SCHAETZ_FRAGEN } from './schaetzen.js';
import { AUFGABEN } from './wahrheitpflicht.js';
import { WER_EHER_SPRUECHE } from './wereher.js';

export const ALTBESTAND: Readonly<Record<KatalogName, readonly Inhalt[]>> = {
  quiz: QUIZ_FRAGEN,
  imposter: IMPOSTER_WOERTER,
  identitaeten: IDENTITAETEN,
  niemals: NIEMALS_SPRUECHE,
  wereher: WER_EHER_SPRUECHE,
  schaetzen: SCHAETZ_FRAGEN,
  entweder: ENTWEDER_ODER,
  wahrheitpflicht: AUFGABEN,
};

/** Alle Kennungen, die es vor dem Umzug schon gab. */
export const ALTE_KENNUNGEN: ReadonlySet<string> = new Set(
  Object.values(ALTBESTAND).flatMap((k) => k.map((i) => i.id)),
);
