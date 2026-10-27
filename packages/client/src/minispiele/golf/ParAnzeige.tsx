import { useEffect, useRef, useState } from 'react';

import { t } from '../../i18n';
import { lochName, zuPar } from './par';

/**
 * Die Par-Anzeige von Golf: der kurze Ruf beim Einlochen, der Name im
 * Zwischenstand und „zu Par" in der Endtafel.
 *
 * Seit dem 22.09.2026, in einer eigenen Datei, damit `screens/Golf.tsx` nur
 * an den Stellen berührt wird, an denen es ohnehin Schlagzahlen zeigt. Die
 * Rechnung steht in `par.ts`; hier wird nur gezeigt.
 */

/** So lange steht der Ruf. Kürzer als die Pause, damit er nicht in die Tafel ragt. */
const RUF_MS = 1600;

/**
 * „Birdie!" im HUD, wenn der EIGENE Ball fällt — ein Hole-in-one größer.
 *
 * Nur der eigene: Bei acht Bällen, die gleichzeitig spielen, riefe sonst das
 * HUD im Sekundentakt, und der eine Ruf, der einen selbst meint, ginge darin
 * unter. Was die anderen gespielt haben, steht gleich danach im Zwischenstand.
 *
 * **Ausgelöst wird am ÜBERGANG, nicht am Zustand.** Wer mitten im Loch neu
 * lädt, dessen Ball liegt schon im Loch — ein Ruf dafür käme Sekunden zu spät
 * und für nichts. Deshalb merkt sich die Komponente den vorigen Stand und ruft
 * nur, wenn im SELBEN Loch aus „nicht eingelocht" „eingelocht" wird.
 *
 * Der Effekt hängt an Zahlen und Wahrheitswerten, nicht am HUD-Objekt: Das
 * wird bei jeder Änderung neu gebaut, und ein Effekt daran liefe bei jeder
 * Uhrsekunde neu und räumte seinen eigenen Zeitgeber ab (siehe CLAUDE.md,
 * „React-Effekte an einen Schlüssel hängen").
 */
export function ParRuf({
  loch,
  eingelocht,
  schlaege,
  par,
}: {
  loch: number;
  eingelocht: boolean;
  schlaege: number;
  par: number;
}): React.JSX.Element | null {
  const [ruf, setRuf] = useState<{ text: string; hio: boolean; nr: number } | null>(null);
  const vorher = useRef<{ loch: number; eingelocht: boolean } | null>(null);

  useEffect(() => {
    const alt = vorher.current;
    vorher.current = { loch, eingelocht };
    if (alt === null || alt.loch !== loch || alt.eingelocht || !eingelocht) return;
    setRuf((jetzt) => ({
      text: lochName(schlaege, par, true),
      hio: schlaege === 1,
      nr: (jetzt?.nr ?? 0) + 1,
    }));
  }, [loch, eingelocht, schlaege, par]);

  const nr = ruf?.nr ?? 0;
  useEffect(() => {
    if (nr === 0) return;
    const uhr = setTimeout(() => setRuf(null), RUF_MS);
    return () => clearTimeout(uhr);
  }, [nr]);

  if (ruf === null) return null;
  return (
    <p className="gpar-ruf" data-hio={ruf.hio ? '' : undefined} aria-live="polite" key={ruf.nr}>
      {ruf.text}
    </p>
  );
}

/**
 * Der Name eines Lochs in der Zwischenstandstafel. Solange ein Ball noch
 * spielt (nur denkbar, wenn die Tafel früh gezeigt würde), bleibt die Zelle
 * leer statt „nicht eingelocht" zu behaupten.
 */
export function ParName({
  schlaege,
  par,
  eingelocht,
  fertig,
}: {
  schlaege: number;
  par: number;
  eingelocht: boolean;
  fertig: boolean;
}): React.JSX.Element | null {
  if (!eingelocht && !fertig) return null;
  let art = 'par';
  if (!eingelocht) art = 'ohne';
  else if (schlaege === 1) art = 'hio';
  else if (schlaege < par) art = 'unter';
  else if (schlaege > par) art = 'ueber';
  return (
    <span className="gpar-name" data-gpar={art}>
      {lochName(schlaege, par, eingelocht)}
    </span>
  );
}

/** Kopf der Endtafel über Summe und „zu Par" — die Rangliste selbst hat keinen. */
export function ParKopf(): React.JSX.Element {
  return (
    <p className="gpar-kopf" aria-hidden="true">
      <span>{t('golf.par.summe')}</span>
      <span>{t('golf.par.spalte')}</span>
    </p>
  );
}

/** „−2" / „E" / „+3" neben der Summe einer Zeile der Endtafel. */
export function ZuPar({ wert }: { wert: number }): React.JSX.Element {
  const text = zuPar(wert);
  return (
    <span
      className="gpar-zupar"
      data-gpar={wert < 0 ? 'unter' : wert > 0 ? 'ueber' : 'par'}
      aria-label={`${t('golf.par.spalte')} ${text}`}
    >
      {text}
    </span>
  );
}
