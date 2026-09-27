/**
 * Der Knopf „Passt nicht" und sein Blatt — in jeder Runde der Partykiste, die
 * einen Katalog-Eintrag zeigt, und nur auf staging (passt-nicht.ts).
 *
 * Klein und unaufdringlich, weil er neben dem Spiel steht, nicht darin: eine
 * leise Textzeile unter der Runde, aber mit voller Trefferflaeche (44 pt,
 * Apple HIG) und ausgeschrieben statt als Symbol — ein Fahnen-Symbol hielte
 * am Tisch jeder fuer „Spieler melden".
 *
 * Welcher Eintrag gemeint ist, weiss der Bildschirm nicht selbst: Er liest
 * `gezeigt` aus der Sicht (Katalog + Kennung + Text). Zeigt die Runde mehrere
 * (Wer bin ich, Wahrheit oder Pflicht, dazu eine geltende Regel-Karte),
 * fragt das Blatt zuerst, welcher.
 */

import { useEffect, useState } from 'react';

import { ApiError, api } from '../../api';
import { t } from '../../i18n';
import { PASST_NICHT_FREITEXT_MAX, PASST_NICHT_GRUENDE, type PasstNichtGrund } from './passt-nicht';
import type { PartyGezeigterInhalt } from './sicht';

/** Text einer Auswahlzeile — lange Aufgaben gekuerzt, damit das Blatt nicht scrollt. */
function kurz(text: string): string {
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

export function PasstNicht({
  gezeigt,
  tischId,
  stufe,
}: {
  gezeigt: readonly PartyGezeigterInhalt[];
  tischId: string | null;
  /** Die Inhaltsstufe, auf der die Runde spielt — „zu zahm" sagt ohne sie nichts. */
  stufe: number | null;
}): React.JSX.Element | null {
  /*
   * Beim Oeffnen festgehalten, nicht live gelesen: Waehrend man schreibt,
   * geht die Runde oft weiter (die anderen tippen), und dann zeigte das
   * Blatt ploetzlich den naechsten Eintrag — gemeldet waere der falsche.
   */
  const [offen, setOffen] = useState<{ liste: readonly PartyGezeigterInhalt[]; stufe: number | null } | null>(null);
  return (
    <>
      {gezeigt.length > 0 ? (
        <button type="button" className="pk-passtnicht" data-pk-passtnicht="" onClick={() => setOffen({ liste: [...gezeigt], stufe })}>
          Passt nicht
        </button>
      ) : null}
      {offen ? (
        <PasstNichtBlatt gezeigt={offen.liste} tischId={tischId} stufe={offen.stufe} onClose={() => setOffen(null)} />
      ) : null}
    </>
  );
}

function PasstNichtBlatt({
  gezeigt,
  tischId,
  stufe,
  onClose,
}: {
  gezeigt: readonly PartyGezeigterInhalt[];
  tischId: string | null;
  stufe: number | null;
  onClose: () => void;
}): React.JSX.Element {
  const [wahl, setWahl] = useState<number>(gezeigt.length === 1 ? 0 : -1);
  const [grund, setGrund] = useState<PasstNichtGrund | null>(null);
  const [freitext, setFreitext] = useState('');
  const [busy, setBusy] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [onClose]);

  const eintrag = wahl >= 0 ? gezeigt[wahl] : undefined;

  const senden = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!eintrag || !grund || busy) return;
    setBusy(true);
    setFehler(null);
    void api
      .partykisteMelden({
        katalog: eintrag.katalog,
        kennung: eintrag.kennung,
        grund,
        ...(freitext.trim() ? { freitext: freitext.trim() } : {}),
        ...(tischId ? { tischId } : {}),
        ...(stufe === 1 || stufe === 2 || stufe === 3 ? { stufe } : {}),
      })
      .then(() => setFertig(true))
      .catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="doko-sheet pk-pn" onClick={onClose} role="presentation">
      <form
        className="doko-sheet-card pk-pn-blatt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pk-pn-titel"
        onClick={(event) => event.stopPropagation()}
        onSubmit={senden}
      >
        <h2 id="pk-pn-titel">Passt nicht</h2>
        {fertig ? (
          <>
            <p role="status" className="pk-pn-danke">
              Danke — ist notiert. Wir sehen uns den Eintrag an.
            </p>
            <div className="pk-pn-knoepfe">
              <button type="button" className="pk-knopf is-haupt" onClick={onClose}>
                Schließen
              </button>
            </div>
          </>
        ) : (
          <>
            {gezeigt.length === 1 ? (
              <p className="pk-pn-eintrag">„{kurz(gezeigt[0]!.text)}“</p>
            ) : (
              <fieldset className="pk-pn-gruppe">
                <legend>Welcher Eintrag?</legend>
                {gezeigt.map((e, i) => (
                  <label key={`${e.katalog}/${e.kennung}`} className="pk-pn-option">
                    <input type="radio" name="pk-pn-eintrag" checked={wahl === i} onChange={() => setWahl(i)} />
                    <span>{kurz(e.text)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset className="pk-pn-gruppe">
              <legend>Was ist los?</legend>
              {PASST_NICHT_GRUENDE.map((g) => (
                <label key={g.wert} className="pk-pn-option">
                  <input type="radio" name="pk-pn-grund" value={g.wert} checked={grund === g.wert} onChange={() => setGrund(g.wert)} />
                  <span>{g.text}</span>
                </label>
              ))}
            </fieldset>
            <label className="pk-pn-frei">
              Mehr dazu (freiwillig)
              <textarea value={freitext} maxLength={PASST_NICHT_FREITEXT_MAX} rows={2} onChange={(e) => setFreitext(e.target.value)} />
            </label>
            {fehler ? (
              <p className="pk-fehler" role="alert">
                {fehler}
              </p>
            ) : null}
            <div className="pk-pn-knoepfe">
              <button type="button" className="pk-knopf" onClick={onClose}>
                Abbrechen
              </button>
              <button type="submit" className="pk-knopf is-haupt" disabled={busy || !eintrag || !grund}>
                {busy ? 'Sende …' : 'Senden'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
