import { useEffect, useRef, useState } from 'react';
import type { ArtiPrivat } from '@brauweg/broremote-kern';
import { ONLINE_WAFFEN } from '@brauweg/broremote-kern/tanks/online';
import { WAFFEN } from '@brauweg/broremote-kern/tanks/regeln';
import { wort } from './text';
export function OnlineSteuerung({
  arti,
  verbunden,
  senden,
}: {
  arti: ArtiPrivat;
  verbunden: boolean;
  senden(n: unknown): void;
}) {
  const [ziel, setZiel] = useState({
      winkel: arti.winkel,
      staerke: arti.staerke,
      waffe: arti.waffe,
    }),
    [abgeschickt, setAbgeschickt] = useState(false);
  const fahren = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    werte = useRef({ arti, verbunden, senden });
  werte.current = { arti, verbunden, senden };
  const aktiv =
    verbunden &&
    arti.amZug &&
    arti.phase === 'zielen' &&
    !arti.raus &&
    !arti.bereit &&
    !abgeschickt;
  useEffect(() => {
    setZiel({ winkel: arti.winkel, staerke: arti.staerke, waffe: arti.waffe });
    setAbgeschickt(false);
  }, [arti.zug, arti.phase]);
  useEffect(() => {
    if (!aktiv) return;
    const timer = setTimeout(
      () => senden({ art: 'zielen', zug: arti.zug, ...ziel }),
      80,
    );
    return () => clearTimeout(timer);
  }, [ziel, aktiv, arti.zug]);
  const halt = () => {
    clearInterval(fahren.current);
    fahren.current = undefined;
    werte.current.senden({ art: 'reset' });
  };
  const fahrt = (x: number) => {
    halt();
    if (!aktiv) return;
    const schick = () =>
      werte.current.senden({
        art: 'steuerung',
        x,
        zug: werte.current.arti.zug,
      });
    schick();
    fahren.current = setInterval(schick, 150);
  };
  useEffect(() => {
    if (!aktiv) halt();
  }, [aktiv]);
  useEffect(() => {
    if (!verbunden) setAbgeschickt(false);
  }, [verbunden]);
  useEffect(() => {
    const verborgen = () => {
      if (document.hidden) halt();
    };
    window.addEventListener('blur', halt);
    document.addEventListener('visibilitychange', verborgen);
    return () => {
      halt();
      window.removeEventListener('blur', halt);
      document.removeEventListener('visibilitychange', verborgen);
    };
  }, []);
  return (
    <div
      className="to-steuerung"
      aria-label={wort('Panzersteuerung', 'Tank controls')}
    >
      <div className="to-fahrt">
        {[-1, 1].map((x) => (
          <button
            key={x}
            disabled={!aktiv || arti.tank <= 0}
            aria-label={
              x < 0
                ? wort('Nach links fahren', 'Drive left')
                : wort('Nach rechts fahren', 'Drive right')
            }
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              fahrt(x);
            }}
            onPointerUp={halt}
            onPointerCancel={halt}
            onLostPointerCapture={halt}
            onKeyDown={(e) => {
              if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) {
                e.preventDefault();
                fahrt(x);
              }
            }}
            onKeyUp={halt}
            onBlur={halt}
          >
            <img
              src={`/broremote/knoepfe/${x < 0 ? 'links' : 'rechts'}.webp`}
              alt=""
            />
          </button>
        ))}
        <small>
          {Math.ceil(arti.tank)}% {wort('Tank', 'Fuel')}
        </small>
      </div>
      <div className="to-zielen">
        {(['winkel', 'staerke'] as const).map((feld) => {
          const name = feld === 'winkel' ? wort('Winkel', 'Angle') : wort('Kraft', 'Power');
          const maximum = feld === 'winkel' ? 180 : 100;
          return <div className="to-feinregler" role="group" aria-label={name} key={feld}>
            <span>{name} <b>{ziel[feld]}{feld === 'winkel' ? '°' : '%'}</b></span>
            <div>
              <button aria-label={`${name} −1`} disabled={!aktiv || ziel[feld] <= 0}
                onClick={() => setZiel(z => ({ ...z, [feld]: Math.max(0, z[feld] - 1) }))}>−</button>
              <output aria-label={name}>{ziel[feld]}</output>
              <button aria-label={`${name} +1`} disabled={!aktiv || ziel[feld] >= maximum}
                onClick={() => setZiel(z => ({ ...z, [feld]: Math.min(maximum, z[feld] + 1) }))}>+</button>
            </div>
          </div>;
        })}
      </div>
      <div
        className="to-waffen"
        role="group"
        aria-label={wort('Waffen', 'Weapons')}
      >
        {ONLINE_WAFFEN.map((w) => (
          <button
            key={w}
            title={WAFFEN[w].name}
            aria-label={WAFFEN[w].name}
            aria-pressed={ziel.waffe === w}
            disabled={!aktiv || arti.munition[w] === 0}
            onClick={() => setZiel((z) => ({ ...z, waffe: w }))}
          >
            <img src={`/broremote/inventar/waffe-${w}.webp`} alt="" />
            <small>{arti.munition[w] < 0 ? '∞' : arti.munition[w]}</small>
          </button>
        ))}
      </div>
      <div className="to-items">
        {(['reparatur', 'schild'] as const).map((item, i) => (
          <button
            key={item}
            aria-label={
              item === 'reparatur'
                ? wort('Reparieren', 'Repair')
                : wort('Schild', 'Shield')
            }
            disabled={
              !aktiv ||
              arti.itemGenutzt ||
              !arti.items?.[i] ||
              (i === 0 ? arti.lp >= 100 : arti.schild)
            }
            onClick={() => senden({ art: 'tanksitem', zug: arti.zug, item })}
          >
            <img src={`/broremote/taktik/${item}.webp`} alt="" />
          </button>
        ))}
      </div>
      <button
        className="to-feuer"
        disabled={!aktiv}
        onClick={() => {
          halt();
          setAbgeschickt(true);
          senden({ art: 'feuer', zug: arti.zug, ...ziel });
        }}
      >
        <img src="/broremote/knoepfe/start.webp" alt="" />
        <strong>{arti.bereit || abgeschickt ? wort('Festgelegt ✓', 'Locked in ✓') : wort('Festlegen', 'Lock in')}</strong>
      </button>
    </div>
  );
}
