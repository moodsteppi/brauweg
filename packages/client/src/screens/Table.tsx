import { useState } from 'react';

import { CardBack, CardFront } from '../CardFace';
import { sortByOrder } from '../cardsort';
import type { Deck } from '../decks';
import { gameTypeLabel, t } from '../i18n';
import type { Action, Card } from '../protocol';
import { useCountdown, useTable } from '../useTable';

const TURN_SECONDS = 60;

/**
 * Der Doppelkopf-Tisch als mobile Oberflaeche.
 *
 * Aufbau wie am echten Tisch: die eigene Hand liegt unten, gefaechert und nach
 * Staerke sortiert; die drei Mitspieler sitzen an den Raendern mit verdeckten
 * Karten; der laufende Stich liegt in der Mitte, jede Karte vor dem, der sie
 * gelegt hat.
 *
 * Zwei Grundsaetze bleiben: Alle Schaltflaechen entstehen aus legalActions —
 * der Client bildet keine Regeln nach. Und die Kartenreihenfolge kommt als
 * `order` vom Server; bei einem Solo sortiert sich die Hand deshalb von selbst
 * um.
 */
export function Table({
  tableId,
  deck,
  onShowProfile,
  onLeave,
}: {
  tableId: string;
  deck: Deck;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
}): React.JSX.Element {
  const { view, party, table, error, connected, send } = useTable(tableId);
  const secondsLeft = useCountdown(view?.turnDeadline ?? null);

  /**
   * Name als Weg zum Profil, wo ein Konto dahintersteht. Bots und freie
   * Plaetze bleiben Text - ein Bot hat kein Profil, und so sieht man nebenbei,
   * wer echt ist.
   */
  const spielerName = (
    text: string,
    accountId: string | null | undefined,
  ): React.JSX.Element =>
    accountId ? (
      <button className="spielername" onClick={() => onShowProfile(accountId)}>
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );

  // Wartebereich: freie Plaetze sind kein Fehler, sondern der Normalfall. Man
  // sieht, wer schon da ist; ist der letzte Platz belegt, geht es von selbst
  // los und die Sicht ersetzt diesen Bildschirm.
  if (!view && table && table.status === 'waiting') {
    return (
      <div className="doko doko--wait">
        <header className="doko-top">
          <button className="doko-icon" onClick={onLeave} aria-label="Zurück">
            ‹
          </button>
          <div className="doko-top-mid">
            <strong>Wartet auf Mitspieler</strong>
            <span className="muted">
              {table.missing === 0
                ? 'Alle Plätze belegt, es geht gleich los…'
                : `${table.missing === 1 ? 'Noch ein Spieler' : `Noch ${table.missing} Spieler`} · ${table.rounds} Runden`}
            </span>
          </div>
        </header>
        <div className="doko-wait">
          {table.seats.map((seat) => (
            <div
              className={`doko-wait-seat${seat.displayName ? '' : ' is-empty'}`}
              key={seat.seat}
            >
              <Avatar
                name={seat.displayName ?? 'frei'}
                seatIndex={seat.seat}
                active={false}
                secondsLeft={null}
                isBot={seat.isBot}
              />
              {/* Jans Optik, meine Verlinkung: Wer schon wartet, kann sich die
                  Mitspieler vorab ansehen und gleich anfreunden. */}
              {seat.displayName ? (
                spielerName(seat.displayName, seat.accountId)
              ) : (
                <span>frei</span>
              )}
            </div>
          ))}
        </div>
        <p className="muted doko-wait-hint">
          Teile die Adresse dieser Seite, dann können andere direkt beitreten.
        </p>
        {error && <p className="doko-error">{t(error)}</p>}
      </div>
    );
  }

  if (!view) {
    return (
      <div className="doko doko--loading">
        <div className="doko-spinner" aria-hidden="true" />
        <p className="muted">{connected ? 'Tisch wird geladen…' : 'Verbinde…'}</p>
        {error && <p className="error">{t(error)}</p>}
        <button onClick={onLeave}>Zurück</button>
      </div>
    );
  }

  const round = view.view.round;

  const seatList = party?.seats ?? [];
  const seatCount = seatList.length || Object.keys(round?.handCounts ?? {}).length || 4;
  const base = view.seat ?? 0;

  const seatInfo = (seat: number) => seatList.find((s) => s.seat === seat);
  const nameOf = (seat: number): string => {
    const entry = seatInfo(seat);
    if (!entry || !entry.displayName) return `Bot ${seat + 1}`;
    return entry.displayName;
  };
  const isBotSeat = (seat: number): boolean => {
    const entry = seatInfo(seat);
    return (!entry?.displayName || !!entry?.isBot) || view.botSeats.includes(seat);
  };

  if (view.finished) {
    return (
      <PartyEnd
        view={view}
        party={party}
        nameOf={nameOf}
        spielerName={spielerName}
        onLeave={onLeave}
      />
    );
  }

  const playable = new Set(
    view.legalActions
      .filter((action) => action.type === 'playCard')
      .map((action) => action.cardId as number),
  );
  const otherActions = view.legalActions.filter((action) => action.type !== 'playCard');

  const opponents = Array.from({ length: seatCount }, (_, s) => s).filter(
    (s) => view.seat === null || s !== view.seat,
  );

  const hand = round ? sortByOrder(round.hand, round.order) : [];
  const trick = round?.currentTrick ?? [];
  const phaseText = round ? t(`phase.${round.phase}`) : 'Zwischen den Runden';

  // Trumpf oder Fehl: nur abgelesen aus der Rangfolge, die das Modul liefert.
  const trumps = new Set(round?.order.trumps ?? []);
  const isTrump = (card: Card): boolean => trumps.has(`${card.suit}${card.rank}`);

  // Im Solo spielt der einzige oeffentlich bekannte Re-Sitz allein.
  const soloName =
    round && round.gameType?.kind === 'solo'
      ? (() => {
          const entry = Object.entries(round.knownParties ?? {}).find(([, p]) => p === 're');
          return entry ? nameOf(Number(entry[0])) : null;
        })()
      : null;

  // Spielart gehoert sichtbar an den Tisch: im Herz-Solo ist die Herz-Neun
  // Trumpf, im Normalspiel eine Fehlkarte. Vor der Vorbehaltsabfrage steht sie
  // noch nicht fest.
  const gameLine = !round
    ? 'Zwischen den Runden'
    : round.phase === 'vorbehalt'
      ? 'Spielart wird noch bestimmt'
      : gameTypeLabel(round.gameType) + (soloName ? ` · ${soloName} solo` : '');

  const needReturn = round?.armut.awaiting === 'return';
  const needHandover =
    round?.armut.awaiting === 'handover' &&
    !otherActions.some((a) => a.type === 'armutHandover');

  return (
    <div className="doko">
      {/* Kopfzeile */}
      <header className="doko-top">
        <button className="doko-icon" onClick={onLeave} aria-label="Tisch verlassen">
          ‹
        </button>
        <div className="doko-top-mid">
          <strong>
            Runde {view.view.roundIndex + 1} / {view.view.totalRounds}
          </strong>
          <span className="muted">{gameLine}</span>
        </div>
        <div className="doko-top-right">
          {view.view.nextMultiplier > 1 && (
            <span className="doko-badge doko-badge--bock">Bock ×{view.view.nextMultiplier}</span>
          )}
          {view.seat === null && <span className="doko-badge">Zuschauer</span>}
        </div>
      </header>

      {/* Spielfläche. Namen sind hier bewusst NICHT klickbar: Mitten im Zug
          versehentlich ein Profil zu oeffnen risse einen vom Tisch. Der Weg
          zum Profil fuehrt ueber Wartebereich und Partie-Ende. */}
      <div className={`doko-felt seats-${seatCount}`}>
        {opponents.map((seat) => (
          <OpponentSeat
            key={seat}
            slot={slotFor(seat, base, seatCount)}
            name={nameOf(seat)}
            seatIndex={seat}
            isBot={isBotSeat(seat)}
            hasLeft={view.leftSeats.includes(seat)}
            botTakeover={view.botSeats.includes(seat) && !view.leftSeats.includes(seat)}
            count={round?.handCounts[seat] ?? 0}
            score={view.view.scores[seat] ?? 0}
            active={view.currentActor === seat}
            secondsLeft={view.currentActor === seat ? secondsLeft : null}
            party={round?.knownParties?.[seat] ?? null}
            deck={deck}
          />
        ))}

        {/* Stich in der Mitte */}
        <div className="doko-trick">
          {trick.length === 0 && <span className="doko-trick-hint">{phaseText}</span>}
          {trick.map((played) => (
            <div
              key={played.card.id}
              className={`doko-trick-card at-${slotFor(played.seat, base, seatCount)}`}
            >
              <div className="pc pc--trick">
                <CardFront card={played.card} deck={deck} />
              </div>
            </div>
          ))}
        </div>

        {round?.lastTrick && trick.length === 0 && (
          <p className="doko-last">
            Letzter Stich an {nameOf(round.lastTrick.winnerSeat)}
          </p>
        )}
      </div>

      {error && <p className="doko-error">{t(error)}</p>}

      {/* Pflichtansage blockiert alles andere */}
      {round?.pendingPflichtansage?.seat === view.seat && (
        <Pflichtansage
          points={round.pendingPflichtansage.trickPoints}
          canDecline={round.pendingPflichtansage.canDecline}
          onDecide={(accept) =>
            send({ type: 'confirmPflichtansage', seat: view.seat!, accept })
          }
        />
      )}

      {/* Ansagen und Vorbehalte */}
      {otherActions.length > 0 && !round?.pendingPflichtansage && (
        <div className="doko-actions">
          {otherActions.map((action, index) => (
            <button
              key={index}
              className={`doko-action${action.type === 'announce' ? ' doko-action--call' : ''}`}
              onClick={() => send(action)}
            >
              {actionLabel(action)}
            </button>
          ))}
        </div>
      )}

      {/* Eigener Bereich: Name, Partei, Hand */}
      <div className="doko-me">
        <Avatar
          name={view.seat === null ? 'Du' : nameOf(view.seat)}
          seatIndex={view.seat ?? 0}
          active={view.currentActor === view.seat}
          secondsLeft={view.currentActor === view.seat ? secondsLeft : null}
          you
        />
        <div className="doko-me-info">
          <strong>{view.seat === null ? 'Zuschauer' : nameOf(view.seat)}</strong>
          <span className="muted">
            {round?.myParty ? partyLabel(round.myParty) : 'Deine Karten'}
          </span>
        </div>
        {view.currentActor === view.seat && secondsLeft !== null && (
          <span className="doko-turnclock">{secondsLeft}s</span>
        )}
      </div>

      {view.seat !== null && (
        <div className="doko-hand">
          {hand.map((card, index) => (
            <HandCard
              key={card.id}
              card={card}
              deck={deck}
              index={index}
              total={hand.length}
              playable={playable.has(card.id)}
              trump={isTrump(card)}
              onPlay={() => send({ type: 'playCard', seat: view.seat!, cardId: card.id })}
            />
          ))}
          {hand.length === 0 && <span className="muted">Keine Karten auf der Hand.</span>}
        </div>
      )}

      {/* Kartenauswahl (Armut) als Overlay */}
      {round && needReturn && (
        <CardPicker
          title={`Gib ${round.armut.handoverSize} Karten zurück`}
          hand={hand}
          deck={deck}
          count={round.armut.handoverSize}
          onPick={(cards) => send({ type: 'armutReturn', seat: view.seat!, cards })}
        />
      )}
      {round && needHandover && (
        <CardPicker
          title={`Gib ${round.armut.handoverSize} Karten ab`}
          hand={hand}
          deck={deck}
          count={round.armut.handoverSize}
          onPick={(cards) => send({ type: 'armutHandover', seat: view.seat!, cards })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spieler
// ---------------------------------------------------------------------------

type Slot = 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right';

const LAYOUTS: Record<number, Slot[]> = {
  3: ['bottom', 'left', 'right'],
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'left', 'top-left', 'top-right', 'right'],
};

/** Absoluter Sitz -> Platz am Bildschirm, relativ zum eigenen Sitz. */
function slotFor(seat: number, base: number, seatCount: number): Slot {
  const rel = (seat - base + seatCount) % seatCount;
  return LAYOUTS[seatCount]?.[rel] ?? 'top';
}

/** Warme, je Sitz feste Farbe fuer die Avatare. */
const SEAT_HUES = [16, 200, 140, 275, 45];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

function Avatar({
  name,
  seatIndex,
  active,
  secondsLeft,
  isBot,
  you,
}: {
  name: string;
  seatIndex: number;
  active: boolean;
  secondsLeft: number | null;
  isBot?: boolean;
  you?: boolean;
}): React.JSX.Element {
  const hue = SEAT_HUES[seatIndex % SEAT_HUES.length]!;
  const ring =
    active && secondsLeft !== null
      ? `conic-gradient(var(--accent) ${(secondsLeft / TURN_SECONDS) * 360}deg, rgba(255,255,255,0.08) 0)`
      : undefined;
  return (
    <div
      className={`doko-avatar${active ? ' is-active' : ''}${you ? ' is-you' : ''}`}
      style={ring ? { background: ring } : undefined}
    >
      <span style={{ background: `hsl(${hue} 45% 32%)` }}>
        {isBot ? 'BOT' : initials(name)}
      </span>
    </div>
  );
}

function OpponentSeat({
  slot,
  name,
  seatIndex,
  isBot,
  hasLeft,
  botTakeover,
  count,
  score,
  active,
  secondsLeft,
  party,
  deck,
}: {
  slot: Slot;
  name: string;
  seatIndex: number;
  isBot: boolean;
  hasLeft: boolean;
  botTakeover: boolean;
  count: number;
  score: number;
  active: boolean;
  secondsLeft: number | null;
  party: string | null;
  deck: Deck;
}): React.JSX.Element {
  const vertical = slot === 'left' || slot === 'right';
  // Wenige verdeckte Karten als Faecher, die tatsaechliche Zahl als Plakette.
  const shown = Math.min(count, 5);
  return (
    <div className={`doko-opp at-${slot}${active ? ' is-active' : ''}`}>
      <Avatar
        name={name}
        seatIndex={seatIndex}
        active={active}
        secondsLeft={secondsLeft}
        isBot={isBot}
      />
      <div className="doko-opp-name">
        <span>{isBot ? `Bot ${seatIndex + 1}` : name}</span>
        {party && <em className={`doko-party doko-party--${party}`}>{partyLabel(party)}</em>}
        {hasLeft && <em className="doko-tag">ausgestiegen</em>}
        {!hasLeft && botTakeover && !isBot && <em className="doko-tag">Bot übernimmt</em>}
      </div>
      <div className={`doko-backs${vertical ? ' is-vertical' : ''}`}>
        {Array.from({ length: shown }, (_, i) => (
          <div className="pc pc--back" key={i}>
            <CardBack deck={deck} />
          </div>
        ))}
        <span className="doko-count">{count}</span>
      </div>
      <span className="doko-opp-score">{score}</span>
    </div>
  );
}

function partyLabel(party: string): string {
  return party === 're' ? 'Re' : 'Kontra';
}

// ---------------------------------------------------------------------------
// Hand
// ---------------------------------------------------------------------------

function HandCard({
  card,
  deck,
  index,
  total,
  playable,
  trump,
  onPlay,
}: {
  card: Card;
  deck: Deck;
  index: number;
  total: number;
  playable: boolean;
  trump: boolean;
  onPlay: () => void;
}): React.JSX.Element {
  // Sanfter Faecher: die mittleren Karten stehen etwas hoeher, die aeusseren
  // sind leicht gekippt. Bei vielen Karten faellt beides schwaecher aus, damit
  // zwoelf Blatt auf ein Handy passen.
  const mid = (total - 1) / 2;
  const off = index - mid;
  const rot = off * Math.min(3.2, 22 / Math.max(total, 1));
  const dip = Math.pow(Math.abs(off), 1.6) * (total > 7 ? 1.1 : 2.2);
  const lift = playable ? 16 : 0;
  const transform = `translateY(${dip - lift}px) rotate(${rot}deg)`;

  return (
    <button
      className={`doko-handcard${playable ? ' is-playable' : ''}${trump ? ' is-trump' : ''}`}
      style={{ transform, zIndex: index }}
      disabled={!playable}
      onClick={onPlay}
      aria-label={trump ? 'Trumpf' : undefined}
    >
      <div className="pc pc--hand">
        <CardFront card={card} deck={deck} />
        {trump && <span className="doko-trump-bar" aria-hidden="true" />}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Aktionen und Overlays
// ---------------------------------------------------------------------------

function actionLabel(action: Action): string {
  switch (action.type) {
    case 'vorbehalt':
      if (action.kind === null) return 'Gesund';
      if (action.kind === 'solo') return `Solo: ${soloLabel(action.solo as string)}`;
      if (action.kind === 'hochzeit') return 'Hochzeit';
      if (action.kind === 'armut') return 'Armut';
      if (action.kind === 'schmeiss') return 'Schmeißen';
      return String(action.kind);
    case 'announce': {
      const level = action.level as number;
      return ['Re / Kontra', 'Keine 90', 'Keine 60', 'Keine 30', 'Schwarz'][level] ?? 'Ansage';
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

function soloLabel(solo: string): string {
  const map: Record<string, string> = {
    suitC: 'Kreuz',
    suitS: 'Pik',
    suitH: 'Herz',
    suitD: 'Karo',
    queens: 'Damen',
    jacks: 'Buben',
    aces: 'Fleischlos',
    meatless: 'Fleischlos',
  };
  return map[solo] ?? solo;
}

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
    <div className="doko-sheet">
      <div className="doko-sheet-card">
        <h2>Pflichtansage</h2>
        <p>
          Der erste Stich hatte {points} Augen.{' '}
          {canDecline
            ? 'Die Ansage ist erwartet, aber freiwillig.'
            : 'Die Ansage erfolgt zwingend.'}
        </p>
        <div className="doko-sheet-row">
          <button className="primary" onClick={() => onDecide(true)}>
            Ansagen
          </button>
          <button onClick={() => onDecide(false)} disabled={!canDecline}>
            Ablehnen
          </button>
        </div>
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
    <div className="doko-sheet">
      <div className="doko-sheet-card">
        <h2>{title}</h2>
        <div className="doko-pick">
          {hand.map((card) => {
            const on = picked.includes(card.id);
            return (
              <button
                key={card.id}
                className={`doko-handcard${on ? ' is-selected' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(card.id)}
              >
                <div className="pc pc--hand">
                  <CardFront card={card} deck={deck} />
                </div>
              </button>
            );
          })}
        </div>
        <button
          className="primary"
          disabled={picked.length !== count}
          onClick={() => onPick(picked)}
        >
          {picked.length} von {count} gewählt
        </button>
      </div>
    </div>
  );
}

function PartyEnd({
  view,
  party,
  nameOf,
  spielerName,
  onLeave,
}: {
  view: NonNullable<ReturnType<typeof useTable>['view']>;
  party: ReturnType<typeof useTable>['party'];
  nameOf: (seat: number) => string;
  spielerName: (text: string, accountId: string | null | undefined) => React.JSX.Element;
  onLeave: () => void;
}): React.JSX.Element {
  const standings = [...(party?.standings ?? [])].sort((a, b) => a.place - b.place);
  const medals = ['🥇', '🥈', '🥉'];

  const awards = party?.trophies ?? [];
  const gewertet = awards.length > 0;

  /** Summe je Sitz: Platzierung und eventuelle Verlassen-Strafe zusammen. */
  const trophiesOf = (seat: number): number =>
    awards.filter((a) => a.seat === seat).reduce((sum, a) => sum + a.delta, 0);

  const accountOf = (seat: number): string | null | undefined =>
    party?.seats.find((s) => s.seat === seat)?.accountId;

  return (
    <div className="doko doko--end">
      <div className="doko-end-card">
        <h1>Partie beendet</h1>
        <p className="muted">{view.view.totalRounds} Runden gespielt.</p>
        <ol className="doko-standings">
          {standings.map((s, i) => {
            const delta = trophiesOf(s.seat);
            return (
              <li key={s.seat} className={i === 0 ? 'is-winner' : undefined}>
                <span className="doko-place">{medals[s.place - 1] ?? `${s.place}.`}</span>
                <span className="doko-standing-name">
                  {spielerName(nameOf(s.seat), accountOf(s.seat))}
                  {s.left && <em className="doko-tag">ausgestiegen</em>}
                  {/* Das Vorzeichen ist die Information: +9 ist ein Gewinn,
                      -9 ein Verlust, 0 ehrlich eine Null. */}
                  {gewertet && (
                    <em className="doko-tag">
                      {delta > 0 ? `+${delta}` : delta} 🏆
                    </em>
                  )}
                </span>
                <span className="doko-standing-points">{s.points}</span>
              </li>
            );
          })}
        </ol>
        <p className="muted doko-fineprint">
          {gewertet
            ? 'Trophäen sind gutgeschrieben — dein Stand steht im Profil.'
            : 'Keine Trophäen: An Tischen mit Bots wird nicht gewertet.'}
        </p>
        <button className="primary" onClick={onLeave}>
          Zurück zur Lobby
        </button>
      </div>
    </div>
  );
}
