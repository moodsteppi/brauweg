import { useEffect, useRef } from 'react';

/**
 * Die Zurueck-Taste der Android-App.
 *
 * Der Client blaettert nicht ueber den Verlauf des Browsers: Seine Schirme
 * sind Zustand in App.tsx, und im WebView gibt es darum fast nie ein
 * „zurueck". Die Huelle (apps/android, MainActivity.kt) fragt deshalb zuerst
 * hier: Sie feuert `brauweg:zurueck` als abbrechbares Ereignis am `window`.
 * Wer zurueckgeblaettert hat, ruft `preventDefault()`. Tut es niemand, geht
 * die App in den Hintergrund — sie beendet sich nie, damit ein Tipp daneben
 * keine laufende Partie abbricht.
 *
 * Der NAME ist eine Absprache mit der Android- und der iOS-Huelle
 * (`Huelle.ZURUECK_EREIGNIS`). Im Browser feuert ihn niemand; dort bleibt
 * alles, wie es war.
 */
export const ZURUECK_EREIGNIS = 'brauweg:zurueck';

/**
 * Haengt `blaettern` an die Zurueck-Taste. `blaettern` liefert `true`, wenn
 * es zurueckgeblaettert hat. Gibt die Abmeldung zurueck.
 */
export function horcheAufZurueck(blaettern: () => boolean): () => void {
  const hoerer = (e: Event): void => {
    if (e.defaultPrevented) return;
    if (blaettern()) e.preventDefault();
  };
  window.addEventListener(ZURUECK_EREIGNIS, hoerer);
  return () => window.removeEventListener(ZURUECK_EREIGNIS, hoerer);
}

/**
 * Dasselbe als Hook. Der Rueckruf darf bei jedem Zeichnen ein neuer sein —
 * angehaengt wird trotzdem nur einmal, und es gilt immer der letzte (sonst
 * blaetterte die Taste vom Schirm aus zurueck, der beim Anhaengen galt).
 */
export function useZuruecktaste(blaettern: () => boolean): void {
  const aktuell = useRef(blaettern);
  aktuell.current = blaettern;
  useEffect(() => horcheAufZurueck(() => aktuell.current()), []);
}
