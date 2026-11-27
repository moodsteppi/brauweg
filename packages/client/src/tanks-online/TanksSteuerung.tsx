import { useEffect, useRef, useState } from 'react';
import { TANKS_ITEMS, type Aktion, type ArtiPrivat } from '@brauweg/broremote-kern';
import { WAFFEN } from '../broremote/brotanks/regeln';
const ITEMNAMEN = ['Reparatur', 'Schild', 'Teleport', 'Treibstoff'];
export function TanksSteuerung({ arti, senden, verbunden }: { arti: ArtiPrivat; senden(a: Aktion): void; verbunden: boolean }) {
  const [winkel, setWinkel] = useState(arti.winkel), [staerke, setStaerke] = useState(arti.staerke), [waffe, setWaffe] = useState(arti.waffe), [inventar, setInventar] = useState(false), [ziel, setZiel] = useState(0), [gefeuert, setGefeuert] = useState(0);
  const send = useRef(senden); send.current = senden;
  const darf = verbunden && arti.amZug && arti.phase === 'zielen' && !arti.raus && gefeuert !== arti.zug;
  const fahrt = useRef(0);
  const stoppen = (): void => { if (fahrt.current) { fahrt.current = 0; send.current({ art: 'reset' }); } };
  useEffect(() => { setWinkel(arti.winkel); setStaerke(arti.staerke); setWaffe(arti.waffe); setInventar(false); stoppen(); }, [arti.zug]);
  useEffect(() => { if (!darf) stoppen(); }, [darf]);
  useEffect(() => {
    const t = setInterval(() => { if (fahrt.current) send.current({ art: 'steuerung', x: fahrt.current, y: 0, tasten: [] }); }, 150);
    const aus = (): void => stoppen(); window.addEventListener('blur', aus); document.addEventListener('visibilitychange', aus);
    return () => { clearInterval(t); stoppen(); window.removeEventListener('blur', aus); document.removeEventListener('visibilitychange', aus); };
  }, []);
  const zielTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { if (!darf) clearTimeout(zielTimer.current); return () => clearTimeout(zielTimer.current); }, [darf, arti.zug]);
  const zielen = (w: number, s: number, a: number): void => { setWinkel(w); setStaerke(s); setWaffe(a); clearTimeout(zielTimer.current); if (darf) zielTimer.current = setTimeout(() => send.current({ art: 'zielen', winkel: w, staerke: s, waffe: a }), 100); };
  return <div className="to-steuerung" aria-label="Panzersteuerung">
    <div className="to-fahren">{[-1, 1].map(r => <button key={r} disabled={!darf || arti.tank <= 0} aria-label={r < 0 ? 'Nach links fahren' : 'Nach rechts fahren'} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); fahrt.current = r; senden({ art: 'steuerung', x: r, y: 0, tasten: [] }); }} onPointerUp={stoppen} onPointerCancel={stoppen} onLostPointerCapture={stoppen}>{r < 0 ? '◀' : '▶'}</button>)}<small>♥ {arti.lp} · Tank {Math.round(arti.tank)}</small></div>
    <label>Winkel {winkel}°<input aria-label="Winkel" type="range" min="0" max="180" value={winkel} disabled={!darf} onChange={e => zielen(+e.target.value, staerke, waffe)} /></label>
    <label>Stärke {staerke}%<input aria-label="Stärke" type="range" min="0" max="100" value={staerke} disabled={!darf} onChange={e => zielen(winkel, +e.target.value, waffe)} /></label>
    <label className="to-waffe">Waffe<select aria-label="Waffe" value={waffe} disabled={!darf} onChange={e => zielen(winkel, staerke, +e.target.value)}>{WAFFEN.map((w, i) => <option key={i} value={i} disabled={arti.munition[i] === 0}>{w.name} ({arti.munition[i] < 0 ? '∞' : arti.munition[i]})</option>)}</select></label>
    <button aria-expanded={inventar} disabled={!darf} onClick={() => { stoppen(); setInventar(!inventar); }}>Items</button>
    <button className="to-feuer" disabled={!darf} onClick={() => { stoppen(); senden({ art: 'feuer', zug: arti.zug, winkel, staerke, waffe }); setGefeuert(arti.zug); }}>Feuer</button>
    {inventar && <div className="to-inventar"><button onClick={() => setInventar(false)} aria-label="Inventar schließen">×</button>{TANKS_ITEMS.map((item, i) => <button key={item} disabled={!darf || arti.itemGenutzt || !arti.items?.[i] || (item === 'teleport' && !arti.teleportZiele?.length)} onClick={() => { senden({ art: 'tanksitem', item, zug: arti.zug, ...(item === 'teleport' ? { ziel: arti.teleportZiele?.includes(ziel) ? ziel : arti.teleportZiele?.[0] } : {}) }); setInventar(false); }}><img src={`/broremote/taktik/${item}.webp`} alt="" onError={e => { e.currentTarget.hidden = true; }} />{ITEMNAMEN[i]} ({arti.items?.[i] ?? 0})</button>)}<label>Teleport-Ziel<select value={arti.teleportZiele?.includes(ziel) ? ziel : arti.teleportZiele?.[0] ?? 0} onChange={e => setZiel(+e.target.value)}>{arti.teleportZiele?.map(x => <option key={x} value={x}>{x} m</option>)}</select></label></div>}
  </div>;
}
