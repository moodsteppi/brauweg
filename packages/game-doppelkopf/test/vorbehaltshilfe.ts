/**
 * Testhilfe fuer die Vorbehaltsabfrage.
 *
 * Die Abfrage laeuft gleichzeitig: Waehrend sie offen ist, ist NIEMAND am Zug
 * (`currentActor` liefert null), aber mehrere Sitze duerfen erklaeren. Tests,
 * die eine Runde nur bis in die Spielphase treiben wollen, interessiert diese
 * Gleichzeitigkeit nicht — sie brauchen einfach den naechsten Sitz, der noch
 * etwas sagen muss.
 *
 * Genau das liefert `amZug`: erst den regulaeren Zugsitz, sonst den ersten
 * Sitz mit offener Vorbehaltsantwort. Reihenfolge ist Vorhand-Reihenfolge,
 * damit Tests reproduzierbar bleiben.
 */

import { type RoundState, currentActor, vorbehaltOffen } from '../src/round.js';

export function amZug(state: RoundState): number | null {
  const actor = currentActor(state);
  if (actor !== null) return actor;
  return vorbehaltOffen(state)[0] ?? null;
}
