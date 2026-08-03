import { useEffect, useState } from 'react';

import { api, type Me } from './api';
import { deckById } from './decks';
import { Auth } from './screens/Auth';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';
import { Profile } from './screens/Profile';
import { Table } from './screens/Table';

type Screen =
  | { name: 'games' }
  | { name: 'lobby'; gameId: string }
  | { name: 'table'; gameId: string; tableId: string }
  /**
   * `vorher` merkt sich den Absprungpunkt: Wer vom Spieltisch aus ein Profil
   * oeffnet, muss an den Tisch zurueck - nicht auf die Startseite. Die
   * WebSocket-Verbindung des Tisches wird dabei getrennt und beim Zurueck neu
   * aufgebaut; der Server schickt ohnehin immer die volle Sicht.
   */
  | { name: 'profil'; accountId: string; vorher: Screen };

export function App(): React.JSX.Element {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'games' });

  const reload = async (): Promise<void> => {
    setMe(await api.me().catch(() => null));
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  if (loading) {
    return (
      <main>
        <p className="muted">Einen Moment…</p>
      </main>
    );
  }

  if (!me) return <Auth onSignedIn={() => void reload()} />;

  /**
   * Aussehen eines Spiels. Der Server liefert alle bekannten Spiele mit;
   * die Rueckfallwerte greifen nur, falls ein Spiel dazukommt, das dieser
   * Client noch nicht kennt.
   */
  const themeFuer = (gameId: string): { cardDeck: string; tableScene: string } =>
    me.themes[gameId] ?? { cardDeck: 'text', tableScene: 'stube' };

  const zeigeProfil = (accountId: string): void =>
    setScreen({ name: 'profil', accountId, vorher: screen });

  if (screen.name === 'profil') {
    return <Profile accountId={screen.accountId} onBack={() => setScreen(screen.vorher)} />;
  }

  if (screen.name === 'table') {
    return (
      <Table
        tableId={screen.tableId}
        deck={deckById(themeFuer(screen.gameId).cardDeck)}
        szene={themeFuer(screen.gameId).tableScene}
        onShowProfile={zeigeProfil}
        // Zurueck zum Start: me neu laden, damit „Weiterspielen" den
        // echten Stand zeigt (Wartetisch weg / Partie noch offen).
        onLeave={() => {
          setScreen({ name: 'games' });
          void reload();
        }}
      />
    );
  }

  if (screen.name === 'lobby') {
    return (
      <Lobby
        gameId={screen.gameId}
        onBack={() => {
          setScreen({ name: 'games' });
          void reload();
        }}
        onEnter={(tableId) => setScreen({ name: 'table', gameId: screen.gameId, tableId })}
      />
    );
  }

  return (
    <GameSelect
      me={me}
      onPick={(gameId) => setScreen({ name: 'lobby', gameId })}
      onResume={(gameId, tableId) => setScreen({ name: 'table', gameId, tableId })}
      onShowProfile={zeigeProfil}
      // Erst umschalten, dann speichern: Das Blatt wechselt ohne Wartezeit,
      // und schlaegt das Speichern fehl, holt reload() den echten Stand zurueck.
      onThemeChange={(gameId, teil) => {
        setMe({ ...me, themes: { ...me.themes, [gameId]: { ...themeFuer(gameId), ...teil } } });
        void api.setTheme(gameId, teil).catch(() => void reload());
      }}
      onAvatarChange={() => void reload()}
      onSignOut={async () => {
        await api.logout();
        setMe(null);
      }}
      // Kein api.logout(): Die Loeschung hat die Sitzung schon widerrufen und
      // das Cookie geraeumt - ein Abmelden danach liefe in ein 401.
      onDeleted={() => setMe(null)}
    />
  );
}
