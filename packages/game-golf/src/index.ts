/**
 * Golf — Echtzeit-Minigolf im Gleichschritt, 1 bis 8 Sitze.
 *
 * Reine Logikbibliothek: kein Netz, keine Datenbank, keine Uhr, kein Zufall
 * ausser dem uebergebenen Saatkorn. Die Ballphysik selbst laeuft auf den
 * Geraeten (`packages/client/src/minispiele/golf/`); dieses Paket verwahrt
 * nur, was alle Geraete brauchen, um zur selben Partie zu kommen — Saatkorn,
 * Regelsatz, Bot-Sitze, Zugliste, Ausstiege, Ergebnismeldungen. Der Vertrag
 * dazu steht in SPEZIFIKATION-GOLF.md.
 */

export * from './regeln.js';
export * from './partie.js';
export { golf, type GolfView } from './adapter.js';
