import { useEffect, useRef } from 'react';
import type { TanksSicht } from '@brauweg/broremote-kern/tanks/partie';
import {
  einschlagAnwenden,
  type Flugbahn,
} from '@brauweg/broremote-kern/tanks/flug';
import { flugNachrechnen, flugZeit } from '../broremote/brotanks/abspiel';
import { zeichneBuehne, type Effekt } from '../broremote/brotanks/zeichnen';
import type { OnlineStand } from '@brauweg/broremote-kern/tanks/online';
export function OnlineLeinwand({
  partie,
  ich,
}: {
  partie: NonNullable<OnlineStand['partie']>;
  ich: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    aktuell = useRef({ partie, zeit: performance.now() });
  useEffect(() => {
    aktuell.current = { partie, zeit: performance.now() };
  }, [partie]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>,
      flug: {
        zug: number;
        bahn: Flugbahn;
        g: Float32Array;
        anzahl: number;
      } | null = null;
    let stand = -1,
      boden = new Float32Array(),
      effekte: Effekt[] = [];
    const ruhe = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function malen() {
      if (!document.hidden && canvas.current) {
        const { partie: p, zeit } = aktuell.current,
          jetzt = performance.now();
        if (stand !== p.gelaendeStand) {
          stand = p.gelaendeStand;
          boden = new Float32Array(p.gelaende);
        }
        const s: TanksSicht = { ...p, gelaende: boden };
        if (p.phase === 'flug' && flug?.zug !== p.zug) {
          const bahn = flugNachrechnen(s);
          flug = bahn
            ? { zug: p.zug, bahn, g: new Float32Array(boden), anzahl: 0 }
            : null;
        }
        if (p.phase !== 'flug') flug = null;
        const t = flug
          ? flugZeit(
              flug.bahn,
              Math.max(0, p.rest - Math.min(0.3, (jetzt - zeit) / 1000)),
            )
          : 0;
        if (flug)
          while (
            flug.anzahl < flug.bahn.einschlaege.length &&
            flug.bahn.einschlaege[flug.anzahl].t <= t
          ) {
            const e = flug.bahn.einschlaege[flug.anzahl++];
            einschlagAnwenden(flug.g, e);
            effekte.push({
              art: 'ring',
              x: e.sx,
              y: e.sy,
              r: Math.max(0.8, e.sr),
              waffe: e.waffe,
              seit: jetzt,
            });
          }
        effekte = effekte.filter((e) => jetzt - e.seit < 1800);
        zeichneBuehne(canvas.current, {
          karte: p.optionen.karte,
          gelaende: flug?.g ?? boden,
          gelaendeSchluessel: flug ? `f${p.zug}-${flug.anzahl}` : `s${stand}`,
          meer: p.meer,
          wind: p.wind,
          bros: p.bros,
          amZug: p.phase === 'ende' ? undefined : ich,
          schiessende: p.salve,
          zielen: p.phase === 'zielen' && !p.bereit?.includes(ich),
          flug: flug ? { bahn: flug.bahn, t } : undefined,
          effekte,
          jetzt,
          wackeln: 0,
          ruhe,
        });
      }
      timer = setTimeout(malen, document.hidden ? 1000 : 1000 / 30);
    }
    malen();
    return () => clearTimeout(timer);
  }, [ich]);
  return (
    <canvas
      ref={canvas}
      className="to-leinwand"
      aria-label="BroTanks Spielfeld"
    />
  );
}
