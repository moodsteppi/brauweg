/**
 * Katalog der Schätzfragen für die Partykiste.
 *
 * Alle tippen gleichzeitig eine Zahl, wer am nächsten liegt, gewinnt. Deshalb
 * hat jede Frage eine eindeutige, stabile Zahlantwort, die sich nicht
 * jährlich ändert.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/schaetzen.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/schaetzen.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { SchaetzFrage } from './typen.js';

export const SCHAETZ_FRAGEN: readonly SchaetzFrage[] = ladeKatalog<SchaetzFrage>('schaetzen', roh);
