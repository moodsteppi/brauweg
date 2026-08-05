/**
 * Feldherr — Echtzeit-Taktikduell zu zweit.
 *
 * Reine Logikbibliothek: kein Netz, keine Datenbank, keine Uhr, kein Zufall
 * ausser dem uebergebenen Saatkorn. Der Spielkern selbst laeuft auf den
 * Geraeten; dieses Paket verwahrt nur, was beide brauchen, um zum selben
 * Ergebnis zu kommen. Der Befund dazu steht in docs/FELDHERR-PLAN.md.
 */

export * from './regeln.js';
export * from './partie.js';
export { feldherr, type FeldherrView } from './adapter.js';
