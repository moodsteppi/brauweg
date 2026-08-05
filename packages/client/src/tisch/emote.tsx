/**
 * Zurufe am Tisch — Auswahl und Anzeige.
 *
 * Beide Spiele benutzen dieselben Bausteine: Ein Zuruf ist nichts
 * Spielspezifisches, und zwei Fassungen desselben Knopfes waeren zwei
 * Stellen, die auseinanderlaufen koennen.
 *
 * Der Knopf sitzt am Rand und ist bewusst klein. Er ist ein Nebenweg — wer
 * spielt, spielt Karten; wer lachen will, findet ihn trotzdem.
 */

import { useEffect, useState } from 'react';

import { EMOTES, emoteBild, emoteMit } from '../emotes';

/**
 * Ein Zuruf, wie er ueber einem Sitz steht.
 *
 * Gesichter erscheinen rund und gross, Sprueche als Band. Beide blenden von
 * selbst wieder aus; das Aufraeumen macht `useTable`, nicht dieser Baustein.
 */
export function EmoteBlase({ emote }: { emote: string }): React.JSX.Element | null {
  const eintrag = emoteMit(emote);
  if (!eintrag) return null;
  return (
    <span className={`tisch-emote is-${eintrag.art}`} role="img" aria-label={eintrag.name}>
      <img src={emoteBild(emote)} alt="" draggable={false} />
    </span>
  );
}

/**
 * Die Auswahl.
 *
 * `besessen` kommt vom Shop: Was nicht gehoert, steht trotzdem da — grau und
 * mit Preis. Es zu verstecken hiesse, dass niemand erfaehrt, dass es das
 * gibt; es anzubieten, ohne es zu haben, waere ein Tipp ins Leere. Also
 * zeigen, aber nicht senden.
 */
export function EmoteLeiste({
  besessen,
  onSenden,
  onKaufen,
}: {
  /** Kennungen, die dem Konto gehoeren. Leer heisst: noch nichts geladen. */
  besessen: ReadonlySet<string>;
  onSenden: (emote: string) => void;
  /** Fuehrt zum Shop. Ohne diesen Weg waere der Preis eine Sackgasse. */
  onKaufen: () => void;
}): React.JSX.Element {
  const [offen, setOffen] = useState(false);

  // Mit der Zurueck-Taste schliessen, nicht den Tisch verlassen. Auf dem
  // Handy ist das die erste Geste, die jemand versucht.
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOffen(false);
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [offen]);

  return (
    <>
      <button
        className="tisch-emote-knopf"
        onClick={() => setOffen((o) => !o)}
        aria-label="Zuruf"
        aria-expanded={offen}
        type="button"
      >
        <img src={emoteBild('grinsen')} alt="" draggable={false} />
      </button>

      {offen && (
        <div className="tisch-emote-wahl" onClick={() => setOffen(false)}>
          <div className="tisch-emote-blatt" onClick={(e) => e.stopPropagation()}>
            <h3>Zuruf</h3>
            <div className="tisch-emote-raster">
              {EMOTES.map((e) => {
                const mein = besessen.has(e.id);
                return (
                  <button
                    key={e.id}
                    className={`tisch-emote-wahlknopf is-${e.art}${mein ? '' : ' is-zu'}`}
                    title={e.name}
                    onClick={() => {
                      if (!mein) {
                        onKaufen();
                        setOffen(false);
                        return;
                      }
                      onSenden(e.id);
                      setOffen(false);
                    }}
                    type="button"
                  >
                    <img src={emoteBild(e.id)} alt={e.name} draggable={false} />
                    {!mein && <span className="tisch-emote-schloss">🔒</span>}
                  </button>
                );
              })}
            </div>
            <p className="muted tisch-emote-hinweis">
              Gesperrte Zurufe gibt es im Shop.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
