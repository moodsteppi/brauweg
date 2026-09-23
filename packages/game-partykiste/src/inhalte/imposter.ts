/**
 * Woerter fuer Imposter.
 *
 * Alle Mitspieler bekommen `wort`, der Imposter den `hinweis` — eine grobe
 * Kategorie, die das Wort nicht verraet.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/imposter.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/imposter.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { ImposterWort } from './typen.js';

export const IMPOSTER_WOERTER: readonly ImposterWort[] = ladeKatalog<ImposterWort>('imposter', roh);
