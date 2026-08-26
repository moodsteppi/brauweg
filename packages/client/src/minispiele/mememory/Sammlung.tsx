/**
 * Die Sammlung — und die Wahl der drei, die im Spiel fliegen.
 *
 * Wer ein Motiv einmal aufgedeckt hat, hat es gesammelt (gemeldet wird das
 * am Tisch, siehe Mememory.tsx). Hier steht, was zusammengekommen ist, und
 * hier waehlt man bis zu drei aus: Die ersetzen am Tisch den Emoji-Knopf.
 *
 * **Gespeichert wird erst beim Schliessen des Gurts, nicht bei jedem Tipp.**
 * Auswaehlen ist ein Suchvorgang — man tippt eines an, sieht es unten, nimmt
 * es wieder weg. Eine Anfrage je Tipp waere ein Dutzend Anfragen fuer eine
 * Entscheidung, und auf einer Mobilfunkleitung sieht man das.
 *
 * **Der Gurt ist geordnet.** Was zuerst gewaehlt wurde, sitzt links — so
 * liegt am Tisch immer dasselbe Meme unter demselben Daumen.
 */

import { useCallback, useEffect, useState } from 'react';

import { api } from '../../api';
import { motivBildPfad } from './bildpfad';

/** Muss zu GURT_MAX in packages/server/src/sammlung.ts passen. */
const GURT_MAX = 3;

export function Sammlung({
  namen,
  onFertig,
}: {
  /** Kennung -> Name, soweit bekannt. Nur hochgeladene Motive haben einen. */
  namen: Record<string, string>;
  onFertig: () => void;
}): React.JSX.Element {
  const [gesammelt, setGesammelt] = useState<string[]>([]);
  const [gurt, setGurt] = useState<string[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gemerkt, setGemerkt] = useState(false);

  const holen = useCallback(async (): Promise<void> => {
    setLaedt(true);
    try {
      const antwort = await api.mememorySammlung();
      setGesammelt(antwort.gesammelt.map((zeile) => zeile.kennung));
      setGurt(antwort.gurt);
    } catch {
      setFehler('Die Sammlung ließ sich nicht laden.');
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void holen();
  }, [holen]);

  /**
   * Antippen legt ins Gurtfach oder nimmt wieder heraus.
   *
   * Ist der Gurt voll, passiert beim vierten NICHTS — statt heimlich das
   * erste zu verdraengen. Ein Tausch, den man nicht angeordnet hat, ist
   * schlimmer als ein Knopf, der nicht reagiert; die volle Leiste unten sagt
   * ohnehin, woran es liegt.
   */
  const umschalten = (kennung: string): void => {
    setGemerkt(false);
    setGurt((alt) => {
      if (alt.includes(kennung)) return alt.filter((k) => k !== kennung);
      if (alt.length >= GURT_MAX) return alt;
      return [...alt, kennung];
    });
  };

  const speichern = async (): Promise<void> => {
    setBusy(true);
    setFehler(null);
    try {
      const antwort = await api.mememoryGurt(gurt);
      setGurt(antwort.gurt);
      setGemerkt(true);
    } catch {
      setFehler('Das Speichern hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mm-kasten-schicht" role="dialog" aria-modal="true" aria-label="Sammlung">
      <div className="mm-kasten-blatt">
        <div className="mm-kasten-kopf">
          <h2>Sammlung</h2>
          <button type="button" className="mm-kasten-zu" onClick={onFertig} aria-label="Schließen">
            ✕
          </button>
        </div>

        <div className="mm-kasten-inhalt">
          <p className="mm-kasten-hinweis">
            {laedt
              ? 'Wird geladen…'
              : gesammelt.length === 0
                ? 'Noch nichts gesammelt. Jedes Motiv, das du in einer Partie aufdeckst, landet hier.'
                : `${gesammelt.length} gesammelt. Wähle bis zu ${GURT_MAX} aus — die wirfst du im Spiel über den Tisch, statt der Emojis.`}
          </p>

          {/* Der Gurt zuerst: Er ist das Ergebnis, das Raster darunter der Weg
              dahin. Drei feste Fächer, damit die Leiste nicht springt. */}
          {gesammelt.length > 0 && (
            <div className="mm-gurt" aria-label="Gewählte Memes">
              {Array.from({ length: GURT_MAX }, (_, i) => {
                const kennung = gurt[i];
                return (
                  <div className="mm-gurt-fach" key={i} data-belegt={kennung ? '' : undefined}>
                    {kennung ? (
                      <button
                        type="button"
                        onClick={() => umschalten(kennung)}
                        aria-label={`${namen[kennung] ?? 'Meme'} aus dem Gurt nehmen`}
                      >
                        <img src={motivBildPfad(kennung)} alt="" draggable={false} />
                      </button>
                    ) : (
                      <span aria-hidden="true">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mm-kasten-gitter">
            {gesammelt.map((kennung) => (
              <div
                className="mm-kasten-kachel mm-sammelkachel"
                key={kennung}
                data-gewaehlt={gurt.includes(kennung) ? '' : undefined}
              >
                <button
                  type="button"
                  className="mm-sammel-knopf"
                  onClick={() => umschalten(kennung)}
                  aria-pressed={gurt.includes(kennung)}
                  aria-label={namen[kennung] ?? kennung}
                >
                  <img src={motivBildPfad(kennung)} alt="" draggable={false} />
                </button>
                <span className="mm-kasten-kachel-name">{namen[kennung] ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {gesammelt.length > 0 && (
          <div className="mm-kasten-fuss">
            <button
              type="button"
              className="mm-kasten-los"
              onClick={() => void speichern()}
              disabled={busy}
            >
              {gemerkt ? 'Gemerkt ✓' : 'Auswahl merken'}
            </button>
          </div>
        )}

        {fehler && <p className="mm-kasten-fehler">{fehler}</p>}
      </div>
    </div>
  );
}
