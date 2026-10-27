/**
 * Katalog der Allgemeinwissensfragen fuer die Partykiste.
 *
 * Korrekturen an Frage- oder Antworttext sind erlaubt, die Kennung bleibt —
 * sie steht in abgelegten Rundenprotokollen.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/quiz.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/quiz.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { QuizFrage } from './typen.js';

export const QUIZ_FRAGEN: readonly QuizFrage[] = ladeKatalog<QuizFrage>('quiz', roh);
