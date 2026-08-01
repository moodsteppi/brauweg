import { useEffect, useState } from 'react';

import { api, type GameSummary, type Me } from '../api';
import { t } from '../i18n';

/**
 * Erste Ebene ist die Spielauswahl, danach erst die Tischliste.
 *
 * Vorschau-Spiele lassen sich nicht starten, aber man kann fuer sie abstimmen.
 * Die Reihenfolge der naechsten Monate bestimmen damit die Leute, die
 * tatsaechlich spielen.
 */
export function GameSelect({
  me,
  onPick,
  onSignOut,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  onSignOut: () => void;
}): React.JSX.Element {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    void api.games().then(setGames);
  }, []);

  const vote = async (gameId: string): Promise<void> => {
    await api.vote(gameId).catch(() => undefined);
    setVoted(new Set([...voted, gameId]));
    setGames(await api.games());
  };

  const playable = games.filter((game) => game.availability === 'playable');
  const preview = games.filter((game) => game.availability === 'preview');
  const trophies = me.stats.reduce((sum, stat) => sum + stat.trophies, 0);

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Brauweg</h1>
        <button onClick={onSignOut}>Abmelden</button>
      </div>
      <p className="muted">
        {me.displayName} · {trophies} Trophäen gesamt
      </p>

      <h2>Spielbar</h2>
      {playable.map((game) => (
        <div className="panel" key={game.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{t(game.nameKey)}</strong>
              <div className="muted">{game.seatCounts.join(', ')} Spieler</div>
            </div>
            <button className="primary" onClick={() => onPick(game.id)}>
              Tische ansehen
            </button>
          </div>
        </div>
      ))}

      <h2>Demnächst</h2>
      <p className="muted">
        Wofür ihr abstimmt, bauen wir als Nächstes.
      </p>
      {preview.map((game) => (
        <div className="panel" key={game.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{t(game.nameKey)}</strong>
              <div className="muted">{game.votes} Stimmen</div>
            </div>
            <button onClick={() => void vote(game.id)} disabled={voted.has(game.id)}>
              {voted.has(game.id) ? 'Abgestimmt' : 'Dafür stimmen'}
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
