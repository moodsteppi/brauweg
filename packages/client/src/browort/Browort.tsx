import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { Schliessen, useEscape } from '../screens/HbBlatt';
import type { Belohnung, BrowortAnsicht } from './sicht';
import { BrowortFlamme, Raster, Tastatur, schnittText, useWortEingabe, type WortEingabe } from './Spielfeld';
import { tz, zeigeSprachhinweis } from './text';

/**
 * Browort (Emile, 23.10.2026): ein deutsches Wort am Tag, fuenf Buchstaben,
 * sechs Versuche. Nur in der App, wie der Lernpfad.
 *
 * Geraten wird auf dem Server — der Bildschirm schickt das Wort und zeigt
 * die Farben, die zurueckkommen. Das Loesungswort kennt er erst, wenn die
 * Runde vorbei ist (browort/dienst.ts im Server).
 */
export function Browort({
  onClose,
  onGeaendert,
}: {
  onClose: () => void;
  /** Muenzen, XP oder Serie haben sich geaendert — `/api/me` neu laden. */
  onGeaendert: () => void;
}): React.JSX.Element {
  useEscape(onClose);
  const [runde, setRunde] = useState<BrowortAnsicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [belohnung, setBelohnung] = useState<Belohnung | null>(null);
  const [geschuetzt, setGeschuetzt] = useState(false);

  const laden = useCallback(() => {
    setFehler(null);
    api
      .browort()
      .then(setRunde)
      .catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : t('browort.ui.keineVerbindung')));
  }, []);
  useEffect(laden, [laden]);

  const schicke = useCallback(async (wort: string) => {
    const neu = await api.browortVersuch(wort);
    if (neu.belohnung) setBelohnung(neu.belohnung);
    if (neu.geschuetzt) setGeschuetzt(true);
    return neu;
  }, []);
  const onNeu = useCallback(
    (neu: BrowortAnsicht) => {
      setRunde(neu);
      if (neu.fertig) onGeaendert();
    },
    [onGeaendert],
  );
  const spiel = useWortEingabe({ runde, schicke, onNeu, aktiv: runde !== null && !runde.fertig });

  return (
    <BrowortBild
      runde={runde}
      fehler={fehler}
      belohnung={belohnung}
      geschuetzt={geschuetzt}
      spiel={spiel}
      onClose={onClose}
      onNochmal={laden}
    />
  );
}

/**
 * Die Anzeige von Browort, ohne Server und ohne eigenen Zustand.
 *
 * Getrennt von der Hülle, damit der Sprach-Schaukasten
 * (sprachprobe-schaukasten.html) die laufende und die fertige Runde mit
 * erfundenen Daten zeichnen kann — die fertige Runde samt Statistik sieht man
 * sonst nur einmal am Tag.
 */
export function BrowortBild({
  runde,
  fehler,
  belohnung,
  geschuetzt,
  spiel,
  onClose,
  onNochmal,
}: {
  /** null: wird noch geladen (oder `fehler`). */
  runde: BrowortAnsicht | null;
  fehler: string | null;
  belohnung: Belohnung | null;
  geschuetzt: boolean;
  spiel: WortEingabe;
  onClose: () => void;
  onNochmal: () => void;
}): React.JSX.Element {
  const statistik = runde?.statistik;
  const quote = statistik && statistik.gespielt > 0 ? Math.round((statistik.geloest / statistik.gespielt) * 100) : 0;
  const hoechste = Math.max(1, ...(statistik?.verteilung ?? [1]));

  return (
    <div className="hb-voll bw" role="dialog" aria-modal="true" aria-label="Browort">
      <header className="hb-voll-kopf">
        <Schliessen onClick={onClose} />
        <div className="hb-voll-titel">
          <h1>Browort</h1>
          {/* Auf Englisch sonst ein Rätsel, warum „HAFEN“ gesucht ist: Das
              Wort bleibt deutsch (Wortliste und Tastatur), also wird es gesagt. */}
          <span>
            {t('browort.ui.wortDesTages')}
            {zeigeSprachhinweis() && <> · {t('browort.ui.deutschesWortspiel')}</>}
          </span>
        </div>
        {runde && (
          <span className="bw-kopf-flamme" aria-label={tz('browort.ui.kopfAria', { serie: runde.serie.serie, schnitt: schnittText(statistik?.schnitt ?? null) })}>
            <BrowortFlamme schnitt={statistik?.schnitt ?? null} an={runde.serie.heuteGespielt && runde.geloest} groesse={2.4} />
            <b>{runde.serie.serie}</b>
          </span>
        )}
      </header>

      {!runde ? (
        <div className="bw-mitte">
          {fehler ? (
            <div className="hb-fehler">
              {fehler}{' '}
              <button type="button" className="hb-link" onClick={onNochmal}>
                {t('browort.ui.nochmal')}
              </button>
            </div>
          ) : (
            <p className="hb-klein">{t('browort.ui.einenMoment')}</p>
          )}
        </div>
      ) : (
        <>
          <div className="bw-mitte">
            {spiel.meldung && (
              <p className="bw-meldung" role="alert">
                {spiel.meldung}
              </p>
            )}
            <Raster
              versuche={runde.versuche}
              eingabe={spiel.eingabe}
              max={runde.maxVersuche}
              wackelt={spiel.wackelt}
              aufdecken={spiel.aufdecken}
            />
          </div>

          {runde.fertig ? (
            <div className="bw-ende">
              <div className={`bw-ergebnis${runde.geloest ? ' is-geloest' : ''}`} role="status">
                <strong>
                  {runde.geloest
                    ? runde.versuche.length === 1
                      ? t('browort.ui.imErstenVersuch')
                      : tz('browort.ui.geloestIn', { n: runde.versuche.length })
                    : t('browort.ui.nichtGeschafft')}
                </strong>
                <span>
                  {t('browort.ui.dasWortWar')} <b>{runde.loesung}</b>
                </span>
                {belohnung && (
                  <span className="bw-lohn">
                    {tz('browort.ui.lohn', { muenzen: belohnung.muenzen, xp: belohnung.xp })}
                  </span>
                )}
                {geschuetzt && <span className="hb-klein">{t('browort.ui.wochenschutz')}</span>}
              </div>

              <div className="bw-zahlen">
                <span>
                  <b>{statistik?.gespielt ?? 0}</b>{t('browort.ui.gespielt')}
                </span>
                <span>
                  <b>{quote} %</b>{t('browort.ui.geloest')}
                </span>
                <span>
                  <b>{runde.serie.serie}</b>{t('browort.ui.serie')}
                </span>
                <span>
                  <b>{runde.serie.beste}</b>{t('browort.ui.beste')}
                </span>
              </div>

              <div className="bw-verteilung" aria-label={t('browort.ui.verteilungAria')}>
                {(statistik?.verteilung ?? []).map((anzahl, i) => (
                  <div key={i} className="bw-balkenzeile">
                    <span>{i + 1}</span>
                    <i
                      className={runde.geloest && runde.versuche.length === i + 1 ? 'is-heute' : undefined}
                      style={{ width: `${Math.max(8, (anzahl / hoechste) * 100)}%` }}
                    >
                      {anzahl}
                    </i>
                  </div>
                ))}
              </div>
              <p className="hb-klein bw-morgen">{t('browort.ui.morgen')}</p>
            </div>
          ) : (
            <Tastatur versuche={runde.versuche} gesperrt={spiel.laeuft} onTaste={spiel.taste} />
          )}
        </>
      )}
    </div>
  );
}
