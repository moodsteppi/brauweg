/**
 * Das Spielpaket von Tafelrunde: die eine Stelle, die es nachlaedt.
 *
 * Zwei Aufrufer wollen dasselbe Stueck, und zwar zur selben Zeit:
 *
 *  - `App.tsx` haengt es in ein `React.lazy` — daraus wird der Bildschirm.
 *  - `vorladen.ts` fuehrt es als Posten des Ladebalkens — daraus wird die
 *    Breite des Balkens (siehe VORZULADEN).
 *
 * Beide gehen ueber diese Funktion und nicht ueber je ein eigenes
 * `import('../../screens/Tafelrunde')`. Zwei Schreibweisen desselben Pfades
 * waeren beim naechsten Verschieben der Datei auseinandergegangen — und zwar
 * so, dass der Balken ein Paket zaehlt, das der Bildschirm gar nicht mehr
 * benutzt. Der Browser liefert beiden Aufrufern ohnehin dasselbe Versprechen;
 * geladen wird also einmal, gewartet zweimal.
 *
 * Die Datei zieht selbst NICHTS nach: Sie steht im Hauptbuendel, und alles,
 * was hier statisch importiert wuerde, stuende dort mit drin.
 */

/** Das Paket holen. Der zweite Aufruf holt nichts nach (Modulspeicher). */
export function tafelrundePaket(): Promise<typeof import('../../screens/Tafelrunde')> {
  return import('../../screens/Tafelrunde');
}

/**
 * Der Name des Suchparameters im geteilten Link.
 *
 * `/?tisch=KX7M9Q` fuehrt direkt in die Beitreten-Ansicht mit ausgefuelltem
 * Code (App.tsx springt dafuer beim Start auf diesen Bildschirm). Beigetreten
 * wird trotzdem erst auf Knopfdruck: Ein Link, der einen ungefragt an einen
 * Tisch setzt, ist ein Link, den man nicht mehr anklicken mag.
 *
 * Steht HIER und nicht im Bildschirm, obwohl er dort gebraucht wird: App.tsx
 * liest ihn beim allerersten Aufbau, um zu entscheiden, WELCHEN Bildschirm es
 * ueberhaupt oeffnet. Ein Import aus `screens/Tafelrunde` haette dafuer das
 * ganze Spielpaket ins Hauptbuendel gezogen — also genau das, was das
 * Nachladen verhindern soll.
 */
export const TISCH_PARAMETER = 'tisch';
