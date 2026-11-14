import { tf } from '../../i18n/einsetzen';
import stil from './BroChess.module.css';
import type { DreiSchachSicht, Farbe } from './sicht';

/**
 * Drei-Schach: die „Leben" eines Spielers als Kronen neben seinem Namen.
 * Jedes Schach, das er EINSTECKT, kostet eine Krone — sie wird grau und
 * faellt ab (die Animation laeuft, sobald die Klasse wechselt, also genau
 * beim Schach). Gerechnet wird nur Ziel minus gegebene Schachs des Gegners;
 * beides steht in der Sicht, die Regel selbst bleibt im Modul.
 */
export function Kronen({ drei, farbe }: { drei: DreiSchachSicht; farbe: Farbe }): React.JSX.Element {
  const eingesteckt = Math.min(drei.ziel, drei.gegeben[farbe === 'w' ? 'b' : 'w']);
  const rest = drei.ziel - eingesteckt;
  return (
    <span className={stil.kronen} role="img" aria-label={tf('brochess.dreiSchach.lebenAria', { rest, ziel: drei.ziel })}>
      {Array.from({ length: drei.ziel }, (_, i) => (
        // Von rechts verlieren: Die vorderen Kronen bleiben am laengsten stehen.
        <svg key={i} viewBox="0 0 24 24" aria-hidden="true" className={`${stil.krone}${i >= rest ? ` ${stil.kroneWeg}` : ''}`}>
          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
        </svg>
      ))}
    </span>
  );
}
