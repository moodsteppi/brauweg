import { useEffect, useState } from 'react';

import { api, type FriendLists, type GameSummary, type Me, type PlayerRef } from '../api';
import { DECKS, cardImage, type Deck } from '../decks';
import { cardLabel, cardName, isRed, t } from '../i18n';
import { Profile } from './Profile';

/**
 * Startbildschirm im Stil eines Handyspiels: unten eine Tab-Leiste, in der
 * Mitte prangt "Spielen". Der Hauptschirm zeigt die Trophaeen gross und
 * darunter die Spielwahl; Freunde und das eigene Profil (samt Kartenblatt
 * und Abmelden) sind eigene Tabs. Handy ist der Massstab - im breiten
 * Browser bleibt die Flaeche auf Handybreite begrenzt.
 */

type Tab = 'freunde' | 'spielen' | 'profil';

export function GameSelect({
  me,
  onPick,
  onDeckChange,
  onAvatarChange,
  onShowProfile,
  onSignOut,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  onDeckChange: (cardDeck: string) => void;
  onAvatarChange: () => void;
  onShowProfile: (accountId: string) => void;
  onSignOut: () => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('spielen');
  const trophies = me.stats.reduce((sum, stat) => sum + stat.trophies, 0);

  return (
    <div className="front">
      <header className="front-top">
        {/* Der eigene Name fuehrt zum Profil-Tab - derselbe Inhalt, den auch
            andere ueber die Spielersuche sehen, nichts Eigenes zum Lernen. */}
        <button className="spielername" onClick={() => setTab('profil')}>
          {me.displayName}
        </button>
        <span className="front-trophybadge">
          <PokalIcon />
          {trophies}
        </span>
      </header>

      <div className="front-body" key={tab}>
        {tab === 'spielen' && <Spielen me={me} trophies={trophies} onPick={onPick} />}
        {tab === 'freunde' && <Freunde onShowProfile={onShowProfile} />}
        {tab === 'profil' && (
          <>
            <Profile accountId={me.id} eingebettet />
            <ProfilePicture me={me} onChanged={onAvatarChange} />
            <DeckPicker current={me.cardDeck} onChange={onDeckChange} />
            <button onClick={onSignOut}>Abmelden</button>
          </>
        )}
      </div>

      <nav className="front-tabs" aria-label="Bereiche">
        <TabButton
          label="Freunde"
          active={tab === 'freunde'}
          onClick={() => setTab('freunde')}
          icon={<FreundeIcon />}
        />
        <TabButton
          label="Spielen"
          haupt
          active={tab === 'spielen'}
          onClick={() => setTab('spielen')}
          icon={<KartenIcon />}
        />
        <TabButton
          label="Profil"
          active={tab === 'profil'}
          onClick={() => setTab('profil')}
          icon={<ProfilIcon />}
        />
      </nav>
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  haupt = false,
  onClick,
}: {
  label: string;
  icon: React.JSX.Element;
  active: boolean;
  haupt?: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`front-tab${haupt ? ' front-tab--haupt' : ''}${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Hauptschirm: Trophaeen zuoberst, darunter die Spielwahl.
 *
 * Vorschau-Spiele lassen sich nicht starten, aber man kann fuer sie
 * abstimmen. Die Reihenfolge der naechsten Monate bestimmen damit die
 * Leute, die tatsaechlich spielen.
 */
function Spielen({
  me,
  trophies,
  onPick,
}: {
  me: Me;
  trophies: number;
  onPick: (gameId: string) => void;
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
  const statOf = new Map(me.stats.map((stat) => [stat.gameId, stat]));

  return (
    <>
      <div className="front-hero">
        <PokalIcon />
        <strong className="front-hero-zahl">{trophies}</strong>
        <span className="muted">Trophäen</span>
      </div>

      {playable.map((game) => {
        const stat = statOf.get(game.id);
        return (
          <article className="front-mode" key={game.id}>
            <h2>{t(game.nameKey)}</h2>
            <p className="muted">
              {game.seatCounts.join(', ')} Spieler
              {stat &&
                ` · ${stat.wins} ${stat.wins === 1 ? 'Sieg' : 'Siege'} aus ${stat.parties} gewerteten Partien`}
            </p>
            <button className="front-play" onClick={() => onPick(game.id)}>
              Spielen
            </button>
          </article>
        );
      })}

      <h2>Demnächst</h2>
      <p className="muted">Wofür ihr abstimmt, bauen wir als Nächstes.</p>
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
    </>
  );
}

/**
 * Freunde-Tab.
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

// ---------------------------------------------------------------------------
// Profilbild
// ---------------------------------------------------------------------------

const AVATAR_PX = 128;

/**
 * Verkleinert das gewaehlte Bild im Browser auf ein kleines Quadrat und gibt
 * es als data-URL zurueck. So geht nie ein grosses Foto an den Server, und die
 * Groesse bleibt weit unter dem serverseitigen Riegel.
 */
async function downscale(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('kein Canvas');
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_PX,
    AVATAR_PX,
  );
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.82);
}

function ProfilePicture({
  me,
  onChanged,
}: {
  me: Me;
  onChanged: () => void;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ver, setVer] = useState(0);

  const pick = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      await api.setAvatar(await downscale(file));
      setVer((v) => v + 1);
      onChanged();
    } catch {
      setErr('Das Bild ließ sich nicht speichern. Versuch ein anderes.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      await api.setAvatar(null);
      setVer((v) => v + 1);
      onChanged();
    } catch {
      setErr('Konnte nicht entfernt werden.');
    } finally {
      setBusy(false);
    }
  };

  const src = me.avatarUrl ? `${me.avatarUrl}?v=${ver}` : null;

  return (
    <div className="panel profile">
      <div className="profile-pic">
        {src ? (
          <img src={src} alt="Profilbild" />
        ) : (
          <span>{me.displayName.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="profile-actions">
        <strong>Profilbild</strong>
        <span className="muted">Sehen die anderen am Tisch.</span>
        <div className="row" style={{ gap: '0.5rem', marginTop: '0.25rem' }}>
          <label className={`profile-btn${busy ? ' is-busy' : ''}`}>
            {busy ? 'Einen Moment…' : me.avatarUrl ? 'Ändern' : 'Bild wählen'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={busy}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </label>
          {me.avatarUrl && (
            <button onClick={() => void remove()} disabled={busy}>
              Entfernen
            </button>
          )}
        </div>
        {err && <span className="error">{err}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sinnbilder der Tab-Leiste: von Hand gezeichnete Striche in Textfarbe,
// keine Emojis - die saehen auf jedem Geraet anders aus.
// ---------------------------------------------------------------------------

function PokalIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h10v5.5a5 5 0 0 1-10 0V3z" />
      <path d="M7 5H4a3 3 0 0 0 3 4.5" />
      <path d="M17 5h3a3 3 0 0 1-3 4.5" />
      <path d="M12 13.5V17" />
      <path d="M8.5 20c.5-2 1.8-3 3.5-3s3 1 3.5 3" />
      <path d="M7 21h10" />
    </svg>
  );
}

function KartenIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="9" height="13" rx="1.5" transform="rotate(-8 8 11.5)" />
      <rect x="11.5" y="5.5" width="9" height="13" rx="1.5" transform="rotate(8 16 12)" />
    </svg>
  );
}

function FreundeIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c.6-3.3 2.7-5 5.5-5s4.9 1.7 5.5 5" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M15.8 15.3c.4-.2 1-.3 1.7-.3 2.3 0 3.7 1.4 4.3 4.2" />
    </svg>
  );
}

function ProfilIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20.5c.8-4 3.3-6 7-6s6.2 2 7 6" />
    </svg>
  );
}
