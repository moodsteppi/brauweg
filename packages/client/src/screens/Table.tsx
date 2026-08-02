import { useState } from 'react';

import { CardButton, CardFace } from '../CardFace';
import { cardImage, type Deck } from '../decks';
import { cardLabel, gameTypeLabel, t } from '../i18n';
import type { Action, Card } from '../protocol';
import { useCountdown, useTable } from '../useTable';

const TURN_SECONDS = 60;

/**
 * Der Spieltisch.
 *
 * Alle Schaltflaechen entstehen aus legalActions und der gefilterten Sicht.
 * Der Client bildet KEINE Regeln nach — sonst gaebe es zwei Wahrheiten, und
 * die zweite waere irgendwann falsch.
 */
export function Table({
  tableId,
  deck,
  onLeave,
}: {
  tableId: string;
  deck: Deck;
  onLeave: () => void;
}): React.JSX.Element {
  const { view, party, table, error, connected, send } = useTable(tableId);
  const secondsLeft = useCountdown(view?.turnDeadline ?? null);

  // Wartebereich. Ein Tisch mit freien Plätzen ist kein Fehler und kein
  // Ladezustand, sondern der Normalfall jeder Lobby: Man sieht, wer schon da
  // ist, und sobald der letzte Platz belegt ist, geht es von selbst los.
  if (!view && table && table.status === 'waiting') {
    return (
      <main>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h1>Wartet auf Mitspieler</h1>
          <button onClick={onLeave}>Zurück</button>
        </div>
        <p className="muted">
          {table.missing === 0
            ? 'Alle Plätze belegt, es geht gleich los…'
            : `Es ${table.missing === 1 ? 'fehlt noch ein Spieler' : `fehlen noch ${table.missing} Spieler`}. ` +
              `${table.rounds} Runden.`}
        </p>

        <div className="panel">
          {table.seats.map((seat) => (
            <div className="seat" key={seat.seat}>
              <span>{seat.displayName ?? <em className="muted">frei</em>}</span>
              <span className="muted">Platz {seat.seat + 1}</span>
            </div>
          ))}
        </div>

        <p className="muted">
          Teile die Adresse dieser Seite, dann können andere direkt beitreten.
        </p>
        {error && <p className="error">{t(error)}</p>}
      </main>
    );
  }

  if (!view) {
    return (
      <main>
        <p className="muted">{connected ? 'Tisch wird geladen…' : 'Verbinde…'}</p>
        {error && <p className="error">{t(error)}</p>}
        <button onClick={onLeave}>Zurück</button>
      </main>
    );
  }

  const round = view.view.round;
  const nameOf = (seat: number): string => {
    const entry = party?.seats.find((s) => s.seat === seat);
    if (!entry) return `Sitz ${seat}`;
    // Ein leerer Platz ist schlicht ein Bot. Sitzt dort ein Mensch, fuer den
    // gerade ein Bot uebernimmt, gehoert der Name daneben — die Punkte gehen
    // an den Account, nicht an den Bot.
    if (!entry.displayName) return `Bot ${seat}`;
    return entry.isBot ? `${entry.displayName} (Bot)` : entry.displayName;
  };

  if (view.finished) {
    return <PartyEnd view={view} party={party} nameOf={nameOf} onLeave={onLeave} />;
  }

  const playable = new Set(
    view.legalActions
      .filter((action) => action.type === 'playCard')
      .map((action) => action.cardId as number),
  );
  const others = view.legalActions.filter((action) => action.type !== 'playCard');

  // Im Solo spielt genau einer allein: der einzige öffentlich bekannte Re-Sitz.
  const soloSeat =
    round && round.gameType.kind === 'solo'
      ? (Object.entries(round.knownParties).find(([, partei]) => partei === 're')?.[0] ??
        null)
      : null;

  /**
   * Trumpf oder Fehl. Abgelesen aus der Rangfolge, die das Spielmodul
   * mitliefert — der Client entscheidet das nicht selbst, sonst gäbe es zwei
   * Wahrheiten darüber, was Trumpf ist.
   */
  const trumps = new Set(round?.order.trumps ?? []);
  const isTrump = (card: Card): boolean => trumps.has(`${card.suit}${card.rank}`);
  const trumpCount = (round?.hand ?? []).filter(isTrump).length;

  return (
    <main>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>
          Runde {view.view.roundIndex + 1} von {view.view.totalRounds}
        </h1>
        <button onClick={onLeave}>Verlassen</button>
      </div>

      {/*
        Die Spielart gehört sichtbar an den Tisch, nicht ins Gedächtnis.
        Im Herz-Solo ist die Herz-Neun Trumpf, im Normalspiel eine Fehlkarte:
        Wer das nicht sieht, hält den Bedienzwang für einen Fehler.
      */}
      {round && (
        <p>
          {/*
            Erst nach der Vorbehaltsabfrage steht die Spielart fest. Vorher
            "Normalspiel" anzuzeigen waere eine Behauptung, die sich gleich als
            falsch herausstellen kann.
          */}
          {round.phase === 'vorbehalt' ? (
            <span className="muted">Spielart wird noch bestimmt</span>
          ) : (
            <>
              <strong>{gameTypeLabel(round.gameType)}</strong>
              {soloSeat !== null && ` · ${nameOf(Number(soloSeat))} spielt allein`}
              {round.myParty && ` · du bist ${round.myParty === 're' ? 'Re' : 'Kontra'}`}
            </>
          )}
        </p>
      )}

      <p className="muted">
        {round ? t(`phase.${round.phase}`) : 'Zwischen den Runden'}
        {view.view.nextMultiplier > 1 && ` · Bock ×${view.view.nextMultiplier}`}
        {view.seat === null && ' · Zuschauer'}
      </p>

      {error && <p className="error">{t(error)}</p>}

      {/* Zugtimer als Balken, wie im Plan. */}
      {secondsLeft !== null && (
        <div className="panel" style={{ padding: '0.6rem' }}>
          <div className="timer">
            <div style={{ width: `${(secondsLeft / TURN_SECONDS) * 100}%` }} />
          </div>
          <div className="muted">{secondsLeft} Sekunden</div>
        </div>
      )}

      <div className="panel">
        {(party?.seats ?? []).map((seat) => (
          <div
            className={`seat${view.currentActor === seat.seat ? ' active' : ''}`}
            key={seat.seat}
          >
            <span>
              {nameOf(seat.seat)}
              {view.leftSeats.includes(seat.seat) && ' · ausgestiegen'}
              {view.botSeats.includes(seat.seat) && ' · Bot übernimmt'}
            </span>
            <span className="muted">
              {round?.handCounts[seat.seat] ?? 0} Karten ·{' '}
              {view.view.scores[seat.seat] ?? 0} Punkte
            </span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Stich</h2>
        <div className="trick">
          {(round?.currentTrick ?? []).map((played) => (
            <div className="played" key={played.card.id}>
              {/* Beim Bildblatt traegt das Bild den Rand selbst, beim Textblatt
                  bleibt die gelegte Karte die helle Flaeche wie bisher. */}
              <div className={cardImage(deck, played.card) ? 'card--image' : 'card'}>
                <CardFace card={played.card} deck={deck} />
              </div>
              <div className="muted" style={{ fontSize: '0.7rem' }}>
                {nameOf(played.seat)}
              </div>
            </div>
          ))}
          {(round?.currentTrick.length ?? 0) === 0 && (
            <span className="muted">Noch keine Karte gespielt.</span>
          )}
        </div>
        {round?.lastTrick && (
          <p className="muted">
            Letzter Stich an {nameOf(round.lastTrick.winnerSeat)}:{' '}
            {round.lastTrick.played.map((played) => cardLabel(played.card)).join(' ')}
          </p>
        )}
      </div>

      {round?.pendingPflichtansage?.seat === view.seat && (
        <Pflichtansage
          points={round.pendingPflichtansage.trickPoints}
          canDecline={round.pendingPflichtansage.canDecline}
          onDecide={(accept) =>
            send({ type: 'confirmPflichtansage', seat: view.seat, accept })
          }
        />
      )}

      {others.length > 0 && (
        <div className="panel">
          <h2>Ansagen und Vorbehalte</h2>
          <div className="row">
            {others.map((action, index) => (
              <button key={index} onClick={() => send(action)}>
                {actionLabel(action)}
              </button>
            ))}
          </div>
        </div>
      )}

      {round?.armut.awaiting === 'return' && (
        <CardPicker
          title={`Gib ${round.armut.handoverSize} Karten zurück`}
          hand={round.hand}
          deck={deck}
          count={round.armut.handoverSize}
          onPick={(cards) => send({ type: 'armutReturn', seat: view.seat, cards })}
        />
      )}
      {round?.armut.awaiting === 'handover' && view.legalActions.length === 0 && (
        <CardPicker
          title={`Gib ${round.armut.handoverSize} Karten ab`}
          hand={round.hand}
          deck={deck}
          count={round.armut.handoverSize}
          onPick={(cards) => send({ type: 'armutHandover', seat: view.seat, cards })}
        />
      )}

      <div className="panel">
        <h2>Deine Karten</h2>
        {/* Sortiert liefert sie die Engine bereits. Illegale Karten bleiben
            sichtbar, aber abgedunkelt: Man soll sehen, was man hat. */}
        <div className="hand">
          {(round?.hand ?? []).map((card) => (
            <CardButton
              card={card}
              deck={deck}
              key={card.id}
              trump={isTrump(card)}
              disabled={!playable.has(card.id)}
              onClick={() => send({ type: 'playCard', seat: view.seat, cardId: card.id })}
            />
          ))}
          {(round?.hand.length ?? 0) === 0 && (
            <span className="muted">Keine Karten auf der Hand.</span>
          )}
        </div>
        {trumpCount > 0 && (
          <p className="muted">
            {trumpCount === 1 ? 'Ein Trumpf' : `${trumpCount} Trümpfe`} auf der Hand,
            grün markiert.
          </p>
        )}
      </div>
    </main>
  );
}

function actionLabel(action: Action): string {
  switch (action.type) {
    case 'vorbehalt':
      if (action.kind === null) return 'Gesund';
      if (action.kind === 'solo') return `Solo: ${action.solo}`;
      return String(action.kind);
    case 'announce': {
      const level = action.level as number;
      return ['Re/Kontra', 'Keine 90', 'Keine 60', 'Keine 30', 'Schwarz'][level] ?? 'Ansage';
    }
    case 'armutAccept':
      return 'Armut annehmen';
    case 'armutDecline':
      return 'Armut ablehnen';
    case 'armutHandover':
      return 'Trümpfe abgeben';
    case 'confirmPflichtansage':
      return action.accept ? 'Bestätigen' : 'Ablehnen';
    default:
      return action.type;
  }
}

/**
 * Ab 30 Augen ist die Ansage zwingend, das Fenster ist reine Information.
 * Bei 29 darf abgelehnt werden.
 */
function Pflichtansage({
  points,
  canDecline,
  onDecide,
}: {
  points: number;
  canDecline: boolean;
  onDecide: (accept: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="panel">
      <h2>Pflichtansage</h2>
      <p>
        Der erste Stich hatte {points} Augen.{' '}
        {canDecline
          ? 'Die Ansage ist moralisch erwartet, aber freiwillig.'
          : 'Die Ansage erfolgt zwingend.'}
      </p>
      <div className="row">
        <button className="primary" onClick={() => onDecide(true)}>
          Ansagen
        </button>
        <button onClick={() => onDecide(false)} disabled={!canDecline}>
          Ablehnen
        </button>
      </div>
    </div>
  );
}

/** Auswahl von genau N Karten. Ob sie zulaessig ist, entscheidet der Server. */
function CardPicker({
  title,
  hand,
  deck,
  count,
  onPick,
}: {
  title: string;
  hand: Card[];
  deck: Deck;
  count: number;
  onPick: (cards: number[]) => void;
}): React.JSX.Element {
  const [picked, setPicked] = useState<number[]>([]);

  const toggle = (id: number): void => {
    setPicked(picked.includes(id) ? picked.filter((c) => c !== id) : [...picked, id]);
  };

  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="hand">
        {hand.map((card) => (
          <CardButton
            card={card}
            deck={deck}
            key={card.id}
            selected={picked.includes(card.id)}
            onClick={() => toggle(card.id)}
          />
        ))}
      </div>
      <button
        className="primary"
        style={{ marginTop: '0.75rem' }}
        disabled={picked.length !== count}
        onClick={() => onPick(picked)}
      >
        {picked.length} von {count} gewählt
      </button>
    </div>
  );
}

/**
 * Partie-Ende.
 *
 * Wichtiger, als es klingt: Bei multiplikativen Ansagen und Bock will jeder
 * nachvollziehen, wie ein Ergebnis zustande kam. Ist das intransparent, wird
 * jedes ungewohnte Ergebnis als Fehler gemeldet.
 */
function PartyEnd({
  view,
  party,
  nameOf,
  onLeave,
}: {
  view: NonNullable<ReturnType<typeof useTable>['view']>;
  party: ReturnType<typeof useTable>['party'];
  nameOf: (seat: number) => string;
  onLeave: () => void;
}): React.JSX.Element {
  const standings = [...(party?.standings ?? [])].sort((a, b) => a.place - b.place);

  return (
    <main>
      <h1>Partie beendet</h1>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Platz</th>
              <th>Spieler</th>
              <th>Punkte</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr key={standing.seat}>
                <td>{standing.place}</td>
                <td>
                  {nameOf(standing.seat)}
                  {standing.left && ' · ausgestiegen'}
                </td>
                <td>{standing.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        {view.view.totalRounds} Runden gespielt. Trophäen zählen nur an Tischen ohne Bots.
      </p>
      <button className="primary" onClick={onLeave}>
        Zurück zur Lobby
      </button>
    </main>
  );
}
