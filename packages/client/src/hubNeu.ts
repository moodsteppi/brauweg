/**
 * Schalter für das neue Hub („Nachtblau & Gold", Entwurf vom 26.09.2026).
 *
 * Das neue Hub kommt Seite für Seite nach staging, das alte bleibt so lange
 * der Standard. Wer es sehen will, öffnet die Seite einmal mit `?hub=neu`;
 * die Wahl bleibt im Browser gespeichert, `?hub=alt` nimmt sie zurück.
 *
 * Ein Schalter und nicht ein langer Zweig: So geht jede Seite einzeln durch
 * die Prüfung, und die Produktion zeigt nie ein halb umgebautes Hub. Sind alle
 * Seiten fertig, wird der Standard umgelegt und das alte Hub entfernt.
 */
const SCHLUESSEL = 'brauweg.hub';

/** Exportiert für den Test; die App liest einmal beim Laden (`hubNeu`). */
export function liesSchalter(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const suche = new URLSearchParams(window.location.search);
    // Die Probe `?dev=hub` zeigt immer das neue Hub.
    if (import.meta.env.DEV && suche.get('dev') === 'hub') return true;
    const wunsch = suche.get('hub');
    if (wunsch === 'neu') window.localStorage.setItem(SCHLUESSEL, 'neu');
    if (wunsch === 'alt') window.localStorage.removeItem(SCHLUESSEL);
    return window.localStorage.getItem(SCHLUESSEL) === 'neu';
  } catch {
    // Ohne Speicher (privates Fenster, gesperrt): das alte Hub.
    return false;
  }
}

export const hubNeu = liesSchalter();
