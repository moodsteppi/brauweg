/**
 * Klangschrank — hier wird ausgesucht, was man hört.
 *
 * Das Gegenstück zum Kleiderschrank, und aus demselben Grund ein eigener
 * Bildschirm: Musik und Klangpakete sind Besitz, und Besitz will man ansehen
 * können, nicht in einer Einstellungszeile durchtippen. Der Kleiderschrank
 * zeigt den Pinguin oben und ändert ihn sofort; hier ist das Gegenstück, dass
 * jedes Stück beim Antippen **klingt**. Ein Musikstück, das man nur am Namen
 * erkennt, ist keine Auswahl, sondern ein Ratespiel.
 *
 * **Gekauft wird hier nicht.** Anders als im Kleiderschrank — dort liegt Kauf
 * und Anziehen zusammen, weil man den Hut auf dem Pinguin sehen muss, um zu
 * wissen, ob er sich lohnt. Bei Klang geht das Vorhören schon im Shop, an der
 * Rückfrage. Ein zweiter Kaufweg wäre eine Stelle mehr, die auseinanderläuft.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import { api, type RegalWare } from '../api';
import { Tafel } from '../hub';
import {
  MUSIK_NAMEN,
  PAKET_NAMEN,
  abonniere,
  holeEinstellungen,
  laufendeProbe,
  probeMusik,
  probePaket,
  setzeEinstellungen,
  spiele,
} from '../klang';

export function Klangschrank({ onClose }: { onClose: () => void }): React.JSX.Element {
  const werte = useSyncExternalStore(abonniere, holeEinstellungen, holeEinstellungen);
  const probeLaeuft = useSyncExternalStore(abonniere, laufendeProbe, laufendeProbe);
  const [ware, setWare] = useState<RegalWare[] | null>(null);

  useEffect(() => {
    void api
      .shop()
      .then((s) => setWare(s.tischware.filter((w) => w.besessen)))
      .catch(() => setWare([]));
  }, []);

  // Wer den Schrank verlässt, während eine Probe läuft, soll nicht mit zwei
  // Stücken übereinander weitergehen.
  useEffect(() => () => probeMusik(null), []);

  const stuecke = (ware ?? []).filter((w) => w.art === 'musik');
  const pakete = (ware ?? []).filter((w) => w.art === 'klang');

  const schliessen = (): void => {
    probeMusik(null);
    spiele('blatt-zu');
    onClose();
  };

  return (
    <div className="doko-sheet doko-sheet--mitte" onClick={schliessen}>
      <div
        className="doko-sheet-card klangschrank"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Klangschrank</h2>

        {ware === null ? (
          <p className="muted">Einen Moment…</p>
        ) : (
          <>
            <Tafel titel="Musik" zusatz={`${stuecke.length} im Besitz`}>
              <div className="klangschrank-liste">
                {/*
                  "Keine Musik" ist eine Wahl und kein Fehlen — deshalb steht
                  sie als Zeile da und nicht als leerer Zustand. Wer Podcasts
                  hört, sucht genau diese Zeile.
                */}
                <Zeile
                  name="Keine Musik"
                  hinweis="Nur die Spielgeräusche"
                  gewaehlt={werte.stueck === null}
                  onWaehlen={() => {
                    probeMusik(null);
                    setzeEinstellungen({ stueck: null });
                  }}
                />
                {stuecke.map((w) => (
                  <Zeile
                    key={w.id}
                    name={MUSIK_NAMEN[w.wert] ?? w.wert}
                    hinweis={w.preis.coins === 0 ? 'Gehört allen' : 'Gekauft'}
                    gewaehlt={werte.stueck === w.wert}
                    spielt={probeLaeuft === w.wert}
                    onHoeren={() => probeMusik(w.wert)}
                    onWaehlen={() => {
                      probeMusik(null);
                      setzeEinstellungen({ stueck: w.wert });
                    }}
                  />
                ))}
              </div>
            </Tafel>

            <Tafel titel="Klangpakete" zusatz={`${pakete.length} im Besitz`}>
              <div className="klangschrank-liste">
                {pakete.map((w) => {
                  // Der Grundsatz steht in den Einstellungen als `null`, im
                  // Katalog aber als 'grund'. Beides meint dasselbe.
                  const istGrund = w.wert === 'grund';
                  const gewaehlt = istGrund ? werte.paket === null : werte.paket === w.wert;
                  return (
                    <Zeile
                      key={w.id}
                      name={PAKET_NAMEN[w.wert] ?? w.wert}
                      hinweis={istGrund ? 'Immer dabei' : 'Ersetzt einzelne Klänge'}
                      gewaehlt={gewaehlt}
                      onHoeren={() => probePaket(w.wert)}
                      onWaehlen={() => {
                        setzeEinstellungen({ paket: istGrund ? null : w.wert });
                        // Umgestellt heißt: sofort hören, worauf.
                        probePaket(istGrund ? null : w.wert);
                      }}
                    />
                  );
                })}
              </div>
            </Tafel>

            <p className="muted klangschrank-fuss">
              Neue Stücke und Pakete gibt es im Shop — dort lassen sie sich vor
              dem Kauf anhören. Wie laut es ist, steht in den Einstellungen.
            </p>
          </>
        )}

        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button className="hub-knopf hub-knopf--a" onClick={schliessen}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Eine Zeile: Name, Zustand, ein Ohr und ein Haken.
 *
 * Hören und Wählen sind zwei Knöpfe und nicht einer. Ein Tipp, der beides
 * täte, hieße: Wer nur kurz reinhören will, hat seine Einstellung schon
 * geändert — und wer wählt, muss das Stück ganz anhören.
 */
function Zeile({
  name,
  hinweis,
  gewaehlt,
  spielt = false,
  onHoeren,
  onWaehlen,
}: {
  name: string;
  hinweis: string;
  gewaehlt: boolean;
  spielt?: boolean;
  onHoeren?: () => void;
  onWaehlen: () => void;
}): React.JSX.Element {
  return (
    <div className={`klangschrank-zeile${gewaehlt ? ' is-gewaehlt' : ''}`}>
      <div className="klangschrank-text">
        <strong>{name}</strong>
        <span className="muted">{hinweis}</span>
      </div>
      {onHoeren && (
        <button
          className="klangschrank-hoeren"
          onClick={onHoeren}
          aria-label={spielt ? `${name} anhalten` : `${name} anhören`}
        >
          {spielt ? '■' : '▶'}
        </button>
      )}
      <button
        className={`lobby-chip${gewaehlt ? ' is-an' : ''}`}
        aria-pressed={gewaehlt}
        disabled={gewaehlt}
        onClick={onWaehlen}
      >
        {gewaehlt ? 'Gewählt' : 'Wählen'}
      </button>
    </div>
  );
}
