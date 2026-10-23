/**
 * Klanghalle — hier wird ausgesucht, was man hört.
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
import { Schliessen, useEscape } from './HbBlatt';
import './klanghalle.css';

export function Klanghalle({
  onClose,
  neu = false,
}: {
  onClose: () => void;
  /** Neues Hub: Vollbild in Nachtblau & Gold mit Plattenteller statt Holzblatt. */
  neu?: boolean;
}): React.JSX.Element {
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

  if (neu) {
    return (
      <KlanghalleNeu
        werte={werte}
        probeLaeuft={probeLaeuft}
        ware={ware}
        stuecke={stuecke}
        pakete={pakete}
        onClose={schliessen}
      />
    );
  }

  return (
    <div className="doko-sheet doko-sheet--mitte" onClick={schliessen}>
      <div
        className="doko-sheet-card klanghalle"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Klanghalle</h2>

        {ware === null ? (
          <p className="muted">Einen Moment…</p>
        ) : (
          <>
            <Tafel titel="Musik" zusatz={`${stuecke.length} im Besitz`}>
              <div className="klanghalle-liste">
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
              <div className="klanghalle-liste">
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

            <p className="muted klanghalle-fuss">
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
    <div className={`klanghalle-zeile${gewaehlt ? ' is-gewaehlt' : ''}`}>
      <div className="klanghalle-text">
        <strong>{name}</strong>
        <span className="muted">{hinweis}</span>
      </div>
      {onHoeren && (
        <button
          className="klanghalle-hoeren"
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

/**
 * Klanghalle im neuen Hub (Emile, 22.10.2026).
 *
 * Wie der Spind ein Vollbild mit Bühne: oben ein Plattenteller, der sich
 * dreht, solange eine Probe läuft, und darunter sagt, was gewählt ist. Die
 * Bühne ist reines CSS — kein Bild, das fehlen könnte. Darunter dieselben
 * zwei Listen wie im alten Blatt, und Hören und Wählen bleiben getrennt
 * (Begründung an `Zeile`): links das Ohr, die Zeile selbst wählt.
 */
function KlanghalleNeu({
  werte,
  probeLaeuft,
  ware,
  stuecke,
  pakete,
  onClose,
}: {
  werte: ReturnType<typeof holeEinstellungen>;
  probeLaeuft: string | null;
  ware: RegalWare[] | null;
  stuecke: RegalWare[];
  pakete: RegalWare[];
  onClose: () => void;
}): React.JSX.Element {
  useEscape(onClose);

  const gewaehltesStueck =
    werte.stueck === null ? 'Keine Musik' : (MUSIK_NAMEN[werte.stueck] ?? werte.stueck);
  const gewaehltesPaket =
    werte.paket === null ? PAKET_NAMEN.grund ?? 'Grundklang' : (PAKET_NAMEN[werte.paket] ?? werte.paket);
  const laeuft = probeLaeuft !== null ? (MUSIK_NAMEN[probeLaeuft] ?? probeLaeuft) : null;

  return (
    <div className="hb-voll kh" role="dialog" aria-modal="true" aria-label="Klanghalle">
      <header className="hb-voll-kopf">
        <Schliessen onClick={onClose} />
        <div className="hb-voll-titel">
          <h1>Klanghalle</h1>
          <span>Was du am Tisch hörst</span>
        </div>
      </header>

      <div className="kh-rolle">
        <div className={`kh-buehne${laeuft ? ' is-laeuft' : ''}`}>
          <span className="kh-platte" aria-hidden="true">
            <span className="kh-etikett" />
          </span>
          <span className="kh-arm" aria-hidden="true" />
          <span className="kh-jetzt">
            <small>{laeuft ? 'Hörprobe' : 'Gewählt'}</small>
            <strong>{laeuft ?? gewaehltesStueck}</strong>
            <span>Klang: {gewaehltesPaket}</span>
          </span>
        </div>

        {ware === null ? (
          <p className="hb-klein hb-liste-leer">Einen Moment…</p>
        ) : (
          <>
            <section className="hb-blk">
              <h2 className="hb-ab">
                Musik
                <span className="hb-ab-zusatz">{stuecke.length} im Besitz</span>
              </h2>
              <div className="kh-liste">
                {/* „Keine Musik" ist eine Wahl, kein Fehlen (siehe oben). */}
                <ZeileNeu
                  name="Keine Musik"
                  hinweis="Nur die Spielgeräusche"
                  gewaehlt={werte.stueck === null}
                  onWaehlen={() => {
                    probeMusik(null);
                    setzeEinstellungen({ stueck: null });
                  }}
                />
                {stuecke.map((w) => (
                  <ZeileNeu
                    key={w.id}
                    name={MUSIK_NAMEN[w.wert] ?? w.wert}
                    hinweis={w.preis.coins === 0 ? 'Gehört allen' : 'Gekauft'}
                    gewaehlt={werte.stueck === w.wert}
                    spielt={probeLaeuft === w.wert}
                    onHoeren={() => probeMusik(probeLaeuft === w.wert ? null : w.wert)}
                    onWaehlen={() => {
                      probeMusik(null);
                      setzeEinstellungen({ stueck: w.wert });
                    }}
                  />
                ))}
              </div>
            </section>

            <section className="hb-blk">
              <h2 className="hb-ab">
                Klangpakete
                <span className="hb-ab-zusatz">{pakete.length} im Besitz</span>
              </h2>
              <div className="kh-liste">
                {pakete.map((w) => {
                  // Grundsatz: in den Einstellungen `null`, im Katalog 'grund'.
                  const istGrund = w.wert === 'grund';
                  const gewaehlt = istGrund ? werte.paket === null : werte.paket === w.wert;
                  return (
                    <ZeileNeu
                      key={w.id}
                      name={PAKET_NAMEN[w.wert] ?? w.wert}
                      hinweis={istGrund ? 'Immer dabei' : 'Ersetzt einzelne Klänge'}
                      gewaehlt={gewaehlt}
                      onHoeren={() => probePaket(w.wert)}
                      onWaehlen={() => {
                        setzeEinstellungen({ paket: istGrund ? null : w.wert });
                        probePaket(istGrund ? null : w.wert);
                      }}
                    />
                  );
                })}
              </div>
            </section>

            <p className="hb-klein hb-ohne-rand">
              Neue Stücke und Pakete gibt es im Shop — dort lassen sie sich vor dem Kauf anhören. Wie laut
              es ist, steht in den Einstellungen.
            </p>
          </>
        )}
      </div>

      <div className="kh-fuss">
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}

/** Neues Hub: links das Ohr, die Zeile selbst wählt, rechts der Haken. */
function ZeileNeu({
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
    <div className={`kh-zeile${gewaehlt ? ' is-gewaehlt' : ''}${spielt ? ' is-spielt' : ''}`}>
      {onHoeren ? (
        <button
          type="button"
          className="kh-hoeren"
          onClick={onHoeren}
          aria-label={spielt ? `${name} anhalten` : `${name} anhören`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {spielt ? <rect x="7" y="7" width="10" height="10" rx="2" /> : <path d="M8 5.5v13l11-6.5z" />}
          </svg>
        </button>
      ) : (
        <span className="kh-hoeren is-leer" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 9v6h4l5 4V5L9 9z M17 9l4 6 M21 9l-4 6" />
          </svg>
        </span>
      )}
      <button
        type="button"
        className="kh-waehlen"
        aria-pressed={gewaehlt}
        onClick={() => {
          if (!gewaehlt) onWaehlen();
        }}
      >
        <span className="kh-text">
          <strong>{name}</strong>
          <small>{hinweis}</small>
        </span>
        <span className="kh-haken" aria-hidden="true">
          {gewaehlt ? (
            <svg viewBox="0 0 24 24">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : null}
        </span>
      </button>
    </div>
  );
}
