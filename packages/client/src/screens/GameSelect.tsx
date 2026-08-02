import { useEffect, useState } from 'react';

import { api, type GameSummary, type Me } from '../api';
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
  onAvatarChange,
  onSignOut,
}: {
  me: Me;
  onPick: (gameId: string) => void;
  onDeckChange: (cardDeck: string) => void;
  onAvatarChange: () => void;
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

      <ProfilePicture me={me} onChanged={onAvatarChange} />

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

      <DeckPicker current={me.cardDeck} onChange={onDeckChange} />
    </main>
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
