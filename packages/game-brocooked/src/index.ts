/**
 * BroCooked — hektische Kueche fuer 1 bis 4 Koeche, Echtzeit im Gleichschritt.
 *
 * Reine Logikbibliothek: kein Netz, keine Datenbank, keine Uhr, kein Zufall
 * ausser dem uebergebenen Saatkorn. Die Kueche selbst — Koeche, Stationen,
 * Tickets, Punkte — rechnen die Geraete
 * (`packages/client/src/minispiele/brocooked/`); dieses Paket verwahrt nur,
 * was alle Geraete brauchen, um zur selben Partie zu kommen: Saatkorn,
 * Regelsatz, Bot-Sitze, Eingabeliste, Ausstiege, Ergebnismeldungen. Der
 * Vertrag dazu steht in docs/SPEZIFIKATION-BROCOOKED.md.
 */

export * from './regeln.js';
export * from './partie.js';
export { brocooked, type BroCookedView } from './adapter.js';
