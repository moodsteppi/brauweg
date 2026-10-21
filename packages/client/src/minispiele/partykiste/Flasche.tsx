import { useEffect, useRef, useState } from 'react';

import { Karte } from './Runden';
import type { PartyKarte } from './sicht';
import './flasche.css';

/**
 * Die Flasche im Königsbecher (Emile, 13.10.2026): Jede gezogene Karte wird
 * oben auf die Flasche gelegt. Fällt der Stapel, trinkt, wer ihn umwirft —
 * je Karte einen Schluck.
 *
 * Die Regel steht im Modul (`flascheHaelt` in game-partykiste/zeitdruck.ts).
 * Hier passiert nur, was ein Bildschirm kann: Die gezogene Karte pendelt über
 * dem Stapel, und ein Tipp schickt, WO sie gerade war (`versatz`, -1 bis 1).
 * Ob das hält, sagt die nächste Sicht.
 *
 * Das Pendel läuft über `requestAnimationFrame` und schreibt direkt ins
 * `style` — kein React-Zustand je Bild, sonst zeichnete die ganze Runde 60-mal
 * in der Sekunde neu. Der Versatz beim Tippen wird aus derselben Formel
 * gelesen, die das Bild bewegt; was man sieht, ist also, was ankommt.
 */

/** Wie weit (px) ein Versatz von 1 neben der Mitte liegt. */
const AUSSCHLAG_PX = 58;
/** Wie lange ein Sturz zu sehen ist. */
const STURZ_MS = 2600;

/** Mit jeder Karte schwingt das Pendel schneller — oben wird es eng. */
function periodeMs(hoehe: number): number {
  return Math.max(700, 1600 - 120 * hoehe);
}

export function Flasche({
  flasche,
  offeneKarte,
  binDran,
  gelegt,
  sturz,
  sturzName,
  trinkWort,
  onLegen,
}: {
  flasche: readonly number[];
  offeneKarte: PartyKarte | null;
  binDran: boolean;
  gelegt: number;
  sturz: { sitz: number; karten: number; kassiert: number; versatz: readonly number[]; nr: number } | null;
  /** „Du" oder der Name dessen, der umgeworfen hat. */
  sturzName: string;
  /** „Schlücke" oder „Strafpunkte", mit Zahl davor. */
  trinkWort: (zahl: number) => string;
  onLegen: (versatz: number) => void;
}): React.JSX.Element {
  const pendel = useRef<HTMLDivElement>(null);
  const versatz = useRef(0);
  const [gesendet, setGesendet] = useState(false);
  const hoehe = flasche.length;

  // Eine neue offene Karte ist ein neuer Versuch.
  const kartenSchluessel = offeneKarte ? `${offeneKarte.rang}-${offeneKarte.farbe}-${gelegt}` : null;
  useEffect(() => setGesendet(false), [kartenSchluessel]);

  useEffect(() => {
    if (!kartenSchluessel) return;
    const periode = periodeMs(hoehe);
    const start = performance.now();
    let bild = 0;
    const schritt = (jetzt: number): void => {
      const v = Math.sin(((jetzt - start) / periode) * Math.PI * 2);
      versatz.current = v;
      if (pendel.current) {
        pendel.current.style.transform = `translate3d(${v * AUSSCHLAG_PX}px, 0, 0) rotate(${v * -9}deg)`;
      }
      bild = requestAnimationFrame(schritt);
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
  }, [kartenSchluessel, hoehe]);

  // Der Sturz wird genau einmal gezeigt: am Schlüssel `nr`, nicht am Objekt.
  const sturzNr = sturz && sturz.nr === gelegt ? sturz.nr : null;
  const [zeigeSturz, setZeigeSturz] = useState<number | null>(null);
  useEffect(() => {
    if (sturzNr === null) return;
    setZeigeSturz(sturzNr);
    const t = setTimeout(() => setZeigeSturz(null), STURZ_MS);
    return () => clearTimeout(t);
  }, [sturzNr]);
  const faellt = zeigeSturz !== null && sturz !== null;
  const richtung = faellt ? (sturz.versatz.reduce((a, b) => a + b, 0) >= 0 ? 1 : -1) : 1;

  const legen = (): void => {
    if (!binDran || !offeneKarte || gesendet) return;
    setGesendet(true);
    onLegen(Math.round(versatz.current * 1000) / 1000);
  };

  return (
    <div
      className="fl-flaschenbuehne"
      data-tippbar={binDran && offeneKarte && !gesendet ? '' : undefined}
      onClick={legen}
      aria-label={binDran && offeneKarte ? 'Antippen, um die Karte abzulegen' : `Flasche mit ${hoehe} Karten`}
      role={binDran && offeneKarte ? 'button' : undefined}
    >
      {/* Die pendelnde Karte über dem Stapel. */}
      {offeneKarte ? (
        <div className="fl-pendel-zone" style={{ bottom: `${196 + hoehe * 7}px` }}>
          <div className="fl-pendel" ref={pendel} data-gesendet={gesendet ? '' : undefined}>
            <span className="fl-faden" />
            <Karte karte={offeneKarte} />
          </div>
        </div>
      ) : null}

      <div className="fl-flasche" data-wackelt={faellt ? '' : undefined}>
        {/* Der Stapel: flache Karten, je nach Versatz verschoben und gekippt. */}
        <div className="fl-stapel">
          {flasche.map((v, i) => (
            <span
              key={`k${i}`}
              className="fl-platte"
              style={{
                bottom: `${i * 7}px`,
                transform: `translateX(${v * AUSSCHLAG_PX}px) rotate(${v * 6}deg)`,
              }}
            />
          ))}
        </div>
        <svg className="fl-glas" viewBox="0 0 60 150" aria-hidden="true">
          <path
            d="M24 2 h12 v34 q20 14 20 40 v66 q0 6 -6 6 h-40 q-6 0 -6 -6 v-66 q0 -26 20 -40 z"
            className="fl-glas-koerper"
          />
          <rect x="22" y="0" width="16" height="6" rx="2" className="fl-glas-kappe" />
          <rect x="8" y="80" width="44" height="36" rx="4" className="fl-glas-etikett" />
          <path d="M14 40 q-4 30 -2 90" className="fl-glas-glanz" />
        </svg>
      </div>

      {/* Umgekippt: die Karten fliegen zur Seite, auf die der Stapel hing. */}
      {faellt ? (
        <div className="fl-sturz" key={zeigeSturz}>
          {sturz.versatz.map((v, i) => (
            <span
              key={i}
              className="fl-platte is-fliegt"
              style={
                {
                  bottom: `${168 + i * 7}px`,
                  '--x0': `${v * AUSSCHLAG_PX}px`,
                  '--dx': `${richtung * (90 + i * 26)}px`,
                  '--dreh': `${richtung * (140 + i * 50)}deg`,
                  '--i': i,
                } as React.CSSProperties
              }
            />
          ))}
          <p className="fl-sturz-text">
            Umgekippt! {sturzName} — {trinkWort(sturz.kassiert)}
          </p>
        </div>
      ) : null}

      {binDran && offeneKarte ? (
        <p className="fl-hinweis">{gesendet ? 'Liegt …' : 'Tippen, wenn die Karte über der Flasche ist!'}</p>
      ) : (
        <p className="fl-hoehe">{hoehe === 0 ? 'Die Flasche ist leer' : `${hoehe} ${hoehe === 1 ? 'Karte' : 'Karten'} auf der Flasche`}</p>
      )}
    </div>
  );
}
