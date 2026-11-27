/**
 * Das Ladebild von TafelrundeNeu — solange Figuren und Schauplatz laden.
 *
 * Mit eigenem, kleinem Stylesheet und ohne Bausteine aus `neu/`: Es ist
 * zugleich der Rueckfall des `<Suspense>` in App.tsx, steht also im
 * Hauptpaket. Alles, was es importiert, laedt jeder Spieler mit, auch der,
 * der nie Tafelrunde oeffnet.
 *
 * Ohne `erledigt`/`gesamt` (der Rueckfall weiss nichts vom Bildschirm, der
 * noch kommt) laeuft der Balken als Schimmer statt mit einer erfundenen Zahl.
 */

import { tz } from '../text';
import stil from './Ladebild.module.css';

export function Ladebild({
  erledigt,
  gesamt,
  onAbbrechen,
}: {
  erledigt?: number;
  gesamt?: number;
  onAbbrechen?: () => void;
}): React.JSX.Element {
  const bekannt = erledigt !== undefined && gesamt !== undefined && gesamt > 0;
  const anteil = bekannt ? Math.min(1, erledigt / gesamt) : null;
  return (
    <main className={stil.ladebild} aria-busy="true">
      <h1 className={stil.titel}>Tafelrunde</h1>
      <div
        className={stil.balken}
        role="progressbar"
        aria-label={tz('laden.dateien')}
        aria-valuemin={0}
        aria-valuemax={bekannt ? gesamt : undefined}
        aria-valuenow={bekannt ? erledigt : undefined}
        data-unbestimmt={bekannt ? undefined : ''}
      >
        <i style={anteil === null ? undefined : { width: `${Math.round(anteil * 100)}%` }} />
      </div>
      <p className={stil.zeile}>
        {bekannt
          ? tz('laden.zaehler', { erledigt: erledigt!, gesamt: gesamt! })
          : tz('laden.dateien')}
      </p>
      {onAbbrechen && (
        <button type="button" className={stil.abbrechen} onClick={onAbbrechen}>
          {tz('abbrechen')}
        </button>
      )}
    </main>
  );
}
