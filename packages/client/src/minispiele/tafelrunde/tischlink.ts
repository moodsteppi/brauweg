/**
 * Der geteilte Tischlink — getrennt vom Bildschirm, weil App.tsx ihn beim
 * Start braucht.
 *
 * `TISCH_PARAMETER` stand bis zum 5.9.2026 in `screens/Tafelrunde.tsx`. App.tsx
 * liest ihn schon vor dem ersten Bild, um `/?tisch=KX7M9Q` zu erkennen — und
 * zog sich damit den ganzen Bildschirm samt Brett, Laden und Kampfanzeige ins
 * Hauptpaket, obwohl der Wert eine Zeichenkette ist. Wer ihn zurueckschiebt,
 * hebt die Aufteilung fuer Tafelrunde wieder auf.
 */

/**
 * Der Name des Suchparameters im geteilten Link.
 *
 * `/?tisch=KX7M9Q` fuehrt direkt in die Beitreten-Ansicht mit ausgefuelltem
 * Code (App.tsx springt dafuer beim Start auf diesen Bildschirm). Beigetreten
 * wird trotzdem erst auf Knopfdruck: Ein Link, der einen ungefragt an einen
 * Tisch setzt, ist ein Link, den man nicht mehr anklicken mag.
 */
export const TISCH_PARAMETER = 'tisch';

/** Der Link, den der Gastgeber weitergibt. */
export function beitrittsLink(code: string): string {
  return `${window.location.origin}/?${TISCH_PARAMETER}=${code}`;
}
