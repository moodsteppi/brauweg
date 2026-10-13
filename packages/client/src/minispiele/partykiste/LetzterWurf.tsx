/**
 * Die Ansage für den, der beim „Weiter" zuletzt getippt hat (seit 07.10.2026).
 *
 * Gewürfelt hat der SERVER, einmal je Wartepunkt (weiter-warten.ts im Modul);
 * hier wird nur angesagt, was in der Sicht steht — deshalb sehen alle
 * dasselbe. Der Ablauf wartet nicht auf die Ansage: Die nächste Runde steht
 * schon da, die Ansage liegt ein paar Sekunden darüber und lässt sich
 * wegtippen. Eine Pause auf dem Server wäre eine zweite Uhr neben der
 * Zugzeit, und genau die Schaupause ist am 19.09.2026 rausgeflogen.
 */

import { useEffect, useRef, useState } from 'react';

import type { SeatInfo } from '../../protocol';
import { namenFuer } from './Runden';
import { zaehlerWort, type PartyLetzterWurf } from './sicht';

/** So lange steht die Ansage — kurz genug, dass niemand darauf wartet. */
export const ANSAGE_MS = 3500;

/** Der Satz der Ansage, ohne Uhr — auch für den Schaukasten. */
export function AnsageLetzter({
  wurf,
  sitze,
  ich,
  trinkmodus,
  onZu,
}: {
  wurf: PartyLetzterWurf;
  sitze: SeatInfo[];
  ich: number;
  trinkmodus: boolean;
  onZu?: () => void;
}): React.JSX.Element {
  const du = wurf.sitz === ich;
  const wer = du ? 'Du warst' : `${namenFuer(sitze, wurf.sitz)} war`;
  const zahl = wurf.schlucke === 1 ? 'ein' : String(wurf.schlucke);
  return (
    <button
      type="button"
      className="pk-letzter"
      data-trinkt={wurf.trinkt ? '' : undefined}
      data-pk-letzter=""
      role="status"
      onClick={onZu}
    >
      <span className="pk-letzter-zeichen" aria-hidden="true">
        {wurf.trinkt ? '🎲' : '🍀'}
      </span>
      <span>
        {wer} Letzter – {wurf.trinkt ? `${zahl} ${zaehlerWort(trinkmodus, wurf.schlucke)}!` : 'Glück gehabt!'}
      </span>
    </button>
  );
}

/**
 * Welcher Wurf gerade angesagt wird — jeder NEUE einmal, für ANSAGE_MS.
 *
 * Ein Hook im Bildschirm und keine eigene Komponente mit Zustand: Der letzte
 * Wurf des Abends fällt genau dann, wenn der Bildschirm von der Runde auf den
 * Endstand umschaltet. Eine Komponente in der Runde würde dabei abgebaut,
 * eine neue im Endstand hielte den Wurf für alt — die Ansage fiele aus.
 *
 * Was in der ERSTEN Sicht schon steht, ist alt (Neuladen, später Beitreten)
 * und bleibt still; sonst hörte, wer nachkommt, die Ansage von vor drei Runden.
 *
 * Der Effekt hängt an `nr`, nicht am Wurf-Objekt: Jeder Serverfunk bringt
 * ein neues Objekt, und ein Effekt daran räumte seinen Timer ab (CLAUDE.md).
 */
export function useNeuerWurf(
  tisch: string | null,
  sichtDa: boolean,
  wurf: PartyLetzterWurf | null,
): { angesagt: PartyLetzterWurf | null; schliessen: () => void } {
  const nr = wurf?.nr ?? 0;
  const fuerTisch = useRef<string | null>(null);
  const ersteNr = useRef<number | null>(null);
  const zuletzt = useRef<number | null>(null);
  const [zeige, setZeige] = useState<number | null>(null);

  useEffect(() => {
    if (!sichtDa) return;
    /* Ein neuer Tisch zählt wieder von vorn — seine Würfe sind nicht die alten. */
    if (fuerTisch.current !== tisch) {
      fuerTisch.current = tisch;
      ersteNr.current = null;
      zuletzt.current = null;
    }
    if (ersteNr.current === null) {
      ersteNr.current = nr;
      return;
    }
    if (nr <= ersteNr.current || nr === zuletzt.current) return;
    zuletzt.current = nr;
    setZeige(nr);
    const uhr = setTimeout(() => setZeige(null), ANSAGE_MS);
    /* Mit der Uhr geht auch die Ansage: Sonst bliebe sie stehen, wenn der
       Effekt aus anderem Grund neu läuft (Verbindung kurz weg). */
    return () => {
      clearTimeout(uhr);
      setZeige(null);
    };
  }, [tisch, sichtDa, nr]);

  return { angesagt: wurf && zeige === wurf.nr ? wurf : null, schliessen: () => setZeige(null) };
}

/** Die Ansage als Schicht über dem Tisch. */
export function LetzterSchicht({
  wurf,
  sitze,
  ich,
  trinkmodus,
  onZu,
  fest,
}: {
  wurf: PartyLetzterWurf | null;
  sitze: SeatInfo[];
  ich: number;
  trinkmodus: boolean;
  onZu: () => void;
  /** Im Fluss statt fest oben — nur fuer den Schaukasten. */
  fest?: boolean;
}): React.JSX.Element | null {
  if (!wurf) return null;
  return (
    <div className="pk-letzter-schicht" data-fest={fest ? '' : undefined}>
      <AnsageLetzter wurf={wurf} sitze={sitze} ich={ich} trinkmodus={trinkmodus} onZu={onZu} />
    </div>
  );
}
