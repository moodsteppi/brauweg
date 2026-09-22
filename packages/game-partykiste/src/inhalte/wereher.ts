/**
 * Fragen fuer "Wer würde eher".
 *
 * Alle stimmen gleichzeitig fuer eine Person aus der Runde ab; wer Stimmen
 * bekommt, trinkt je Stimme einen Schluck. Die Fragen zielen deshalb auf
 * Verhalten, das man konkreten Mitspielern zutraut, ohne jemanden wirklich
 * blosszustellen.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/wereher.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/wereher.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { Spruch } from './typen.js';

export const WER_EHER_SPRUECHE: readonly Spruch[] = ladeKatalog<Spruch>('wereher', roh);
