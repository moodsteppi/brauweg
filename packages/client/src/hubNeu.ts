/**
 * Schalter zwischen neuem Hub („Nachtblau & Gold", Entwurf vom 26.09.2026)
 * und altem Hub.
 *
 * Seit dem 26.09.2026 abends ist das **neue Hub der Standard** (Robin: „auch das
 * neue Hub schon auf staging haben, das Go"). Das alte bleibt so lange
 * erreichbar, bis alle Seiten fertig sind und es entfernt wird: einmal
 * `?hub=alt` öffnen, die Wahl bleibt im Browser gespeichert; `?hub=neu` nimmt
 * sie zurück.
 */
const SCHLUESSEL = 'brauweg.hub';

/** Exportiert für den Test; die App liest einmal beim Laden (`hubNeu`). */
export function liesSchalter(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const suche = new URLSearchParams(window.location.search);
    // Die Probe `?dev=hub` zeigt immer das neue Hub.
    if (import.meta.env.DEV && suche.get('dev') === 'hub') return true;
    const wunsch = suche.get('hub');
    if (wunsch === 'alt') window.localStorage.setItem(SCHLUESSEL, 'alt');
    if (wunsch === 'neu') window.localStorage.removeItem(SCHLUESSEL);
    return window.localStorage.getItem(SCHLUESSEL) !== 'alt';
  } catch {
    // Ohne Speicher (privates Fenster, gesperrt): der Standard.
    return true;
  }
}

export const hubNeu = liesSchalter();
