import { useEffect, useRef, useState } from 'react';
import type { TanksStand } from '@brauweg/broremote-kern/tanks/online';
import { wsUrl } from '../laufzeit';
const SPEICHER = 'broweg.tanks.online';
type Zugang = { code: string; token: string };
function gespeichert(): Zugang | null { try { const z = JSON.parse(sessionStorage.getItem(SPEICHER) ?? 'null'); return z && typeof z.code === 'string' && typeof z.token === 'string' ? z : null; } catch { return null; } }
export function useTanksNetz() {
  const [stand, setStand] = useState<TanksStand | null>(null), [fehler, setFehler] = useState(''), [verbunden, setVerbunden] = useState(false), [aktiv, setAktiv] = useState(false), [ping, setPing] = useState<number | null>(null);
  const [fortsetzen, setFortsetzen] = useState(gespeichert);
  const ws = useRef<WebSocket | null>(null), zugang = useRef<Zugang | null>(null), anmeldung = useRef<Record<string, unknown>>({}), generation = useRef(0), wieder = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), letzte = useRef(0);
  const senden = (n: unknown): void => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(n)); };
  function verbinden(g: number): void {
    if (generation.current !== g) return;
    const w = new WebSocket(wsUrl().replace(/\/ws$/, '/ws/tanks')); ws.current = w; letzte.current = Date.now();
    w.onopen = () => { if (generation.current !== g) { w.close(); return; } setVerbunden(true); setFehler(''); w.send(JSON.stringify(zugang.current ? { art: 'weiter', ...zugang.current } : anmeldung.current)); };
    w.onmessage = e => {
      if (generation.current !== g || ws.current !== w) return;
      letzte.current = Date.now();
      try {
        const n = JSON.parse(e.data);
        if (n.art === 'stand') setStand(n);
        if (n.art === 'zugang') { zugang.current = { code: n.code, token: n.token }; setFortsetzen(zugang.current); try { sessionStorage.setItem(SPEICHER, JSON.stringify(zugang.current)); } catch { /* Sitzung bleibt im Arbeitsspeicher. */ } }
        if (n.art === 'pong') setPing(Math.max(0, Date.now() - n.zeit));
        if (n.art === 'fehler') { setFehler(n.text); if (n.fatal || !zugang.current) { generation.current++; w.close(); setVerbunden(false); setAktiv(false); setStand(null); if (n.fatal) vergessen(); } }
      } catch { setFehler('Die Verbindung wird geprüft.'); }
    };
    w.onerror = () => w.close();
    w.onclose = e => {
      if (generation.current !== g || ws.current !== w) return;
      setVerbunden(false); setPing(null);
      if (e.code === 1000) { setAktiv(false); setStand(null); vergessen(); setFehler(e.reason || 'Die Lobby wurde beendet.'); return; }
      wieder.current = setTimeout(() => verbinden(g), 1500);
    };
  }
  function vergessen(): void { zugang.current = null; setFortsetzen(null); try { sessionStorage.removeItem(SPEICHER); } catch { /* Kein Speicher verfügbar. */ } }
  function starten(n: Record<string, unknown>, z: Zugang | null = null): void {
    const g = ++generation.current; clearTimeout(wieder.current); ws.current?.close(); zugang.current = z; anmeldung.current = n; setStand(null); setFehler(''); setAktiv(true); setVerbunden(false); verbinden(g);
  }
  function verlassen(): void { senden({ art: 'verlassen' }); generation.current++; clearTimeout(wieder.current); ws.current?.close(); setStand(null); setAktiv(false); setVerbunden(false); vergessen(); }
  useEffect(() => {
    const t = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        if (Date.now() - letzte.current > 12000) ws.current.close();
        else senden({ art: 'ping', zeit: Date.now() });
      }
    }, 3000);
    const aufwachen = (): void => { if (ws.current?.readyState === WebSocket.OPEN && Date.now() - letzte.current > 10000) ws.current.close(); };
    window.addEventListener('online', aufwachen); document.addEventListener('visibilitychange', aufwachen);
    return () => { generation.current++; clearTimeout(wieder.current); clearInterval(t); ws.current?.close(); window.removeEventListener('online', aufwachen); document.removeEventListener('visibilitychange', aufwachen); };
  }, []);
  return { stand, fehler, verbunden, aktiv, ping, fortsetzen, starten, senden, verlassen };
}
