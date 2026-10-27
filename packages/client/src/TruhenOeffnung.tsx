import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Grad } from './api';
import { spiele } from './klang';
import { truhenBild } from './truhenbild';
import { TRUHEN_STIL, TRUHEN_ZEIT } from './truhen-ablauf';
import './truhen-oeffnung.css';
export type { Grad } from './api';

const Truhe3D = lazy(() => import('./Truhe3D'));
export const TRUHE_DAUER_MS = TRUHEN_ZEIT.fertig * 1000;

/** Auch ein Gerät ohne WebGL muss seine bereits gutgeschriebene Belohnung erreichen. */
class TruhenGrenze extends Component<{ children: ReactNode; ersatz: ReactNode; onErsatz: () => void }, { fehler: boolean }> {
  state = { fehler: false };
  static getDerivedStateFromError() { return { fehler: true }; }
  componentDidCatch() { this.props.onErsatz(); }
  render() { return this.state.fehler ? this.props.ersatz : this.props.children; }
}

function useWenigerBewegung(): boolean {
  const [weniger, setWeniger] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const frage = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const wechsel = () => setWeniger(frage?.matches ?? false);
    frage?.addEventListener('change', wechsel);
    return () => frage?.removeEventListener('change', wechsel);
  }, []);
  return weniger;
}

/** Zählt erst nach dem Münzschwall hoch; Vorlesen bekommt nur den endgültigen Betrag. */
function MuenzenZahl({ wert, aktiv, weniger }: { wert: number; aktiv: boolean; weniger: boolean }) {
  const [zahl, setZahl] = useState(0);
  useEffect(() => {
    if (!aktiv) { setZahl(0); return; }
    if (weniger) { setZahl(wert); return; }
    let bild = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const weiter = (jetzt: number) => {
        const t = Math.min(1, (jetzt - start) / 800);
        setZahl(Math.round(wert * (1 - (1 - t) ** 3)));
        if (t < 1) bild = requestAnimationFrame(weiter);
      };
      bild = requestAnimationFrame(weiter);
    }, TRUHEN_ZEIT.belohnung * 1000);
    return () => { window.clearTimeout(timer); cancelAnimationFrame(bild); };
  }, [wert, aktiv, weniger]);
  return <>{zahl.toLocaleString('de-DE')}</>;
}

/** Tipp → Spannen → echter Scharnierdeckel → Münzen → bewusster nächster Tipp. */
export function TruhenOeffnung({ grad, muenzen, onFertig }: { grad: Grad; muenzen: number; onFertig: () => void }): React.JSX.Element {
  const [phase, setPhase] = useState<'zu' | 'auf' | 'fertig'>('zu');
  const [bereit, setBereit] = useState(false);
  const [ersatz, setErsatz] = useState(false);
  const weniger = useWenigerBewegung();
  const knopf = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const einmal = useRef(false);
  const stil = TRUHEN_STIL[grad];
  const vorbereitet = useCallback(() => setBereit(true), []);
  const ohneWebGL = useCallback(() => { setErsatz(true); setBereit(true); }, []);

  useEffect(() => {
    const vorher = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const scrollen = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = scrollen; vorher?.focus(); };
  }, []);
  useEffect(() => { if (bereit && phase !== 'auf') knopf.current?.focus({ preventScroll: true }); }, [bereit, phase]);
  useEffect(() => {
    if (phase !== 'auf') return;
    const timer = window.setTimeout(() => setPhase('fertig'), weniger ? 350 : TRUHE_DAUER_MS);
    const klang = window.setTimeout(() => spiele('muenzenregen', 0.6), weniger ? 80 : TRUHEN_ZEIT.muenzen * 1000);
    return () => { window.clearTimeout(timer); window.clearTimeout(klang); };
  }, [phase, weniger]);

  const tippen = (): void => {
    if (!bereit) return;
    if (phase === 'zu') { spiele('truhe-auf', 0.75); setPhase('auf'); }
    else if (phase === 'fertig' && !einmal.current) { einmal.current = true; onFertig(); }
  };
  const bild = <img className="truhe-ersatz" src={truhenBild(grad)} alt="" draggable={false} />;
  return <div className={`truhe-oeffnung grad-${grad} ist-${phase}${weniger ? ' ist-ruhig' : ''}${ersatz ? ' ist-ersatz' : ''}`}
    style={{ '--glut': stil.licht, '--verzoegerung': `${TRUHEN_ZEIT.belohnung}s` } as React.CSSProperties}
    ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${stil.name} öffnen`} aria-describedby="truhe-bedienhinweis" onClick={tippen}
    onKeyDown={e => {
      // Der Dialog hat genau einen bedienbaren Knopf; Tab darf nicht ins verdeckte Hub wandern.
      if (e.key === 'Tab') { e.preventDefault(); knopf.current?.focus(); }
    }}>
    <header className="truhe-titel"><span>DEINE BELOHNUNG</span><h2>{stil.name}</h2><i aria-hidden="true">✦</i></header>
    <div className="truhe-buehne" aria-hidden="true">
      <div className="truhe-aura" /><div className="truhe-strahlen" />
      <div className="truhe-modell">
        <TruhenGrenze ersatz={bild} onErsatz={ohneWebGL}>
          <Suspense fallback={bild}><Truhe3D grad={grad} offen={phase !== 'zu'} sofort={weniger} feier onBereit={vorbereitet} /></Suspense>
        </TruhenGrenze>
      </div>
    </div>
    <div className="truhe-belohnung" aria-hidden="true">
      <span className="truhe-betrag"><img src="/hub/muenze.png" alt="" /><strong>+<MuenzenZahl wert={muenzen} aktiv={phase !== 'zu'} weniger={weniger} /></strong></span>
      <span>Münzen</span>
    </div>
    <p className="truhe-ansage" role="status">{phase === 'fertig' ? `${muenzen.toLocaleString('de-DE')} Münzen erhalten` : ''}</p>
    <button ref={knopf} className="truhe-weiter" disabled={!bereit} aria-disabled={phase === 'auf'}
      onClick={e => { e.stopPropagation(); tippen(); }}>
      {!bereit ? 'Truhe wird vorbereitet…' : phase === 'zu' ? 'Truhe öffnen' : phase === 'fertig' ? 'Weiter' : 'Wird geöffnet…'}
    </button>
    <p className="truhe-hinweis" id="truhe-bedienhinweis">{!bereit ? 'Gleich ist sie bereit' : phase === 'zu' ? 'Tippe auf die Truhe' : phase === 'fertig' ? 'Deine Belohnung ist gutgeschrieben' : 'Deine Belohnung kommt zum Vorschein'}</p>
  </div>;
}
