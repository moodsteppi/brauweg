import { useEffect, useState } from 'react';

import { api, type Me } from './api';
import { Auth } from './screens/Auth';
import { GameSelect } from './screens/GameSelect';
import { Lobby } from './screens/Lobby';
import { Table } from './screens/Table';

type Screen =
  | { name: 'games' }
  | { name: 'lobby'; gameId: string }
  | { name: 'table'; gameId: string; tableId: string };

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

  if (screen.name === 'table') {
    return (
      <Table
        tableId={screen.tableId}
        onLeave={() => setScreen({ name: 'lobby', gameId: screen.gameId })}
      />
    );
  }

  if (screen.name === 'lobby') {
    return (
      <Lobby
        gameId={screen.gameId}
        onBack={() => setScreen({ name: 'games' })}
        onEnter={(tableId) => setScreen({ name: 'table', gameId: screen.gameId, tableId })}
      />
    );
  }

  return (
    <GameSelect
      me={me}
      onPick={(gameId) => setScreen({ name: 'lobby', gameId })}
      onSignOut={async () => {
        await api.logout();
        setMe(null);
      }}
    />
  );
}
