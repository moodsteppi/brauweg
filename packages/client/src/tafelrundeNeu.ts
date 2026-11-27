/**
 * Schalter zwischen der neuen und der alten Oberflaeche von Tafelrunde
 * (docs/TAFELRUNDE-NEU-UMSETZUNG.md, Abschnitt 7) — gebaut wie der Schalter
 * des neuen Hubs (#277).
 *
 * SEIT DEM 27.11.2026 ABENDS IST DIE NEUE DER STANDARD (Robin, nach dem Spiel
 * auf staging: "kannst das normale deaktivieren dass man nicht den Link
 * braucht"). Ohne Parameter und ohne gespeicherten Wert gilt neu; wer vorher
 * `?tafelrunde=neu` gespeichert hat, bleibt dabei.
 *
 * `?tafelrunde=alt` bleibt vorerst als NOTAUSGANG: Er merkt sich 'alt' im
 * Browser, `?tafelrunde=neu` nimmt das zurueck. So kommt man auf staging zum
 * alten Tafelrunde, falls an der neuen Oberflaeche etwas klemmt. Das alte
 * Tafelrunde wird in einem eigenen Schritt entfernt (Abschnitt 11) — mit ihm
 * dann auch dieser Schalter.
 */
const SCHLUESSEL = 'brauweg.tafelrunde';

/** Exportiert fuer den Test; die App liest einmal beim Laden (`tafelrundeNeu`). */
export function liesSchalter(): boolean {
  if (typeof window === 'undefined') return true;
  const wunsch = new URLSearchParams(window.location.search).get('tafelrunde');
  try {
    if (wunsch === 'alt') window.localStorage.setItem(SCHLUESSEL, 'alt');
    if (wunsch === 'neu') window.localStorage.removeItem(SCHLUESSEL);
    // Der Parameter gilt auch ohne Speicher (privates Fenster): Wer ihn
    // ausdruecklich setzt, bekommt seine Wahl, auch wenn sie sich beim
    // naechsten Aufruf nicht merken laesst.
    if (wunsch === 'alt') return false;
    if (wunsch === 'neu') return true;
    // Gespeichertes 'neu' aus der Zeit vor dem Umlegen ist dasselbe wie gar
    // nichts — nur 'alt' fuehrt zum alten Tafelrunde.
    return window.localStorage.getItem(SCHLUESSEL) !== 'alt';
  } catch {
    // Ohne Speicher (gesperrt): der Standard, ausser der Parameter sagt 'alt'.
    return wunsch !== 'alt';
  }
}

export const tafelrundeNeu = liesSchalter();
