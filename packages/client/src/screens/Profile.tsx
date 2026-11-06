import { useEffect, useState } from 'react';

import { ApiError, api, type PlayerProfile, type Relationship } from '../api';
import { inAppSichtbar } from '../app-sichtbar';
import { t, zahl } from '../i18n';
import { tf, tn } from '../i18n/einsetzen';
import { MeldenBlatt } from '../melden/MeldenBlatt';
import { useRueckfrage, Zurueck } from './HbBlatt';
import { BrowortImProfil } from '../browort/BrowortImProfil';
import { bannerFuer } from './StartNeu';
import './hub-neu.css';

/**
 * Spielerprofil: laedt die Daten, gezeigt wird es in `ProfilNeu` (unten).
 *
 * Zwei getrennte Zahlenwelten, bewusst nebeneinander: Die Wertung zaehlt
 * nicht ueberall (Gast am Tisch oder Training: nein, siehe `countsForRanking`
 * im Server; Bots zaehlen seit dem 04.08.2026 mit), "gespielt" zaehlt alles.
 */
export function Profile({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack?: () => void;
}): React.JSX.Element {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = (): void => {
    setError(null);
    api
      .profile(accountId)
      .then(setProfile)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? t(err.messageKey) : t('spielerprofil.verbindungFehlgeschlagen'));
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [accountId]);

  const act = (action: () => Promise<unknown>): void => {
    setBusy(true);
    void action()
      .then(load)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? t(err.messageKey) : t('spielerprofil.verbindungFehlgeschlagen'));
      })
      .finally(() => setBusy(false));
  };

  return <ProfilNeu profile={profile} error={error} busy={busy} act={act} load={load} onBack={onBack} />;
}

/**
 * Fremdes Profil im neuen Hub (Emile, 22.10.2026).
 *
 * Vorher öffnete der Tipp auf einen Freund das alte Holzprofil mitten im
 * Nachtblau — mit Checkpoint-Kachel und Knöpfen der früheren Oberfläche.
 * Jetzt dieselben Bausteine wie das eigene Profil (`ProfilTab` neu):
 * Trophäenkarte, Spielzeilen, Freundschaft als Knopf, Melden leise unten.
 * Eine eigene `.hb`-Wurzel, weil das Profil ein eigener Bildschirm ist und
 * nicht im Hub-Rahmen steht — sonst fänden `ImHub` und die Farben keinen Halt.
 */
function ProfilNeu({
  profile,
  error,
  busy,
  act,
  load,
  onBack,
}: {
  profile: PlayerProfile | null;
  error: string | null;
  busy: boolean;
  act: (action: () => Promise<unknown>) => void;
  load: () => void;
  onBack?: () => void;
}): React.JSX.Element {
  const [meldenOffen, setMeldenOffen] = useState(false);
  const [frage, rueckfrage] = useRueckfrage();
  const zurueck = onBack ?? (() => window.history.back());

  const kopf = (
    <header className="hb-voll-kopf">
      <Zurueck onClick={zurueck} />
      <div className="hb-voll-titel">
        <h1>{profile?.displayName ?? t('spielerprofil.titel')}</h1>
        {profile && <span>{tf('spielerprofil.dabeiSeit', { datum: monatJahr(profile.memberSince) })}</span>}
      </div>
    </header>
  );

  if (!profile) {
    return (
      <div className="hb hb-fremd">
        {kopf}
        <div className="hb-fremd-rolle">
          {error ? (
            <div className="hb-karte hb-fremd-fehler">
              <span className="hb-fehler">{error}</span>
              <button type="button" className="hb-kn is-zweit" onClick={load}>
                {t('spielerprofil.nochmal')}
              </button>
            </div>
          ) : (
            <p className="hb-klein hb-liste-leer">{t('spielerprofil.laedt')}</p>
          )}
        </div>
      </div>
    );
  }

  const ranking = profile.ranking.filter((row) => inAppSichtbar(row.gameId));
  const quote =
    profile.totals.parties > 0
      ? `${Math.round((profile.totals.wins / profile.totals.parties) * 100)} %`
      : '-';
  // „Checkpoint" stand im alten Profil — das neue Hub kennt den Begriff
  // nirgends mehr, das eigene Profil zeigt an der Stelle die Spiele.
  const werte = [
    { name: t('spielerprofil.wert.partien'), wert: zahl(profile.totals.parties) },
    { name: t('spielerprofil.wert.siege'), wert: zahl(profile.totals.wins) },
    { name: t('spielerprofil.wert.siegquote'), wert: quote },
    { name: t('spielerprofil.wert.spiele'), wert: String(ranking.filter((row) => row.parties > 0).length) },
  ];

  const beenden = (): void =>
    frage(
      {
        titel: t('spielerprofil.beenden.frage'),
        text: tf('spielerprofil.beenden.text', { name: profile.displayName }),
        ja: t('spielerprofil.beenden.ja'),
        gefahr: true,
      },
      () => act(() => api.removeFriend(profile.id)),
    );

  return (
    <div className="hb hb-fremd">
      {kopf}
      <div className="hb-fremd-rolle">
        <div className="hb-karte hb-fremd-held">
          <img src="/hub/pinguin/pinguin-basis.webp" alt="" draggable={false} />
          <span className="hb-fremd-beziehung">
            <FreundMarke relationship={profile.relationship} />
          </span>
        </div>

        {error && <span className="hb-fehler">{error}</span>}

        <FreundKnoepfe
          relationship={profile.relationship}
          busy={busy}
          onRequest={() => act(() => api.requestFriend(profile.id))}
          onAccept={() => act(() => api.acceptFriend(profile.id))}
          onRemove={() => act(() => api.removeFriend(profile.id))}
        />

        <section className="hb-blk">
          <h2 className="hb-ab">
            {t('spielerprofil.trophaeen')}
            <span className="hb-ab-zusatz">{tn('spielerprofil.partien', profile.totals.parties)}</span>
          </h2>
          <div className="hb-karte hb-trophaeen">
            <span className="hb-trophaeen-zahl">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {zahl(profile.totals.trophies)}
            </span>
            <span className="hb-klein">{t('spielerprofil.alleSpiele')}</span>
            <span className="hb-sp-werte is-vier">
              {werte.map((w) => (
                <span key={w.name}>
                  <b>{w.wert}</b>
                  {w.name}
                </span>
              ))}
            </span>
          </div>
          <div className="hb-liste">
            {ranking.length === 0 ? (
              <p className="hb-klein hb-liste-leer">{t('spielerprofil.keinePartie')}</p>
            ) : (
              ranking.map((row) => (
                <div className="hb-mg" key={row.gameId}>
                  <img className="hb-mg-spiel" src={bannerFuer(row.gameId)} alt="" />
                  <span className="hb-mg-name">
                    <strong>{t(`game.${row.gameId}`)}</strong>
                    <small className="is-leise">
                      {tf('spielerprofil.zeile', { partien: row.parties, siege: row.wins })}
                    </small>
                  </span>
                  <span className="hb-pk">
                    <img src="/hub/symbol-pokal.webp" alt="" />
                    {zahl(row.trophies)}
                  </span>
                </div>
              ))
            )}
          </div>
          {/* Wortgleich mit dem eigenen Profil — dieselbe Regel aus dem
              Server (`countsForRanking`). */}
          <p className="hb-klein hb-ohne-rand">
            {t('spielerprofil.trophaeenHinweis')}
          </p>
        </section>

        {profile.browort && (
          <BrowortImProfil
            du={false}
            serie={profile.browort.serie}
            schnitt={profile.browort.schnitt}
            geloest={profile.browort.geloest}
            beste={profile.browort.beste}
          />
        )}

        {/* Beenden steht leise unten, nicht groß unter der Figur: Es ist der
            eine Knopf auf dieser Seite, den man bereut. */}
        {profile.relationship === 'friends' && (
          <button type="button" className="hb-leise-knopf" onClick={beenden} disabled={busy}>
            {t('spielerprofil.beenden.knopf')}
          </button>
        )}
        {/* Melden und Blockieren (Apple 1.2): leise am Schluss, aber immer da. */}
        {profile.relationship !== 'self' && (
          <button type="button" className="hb-leise-knopf" onClick={() => setMeldenOffen(true)}>
            {profile.blockiert ? t('spielerprofil.melden.blockiert') : t('spielerprofil.melden.knopf')}
          </button>
        )}
      </div>
      {meldenOffen && (
        <MeldenBlatt
          neu
          accountId={profile.id}
          name={profile.displayName}
          blockiert={profile.blockiert ?? false}
          onBlockiert={() => load()}
          onClose={() => setMeldenOffen(false)}
        />
      )}
      {rueckfrage}
    </div>
  );
}

/** Wie man zueinander steht, als kleine Marke unter der Figur. */
function FreundMarke({ relationship }: { relationship: Relationship }): React.JSX.Element | null {
  switch (relationship) {
    case 'self':
      return <>{t('spielerprofil.marke.selbst')}</>;
    case 'friends':
      return <>{t('spielerprofil.marke.freunde')}</>;
    case 'outgoing':
      return <>{t('spielerprofil.marke.gesendet')}</>;
    case 'incoming':
      return <>{t('spielerprofil.marke.eingehend')}</>;
    case 'none':
      return null;
  }
}

/** Der Knopf sagt immer, was als Nächstes passiert — nie nur einen Zustand. */
function FreundKnoepfe({
  relationship,
  busy,
  onRequest,
  onAccept,
  onRemove,
}: {
  relationship: Relationship;
  busy: boolean;
  onRequest: () => void;
  onAccept: () => void;
  onRemove: () => void;
}): React.JSX.Element | null {
  switch (relationship) {
    case 'self':
    case 'friends':
      // Freunde: die Marke unter der Figur sagt es, Beenden steht unten.
      return null;
    case 'none':
      return (
        <button type="button" className="hb-kn is-gold is-haupt is-breit" onClick={onRequest} disabled={busy}>
          {t('spielerprofil.knopf.hinzufuegen')}
        </button>
      );
    case 'outgoing':
      return (
        <button type="button" className="hb-kn is-zweit is-breit" onClick={onRemove} disabled={busy}>
          {t('spielerprofil.knopf.zurueckziehen')}
        </button>
      );
    case 'incoming':
      return (
        <div className="hb-knopfreihe">
          <button type="button" className="hb-kn is-gold" onClick={onAccept} disabled={busy}>
            {t('spielerprofil.knopf.annehmen')}
          </button>
          <button type="button" className="hb-kn is-zweit" onClick={onRemove} disabled={busy}>
            {t('spielerprofil.knopf.ablehnen')}
          </button>
        </div>
      );
  }
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** „2026-10" → „Oktober 2026". Was nicht passt, bleibt, wie es kam. */
function monatJahr(jahrMonat: string): string {
  const [jahr, monat] = jahrMonat.split('-');
  const name = MONATE[Number(monat) - 1];
  return jahr && name ? `${name} ${jahr}` : jahrMonat;
}
