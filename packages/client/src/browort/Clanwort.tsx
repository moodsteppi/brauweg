import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../api';
import { t } from '../i18n';
import { Schliessen, useEscape, useRueckfrage } from '../screens/HbBlatt';
import type { Belohnung, ClanwortAnsicht } from './sicht';
import { Raster, Tastatur, useWortEingabe } from './Spielfeld';

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
      .catch((err: unknown) => setFehler(err instanceof ApiError ? t(err.messageKey) : 'Keine Verbindung.'));
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
              titel: `„${wort}“ als Clanwort?`,
              text: 'Dein Clan rät es heute. Du selbst rätst nicht mit.',
              ja: 'Wort festlegen',
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

  const rangliste = stand && stand.rangliste.length > 0 && (
    <section className="hb-blk bw-rangliste">
      <h2 className="hb-ab">
        Heute im Clan
        <span className="hb-ab-zusatz">{stand.rangliste.filter((z) => z.geloest).length} gelöst</span>
      </h2>
      <div className="hb-liste">
        {stand.rangliste.map((zeile, i) => (
          <div key={zeile.accountId} className="hb-mg">
            <span className="bw-platz">{zeile.geloest ? i + 1 : '-'}</span>
            <span className="hb-mg-name">
              <strong>{zeile.name}</strong>
              <small className="is-leise">
                {zeile.geloest
                  ? `in ${zeile.versuche} ${zeile.versuche === 1 ? 'Versuch' : 'Versuchen'}`
                  : zeile.fertig
                    ? 'nicht geschafft'
                    : `rät noch (${zeile.versuche}/6)`}
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
                ? 'Heute wählst du das Wort'
                : `Heute gewählt von ${stand.waehler.name}`
              : stand?.zufall
                ? 'Heute vom Zufall gewählt'
                : 'Ein Wort für den ganzen Clan'}
          </span>
        </div>
        {stand && stand.serie.serie > 0 && (
          <span className="bw-kopf-serie" aria-label={`Clanwort-Serie ${stand.serie.serie}`}>
            🔥 {stand.serie.serie}
          </span>
        )}
      </header>

      {stand === undefined ? (
        <div className="bw-mitte">
          {fehler ? (
            <div className="hb-fehler">
              {fehler}{' '}
              <button type="button" className="hb-link" onClick={laden}>
                Nochmal
              </button>
            </div>
          ) : (
            <p className="hb-klein">Einen Moment…</p>
          )}
        </div>
      ) : stand === null ? (
        <div className="bw-mitte">
          <p className="hb-klein bw-hinweis">Das Clanwort gibt es nur im Clan. Tritt einem bei oder gründe einen.</p>
        </div>
      ) : stand.phase === 'warten' ? (
        <div className="bw-mitte bw-rolle">
          <div className="hb-karte bw-warten">
            <strong>{stand.waehler?.name ?? 'Jemand'} sucht gerade das Wort aus.</strong>
            <span className="hb-klein">
              Spätestens um {stand.wahlBis} Uhr geht es los - kommt bis dahin nichts, wählt der Zufall.
            </span>
          </div>
          {rangliste}
        </div>
      ) : stand.phase === 'wortgeber' ? (
        <div className="bw-mitte bw-rolle">
          <div className="hb-karte bw-warten">
            <span className="hb-klein">Dein Wort für heute</span>
            <strong className="bw-geheim">{stand.loesung}</strong>
            <span className="hb-klein">Du rätst heute nicht mit - schau zu, wie sich dein Clan schlägt.</span>
          </div>
          {rangliste || <p className="hb-klein bw-hinweis">Noch hat niemand geraten.</p>}
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
              Du wurdest ausgelost: Tippe bis {stand.wahlBis} Uhr ein Wort mit fünf Buchstaben.
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
                <strong>{stand.geloest ? `Gelöst in ${stand.versuche.length}` : 'Heute nicht geschafft'}</strong>
                <span>
                  Das Wort war <b>{stand.loesung}</b>
                </span>
                {belohnung && (
                  <span className="bw-lohn">
                    +{belohnung.muenzen} Münzen · +{belohnung.xp} XP
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
