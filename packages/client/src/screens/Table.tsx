import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardBack, CardFront } from '../CardFace';
import {
  DealCeremony,
  isVollesGeben,
  prefersReducedMotion,
  type DealSlot,
} from '../DealCeremony';
import { regelBild } from '../regelbilder';
import { sortByOrder } from '../cardsort';
import type { Deck } from '../decks';
import { gameTypeLabel, t } from '../i18n';
import type { Action, Card } from '../protocol';
import { useCountdown, useTable } from '../useTable';

const TURN_SECONDS = 60;

/** Grenzen der Tischgroesse: klein genug fuer die Uebersicht, gross genug,
    dass die Karten nicht aus dem Faecher wachsen. */
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.45;
const ZOOM_STEP = 0.15;

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
  const { view, party, table, error, connected, send, addBot, removeBot } = useTable(tableId);

  // Tischgroesse: skaliert Hand- und Stichkarten. Am Geraet gespeichert, weil
  // sie von Augen und Bildschirm abhaengt, nicht vom Konto.
  const [zoom, setZoom] = useState<number>(() => {
    const raw = Number(localStorage.getItem('tischZoom'));
    return raw >= ZOOM_MIN && raw <= ZOOM_MAX ? raw : 1;
  });
  const changeZoom = (delta: number): void => {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom + delta)) * 100) / 100;
    setZoom(next);
    localStorage.setItem('tischZoom', String(next));
  };

  /**
   * Bot-Knoepfe, auf die der Tisch noch nicht geantwortet hat. Der Klick geht
   * ueber den WebSocket; bis die neue Tischnachricht eintrifft, zeigt der
   * Knopf einen Kreisel statt gar nichts - sonst tippt man doppelt.
   */
  const [botBusy, setBotBusy] = useState<Record<number, 'add' | 'remove'>>({});

  /** Blatt mit den Tischregeln, aufklappbar im Wartebereich und in der Runde. */
  const [zeigeRegeln, setZeigeRegeln] = useState(false);
  const [zeigeLetzten, setZeigeLetzten] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);

  const togglePause = (): void => {
    if (!table || pauseBusy) return;
    setPauseBusy(true);
    const call = table.paused ? api.resumeTable(tableId) : api.pauseTable(tableId);
    void call
      .catch(() => undefined)
      .finally(() => setPauseBusy(false));
  };

  /** Stabile Referenz, damit memoisierte Handkarten nicht mitrendern. */
  const playCard = useCallback(
    (cardId: number) => send({ type: 'playCard', seat: view?.seat ?? 0, cardId }),
    [send, view?.seat],
  );

  // Der volle Stich bleibt eine Sekunde liegen, bevor er abgeraeumt wird.
  // Der Server raeumt sofort (currentTrick leer, lastTrick gefuellt); hier
  // wird der letzte Stich kurz weitergezeigt. seenKey verhindert das
  // Aufblitzen beim Beitritt mitten in einer Runde.
  const lastTrickNow = view?.view.round?.lastTrick ?? null;
  const lastKey = lastTrickNow
    ? lastTrickNow.played.map((p) => p.card.id).join('.')
    : null;
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
      const handle = setTimeout(
        () => setFrozenKey((k) => (k === lastKey ? null : k)),
        1000,
      );
      return () => clearTimeout(handle);
    }
  }, [lastKey]);

  /**
   * Misch-/Austeilzeremonie: genau einmal nach einem vollen Geben
   * (48 Karten mit Neunen, 40 ohne) in der Vorbehaltsphase — nicht nach
   * einzelnen Karten, nicht bei Armut/Stich. Erster Snapshot (Beitritt
   * mitten in der Runde) wird uebersprungen.
   */
  const geben = isVollesGeben(
    view?.view.round?.phase,
    view?.view.round?.handCounts,
    view?.view.round?.currentTrick?.length ?? 0,
  );
  const dealKey = geben.ok
    ? `${view!.view.roundIndex}:${geben.deckSize}:${view!.view.round!.hand
        .map((c) => c.id)
        .slice()
        .sort((a, b) => a - b)
        .join('.')}`
    : null;
  const seenDeal = useRef<string | null | undefined>(undefined);
  const [dealing, setDealing] = useState(false);
  const [dealDeckSize, setDealDeckSize] = useState(48);
  const [handJustDealt, setHandJustDealt] = useState(false);
  const endDeal = useCallback(() => {
    setDealing(false);
    setHandJustDealt(true);
    window.setTimeout(() => setHandJustDealt(false), 450);
  }, []);
  useEffect(() => {
    if (!dealKey) {
      // Mitten in der Runde beigetreten: vormerken, ohne zu animieren.
      if (seenDeal.current === undefined && view?.view.round) {
        seenDeal.current = null;
      }
      return;
    }
    if (dealKey === seenDeal.current) return;
    seenDeal.current = dealKey;
    if (prefersReducedMotion()) return;
    setDealDeckSize(geben.deckSize);
    setDealing(true);
  }, [dealKey, geben.deckSize, view?.view.round]);

  useEffect(() => {
    if (!table) return;
    setBotBusy((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [key, kind] of Object.entries(prev)) {
        const seat = table.seats.find((s) => s.seat === Number(key));
        if (!seat) continue;
        if ((kind === 'add' && seat.isBot) || (kind === 'remove' && !seat.isBot)) {
          delete next[Number(key)];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [table]);

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
          {/* Zurueck aus dem Wartebereich gibt den Platz frei - sonst bleibt
              ein Geistertisch in der Lobby stehen. Schlaegt die Meldung fehl,
              raeumt der Server den Tisch spaeter selbst ab. */}
          <button
            className="doko-icon"
            onClick={() => {
              void api.leaveTable(tableId).catch(() => undefined);
              onLeave();
            }}
            aria-label="Zurück"
          >
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
          <div className="doko-top-right">
            <button
              className="doko-icon"
              onClick={() => setZeigeRegeln(true)}
              aria-label="Tischregeln ansehen"
            >
              §
            </button>
          </div>
        </header>
        <div className="doko-wait">
          {table.seats.map((seat) => (
            <div
              className={`doko-wait-seat${seat.displayName || seat.isBot ? '' : ' is-empty'}`}
              key={seat.seat}
            >
              <Avatar
                name={seat.displayName ?? (seat.isBot ? 'Bot' : 'frei')}
                seatIndex={seat.seat}
                active={false}
                deadline={null}
                isBot={seat.isBot}
                avatarUrl={seat.avatarUrl}
              />
              {/* Name als Weg zum Profil, wo ein Konto dahintersteht; freie
                  Plaetze und Bots bleiben Text. */}
              <div className="doko-wait-name">
                {seat.displayName
                  ? spielerName(seat.displayName, seat.accountId)
                  : seat.isBot
                    ? `Bot ${seat.seat + 1}`
                    : 'frei'}
              </div>
              {/* Freie Plaetze mit einem Bot fuellen, gesetzte Bots freigeben —
                  direkt am Tisch, ohne Vorab-Entscheidung. */}
              {!seat.displayName && !seat.isBot && (
                <button
                  className="doko-seat-btn"
                  disabled={!!botBusy[seat.seat]}
                  onClick={() => {
                    setBotBusy((b) => ({ ...b, [seat.seat]: 'add' }));
                    addBot(seat.seat);
                  }}
                >
                  {botBusy[seat.seat] ? (
                    <span className="doko-btn-spinner" aria-label="Bot setzt sich…" />
                  ) : (
                    '+ Bot'
                  )}
                </button>
              )}
              {!seat.displayName && seat.isBot && (
                <button
                  className="doko-seat-btn"
                  disabled={!!botBusy[seat.seat]}
                  onClick={() => {
                    setBotBusy((b) => ({ ...b, [seat.seat]: 'remove' }));
                    removeBot(seat.seat);
                  }}
                >
                  {botBusy[seat.seat] ? (
                    <span className="doko-btn-spinner" aria-label="Bot steht auf…" />
                  ) : (
                    'entfernen'
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="muted doko-wait-hint">
          Teile die Adresse dieser Seite, dann können andere direkt beitreten — oder
          fülle freie Plätze mit Bots. Sobald alle Plätze belegt sind, geht es los.
        </p>
        {error && <p className="doko-error">{t(error)}</p>}
        {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}
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
  const avatarOf = (seat: number): string | null => seatInfo(seat)?.avatarUrl ?? null;

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

  // Die Vorbehaltsabfrage ist ein eigener Dialog (gesund ja/nein, dann
  // Auswahl, dann Bestaetigung) - keine Knopfreihe am unteren Rand, auf der
  // ein Fehltipp eine ganze Runde entscheidet.
  const vorbehaltActions = otherActions.filter((action) => action.type === 'vorbehalt');
  const rowActions = otherActions.filter((action) => action.type !== 'vorbehalt');

  const opponents = Array.from({ length: seatCount }, (_, s) => s).filter(
    (s) => view.seat === null || s !== view.seat,
  );

  const hand = round ? sortByOrder(round.hand, round.order) : [];
  const dealSlots: DealSlot[] = LAYOUTS[seatCount] ?? ['bottom', 'left', 'top', 'right'];
  const liveTrick = round?.currentTrick ?? [];
  // Frisch voller Stich: eine Sekunde liegen lassen — auch dann, wenn der
  // naechste Spieler schon die erste Karte des neuen Stichs gelegt hat. Ohne
  // diese Haerte raeumte der erste schnelle Bot den Stich sofort wieder ab.
  const frozenActive = frozenKey !== null && frozenKey === lastKey && lastTrickNow !== null;
  const trick = frozenActive ? lastTrickNow!.played : liveTrick;
  const phaseText = round ? t(`phase.${round.phase}`) : 'Zwischen den Runden';
  const showHands = !dealing;

  // Aufspiel: wer den Stich anspielt. Laeuft ein Stich, ist es, wer die erste
  // Karte gelegt hat; ist er leer, der, der gerade herauskommt.
  const leaderSeat = trick.length > 0 ? trick[0]!.seat : view.currentActor;

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
    <div className="doko" style={{ '--zoom': zoom } as React.CSSProperties}>
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
          {table?.paused && <span className="doko-badge doko-badge--pause">Pausiert</span>}
          {view.seat === null && <span className="doko-badge">Zuschauer</span>}
          {table?.visibility === 'club_only' && view.seat !== null && (
            <button
              className="doko-icon"
              onClick={togglePause}
              disabled={pauseBusy}
              aria-label={table.paused ? 'Tisch fortsetzen' : 'Tisch pausieren'}
              title={table.paused ? 'Fortsetzen' : 'Pausieren'}
            >
              {table.paused ? '▶' : '❚❚'}
            </button>
          )}
          <button
            className="doko-icon"
            onClick={() => setZeigeLetzten(true)}
            disabled={!round?.lastTrick}
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

      {/* Spielfläche. Namen fuehren auch hier zum Profil - Zurueck bringt
          einen an den Tisch zurueck, die Partie laeuft derweil weiter. */}
      <div className={`doko-felt seats-${seatCount}`}>
        {opponents.map((seat) => (
          <OpponentSeat
            key={seat}
            slot={slotFor(seat, base, seatCount)}
            name={nameOf(seat)}
            accountId={seatInfo(seat)?.accountId ?? null}
            onShowProfile={onShowProfile}
            seatIndex={seat}
            isBot={isBotSeat(seat)}
            hasLeft={view.leftSeats.includes(seat)}
            botTakeover={view.botSeats.includes(seat) && !view.leftSeats.includes(seat)}
            count={showHands ? (round?.handCounts[seat] ?? 0) : 0}
            score={view.view.scores[seat] ?? 0}
            active={view.currentActor === seat}
            leader={leaderSeat === seat}
            deadline={view.currentActor === seat ? view.turnDeadline : null}
            party={round?.knownParties?.[seat] ?? null}
            tricksWon={round?.trickCounts?.[seat] ?? 0}
            avatarUrl={avatarOf(seat)}
            deck={deck}
          />
        ))}

        {/* Partei- und Ansagetafel ueber dem Stich: Woran man ist, muss man
            am Tisch ablesen koennen und nicht erst erinnern. */}
        {round?.myParty && (
          <div className="doko-tafel doko-tafel--partei">
            {ansageText(round) && <strong>{ansageText(round)}</strong>}
            <span>Wir spielen: {partyLabel(round.myParty)}</span>
          </div>
        )}

        {/* Stich in der Mitte */}
        <div className="doko-trick">
          {!dealing && trick.length === 0 && <span className="doko-trick-hint">{phaseText}</span>}
          {!dealing &&
            trick.map((played) => (
              <div
                key={played.card.id}
                className={`doko-trick-card at-${slotFor(played.seat, base, seatCount)}`}
              >
                {/* Innerer Wrapper traegt die Legeanimation, damit die Platzierung
                  (aeusseres Element) davon unberuehrt bleibt. */}
                <div className="doko-trick-in">
                  <div className="pc pc--trick">
                    <CardFront card={played.card} deck={deck} />
                  </div>
                </div>
              </div>
            ))}
        </div>

        {dealing && (
          <DealCeremony
            slots={dealSlots}
            deckSize={dealDeckSize}
            deck={deck}
            onDone={endDeal}
          />
        )}

        {/* Spielart unter dem Stich. Im Herz-Solo ist die Herz-Neun Trumpf,
            im Normalspiel eine Fehlkarte - wer das nicht sieht, haelt einen
            regelkonformen Bedienzwang fuer einen Fehler. */}
        {round && round.phase !== 'vorbehalt' && (
          <div className="doko-tafel doko-tafel--spielart">
            <span className="muted">Es läuft</span>
            <strong>
              {gameTypeLabel(round.gameType)}
              {soloName ? ` · ${soloName}` : ''}
            </strong>
          </div>
        )}

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

      {/* Ansagen und Armut-Antworten bleiben eine Knopfreihe */}
      {rowActions.length > 0 && !round?.pendingPflichtansage && (
        <div className="doko-actions">
          {rowActions.map((action, index) => (
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

      {/* Vorbehaltsabfrage als Dialog mit Bestaetigung — erst nach dem Geben. */}
      {vorbehaltActions.length > 0 && !round?.pendingPflichtansage && !dealing && (
        <VorbehaltDialog actions={vorbehaltActions} onSend={send} />
      )}

      {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}

      {zeigeLetzten && round?.lastTrick && (
        <LetzterStich
          played={round.lastTrick.played}
          winnerSeat={round.lastTrick.winnerSeat}
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

      {/* Eigener Bereich: Name, Partei, Hand */}
      <div className="doko-me">
        <Avatar
          name={view.seat === null ? 'Du' : nameOf(view.seat)}
          seatIndex={view.seat ?? 0}
          active={view.currentActor === view.seat}
          deadline={view.currentActor === view.seat ? view.turnDeadline : null}
          avatarUrl={view.seat === null ? null : avatarOf(view.seat)}
          you
        />
        <div className="doko-me-info">
          <strong>{view.seat === null ? 'Zuschauer' : nameOf(view.seat)}</strong>
          <span className="muted">
            {round?.myParty ? partyLabel(round.myParty) : 'Deine Karten'}
            {/* Zaehlhilfe: eigene Augen, nur wenn die Tischregel sie erlaubt -
                dann liefert der Server die Staende, sonst bleiben sie leer. */}
            {view.seat !== null && round?.standings[view.seat] !== undefined
              ? ` · ${round.standings[view.seat]} Augen`
              : ''}
            {view.seat !== null && leaderSeat === view.seat && ' · Aufspiel'}
          </span>
        </div>
        {view.seat !== null && (
          <StichStapel count={round?.trickCounts?.[view.seat] ?? 0} />
        )}
        {view.currentActor === view.seat && view.turnDeadline !== null && (
          <TurnClock deadline={view.turnDeadline} />
        )}
      </div>

      {view.seat !== null && (
        <div className={`doko-hand${dealing ? ' is-dealing' : ''}${handJustDealt ? ' is-dealt' : ''}`}>
          {showHands &&
            hand.map((card, index) => (
              <HandCard
                key={card.id}
                card={card}
                deck={deck}
                index={index}
                total={hand.length}
                playable={playable.has(card.id)}
                trump={isTrump(card)}
                onPlay={playCard}
              />
            ))}
          {showHands && hand.length === 0 && (
            <span className="muted">Keine Karten auf der Hand.</span>
          )}
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

/**
 * Der Countdown tickt bewusst HIER und nicht am Tisch: Ein Timer an der
 * Wurzel rendert fuenfmal pro Sekunde den kompletten Tisch neu — genau das
 * machte jede Animation ruckelig. So tickt nur der eine aktive Avatar.
 */
function Avatar({
  name,
  seatIndex,
  active,
  deadline,
  isBot,
  you,
  avatarUrl,
}: {
  name: string;
  seatIndex: number;
  active: boolean;
  deadline: number | null;
  isBot?: boolean;
  you?: boolean;
  avatarUrl?: string | null;
}): React.JSX.Element {
  const secondsLeft = useCountdown(active ? deadline : null);
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
      {avatarUrl ? (
        <img className="doko-avatar-img" src={avatarUrl} alt={name} draggable={false} />
      ) : isBot ? (
        <span style={{ background: `hsl(${hue} 45% 32%)` }}>BOT</span>
      ) : (
        /* Ohne eigenes Bild sitzt der Pinguin am Tisch - er ist unser
           Maskottchen, und vier Buchstabenkreise wirken wie ein Formular. */
        <img className="doko-avatar-img" src="/hub/pinguin.png" alt={name} draggable={false} />
      )}
    </div>
  );
}

const OpponentSeat = memo(function OpponentSeat({
  slot,
  name,
  accountId,
  onShowProfile,
  seatIndex,
  isBot,
  hasLeft,
  botTakeover,
  count,
  score,
  active,
  leader,
  deadline,
  party,
  tricksWon,
  avatarUrl,
  deck,
}: {
  slot: Slot;
  name: string;
  accountId: string | null;
  onShowProfile: (accountId: string) => void;
  seatIndex: number;
  isBot: boolean;
  hasLeft: boolean;
  botTakeover: boolean;
  count: number;
  score: number;
  active: boolean;
  leader: boolean;
  deadline: number | null;
  party: string | null;
  tricksWon: number;
  avatarUrl: string | null;
  deck: Deck;
}): React.JSX.Element {
  const vertical = slot === 'left' || slot === 'right';
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
        {/* Der Name fuehrt zum Profil, wo ein Konto dahintersteht. Bots
            bleiben Text - sie haben keins. */}
        {accountId && !isBot ? (
          <button className="spielername" onClick={() => onShowProfile(accountId)}>
            {name}
          </button>
        ) : (
          <span>{isBot ? `Bot ${seatIndex + 1}` : name}</span>
        )}
        {leader && <em className="doko-tag doko-tag--lead">Aufspiel</em>}
        {party && <em className={`doko-party doko-party--${party}`}>{partyLabel(party)}</em>}
        {hasLeft && <em className="doko-tag">ausgestiegen</em>}
        {!hasLeft && botTakeover && !isBot && <em className="doko-tag">Bot übernimmt</em>}
      </div>
      {/* Genau so viele verdeckte Karten, wie der Spieler haelt. Links und
          rechts liegen sie quer (siehe CSS is-vertical). */}
      <div className={`doko-backs${vertical ? ' is-vertical' : ''}`}>
        {Array.from({ length: count }, (_, i) => (
          <div className={`pc pc--back${vertical ? ' side' : ''}`} key={i}>
            <CardBack deck={deck} />
          </div>
        ))}
      </div>
      <span className="doko-opp-score">{score}</span>
      <StichStapel count={tricksWon} />
    </div>
  );
});

/**
 * Der gewonnene Stichstapel neben dem Spieler: ein kleines Haeufchen
 * verdeckter Karten, wie am echten Tisch, mit der Anzahl daran.
 */
function StichStapel({ count }: { count: number }): React.JSX.Element | null {
  if (count <= 0) return null;
  const shown = Math.min(count, 3);
  return (
    <span className="doko-stiche" aria-label={`${count} Stiche gewonnen`}>
      {Array.from({ length: shown }, (_, i) => (
        <i key={i} />
      ))}
      <b>{count}</b>
    </span>
  );
}

/**
 * Hoechste Ansage am Tisch, als kurzer Text.
 *
 * Die Absagestufen bauen aufeinander auf, also zaehlt immer nur die
 * hoechste. Ohne Ansage bleibt die Tafel leer statt "keine Ansage" zu
 * behaupten - das waere eine Aussage, die sich noch aendern kann.
 */
function ansageText(round: {
  announcements: { re: boolean; kontra: boolean; reAbsage: number; kontraAbsage: number };
}): string | null {
  const stufen = ['Keine 90', 'Keine 60', 'Keine 30', 'Schwarz'];
  const teile: string[] = [];
  if (round.announcements.re) {
    const absage = round.announcements.reAbsage;
    teile.push(absage > 0 ? `Re · ${stufen[absage - 1] ?? ''}`.trim() : 'Re');
  }
  if (round.announcements.kontra) {
    const absage = round.announcements.kontraAbsage;
    teile.push(absage > 0 ? `Kontra · ${stufen[absage - 1] ?? ''}`.trim() : 'Kontra');
  }
  return teile.length > 0 ? teile.join('  ·  ') : null;
}

function partyLabel(party: string): string {
  return party === 're' ? 'Re' : 'Kontra';
}

// ---------------------------------------------------------------------------
// Hand
// ---------------------------------------------------------------------------

const HandCard = memo(function HandCard({
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
  onPlay: (cardId: number) => void;
}): React.JSX.Element {
  // Nicht spielbare Karten sehen aus wie alle anderen - keine Hervorhebung,
  // kein Abdunkeln. Wer eine antippt, bekommt ein kurzes Schuetteln als
  // Antwort: die Karte bleibt liegen, die Hand bleibt lesbar.
  const [shaking, setShaking] = useState(false);

  // Sanfter Faecher: die mittleren Karten stehen etwas hoeher, die aeusseren
  // sind leicht gekippt. Bei vielen Karten faellt beides schwaecher aus, damit
  // zwoelf Blatt auf ein Handy passen.
  const mid = (total - 1) / 2;
  const off = index - mid;
  const rot = off * Math.min(3.2, 22 / Math.max(total, 1));
  const dip = Math.pow(Math.abs(off), 1.6) * (total > 7 ? 1.1 : 2.2);

  // Position, Senkung und Neigung als CSS-Variablen: Die Karte steht absolut
  // in der Mitte, das Stylesheet setzt daraus den transform zusammen. Faellt
  // eine Karte aus der Hand, GLEITEN die uebrigen auf ihre neuen Plaetze
  // (Compositor-Uebergang) statt per Layout-Sprung umzubrechen.
  const vars = {
    '--off': off,
    '--dip': dip,
    '--rot': rot,
    zIndex: playable ? 100 + index : index,
  } as React.CSSProperties;

  return (
    <button
      className={`doko-handcard${playable ? ' is-playable' : ''}${trump ? ' is-trump' : ''}${shaking ? ' is-shake' : ''}`}
      style={vars}
      // Nicht disabled: Der Tipp auf eine unspielbare Karte soll ankommen und
      // das Schuetteln ausloesen, statt lautlos zu versanden.
      aria-disabled={!playable}
      onClick={() => {
        if (playable) onPlay(card.id);
        else setShaking(true);
      }}
      onAnimationEnd={() => setShaking(false)}
      aria-label={trump ? 'Trumpf' : undefined}
    >
      <div className="pc pc--hand">
        <CardFront card={card} deck={deck} />
        {trump && <span className="doko-trump-bar" aria-hidden="true" />}
      </div>
    </button>
  );
});

/** Der letzte Stich zum Nachschauen — fuer alle am Tisch, auch Zuschauer. */
function LetzterStich({
  played,
  winnerSeat,
  nameOf,
  deck,
  onClose,
}: {
  played: { seat: number; card: Card }[];
  winnerSeat: number;
  nameOf: (seat: number) => string;
  deck: Deck;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(e) => e.stopPropagation()}>
        <h2>Letzter Stich</h2>
        <p className="muted">Ging an {nameOf(winnerSeat)}.</p>
        <div className="doko-lasttrick">
          {played.map((p) => (
            <figure key={p.card.id} className={p.seat === winnerSeat ? 'is-winner' : undefined}>
              <div className="pc pc--trick">
                <CardFront card={p.card} deck={deck} />
              </div>
              <figcaption>{nameOf(p.seat)}</figcaption>
            </figure>
          ))}
        </div>
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

/** Restzeit-Anzeige. Tickt fuer sich allein, nicht der ganze Tisch mit. */
function TurnClock({ deadline }: { deadline: number | null }): React.JSX.Element | null {
  const secondsLeft = useCountdown(deadline);
  if (secondsLeft === null) return null;
  return <span className="doko-turnclock">{secondsLeft}s</span>;
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
    fleshless: 'Fleischlos',
  };
  // Unbekannte Art faellt auf das Spielart-Woerterbuch zurueck, notfalls auf
  // den rohen Schluessel - sichtbar haesslich statt unsichtbar kaputt.
  return map[solo] ?? t(`spielart.solo.${solo}`);
}

/**
 * Vorbehaltsabfrage als Dialog.
 *
 * Erst die einfache Frage (gesund ja/nein), bei Nein die Auswahl, und in
 * jedem Fall eine Bestaetigung: Ein einzelner Fehltipp darf keine ganze
 * Runde entscheiden. Wer vorgefuehrt wird, hat kein "gesund" - dann beginnt
 * der Dialog direkt bei der Auswahl.
 */
/** Doppelkopf-Symbole fuer die Vorbehalts-Kacheln. */
function VorbehaltIcon({ kind }: { kind: string }): React.JSX.Element {
  if (kind === 'hochzeit') {
    // Die Hochzeit: zwei Ringe — die beiden Kreuz-Damen auf einer Hand.
    return (
      <span className="vb-ico" aria-hidden="true">
        💍💍
      </span>
    );
  }
  if (kind === 'armut') {
    // Armut: drei verdeckte Truempfe, mehr sind es nicht.
    return (
      <span className="vb-armut" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  }
  if (kind === 'schmeiss') {
    return (
      <span className="vb-ico" aria-hidden="true">
        🔄
      </span>
    );
  }
  return (
    <span className="vb-ico" aria-hidden="true">
      🃏
    </span>
  );
}

/** Damen-/Buben-/Fleischlos-Solo als Kartenpaar-Symbol. */
function SoloIcon({ solo }: { solo: string }): React.JSX.Element {
  const letter = solo === 'queens' ? 'D' : solo === 'jacks' ? 'B' : 'A';
  return (
    <span className="vb-pair" aria-hidden="true">
      <i>{letter}</i>
      <i className="rot">{letter}</i>
    </span>
  );
}

function VorbehaltDialog({
  actions,
  onSend,
}: {
  actions: Action[];
  onSend: (action: Action) => void;
}): React.JSX.Element {
  const gesund = actions.find((action) => action.kind === null) ?? null;
  const vorbehalte = actions.filter((action) => action.kind !== null);

  // Farbsoli buendeln sich zu einer Kachel mit Unterauswahl der vier Farben;
  // alles andere ist eine eigene Kachel mit Doppelkopf-Symbol.
  const farbsoli = vorbehalte.filter(
    (a) => a.kind === 'solo' && String(a.solo).startsWith('suit'),
  );
  const andereSoli = vorbehalte.filter(
    (a) => a.kind === 'solo' && !String(a.solo).startsWith('suit'),
  );
  const sonstige = vorbehalte.filter((a) => a.kind !== 'solo');

  const [schritt, setSchritt] = useState<'frage' | 'auswahl' | 'bestaetigen'>(
    gesund ? 'frage' : 'auswahl',
  );
  const [zeigeFarben, setZeigeFarben] = useState(false);
  const [wahl, setWahl] = useState<Action | null>(null);
  const [gesendet, setGesendet] = useState(false);

  // Weist der Server die Aktion ab, bleibt der Dialog stehen; nach kurzer
  // Zeit wird der Knopf wieder frei, statt fuer immer tot zu sein.
  useEffect(() => {
    if (!gesendet) return;
    const handle = setTimeout(() => setGesendet(false), 3000);
    return () => clearTimeout(handle);
  }, [gesendet]);

  const bestaetigen = (action: Action): void => {
    setWahl(action);
    setSchritt('bestaetigen');
  };

  return (
    <div className="doko-sheet doko-sheet--mitte">
      <div className="doko-sheet-card">
        {schritt === 'frage' && gesund && (
          <>
            <h2>Bist du gesund?</h2>
            <div className="doko-sheet-row">
              <button className="primary" onClick={() => bestaetigen(gesund)}>
                ✓ Ja, gesund
              </button>
              {vorbehalte.length > 0 && (
                <button onClick={() => setSchritt('auswahl')}>Nein, Vorbehalt</button>
              )}
            </div>
          </>
        )}

        {schritt === 'auswahl' && (
          <>
            <h2>Dein Vorbehalt</h2>
            <div className="vb-grid">
              {sonstige.map((action, index) => (
                <button className="vb-tile" key={index} onClick={() => bestaetigen(action)}>
                  <VorbehaltIcon kind={String(action.kind)} />
                  <span>{actionLabel(action).replace(/^Solo: /, '')}</span>
                </button>
              ))}
              {farbsoli.length > 0 && (
                <button
                  className={`vb-tile${zeigeFarben ? ' is-open' : ''}`}
                  aria-expanded={zeigeFarben}
                  onClick={() => setZeigeFarben(!zeigeFarben)}
                >
                  <span className="vb-suits4" aria-hidden="true">
                    <b>♣</b>
                    <b>♠</b>
                    <b className="rot">♥</b>
                    <b className="rot">♦</b>
                  </span>
                  <span>Farbsolo {zeigeFarben ? '▴' : '▾'}</span>
                </button>
              )}
              {andereSoli.map((action, index) => (
                <button className="vb-tile" key={`s${index}`} onClick={() => bestaetigen(action)}>
                  <SoloIcon solo={String(action.solo)} />
                  <span>{soloLabel(String(action.solo))}</span>
                </button>
              ))}
            </div>
            {zeigeFarben && (
              <div className="vb-farben">
                {farbsoli.map((action, index) => {
                  const suit = String(action.solo).slice(4) as 'C' | 'S' | 'H' | 'D';
                  const rot = suit === 'H' || suit === 'D';
                  const glyph = { C: '♣', S: '♠', H: '♥', D: '♦' }[suit];
                  return (
                    <button
                      className="vb-farbe"
                      key={index}
                      onClick={() => bestaetigen(action)}
                    >
                      <b className={rot ? 'rot' : undefined}>{glyph}</b>
                      <span>{soloLabel(String(action.solo)).replace('-Solo', '')}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {gesund && (
              <button className="doko-sheet-zurueck" onClick={() => setSchritt('frage')}>
                Zurück
              </button>
            )}
          </>
        )}

        {schritt === 'bestaetigen' && wahl && (
          <>
            <h2>{actionLabel(wahl)} ansagen?</h2>
            <div className="doko-sheet-row">
              <button
                className="primary"
                disabled={gesendet}
                onClick={() => {
                  setGesendet(true);
                  onSend(wahl);
                }}
              >
                {gesendet ? 'Wird angesagt…' : 'Bestätigen'}
              </button>
              <button
                disabled={gesendet}
                onClick={() => setSchritt(wahl === gesund ? 'frage' : 'auswahl')}
              >
                Zurück
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Die Regeln des Tisches zum Nachlesen, im selben Kachelbild wie beim
 * Erstellen - nur ohne Schalter. Der Regelsatz ist auf die Version beim
 * Tischbau festgeschrieben, gezeigt wird also genau das, was gilt.
 */
function RegelBlatt({
  tableId,
  onClose,
}: {
  tableId: string;
  onClose: () => void;
}): React.JSX.Element {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    api
      .tableRules(tableId)
      .then((antwort) => setConfig(antwort.config))
      .catch(() => setFehler(true));
  }, [tableId]);

  const flags = config
    ? Object.entries(config).filter(([, value]) => typeof value === 'boolean')
    : [];
  const an = flags.filter(([, value]) => value).length;

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card" onClick={(event) => event.stopPropagation()}>
        <h2>Regeln an diesem Tisch</h2>
        {fehler && <p className="error">Die Regeln ließen sich nicht laden.</p>}
        {!config && !fehler && <p className="muted">Wird geladen…</p>}
        {config && (
          <>
            <p className="muted">
              {an === 0
                ? 'Keine Sonderregeln — es gilt das Grundspiel.'
                : `${an} von ${flags.length} Regeln an.`}
            </p>
            <div className="regeln">
              {flags.map(([key, value]) => (
                <span key={key} className={`regel${value ? ' is-on' : ''}`}>
                  <span className="regel-bild" aria-hidden="true">
                    {regelBild(key)}
                  </span>
                  {t(`regel.${key}`)}
                  <span className="regel-check" aria-hidden="true">
                    ✓
                  </span>
                </span>
              ))}
            </div>
          </>
        )}
        <button className="primary" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
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
