import type { CSSProperties } from 'react';
import './hub-bildicons.css';

const MOTIVE = ['home', 'games', 'shop', 'collection', 'clan', 'menu', 'tiktok', 'instagram'] as const;
export type HubMotiv = typeof MOTIVE[number];

/** Ein gemeinsamer Atlas hält Material, Licht und Ladeaufwand der Symbole einheitlich. */
export function HubBildIcon({ motiv, className = '' }: { motiv: HubMotiv; className?: string }): React.JSX.Element {
  const platz = MOTIVE.indexOf(motiv);
  return <span aria-hidden="true" className={`hub-bildicon ${className}`} style={{
    '--motiv-x': `${platz % 4 * 100 / 3}%`, '--motiv-y': platz < 4 ? '0%' : '100%',
  } as CSSProperties} />;
}
