import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardBack, CardFront } from '../CardFace';
import { Ladekreis } from '../Ladekreis';
import { sortByOrder } from '../cardsort';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { EmoteBlase, EmoteLeiste } from '../tisch/emote';
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
  LAYOUTS,
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
import { useTischklang } from '../tisch/klangtisch';
import { DealCeremony, prefersReducedMotion } from '../DealCeremony';
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
  const { view, party, table, error, connected, send, emotes, sendEmote, addBot, removeBot, setBotLevel } =
    useTable<WizardGameView>(tableId, 'wizard');

  /** Welche Zurufe mir gehoeren — dieselbe Frage wie am Doppelkopftisch. */
  const [meineEmotes, setMeineEmotes] = useState<Set<string>>(new Set());
  const [zeigeEmoteHinweis, setZeigeEmoteHinweis] = useState(false);
  useEffect(() => {
    void api
      .shop()
      .then((s) =>
        setMeineEmotes(
          new Set(s.tischware.filter((w) => w.art === 'emote' && w.besessen).map((w) => w.wert)),
        ),
      )
      .catch(() => undefined);
  }, []);

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

  /**
   * Genau EINE eigene Karte darf unterwegs sein. Ohne die Sperre schob ein
   * schneller zweiter Tipp eine weitere Karte in denselben Takt: Der Server
   * lehnte sie ab, und sie hing danach unsichtbar in der Hand. Dieselbe Sperre
   * wie am Doppelkopf-Tisch (`flug` + `locked`); der Zauberer hatte sie noch
   * nicht, weil er die Handkarte selbstverwaltet fliegen liess.
   */
  const [flug, setFlugState] = useState<number | null>(null);
  const flugRef = useRef<number | null>(null);
  const handRef = useRef<readonly Card[]>([]);
  useEffect(() => {
    handRef.current = view?.view.round?.hand ?? [];
  });

  /** Vorgemerkte Karte: spielt von selbst, sobald der Sitz am Zug ist. */
  const [vorgemerkt, setVorgemerkt] = useState<number | null>(null);

  /** Stabile Referenz, damit memoisierte Handkarten nicht mitrendern. */
  const toggleVormerken = useCallback((cardId: number) => {
    setVorgemerkt((v) => (v === cardId ? null : cardId));
  }, []);

  const startPlay = useCallback(
    (cardId: number) => {
      if (flugRef.current !== null) return;
      flugRef.current = cardId;
      setFlugState(cardId);
      setVorgemerkt(null);
      const seat = view?.seat ?? 0;
      // Erst fliegen lassen, dann melden: 170 ms, damit man die Karte fallen
      // sieht.
      window.setTimeout(() => send({ type: 'playCard', seat, cardId }), 170);
      // Sicherheitsnetz: Lehnte der Server den Zug doch ab, loest sich die
      // Sperre nach 4 s und die Karte kehrt sichtbar in die Hand zurueck.
      window.setTimeout(() => {
        if (flugRef.current === cardId) {
          flugRef.current = null;
          setFlugState(null);
        }
      }, 4000);
    },
    [send, view?.seat],
  );

  // Sobald die Karte die Hand verlaesst, hat der Server den Zug uebernommen:
  // Sperre loesen. Und eine Vormerkung, deren Karte gar nicht mehr auf der
  // Hand liegt, verfaellt - sonst zeigte die naechste Runde eine Vormerkung
  // auf eine Kartennummer, die inzwischen jemand anderem gehoert.
  const handKey = (view?.view.round?.hand ?? []).map((c) => c.id).join('.');
  useEffect(() => {
    const aufDerHand = (id: number | null): boolean =>
      id !== null && handRef.current.some((c) => c.id === id);
    if (flugRef.current !== null && !aufDerHand(flugRef.current)) {
      flugRef.current = null;
      setFlugState(null);
    }
    setVorgemerkt((v) => (v !== null && !aufDerHand(v) ? null : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  /**
   * Vormerkung einloesen: Sobald die Karte zulaessig spielbar ist, fliegt sie
   * von selbst. Ist der Sitz am Zug und die Karte NICHT dabei, verfaellt die
   * Vormerkung - beim Zauberer trifft das oefter zu als beim Doppelkopf, denn
   * hier zwingt jede angespielte Farbe zum Bedienen, und ein aufgedeckter
   * Zauberer aendert nichts daran.
   *
   * Der Effekt haengt am Schluessel, nicht am Sichten-Objekt: Sonst liefe er
   * bei jedem Serverfunk neu.
   */
  const playableKey = (view?.legalActions ?? [])
    .filter((action) => action.type === 'playCard')
    .map((action) => action.cardId as number)
    .join('.');
  useEffect(() => {
    if (vorgemerkt === null || playableKey === '') return;
    const spielbar = new Set(playableKey.split('.').map(Number));
    if (spielbar.has(vorgemerkt)) startPlay(vorgemerkt);
    else setVorgemerkt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorgemerkt, playableKey]);

  // Der volle Stich bleibt eine Sekunde liegen, bevor er abgeraeumt wird. Der
  // Server raeumt sofort; hier wird der letzte Stich kurz weitergezeigt.
  const lastTrickNow = view?.view.round?.lastTrick ?? null;
  const lastKey = lastTrickNow ? lastTrickNow.played.map((p) => p.card.id).join('.') : null;
  const [frozenKey, setFrozenKey] = useState<string | null>(null);
  // Nach dem Liegen gleitet der Stich zum Gewinner — dieselbe Sweep-Phase wie
  // am Doppelkopf-Tisch, damit beide Tische gleich abraeumen.
  const [sweeping, setSweeping] = useState(false);
  const seenKey = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (seenKey.current === undefined) {
      seenKey.current = lastKey;
      return;
    }
    if (lastKey && lastKey !== seenKey.current) {
      seenKey.current = lastKey;
      setFrozenKey(lastKey);
      setSweeping(false);
      const reduce = prefersReducedMotion();
      let sweepHandle: ReturnType<typeof setTimeout> | undefined;
      const handle = setTimeout(() => {
        if (reduce) {
          setFrozenKey((k) => (k === lastKey ? null : k));
          return;
        }
        setSweeping(true);
        sweepHandle = setTimeout(() => {
          setSweeping(false);
          setFrozenKey((k) => (k === lastKey ? null : k));
        }, 440);
      }, 1000);
      return () => {
        clearTimeout(handle);
        if (sweepHandle) clearTimeout(sweepHandle);
      };
    }
  }, [lastKey]);

  /**
   * Misch-/Austeilzeremonie, verkuerzt — der Zauberer gibt jede Runde neu.
   *
   * Der Ausloeser ist der Rundenbeginn: volle Haende, kein Stich, noch in der
   * Trumpf- oder Ansagephase. Das `roundNumber` haelt die Zeremonie auf genau
   * ein Mal je Runde fest. Wer mitten in einer Runde beitritt, sieht sie nicht
   * (erster Anblick wird nur gemerkt).
   */
  const geberRunde = view?.view.round ?? null;
  const istGeben =
    !!geberRunde &&
    (geberRunde.phase === 'trump' || geberRunde.phase === 'bidding') &&
    (geberRunde.currentTrick?.length ?? 0) === 0 &&
    Object.values(geberRunde.tricks ?? {}).every((n) => n === 0);
  const dealKey = istGeben ? `${geberRunde!.roundNumber}` : null;
  const seenDeal = useRef<string | null | undefined>(undefined);
  const [dealing, setDealing] = useState(false);
  const [dealSize, setDealSize] = useState(1);
  const endDeal = useCallback(() => setDealing(false), []);
  useEffect(() => {
    if (!dealKey) {
      // Mitten in der Runde beigetreten: vormerken, ohne zu animieren.
      if (seenDeal.current === undefined && geberRunde) seenDeal.current = null;
      return;
    }
    if (dealKey === seenDeal.current) return;
    const ersterAnblick = seenDeal.current === undefined;
    seenDeal.current = dealKey;
    if (ersterAnblick || prefersReducedMotion()) return;
    setDealSize(geberRunde!.handSize);
    setDealing(true);
  }, [dealKey, geberRunde]);

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

  /**
   * Ton am Tisch — derselbe Haken wie beim Doppelkopf, nur mit den Werten,
   * die dieses Spiel dafuer hat. Die Rundenabrechnung heisst hier
   * `abrechnung` statt `finishedKey`; als Schluessel dient die Rundennummer,
   * denn genau die ist neu, wenn ein Blatt erscheint.
   *
   * Vor jedem bedingten `return`, aus demselben Grund wie dort.
   */
  const meinPlatz =
    view?.seat != null
      ? (party?.standings?.find((s) => s.seat === view.seat)?.place ?? null)
      : null;
  useTischklang({
    stichKarten: view?.view.round?.currentTrick.length ?? 0,
    letzterStich: lastKey,
    binDran: view?.view.round?.isMyTurn ?? false,
    gibtGerade: dealing,
    abschluss: abrechnung ? `runde-${abrechnung.roundNumber}` : null,
    partieFertig: view?.finished ?? false,
    gewonnen: meinPlatz === null ? null : meinPlatz === 1,
    fehler: error,
  });

  if (!view && table && table.status === 'waiting') {
    return (
      <Wartebereich
        tableId={tableId}
        table={table}
        error={error}
        spielerName={spielerName}
        addBot={addBot}
        removeBot={removeBot}
        setBotLevel={setBotLevel}
        onLeave={onLeave}
      />
    );
  }

  if (!view) {
    return (
      <div className="doko doko--loading">
        <Ladekreis
          bild="/hub/lade-pinguin.webp"
          text={connected ? 'Tisch wird geladen…' : 'Verbinde…'}
        />
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

  // Vormerken geht nur mitten im Stichspiel, wenn man gerade NICHT dran ist.
  // In der Ansagephase gibt es nichts vorzumerken, und in der blinden Runde
  // kennt man die eigene Karte nicht - eine Vormerkung waere dort blanker
  // Zufall statt einer Entscheidung.
  const darfVormerken = playable.size === 0 && runde?.phase === 'playing' && !runde.blind;

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
  // Der eigene Zuruf, damit der Sender ihn ueber sich selbst aufblitzen sieht -
  // sonst tippt man einen Zuruf und bei einem selbst passiert scheinbar nichts.
  const meinEmote = view.seat !== null ? emotes[view.seat] : undefined;

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
          {/* Zurufe nur fuer Mitspieler — dieselbe Regel wie am Doppelkopftisch. */}
          {view.seat !== null && (
            <EmoteLeiste
              besessen={meineEmotes}
              onSenden={sendEmote}
              onKaufen={() => setZeigeEmoteHinweis(true)}
            />
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
            emote={emotes[seat] ?? null}
          />
        ))}

        {/* Trumpf liegt am Tisch, nicht in einer Zeile: Wer ihn sucht, sucht
            eine Karte. Aufgedeckt wird er erst, wenn das Austeilen vorbei ist. */}
        <TrumpfPlakette runde={runde} deck={deck} enthuellt={!dealing} />

        <div className="doko-trick">
          {!dealing && trick.length === 0 && (
            <span className="doko-trick-hint">{t(`phase.${runde?.phase ?? 'playing'}`)}</span>
          )}
          {!dealing &&
            trick.map((played) => (
              <div
                key={played.card.id}
                className={`doko-trick-card at-${slotFor(played.seat, base, seatCount)}`}
              >
                {/* Beim Abraeumen gleitet die Karte zum Sitz des Gewinners. */}
                <div
                  className={`doko-trick-in${
                    sweeping && lastTrickNow
                      ? ` is-sweep sweep-${slotFor(lastTrickNow.winnerSeat, base, seatCount)}`
                      : ''
                  }`}
                >
                  <div className="pc pc--trick">
                    <CardFront card={played.card} deck={deck} />
                  </div>
                </div>
              </div>
            ))}
        </div>

        {dealing && (
          <DealCeremony
            slots={LAYOUTS[seatCount] ?? ['bottom', 'left', 'top', 'right']}
            deckSize={dealSize}
            deck={deck}
            kurz
            onDone={endDeal}
          />
        )}

        {!dealing && runde?.lastTrick && trick.length === 0 && (
          <p className="doko-last">Letzter Stich an {nameOf(runde.lastTrick.winnerSeat)}</p>
        )}
      </div>

      {error && <p className="doko-error">{t(error)}</p>}

      {/* Die eigene Lage in einem Satz: Gebot, Stiche, Aufspiel. */}
      <div className="doko-me">
        <span className="doko-me-avatar">
          {meinEmote && <EmoteBlase emote={meinEmote} />}
          <Avatar
            name={view.seat === null ? 'Du' : nameOf(view.seat)}
            seatIndex={view.seat ?? 0}
            active={view.currentActor === view.seat}
            deadline={view.currentActor === view.seat ? view.turnDeadline : null}
            avatarUrl={view.seat === null ? null : (seatInfo(view.seat)?.avatarUrl ?? null)}
            you
          />
        </span>
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

      {view.seat !== null && !runde?.blind && (
        <div
          className="doko-hand"
          /* Der Abstand zwischen zwei Karten haengt hier an der Handgroesse:
             Beim Doppelkopf sind es immer zwoelf, beim Zauberer eine bis
             zwanzig. Mit festem Schritt lagen drei Karten uebereinander, von
             denen nur Streifen zu sehen waren. */
          style={{ '--luecken': Math.max(1, hand.length - 1) } as React.CSSProperties}
        >
          {hand.map((card, index) => (
            <HandCard
              key={card.id}
              card={card}
              deck={deck}
              index={index}
              total={hand.length}
              playable={playable.has(card.id)}
              locked={flug !== null}
              markable={darfVormerken}
              marked={vorgemerkt === card.id}
              trump={sticht.has(`${card.suit}${card.rank}`)}
              legt={card.id === flug}
              onPlay={startPlay}
              onMark={toggleVormerken}
            />
          ))}
          {hand.length === 0 && <span className="muted">Keine Karten auf der Hand.</span>}
        </div>
      )}

      {/* In der blinden Runde haelt man seine Karte an die Stirn: Man sieht
          alle anderen, nur sich selbst nicht. Gelegt wird sie wie jede andere
          Karte - durch Antippen. Ein eigener Knopf dafuer war ein Fremdkoerper:
          Am Tisch spielt man Karten, man drueckt keine Schaltflaechen. */}
      {view.seat !== null && runde?.blind && (
        <div className="doko-hand wiz-blind">
          <BlindKarte deck={deck} action={blindLegen} onPlay={send} />
          <p className="muted">Deine Karte kennst du nicht, die der anderen schon.</p>
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

      {zeigeEmoteHinweis && (
        <div className="doko-sheet" onClick={() => setZeigeEmoteHinweis(false)}>
          <div className="doko-sheet-card" onClick={(e) => e.stopPropagation()}>
            <h2>Diesen Zuruf hast du noch nicht</h2>
            <p className="muted">
              Im Shop unter „Zurufe" gibt es ihn gegen Münzen. Er steht dir dann an jedem
              Tisch zur Verfügung.
            </p>
            <button className="primary" onClick={() => setZeigeEmoteHinweis(false)}>
              Weiter spielen
            </button>
          </div>
        </div>
      )}

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
  // Das Farbzeichen statt des Namens: Die Zeile steht neben fuenf Knoepfen und
  // brach mit "Trumpf Karo" in die zweite Zeile. Was Trumpf ist, steht ohnehin
  // gross an der Plakette.
  const trumpf = runde.trump ? suitSymbol(runde.trump) : 'kein Trumpf';

  if (runde.phase === 'trump') return `${karten} · Trumpf wird bestimmt`;
  if (runde.phase === 'bidding') return `${karten} · ${trumpf} · Ansagen`;

  // Im Spiel ist die Summe der Ansagen die wichtigste Zahl am Tisch: Sie sagt,
  // ob die Stiche knapp sind oder ueberzaehlig.
  const summe = runde.bidTotal;
  const lage = summe === null ? '' : ` · ${summe} auf ${runde.handSize}`;
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

/**
 * Die aufgedeckte Trumpfkarte in ihrem gemalten Rahmen.
 *
 * Sie haengt unten links am Filz - dort ist in jeder Sitzverteilung Platz.
 * Der erste Anlauf setzte sie auf halbe Hoehe und legte sie damit genau ueber
 * den linken Mitspieler: Avatar, Gebot und Punktestand verschwanden dahinter.
 */
function TrumpfPlakette({
  runde,
  deck,
  enthuellt,
}: {
  runde: WizardRoundView | null;
  deck: Deck;
  /** Erst nach dem Austeilen aufdecken; vorher liegt ein Ruecken da. */
  enthuellt: boolean;
}): React.JSX.Element | null {
  if (!runde) return null;

  /**
   * Der aufgedeckte Zauberer sagt selbst nicht, welche Farbe der Geber
   * gewaehlt hat: Das Bild ist fuer alle vier Wahlen dasselbe. Wer den Trumpf
   * sucht, sucht die Karte - und fand einen Zauberer, dessen Farbe nur klein
   * als Zeichen darunter stand. Deshalb traegt die Karte das Farbzeichen
   * selbst, gross und im Farbton der Trumpffarbe.
   */
  const zaubererMitFarbe = runde.upcard?.suit === 'Z' && runde.trump !== null;
  const farbeRot = runde.trump === 'H' || runde.trump === 'D';

  return (
    <div className="wiz-trumpf">
      <div className="wiz-trumpf-rahmen">
        {runde.upcard ? (
          enthuellt ? (
            // Neuer Schluessel je Karte: die Aufdeck-Drehung laeuft genau
            // einmal, wenn die Karte erscheint.
            <div className="pc pc--trumpf wiz-trumpf-auf" key={runde.upcard.id}>
              <CardFront card={runde.upcard} deck={deck} />
              {zaubererMitFarbe && (
                <span
                  className={`wiz-trumpf-farbe${farbeRot ? ' is-rot' : ''}`}
                  aria-hidden="true"
                >
                  {suitSymbol(runde.trump!)}
                </span>
              )}
            </div>
          ) : (
            <div className="pc pc--trumpf" aria-hidden="true">
              <CardBack deck={deck} />
            </div>
          )
        ) : (
          <div className="pc pc--trumpf wiz-trumpf-leer" aria-hidden="true" />
        )}
      </div>
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

/**
 * Die eigene, verdeckte Karte in der blinden Runde.
 *
 * Sieht aus wie eine Handkarte und verhaelt sich auch so: Antippen legt sie,
 * ein Tipp ausserhalb des eigenen Zuges schuettelt nur. Der Ruecken kommt aus
 * dem gewaehlten Blatt - sonst laege am Zaubertisch ploetzlich eine fremde
 * Karte.
 */
function BlindKarte({
  deck,
  action,
  onPlay,
}: {
  deck: Deck;
  /** Null, solange dieser Sitz nicht am Zug ist. */
  action: Action | null;
  onPlay: (action: Action) => void;
}): React.JSX.Element {
  const [shaking, setShaking] = useState(false);
  const [legt, setLegt] = useState(false);

  return (
    <button
      className={`doko-handcard${shaking ? ' is-shake' : ''}${legt ? ' is-legt' : ''}`}
      style={{ '--off': 0 } as React.CSSProperties}
      aria-disabled={!action}
      aria-label="Deine verdeckte Karte legen"
      onClick={() => {
        // Schon unterwegs: ein zweiter Tipp darf die eine Karte nicht noch
        // einmal senden.
        if (legt) return;
        if (!action) {
          setShaking(true);
          return;
        }
        setLegt(true);
        window.setTimeout(() => onPlay(action), 170);
      }}
      onAnimationEnd={() => setShaking(false)}
    >
      <div className="pc pc--hand">
        <CardBack deck={deck} />
      </div>
    </button>
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
  emote,
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
  /** Zuruf ueber diesem Sitz, oder null. */
  emote: string | null;
}): React.JSX.Element {
  const vertical = istSeitlich(slot as never);

  return (
    <div className={`doko-opp at-${slot}${active ? ' is-active' : ''}`}>
      {emote && <EmoteBlase emote={emote} />}
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
      <div className="doko-sheet-card wiz-knapp">
        <h2>Wie viele Stiche machst du?</h2>
        <p className="muted">
          {verdeckt
            ? 'Verdeckt angesagt: Die anderen Zahlen siehst du erst, wenn alle angesagt haben.'
            : bisher.length === 0
              ? `${handSize} ${handSize === 1 ? 'Stich' : 'Stiche'} sind zu vergeben. Du sagst zuerst an.`
              : `Bisher angesagt: ${bisher
                  .map(([seat, bid]) => `${nameOf(Number(seat))} ${bid}`)
                  .join(' · ')}${bidTotal !== null ? `, Summe ${bidTotal} von ${handSize}` : ''}`}
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
      <div className="doko-sheet-card wiz-knapp">
        <h2>Du bestimmst den Trumpf</h2>
        <p className="muted">Aufgedeckt wurde ein Zauberer, du wählst die Farbe.</p>
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
