/**
 * Verbindung zum Tisch.
 *
 * Der Client haelt keinen eigenen Verlauf: Beim Verbinden schickt der Server
 * die vollstaendige Sicht. Nachrichten mit kleinerer Revisionsnummer sind
 * ueberholt und werden verworfen.
 *
 * Die Leitung haelt sich selbst am Leben. Handybrowser kappen die WebSocket,
 * sobald der Tab in den Hintergrund geht - fuer den Nutzer ist das nur ein
 * kurzer Blick auf eine Nachricht. Frueher kam er dann auf einen toten Tisch
 * zurueck: keine neue Karte, kein Zug, nichts. Jetzt gilt:
 *
 *   1. Bricht die Leitung unerwartet ab, verbindet der Client von selbst neu -
 *      mit wachsender Wartezeit, damit ein Serverhuepfer nicht in einen Sturm
 *      ausartet.
 *   2. Kommt der Tab zurueck (sichtbar, Fokus, Netz zurueck, Ruecksprung aus
 *      dem Verlauf), wird sofort abgeglichen. Steht die Leitung noch, kostet
 *      das nur ein erneutes `join` und bringt die volle Sicht zurueck; ist sie
 *      still gestorben, meldet ein Wachhund das und baut neu auf.
 *   3. `reconnect()` macht dasselbe auf Knopfdruck - fuer den Fall, dass doch
 *      einmal etwas haengt.
 *
 * Weil der Server beim `join` ohnehin die ganze Sicht schickt, ist jeder
 * Wiederaufbau zugleich ein sauberer Abgleich. Der Client muss nichts
 * zwischenspeichern.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { wsProtokolle, wsUrl } from './laufzeit';
/**
 * Die Verbindung schreibt mit, solange eine Partie aufgezeichnet wird
 * (heute nur Feldherr, siehe aufzeichnung.ts). Ohne laufende Aufzeichnung
 * kostet jeder dieser Aufrufe einen Vergleich — deshalb stehen sie hier
 * und nicht in einem Spielbildschirm: Wann die Leitung fiel, wann neu
 * verbunden wurde und wie lange die Pause war, weiss nur diese Datei, und
 * genau das ist bei einer strittigen Partie die erste Frage.
 */
import { notiere } from './aufzeichnung';
import { EMOTE_DAUER_MS, EMOTE_PAUSE_MS } from './emotes';
import { spiele } from './klang';
import {
  ENVELOPE_VERSION,
  type BotLevel,
  type GameView,
  type PartyMessage,
  type ServerMessage,
  type TableMessage,
  type ReaktionMessage,
  type TaktMessage,
  type ViewMessage,
  moduleVersionFor,
} from './protocol';

/** Verbindungszustand, feiner aufgeloest als ein bloßes „verbunden ja/nein". */
export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface TableConnection<V = GameView> {
  view: ViewMessage<V> | null;
  party: PartyMessage | null;
  /** Zustand des Tisches, auch bevor eine Partie laeuft. */
  table: TableMessage | null;
  error: string | null;
  connected: boolean;
  /** Fuer Statusanzeige und den „Neu verbinden"-Hinweis. */
  status: ConnectionStatus;
  send(action: unknown): void;
  /**
   * Zurufe, die gerade ueber dem Tisch stehen — je Sitz hoechstens einer.
   * Sie verschwinden von selbst; der Tisch muss nichts aufraeumen.
   */
  emotes: Record<number, string>;
  /** Einen Zuruf absetzen. Zu schnell hintereinander verpufft still. */
  sendEmote(emote: string): void;
  /** Freien Platz mit einem Bot belegen bzw. den Bot wieder entfernen. */
  addBot(seat: number): void;
  removeBot(seat: number): void;
  /** Spielstärke der Bots dieses Tisches setzen (gilt für alle Bots). */
  setBotLevel(level: BotLevel): void;
  /**
   * Takt-Herzschlag eines Echtzeitspiels absetzen. Ohne Warteschlange: Ein
   * Puls, der erst nach dem Wiederverbinden ankaeme, beschriebe einen Stand,
   * den es nicht mehr gibt — der naechste ist ohnehin in 200 ms da.
   */
  sendTakt(daten: { takt: number; grenzTakt: number; pruef: string }): void;
  /**
   * Eine Reaktion absetzen (Nummer im Zeichenvorrat des Spiels).
   *
   * Wie der Zuruf ohne Warteschlange: Ein Emoji, das nach dem
   * Wiederverbinden nachkaeme, gehoerte zu einem Moment, den es nicht mehr
   * gibt.
   */
  sendeReaktion(zeichen: number): void;
  /** Von Hand neu verbinden und die volle Sicht neu anfordern. */
  reconnect(): void;
}

/** Groesste Wartezeit zwischen zwei automatischen Versuchen. */
const MAX_BACKOFF_MS = 15_000;
/** Kommt nach einem Abgleich in dieser Zeit kein Wort, gilt die Leitung als tot. */
const RESYNC_WATCHDOG_MS = 3_000;
/** Nicht oefter als so abgleichen - Sicht-/Fokus-Ereignisse feuern oft im Doppel. */
const RESYNC_THROTTLE_MS = 800;

export function useTable<V = GameView>(
  tableId: string | null,
  gameId = 'doppelkopf',
  /**
   * Eingehende Takt-Herzschlaege. Als Rueckruf statt als State: Sie kommen
   * fuenfmal je Sekunde, und ein setState je Puls zeichnete den ganzen
   * Bildschirm fuenfmal je Sekunde neu — fuer eine Nachricht, die nur der
   * Spielkern braucht.
   */
  beiTakt?: (nachricht: TaktMessage) => void,
  /**
   * Jede frische Sicht, SOFORT beim Eintreffen — vor React. Der Weg ueber
   * setState und Effekt kann sich um hunderte Millisekunden verspaeten,
   * besonders im verdeckten Tab. Fuer Kartenspiele ist das egal; im
   * Gleichschritt rechnet der Spielkern derweil ueber den Takt des
   * eintreffenden Zuges hinweg, fuehrt ihn verschoben aus, und die Partie
   * laeuft still auseinander. Genau so ist ein Haus-Zug zerbrochen.
   */
  beiSicht?: (nachricht: ViewMessage<V>) => void,
  /**
   * Der Server hat eine Aktion abgewiesen. Fuer Kartenspiele genuegt der
   * Fehlertext; im Gleichschritt nicht: Dort haengt der abgewiesene Zug
   * weiter in der Schwebe und deckelt den gemeldeten Stand, bis er
   * verfaellt. Der Tisch muss es also erfahren, nicht nur der Spieler.
   */
  beiAbweisung?: (code: string) => void,
  /**
   * Eine Reaktion der Gegenseite. Als Rueckruf und nicht als State: Sie kommt
   * bis zu viermal je Sekunde, und ein setState je Emoji zeichnete den ganzen
   * Bildschirm neu — fuer etwas, das nur eine Animation auszuloesen hat.
   */
  beiReaktion?: (nachricht: ReaktionMessage) => void,
): TableConnection<V> {
  const [view, setView] = useState<ViewMessage<V> | null>(null);
  const [party, setParty] = useState<PartyMessage | null>(null);
  const [table, setTable] = useState<TableMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const socketRef = useRef<WebSocket | null>(null);
  const revisionRef = useRef(-1);
  /** Zaehlt bei jedem Aufbau hoch; Rueckläufer alter Sockets werden verworfen. */
  const genRef = useRef(0);
  /** Fehlversuche in Folge - bestimmt die Wartezeit. */
  const attemptRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResync = useRef(0);
  /** Absicht: Unmount oder Tischwechsel. Dann NICHT neu verbinden. */
  const closingRef = useRef(false);
  /**
   * Aktionen, die waehrend einer Funkstille getippt wurden. Sie werden nach
   * dem Wiederverbinden nachgereicht statt stumm verschluckt - mit kurzer
   * Frist, denn ein uralter Zug richtet mehr Verwirrung an als sein Verlust.
   */
  const outboxRef = useRef<{ payload: string; bis: number }[]>([]);

  /**
   * Zurufe ueber dem Tisch, je Sitz hoechstens einer.
   *
   * Die Timer haengen an einer Referenz und nicht am Aufraeumen eines
   * Effekts: Der liefe bei jeder Tischnachricht neu, und der naechste
   * gespielte Zug loeschte den Timer — der Zuruf bliebe bis zum Rundenende
   * stehen. Dieselbe Falle wie bei den Ansage-Blasen.
   */
  const emoteTimer = useRef<Record<number, number>>({});
  const [emotes, setEmotes] = useState<Record<number, string>>({});
  /** Wann zuletzt selbst gerufen wurde — die Bremse vor dem Absenden. */
  const letzterEmote = useRef(0);

  /**
   * Der Rueckruf haengt an einer Referenz, nicht am Socket-Aufbau: onmessage
   * entsteht einmal je Verbindung, der Aufrufer gibt aber bei jedem
   * Neuzeichnen eine frische Funktion herein. Ohne die Referenz riefe der
   * Socket fuer immer die allererste.
   */
  const beiTaktRef = useRef(beiTakt);
  beiTaktRef.current = beiTakt;
  const beiSichtRef = useRef(beiSicht);
  beiSichtRef.current = beiSicht;
  const beiAbweisungRef = useRef(beiAbweisung);
  beiAbweisungRef.current = beiAbweisung;
  const beiReaktionRef = useRef(beiReaktion);
  beiReaktionRef.current = beiReaktion;

  const zeigeEmote = useCallback((seat: number, emote: string): void => {
    // Der Klang haengt an dieser einen Stelle und nicht an den Tischen: Beide
    // Spiele bekommen Zurufe ueber denselben Weg, und was hier steht, gilt
    // damit fuer beide. Auch fuer den eigenen Zuruf - man will hoeren, dass
    // er rausgegangen ist.
    spiele('emote');
    setEmotes((alt) => ({ ...alt, [seat]: emote }));
    window.clearTimeout(emoteTimer.current[seat]);
    emoteTimer.current[seat] = window.setTimeout(() => {
      setEmotes((alt) => {
        const rest = { ...alt };
        delete rest[seat];
        return rest;
      });
    }, EMOTE_DAUER_MS);
  }, []);

  // Beim Verlassen des Tisches alle offenen Zuruf-Timer abraeumen.
  useEffect(
    () => () => {
      for (const handle of Object.values(emoteTimer.current)) window.clearTimeout(handle);
    },
    [],
  );

  const clearRetry = (): void => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  };
  const clearWatchdog = (): void => {
    if (watchdogTimer.current) {
      clearTimeout(watchdogTimer.current);
      watchdogTimer.current = null;
    }
  };

  const joinPayload = useCallback(
    (): string =>
      JSON.stringify({
        v: ENVELOPE_VERSION,
        game: gameId,
        type: 'join',
        tableId,
        moduleVersion: moduleVersionFor(gameId),
      }),
    [gameId, tableId],
  );

  /**
   * Baut eine frische Verbindung auf. Ein noch offener Socket wird vorher still
   * gelegt - seine Rueckläufer werden ueber die Generationsnummer verworfen -,
   * damit nie zwei Leitungen um dieselbe Sicht streiten.
   */
  const connect = useCallback((): void => {
    if (!tableId) return;
    clearRetry();
    clearWatchdog();

    const previous = socketRef.current;
    if (previous) {
      previous.onopen = null;
      previous.onmessage = null;
      previous.onclose = null;
      previous.onerror = null;
      try {
        previous.close();
      } catch {
        /* schon zu, egal */
      }
      socketRef.current = null;
    }

    const gen = ++genRef.current;
    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    // Adresse und Unterprotokolle kommen aus der Laufzeit: im Browser
    // dieselbe Herkunft und das Cookie, in der App der Server im Netz und
    // das Token als Unterprotokoll. Siehe laufzeit.ts.
    const socket = new WebSocket(wsUrl(), wsProtokolle());
    socketRef.current = socket;

    socket.onopen = () => {
      if (genRef.current !== gen) return;
      notiere('ws-offen', { versuche: attemptRef.current, gen });
      attemptRef.current = 0;
      setStatus('open');
      socket.send(joinPayload());
      // Waehrend der Funkstille getippte Aktionen nachreichen. Veraltete
      // verfallen; was der Server nicht mehr brauchen kann, lehnt er ab -
      // das ist sichtbar, ein stilles Verschlucken war es nicht.
      const jetzt = Date.now();
      const offen = outboxRef.current.filter((e) => e.bis > jetzt);
      // Ein nachgereichter Zug traegt seinen ALTEN Takt — er kann beim
      // Gegner also zu spaet ankommen. Und ein verfallener ist schlicht
      // weg. Beides muss im Mitschnitt stehen.
      if (outboxRef.current.length > 0) {
        notiere('ws-nachgereicht', {
          n: offen.length,
          verfallen: outboxRef.current.length - offen.length,
        });
      }
      outboxRef.current = [];
      for (const eintrag of offen) socket.send(eintrag.payload);
    };

    socket.onmessage = (event) => {
      if (genRef.current !== gen) return;
      // Ein Lebenszeichen: ein etwaiger Wachhund darf einschlafen.
      clearWatchdog();
      const message = JSON.parse(event.data as string) as ServerMessage<V>;
      if (message.type === 'error') {
        // Die Fehlerschluessel des Servers sind die einzigen Fehlercodes, die
        // eine abgelehnte Aktion hinterlaesst — auf dem Geraet sieht man sie
        // nicht, und ein abgelehnter Zug ist genau das Loch, an dem die
        // Laeufe auseinandergehen.
        notiere('ws-abgelehnt', { code: message.messageKey });
        beiAbweisungRef.current?.(message.messageKey);
        setError(message.messageKey);
        return;
      }
      if (message.type === 'party') {
        setParty(message);
        return;
      }
      if (message.type === 'table') {
        setTable(message);
        setError(null);
        return;
      }
      if (message.type === 'emote') {
        zeigeEmote(message.seat, message.emote);
        return;
      }
      if (message.type === 'takt') {
        beiTaktRef.current?.(message);
        return;
      }
      if (message.type === 'reaktion') {
        beiReaktionRef.current?.(message);
        return;
      }
      /**
       * Der Zug-Rueckruf bekommt JEDE Sicht, auch eine veraltete.
       *
       * Fuer den angezeigten Zustand ist eine ueberholte Nachricht wertlos —
       * die wird unten weiter verworfen. Fuer eine anwachsende Zugliste ist
       * sie es nicht: Bei Feldherr traegt jede Sicht nur den Zuwachs, und
       * was hier verworfen wird, kommt nie wieder (der Server haelt sich
       * fuer beliefert). Ein fehlender Zug ist genau der Fehler, der zwei
       * Geraete still auseinanderlaufen laesst. Doppelt schadet dagegen
       * nichts: Der Empfaenger haengt anhand von `abIndex` nur an, was er
       * noch nicht hat.
       */
      beiSichtRef.current?.(message);
      // Veraltete Nachricht: Der Server war beim Senden schon weiter.
      if (message.revision < revisionRef.current) return;
      revisionRef.current = message.revision;
      setError(null);
      setView(message);
    };

    socket.onclose = () => {
      if (genRef.current !== gen) return;
      socketRef.current = null;
      clearWatchdog();
      if (closingRef.current) {
        setStatus('closed');
        return;
      }
      // Von selbst neu verbinden, mit wachsender Wartezeit und etwas Zufall,
      // damit nicht alle Clients im selben Moment zurueckstuermen.
      setStatus('reconnecting');
      const delay =
        Math.min(MAX_BACKOFF_MS, 500 * 2 ** attemptRef.current) +
        Math.floor(Math.random() * 400);
      notiere('ws-zu', { versuch: attemptRef.current, wartet: delay });
      attemptRef.current += 1;
      retryTimer.current = setTimeout(() => {
        if (genRef.current === gen) connect();
      }, delay);
    };

    socket.onerror = () => {
      // Ein Fehler zieht ein close nach sich; die Neuverbindung haengt dort.
    };
  }, [tableId, joinPayload]);

  /**
   * Bringt die Sicht auf den neuesten Stand - nach Rueckkehr in den Tab.
   * Steht die Leitung, genuegt ein erneutes `join`, und ein Wachhund faengt
   * den Fall ab, dass sie in Wahrheit tot ist. Steht sie nicht, wird sofort
   * neu verbunden - ohne Wartezeit, denn der Nutzer schaut gerade hin.
   */
  const resync = useCallback((): void => {
    if (!tableId || closingRef.current) return;
    const socket = socketRef.current;
    const open = socket !== null && socket.readyState === WebSocket.OPEN;

    if (open) {
      const now = Date.now();
      if (now - lastResync.current < RESYNC_THROTTLE_MS) return;
      lastResync.current = now;
      try {
        socket.send(joinPayload());
      } catch {
        attemptRef.current = 0;
        connect();
        return;
      }
      notiere('abgleich', { offen: true });
      clearWatchdog();
      watchdogTimer.current = setTimeout(() => {
        // Kein Lebenszeichen auf den Abgleich: Leitung tot, frisch aufbauen.
        notiere('wachhund');
        attemptRef.current = 0;
        connect();
      }, RESYNC_WATCHDOG_MS);
      return;
    }

    // Nicht offen (geschlossen, im Schließen oder gar keiner): sofort aufbauen.
    // Nur ein CONNECTING lassen wir in Ruhe - der laeuft schon.
    if (!socket || socket.readyState !== WebSocket.CONNECTING) {
      attemptRef.current = 0;
      connect();
    }
  }, [tableId, joinPayload, connect]);

  const reconnect = useCallback((): void => {
    attemptRef.current = 0;
    connect();
  }, [connect]);

  // Auf-/Abbau am Tisch. Wechselt der Tisch, faengt alles von vorne an.
  useEffect(() => {
    if (!tableId) return;
    closingRef.current = false;
    revisionRef.current = -1;
    attemptRef.current = 0;
    outboxRef.current = [];
    setView(null);
    setParty(null);
    setTable(null);
    setError(null);
    connect();

    return () => {
      closingRef.current = true;
      clearRetry();
      clearWatchdog();
      const socket = socketRef.current;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch {
          /* egal */
        }
        socketRef.current = null;
      }
    };
  }, [tableId, connect]);

  // Rueckkehr in den Tab. Am Handy ist das der eigentliche Ausloeser: Sicht
  // zurueck, Fenster im Fokus, Netz wieder da, oder ein Ruecksprung aus dem
  // Verlauf (pageshow - iOS holt die Seite aus dem Cache, ganz ohne Neuladen).
  useEffect(() => {
    if (!tableId) return;
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') resync();
    };
    const onPageShow = (): void => resync();
    const onFocus = (): void => resync();
    const onOnline = (): void => {
      attemptRef.current = 0;
      resync();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [tableId, resync]);

  const send = useCallback(
    (action: unknown) => {
      if (!tableId) return;
      const payload = JSON.stringify({
        v: ENVELOPE_VERSION,
        game: gameId,
        type: 'action',
        tableId,
        action,
      });
      const socket = socketRef.current;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
        return;
      }
      // Keine Verbindung: Die Aktion wird NICHT stumm verschluckt, sondern
      // kurz aufgehoben und nach dem Wiederverbinden nachgereicht. Genau so
      // verschwand die Armut-Abgabe: Handy kurz weg, Funk tot, Tipp ins
      // Leere - und niemand hat etwas gemerkt.
      notiere('ws-verwahrt', { grund: socket ? socket.readyState : 'kein-socket' });
      outboxRef.current.push({ payload, bis: Date.now() + 6000 });
      resync();
    },
    [tableId, gameId, resync],
  );

  /**
   * Zuruf absetzen.
   *
   * Die Bremse steht auch hier, nicht nur im Server: Was ohnehin verworfen
   * wuerde, muss die Leitung gar nicht erst belasten. Ein zu schneller Tipp
   * verpufft still — eine Meldung "zu schnell" waere Laerm um nichts.
   *
   * Nicht in die Warteschlange: Ein Zuruf, der nach dem Wiederverbinden
   * nachkaeme, gehoerte zu einem Moment, den es nicht mehr gibt.
   */
  const sendEmote = useCallback(
    (emote: string) => {
      const jetzt = Date.now();
      if (jetzt - letzterEmote.current < EMOTE_PAUSE_MS) return;
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !tableId) return;
      letzterEmote.current = jetzt;
      socket.send(
        JSON.stringify({
          v: ENVELOPE_VERSION,
          game: gameId,
          type: 'emote',
          tableId,
          emote,
        }),
      );
    },
    [tableId, gameId],
  );

  const sendTakt = useCallback(
    (daten: { takt: number; grenzTakt: number; pruef: string }) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !tableId) return;
      socket.send(
        JSON.stringify({
          v: ENVELOPE_VERSION,
          game: gameId,
          type: 'takt',
          tableId,
          takt: daten.takt,
          grenzTakt: daten.grenzTakt,
          pruef: daten.pruef,
        }),
      );
    },
    [tableId, gameId],
  );

  const sendeReaktion = useCallback(
    (zeichen: number) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !tableId) return;
      socket.send(
        JSON.stringify({ v: ENVELOPE_VERSION, game: gameId, type: 'reaktion', tableId, zeichen }),
      );
    },
    [tableId, gameId],
  );

  const command = useCallback(
    (type: 'addBot' | 'removeBot', seat: number) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !tableId) return;
      socket.send(JSON.stringify({ v: ENVELOPE_VERSION, game: gameId, type, tableId, seat }));
    },
    [tableId, gameId],
  );

  const addBot = useCallback((seat: number) => command('addBot', seat), [command]);
  const removeBot = useCallback((seat: number) => command('removeBot', seat), [command]);

  const setBotLevel = useCallback(
    (level: BotLevel) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !tableId) return;
      socket.send(
        JSON.stringify({ v: ENVELOPE_VERSION, game: gameId, type: 'setBotLevel', tableId, level }),
      );
    },
    [tableId, gameId],
  );

  return {
    view,
    party,
    table,
    error,
    connected: status === 'open',
    status,
    send,
    emotes,
    sendEmote,
    addBot,
    removeBot,
    setBotLevel,
    sendTakt,
    sendeReaktion,
    reconnect,
  };
}

/** Restzeit des Zugtimers in Sekunden, oder null wenn keiner laeuft. */
export function useCountdown(deadline: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (deadline === null) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const handle = setInterval(tick, 200);
    return () => clearInterval(handle);
  }, [deadline]);

  return left;
}
