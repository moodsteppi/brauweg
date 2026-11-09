import { useEffect, useRef, useState } from 'react';
import type { Aktion, BauPrivat, Layout, Taste } from '@brauweg/broremote-kern';

/** Richtung halten und Aktion antippen funktionieren mit mehreren Fingern gleichzeitig. */
export function Controller({ layout, senden, bau, gegner = [] }: { layout: Layout; senden(a: Aktion): void; bau?: BauPrivat; gegner?: { id: string; name: string }[] }): React.JSX.Element {
  const quelle = useRef(senden); quelle.current = senden;
  const eingabe = useRef({ x: 0, y: 0, tasten: new Map<number | string, Taste>() });
  const [zahl, setZahl] = useState('0');
  const [ziel, setZiel] = useState('');
  const blockiert = !!bau?.zielCountdown;
  const sperre = useRef(blockiert); sperre.current = blockiert;
  const [wahl, setWahl] = useState<number | null>(null);
  const richtungTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schicken = (): void => {
    if (sperre.current) { quelle.current({ art: 'reset' }); return; }
    const d = eingabe.current;
    quelle.current({ art: 'steuerung', x: d.x, y: d.y, tasten: [...new Set(d.tasten.values())] });
  };
  const reset = (): void => {
    clearTimeout(richtungTimer.current);
    eingabe.current = { x: 0, y: 0, tasten: new Map() };
    quelle.current({ art: 'reset' });
  };
  useEffect(() => { if (blockiert) reset(); }, [blockiert]);
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
      schicken();
    };
    const oben = (e: KeyboardEvent): void => {
      const d = eingabe.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') d.x = 0;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') d.y = 0;
      d.tasten.delete(e.key); schicken();
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
      clearTimeout(richtungTimer.current);
      window.removeEventListener('brauweg:hintergrund', reset); document.removeEventListener('visibilitychange', verborgen);
      window.removeEventListener('keydown', unten); window.removeEventListener('keyup', oben);
      quelle.current({ art: 'reset' });
    };
  }, [layout]);

  const taste = (id: Taste, text: string, icon: string): React.JSX.Element => <button type="button" className={`br-steuertaste br-steuertaste-${id}`} disabled={blockiert}
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

  return <div className="br-controller bb-knopfcontroller">
    <p className="br-leise">{blockiert ? 'Ziel erreicht. Dein Turm muss noch halten!' : 'Links und rechts halten. Drehen und Fallenlassen antippen.'}</p>
    <div className="bb-baubuttons">
      {[[-1, '←'], [1, '→']].map(([x, p]) => <button type="button" className="br-steuertaste" key={p} disabled={blockiert} aria-label={x === -1 ? 'Nach links' : 'Nach rechts'}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); eingabe.current.x = Number(x); schicken(); }}
        onPointerUp={() => { eingabe.current.x = 0; schicken(); }} onPointerCancel={() => { eingabe.current.x = 0; schicken(); }} onLostPointerCapture={() => { eingabe.current.x = 0; schicken(); }}
        onClick={e => { if (e.detail === 0) { clearTimeout(richtungTimer.current); eingabe.current.x = Number(x); schicken(); richtungTimer.current = setTimeout(() => { eingabe.current.x = 0; schicken(); }, 150); } }}><span aria-hidden="true">{p}</span>{x === -1 ? 'Links' : 'Rechts'}</button>)}
      {taste('drehen', 'Drehen', '↻')}{taste('fallen', 'Fallen lassen', '↓')}
    </div>
    {bau && <div className="bb-zauberleiste"><span className="br-kicker">DEINE ZAUBER · JE EINMAL PRO RUNDE</span>
      <p className="br-leise">Ab 3 verbauten Teilen. Turmanker beruhigt deinen Turm 4 Sekunden. Schwergewicht verdreifacht das Gewicht des nächsten gegnerischen Teils.</p>
      <button className="bb-zauber bb-anker" disabled={!bau.ankerBereit} onClick={() => senden({ art: 'zauber', zauber: 'anker' })}><span aria-hidden="true">⚓</span><strong>Turmanker</strong><small>{bau.anker ? `${Math.ceil(bau.anker)} s aktiv` : bau.ankerBereit ? 'Jetzt stabilisieren' : (bau.gebaut ?? 0) < 3 ? 'Ab 3 verbauten Teilen' : 'Nicht mehr verfügbar'}</small></button>
      {gegner.length > 0 && <><label className="br-feld">Ziel für Schwergewicht<select value={gegner.some(g => g.id === ziel) ? ziel : gegner[0].id} onChange={e => setZiel(e.target.value)}>{gegner.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <button className="bb-zauber bb-schwere" disabled={!bau.schwereBereit} onClick={() => senden({ art: 'zauber', zauber: 'schwere', ziel: gegner.some(g => g.id === ziel) ? ziel : gegner[0].id })}><span aria-hidden="true">◆</span><strong>Schwergewicht</strong><small>{bau.schwereBereit ? 'Gegner verzaubern' : (bau.gebaut ?? 0) < 3 ? 'Ab 3 verbauten Teilen' : 'Nicht mehr verfügbar'}</small></button></>}
    </div>}
    <p className="br-leise br-zentriert">Dein Handy ist der Controller. Schau auf den Gastgeber-Bildschirm.</p>
  </div>;
}
