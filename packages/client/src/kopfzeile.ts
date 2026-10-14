import { useEffect } from 'react';

import { inApp } from './laufzeit';

/**
 * Heller Schirm, dunkle Statusleiste — nur in der App.
 *
 * Die iOS-Huelle zeichnet Uhr und Akku weiß, weil fast jeder Schirm dunkel
 * ist. Das Farbduell ist es mit Absicht nicht (styles.css, `.fl-seite`), und
 * weiße Symbole auf Hellgrau sah man dort kaum — auch auf den Store-Bildern
 * nicht. Die Huelle liest `theme-color` mit (HauptController, `themeColor`)
 * und schaltet bei heller Farbe auf dunkle Symbole.
 *
 * Nur in der App: Im Browser färbt `theme-color` die Adressleiste, und dort
 * soll das Farbduell aussehen wie bisher.
 */
export const HELLE_KOPFZEILE = '#eeeeee';

export function HelleKopfzeile(): null {
  useEffect(() => {
    if (!inApp) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const vorher = meta.content;
    meta.content = HELLE_KOPFZEILE;
    return () => {
      meta.content = vorher;
    };
  }, []);
  return null;
}
