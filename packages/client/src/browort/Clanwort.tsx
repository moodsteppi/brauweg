import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import type { Belohnung, ClanwortAnsicht } from './sicht';
import { Raster, Tastatur, useWortEingabe, type WortEingabe } from './Spielfeld';
import { anzahl, tz, zeigeSprachhinweis } from './text';

/** Die Rueckfrage zur Wahl wurde abgebrochen — kein Fehler, nichts zu melden. */
export class AbgebrochenFehler extends Error {
  override name = 'Abgebrochen';
}

/**
 * Clanwort (Emile, 23.10.2026): Je Clan und Tag wird ein Mitglied
 * ausgelost, das bis 12 Uhr ein Wort waehlt; die anderen raten es. Danach
 * zeigt die Tagesrangliste, wer es mit wie vielen Versuchen hatte.
 *
 * Vier Lagen (`phase` vom Server): selbst waehlen, auf die Wahl warten,
 * raten — oder als Wortgeber zuschauen. Gewaehlt wird mit derselben
 * Tastatur wie beim Raten; geprueft wird das Wort auf dem Server.
 */
export function Clanwort({
  onClose,
  onGeaendert,
}: {
  onClose: () => void;
  onGeaendert: () => void;
}): React.JSX.Element {
  useEscape(onClose);
  const [stand, setStand] = useState<ClanwortAnsicht | null | undefined>(undefined);
  const [fehler, setFehler] = useState<string | null>(null);
  const [belohnung, setBelohnung] = useState<Belohnung | null>(null);
  const [frage, rueckfrage] = useRueckfrage();

  const laden = useCallback(() => {
    setFehler(null);
    api
      .clanwort()
      .then((antwort) => setStand(antwort.clanwort))
      .catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : t('browort.ui.keineVerbindung')));
  }, []);
  useEffect(laden, [laden]);

  const phase = stand?.phase;
  const schicke = useCallback(
    async (wort: string): Promise<ClanwortAnsicht> => {
      if (phase === 'waehlen') {
        // Erst nachfragen: Gewaehlt ist gewaehlt, fuer den ganzen Clan.
        return new Promise<ClanwortAnsicht>((fertig, scheitern) => {
          frage(
            {
              titel: tz('browort.ui.clan.frageTitel', { wort }),
              text: t('browort.ui.clan.frageText'),
              ja: t('browort.ui.clan.frageJa'),
            },
            () => {
              void api
                .clanwortWahl(wort)
                .then((antwort) => fertig(antwort.clanwort))
                .catch(scheitern);
            },
            // Abgebrochen: Das Wort bleibt stehen und laesst sich aendern.
            () => scheitern(new AbgebrochenFehler()),
          );
        });
      }
      const antwort = await api.clanwortVersuch(wort);
      if (antwort.belohnung) setBelohnung(antwort.belohnung);
      return antwort.clanwort;
    },
    [phase, frage],
  );
  const onNeu = useCallback(
    (neu: ClanwortAnsicht) => {
      setStand(neu);
      if (neu.fertig) onGeaendert();
    },
    [onGeaendert],
  );
  const spiel = useWortEingabe({
    runde: stand ?? null,
    schicke,
    onNeu,
    aktiv: Boolean(stand && ((stand.phase === 'raten' && !stand.fertig) || stand.phase === 'waehlen')),
  });

  return (
    <ClanwortBild
      stand={stand}
      fehler={fehler}
      belohnung={belohnung}
      spiel={spiel}
      rueckfrage={rueckfrage}
      onClose={onClose}
      onNochmal={laden}
    />
  );
}

/**
 * Die Anzeige von Clanwort, ohne Server und ohne eigenen Zustand.
 *
 * Getrennt von der Hülle wie bei Browort: Die vier Lagen hängen daran, wer
 * heute ausgelost wurde — der Sprach-Schaukasten
 * (sprachprobe-schaukasten.html) zeichnet jede mit erfundenen Daten.
 */
export function ClanwortBild({
  stand,
  fehler,
  belohnung,
  spiel,
  rueckfrage,
  onClose,
  onNochmal,
}: {
  /** undefined: wird geladen; null: ohne Clan. */
  stand: ClanwortAnsicht | null | undefined;
  fehler: string | null;
  belohnung: Belohnung | null;
  spiel: WortEingabe;
  /** Die offene Rückfrage zur Wahl (aus `useRueckfrage`), sonst null. */
  rueckfrage: React.ReactNode;
  onClose: () => void;
  onNochmal: () => void;
}): React.JSX.Element {
  const rangliste = stand && stand.rangliste.length > 0 && (
    <section className="hb-blk bw-rangliste">
      <h2 className="hb-ab">
        {t('browort.ui.clan.heuteImClan')}
        <span className="hb-ab-zusatz">{tz('browort.ui.geloestZahl', { n: stand.rangliste.filter((z) => z.geloest).length })}</span>
      </h2>
      <div className="hb-liste">
        {stand.rangliste.map((zeile, i) => (
          <div key={zeile.accountId} className="hb-mg">
            <span className="bw-platz">{zeile.geloest ? i + 1 : '-'}</span>
            <span className="hb-mg-name">
              <strong>{zeile.name}</strong>
              <small className="is-leise">
                {zeile.geloest
                  ? anzahl('browort.ui.clan.inVersuchen', zeile.versuche)
                  : zeile.fertig
                    ? t('browort.ui.clan.nichtGeschafft')
                    : tz('browort.ui.clan.raetNoch', { n: zeile.versuche })}
              </small>
            </span>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="hb-voll bw" role="dialog" aria-modal="true" aria-label="Clanwort">
      <header className="hb-voll-kopf">
        <Schliessen onClick={onClose} />
        <div className="hb-voll-titel">
          <h1>Clanwort</h1>
          <span>
            {stand?.waehler
              ? stand.phase === 'waehlen'
                ? t('browort.ui.clan.duWaehlst')
                : tz('browort.ui.clan.gewaehltVon', { name: stand.waehler.name })
              : stand?.zufall
                ? t('browort.ui.clan.vomZufall')
                : t('browort.ui.clan.fuerDenClan')}
            {/* Wie bei Browort: Geraten wird deutsch, das muss man auf Englisch wissen. */}
            {zeigeSprachhinweis() && <> · {t('browort.ui.deutschesWortspiel')}</>}
          </span>
        </div>
        {stand && stand.serie.serie > 0 && (
          <span className="bw-kopf-serie" aria-label={tz('browort.ui.clan.serieAria', { n: stand.serie.serie })}>
            🔥 {stand.serie.serie}
          </span>
        )}
      </header>

      {stand === undefined ? (
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
      ) : stand === null ? (
        <div className="bw-mitte">
          <p className="hb-klein bw-hinweis">{t('browort.ui.clan.ohneClan')}</p>
        </div>
      ) : stand.phase === 'warten' ? (
        <div className="bw-mitte bw-rolle">
          <div className="hb-karte bw-warten">
            <strong>{tz('browort.ui.clan.sucht', { name: stand.waehler?.name ?? t('browort.ui.clan.jemand') })}</strong>
            <span className="hb-klein">
              {tz('browort.ui.clan.spaetestens', { uhr: stand.wahlBis })}
            </span>
          </div>
          {rangliste}
        </div>
      ) : stand.phase === 'wortgeber' ? (
        <div className="bw-mitte bw-rolle">
          <div className="hb-karte bw-warten">
            <span className="hb-klein">{t('browort.ui.clan.deinWort')}</span>
            <strong className="bw-geheim">{stand.loesung}</strong>
            <span className="hb-klein">{t('browort.ui.clan.zuschauen')}</span>
          </div>
          {rangliste || <p className="hb-klein bw-hinweis">{t('browort.ui.clan.niemand')}</p>}
        </div>
      ) : stand.phase === 'waehlen' ? (
        <>
          <div className="bw-mitte">
            {spiel.meldung && (
              <p className="bw-meldung" role="alert">
                {spiel.meldung}
              </p>
            )}
            <p className="hb-klein bw-hinweis">
              {tz('browort.ui.clan.ausgelost', { uhr: stand.wahlBis })}
            </p>
            <Raster versuche={[]} eingabe={spiel.eingabe} max={1} wackelt={spiel.wackelt} aufdecken={null} />
          </div>
          <Tastatur versuche={[]} gesperrt={spiel.laeuft} onTaste={spiel.taste} />
        </>
      ) : (
        <>
          <div className="bw-mitte">
            {spiel.meldung && (
              <p className="bw-meldung" role="alert">
                {spiel.meldung}
              </p>
            )}
            <Raster
              versuche={stand.versuche}
              eingabe={spiel.eingabe}
              max={stand.maxVersuche}
              wackelt={spiel.wackelt}
              aufdecken={spiel.aufdecken}
            />
          </div>
          {stand.fertig ? (
            <div className="bw-ende bw-rolle">
              <div className={`bw-ergebnis${stand.geloest ? ' is-geloest' : ''}`} role="status">
                <strong>{stand.geloest ? tz('browort.ui.clan.geloestIn', { n: stand.versuche.length }) : t('browort.ui.nichtGeschafft')}</strong>
                <span>
                  {t('browort.ui.dasWortWar')} <b>{stand.loesung}</b>
                </span>
                {belohnung && (
                  <span className="bw-lohn">
                    {tz('browort.ui.lohn', { muenzen: belohnung.muenzen, xp: belohnung.xp })}
                  </span>
                )}
              </div>
              {rangliste}
            </div>
          ) : (
            <Tastatur versuche={stand.versuche} gesperrt={spiel.laeuft} onTaste={spiel.taste} />
          )}
        </>
      )}
      {rueckfrage}
    </div>
  );
}
