/**
 * Schalter fuer die neue Oberflaeche von Tafelrunde (docs/TAFELRUNDE-NEU-
 * UMSETZUNG.md, Abschnitt 7) — gebaut wie der Schalter des neuen Hubs (#277).
 *
 * Bis zu Robins Abnahme bleibt das heutige Tafelrunde der Standard. Wer die
 * neue sehen will, oeffnet die Seite einmal mit `?tafelrunde=neu`; die Wahl
 * bleibt im Browser gespeichert, `?tafelrunde=alt` nimmt sie zurueck.
 *
 * Ein Schalter und kein langer Zweig, aus demselben Grund wie beim Hub: Die
 * Produktion zeigt nie eine halb fertige Oberflaeche, und die Abnahme laeuft
 * auf dem echten Server mit echten Mitspielern. Ist sie durch, wird der
 * Standard umgelegt und das alte Tafelrunde entfernt (Abschnitt 11).
 */
const SCHLUESSEL = 'brauweg.tafelrunde';

/** Exportiert fuer den Test; die App liest einmal beim Laden (`tafelrundeNeu`). */
export function liesSchalter(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const wunsch = new URLSearchParams(window.location.search).get('tafelrunde');
    if (wunsch === 'neu') window.localStorage.setItem(SCHLUESSEL, 'neu');
    if (wunsch === 'alt') window.localStorage.removeItem(SCHLUESSEL);
    // Der Parameter gilt auch ohne Speicher (privates Fenster): Wer ihn
    // ausdruecklich setzt, soll die neue Oberflaeche sehen, auch wenn sie
    // sich beim naechsten Aufruf nicht merken laesst.
    if (wunsch === 'neu') return true;
    return window.localStorage.getItem(SCHLUESSEL) === 'neu';
  } catch {
    // Ohne Speicher (gesperrt): das alte Tafelrunde.
    return new URLSearchParams(window.location.search).get('tafelrunde') === 'neu';
  }
}

export const tafelrundeNeu = liesSchalter();
