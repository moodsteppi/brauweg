/**
 * Cambio - Regel-Engine und Spielmodul.
 *
 * Reine Logikbibliothek: kein Netz, keine Datenbank, keine Uhr, kein Zufall
 * ausser dem uebergebenen Seed. Das Regelwerk steht in `docs/cambio-spec.md`.
 */

export * from './cards.js';
export * from './deal.js';
export * from './party.js';
export * from './round.js';
export * from './ruleset.js';
export * from './scoring.js';
export * from './validator.js';
export * from './view.js';
export { botAction } from './bot.js';
export { cambio, type CambioView } from './adapter.js';
