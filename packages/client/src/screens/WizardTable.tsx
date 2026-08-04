import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardFront } from '../CardFace';
import { sortByOrder } from '../cardsort';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { suitName, suitSymbol, t } from '../i18n';
import type {
  Action,
  Card,
  PlayedCard,
  WizardGameView,
  WizardRoundSummary,
  WizardRoundView,
} from '../protocol';
import {
  Avatar,
  HandCard,
  LetzterStich,
  PartyEnd,
  RegelBlatt,
  Ruecken,
  StichStapel,
  TurnClock,
  Wartebereich,
  istSeitlich,
  slotFor,
} from '../tisch';
import { useTable } from '../useTable';

const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.45;
const ZOOM_STEP = 0.15;

/** Wie lange das Rundenblatt stehen bleibt, wenn niemand tippt. */
const ABRECHNUNG_MS = 10_000;

/**
 * Der Zauberer-Tisch.
 *
 * Derselbe Aufbau wie beim Doppelkopf - eigene Hand unten, Mitspieler an den
 * Raendern, Stich in der Mitte -, aber mit dem, was dieses Spiel ausmacht:
 *
 *   - An jedem Sitz steht "Gebot / Stiche". Beides ist oeffentlich, und ohne
 *     diese Zahl ist keine einzige Karte zu beurteilen.
 *   - Die aufgedeckte Trumpfkarte liegt sichtbar am Tisch.
 *   - Nach jeder Runde ein Blatt mit der Abrechnung, dazu eine Punktetafel
 *     ueber alle Runden. Bei bis zu zwanzig Runden ist das kein Beiwerk.
 *
 * Unveraendert gilt: Alle Schaltflaechen entstehen aus `legalActions`, die
 * Kartenreihenfolge kommt als `order` vom Server. Der Client bildet keine
 * Regel nach.
 */
export function WizardTable({
  tableId,
  deck,
  szene,
  onShowProfile,
  onLeave,
}: {
  tableId: string;
  deck: Deck;
  szene: string;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
}): React.JSX.Element {
  const { view, party, table, error, connected, send, addBot, removeBot } =
    useTable<WizardGameView>(tableId, 'wizard');

  const [zoom, setZoom] = useState<number>(() => {
    const raw = Number(localStorage.getItem('tischZoom'));
    return raw >= ZOOM_MIN && raw <= ZOOM_MAX ? raw : 1;
  });
  const changeZoom = (delta: number): void => {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta)) * 100) / 100;
    setZoom(next);
    localStorage.setItem('tischZoom', String(next));
  };

  const [zeigeRegeln, setZeigeRegeln] = useState(false);
  const [zeigeLetzten, setZeigeLetzten] = useState(false);
  const [zeigeTafel, setZeigeTafel] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);

  const togglePause = (): void => {
    if (!table || pauseBusy) return;
    setPauseBusy(true);
    void (table.paused ? api.resumeTable(tableId) : api.pauseTable(tableId))
      .catch(() => undefined)
      .finally(() => setPauseBusy(false));
  };

  const playCard = useCallback(
    (cardId: number) => send({ type: 'playCard', seat: view?.seat ?? 0, cardId }),
    [send, view?.seat],
  );

  // Der volle Stich bleibt eine Sekunde liegen, bevor er abgeraeumt wird. Der
  // Server raeumt sofort; hier wird der letzte Stich kurz weitergezeigt.
  const lastTrickNow = view?.view.round?.lastTrick ?? null;
  const lastKey = lastTrickNow ? lastTrickNow.played.map((p) => p.card.id).join('.') : null;
  const [frozenKey, setFrozenKey] = useState<string | null>(null);
  const seenKey = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (seenKey.current === undefined) {
      seenKey.current = lastKey;
      return;
    }
    if (lastKey && lastKey !== seenKey.current) {
      seenKey.current = lastKey;
      setFrozenKey(lastKey);
      const handle = setTimeout(() => setFrozenKey((k) => (k === lastKey ? null : k)), 1000);
      return () => clearTimeout(handle);
    }
  }, [lastKey]);

  /**
   * Rundenabrechnung: Sobald eine Runde in der Geschichte dazukommt, kommt sie
   * als Blatt. Beim ersten Anblick wird nur der Stand gemerkt - wer mitten in
   * der Partie beitritt, soll nicht zehn alte Abrechnungen nachgereicht
   * bekommen.
   */
  const historie = view?.view.history ?? [];
  const [abrechnung, setAbrechnung] = useState<WizardRoundSummary | null>(null);
  const gesehen = useRef<number | null>(null);
  useEffect(() => {
    if (!view) return;
    if (gesehen.current === null) {
      gesehen.current = historie.length;
      return;
    }
    if (historie.length <= gesehen.current) return;
    gesehen.current = historie.length;
    setAbrechnung(historie[historie.length - 1] ?? null);
  }, [historie, view]);

  // Die Partie ist vorbei: Das Blatt der letzten Runde wuerde den
  // Abschlussbildschirm verdecken.
  useEffect(() => {
    if (view?.finished) setAbrechnung(null);
  }, [view?.finished]);

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

  if (!view && table && table.status === 'waiting') {
    return (
      <Wartebereich
        tableId={tableId}
        table={table}
        error={error}
        spielerName={spielerName}
        addBot={addBot}
        removeBot={removeBot}
        onLeave={onLeave}
      />
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

  const runde = view.view.round;
  const seatList = party?.seats ?? [];
  const seats = runde?.seats ?? seatList.map((s) => s.seat);
  const seatCount = seats.length || 4;
  const base = view.seat ?? 0;

  const seatInfo = (seat: number) => seatList.find((s) => s.seat === seat);
  const nameOf = (seat: number): string =>
    seatInfo(seat)?.displayName ?? `Bot ${seat + 1}`;
  const isBotSeat = (seat: number): boolean =>
    !seatInfo(seat)?.displayName || !!seatInfo(seat)?.isBot || view.botSeats.includes(seat);

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
  const gebote = view.legalActions.filter((action) => action.type === 'bid');
  const trumpfwahl = view.legalActions.filter((action) => action.type === 'chooseTrump');
  const blindLegen = view.legalActions.find((action) => action.type === 'playBlind') ?? null;

  const hand = runde ? sortByOrder(runde.hand, runde.order) : [];
  const sticht = new Set(runde?.order.trumps ?? []);

  const liveTrick = runde?.currentTrick ?? [];
  const frozenActive = frozenKey !== null && frozenKey === lastKey && lastTrickNow !== null;
  const trick: PlayedCard[] = frozenActive ? lastTrickNow!.played : liveTrick;

  // Aufspiel gibt es nur im Stich. Waehrend der Ansagen ist der Sitz am Zug
  // nicht "raus" - er sagt an, und die Plakette waere schlicht falsch.
  const leaderSeat =
    runde?.phase !== 'playing'
      ? null
      : trick.length > 0
        ? trick[0]!.seat
        : view.currentActor;

  const gegner = seats.filter((seat) => view.seat === null || seat !== view.seat);

  return (
    <div className="doko wiz" style={{ '--zoom': zoom } as React.CSSProperties}>
      <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />

      <header className="doko-top">
        <button className="doko-icon" onClick={onLeave} aria-label="Tisch verlassen">
          ‹
        </button>
        <div className="doko-top-mid">
          <strong>
            Runde {view.view.roundIndex + 1} / {view.view.totalRounds}
          </strong>
          <span className="muted">{rundenzeile(runde)}</span>
        </div>
        <div className="doko-top-right">
          {table?.paused && <span className="doko-badge doko-badge--pause">Pausiert</span>}
          {view.seat === null && <span className="doko-badge">Zuschauer</span>}
          {table?.visibility === 'club_only' && view.seat !== null && (
            <button
              className="doko-icon"
              onClick={togglePause}
              disabled={pauseBusy}
              aria-label={table.paused ? 'Tisch fortsetzen' : 'Tisch pausieren'}
            >
              {table.paused ? '▶' : '❚❚'}
            </button>
          )}
          <button
            className="doko-icon"
            onClick={() => setZeigeTafel(true)}
            aria-label="Punktetafel ansehen"
          >
            Σ
          </button>
          <button
            className="doko-icon"
            onClick={() => setZeigeLetzten(true)}
            disabled={!runde?.lastTrick}
            aria-label="Letzten Stich ansehen"
          >
            ⟲
          </button>
          <button
            className="doko-icon"
            onClick={() => setZeigeRegeln(true)}
            aria-label="Tischregeln ansehen"
          >
            §
          </button>
          <button
            className="doko-icon"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Karten verkleinern"
          >
            −
          </button>
          <button
            className="doko-icon"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Karten vergrößern"
          >
            +
          </button>
        </div>
      </header>

      <div className={`doko-felt seats-${seatCount}`}>
        {gegner.map((seat) => (
          <GegnerSitz
            key={seat}
            slot={slotFor(seat, base, seatCount)}
            name={nameOf(seat)}
            accountId={seatInfo(seat)?.accountId ?? null}
            onShowProfile={onShowProfile}
            seatIndex={seat}
            isBot={isBotSeat(seat)}
            hasLeft={view.leftSeats.includes(seat)}
            botTakeover={view.botSeats.includes(seat) && !view.leftSeats.includes(seat)}
            count={runde?.handCounts[seat] ?? 0}
            offeneKarten={runde?.blindHands?.[seat] ?? null}
            score={view.view.scores[seat] ?? 0}
            gebot={runde?.bids[seat] ?? null}
            stiche={runde?.tricks[seat] ?? 0}
            active={view.currentActor === seat}
            leader={leaderSeat === seat}
            geber={runde?.dealer === seat}
            deadline={view.currentActor === seat ? view.turnDeadline : null}
            avatarUrl={seatInfo(seat)?.avatarUrl ?? null}
            deck={deck}
          />
        ))}

        {/* Trumpf liegt am Tisch, nicht in einer Zeile: Wer ihn sucht, sucht
            eine Karte. */}
        <TrumpfPlakette runde={runde} deck={deck} />

        <div className="doko-trick">
          {trick.length === 0 && (
            <span className="doko-trick-hint">{t(`phase.${runde?.phase ?? 'playing'}`)}</span>
          )}
          {trick.map((played) => (
            <div
              key={played.card.id}
              className={`doko-trick-card at-${slotFor(played.seat, base, seatCount)}`}
            >
              <div className="doko-trick-in">
                <div className="pc pc--trick">
                  <CardFront card={played.card} deck={deck} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {runde?.lastTrick && trick.length === 0 && (
          <p className="doko-last">Letzter Stich an {nameOf(runde.lastTrick.winnerSeat)}</p>
        )}
      </div>

      {error && <p className="doko-error">{t(error)}</p>}

      {/* Die eigene Lage in einem Satz: Gebot, Stiche, Aufspiel. */}
      <div className="doko-me">
        <Avatar
          name={view.seat === null ? 'Du' : nameOf(view.seat)}
          seatIndex={view.seat ?? 0}
          active={view.currentActor === view.seat}
          deadline={view.currentActor === view.seat ? view.turnDeadline : null}
          avatarUrl={view.seat === null ? null : (seatInfo(view.seat)?.avatarUrl ?? null)}
          you
        />
        <div className="doko-me-info">
          <strong>{view.seat === null ? 'Zuschauer' : nameOf(view.seat)}</strong>
          <span className="muted">
            {eigeneLage(runde, view.seat)}
            {view.seat !== null && leaderSeat === view.seat && ' · Aufspiel'}
          </span>
        </div>
        {view.seat !== null && <StichStapel count={runde?.tricks[view.seat] ?? 0} />}
        {view.currentActor === view.seat && view.turnDeadline !== null && (
          <TurnClock deadline={view.turnDeadline} />
        )}
      </div>

      {/* Blind gespielt: Die eigene Karte bleibt verdeckt, es gibt nichts zu
          waehlen - nur zu legen. */}
      {blindLegen && (
        <div className="doko-actions">
          <button className="doko-action doko-action--call" onClick={() => send(blindLegen)}>
            Karte legen
          </button>
        </div>
      )}

      {view.seat !== null && !runde?.blind && (
        <div className="doko-hand">
          {hand.map((card, index) => (
            <HandCard
              key={card.id}
              card={card}
              deck={deck}
              index={index}
              total={hand.length}
              playable={playable.has(card.id)}
              trump={sticht.has(`${card.suit}${card.rank}`)}
              onPlay={playCard}
            />
          ))}
          {hand.length === 0 && <span className="muted">Keine Karten auf der Hand.</span>}
        </div>
      )}

      {/* In der blinden Runde haelt man seine Karte an die Stirn: Man sieht
          alle anderen, nur sich selbst nicht. */}
      {view.seat !== null && runde?.blind && (
        <div className="doko-hand wiz-blind">
          <div className="pc pc--hand">
            <span className="pc-back" aria-hidden="true" />
          </div>
          <p className="muted">Deine Karte kennst du nicht — die der anderen schon.</p>
        </div>
      )}

      {/* Solange die Abrechnung der letzten Runde liegt, kommt keine neue
          Entscheidung darunter: Zwei Blaetter uebereinander heisst, dass man
          auf einem Knopf tippt, den man gar nicht lesen kann. */}
      {gebote.length > 0 && runde && !abrechnung && (
        <Gebotsblatt
          handSize={runde.handSize}
          erlaubt={gebote}
          bids={runde.bids}
          bidTotal={runde.bidTotal}
          verdeckt={!runde.bidsRevealed}
          nameOf={nameOf}
          onSend={send}
        />
      )}

      {trumpfwahl.length > 0 && !abrechnung && (
        <Trumpfwahl actions={trumpfwahl} onSend={send} />
      )}

      {abrechnung && (
        <Rundenblatt
          runde={abrechnung}
          seats={seats}
          nameOf={nameOf}
          onClose={() => setAbrechnung(null)}
        />
      )}

      {zeigeTafel && (
        <Punktetafel
          history={view.view.history}
          seats={seats}
          scores={view.view.scores}
          nameOf={nameOf}
          onClose={() => setZeigeTafel(false)}
        />
      )}

      {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}

      {zeigeLetzten && runde?.lastTrick && (
        <LetzterStich
          played={runde.lastTrick.played}
          winnerSeat={runde.lastTrick.winnerSeat}
          nameOf={nameOf}
          deck={deck}
          onClose={() => setZeigeLetzten(false)}
        />
      )}

      {table?.paused && (
        <div className="doko-sheet doko-sheet--pause">
          <div className="doko-sheet-card">
            <h2>Tisch pausiert</h2>
            <p className="muted">
              Der Zugtimer steht still. Jeder am Tisch kann fortsetzen — ideal für
              Clantische über mehrere Abende.
            </p>
            {view.seat !== null && (
              <button className="primary" disabled={pauseBusy} onClick={togglePause}>
                Fortsetzen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kopfzeile und eigene Lage
// ---------------------------------------------------------------------------

/** Was gerade laeuft: Handgroesse, Trumpf und wie viel angesagt ist. */
function rundenzeile(runde: WizardRoundView | null): string {
  if (!runde) return 'Zwischen den Runden';

  const karten = `${runde.handSize} ${runde.handSize === 1 ? 'Karte' : 'Karten'}`;
  const trumpf = runde.trump ? `Trumpf ${suitName(runde.trump)}` : 'ohne Trumpf';

  if (runde.phase === 'trump') return `${karten} · Trumpf wird bestimmt`;
  if (runde.phase === 'bidding') return `${karten} · ${trumpf} · Ansagen`;

  // Im Spiel ist die Summe der Ansagen die wichtigste Zahl am Tisch: Sie sagt,
  // ob die Stiche knapp sind oder ueberzaehlig.
  const summe = runde.bidTotal;
  const lage =
    summe === null
      ? ''
      : ` · ${summe} auf ${runde.handSize}${summe > runde.handSize ? ' (knapp)' : summe < runde.handSize ? ' (frei)' : ''}`;
  return `${karten} · ${trumpf}${lage}`;
}

function eigeneLage(runde: WizardRoundView | null, seat: number | null): string {
  if (seat === null) return 'Zuschauer';
  if (!runde) return 'Deine Karten';
  const gebot = runde.bids[seat];
  if (gebot === undefined) return 'Noch nicht angesagt';
  const stiche = runde.tricks[seat] ?? 0;
  const fehlt = gebot - stiche;
  const zusatz =
    fehlt > 0 ? `noch ${fehlt}` : fehlt === 0 ? 'genau richtig' : `${-fehlt} zu viel`;
  return `Gebot ${gebot} · ${stiche} ${stiche === 1 ? 'Stich' : 'Stiche'} · ${zusatz}`;
}

// ---------------------------------------------------------------------------
// Tisch
// ---------------------------------------------------------------------------

function TrumpfPlakette({
  runde,
  deck,
}: {
  runde: WizardRoundView | null;
  deck: Deck;
}): React.JSX.Element | null {
  if (!runde) return null;

  return (
    <div className="wiz-trumpf">
      {runde.upcard ? (
        <div className="pc pc--trick">
          <CardFront card={runde.upcard} deck={deck} />
        </div>
      ) : (
        <div className="wiz-trumpf-leer" aria-hidden="true">
          —
        </div>
      )}
      <span className="wiz-trumpf-text">
        {runde.trump ? (
          <>
            Trumpf <b>{suitSymbol(runde.trump)}</b>
          </>
        ) : (
          'kein Trumpf'
        )}
      </span>
    </div>
  );
}

function GegnerSitz({
  slot,
  name,
  accountId,
  onShowProfile,
  seatIndex,
  isBot,
  hasLeft,
  botTakeover,
  count,
  offeneKarten,
  score,
  gebot,
  stiche,
  active,
  leader,
  geber,
  deadline,
  avatarUrl,
  deck,
}: {
  slot: string;
  name: string;
  accountId: string | null;
  onShowProfile: (accountId: string) => void;
  seatIndex: number;
  isBot: boolean;
  hasLeft: boolean;
  botTakeover: boolean;
  count: number;
  /** In der blinden Runde liegen die Karten der anderen offen. */
  offeneKarten: Card[] | null;
  score: number;
  gebot: number | null;
  stiche: number;
  active: boolean;
  leader: boolean;
  geber: boolean;
  deadline: number | null;
  avatarUrl: string | null;
  deck: Deck;
}): React.JSX.Element {
  const vertical = istSeitlich(slot as never);

  return (
    <div className={`doko-opp at-${slot}${active ? ' is-active' : ''}`}>
      <Avatar
        name={name}
        seatIndex={seatIndex}
        active={active}
        deadline={deadline}
        isBot={isBot}
        avatarUrl={avatarUrl}
      />
      <div className="doko-opp-name">
        {accountId && !isBot ? (
          <button className="spielername" onClick={() => onShowProfile(accountId)}>
            {name}
          </button>
        ) : (
          <span>{isBot ? `Bot ${seatIndex + 1}` : name}</span>
        )}
        {geber && <em className="doko-tag">Geber</em>}
        {leader && <em className="doko-tag doko-tag--lead">Aufspiel</em>}
        {hasLeft && <em className="doko-tag">ausgestiegen</em>}
        {!hasLeft && botTakeover && !isBot && <em className="doko-tag">Bot übernimmt</em>}
      </div>

      {/* Gebot und Stiche gehoeren an den Sitz. Beides ist oeffentlich, und
          ohne diese Zahlen laesst sich keine Karte beurteilen. */}
      <span className={`wiz-gebot${gebot !== null && stiche === gebot ? ' is-genau' : ''}`}>
        {gebot === null ? '–' : gebot}
        <i>/</i>
        {stiche}
      </span>

      {offeneKarten ? (
        <div className="doko-backs wiz-offen">
          {offeneKarten.map((card) => (
            <div className="pc pc--back" key={card.id}>
              <CardFront card={card} deck={deck} />
            </div>
          ))}
        </div>
      ) : (
        <Ruecken count={count} vertical={vertical} deck={deck} />
      )}
      <span className="doko-opp-score">{score}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entscheidungen
// ---------------------------------------------------------------------------

/**
 * Die Ansage als Blatt von unten.
 *
 * Die Zahlen kommen aus `legalActions` - fehlt eine, ist sie verboten (die
 * Hausregel "Es darf nicht aufgehen"). Sie wird trotzdem gezeigt, nur gesperrt
 * und mit Grund: Eine Zahl, die kommentarlos fehlt, sieht aus wie ein Fehler.
 */
function Gebotsblatt({
  handSize,
  erlaubt,
  bids,
  bidTotal,
  verdeckt,
  nameOf,
  onSend,
}: {
  handSize: number;
  erlaubt: Action[];
  bids: Record<number, number>;
  bidTotal: number | null;
  verdeckt: boolean;
  nameOf: (seat: number) => string;
  onSend: (action: Action) => void;
}): React.JSX.Element {
  const [wahl, setWahl] = useState<number | null>(null);
  const [gesendet, setGesendet] = useState(false);

  // Weist der Server die Ansage ab, wird der Knopf nach kurzer Zeit wieder
  // frei, statt fuer immer tot zu sein.
  useEffect(() => {
    if (!gesendet) return;
    const handle = setTimeout(() => setGesendet(false), 3000);
    return () => clearTimeout(handle);
  }, [gesendet]);

  const moeglich = new Set(erlaubt.map((action) => action.tricks as number));
  const bisher = Object.entries(bids);

  return (
    <div className="doko-sheet doko-sheet--mitte">
      <div className="doko-sheet-card">
        <h2>Wie viele Stiche machst du?</h2>
        <p className="muted">
          {verdeckt
            ? 'Verdeckt angesagt: Die anderen Zahlen siehst du erst, wenn alle angesagt haben.'
            : bisher.length === 0
              ? `${handSize} ${handSize === 1 ? 'Stich' : 'Stiche'} sind zu vergeben. Du sagst zuerst an.`
              : `Bisher angesagt: ${bisher
                  .map(([seat, bid]) => `${nameOf(Number(seat))} ${bid}`)
                  .join(' · ')}${bidTotal !== null ? ` — Summe ${bidTotal} von ${handSize}` : ''}`}
        </p>

        <div className="wiz-gebote">
          {Array.from({ length: handSize + 1 }, (_, zahl) => {
            const geht = moeglich.has(zahl);
            return (
              <button
                key={zahl}
                className={`wiz-gebot-chip${wahl === zahl ? ' is-an' : ''}${geht ? '' : ' is-aus'}`}
                aria-pressed={wahl === zahl}
                disabled={!geht}
                title={geht ? undefined : 'Damit ginge die Summe auf'}
                onClick={() => setWahl(zahl)}
              >
                {zahl}
              </button>
            );
          })}
        </div>

        <button
          className="primary"
          disabled={wahl === null || gesendet}
          onClick={() => {
            const action = erlaubt.find((a) => a.tricks === wahl);
            if (!action) return;
            setGesendet(true);
            onSend(action);
          }}
        >
          {gesendet ? 'Wird angesagt…' : wahl === null ? 'Zahl wählen' : `${wahl} ansagen`}
        </button>
      </div>
    </div>
  );
}

/** Der Geber nennt die Trumpffarbe, weil ein Zauberer aufgedeckt wurde. */
function Trumpfwahl({
  actions,
  onSend,
}: {
  actions: Action[];
  onSend: (action: Action) => void;
}): React.JSX.Element {
  const [gesendet, setGesendet] = useState(false);

  useEffect(() => {
    if (!gesendet) return;
    const handle = setTimeout(() => setGesendet(false), 3000);
    return () => clearTimeout(handle);
  }, [gesendet]);

  return (
    <div className="doko-sheet doko-sheet--mitte">
      <div className="doko-sheet-card">
        <h2>Du bestimmst den Trumpf</h2>
        <p className="muted">Aufgedeckt wurde ein Zauberer — du wählst die Farbe.</p>
        <div className="wiz-farben">
          {actions.map((action) => {
            const suit = String(action.suit);
            return (
              <button
                key={suit}
                className={`wiz-farbe${suit === 'H' || suit === 'D' ? ' is-rot' : ''}`}
                disabled={gesendet}
                onClick={() => {
                  setGesendet(true);
                  onSend(action);
                }}
              >
                <span aria-hidden="true">{suitSymbol(suit)}</span>
                {suitName(suit)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Abrechnung
// ---------------------------------------------------------------------------

/**
 * Die Runde in einem Blatt: Gebot, Stiche, Punkte, Gesamtstand.
 *
 * Bei zehn bis zwanzig Runden ist das der Ort, an dem eine Partie
 * nachvollziehbar bleibt. Nach zehn Sekunden geht es von selbst weiter - ein
 * abgelenkter Mitspieler soll die anderen nicht aufhalten.
 */
function Rundenblatt({
  runde,
  seats,
  nameOf,
  onClose,
}: {
  runde: WizardRoundSummary;
  seats: number[];
  nameOf: (seat: number) => string;
  onClose: () => void;
}): React.JSX.Element {
  useEffect(() => {
    const handle = setTimeout(onClose, ABRECHNUNG_MS);
    return () => clearTimeout(handle);
  }, [onClose, runde.roundIndex]);

  const sortiert = [...seats].sort((a, b) => (runde.totals[b] ?? 0) - (runde.totals[a] ?? 0));

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(event) => event.stopPropagation()}>
        <h2>Runde {runde.roundNumber} abgerechnet</h2>
        <p className="muted">
          {runde.roundNumber} {runde.roundNumber === 1 ? 'Karte' : 'Karten'} ·{' '}
          {runde.trump ? `Trumpf ${suitName(runde.trump)}` : 'ohne Trumpf'}
        </p>
        <table className="wiz-tabelle">
          <thead>
            <tr>
              <th>Spieler</th>
              <th>Gebot</th>
              <th>Stiche</th>
              <th>Punkte</th>
              <th>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {sortiert.map((seat) => {
              const punkte = runde.scores[seat] ?? 0;
              return (
                <tr key={seat} className={punkte > 0 ? 'is-treffer' : undefined}>
                  <td>{nameOf(seat)}</td>
                  <td>{runde.bids[seat] ?? '–'}</td>
                  <td>{runde.tricks[seat] ?? 0}</td>
                  <td className={punkte < 0 ? 'is-minus' : undefined}>
                    {punkte > 0 ? `+${punkte}` : punkte}
                  </td>
                  <td>
                    <b>{runde.totals[seat] ?? 0}</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="primary" onClick={onClose}>
          Weiter
        </button>
      </div>
    </div>
  );
}

/** Alle Runden auf einen Blick: Gebot/Stiche je Runde, Gesamtstand unten. */
function Punktetafel({
  history,
  seats,
  scores,
  nameOf,
  onClose,
}: {
  history: WizardRoundSummary[];
  seats: number[];
  scores: Record<number, number>;
  nameOf: (seat: number) => string;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(event) => event.stopPropagation()}>
        <h2>Punktetafel</h2>
        {history.length === 0 ? (
          <p className="muted">Noch keine Runde abgerechnet.</p>
        ) : (
          <div className="wiz-tafel-rolle">
            <table className="wiz-tabelle wiz-tafel">
              <thead>
                <tr>
                  <th>Rd.</th>
                  {seats.map((seat) => (
                    <th key={seat}>{nameOf(seat)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((runde) => (
                  <tr key={runde.roundIndex}>
                    <td>{runde.roundNumber}</td>
                    {seats.map((seat) => {
                      const treffer = (runde.scores[seat] ?? 0) > 0;
                      return (
                        <td key={seat} className={treffer ? 'is-treffer' : 'is-minus'}>
                          {/* Gebot und Stiche nebeneinander: Daran sieht man,
                              woher die Punkte kommen. */}
                          <span className="wiz-zelle">
                            {runde.bids[seat] ?? '–'}/{runde.tricks[seat] ?? 0}
                          </span>
                          <b>{runde.totals[seat] ?? 0}</b>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Σ</td>
                  {seats.map((seat) => (
                    <td key={seat}>
                      <b>{scores[seat] ?? 0}</b>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}
