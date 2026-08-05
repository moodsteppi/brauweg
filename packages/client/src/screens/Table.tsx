import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { CardFront } from '../CardFace';
import { Ladekreis } from '../Ladekreis';
import {
  DealCeremony,
  isVollesGeben,
  prefersReducedMotion,
  type DealSlot,
} from '../DealCeremony';
import { sortByOrder } from '../cardsort';
import type { Deck } from '../decks';
import { szeneBild } from '../szenen';
import { EmoteBlase, EmoteLeiste } from '../tisch/emote';
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
import { useTischklang } from '../tisch/klangtisch';
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
  const {
    view,
    party,
    table,
    error,
    status,
    send,
    emotes,
    sendEmote,
    addBot,
    removeBot,
    reconnect,
  } = useTable(tableId);

  /**
   * Welche Zurufe mir gehoeren. Einmal beim Betreten geholt; im Shop kann
   * sich das aendern, aber nicht waehrend einer Partie.
   */
  const [meineEmotes, setMeineEmotes] = useState<Set<string>>(new Set());
  /** Ein gesperrter Zuruf wurde angetippt — der Weg dorthin fuehrt ueber den Hub. */
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

  /**
   * Eigene gelegte Karte ohne Luecke: Die Gleitanimation der Handkarte endet
   * nach 0,4 s in der Tischmitte - genau dann soll die Karte im Stich liegen,
   * egal wie lange der Server braucht. Dazu wird sie optimistisch gelegt
   * (pendingPlay) und ihr Eintreffen im Serverstand nicht noch einmal
   * animiert (selbstGelegt -> is-direkt).
   */
  const selbstGelegt = useRef<Set<number>>(new Set());
  const [pendingPlay, setPendingPlay] = useState<{ seat: number; card: Card } | null>(null);
  const handRef = useRef<readonly Card[]>([]);
  useEffect(() => {
    handRef.current = view?.view.round?.hand ?? [];
  });
  /** Bricht den Stich-Freeze ab: sofort zum Gewinner gleiten statt liegen. */
  const skipFreeze = useRef<(() => void) | null>(null);

  /**
   * Genau EINE eigene Karte darf unterwegs sein. Ohne die Sperre schob ein
   * schneller zweiter Tipp eine weitere Karte in denselben Takt: Entweder
   * spielte sie ungewollt mit (wer den Stich gewinnt, ist sofort wieder
   * dran), oder der Server lehnte ab und die Karte hing unsichtbar in der
   * Hand.
   */
  const [flug, setFlugState] = useState<number | null>(null);
  const flugRef = useRef<number | null>(null);
  /** Vorgemerkte Karte: spielt von selbst, sobald der Sitz am Zug ist. */
  const [vorgemerkt, setVorgemerkt] = useState<number | null>(null);

  /** Stabile Referenzen, damit memoisierte Handkarten nicht mitrendern. */
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
      // Erst fliegen lassen, dann melden. Die 170 ms sind kuerzer als jede
      // Reaktionszeit und sorgen dafuer, dass man die Karte fallen sieht.
      window.setTimeout(() => {
        selbstGelegt.current.add(cardId);
        // Liegt noch der volle letzte Stich, raeumt er sofort ab - sonst
        // landete die eigene Karte erst nach dessen Pause auf dem Tisch.
        skipFreeze.current?.();
        send({ type: 'playCard', seat, cardId });
      }, 170);

      const card = handRef.current.find((c) => c.id === cardId);
      if (card) {
        // Die Gleitanimation endet 400 ms nach dem Tipp - dann liegt die
        // Karte nahtlos im Stich, egal wie lange der Server braucht.
        const reveal = prefersReducedMotion() ? 0 : 380;
        window.setTimeout(() => {
          setPendingPlay((p) => p ?? { seat, card });
        }, reveal);
      }
      // Sicherheitsnetz: Lehnte der Server den Zug doch ab, loest sich die
      // Sperre, die Karte kehrt sichtbar in die Hand zurueck und die
      // optimistische Kopie verschwindet.
      window.setTimeout(() => {
        if (flugRef.current === cardId) {
          flugRef.current = null;
          setFlugState(null);
        }
        setPendingPlay((p) => (p && p.card.id === cardId ? null : p));
      }, 4000);
    },
    [send, view?.seat],
  );

  // Der Server hat den Zug uebernommen, sobald die Karte aus der Hand
  // verschwindet: Sperre loesen. Und eine Vormerkung, deren Karte die Hand
  // verlaesst (Armut-Tausch), verfaellt.
  const handKey = (view?.view.round?.hand ?? []).map((c) => c.id).join('.');
  useEffect(() => {
    const inHand = (id: number | null): boolean =>
      id !== null && handRef.current.some((c) => c.id === id);
    if (flugRef.current !== null && !inHand(flugRef.current)) {
      flugRef.current = null;
      setFlugState(null);
    }
    setVorgemerkt((v) => (v !== null && !inHand(v) ? null : v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  // Vormerkung einloesen: Sobald die Karte zulaessig spielbar ist, fliegt
  // sie von selbst. Ist der Sitz am Zug und die Karte NICHT dabei (Bedienen
  // unmoeglich), verfaellt die Vormerkung.
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

  // Sobald der Serverstand die Karte fuehrt (im laufenden oder im letzten
  // Stich), ist die optimistische Kopie erledigt.
  const liveTrickIds = (view?.view.round?.currentTrick ?? [])
    .map((p) => p.card.id)
    .join('.');
  useEffect(() => {
    if (!pendingPlay) return;
    const id = pendingPlay.card.id;
    const imStich = (view?.view.round?.currentTrick ?? []).some((p) => p.card.id === id);
    const imLetzten =
      view?.view.round?.lastTrick?.played.some((p) => p.card.id === id) ?? false;
    if (imStich || imLetzten) setPendingPlay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlay, liveTrickIds]);

  // Der volle Stich bleibt eine Sekunde liegen, bevor er abgeraeumt wird.
  // Der Server raeumt sofort (currentTrick leer, lastTrick gefuellt); hier
  // wird der letzte Stich kurz weitergezeigt. seenKey verhindert das
  // Aufblitzen beim Beitritt mitten in einer Runde.
  const lastTrickNow = view?.view.round?.lastTrick ?? null;
  const lastKey = lastTrickNow
    ? lastTrickNow.played.map((p) => p.card.id).join('.')
    : null;
  /**
   * Solo, das gerade zur Bestaetigung steht — null, wenn keines.
   *
   * Steuert nur die Sortierung der eigenen Hand als Vorschau. Bestaetigt wird
   * damit nichts; abgeschickt wird erst im Dialog.
   */
  const [soloVorschau, setSoloVorschau] = useState<string | null>(null);
  /*
   * Ist die Vorbehaltsphase vorbei, ist die Solo-Vorschau vorbei — sonst bliebe
   * die Hand nach der Ordnung eines Solos liegen, das nie zustande kam.
   *
   * MUSS vor den fruehen Returns stehen (Regel der Hooks): Ein useEffect nach
   * `if (!view) return` liefe nur bei laufendem Spiel und aenderte die Hook-Zahl
   * zwischen Wartebereich und Tisch — genau der React-#310-Freeze beim Start mit
   * Bots. An der Phase aufgehaengt, nicht am Sichten-Objekt.
   */
  const vorbehaltPhase = view?.view.round?.phase;
  useEffect(() => {
    if (vorbehaltPhase !== 'vorbehalt') setSoloVorschau(null);
  }, [vorbehaltPhase]);
  const [frozenKey, setFrozenKey] = useState<string | null>(null);
  // Nach dem Liegen gleitet der Stich zum Gewinner: kurze Sweep-Phase.
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
      const abraeumen = (): void => {
        setSweeping(false);
        setFrozenKey((k) => (k === lastKey ? null : k));
      };
      // Lange genug gelegen: jetzt zum Gewinner gleiten, dann abraeumen.
      const gleiten = (): void => {
        if (sweepHandle) return; // schon unterwegs
        if (reduce) {
          abraeumen();
          return;
        }
        setSweeping(true);
        sweepHandle = setTimeout(abraeumen, 440);
      };
      const handle = setTimeout(gleiten, 1600);
      // Wer waehrend des Liegens schon die naechste Karte legt, will nicht
      // warten: Der Stich gleitet sofort zum Gewinner.
      skipFreeze.current = () => {
        clearTimeout(handle);
        gleiten();
      };
      return () => {
        skipFreeze.current = null;
        clearTimeout(handle);
        if (sweepHandle) clearTimeout(sweepHandle);
      };
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

  // Neues Geben: Die Kartennummern werden neu vergeben; Marker, Vormerkung
  // und optimistische Karte der alten Runde waeren dann falsch.
  useEffect(() => {
    if (!dealKey) return;
    selbstGelegt.current.clear();
    setPendingPlay(null);
    setVorgemerkt(null);
    flugRef.current = null;
    setFlugState(null);
  }, [dealKey]);
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
  // Eigenes "Weiter" ist beim Server angekommen; jetzt heisst es warten,
  // bis die anderen durch sind oder die Rundenpause ablaeuft.
  const [weiterGesendet, setWeiterGesendet] = useState(false);
  const gesehenAbschluss = useRef<string | null>(null);
  useEffect(() => {
    if (!finishedKey) {
      setShowTrickPeek(false);
      setAbschlussStep('none');
      setWeiterGesendet(false);
      return;
    }
    if (gesehenAbschluss.current === finishedKey) return;
    gesehenAbschluss.current = finishedKey;
    setWeiterGesendet(false);

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
    // NUR finishedKey: Waehrend der Rundenpause funkt der Server weiter
    // (Bot-"Weiter" u.a.). Hinge das Objekt view.round mit in der Liste,
    // raeumte jeder Funkspruch den Peek-Timer ab, der Fruehausstieg oben
    // stellte ihn nie neu - und Auswertung wie Zwischenstand blieben aus.
  }, [finishedKey]);

  // Fallback-Autofluss, falls niemand auf "Weiter" tippt. Der Server haelt
  // die Rundenpause 15 s; mit 1,5 s Stapel-Blick und 7 s Auswertung bleiben
  // dem Zwischenstand gut 6 s, bevor das neue Geben die Blaetter ersetzt.
  useEffect(() => {
    if (abschlussStep !== 'abrechnung') return;
    const t = window.setTimeout(() => setAbschlussStep('zwischenstand'), 7_000);
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

  /**
   * Ton am Tisch — dieselben sieben Anlaesse wie beim Zauberer.
   *
   * Der Aufruf steht bewusst VOR jedem bedingten `return`: Ein Haken, der nur
   * manchmal laeuft, ist keiner. Waehrend des Wartebereichs sind die Werte
   * schlicht leer, und `useTischklang` klingt beim ersten Blick ohnehin nie.
   *
   * Musik bleibt hier absichtlich aussen vor: Welches Stueck am Tisch laeuft,
   * haengt am gewaehlten Ton aus dem Shop und wird eine Ebene hoeher gesetzt.
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
    abschluss: finishedKey,
    partieFertig: view?.finished ?? false,
    gewonnen: meinPlatz === null ? null : meinPlatz === 1,
    fehler: error,
  });

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
        <Ladekreis bild="/hub/lade-pinguin.webp" text={ladeText} />
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

  // Vormerken geht nur mitten im Spiel, wenn man gerade NICHT dran ist: Der
  // Tipp legt die Karte bereit, gespielt wird von selbst, sobald der Zug
  // kommt und die Karte dann zulaessig ist.
  const darfVormerken = playable.size === 0 && round?.phase === 'playing';

  // Die Vorbehaltsabfrage ist ein eigener Dialog (gesund ja/nein, dann
  // Auswahl, dann Bestaetigung) - keine Knopfreihe am unteren Rand, auf der
  // ein Fehltipp eine ganze Runde entscheidet.
  const vorbehaltActions = otherActions.filter((action) => action.type === 'vorbehalt');
  // "Weiter" gehoert aufs Zwischenstand-Blatt, nicht in die Knopfreihe.
  const weiterAction = otherActions.find((action) => action.type === 'weiter');
  const rowActions = otherActions.filter(
    (action) => action.type !== 'vorbehalt' && action.type !== 'weiter',
  );

  const opponents = Array.from({ length: seatCount }, (_, s) => s).filter(
    (s) => view.seat === null || s !== view.seat,
  );

  // Die eigene Ansage - dieselbe Herleitung wie bei den Mitspielern.
  const meineAnsage = view.seat !== null ? ansageVon(round, view.seat) : null;

  /*
   * Solange ein Solo zur Bestaetigung steht, liegt die Hand nach DESSEN
   * Trumpfordnung. Die Ordnung kommt vom Server (`soloVorschau`) — der Client
   * rechnet keine Trumpfordnung aus, das bleibt Sache des Spielmoduls.
   * Bestaetigt man nicht, faellt sie auf die echte Ordnung zurueck.
   */
  const vorschauOrder = soloVorschau ? round?.soloVorschau?.[soloVorschau] : undefined;
  const hand = round ? sortByOrder(round.hand, vorschauOrder ?? round.order) : [];

  const dealSlots: DealSlot[] = LAYOUTS[seatCount] ?? ['bottom', 'left', 'top', 'right'];
  const liveTrick = round?.currentTrick ?? [];
  // Frisch voller Stich: eine Sekunde liegen lassen — auch dann, wenn der
  // naechste Spieler schon die erste Karte des neuen Stichs gelegt hat. Ohne
  // diese Haerte raeumte der erste schnelle Bot den Stich sofort wieder ab.
  const frozenActive = frozenKey !== null && frozenKey === lastKey && lastTrickNow !== null;
  const serverTrick = frozenActive ? lastTrickNow!.played : liveTrick;
  // Optimistisch: Die eigene Karte liegt schon da, waehrend die Antwort des
  // Servers noch unterwegs ist. Nie doppelt, nie waehrend des Stich-Freeze.
  const trick =
    !frozenActive &&
    pendingPlay &&
    !serverTrick.some((p) => p.card.id === pendingPlay.card.id)
      ? [...serverTrick, pendingPlay]
      : serverTrick;
  const phaseText = round ? t(`phase.${round.phase}`) : 'Zwischen den Runden';
  const showHands = !dealing;

  // Aufspiel: wer den Stich anspielt. Laeuft ein Stich, ist es, wer die erste
  // Karte gelegt hat; ist er leer, der, der gerade herauskommt.
  const leaderSeat = trick.length > 0 ? trick[0]!.seat : view.currentActor;
  // Der eigene Zuruf, damit der Sender ihn ueber sich selbst aufblitzen sieht.
  const meinEmote = view.seat !== null ? emotes[view.seat] : undefined;

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
          {/* Zurufe nur fuer Mitspieler: Am echten Tisch redet mit, wer
              mitspielt. */}
          {view.seat !== null && (
            <EmoteLeiste
              besessen={meineEmotes}
              onSenden={sendEmote}
              onKaufen={() => setZeigeEmoteHinweis(true)}
            />
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
            schweine={round?.schweineSeats?.includes(seat) ?? false}
            sagt={blasen[seat] ?? null}
            emote={emotes[seat] ?? null}
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
                  (aeusseres Element) davon unberuehrt bleibt. Die eigene Karte
                  kam schon per Gleitflug an und faellt nicht noch einmal ein. */}
                <div
                  className={`doko-trick-in${
                    selbstGelegt.current.has(played.card.id) ? ' is-direkt' : ''
                  }${
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
          reason={round.pendingPflichtansage.reason}
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
              className={`doko-action${action.type === 'announce' ? ' doko-action--call' : ''}${
                action.type === 'announce' && round?.myParty
                  ? ` doko-action--${round.myParty}`
                  : ''
              }`}
              onClick={() => send(action)}
            >
              {actionLabel(action, round?.myParty)}
            </button>
          ))}
        </div>
      )}

      {/* Vorbehaltsabfrage als Dialog mit Bestaetigung — erst nach dem Geben. */}
      {vorbehaltActions.length > 0 && !round?.pendingPflichtansage && !dealing && (
        <VorbehaltDialog
          actions={vorbehaltActions}
          onSend={send}
          onVorschau={setSoloVorschau}
          pflichtsoloOffen={round?.pflichtsoloOffen}
          eigenerSitz={view.seat}
          nameOf={nameOf}
        />
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
          /* Waehrend der Rundenpause zaehlt roundIndex schon die naechste
             Runde; verbleibend ist also die Differenz ohne Abzug. */
          restRunden={Math.max(0, view.view.totalRounds - view.view.roundIndex)}
          warten={weiterGesendet || !weiterAction}
          onWeiter={() => {
            // Das "Weiter" geht an den Server: Die naechste Runde beginnt,
            // sobald alle anwesenden Sitze durch sind - oder die Pause
            // ablaeuft. Das Blatt bleibt solange stehen.
            if (weiterAction) send(weiterAction);
            setWeiterGesendet(true);
          }}
        />
      )}

      {zeigeRegeln && <RegelBlatt tableId={tableId} onClose={() => setZeigeRegeln(false)} />}

      {/* Kein Weg in den Shop mitten aus der Partie: Wer hier sitzt, spielt.
          Der Hinweis sagt, wo es sie gibt, und laesst den Tisch in Ruhe. */}
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
        <span className="doko-me-avatar">
          {meinEmote && <EmoteBlase emote={meinEmote} />}
          <Avatar
            name={view.seat === null ? 'Du' : nameOf(view.seat)}
            seatIndex={view.seat ?? 0}
            active={view.currentActor === view.seat}
            deadline={view.currentActor === view.seat ? view.turnDeadline : null}
            avatarUrl={view.seat === null ? null : avatarOf(view.seat)}
            you
          />
        </span>
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
          {/* Was ICH angesagt habe, bleibt deutlich stehen - dieselbe
              goldene Marke wie bei den Mitspielern, damit man den eigenen
              Ruf wiedererkennt. */}
          {view.seat !== null && meineAnsage && (
            <em className="doko-tag doko-tag--ansage doko-tag--eigen">{meineAnsage}</em>
          )}
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
          {/* Die Reihe rueckt schon zusammen, WAEHREND die Karte fliegt -
              nicht erst, wenn der Server sie aus der Hand nimmt. Sonst gaebe
              es nach dem Landen einen zweiten Ruck. Die fliegende Karte
              selbst behaelt ihren alten Platz als Startpunkt. Hat der Server
              sie schon aus der Hand genommen (flugIndex -1), liegt die Reihe
              bereits richtig. */}
          {showHands &&
            hand.map((card, index) => {
              const flugIndex = flug === null ? -1 : hand.findIndex((c) => c.id === flug);
              const fliegt = card.id === flug;
              const layoutIndex =
                fliegt || flugIndex === -1 ? index : index - (flugIndex < index ? 1 : 0);
              const layoutTotal = fliegt || flugIndex === -1 ? hand.length : hand.length - 1;
              return (
                <HandCard
                  key={card.id}
                  card={card}
                  deck={deck}
                  index={layoutIndex}
                  total={layoutTotal}
                  playable={playable.has(card.id)}
                  locked={flug !== null}
                  markable={darfVormerken}
                  marked={vorgemerkt === card.id}
                  trump={isTrump(card)}
                  legt={fliegt}
                  onPlay={startPlay}
                  onMark={toggleVormerken}
                />
              );
            })}
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
  schweine,
  sagt,
  emote,
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
  /**
   * Haelt dieser Sitz die Schweine? Bleibt dauerhaft stehen.
   *
   * Der Server liefert das nur, wenn die Regel es zur Pflichtansage macht —
   * dann weiss der Tisch es ohnehin. Eine Blase, die nach drei Sekunden weg
   * ist, hilft niemandem, der den Trumpfwechsel noch einordnen muss.
   */
  schweine: boolean;
  /** Kurzer Zuruf, verschwindet nach ein paar Sekunden von selbst. */
  sagt: string | null;
  /** Zuruf ueber diesem Sitz, oder null. */
  emote: string | null;
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
        {schweine && (
          <em className="doko-tag doko-tag--schweine" title="Hält die Schweine">
            🐷 Schweine
          </em>
        )}
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

/** Teamzugehoerigkeit unter dem Namen: "Team Re" / "Team Kontra". */
function partyLabel(party: string): string {
  return party === 're' ? 'Team Re' : 'Team Kontra';
}

/** Der blosse Parteiname ohne "Team" - fuer Ansagen und Rufe. */
function parteiName(party: string): string {
  return party === 're' ? 'Re' : 'Kontra';
}

// ---------------------------------------------------------------------------
// Aktionen und Overlays
// ---------------------------------------------------------------------------

function actionLabel(action: Action, myParty?: string | null): string {
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
      // Stufe 0 ist die eigene Partei-Ansage. Sie heisst nach der eigenen
      // Partei - die Re-Partei sagt "Re ansagen", die Kontra-Partei
      // "Kontra ansagen". "Re / Kontra" liess offen, was man da eigentlich
      // tut.
      if (level === 0) return myParty ? `${parteiName(myParty)} ansagen` : 'Ansagen';
      return ['', 'Keine 90', 'Keine 60', 'Keine 30', 'Schwarz'][level] ?? 'Ansage';
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
  onVorschau,
  pflichtsoloOffen,
  eigenerSitz,
  nameOf,
}: {
  actions: Action[];
  onSend: (action: Action) => void;
  /**
   * Meldet, welches Solo gerade zur Bestaetigung steht — oder null.
   *
   * Der Tisch sortiert die Hand daraufhin nach der Trumpfordnung dieses Solos,
   * solange nicht bestaetigt ist. Wer bei einem Damensolo nicht sieht, dass
   * seine vier Damen oben stehen, muss sich die Umsortierung im Kopf vorstellen
   * — und das ist die eigentliche Entscheidung.
   */
  onVorschau?: (solo: string | null) => void;
  pflichtsoloOffen?: number[];
  eigenerSitz: number | null;
  nameOf: (seat: number) => string;
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
    onVorschau?.(action.kind === 'solo' ? String(action.solo) : null);
  };

  /** Zurueck heisst auch: Vorschau weg, die Hand liegt wieder normal. */
  const zurueck = (ziel: 'frage' | 'auswahl'): void => {
    onVorschau?.(null);
    setSchritt(ziel);
  };

  // Die Vorfuehrung trifft nur, wer sein Pflichtsolo noch offen hat. Ohne diese
  // Zeile ist am Tisch nicht zu sehen, wer das ist — und wer selbst dazugehoert.
  const offen = pflichtsoloOffen ?? [];
  const ichOffen = eigenerSitz !== null && offen.includes(eigenerSitz);

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
              <button className="doko-sheet-zurueck" onClick={() => zurueck('frage')}>
                Zurück
              </button>
            )}
          </>
        )}

        {/* Wer sein Pflichtsolo noch offen hat, steht hier — auch der eigene
            Sitz. Das entscheidet mit, ob man freiwillig ein Solo waehlt oder
            darauf wartet, vorgefuehrt zu werden. */}
        {offen.length > 0 && (
          <p className="muted vb-pflichtsolo">
            Pflichtsolo offen:{' '}
            {offen.map((s) => (s === eigenerSitz ? 'du' : nameOf(s))).join(', ')}
            {ichOffen ? ' — dich kann es noch treffen.' : ''}
          </p>
        )}

        {schritt === 'bestaetigen' && wahl && (
          <>
            <h2>{actionLabel(wahl)} ansagen?</h2>
            {/* Die Hand im Hintergrund liegt jetzt nach der Trumpfordnung
                dieses Solos. Ohne diesen Hinweis wirkt die Umsortierung wie
                ein Fehler. */}
            {wahl.kind === 'solo' && (
              <p className="muted">
                Deine Karten liegen zur Probe schon in der Reihenfolge dieses
                Solos. Zurück stellt sie wieder her.
              </p>
            )}
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
                onClick={() => zurueck(wahl === gesund ? 'frage' : 'auswahl')}
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
 * Der Anlass gehoert in den Text.
 *
 * "Der erste Stich hatte 32 Augen" stand hier fest verdrahtet — falsch, sobald
 * es mehr als einen Ausloeser gibt: Bei einer Hochzeit zaehlt der
 * Klaerungsstich, und Schweine oder Armut haben mit Augen gar nichts zu tun.
 * Wer nicht weiss, warum er ansagen muss, haelt es fuer einen Fehler.
 */
function pflichtGrund(reason: string | undefined, points: number): string {
  switch (reason) {
    case 'hochzeit':
      return `Der Klärungsstich hatte ${points} Augen.`;
    case 'schweine':
      return 'Du hältst die Schweine.';
    case 'armut':
      return 'Du spielst die Armut.';
    default:
      return `Der Stich hatte ${points} Augen.`;
  }
}

function Pflichtansage({
  points,
  canDecline,
  reason,
  onDecide,
}: {
  points: number;
  canDecline: boolean;
  reason?: string;
  onDecide: (accept: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="doko-sheet">
      <div className="doko-sheet-card">
        <h2>Pflichtansage</h2>
        <p>
          {pflichtGrund(reason, points)}{' '}
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
  /**
   * Abgeschickt: Der Knopf zeigt es und sperrt sich, statt stumm zu bleiben.
   * Nimmt der Server an, verschwindet das Blatt von selbst (awaiting kippt).
   * Kommt nichts zurueck (Funkloch, Ablehnung), oeffnet sich der Knopf nach
   * kurzer Zeit wieder - man kann es erneut versuchen.
   */
  const [gesendet, setGesendet] = useState(false);
  useEffect(() => {
    if (!gesendet) return;
    const t = window.setTimeout(() => setGesendet(false), 2500);
    return () => window.clearTimeout(t);
  }, [gesendet]);

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
          disabled={gesendet || picked.length !== count}
          onClick={() => {
            setGesendet(true);
            onPick(picked);
          }}
        >
          {gesendet
            ? 'Wird übergeben …'
            : picked.length === count
              ? 'Karten übergeben'
              : `${picked.length} von ${count} gewählt`}
        </button>
      </div>
    </div>
  );
}

const ABSAGE_NAMEN = ['Keine 90', 'Keine 60', 'Keine 30', 'Schwarz'];

/** Zuruf einer Ansage. Stufe 0 ist Re oder Kontra, darueber die Absagen. */
function ansageRuf(level: number, party: string | null): string {
  if (level > 0) return ABSAGE_NAMEN[level - 1] ?? 'Ansage';
  return party ? parteiName(party) : 'Ansage';
}

/** Zuruf eines Vorbehalts. Das Solo nennt seine Art erst bei der Auflösung. */
function vorbehaltRuf(kind: string): string {
  return (
    { solo: 'Solo', schmeiss: 'Ich schmeiße', armut: 'Armut', hochzeit: 'Hochzeit' }[kind] ??
    'Vorbehalt'
  );
}

/**
 * Bleibender Vermerk am Sitz: was dieser Spieler ANGESAGT hat.
 *
 * Das ist bewusst etwas anderes als die Teamzugehoerigkeit daneben: "Team
 * Re" sagt, zu welcher Partei jemand gehoert (auch wenn er nur die
 * Kreuz-Dame gelegt hat); dieser Vermerk erscheint nur, wenn er selbst "Re"
 * bzw. "Kontra" gerufen hat - und das soll man ihm dauerhaft ansehen, samt
 * hoechster Absage. Ohne Ansage bleibt er leer.
 */
function ansageVon(
  round: {
    ansagen?: readonly { seat: number; level: number }[];
    knownParties?: Record<number, string>;
  } | null,
  seat: number,
): string | null {
  const meine = (round?.ansagen ?? []).filter((a) => a.seat === seat);
  if (meine.length === 0) return null;
  const partei = round?.knownParties?.[seat];
  const basis = partei ? parteiName(partei) : 'Angesagt';
  const hoechste = meine.reduce((m, a) => Math.max(m, a.level), 0);
  return hoechste > 0 ? `${basis} · ${ABSAGE_NAMEN[hoechste - 1] ?? ''}`.trim() : basis;
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
        {/* Ohne diesen Satz sieht die Auswertung wie ein Rechenfehler aus: Die
            Augenspalte zeigt einen klaren Sieger, gewonnen hat die andere
            Seite. Der Grund muss dastehen, wo das Ergebnis steht. */}
        {result.feigling && (
          <p className="doko-feigling">
            <strong>Feigling.</strong> {reGewinnt ? 'Kontra' : 'Re'} hatte die
            Augen, aber zu niedrig angesagt — die Punkte gehen an die
            Gegenpartei. Sonderpunkte bleiben, wo sie erspielt wurden.
          </p>
        )}
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
  warten,
  onWeiter,
}: {
  seats: SitzInfo[];
  scores: Record<number, number>;
  restRunden: number;
  /** Eigenes "Weiter" ist raus (oder es gibt keines, etwa als Zuschauer). */
  warten: boolean;
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
        <button className="primary" disabled={warten} onClick={onWeiter}>
          {warten ? 'Warte auf die anderen …' : 'Weiter'}
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
