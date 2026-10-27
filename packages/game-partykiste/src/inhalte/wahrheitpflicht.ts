/**
 * Aufgaben für "Wahrheit oder Pflicht".
 *
 * Wahrheit sind Fragen, Pflicht sind Aufgaben, die sofort am Tisch machbar
 * sind — kein Zubehör außer dem Handy. a001–a060 sind Wahrheit, a061–a120
 * Pflicht; ab a121 wechseln die Arten. Wer kneift, bekommt den Schluck (oder
 * Strafpunkt) aus der WERTUNG, nie aus dem Text: Seit dem 22.09.2026 befiehlt
 * keine Aufgabe mehr das Trinken, weil derselbe Text auch bei ausgeschaltetem
 * Trinkmodus auf der Bühne steht. `test/inhalte.test.ts` hält das fest.
 *
 * Die Eintraege stehen seit dem 22.09.2026 in `daten/wahrheitpflicht.json` (Entscheidung
 * P4: Inhalte als JSON mit Schema, Datenbank spaeter). Diese Datei laedt und
 * prueft sie nur — geprueft von `schema.ts`, beim Import, im Build und im
 * Test. Neue Eintraege hinten in der JSON-Datei, mit der naechsten freien
 * Kennung; nie umsortieren, Kennungen aendern sich nie.
 */

import roh from './daten/wahrheitpflicht.json' with { type: 'json' };
import { ladeKatalog } from './schema.js';
import type { Aufgabe } from './typen.js';

export const AUFGABEN: readonly Aufgabe[] = ladeKatalog<Aufgabe>('wahrheitpflicht', roh);
