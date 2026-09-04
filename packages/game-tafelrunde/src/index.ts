/**
 * Tafelrunde — Auto-Battler mit Verschmelzen.
 *
 * ACHTUNG: Dieses Paket ist noch KEIN `GameModule`. Es liefert bisher den
 * Regelkern der Vorbereitungsphase — Katalog, Verschmelzen, Vorrat, Laden,
 * Gold und Brett; Partie, Sicht, Bot, Kampf und Adapter sind eigene Aufgaben.
 * Solange hier kein Modul steht, kennt der Server das Spiel auch nicht — die
 * Registrierung erfolgt bewusst erst, wenn eine Partie ueberhaupt spielbar
 * ist, damit in der Lobby kein Tisch auftaucht, den niemand eroeffnen kann.
 */

export * from './einheiten.js';
export * from './verschmelzen.js';
export * from './vorrat.js';
export * from './gold.js';
export * from './brett.js';
export * from './laden.js';
