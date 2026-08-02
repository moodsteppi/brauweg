import { useEffect, useState } from 'react';

import { ApiError, api, type PlayerProfile, type Relationship } from '../api';
import { t } from '../i18n';

/**
 * Spielerprofil.
 *
 * Zwei getrennte Zahlenwelten, bewusst nebeneinander: Die Wertung zaehlt nur
 * Tische ohne Bots (sonst waere die Rangliste eine Bot-Farm), "gespielt"
 * zaehlt alles. Wer fuenfmal gegen Bots geuebt hat, soll kein leeres Profil
 * sehen - aber auch keine Trophaeen dafuer bekommen.
 */
export function Profile({
  accountId,
  onBack,
}: {
  accountId: string;
  onBack: () => void;
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
      <main>
        <p className="error">{error}</p>
        <button onClick={onBack}>Zurück</button>
      </main>
    );
  }

  if (!profile) {
    return (
      <main>
        <p className="muted">Profil wird geladen…</p>
        <button onClick={onBack}>Zurück</button>
      </main>
    );
  }

  const quote =
    profile.totals.parties > 0
      ? Math.round((profile.totals.wins / profile.totals.parties) * 100)
      : null;

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{profile.displayName}</h1>
        <button onClick={onBack}>Zurück</button>
      </div>
      <p className="muted">Dabei seit {profile.memberSince}</p>

      <FriendButton
        relationship={profile.relationship}
        busy={busy}
        onRequest={() => act(() => api.requestFriend(profile.id))}
        onAccept={() => act(() => api.acceptFriend(profile.id))}
        onRemove={() => act(() => api.removeFriend(profile.id))}
      />

      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h2>Gesamt</h2>
        <div className="zahlen">
          <Zahl wert={profile.totals.trophies} name="Trophäen" />
          <Zahl wert={profile.totals.parties} name="Partien" />
          <Zahl wert={profile.totals.wins} name="Siege" />
          <Zahl wert={quote === null ? '–' : `${quote} %`} name="Siegquote" />
        </div>
        <p className="muted">
          Trophäen gibt es nur an Tischen ohne Bots. Partien und Siege zählen alles.
        </p>
      </div>

      <div className="panel">
        <h2>Je Spiel</h2>
        {profile.ranking.length === 0 && (
          <p className="muted">Noch keine gewertete Partie gespielt.</p>
        )}
        {profile.ranking.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Spiel</th>
                <th>Trophäen</th>
                <th>Checkpoint</th>
                <th>Gewertet</th>
                <th>Siege</th>
              </tr>
            </thead>
            <tbody>
              {profile.ranking.map((row) => (
                <tr key={row.gameId}>
                  <td>{t(`game.${row.gameId}`)}</td>
                  <td>{row.trophies}</td>
                  <td>{row.highestCheckpoint}</td>
                  <td>{row.parties}</td>
                  <td>{row.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

function Zahl({ wert, name }: { wert: number | string; name: string }): React.JSX.Element {
  return (
    <div className="zahl">
      <strong>{wert}</strong>
      <span className="muted">{name}</span>
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
}): React.JSX.Element | null {
  switch (relationship) {
    case 'self':
      return <p className="muted">Das bist du.</p>;
    case 'none':
      return (
        <div className="row">
          <button className="primary" onClick={onRequest} disabled={busy}>
            Freund hinzufügen
          </button>
        </div>
      );
    case 'outgoing':
      return (
        <div className="row">
          <span className="muted">Anfrage gesendet.</span>
          <button onClick={onRemove} disabled={busy}>
            Zurückziehen
          </button>
        </div>
      );
    case 'incoming':
      return (
        <div className="row">
          <button className="primary" onClick={onAccept} disabled={busy}>
            Anfrage annehmen
          </button>
          <button onClick={onRemove} disabled={busy}>
            Ablehnen
          </button>
        </div>
      );
    case 'friends':
      return (
        <div className="row">
          <span>✓ Ihr seid Freunde.</span>
          <button onClick={onRemove} disabled={busy}>
            Freundschaft beenden
          </button>
        </div>
      );
  }
}
