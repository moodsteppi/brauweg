/**
 * Partykiste — ein Turnier aus Partyminispielen fuer 4 bis 12 Leute.
 *
 * Reine Logikbibliothek: kein Netz, keine Datenbank, keine Uhr, kein Zufall
 * ausser dem uebergebenen Saatkorn. Was ein Sitz sieht, entsteht ausschliesslich
 * in `sicht.ts`; die Bildschirme liegen im Client
 * (`packages/client/src/minispiele/partykiste/`).
 */

export * from './regeln.js';
export * from './partie.js';
export * from './sicht.js';
export { botZug } from './bot.js';
export { partykiste } from './adapter.js';
export type { QuizFrage, ImposterWort, Identitaet, Spruch } from './inhalte/typen.js';
