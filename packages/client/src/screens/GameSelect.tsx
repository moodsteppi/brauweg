import { useEffect, useState } from 'react';

import {
  ApiError,
  api,
  type FriendLists,
  type GameSummary,
  type Me,
  type PlayerRef,
  type RankingEntry,
} from '../api';
import { DECKS, cardImage, type Deck } from '../decks';
import { cardLabel, cardName, isRed, t } from '../i18n';
import { Trophaeenpfad } from './Pfad';
import { Profile } from './Profile';

/**
 * Startbildschirm im Stil eines Handyspiels: unten die Tab-Leiste mit
 * "Spielen" in der Mitte, oben die Ressourcen-Leiste mit Level, Muenzen und
 * VIP. Was es noch nicht gibt - Shop, Muenzen kaufen, Tagesbonus, Level -,
 * steht trotzdem schon da, mit ehrlichen Nullen und einem "Kommt bald" beim
 * Antippen: Die Oberflaeche zeigt, wohin die Reise geht. Handy ist der
 * Massstab - im breiten Browser bleibt die Flaeche auf Handybreite begrenzt.
 */

type Tab = 'shop' | 'clan' | 'spielen' | 'blatt' | 'profil';

export function GameSelect({
  me,
  onPick,
  onResume,
  onDeckChange,
  onAvatarChange,
  onShowProfile,
  onSignOut,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  onResume: (gameId: string, tableId: string) => void;
  onDeckChange: (cardDeck: string) => void;
  onAvatarChange: () => void;
  onShowProfile: (accountId: string) => void;
  onSignOut: () => void;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('spielen');
  /** Name des angetippten Noch-nicht-Bereichs, fuer das "Kommt bald"-Blatt. */
  const [bald, setBald] = useState<string | null>(null);
  const [ranglisteOffen, setRanglisteOffen] = useState(false);
  const trophies = me.stats.reduce((sum, stat) => sum + stat.trophies, 0);

  return (
    <div className="front">
      <header className="front-top">
        {/* Level und Name fuehren zum Profil-Tab. Das Level ist ehrlich Null -
            das System dahinter kommt noch, der Platz dafuer steht schon. */}
        <button className="front-spieler" onClick={() => setTab('profil')}>
          <span className="front-level" aria-label="Level 0">
            0
          </span>
          <span className="front-spieler-info">
            <strong>{me.displayName}</strong>
            <span className="front-xp" aria-hidden="true">
              <span style={{ width: '0%' }} />
            </span>
          </span>
        </button>
        <div className="front-waehrungen">
          <button
            className="front-waehrung front-waehrung--muenzen"
            onClick={() => setBald('Münzen kaufen')}
          >
            <MuenzeIcon />
            {me.coins}
            <span className="front-plus" aria-hidden="true">
              +
            </span>
          </button>
          <button
            className="front-waehrung front-waehrung--vip"
            onClick={() => setBald('VIP')}
          >
            <KroneIcon />0
            <span className="front-plus" aria-hidden="true">
              +
            </span>
          </button>
        </div>
      </header>

      <div className="front-body" key={tab}>
        {tab === 'shop' && <Shop onBald={setBald} />}
        {tab === 'clan' && (
          <Clan
            clan={me.clubs[0] ?? null}
            onBald={setBald}
            onShowProfile={onShowProfile}
          />
        )}
        {tab === 'spielen' && (
          <Spielen
            trophies={trophies}
            activeTable={me.activeTable}
            onPick={onPick}
            onResume={onResume}
            onBald={setBald}
            onRangliste={() => setRanglisteOffen(true)}
          />
        )}
        {tab === 'blatt' && <DeckPicker current={me.cardDeck} onChange={onDeckChange} />}
        {tab === 'profil' && (
          <>
            <Profile accountId={me.id} eingebettet />
            <ProfilePicture me={me} onChanged={onAvatarChange} />
            <button onClick={onSignOut}>Abmelden</button>
          </>
        )}
      </div>

      <nav className="front-tabs" aria-label="Bereiche">
        <TabButton
          label="Shop"
          farbe="shop"
          active={tab === 'shop'}
          onClick={() => setTab('shop')}
          icon={<ShopIcon />}
        />
        <TabButton
          label="Clan"
          farbe="clan"
          active={tab === 'clan'}
          onClick={() => setTab('clan')}
          icon={<ClanIcon />}
        />
        <TabButton
          label="Spielen"
          haupt
          farbe="spielen"
          active={tab === 'spielen'}
          onClick={() => setTab('spielen')}
          icon={<KartenIcon />}
        />
        <TabButton
          label="Blatt"
          farbe="blatt"
          active={tab === 'blatt'}
          onClick={() => setTab('blatt')}
          icon={<BlattIcon />}
        />
        <TabButton
          label="Profil"
          farbe="profil"
          active={tab === 'profil'}
          onClick={() => setTab('profil')}
          icon={<ProfilIcon />}
        />
      </nav>

      {bald && <BaldBlatt name={bald} onClose={() => setBald(null)} />}
      {ranglisteOffen && (
        <RanglisteBlatt meId={me.id} onClose={() => setRanglisteOffen(false)} onShowProfile={onShowProfile} />
      )}
    </div>
  );
}

/**
 * "Kommt bald"-Blatt fuer alles, das schon in der Oberflaeche steht, aber
 * noch nicht gebaut ist. Ehrlich statt totem Knopf: Man sieht, dass hier
 * etwas entsteht.
 */
function BaldBlatt({
  name,
  onClose,
}: {
  name: string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card front-bald" onClick={(event) => event.stopPropagation()}>
        <span className="front-bald-zeichen" aria-hidden="true">
          🔨
        </span>
        <h2>Kommt bald!</h2>
        <p className="muted">Daran bauen wir gerade: {name}. Schau bald wieder vorbei.</p>
        <button className="primary" onClick={onClose}>
          Alles klar
        </button>
      </div>
    </div>
  );
}

/**
 * Clan — spielübergreifend, nicht nur Doppelkopf.
 *
 * Wie in Clash Royale: Chat, Krieg, Rangliste und Truhe stehen schon als
 * Kacheln da (mit Bald); Freunde bleiben darunter erreichbar. Der Beta-Clan
 * entsteht automatisch mit dem Einladungscode.
 */
function Clan({
  clan,
  onBald,
  onShowProfile,
}: {
  clan: { id: string; name: string } | null;
  onBald: (name: string) => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const kacheln = [
    { name: 'Clanchat', zeichen: '💬', text: 'Nachrichten an alle' },
    { name: 'Clankrieg', zeichen: '⚔️', text: 'Clan gegen Clan' },
    { name: 'Clan-Rangliste', zeichen: '🏆', text: 'Trophäen im Clan' },
    { name: 'Clantruhe', zeichen: '🎁', text: 'Gemeinsame Belohnung' },
    { name: 'Mitglieder', zeichen: '👥', text: 'Wer ist dabei' },
    { name: 'Clantische', zeichen: '🃏', text: 'Lange Partien pausierbar' },
  ];

  return (
    <>
      <header className="front-clan-kopf">
        <span className="front-clan-wappen" aria-hidden="true">
          🛡️
        </span>
        <div>
          <strong>{clan?.name ?? 'Brauweg'}</strong>
          <p className="muted">
            Dein Clan — für alle Spiele, nicht nur Doppelkopf.
          </p>
        </div>
      </header>

      <div className="front-clan-kacheln">
        {kacheln.map((kachel) => (
          <button
            key={kachel.name}
            className="front-clan-kachel"
            onClick={() => onBald(kachel.name)}
          >
            <span className="front-clan-zeichen" aria-hidden="true">
              {kachel.zeichen}
            </span>
            <span className="front-clan-kachel-text">
              <strong>{kachel.name}</strong>
              <span className="muted">{kachel.text}</span>
            </span>
            <span className="front-bald-tag">Bald</span>
          </button>
        ))}
      </div>

      <Freunde onShowProfile={onShowProfile} />
    </>
  );
}

/** Shop-Vorschau: Die Regale stehen schon, die Ware kommt noch. */
function Shop({ onBald }: { onBald: (name: string) => void }): React.JSX.Element {
  const regale = [
    { name: 'Kartenblätter', zeichen: '🃏' },
    { name: 'Tischdesigns', zeichen: '🎨' },
    { name: 'Münzpakete', zeichen: '🪙' },
    { name: 'VIP-Pass', zeichen: '👑' },
  ];
  return (
    <>
      <h2>Shop</h2>
      <p className="muted">Blätter, Tischdesigns und mehr — der Shop öffnet bald.</p>
      <div className="front-shop">
        {regale.map((regal) => (
          <button
            key={regal.name}
            className="front-shop-kachel"
            onClick={() => onBald(regal.name)}
          >
            <span className="front-shop-zeichen" aria-hidden="true">
              {regal.zeichen}
            </span>
            <strong>{regal.name}</strong>
            <span className="front-bald-tag">Bald</span>
          </button>
        ))}
      </div>
    </>
  );
}

function TabButton({
  label,
  icon,
  active,
  haupt = false,
  farbe,
  onClick,
}: {
  label: string;
  icon: React.JSX.Element;
  active: boolean;
  haupt?: boolean;
  /** Jeder Bereich hat seine eigene Leuchtfarbe, wenn er gewaehlt ist. */
  farbe: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      className={`front-tab front-tab--${farbe}${haupt ? ' front-tab--haupt' : ''}${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Hauptschirm: der Trophaeenpfad.
 *
 * Die Trophaeen sind eine Reise von Insel zu Insel - jede ein Checkpoint,
 * jede eine eigene Welt. Der Spielauswahl-Knopf klebt am unteren Rand und
 * oeffnet das Vollbild mit allen Spielen samt Bildern; abgestimmt wird
 * dort, nicht mehr auf dem Startschirm.
 */
function Spielen({
  trophies,
  activeTable,
  onPick,
  onResume,
  onBald,
  onRangliste,
}: {
  trophies: number;
  activeTable: Me['activeTable'];
  onPick: (gameId: string) => void;
  onResume: (gameId: string, tableId: string) => void;
  onBald: (name: string) => void;
  onRangliste: () => void;
}): React.JSX.Element {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [wahlOffen, setWahlOffen] = useState(false);

  useEffect(() => {
    void api.games().then(setGames);
  }, []);

  const vote = async (gameId: string): Promise<void> => {
    await api.vote(gameId).catch(() => undefined);
    setVoted(new Set([...voted, gameId]));
    setGames(await api.games());
  };

  return (
    <>
      <Trophaeenpfad trophies={trophies} />

      <button className="front-rangliste" onClick={onRangliste}>
        Rangliste
      </button>

      {/* Der Tagesbonus steht schon da, wo er hingehoert - am Fuss des
          Pfads. Dahinter steckt noch nichts. */}
      <button className="front-bonus" onClick={() => onBald('Der Tagesbonus')}>
        <GeschenkIcon />
        Gratis-Münzen — Tagesbonus
        <span className="front-bald-tag">Bald</span>
      </button>

      {/* Klebt am unteren Rand. Läuft noch eine Partie, ist Weiterspielen
          der Hauptknopf — Spielauswahl bleibt darunter erreichbar. */}
      <div className={`front-play-stack${activeTable ? ' has-resume' : ''}`}>
        {activeTable && (
          <button
            className="front-play"
            onClick={() => onResume(activeTable.gameId, activeTable.tableId)}
          >
            {activeTable.paused
              ? 'Weiterspielen — pausiert'
              : activeTable.status === 'waiting'
                ? 'Zurück zum Tisch'
                : 'Weiterspielen'}
          </button>
        )}
        <button
          className={activeTable ? 'front-play-neben' : 'front-play'}
          onClick={() => setWahlOffen(true)}
        >
          Spielauswahl
        </button>
      </div>

      {wahlOffen && (
        <Spielwahl
          games={games}
          voted={voted}
          onVote={(gameId) => void vote(gameId)}
          onPick={(gameId) => {
            setWahlOffen(false);
            onPick(gameId);
          }}
          onBald={onBald}
          onClose={() => setWahlOffen(false)}
        />
      )}
    </>
  );
}

function RanglisteBlatt({
  meId,
  onClose,
  onShowProfile,
}: {
  meId: string;
  onClose: () => void;
  onShowProfile: (accountId: string) => void;
}): React.JSX.Element {
  const [rows, setRows] = useState<RankingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .ranking('doppelkopf')
      .then(setRows)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? t(err.messageKey) : 'Verbindung fehlgeschlagen.');
      });
  }, []);

  return (
    <div className="doko-sheet" onClick={onClose} role="presentation">
      <div
        className="doko-sheet-card front-ranking"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Rangliste Doppelkopf"
      >
        <header className="front-ranking-head">
          <strong>Rangliste · Doppelkopf</strong>
          <button className="doko-icon" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {!error && rows.length === 0 && <p className="muted">Noch niemand auf der Liste.</p>}
        <ol className="front-ranking-list">
          {rows.map((row) => (
            <li key={row.accountId} className={row.accountId === meId ? 'is-du' : undefined}>
              <span className="front-ranking-rang">{row.rank}</span>
              <button
                className="front-ranking-name"
                onClick={() => {
                  onClose();
                  onShowProfile(row.accountId);
                }}
              >
                {row.displayName}
                {row.accountId === meId ? ' · du' : ''}
              </button>
              <span className="front-ranking-cups">{row.trophies} 🏆</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Spielauswahl im Vollbild: ein Bild je Spiel.
 *
 * Doppelkopf ist offen und fuehrt ins Tisch-Menue; die anderen tragen die
 * Bald-Marke, lassen sich anstimmen, und ein Tipp aufs Bild oeffnet das
 * "Kommt bald"-Blatt. Die Bilder sind gemalte SVGs - nichts laedt nach.
 */
function Spielwahl({
  games,
  voted,
  onVote,
  onPick,
  onBald,
  onClose,
}: {
  games: GameSummary[];
  voted: Set<string>;
  onVote: (gameId: string) => void;
  onPick: (gameId: string) => void;
  onBald: (name: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const playable = games.filter((game) => game.availability === 'playable');
  const preview = games.filter((game) => game.availability === 'preview');

  return (
    <div className="spielwahl">
      <header className="spielwahl-kopf">
        <h2>Spielauswahl</h2>
        <button className="spielwahl-zu" onClick={onClose} aria-label="Schließen">
          ×
        </button>
      </header>
      <div className="spielwahl-rolle">
        {playable.map((game) => (
          <button
            key={game.id}
            className="spielwahl-karte is-offen"
            onClick={() => onPick(game.id)}
          >
            <SpielBild id={game.id} />
            <span className="spielwahl-titel">
              <strong>{t(game.nameKey)}</strong>
              <span>{game.seatCounts.join(', ')} Spieler</span>
            </span>
            <span className="spielwahl-spielen">Spielen</span>
          </button>
        ))}
        {preview.map((game) => (
          <div key={game.id} className="spielwahl-karte is-zu">
            <button className="spielwahl-flaeche" onClick={() => onBald(t(game.nameKey))}>
              <SpielBild id={game.id} />
              <span className="spielwahl-titel">
                <strong>{t(game.nameKey)}</strong>
                <span className="front-bald-tag">Bald</span>
              </span>
            </button>
            <button
              className="spielwahl-stimme"
              disabled={voted.has(game.id)}
              onClick={() => onVote(game.id)}
            >
              {voted.has(game.id) ? 'Abgestimmt' : 'Dafür stimmen'} · {game.votes}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gemalte Bilder der Spiele: je ein kleines Stillleben mit den Karten, an
 * denen man das Spiel erkennt. Ein unbekanntes Spiel bekommt Ruecken -
 * sichtbar generisch statt unsichtbar kaputt.
 */
function SpielBild({ id }: { id: string }): React.JSX.Element {
  const karte = (
    x: number,
    rot: number,
    text: string,
    rotFarbe: boolean,
    breit = 30,
  ): React.JSX.Element => (
    <g key={`${x}-${text}`} transform={`translate(${x},14) rotate(${rot})`}>
      <rect width={breit} height={breit * 1.45} rx="3" fill="#fff" />
      <text x="5" y="15" fontSize="11" fill={rotFarbe ? '#c22b1e' : '#17181d'} fontWeight="800">
        {text}
      </text>
    </g>
  );

  if (id === 'doppelkopf') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#1c5138" />
        <ellipse cx="160" cy="92" rx="190" ry="48" fill="#237a4d" />
        {karte(112, -14, '♣D', false)}
        {karte(142, -5, '♠D', false)}
        {karte(172, 5, '♥10', true)}
        {karte(202, 14, '♦A', true)}
      </svg>
    );
  }
  if (id === 'skat') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#1d3a52" />
        {karte(104, -8, '♠B', false)}
        {karte(134, 0, '♥B', true)}
        {karte(164, 8, '♣B', false)}
        <g transform="translate(216,22) rotate(4)">
          <rect width="26" height="37" rx="3" fill="#4a6a8a" />
          <rect x="3" y="3" width="20" height="31" rx="2" fill="#3a5570" />
        </g>
        <g transform="translate(240,24) rotate(11)">
          <rect width="26" height="37" rx="3" fill="#4a6a8a" />
          <rect x="3" y="3" width="20" height="31" rx="2" fill="#3a5570" />
        </g>
      </svg>
    );
  }
  if (id === 'schafkopf') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#3a5f8a" />
        <g fill="#fff" opacity="0.2">
          <path d="M0 0 L28 40 L0 80 Z" />
          <path d="M56 0 L28 40 L56 80 L84 40 Z" />
          <path d="M112 0 L84 40 L112 80 Z" />
        </g>
        {karte(150, -6, '♥O', true)}
        {karte(182, 7, '♠O', false)}
      </svg>
    );
  }
  if (id === 'romme') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#5a3a78" />
        {karte(104, -6, '♦3', true, 28)}
        {karte(134, 0, '♦4', true, 28)}
        {karte(164, 0, '♦5', true, 28)}
        <g transform="translate(196,16) rotate(7)">
          <rect width="28" height="40" rx="3" fill="#ffe9a8" />
          <text x="7" y="27" fontSize="16">🃏</text>
        </g>
      </svg>
    );
  }
  if (id === 'maumau') {
    return (
      <svg viewBox="0 0 320 80" aria-hidden="true">
        <rect width="320" height="80" fill="#8a3a4a" />
        {karte(116, -9, '♣7', false)}
        {karte(150, 3, '♥7', true)}
        <text x="204" y="48" fontSize="19" fontWeight="900" fill="#ffd76e" transform="rotate(6 204 48)">
          Mau!
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 320 80" aria-hidden="true">
      <rect width="320" height="80" fill="#33266b" />
      <g transform="translate(132,16) rotate(-6)">
        <rect width="28" height="40" rx="3" fill="#4a55a8" />
        <rect x="3" y="3" width="22" height="34" rx="2" fill="#3a4488" />
      </g>
      <g transform="translate(162,16) rotate(6)">
        <rect width="28" height="40" rx="3" fill="#4a55a8" />
        <rect x="3" y="3" width="22" height="34" rx="2" fill="#3a4488" />
      </g>
    </svg>
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

function ShopIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1.2 12a1.5 1.5 0 0 1-1.5 1.3H7.7A1.5 1.5 0 0 1 6.2 20L5 8z" />
      <path d="M9 11V6.5a3 3 0 0 1 6 0V11" />
    </svg>
  );
}

function BlattIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6.5" y="3.5" width="11" height="17" rx="1.8" />
      <path d="M12 9.2c1.4-2.4 4.6-.6 3.2 1.6-.6 1-2 2-3.2 3-1.2-1-2.6-2-3.2-3-1.4-2.2 1.8-4 3.2-1.6z" />
    </svg>
  );
}

function MuenzeIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function KroneIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5l4 3.5 4-6 4 6 4-3.5-1.2 9a1.5 1.5 0 0 1-1.5 1.3H6.7a1.5 1.5 0 0 1-1.5-1.3L4 8.5z" />
    </svg>
  );
}

function GeschenkIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M12 9v11" />
      <path d="M4 13h16" />
      <path d="M12 9C10 9 7.5 8.3 7.5 6.4 7.5 4.6 10 4.4 11 6c.6 1 .9 2 1 3z" />
      <path d="M12 9c2 0 4.5-.7 4.5-2.6 0-1.8-2.5-2-3.5-.4-.6 1-.9 2-1 3z" />
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

function ClanIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5 19 7v5.2c0 4.3-2.9 7.3-7 8.8-4.1-1.5-7-4.5-7-8.8V7l7-3.5z" />
      <circle cx="12" cy="10" r="2.2" />
      <path d="M8.5 16.2c.7-1.6 2-2.4 3.5-2.4s2.8.8 3.5 2.4" />
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
