import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardFront } from '../CardFace';
import {
  DealCeremony,
  isVollesGeben,
  prefersReducedMotion,
  type DealSlot,
} from '../DealCeremony';
import { sortByOrder } from '../cardsort';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { gameTypeLabel, t } from '../i18n';
import type { Action, Card, RoundResult } from '../protocol';
import {
  Avatar,
  HandCard,
  LAYOUTS,
  LetzterStich,
  PartyEnd,
  RegelBlatt,
  Ruecken,
  type Slot,
  StichStapel,
  TurnClock,
  Wartebereich,
  istSeitlich,
  slotFor,
} from '../tisch';
import { type ConnectionStatus, useTable } from '../useTable';

/** Grenzen der Tischgroesse: klein genug fuer die Uebersicht, gross genug,
    dass die Karten nicht aus dem Faecher wachsen. */
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.45;
const ZOOM_STEP = 0.15;

/**
 * Schmaler Hinweis samt Knopf, wenn die Leitung gerade nicht steht. Beim
 * ersten Verbinden bleibt er weg - dafuer gibt es den Ladebildschirm.
 */
function ConnectionBanner({
  status,
  onReconnect,
}: {
  status: ConnectionStatus;
  onReconnect: () => void;
}): React.JSX.Element | null {
  if (status === 'open' || status === 'connecting') return null;
  return (
    <div className={`doko-conn doko-conn--${status}`} role="status" aria-live="polite">
      <span className="doko-conn-dot" aria-hidden="true" />
      <span className="doko-conn-text">
        {status === 'reconnecting'
          ? 'Verbindung wird wiederhergestellt…'
          : 'Keine Verbindung'}
      </span>
      <button className="doko-conn-btn" onClick={onReconnect}>
        Neu verbinden
      </button>
    </div>
  );
}

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
  szene,
  onShowProfile,
  onLeave,
}: {
  tableId: string;
  deck: Deck;
  /** Gewaehlte Tischszenerie des Kontos. */
  szene: string;
  onShowProfile: (accountId: string) => void;
  onLeave: () => void;
}): React.JSX.Element {
  const { view, party, table, error, status, send, addBot, removeBot, reconnect } =
    useTable(tableId);

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

  /** Blatt mit den Tischregeln, aufklappbar im Wartebereich und in der Runde. */
  const [zeigeRegeln, setZeigeRegeln] = useState(false);
  const [zeigeLetzten, setZeigeLetzten] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);

  /**
   * Zurufe: kurze Sprechblasen am Sitz, wenn jemand etwas sagt.
   *
   * Am echten Tisch hoert man "gesund" oder "Re" — hier stand es bisher
   * nirgends, und wer gerade auf seine Karten sah, bekam es nie mit. Der
   * bleibende Vermerk steht danach am Namen; die Blase ist nur der Moment.
   */
  const [blasen, setBlasen] = useState<Record<number, string>>({});
  const gesehenVorbehalte = useRef<number | null>(null);
  const gesehenAnsagen = useRef<number | null>(null);
  const blasenTimer = useRef<number[]>([]);

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
        1600,
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

  /*
   * Neue Zurufe aus dem Zuwachs der beiden Protokolle ableiten.
   *
   * Beim ersten Anblick wird nur der Stand gemerkt und nichts gezeigt: Wer
   * mitten in der Runde beitritt, soll nicht acht alte Ansagen um die Ohren
   * geschleudert bekommen.
   */
  const rundeJetzt = view?.view.round ?? null;
  useEffect(() => {
    if (!rundeJetzt) return;
    const vb = rundeJetzt.vorbehalte ?? [];
    const an = rundeJetzt.ansagen ?? [];

    if (gesehenVorbehalte.current === null || gesehenAnsagen.current === null) {
      gesehenVorbehalte.current = vb.length;
      gesehenAnsagen.current = an.length;
      return;
    }

    const neu: Record<number, string> = {};
    for (const e of vb.slice(gesehenVorbehalte.current)) {
      neu[e.seat] = e.kind === null ? 'Gesund' : vorbehaltRuf(e.kind);
    }
    for (const e of an.slice(gesehenAnsagen.current)) {
      neu[e.seat] = ansageRuf(e.level, rundeJetzt.knownParties?.[e.seat] ?? null);
    }
    gesehenVorbehalte.current = vb.length;
    gesehenAnsagen.current = an.length;
    if (Object.keys(neu).length === 0) return;

    setBlasen((prev) => ({ ...prev, ...neu }));
    /*
     * Der Timer haengt bewusst an einer Referenz und nicht am Aufraeumen
     * des Effekts: Der laeuft bei jeder Tischnachricht neu, und React
     * raeumt den vorigen Durchlauf vorher auf. Die naechste gespielte
     * Karte haette den Timer also geloescht - und die Blase waere bis zum
     * Rundenende stehengeblieben.
     */
    blasenTimer.current.push(
      window.setTimeout(() => {
        setBlasen((prev) => {
          const rest = { ...prev };
          for (const key of Object.keys(neu)) {
            if (rest[Number(key)] === neu[Number(key)]) delete rest[Number(key)];
          }
          return rest;
        });
      }, 2600),
    );
  }, [rundeJetzt]);

  // Beim Verlassen des Tisches alle noch offenen Blasen-Timer abraeumen.
  useEffect(() => () => blasenTimer.current.forEach(clearTimeout), []);

  /**
   * Rundenabschluss auf dem Filz:
   * 1) kurzer Stichstapel-Blick, 2) Auswertung, 3) Zwischenstand.
   *
   * Alles rein clientseitig aus `round.phase === 'finished'`, `round.result`
   * und `view.scores`.
   */
  const finishedKey = (() => {
    const r = view?.view.round;
    if (!r || r.phase !== 'finished' || !r.result) return null;
    return `${view.view.roundIndex}:${r.result.value}:${Object.values(r.result.scores).join('.')}`;
  })();
  const [showTrickPeek, setShowTrickPeek] = useState(false);
  const [abschlussStep, setAbschlussStep] = useState<'none' | 'abrechnung' | 'zwischenstand'>('none');
  const gesehenAbschluss = useRef<string | null>(null);
  useEffect(() => {
    if (!finishedKey) {
      setShowTrickPeek(false);
      setAbschlussStep('none');
      return;
    }
    if (gesehenAbschluss.current === finishedKey) return;
    gesehenAbschluss.current = finishedKey;

    if (prefersReducedMotion()) {
      setAbschlussStep('abrechnung');
      return;
    }

    setShowTrickPeek(true);
    const peek = window.setTimeout(() => {
      setShowTrickPeek(false);
      setAbschlussStep('abrechnung');
    }, 1500);
    return () => window.clearTimeout(peek);
  }, [finishedKey, view?.view.round]);

  // Fallback-Autofluss, falls niemand auf "Weiter" tippt.
  useEffect(() => {
    if (abschlussStep !== 'abrechnung') return;
    const t = window.setTimeout(() => setAbschlussStep('zwischenstand'), 10_000);
    return () => window.clearTimeout(t);
  }, [abschlussStep]);

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
      <>
        <ConnectionBanner status={status} onReconnect={reconnect} />
        <Wartebereich
          tableId={tableId}
          table={table}
          error={error}
          spielerName={spielerName}
          addBot={addBot}
          removeBot={removeBot}
          onLeave={onLeave}
        />
      </>
    );
  }

  if (!view) {
    const ladeText =
      status === 'open'
        ? 'Tisch wird geladen…'
        : status === 'reconnecting'
          ? 'Verbindung wird wiederhergestellt…'
          : 'Verbinde…';
    return (
      <div className="doko doko--loading">
        <div className="doko-spinner" aria-hidden="true" />
        <p className="muted">{ladeText}</p>
        {error && <p className="error">{t(error)}</p>}
        <div className="doko-loading-actions">
          <button className="primary" onClick={reconnect}>
            Neu verbinden
          </button>
          <button onClick={onLeave}>Zurück</button>
        </div>
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
  const roundResult = round?.phase === 'finished' && round.result ? round.result : null;
  const abrechnungOffen = abschlussStep === 'abrechnung' && roundResult !== null;
  const zwischenstandOffen = abschlussStep === 'zwischenstand' && roundResult !== null;

  return (
    <div className="doko" style={{ '--zoom': zoom } as React.CSSProperties}>
      <img className="doko-bg" src={szeneBild(szene)} alt="" draggable={false} />
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
          <button
            className={`doko-icon${status !== 'open' ? ' is-syncing' : ''}`}
            onClick={reconnect}
            aria-label="Neu verbinden / aktualisieren"
            title="Neu verbinden"
          >
            ⟳
          </button>
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
      <ConnectionBanner status={status} onReconnect={reconnect} />

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
            ansage={ansageVon(round, seat)}
            sagt={blasen[seat] ?? null}
            tricksWon={round?.trickCounts?.[seat] ?? 0}
            showTrickPeek={showTrickPeek}
            avatarUrl={avatarOf(seat)}
            deck={deck}
          />
        ))}

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

        {/* Die beiden Holztafeln - eigene Partei und laufende Spielart -
            standen frueher hier auf dem Filz. Beides steht schon in der
            Kopfzeile oben links und unter dem eigenen Namen; zweimal
            dasselbe nimmt nur Platz weg, den die Karten brauchen. */}

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

      {abrechnungOffen && roundResult && (
        <RundenAbrechnung
          result={roundResult}
          seats={seatList.map((s) => ({ seat: s.seat, name: nameOf(s.seat), avatarUrl: avatarOf(s.seat) }))}
          knownParties={round?.knownParties ?? {}}
          onWeiter={() => setAbschlussStep('zwischenstand')}
        />
      )}

      {zwischenstandOffen && (
        <ZwischenstandBlatt
          seats={seatList.map((s) => ({ seat: s.seat, name: nameOf(s.seat), avatarUrl: avatarOf(s.seat) }))}
          scores={view.view.scores}
          restRunden={Math.max(0, view.view.totalRounds - view.view.roundIndex - 1)}
          onWeiter={() => setAbschlussStep('none')}
        />
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
          <span className={showTrickPeek ? 'doko-stiche-wrap is-peek' : 'doko-stiche-wrap'}>
            <StichStapel count={round?.trickCounts?.[view.seat] ?? 0} />
          </span>
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
  ansage,
  sagt,
  tricksWon,
  showTrickPeek,
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
  /** Hoechste Absage dieses Sitzes. Bleibt stehen. */
  ansage: string | null;
  /** Kurzer Zuruf, verschwindet nach ein paar Sekunden von selbst. */
  sagt: string | null;
  tricksWon: number;
  showTrickPeek: boolean;
  avatarUrl: string | null;
  deck: Deck;
}): React.JSX.Element {
  const vertical = istSeitlich(slot);
  return (
    <div className={`doko-opp at-${slot}${active ? ' is-active' : ''}`}>
      {/* Der Zuruf im Moment des Sagens. Am echten Tisch hoert man "gesund"
          oder "Re"; hier stand es bisher nirgends, und wer gerade auf seine
          Karten sah, bekam es nie mit. */}
      {sagt && <span className="doko-blase">{sagt}</span>}
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
        {/* Der Vermerk bleibt stehen: Wer eine Absage gesagt hat, soll
            daran auch in der zehnten Runde noch erkennbar sein. */}
        {ansage && <em className="doko-tag doko-tag--ansage">{ansage}</em>}
        {hasLeft && <em className="doko-tag">ausgestiegen</em>}
        {!hasLeft && botTakeover && !isBot && <em className="doko-tag">Bot übernimmt</em>}
      </div>
      {/* Genau so viele verdeckte Karten, wie der Spieler haelt. Links und
          rechts liegen sie quer (siehe CSS is-vertical). */}
      <Ruecken count={count} vertical={vertical} deck={deck} />
      <span className="doko-opp-score">{score}</span>
      <span className={showTrickPeek ? 'doko-stiche-wrap is-peek' : 'doko-stiche-wrap'}>
        <StichStapel count={tricksWon} />
      </span>
    </div>
  );
});


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

/**
 * Die Vorbehalte ausser dem Solo, in fester Reihenfolge.
 *
 * Sie werden immer angezeigt, auch wenn das Blatt sie nicht hergibt. Der
 * Grund steht dann daneben — „nicht moeglich" ohne Begruendung liest sich
 * wie ein Fehler, und beim naechsten Blatt weiss man immer noch nicht,
 * worauf man achten muesste.
 */
const NICHT_SOLO: readonly { kind: string; label: string; warum: string }[] = [
  { kind: 'schmeiss', label: 'Schmeißen', warum: 'Dafür brauchst du genug Luschen oder Volle.' },
  { kind: 'armut', label: 'Armut', warum: 'Dafür darfst du höchstens drei Trümpfe haben.' },
  { kind: 'hochzeit', label: 'Hochzeit', warum: 'Dafür brauchst du beide Kreuz-Damen.' },
];

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
              {/* Immer anwaehlbar, auch ohne moeglichen Vorbehalt: Dahinter
                  steht jetzt die vollstaendige Liste mit Begruendungen, und
                  die darf man sich ansehen duerfen. Zurueck geht es von dort. */}
              <button onClick={() => setSchritt('auswahl')}>Nein, Vorbehalt</button>
            </div>
          </>
        )}

        {schritt === 'auswahl' && (
          <>
            <h2>Dein Vorbehalt</h2>
            <div className="vb-grid">
              {/*
                Schmeissen, Armut und Hochzeit stehen immer da, auch wenn das
                Blatt sie nicht hergibt — dann ausgegraut mit dem Grund. Wer
                nur sieht, was gerade geht, lernt nie, dass es sie gibt, und
                sucht beim ersten passenden Blatt vergeblich danach.
              */}
              {NICHT_SOLO.map((eintrag) => {
                const action = sonstige.find((a) => a.kind === eintrag.kind) ?? null;
                if (!action) {
                  return (
                    <button
                      className="vb-tile is-aus"
                      key={eintrag.kind}
                      disabled
                      title={eintrag.warum}
                    >
                      <VorbehaltIcon kind={eintrag.kind} />
                      <span>{eintrag.label}</span>
                      <span className="vb-warum">{eintrag.warum}</span>
                    </button>
                  );
                }
                return (
                  <button
                    className="vb-tile"
                    key={eintrag.kind}
                    onClick={() => bestaetigen(action)}
                  >
                    <VorbehaltIcon kind={eintrag.kind} />
                    <span>{actionLabel(action).replace(/^Solo: /, '')}</span>
                  </button>
                );
              })}
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

const ABSAGE_NAMEN = ['Keine 90', 'Keine 60', 'Keine 30', 'Schwarz'];

/** Zuruf einer Ansage. Stufe 0 ist Re oder Kontra, darueber die Absagen. */
function ansageRuf(level: number, party: string | null): string {
  if (level > 0) return ABSAGE_NAMEN[level - 1] ?? 'Ansage';
  return party ? partyLabel(party) : 'Ansage';
}

/** Zuruf eines Vorbehalts. Das Solo nennt seine Art erst bei der Auflösung. */
function vorbehaltRuf(kind: string): string {
  return (
    { solo: 'Solo', schmeiss: 'Ich schmeiße', armut: 'Armut', hochzeit: 'Hochzeit' }[kind] ??
    'Vorbehalt'
  );
}

/**
 * Bleibender Vermerk am Sitz: die höchste Absage.
 *
 * Re und Kontra stehen schon als Partei daneben — sie hier zu wiederholen
 * wäre doppelt. Erst ab „Keine 90" gibt es etwas Eigenes zu zeigen.
 */
function ansageVon(
  round: { ansagen?: readonly { seat: number; level: number }[] } | null,
  seat: number,
): string | null {
  const meine = (round?.ansagen ?? []).filter((a) => a.seat === seat);
  const hoechste = meine.reduce((m, a) => Math.max(m, a.level), 0);
  return hoechste > 0 ? (ABSAGE_NAMEN[hoechste - 1] ?? null) : null;
}

type SitzInfo = { seat: number; name: string; avatarUrl: string | null };

function RundenAbrechnung({
  result,
  seats,
  knownParties,
  onWeiter,
}: {
  result: RoundResult;
  seats: SitzInfo[];
  knownParties: Record<number, string>;
  onWeiter: () => void;
}): React.JSX.Element {
  const reSeats = seats.filter((s) => knownParties[s.seat] === 're');
  const kontraSeats = seats.filter((s) => knownParties[s.seat] !== 're');
  const reGewinnt = result.winner === 're';
  const kontraGewinnt = result.winner === 'kontra';
  return (
    <div className="doko-sheet doko-sheet--mitte doko-sheet--abrechnung">
      <div className="doko-sheet-card doko-abrechnung">
        <h2>Auswertung</h2>
        <div className="doko-abrechnung-spalten">
          <ParteiSpalte
            title="Re"
            klasse="re"
            members={reSeats}
            points={result.rePoints}
            specialRows={specialRowsOf(result, 're')}
            total={roundValueOf(result, reSeats, true)}
            isWinner={reGewinnt}
          />
          <ParteiSpalte
            title="Kontra"
            klasse="kontra"
            members={kontraSeats}
            points={result.kontraPoints}
            specialRows={specialRowsOf(result, 'kontra')}
            total={roundValueOf(result, kontraSeats, false)}
            isWinner={kontraGewinnt}
          />
        </div>
        <button className="primary" onClick={onWeiter}>
          Weiter
        </button>
      </div>
    </div>
  );
}

function ParteiSpalte({
  title,
  klasse,
  members,
  points,
  specialRows,
  total,
  isWinner,
}: {
  title: string;
  klasse: 're' | 'kontra';
  members: SitzInfo[];
  points: number;
  specialRows: string[];
  total: number;
  isWinner: boolean;
}): React.JSX.Element {
  return (
    <section className={`doko-abr-partei is-${klasse}${isWinner ? ' is-winner' : ''}`}>
      <header>{title}</header>
      <div className="doko-abr-team">
        {members.map((s) => (
          <span key={s.seat} className={`doko-abr-spieler is-${klasse}`}>
            <Avatar
              name={s.name}
              seatIndex={s.seat}
              active={false}
              deadline={null}
              avatarUrl={s.avatarUrl}
            />
            <b>{s.name}</b>
          </span>
        ))}
      </div>
      <div className="doko-abr-rows">
        <div>
          <span>Kartenpunkte</span>
          <span>{points}</span>
        </div>
        {specialRows.map((row) => (
          <div key={row}>
            <span>{row}</span>
            <span>+1</span>
          </div>
        ))}
      </div>
      <footer>
        <span>Gesamt</span>
        <strong>{total > 0 ? `+${total}` : total}</strong>
      </footer>
    </section>
  );
}

function ZwischenstandBlatt({
  seats,
  scores,
  restRunden,
  onWeiter,
}: {
  seats: SitzInfo[];
  scores: Record<number, number>;
  restRunden: number;
  onWeiter: () => void;
}): React.JSX.Element {
  const sortiert = [...seats].sort((a, b) => a.seat - b.seat);
  return (
    <div className="doko-sheet doko-sheet--mitte doko-sheet--zwischenstand">
      <div className="doko-sheet-card doko-zwischenstand">
        <h2>Zwischenstand</h2>
        <div className="doko-zwischenstand-grid">
          {sortiert.map((s) => {
            const value = scores[s.seat] ?? 0;
            return (
              <article key={s.seat} className="doko-zwischenstand-card">
                <Avatar
                  name={s.name}
                  seatIndex={s.seat}
                  active={false}
                  deadline={null}
                  avatarUrl={s.avatarUrl}
                />
                <b>{s.name}</b>
                <strong className={value < 0 ? 'is-minus' : 'is-plus'}>
                  {value > 0 ? `+${value}` : value}
                </strong>
              </article>
            );
          })}
        </div>
        <p className="muted doko-zwischenstand-rest">Verbleibende Runden: {restRunden}</p>
        <button className="primary" onClick={onWeiter}>
          Weiter
        </button>
      </div>
    </div>
  );
}

function roundValueOf(result: RoundResult, seats: SitzInfo[], isRe: boolean): number {
  const seatValues = seats.map((s) => result.scores[s.seat] ?? 0);
  if (seatValues.length === 0) return 0;
  if (result.isSolo) {
    // Solist bekommt ±3*value, Gegner ±value — beide Seiten zeigen je Kopf.
    if (isRe) return result.winner === 're' ? result.value * 3 : -result.value * 3;
    return result.winner === 'kontra' ? result.value : -result.value;
  }
  return seatValues[0] ?? 0;
}

function specialRowsOf(result: RoundResult, party: 're' | 'kontra'): string[] {
  const map: Record<string, string> = {
    fuchs: 'Fuchs',
    karlchen: 'Karlchen',
    doppelkopf: 'Doppelkopf',
    charlie: 'Charlie',
    herzdurchlauf: 'Herzdurchlauf',
  };
  return result.specials
    .filter((s) => s.party === party)
    .map((s) => map[s.kind] ?? s.kind);
}
