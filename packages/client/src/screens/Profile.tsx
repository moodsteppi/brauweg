import { useEffect, useState } from 'react';

import { Ladekreis } from '../Ladekreis';

import { ApiError, api, type PlayerProfile, type Relationship } from '../api';
import { inAppSichtbar } from '../app-sichtbar';
import { HubBanner, HubSzene, StatHero, StatKachel, StatSpiel } from '../hub';
import { hubNeu } from '../hubNeu';
import { t } from '../i18n';
import { MeldenBlatt } from '../melden/MeldenBlatt';
import { useRueckfrage, Zurueck } from './HbBlatt';
import { bannerFuer } from './StartNeu';
import './hub-neu.css';

/**
 * Spielerprofil (Entwurf A — knallig, Pokal-Hero).
 *
 * Zwei getrennte Zahlenwelten, bewusst nebeneinander: Die Wertung zaehlt
 * nicht ueberall (Gast am Tisch oder Training: nein, siehe `countsForRanking`
 * im Server; Bots zaehlen seit dem 04.08.2026 mit), "gespielt" zaehlt alles.
 */
export function Profile({
  accountId,
  onBack,
  eingebettet = false,
}: {
  accountId: string;
  onBack?: () => void;
  /**
   * Als Tab-Inhalt statt als eigener Bildschirm: kein Rahmen, kein
   * Zurueck-Knopf — die Navigation gehoert dann der Tab-Leiste.
   */
  eingebettet?: boolean;
}): React.JSX.Element {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meldenOffen, setMeldenOffen] = useState(false);

  const load = (): void => {
    setError(null);
    api
      .profile(accountId)
      .then(setProfile)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [accountId]);

  const act = (action: () => Promise<unknown>): void => {
    setBusy(true);
    void action()
      .then(load)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
      })
      .finally(() => setBusy(false));
  };

  if (hubNeu && !eingebettet) {
    return <ProfilNeu profile={profile} error={error} busy={busy} act={act} load={load} onBack={onBack} />;
  }

  if (error && !profile) {
    return (
      <ProfilRahmen eingebettet={eingebettet} onBack={onBack}>
        <p className="error">{error}</p>
      </ProfilRahmen>
    );
  }

  if (!profile) {
    return (
      <ProfilRahmen eingebettet={eingebettet} onBack={onBack}>
        <Ladekreis text="Profil wird geladen…" />
      </ProfilRahmen>
    );
  }

  const quote =
    profile.totals.parties > 0
      ? `${Math.round((profile.totals.wins / profile.totals.parties) * 100)} %`
      : '–';
  const checkpoint =
    profile.ranking.length > 0
      ? Math.max(...profile.ranking.map((row) => row.highestCheckpoint))
      : 0;

  const kacheln = [
    { icon: '/hub/tab-spielen.webp', name: 'Partien', wert: profile.totals.parties },
    { icon: '/hub/krone.png', name: 'Siege', wert: profile.totals.wins },
    { icon: '/hub/muenze.png', name: 'Siegquote', wert: quote },
    { icon: '/hub/truhe.png', name: 'Checkpoint', wert: checkpoint },
  ];

  return (
    <ProfilRahmen eingebettet={eingebettet} onBack={onBack}>
      <HubSzene bg="/hub/bg-profil.webp" className="front-profil front-profil--a hub-profil-fremd">
        <HubBanner />

        <div className="hub-profilkopf hub-profilkopf--a">
          <img
            className="hub-profilbild hub-profilbild--nur"
            src="/hub/pinguin/pinguin-basis.webp"
            alt=""
            draggable={false}
          />
          <div className="hub-profilkopf-text">
            <strong>{profile.displayName}</strong>
            <span className="muted">Dabei seit {profile.memberSince}</span>
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <StatHero wert={profile.totals.trophies} label="Trophäen" />

        <div className="hub-stat-raster">
          {kacheln.map((k) => (
            <StatKachel key={k.name} icon={k.icon} wert={k.wert} name={k.name} />
          ))}
        </div>

        {profile.ranking.length === 0 ? (
          <p className="muted hub-stat-leer">Noch keine gewertete Partie gespielt.</p>
        ) : (
          profile.ranking.map((row) => (
            <StatSpiel
              key={row.gameId}
              name={t(`game.${row.gameId}`)}
              meta={`Checkpoint ${row.highestCheckpoint} · ${row.parties} gewertet · ${row.wins} Siege`}
              cups={row.trophies}
            />
          ))
        )}

        {/* Die Regel steht im Server (`countsForRanking`): Bots zählen seit dem
            04.08.2026 mit, Gäste und Training nicht. Bis zum 13.10.2026 stand
            hier noch „nur an Tischen ohne Bots". */}
        <p className="hub-statistik-hinweis">
          Trophäen gibt es auch gegen Bots — nur nicht, wenn ein Gast mitspielt oder Training an ist.
        </p>

        <FriendButton
          relationship={profile.relationship}
          busy={busy}
          onRequest={() => act(() => api.requestFriend(profile.id))}
          onAccept={() => act(() => api.acceptFriend(profile.id))}
          onRemove={() => act(() => api.removeFriend(profile.id))}
        />

        {/* Melden und Blockieren (Apple 1.2). Am Tisch fuehrt der Tipp auf
            einen Namen hierher — das ist der Weg „am Tisch". */}
        {profile.relationship !== 'self' && (
          <button type="button" className="melden-knopf" onClick={() => setMeldenOffen(true)}>
            {profile.blockiert ? 'Blockiert · Melden oder aufheben' : 'Melden oder blockieren'}
          </button>
        )}
        {meldenOffen && (
          <MeldenBlatt
            accountId={profile.id}
            name={profile.displayName}
            blockiert={profile.blockiert ?? false}
            onBlockiert={() => load()}
            onClose={() => setMeldenOffen(false)}
          />
        )}
      </HubSzene>
    </ProfilRahmen>
  );
}

/** Eigenständiger Screen: Hub-Shell mit Zurück; eingebettet nur Inhalt. */
function ProfilRahmen({
  eingebettet,
  onBack,
  children,
}: {
  eingebettet: boolean;
  onBack?: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  if (eingebettet) return <>{children}</>;
  return (
    <div className="front front--hub">
      <header className="front-top front-top--zurueck">
        <button className="hub-zurueck" onClick={onBack} type="button">
          ← Zurück
        </button>
      </header>
      <div className="front-body front-body--szene">{children}</div>
    </div>
  );
}

/** Der Knopf sagt immer, was als Naechstes passiert - nie nur einen Zustand. */
function FriendButton({
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
}): React.JSX.Element {
  switch (relationship) {
    case 'self':
      return <p className="muted">Das bist du.</p>;
    case 'none':
      return (
        <button className="hub-knopf hub-knopf--a-gold" onClick={onRequest} disabled={busy}>
          Freund hinzufügen
        </button>
      );
    case 'outgoing':
      return (
        <div className="hub-knopfreihe hub-knopfreihe--a">
          <span className="muted">Anfrage gesendet.</span>
          <button className="hub-knopf hub-knopf--a" onClick={onRemove} disabled={busy}>
            Zurückziehen
          </button>
        </div>
      );
    case 'incoming':
      return (
        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button className="hub-knopf hub-knopf--a-gold" onClick={onAccept} disabled={busy}>
            Anfrage annehmen
          </button>
          <button className="hub-knopf hub-knopf--a-raus" onClick={onRemove} disabled={busy}>
            Ablehnen
          </button>
        </div>
      );
    case 'friends':
      return (
        <div className="hub-knopfreihe hub-knopfreihe--a">
          <span className="muted">✓ Ihr seid Freunde.</span>
          <button className="hub-knopf hub-knopf--a-raus" onClick={onRemove} disabled={busy}>
            Freundschaft beenden
          </button>
        </div>
      );
  }
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
        <h1>{profile?.displayName ?? 'Profil'}</h1>
        {profile && <span>Dabei seit {monatJahr(profile.memberSince)}</span>}
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
                Nochmal versuchen
              </button>
            </div>
          ) : (
            <p className="hb-klein hb-liste-leer">Profil wird geladen…</p>
          )}
        </div>
      </div>
    );
  }

  const ranking = profile.ranking.filter((row) => inAppSichtbar(row.gameId));
  const quote =
    profile.totals.parties > 0
      ? `${Math.round((profile.totals.wins / profile.totals.parties) * 100)} %`
      : '–';
  // „Checkpoint" stand im alten Profil — das neue Hub kennt den Begriff
  // nirgends mehr, das eigene Profil zeigt an der Stelle die Spiele.
  const werte = [
    { name: 'Partien', wert: profile.totals.parties.toLocaleString('de-DE') },
    { name: 'Siege', wert: profile.totals.wins.toLocaleString('de-DE') },
    { name: 'Siegquote', wert: quote },
    { name: 'Spiele', wert: String(ranking.filter((row) => row.parties > 0).length) },
  ];

  const beenden = (): void =>
    frage(
      {
        titel: 'Freundschaft beenden?',
        text: `${profile.displayName} verschwindet aus deiner Freundesliste.`,
        ja: 'Beenden',
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
            Trophäen
            <span className="hb-ab-zusatz">{profile.totals.parties} Partien</span>
          </h2>
          <div className="hb-karte hb-trophaeen">
            <span className="hb-trophaeen-zahl">
              <img src="/hub/symbol-pokal.webp" alt="" />
              {profile.totals.trophies.toLocaleString('de-DE')}
            </span>
            <span className="hb-klein">alle Spiele zusammen</span>
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
              <p className="hb-klein hb-liste-leer">Noch keine gewertete Partie gespielt.</p>
            ) : (
              ranking.map((row) => (
                <div className="hb-mg" key={row.gameId}>
                  <img className="hb-mg-spiel" src={bannerFuer(row.gameId)} alt="" />
                  <span className="hb-mg-name">
                    <strong>{t(`game.${row.gameId}`)}</strong>
                    <small className="is-leise">
                      {row.parties} gewertet · {row.wins} Siege
                    </small>
                  </span>
                  <span className="hb-pk">
                    <img src="/hub/symbol-pokal.webp" alt="" />
                    {row.trophies.toLocaleString('de-DE')}
                  </span>
                </div>
              ))
            )}
          </div>
          {/* Wortgleich mit dem eigenen Profil — dieselbe Regel aus dem
              Server (`countsForRanking`). */}
          <p className="hb-klein hb-ohne-rand">
            Trophäen gibt es auch gegen Bots — nur nicht, wenn ein Gast mitspielt oder Training an ist.
          </p>
        </section>

        {/* Beenden steht leise unten, nicht groß unter der Figur: Es ist der
            eine Knopf auf dieser Seite, den man bereut. */}
        {profile.relationship === 'friends' && (
          <button type="button" className="hb-leise-knopf" onClick={beenden} disabled={busy}>
            Freundschaft beenden
          </button>
        )}
        {/* Melden und Blockieren (Apple 1.2): leise am Schluss, aber immer da. */}
        {profile.relationship !== 'self' && (
          <button type="button" className="hb-leise-knopf" onClick={() => setMeldenOffen(true)}>
            {profile.blockiert ? 'Blockiert · Melden oder aufheben' : 'Melden oder blockieren'}
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
      return <>Das bist du</>;
    case 'friends':
      return <>✓ Ihr seid Freunde</>;
    case 'outgoing':
      return <>Anfrage gesendet</>;
    case 'incoming':
      return <>Möchte dein Freund sein</>;
    case 'none':
      return null;
  }
}

/** Neues Hub: wie `FriendButton` — der Knopf sagt, was als Nächstes passiert. */
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
          Freund hinzufügen
        </button>
      );
    case 'outgoing':
      return (
        <button type="button" className="hb-kn is-zweit is-breit" onClick={onRemove} disabled={busy}>
          Anfrage zurückziehen
        </button>
      );
    case 'incoming':
      return (
        <div className="hb-knopfreihe">
          <button type="button" className="hb-kn is-gold" onClick={onAccept} disabled={busy}>
            Annehmen
          </button>
          <button type="button" className="hb-kn is-zweit" onClick={onRemove} disabled={busy}>
            Ablehnen
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
