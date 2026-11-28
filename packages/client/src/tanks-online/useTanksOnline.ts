import { useEffect, useRef, useState } from 'react';
import { wsUrl } from '../laufzeit';
import type { OnlineStand } from '@brauweg/broremote-kern/tanks/online';
type Zugang = { code: string; token: string };
function gespeichert(): Zugang | null {
  try {
    const n = JSON.parse(sessionStorage.getItem('tanks-online') ?? 'null');
    return n && /^[A-F0-9]{8}$/.test(n.code) && /^[a-f0-9]{48}$/.test(n.token)
      ? n
      : null;
  } catch {
    return null;
  }
}
export function useTanksOnline() {
  const [stand, setStand] = useState<OnlineStand | null>(null),
    [verbunden, setVerbunden] = useState(false),
    [aktiv, setAktiv] = useState(false),
    [fehler, setFehler] = useState(''),
    [ping, setPing] = useState(0),
    [fortsetzen, setFortsetzen] = useState(gespeichert);
  const ws = useRef<WebSocket | null>(null),
    zugang = useRef<Zugang | null>(null),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    start = useRef<Record<string, unknown>>({}),
    letzterPong = useRef(0);
  const senden = (n: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify(n));
  };
  const stoppen = () => {
    generation.current++;
    clearTimeout(timer.current);
    ws.current?.close();
    ws.current = null;
    setVerbunden(false);
  };
  function verbinden(g: number) {
    if (generation.current !== g) return;
    let w: WebSocket;
    try {
      w = new WebSocket(wsUrl().replace(/\/ws$/, '/ws/tanks-online'));
    } catch (e) {
      setFehler(
        e instanceof Error
          ? e.message
          : 'Die Verbindung konnte nicht geöffnet werden.',
      );
      setAktiv(false);
      return;
    }
    ws.current = w;
    const frist = setTimeout(() => {
      if (w.readyState === WebSocket.CONNECTING) w.close();
    }, 8000);
    w.onopen = () => {
      if (generation.current !== g) {
        w.close();
        return;
      }
      clearTimeout(frist);
      letzterPong.current = Date.now();
      setFehler('');
      w.send(
        JSON.stringify({
          ...(zugang.current
            ? { art: 'weiter', ...zugang.current }
            : start.current),
          version: 1,
        }),
      );
    };
    w.onmessage = (e) => {
      if (ws.current !== w || generation.current !== g) return;
      try {
        const n = JSON.parse(e.data);
        letzterPong.current = Date.now();
        if (n.art === 'stand') {
          setStand(n);
          setVerbunden(true);
        }
        if (n.art === 'zugang') {
          zugang.current = { code: n.code, token: n.token };
          sessionStorage.setItem(
            'tanks-online',
            JSON.stringify(zugang.current),
          );
        }
        if (n.art === 'pong') setPing(Math.max(0, Date.now() - n.zeit));
        if (n.art === 'fehler') {
          setFehler(n.text);
          if (n.fatal) {
            stoppen();
            setAktiv(false);
            setStand(null);
            zugang.current = null;
            setFortsetzen(null);
            sessionStorage.removeItem('tanks-online');
          }
        }
      } catch {
        setFehler('Die Verbindung konnte nicht gelesen werden.');
        w.close();
      }
    };
    w.onclose = () => {
      clearTimeout(frist);
      if (generation.current !== g || ws.current !== w) return;
      setVerbunden(false);
      timer.current = setTimeout(() => verbinden(g), 1500);
    };
    w.onerror = () => w.close();
  }
  function los(n: Record<string, unknown>, weiter = false) {
    stoppen();
    zugang.current = weiter ? fortsetzen : null;
    setFortsetzen(null);
    start.current = n;
    setStand(null);
    setFehler('');
    setAktiv(true);
    verbinden(generation.current);
  }
  function verlassen() {
    senden({ art: 'verlassen' });
    stoppen();
    zugang.current = null;
    setFortsetzen(null);
    setStand(null);
    setAktiv(false);
    sessionStorage.removeItem('tanks-online');
  }
  useEffect(() => {
    const herz = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        if (Date.now() - letzterPong.current > 12_000) ws.current.close();
        else senden({ art: 'ping', zeit: Date.now() });
      }
    }, 3000);
    return () => {
      generation.current++;
      clearTimeout(timer.current);
      clearInterval(herz);
      ws.current?.close();
    };
  }, []);
  return {
    stand,
    verbunden,
    aktiv,
    fehler,
    ping,
    fortsetzen,
    los,
    verlassen,
    senden,
  };
}
