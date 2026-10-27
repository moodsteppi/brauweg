/**
 * Identitaeten fuer "Wer bin ich".
 *
 * Der Spieler sieht seinen eigenen Namen nicht und erraet ihn per
 * Ja/Nein-Fragen an die Runde.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/identitaeten.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/identitaeten.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { Identitaet } from './typen.js';

export const IDENTITAETEN: readonly Identitaet[] = ladeKatalog<Identitaet>('identitaeten', roh);
