import { useState } from 'react';
import { TruhenOeffnung } from '../../TruhenOeffnung';
import { TRUHEN_STIL } from '../../truhen-ablauf';
import type { Grad } from '../../api';

/** Dieselbe Öffnung wie bei echten Belohnungen, ohne Konto und ohne Buchung. */
export function ProbeTruhen(): React.JSX.Element {
  const wunsch = new URLSearchParams(window.location.search).get('grad') ?? 'holz';
  const [grad, setGrad] = useState<Grad>(Object.keys(TRUHEN_STIL).includes(wunsch) ? wunsch as Grad : 'holz');
  const [lauf, setLauf] = useState(0);
  if (new URLSearchParams(window.location.search).get('mobil') === '1') {
    const url = new URL(window.location.href); url.searchParams.delete('mobil');
    return <main style={{ background: '#040917', minHeight: '100svh', display: 'grid', placeItems: 'center' }}>
      <iframe title="iPhone-Truhenvorschau" src={url.toString()} style={{ width: 'min(390px, 100vw)', height: 'min(844px, 100svh)', border: '1px solid #364d73', borderRadius: 20 }} />
    </main>;
  }
  const betrag = { holz: 3, bronze: 8, silber: 20, gold: 45, diamant: 100 };
  return <div className="truhe-probe">
    <nav aria-label="Truhenvorschau" style={{ position: 'fixed', top: 'max(10px, env(safe-area-inset-top))', left: 8, right: 8, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 5, zIndex: 400 }}>
      {(Object.keys(TRUHEN_STIL) as Grad[]).map(g => <button key={g} aria-pressed={g === grad} aria-label={TRUHEN_STIL[g].name} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #6a7893', background: g === grad ? '#ffcf60' : '#17284b', color: g === grad ? '#10203b' : '#fff', fontSize: 12 }} onClick={() => { setGrad(g); setLauf(n => n + 1); }}>{TRUHEN_STIL[g].name.replace('truhe', '')}</button>)}
    </nav>
    <TruhenOeffnung key={`${grad}-${lauf}`} grad={grad} muenzen={betrag[grad]} onFertig={() => setLauf(n => n + 1)} />
  </div>;
}
