import { useEffect, useState } from 'react';

import { Ladekreis } from '../Ladekreis';

import { ApiError, api, type PlayerProfile, type Relationship } from '../api';
import { HubBanner, HubSzene, StatHero, StatKachel, StatSpiel } from '../hub';
import { t } from '../i18n';

/**
 * Spielerprofil (Entwurf A — knallig, Pokal-Hero).
 *
 * Zwei getrennte Zahlenwelten, bewusst nebeneinander: Die Wertung zaehlt nur
 * Tische ohne Bots (sonst waere die Rangliste eine Bot-Farm), "gespielt"
 * zaehlt alles. Wer fuenfmal gegen Bots geuebt hat, soll kein leeres Profil
 * sehen - aber auch keine Trophaeen dafuer bekommen.
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

        {/* „zählen alles" war eine Verkürzung, die niemand so sagt — und sie
            liess offen, was denn alles. Gemeint ist der Gegensatz zur Zeile
            davor: Trophäen sind an Tische ohne Bots gebunden, die Zählung von
            Partien und Siegen ist es nicht. */}
        <p className="hub-statistik-hinweis">
          Trophäen gibt es nur an Tischen ohne Bots. Partien und Siege werden
          überall gezählt, auch gegen Bots.
        </p>

        <FriendButton
          relationship={profile.relationship}
          busy={busy}
          onRequest={() => act(() => api.requestFriend(profile.id))}
          onAccept={() => act(() => api.acceptFriend(profile.id))}
          onRemove={() => act(() => api.removeFriend(profile.id))}
        />
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
