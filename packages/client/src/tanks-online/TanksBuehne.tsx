import { useEffect, useRef, useState } from 'react';
import type { TanksNetzSicht } from '@brauweg/broremote-kern/tanks/online';
import { zeichneBuehne } from '../broremote/brotanks/zeichnen';
import { flugNachrechnen, flugZeit } from '../broremote/brotanks/abspiel';
import { einschlagAnwenden } from '../broremote/brotanks/flug';
import type { TanksSicht } from '../broremote/brotanks/partie';
const klemme = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
export function TanksBuehne({ sicht }: { sicht: TanksNetzSicht }) {
  const canvas = useRef<HTMLCanvasElement>(null), fenster = useRef<HTMLDivElement>(null), aktuell = useRef({ sicht, zeit: performance.now() });
  const [uebersicht, setUebersicht] = useState(false);
  const [kamera, setKamera] = useState({ zoom: 1, x: 0, y: 0 });
  const punkte = useRef(new Map<number, { x: number; y: number }>());
  const geste = useRef({ x: 0, y: 0, abstand: 0 });
  useEffect(() => { aktuell.current = { sicht, zeit: performance.now() }; }, [sicht]);
  const begrenzen = (k: typeof kamera): typeof kamera => {
    const r = fenster.current?.getBoundingClientRect(), z = klemme(k.zoom, 1, 3);
    return { zoom: z, x: klemme(k.x, -(r?.width ?? 0) * (z - 1) / 2, (r?.width ?? 0) * (z - 1) / 2), y: klemme(k.y, -(r?.height ?? 0) * (z - 1) / 2, (r?.height ?? 0) * (z - 1) / 2) };
  };
  useEffect(() => {
    const r = new ResizeObserver(() => setKamera(k => begrenzen(k))); if (fenster.current) r.observe(fenster.current); return () => r.disconnect();
  }, []);
  useEffect(() => {
    let raf = 0, zuletzt = 0;
    let flug: { zug: number; bahn: NonNullable<ReturnType<typeof flugNachrechnen>> } | null = null;
    const zeichnen = (jetzt: number): void => {
      raf = requestAnimationFrame(zeichnen);
      if (jetzt - zuletzt < 1000 / 30 || !canvas.current || document.hidden) return;
      zuletzt = jetzt;
      const n = aktuell.current, s: TanksSicht = { ...n.sicht, gelaende: new Float32Array(n.sicht.gelaende) };
      if (s.phase === 'flug' && flug?.zug !== s.zug) { const bahn = flugNachrechnen(s); flug = bahn ? { zug: s.zug, bahn } : null; }
      if (s.phase !== 'flug') flug = null;
      const t = flug ? flugZeit(flug.bahn, Math.max(0, s.rest - Math.min(.25, (jetzt - n.zeit) / 1000))) : 0;
      const getroffen = flug?.bahn.einschlaege.filter(e => e.t <= t) ?? [];
      for (const e of getroffen) einschlagAnwenden(s.gelaende, e);
      zeichneBuehne(canvas.current, { panorama: !uebersicht, karte: s.optionen.karte, gelaende: s.gelaende, gelaendeSchluessel: `${s.seed}-${s.gelaendeStand}-${flug?.zug ?? 0}-${getroffen.length}`, meer: s.meer, wind: s.wind, bros: s.bros, amZug: s.phase === 'ende' ? undefined : s.amZug, zielen: s.phase === 'zielen', flug: flug ? { bahn: flug.bahn, t } : undefined, effekte: getroffen.filter(e => t - e.t < .5).map(e => ({ art: 'ring' as const, x: e.sx, y: e.sy, r: e.sr, waffe: e.waffe, seit: jetzt - (t - e.t) * 1000 })), jetzt, wackeln: 0, ruhe: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    };
    raf = requestAnimationFrame(zeichnen); return () => cancelAnimationFrame(raf);
  }, [uebersicht]);
  function messung() { const p = [...punkte.current.values()], a = p[0], b = p[1] ?? a; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, abstand: p.length > 1 ? Math.hypot(a.x - b.x, a.y - b.y) : 0 }; }
  return <div className="to-spielfeld" ref={fenster} onWheel={e => setKamera(k => begrenzen({ ...k, zoom: k.zoom - e.deltaY * .002 }))} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); punkte.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); geste.current = messung(); }} onPointerMove={e => {
    if (!punkte.current.has(e.pointerId)) return;
    punkte.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const neu = messung(), alt = geste.current; geste.current = neu;
    setKamera(k => begrenzen({ zoom: alt.abstand && neu.abstand ? k.zoom * neu.abstand / alt.abstand : k.zoom, x: k.x + neu.x - alt.x, y: k.y + neu.y - alt.y }));
  }} onPointerUp={e => { punkte.current.delete(e.pointerId); if (punkte.current.size) geste.current = messung(); }} onPointerCancel={() => punkte.current.clear()} onLostPointerCapture={e => punkte.current.delete(e.pointerId)}>
    <canvas key={String(uebersicht)} ref={canvas} style={{ transform: `translate(${kamera.x}px, ${kamera.y}px) scale(${kamera.zoom})` }} role="img" aria-label="BroTanks Schlachtfeld. Mit zwei Fingern zoomen und verschieben." />
    <div className="to-zoom" onPointerDown={e => e.stopPropagation()}><button aria-label="Herauszoomen" onClick={() => setKamera(k => begrenzen({ ...k, zoom: k.zoom - .25 }))}>−</button><button aria-label={uebersicht ? "Volle Bildschirmbreite nutzen" : "Gesamtes Spielfeld anzeigen"} onClick={() => { setUebersicht(v => !v); setKamera({ zoom: 1, x: 0, y: 0 }); }}>{kamera.zoom.toFixed(1)}×</button><button aria-label="Hineinzoomen" onClick={() => setKamera(k => begrenzen({ ...k, zoom: k.zoom + .25 }))}>+</button></div>
  </div>;
}
