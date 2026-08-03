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

  const deck = deckById(me.cardDeck);
  const zeigeProfil = (accountId: string): void =>
    setScreen({ name: 'profil', accountId, vorher: screen });

  if (screen.name === 'profil') {
    return <Profile accountId={screen.accountId} onBack={() => setScreen(screen.vorher)} />;
  }

  if (screen.name === 'table') {
    return (
      <Table
        tableId={screen.tableId}
        deck={deck}
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
      onDeckChange={(cardDeck) => {
        setMe({ ...me, cardDeck });
        void api.setCardDeck(cardDeck).catch(() => void reload());
      }}
      onAvatarChange={() => void reload()}
      onSignOut={async () => {
        await api.logout();
        setMe(null);
      }}
    />
  );
}
