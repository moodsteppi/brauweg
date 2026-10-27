/**
 * Paare für "Entweder-oder".
 *
 * Alle Mitspieler tippen gleichzeitig A oder B, die Minderheit trinkt. Jedes
 * Paar muss echt spalten: Beide Seiten sind eine ernsthafte Wahl, keine
 * Scheinalternative.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/entweder.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/entweder.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { EntwederOder } from './typen.js';

export const ENTWEDER_ODER: readonly EntwederOder[] = ladeKatalog<EntwederOder>('entweder', roh);
