/**
 * Das Regelblatt: Regeln, alle Faehigkeiten, alle Marken mit ihren Stufen.
 *
 * FAEHIGKEITEN UND MARKEN STEHEN NICHT HIER, sondern kommen aus der Sicht
 * (`faehigkeiten`, `synergieTabelle`, `katalog` — alle nur in der ersten
 * Sicht nach dem Beitritt). Ein Client, der sie abschriebe, haette nach dem
 * naechsten Bot-Turnier (docs/TAFELRUNDE-FAEHIGKEITEN.md) andere Zahlen als
 * der Server (CLAUDE.md, „Was das Modul weiss, schreibt der Client nicht ab").
 * Der Preis: Vor dem ersten Tisch — im Einstieg — gibt es diese beiden Teile
 * noch nicht. Das Blatt sagt das ehrlich, statt leer zu wirken; im Bericht an
 * Robin steht der Wunsch nach einem Abruf ohne Tisch.
 *
 * Die Regeln selbst sind Text und keine Zahlen. Schwellen nennt nur der
 * Reiter „Marken", und zwar aus der Tabelle der Sicht — sie sind seit dem
 * 27.11.2026 je Marke verschieden (Waechter 2/4/6, Drache nur 2).
 */

import { useState } from 'react';

import type { Einheit, Faehigkeit } from '../sicht';
import { type Synergie, bonusSatz } from '../marken';
import {
  einheitName,
  faehigkeitName,
  faehigkeitText,
  markeName,
  markeStufeText,
  markeWirkung,
  tz,
} from '../text';
import { Blatt } from './Blatt';
import { Figur, MarkeZeichen } from './grafik';
import stil from './neu.module.css';

/** Was das Blatt aus der Sicht braucht — vor dem ersten Tisch alles leer. */
export interface Regelwissen {
  katalog: Record<string, Einheit>;
  faehigkeiten: Record<string, Faehigkeit | null>;
  synergieTabelle: readonly Synergie[];
  /**
   * Wie viele gleiche Einheiten verschmelzen — aus der Sicht (`verschmelzZahl`).
   * Vor dem ersten Tisch unbekannt; dann steht der Satz ohne Zahl da, statt
   * eine Zahl zu nennen, die das Modul inzwischen anders sieht (am 28.11.2026
   * ging sie von drei auf zwei).
   */
  verschmelzZahl?: number;
}

export const KEIN_REGELWISSEN: Regelwissen = { katalog: {}, faehigkeiten: {}, synergieTabelle: [] };

type Reiter = 'regeln' | 'faehigkeiten' | 'marken';

export function Regelblatt({
  wissen,
  onSchliessen,
}: {
  wissen: Regelwissen;
  onSchliessen: () => void;
}): React.JSX.Element {
  const [reiter, setReiter] = useState<Reiter>('regeln');
  const einheiten = Object.values(wissen.katalog).sort((a, b) => a.kosten - b.kosten);
  const mitWissen = einheiten.length > 0;

  return (
    <Blatt titel={tz('regeln.titel')} onSchliessen={onSchliessen}>
      <div className={stil.reiter} role="tablist">
        {(['regeln', 'faehigkeiten', 'marken'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={reiter === r}
            className={stil.chip}
            data-an={reiter === r ? '' : undefined}
            onClick={() => setReiter(r)}
          >
            {tz(`neu.regeln.reiter.${r}`)}
          </button>
        ))}
      </div>

      {reiter === 'regeln' && (
        <ol className={stil.regelliste}>
          <li>{tz('neu.regeln.laden')}</li>
          <li>{tz('neu.regeln.ziehen')}</li>
          <li>
            {wissen.verschmelzZahl !== undefined
              ? tz('neu.regeln.verschmelzenZahl', { n: wissen.verschmelzZahl })
              : tz('neu.regeln.verschmelzen')}
          </li>
          <li>{tz('neu.regeln.rang')}</li>
          <li>{tz('neu.regeln.faehigkeiten')}</li>
          <li>{tz('neu.regeln.marken')}</li>
          <li>{tz('neu.regeln.gold')}</li>
          <li>{tz('neu.regeln.kampf')}</li>
          <li>{tz('neu.regeln.aus')}</li>
        </ol>
      )}

      {reiter !== 'regeln' && !mitWissen && <p className={stil.leer}>{tz('neu.regeln.erstAmTisch')}</p>}

      {reiter === 'faehigkeiten' && mitWissen && (
        <ul className={stil.regelEinheiten}>
          {einheiten.map((e) => {
            const f = wissen.faehigkeiten[e.id] ?? null;
            return (
              <li key={e.id} data-rahmen={e.kosten}>
                <span className={stil.regelBild}>
                  <Figur einheit={e} klasse={stil.portraetFigur} />
                </span>
                <span>
                  <strong>{einheitName(e)}</strong>
                  {f ? (
                    <>
                      <em>
                        {faehigkeitName(f)}
                        {' · '}
                        {f.art === 'passiv' ? tz('neu.faehigkeit.passiv') : tz('neu.faehigkeit.mana', { n: f.mana })}
                      </em>
                      <small>{faehigkeitText(f)}</small>
                    </>
                  ) : (
                    <small>{tz('neu.faehigkeit.keine')}</small>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {reiter === 'marken' && mitWissen && <p className={stil.hinweisSatz}>{tz('neu.marke.einmal')}</p>}
      {reiter === 'marken' && mitWissen && (
        <ul className={stil.regelMarken}>
          {wissen.synergieTabelle.map((s) => (
            <li key={s.marke}>
              <h3>
                <MarkeZeichen marke={s.marke} />
                {markeName(s.marke, s.name)}
              </h3>
              <p>{markeWirkung(s.marke, s.wirkung)}</p>
              <ol>
                {s.stufen.map((st) => (
                  <li key={st.schwelle}>
                    <b>{st.schwelle}</b>
                    {st.text ? markeStufeText(s.marke, st.schwelle, st.text) : bonusSatz(st.bonus)}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </Blatt>
  );
}
