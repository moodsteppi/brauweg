/**
 * Tafelrunde — Auto-Battler mit Verschmelzen.
 *
 * ACHTUNG: Dieses Paket ist noch KEIN `GameModule`. Es liefert bisher nur den
 * Katalog und das Verschmelzen; Laden, Gold, Brett, Sicht und Adapter sind
 * eigene Aufgaben. Solange hier kein Modul steht, kennt der Server das Spiel
 * auch nicht — die Registrierung erfolgt bewusst erst, wenn eine Partie
 * ueberhaupt spielbar ist, damit in der Lobby kein Tisch auftaucht, den
 * niemand eroeffnen kann.
 */

export * from './einheiten.js';
export * from './verschmelzen.js';
