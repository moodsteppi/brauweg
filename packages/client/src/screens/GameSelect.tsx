import { useEffect, useState } from 'react';

import { api, type FriendLists, type GameSummary, type Me, type PlayerRef } from '../api';
import { DECKS, cardImage, type Deck } from '../decks';
import { cardLabel, cardName, isRed, t } from '../i18n';

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
  onDeckChange,
  onShowProfile,
  onSignOut,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  onDeckChange: (cardDeck: string) => void;
  onShowProfile: (accountId: string) => void;
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
  const statOf = new Map(me.stats.map((stat) => [stat.gameId, stat]));

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Brauweg</h1>
        <button onClick={onSignOut}>Abmelden</button>
      </div>
      <p className="muted">
        {/* Der eigene Name fuehrt zum eigenen Profil - derselbe Weg wie bei
            jedem anderen Spieler, nichts Eigenes zum Lernen. */}
        <button className="spielername" onClick={() => onShowProfile(me.id)}>
          {me.displayName}
        </button>
        {' · '}
        {trophies} Trophäen gesamt
      </p>

      <h2>Spielbar</h2>
      {playable.map((game) => {
        const stat = statOf.get(game.id);
        return (
          <div className="panel" key={game.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{t(game.nameKey)}</strong>
                <div className="muted">
                  {game.seatCounts.join(', ')} Spieler
                  {stat &&
                    ` · ${stat.trophies} Trophäen · ${stat.wins} ${stat.wins === 1 ? 'Sieg' : 'Siege'} aus ${stat.parties} gewerteten Partien`}
                </div>
              </div>
              <button className="primary" onClick={() => onPick(game.id)}>
                Tische ansehen
              </button>
            </div>
          </div>
        );
      })}

      <Freunde onShowProfile={onShowProfile} />

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

      <DeckPicker current={me.cardDeck} onChange={onDeckChange} />
    </main>
  );
}

/**
 * Freunde auf der Startseite.
 *
 * Anfragen stehen zuoberst, weil sie eine Antwort verlangen. Die Suche
 * arbeitet erst ab zwei Zeichen und auf Knopfdruck - niemand soll beim
 * Tippen live durchsucht werden.
 */
function Freunde({
  onShowProfile,
}: {
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerRef[] | null>(null);

  const reload = (): void => {
    void api.friends().then(setLists);
  };
  useEffect(reload, []);

  const search = (event: React.FormEvent): void => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    void api.searchPlayers(query).then(setResults);
  };

  return (
    <>
      <h2>Freunde</h2>

      {lists && lists.incoming.length > 0 && (
        <div className="panel">
          <h3>Anfragen an dich</h3>
          {lists.incoming.map((player) => (
            <div className="seat" key={player.id}>
              <button className="spielername" onClick={() => onShowProfile(player.id)}>
                {player.displayName}
              </button>
              <span className="row" style={{ gap: '0.4rem' }}>
                <button
                  className="primary"
                  onClick={() => void api.acceptFriend(player.id).then(reload)}
                >
                  Annehmen
                </button>
                <button onClick={() => void api.removeFriend(player.id).then(reload)}>
                  Ablehnen
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        {lists === null && <p className="muted">Wird geladen…</p>}
        {lists !== null && lists.friends.length === 0 && (
          <p className="muted">
            Noch keine Freunde. Such unten nach dem Namen, den dir jemand genannt hat.
          </p>
        )}
        {lists !== null &&
          lists.friends.map((player) => (
            <div className="seat" key={player.id}>
              <button className="spielername" onClick={() => onShowProfile(player.id)}>
                {player.displayName}
              </button>
            </div>
          ))}
        {lists !== null && lists.outgoing.length > 0 && (
          <p className="muted">
            Angefragt: {lists.outgoing.map((player) => player.displayName).join(', ')}
          </p>
        )}

        <form className="row" onSubmit={search} style={{ marginTop: '0.75rem' }}>
          <input
            placeholder="Spieler suchen…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ flex: 1 }}
            aria-label="Spieler suchen"
          />
          <button type="submit" disabled={query.trim().length < 2}>
            Suchen
          </button>
        </form>

        {results !== null && results.length === 0 && (
          <p className="muted">Niemand mit diesem Namen gefunden.</p>
        )}
        {results !== null &&
          results.map((player) => (
            <div className="seat" key={player.id}>
              <button className="spielername" onClick={() => onShowProfile(player.id)}>
                {player.displayName}
              </button>
              <button
                onClick={() =>
                  void api
                    .requestFriend(player.id)
                    .then(() => {
                      setResults(results.filter((entry) => entry.id !== player.id));
                      reload();
                    })
                    .catch(() => undefined)
                }
              >
                Anfragen
              </button>
            </div>
          ))}
      </div>
    </>
  );
}

/** Die drei Karten, an denen sich die Blätter am deutlichsten unterscheiden. */
const SAMPLE = [
  { id: 1, suit: 'C', rank: 'Q' },
  { id: 2, suit: 'H', rank: 'T' },
  { id: 3, suit: 'D', rank: 'A' },
];

/**
 * Kartenblatt waehlen.
 *
 * Mit Vorschau statt nur mit Namen: Welches Blatt einem liegt, entscheidet
 * niemand nach einer Beschreibung, sondern nach dem Hinsehen.
 */
function DeckPicker({
  current,
  onChange,
}: {
  current: string;
  onChange: (cardDeck: string) => void;
}): React.JSX.Element {
  return (
    <>
      <h2>Kartenblatt</h2>
      <p className="muted">Gilt für dein Konto, also auch auf jedem anderen Gerät.</p>
      <div className="decks">
        {DECKS.map((deck) => (
          <button
            className={`deck${deck.id === current ? ' selected' : ''}`}
            key={deck.id}
            aria-pressed={deck.id === current}
            onClick={() => onChange(deck.id)}
          >
            <div className="deck-preview">
              {SAMPLE.map((card) => (
                <DeckSample card={card} deck={deck} key={card.id} />
              ))}
            </div>
            <strong>{t(deck.nameKey)}</strong>
            <span className="muted">{t(deck.hintKey)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function DeckSample({
  card,
  deck,
}: {
  card: { suit: string; rank: string };
  deck: Deck;
}): React.JSX.Element {
  const src = cardImage(deck, card);
  if (src) return <img className="card-img" src={src} alt={cardName(card)} draggable={false} />;
  return (
    <span className={`card${isRed(card) ? ' red' : ''}`}>{cardLabel(card)}</span>
  );
}
