/**
 * Der Abschluss: Platzierung, Trophaeen, noch einmal.
 *
 * ZWEI ANLAESSE wie im alten Endbild: ausgeschieden (die Partie laeuft
 * weiter, man darf zusehen) und Partie vorbei. Der Platz kommt aus
 * `platzierung` der Sicht (`eigenerPlatz`, platzierung.ts) — die Rangfolge
 * rechnet allein das Modul (CLAUDE.md, „Die Platzierung").
 *
 * DIE TROPHAEEN kommen aus dem Partie-Rundruf des Servers (`party.trophies`)
 * und erst nach dem Ende. Fehlen sie noch, steht kein „+0" da, sondern gar
 * nichts — eine Null sieht aus wie ein Ergebnis.
 */

import { tz } from '../text';
import stil from './neu.module.css';

export function Abschluss({
  platz,
  sitzzahl,
  fertig,
  ausRunde,
  trophaeen,
  sieger,
  onNochmal,
  onZurueck,
  onZusehen,
}: {
  platz: number | null;
  sitzzahl: number;
  fertig: boolean;
  ausRunde: number | null;
  /** Gebuchte Trophaeen fuer den eigenen Sitz, null solange keine da sind. */
  trophaeen: number | null;
  /** Wer gewonnen hat, als Namen — nur am Ende. */
  sieger: string | null;
  onNochmal: () => void;
  onZurueck: () => void;
  /** Nur beim Ausscheiden: weiter zusehen statt zu gehen. */
  onZusehen?: () => void;
}): React.JSX.Element {
  const gewonnen = platz === 1 && fertig;
  return (
    <div className={stil.abschlussGrund}>
      <section className={stil.abschluss} role="dialog" aria-label={tz('neu.abschluss.titel')} data-sieg={gewonnen ? '' : undefined}>
        <p className={stil.abschlussOben}>{fertig ? tz('ende.beendet') : tz('neu.abschluss.ausgeschieden', { n: ausRunde ?? 0 })}</p>
        {platz !== null && (
          <div className={stil.platzZahl} aria-label={tz('neu.abschluss.platz', { platz, von: sitzzahl })}>
            <strong>{platz}</strong>
            <span>{tz('neu.abschluss.von', { n: sitzzahl })}</span>
          </div>
        )}
        <h2>{gewonnen ? tz('ende.gewonnen') : fertig ? tz('neu.abschluss.gut') : tz('neu.abschluss.raus')}</h2>
        {sieger && fertig && !gewonnen && <p className={stil.klein}>{tz('ende.siegerEiner', { name: sieger })}</p>}
        {trophaeen !== null && (
          <p className={stil.trophaeen} data-plus={trophaeen >= 0 ? '' : undefined}>
            {tz('neu.abschluss.trophaeen', { n: `${trophaeen >= 0 ? '+' : '−'}${Math.abs(trophaeen)}` })}
          </p>
        )}
        <div className={stil.abschlussKnoepfe}>
          <button type="button" className={stil.hauptknopf} onClick={onNochmal}>
            {tz('neu.abschluss.nochmal')}
          </button>
          {onZusehen && (
            <button type="button" className={stil.zweitknopf} onClick={onZusehen}>
              {tz('ende.weiterZusehen')}
            </button>
          )}
          <button type="button" className={stil.zweitknopf} onClick={onZurueck}>
            {tz('ende.zurAuswahl')}
          </button>
        </div>
      </section>
    </div>
  );
}
