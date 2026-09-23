/**
 * Sprueche fuer "Ich hab noch nie".
 *
 * Jede Runde deckt eine Aussage auf; wer sie doch schon erlebt hat, trinkt.
 * Die Auswahl zielt auf Alltagspannen, die in einer gemischten Runde von 4
 * bis 12 Leuten meistens jemanden treffen, aber nie alle gleichzeitig.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/niemals.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/niemals.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { Spruch } from './typen.js';

export const NIEMALS_SPRUECHE: readonly Spruch[] = ladeKatalog<Spruch>('niemals', roh);
