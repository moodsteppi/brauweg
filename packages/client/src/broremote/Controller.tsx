import { useEffect, useRef, useState } from 'react';
import { BroIcon, type BroSymbol } from './BroIcon';
import type { Aktion, BauPrivat, Layout, Taste } from '@brauweg/broremote-kern';

/** Richtung halten und Aktion antippen funktionieren mit mehreren Fingern gleichzeitig. */
export function Controller({ layout, senden, bau, gegner = [] }: { layout: Layout; senden(a: Aktion): void; bau?: BauPrivat; gegner?: { id: string; name: string }[] }): React.JSX.Element {
  const quelle = useRef(senden); quelle.current = senden;
  const eingabe = useRef({ richtungen: new Map<number | string, { x: number; y: number }>(), tasten: new Map<number | string, Taste>() });
  const [summen, setSummen] = useState(true);
  const [gedrueckt, setGedrueckt] = useState<string[]>([]);
  const fuehlen = (): void => { if (summen) { try { navigator.vibrate?.(12); } catch { /* Haptik ist optional. */ } } };
  const [zahl, setZahl] = useState('0');
  const [ziel, setZiel] = useState('');
  const blockiert = !!bau?.zielCountdown;
  const sperre = useRef(blockiert); sperre.current = blockiert;
  const [wahl, setWahl] = useState<number | null>(null);
  const richtungTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const schicken = (): void => {
    if (sperre.current) { quelle.current({ art: 'reset' }); return; }
    const d = eingabe.current;
    const richtung = [...d.richtungen.values()].at(-1) ?? { x: 0, y: 0 };
    const tasten = [...new Set(d.tasten.values())];
    setGedrueckt([...tasten, ...(richtung.x ? [richtung.x < 0 ? 'links' : 'rechts'] : [])]);
    quelle.current({ art: 'steuerung', ...richtung, tasten });
  };
  const reset = (): void => {
    clearTimeout(richtungTimer.current);
    eingabe.current.richtungen.clear(); eingabe.current.tasten.clear(); setGedrueckt([]);
    quelle.current({ art: 'reset' });
  };
  useEffect(() => { if (blockiert) reset(); }, [blockiert]);
  useEffect(() => {
    const verborgen = (): void => { if (document.hidden) reset(); };
    const unten = (e: KeyboardEvent): void => {
      if ((e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) || e.repeat) return;
      const d = eingabe.current;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'r', 'Enter'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') d.richtungen.set(e.key, { x: e.key === 'ArrowLeft' ? -1 : 1, y: 0 });
      else if (layout === 'auswahl' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) d.richtungen.set(e.key, { x: 0, y: e.key === 'ArrowUp' ? -1 : 1 });
      else if (layout === 'bauen' && (e.key === 'r' || e.key === ' ')) d.tasten.set(e.key, e.key === 'r' ? 'drehen' : 'fallen');
      else if (layout === 'auswahl' && e.key === 'Enter') d.tasten.set(e.key, 'bestaetigen');
      else return;
      schicken();
    };
    const oben = (e: KeyboardEvent): void => {
      const d = eingabe.current;
      d.richtungen.delete(e.key);
      d.tasten.delete(e.key); schicken();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('brauweg:hintergrund', reset);
    document.addEventListener('visibilitychange', verborgen);
    window.addEventListener('keydown', unten); window.addEventListener('keyup', oben);
    const t = setInterval(() => {
      const d = eingabe.current;
      if (d.richtungen.size || d.tasten.size) schicken();
    }, 150);
    return () => {
      clearInterval(t); window.removeEventListener('blur', reset);
      clearTimeout(richtungTimer.current);
      window.removeEventListener('brauweg:hintergrund', reset); document.removeEventListener('visibilitychange', verborgen);
      window.removeEventListener('keydown', unten); window.removeEventListener('keyup', oben);
      quelle.current({ art: 'reset' });
    };
  }, [layout]);

  const taste = (id: Taste, text: string, icon: BroSymbol): React.JSX.Element => <button type="button" className={`br-steuertaste br-steuertaste-${id}${gedrueckt.includes(id) ? ' br-gedrueckt' : ''}`} disabled={blockiert}
    onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); fuehlen(); eingabe.current.tasten.set(e.pointerId, id); schicken(); }}
    onPointerUp={e => { eingabe.current.tasten.delete(e.pointerId); schicken(); }}
    onPointerCancel={e => { eingabe.current.tasten.delete(e.pointerId); schicken(); }}
    onLostPointerCapture={e => { if (eingabe.current.tasten.delete(e.pointerId)) schicken(); }}
    onClick={e => { if (e.detail === 0) { eingabe.current.tasten.set('a11y', id); schicken(); eingabe.current.tasten.delete('a11y'); schicken(); } }}>
    <BroIcon name={icon} />{text}</button>;

  if (layout === 'auswahl') return <div className="br-controller">
    <p className="br-leise">Wähle ein Motiv. Nur der Gastgeber empfängt deine Auswahl.</p>
    <div className="br-auswahl">{['Stern', 'Blitz', 'Mond', 'Herz'].map((m, i) => <button key={m} type="button" aria-pressed={wahl === i} onClick={() => { setWahl(i); senden({ art: 'wahl', wert: i }); }}>{['★', 'ϟ', '☾', '♥'][i]}<small>{m}</small></button>)}</div>
    <label className="br-feld">Zahl für den Verbindungstest<input inputMode="numeric" type="number" min="0" max="999" value={zahl} onChange={e => setZahl(e.target.value)} /></label>
    <button type="button" className="br-knopf br-sekundaer" disabled={!/^\d{1,3}$/.test(zahl)} onClick={() => senden({ art: 'zahl', wert: Number(zahl) })}>Zahl senden</button>
    {taste('bestaetigen', 'Bestätigen', 'haken')}
  </div>;

  return <div className="br-controller bb-knopfcontroller">
    <p className="br-leise">{blockiert ? 'Ziel erreicht. Dein Turm muss noch halten!' : 'Links und rechts halten. Drehen und Fallenlassen antippen.'}</p>
    <div className="bb-baubuttons">
      {([-1, 1] as const).map(x => <button type="button" className={`br-steuertaste${gedrueckt.includes(x < 0 ? 'links' : 'rechts') ? ' br-gedrueckt' : ''}`} key={x} disabled={blockiert} aria-label={x === -1 ? 'Nach links' : 'Nach rechts'}
        onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); fuehlen(); eingabe.current.richtungen.set(e.pointerId, { x, y: 0 }); schicken(); }}
        onPointerUp={e => { if (eingabe.current.richtungen.delete(e.pointerId)) schicken(); }} onPointerCancel={e => { if (eingabe.current.richtungen.delete(e.pointerId)) schicken(); }} onLostPointerCapture={e => { if (eingabe.current.richtungen.delete(e.pointerId)) schicken(); }}
        onClick={e => { if (e.detail === 0) { clearTimeout(richtungTimer.current); eingabe.current.richtungen.set('a11y', { x, y: 0 }); schicken(); richtungTimer.current = setTimeout(() => { eingabe.current.richtungen.delete('a11y'); schicken(); }, 150); } }}><BroIcon name={x < 0 ? 'links' : 'rechts'} />{x === -1 ? 'Links' : 'Rechts'}</button>)}
      {taste('drehen', 'Drehen', 'drehen')}{taste('fallen', 'Fallen lassen', 'fallen')}
    </div>
    {bau && <div className="bb-zauberleiste"><span className="br-kicker">DEINE ZAUBER · JE EINMAL PRO RUNDE</span>
      <details className="bb-zauberhilfe"><summary>So wirken deine Zauber</summary><p>Ab 3 verbauten Teilen. Turmanker beruhigt deinen Turm 4 Sekunden. Schwergewicht verdreifacht das Gewicht des nächsten gegnerischen Teils.</p></details>
      <button className="bb-zauber bb-anker" disabled={!bau.ankerBereit} onClick={() => { fuehlen(); senden({ art: 'zauber', zauber: 'anker' }); }}><BroIcon name="anker" /><strong>Turmanker</strong><small>{bau.anker ? `${Math.ceil(bau.anker)} s aktiv` : bau.ankerBereit ? 'Jetzt stabilisieren' : (bau.gebaut ?? 0) < 3 ? 'Ab 3 verbauten Teilen' : 'Nicht mehr verfügbar'}</small></button>
      {gegner.length > 0 && <><div className="bb-zauberziel" role="group" aria-label="Ziel für Schwergewicht"><small>GEGNER WÄHLEN</small><div className="br-gegner">{gegner.map(g => <button type="button" key={g.id} aria-pressed={(gegner.some(s => s.id === ziel) ? ziel : gegner[0].id) === g.id} onClick={() => setZiel(g.id)}>{g.name}</button>)}</div></div>
      <button className="bb-zauber bb-schwere" disabled={!bau.schwereBereit} onClick={() => senden({ art: 'zauber', zauber: 'schwere', ziel: gegner.some(g => g.id === ziel) ? ziel : gegner[0].id })}><BroIcon name="gewicht" /><strong>Schwergewicht</strong><small>{bau.schwereBereit ? 'Gegner verzaubern' : (bau.gebaut ?? 0) < 3 ? 'Ab 3 verbauten Teilen' : 'Nicht mehr verfügbar'}</small></button></>}
    </div>}
    <div className="br-controllerfuss"><span>Schau auf den großen Bildschirm.</span><button type="button" className="br-link" aria-pressed={summen} onClick={() => setSummen(s => !s)}>Haptik {summen ? 'an' : 'aus'}</button></div>
  </div>;
}
