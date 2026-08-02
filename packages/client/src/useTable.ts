/**
 * Verbindung zum Tisch.
 *
 * Der Client haelt keinen eigenen Verlauf: Beim Verbinden schickt der Server
 * die vollstaendige Sicht. Nachrichten mit kleinerer Revisionsnummer sind
 * ueberholt und werden verworfen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DOPPELKOPF_MODULE_VERSION,
  ENVELOPE_VERSION,
  type PartyMessage,
  type ServerMessage,
  type TableMessage,
  type ViewMessage,
} from './protocol';

export interface TableConnection {
  view: ViewMessage | null;
  party: PartyMessage | null;
  /** Zustand des Tisches, auch bevor eine Partie laeuft. */
  table: TableMessage | null;
  error: string | null;
  connected: boolean;
  send(action: unknown): void;
}

export function useTable(tableId: string | null, gameId = 'doppelkopf'): TableConnection {
  const [view, setView] = useState<ViewMessage | null>(null);
  const [party, setParty] = useState<PartyMessage | null>(null);
  const [table, setTable] = useState<TableMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const revisionRef = useRef(-1);

  useEffect(() => {
    if (!tableId) return;

    revisionRef.current = -1;
    setView(null);
    setParty(null);
    setTable(null);

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${location.host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      socket.send(
        JSON.stringify({
          v: ENVELOPE_VERSION,
          game: gameId,
          type: 'join',
          tableId,
          moduleVersion: DOPPELKOPF_MODULE_VERSION,
        }),
      );
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage;
      if (message.type === 'error') {
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
      // Veraltete Nachricht: Der Server war beim Senden schon weiter.
      if (message.revision < revisionRef.current) return;
      revisionRef.current = message.revision;
      setError(null);
      setView(message);
    };

    socket.onclose = () => setConnected(false);

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [tableId, gameId]);

  const send = useCallback(
    (action: unknown) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !tableId) return;
      socket.send(
        JSON.stringify({
          v: ENVELOPE_VERSION,
          game: gameId,
          type: 'action',
          tableId,
          action,
        }),
      );
    },
    [tableId, gameId],
  );

  return { view, party, table, error, connected, send };
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
