import { useEffect, useRef, useState } from 'react';
import type { Aktion, Layout, Taste } from '@brauweg/broremote-kern';

/** Mehrere Finger bleiben unabhängig: Stick loslassen löst keine gleichzeitig gehaltene Taste. */
export function Controller({ layout, senden }: { layout: Layout; senden(a: Aktion): void }): React.JSX.Element {
  const quelle = useRef(senden); quelle.current = senden;
  const eingabe = useRef({ x: 0, y: 0, tasten: new Map<number | string, Taste>() });
  const stick = useRef<number | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zahl, setZahl] = useState('0');
  const [wahl, setWahl] = useState<number | null>(null);
  const letzterTakt = useRef(0);
  const schicken = (): void => {
    const d = eingabe.current;
    quelle.current({ art: 'steuerung', x: d.x, y: d.y, tasten: [...new Set(d.tasten.values())] });
  };
  const reset = (): void => {
    eingabe.current = { x: 0, y: 0, tasten: new Map() }; stick.current = null;
    setPosition({ x: 0, y: 0 }); quelle.current({ art: 'reset' });
  };
  useEffect(() => {
    const verborgen = (): void => { if (document.hidden) reset(); };
    const unten = (e: KeyboardEvent): void => {
      if ((e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) || e.repeat) return;
      const d = eingabe.current;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'r', 'Enter'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft') d.x = -1;
      else if (e.key === 'ArrowRight') d.x = 1;
      else if (e.key === 'ArrowUp') d.y = -1;
      else if (e.key === 'ArrowDown') d.y = 1;
      else if (layout === 'bauen' && (e.key === 'r' || e.key === ' ')) d.tasten.set(e.key, e.key === 'r' ? 'drehen' : 'fallen');
      else if (layout === 'auswahl' && e.key === 'Enter') d.tasten.set(e.key, 'bestaetigen');
      else return;
      setPosition({ x: d.x, y: d.y }); schicken();
    };
    const oben = (e: KeyboardEvent): void => {
      const d = eingabe.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') d.x = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') d.y = 0;
      d.tasten.delete(e.key); setPosition({ x: d.x, y: d.y }); schicken();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('brauweg:hintergrund', reset);
    document.addEventListener('visibilitychange', verborgen);
    window.addEventListener('keydown', unten); window.addEventListener('keyup', oben);
    const t = setInterval(() => {
      const d = eingabe.current;
      if (d.x || d.y || d.tasten.size) schicken();
    }, 150);
    return () => {
      clearInterval(t); window.removeEventListener('blur', reset);
      window.removeEventListener('brauweg:hintergrund', reset); document.removeEventListener('visibilitychange', verborgen);
      window.removeEventListener('keydown', unten); window.removeEventListener('keyup', oben);
      quelle.current({ art: 'reset' });
    };
  }, [layout]);

  const taste = (id: Taste, text: string, icon: string): React.JSX.Element => <button type="button" className={`br-steuertaste br-steuertaste-${id}`}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); eingabe.current.tasten.set(e.pointerId, id); schicken(); }}
    onPointerUp={e => { eingabe.current.tasten.delete(e.pointerId); schicken(); }}
    onPointerCancel={e => { eingabe.current.tasten.delete(e.pointerId); schicken(); }}
    onLostPointerCapture={e => { if (eingabe.current.tasten.delete(e.pointerId)) schicken(); }}
    onClick={e => { if (e.detail === 0) { eingabe.current.tasten.set('a11y', id); schicken(); eingabe.current.tasten.delete('a11y'); schicken(); } }}>
    <span aria-hidden="true">{icon}</span>{text}</button>;

  if (layout === 'auswahl') return <div className="br-controller">
    <p className="br-leise">Wähle ein Motiv. Nur der Gastgeber empfängt deine Auswahl.</p>
    <div className="br-auswahl">{['Stern', 'Blitz', 'Mond', 'Herz'].map((m, i) => <button key={m} type="button" aria-pressed={wahl === i} onClick={() => { setWahl(i); senden({ art: 'wahl', wert: i }); }}>{['★', 'ϟ', '☾', '♥'][i]}<small>{m}</small></button>)}</div>
    <label className="br-feld">Zahl für den Verbindungstest<input inputMode="numeric" type="number" min="0" max="999" value={zahl} onChange={e => setZahl(e.target.value)} /></label>
    <button type="button" className="br-knopf br-sekundaer" disabled={!/^\d{1,3}$/.test(zahl)} onClick={() => senden({ art: 'zahl', wert: Number(zahl) })}>Zahl senden</button>
    {taste('bestaetigen', 'Bestätigen', '✓')}
  </div>;

  const bewegen = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (stick.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect(), radius = r.width * .35;
    let x = (e.clientX - r.left - r.width / 2) / radius, y = (e.clientY - r.top - r.height / 2) / radius;
    const laenge = Math.max(1, Math.hypot(x, y)); x = Math.round(x / laenge * 100) / 100; y = Math.round(y / laenge * 100) / 100;
    eingabe.current.x = x; eingabe.current.y = y; setPosition({ x, y });
    if (performance.now() - letzterTakt.current > 33) { letzterTakt.current = performance.now(); schicken(); }
  };
  const loslassen = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (stick.current !== e.pointerId) return;
    stick.current = null; eingabe.current.x = 0; eingabe.current.y = 0; setPosition({ x: 0, y: 0 }); schicken();
  };
  return <div className="br-controller">
    <p className="br-leise">Bewegen und gleichzeitig drehen oder fallen lassen.</p>
    <div className="br-bedienung">
      <div><div className="br-stick" role="group" aria-label="Joystick. Alternativ Richtungstasten darunter verwenden."
        onPointerDown={e => { if (stick.current !== null) return; e.preventDefault(); stick.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); bewegen(e); schicken(); }}
        onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen} onLostPointerCapture={loslassen}>
        <span className="br-stick-kreuz" aria-hidden="true">✣</span><span className="br-stick-knauf" style={{ transform: `translate(${position.x * 46}px, ${position.y * 46}px)` }} />
      </div><div className="br-richtungen">{[[-1, '←'], [1, '→']].map(([x, p]) => <button type="button" key={p} aria-label={x === -1 ? 'Nach links' : 'Nach rechts'}
        onClick={() => { senden({ art: 'steuerung', x: Number(x), y: 0, tasten: [] }); }}>{p}</button>)}</div></div>
      <div className="br-tasten">{taste('drehen', 'Drehen', '↻')}{taste('fallen', 'Fallen lassen', '↓')}</div>
    </div>
    <p className="br-leise br-zentriert">Dein Handy ist der Controller. Schau auf den Gastgeber-Bildschirm.</p>
  </div>;
}
