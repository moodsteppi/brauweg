import { useEffect, useRef, useState } from 'react';

import { kurz } from './zahlen';

/**
 * Rueckmeldung im DOM: Muenzen fliegen vom Wagen in den Taler-Zaehler, ein
 * Zahlen-Popup zeigt den Verkauf, der Zaehler zaehlt hoch statt zu springen.
 * DOM statt Pixi, weil das Ziel (der Zaehler im HUD) DOM ist und die Zahl
 * scharf bleiben soll.
 */

export interface Verkauf {
  id: number;
  betrag: number;
  /** Start, relativ zum Manufaktur-Bildschirm (px). */
  x: number;
  y: number;
  /** Weg bis zum Zaehler (px). */
  dx: number;
  dy: number;
}

export function Verkaeufe({ liste }: { liste: Verkauf[] }): React.JSX.Element {
  return (
    <div className="mf-effekte" aria-hidden="true">
      {liste.map((v) => (
        <span key={v.id}>
          <span className="mf-popup" style={{ left: v.x, top: v.y }}>
            +{kurz(v.betrag)}
          </span>
          {[0, 1, 2].map((i) => (
            <i
              key={i}
              className="mf-taler mf-flug"
              style={
                {
                  left: v.x,
                  top: v.y,
                  '--dx': `${v.dx}px`,
                  '--dy': `${v.dy}px`,
                  animationDelay: `${i * 90}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}

/** Der Zaehler zaehlt hoch: Steigt der Wert, laeuft die Anzeige in 0,5 s nach. Faellt er (Kauf), springt sie. */
export function useZaehler(wert: number): number {
  const [anzeige, setAnzeige] = useState(wert);
  const von = useRef(wert);
  const erst = useRef(true);
  useEffect(() => {
    // Der erste echte Stand nach dem Laden springt — sonst zaehlte die Kasse
    // beim Oeffnen jedes Mal von 0 hoch, als waere alles gerade verdient.
    if (erst.current && wert > 0) {
      erst.current = false;
      von.current = wert;
      setAnzeige(wert);
      return;
    }
    if (wert <= anzeige) {
      von.current = wert;
      setAnzeige(wert);
      return;
    }
    const start = performance.now();
    const ab = von.current;
    let id = 0;
    const schritt = (): void => {
      const f = Math.min(1, (performance.now() - start) / 500);
      const neu = ab + (wert - ab) * f;
      setAnzeige(neu);
      if (f < 1) id = requestAnimationFrame(schritt);
      else von.current = wert;
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
    // Nur am Zielwert: Die Anzeige selbst laeuft ja gerade hinterher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wert]);
  return anzeige;
}

/** true fuer `dauer` ms, nachdem sich `wert` geaendert hat — nicht beim ersten Mal. */
export function useGeaendert(wert: number, dauer = 700): boolean {
  const [an, setAn] = useState(false);
  const vorher = useRef(wert);
  useEffect(() => {
    if (wert === vorher.current) return;
    vorher.current = wert;
    setAn(true);
    const id = window.setTimeout(() => setAn(false), dauer);
    return () => window.clearTimeout(id);
  }, [wert, dauer]);
  return an;
}
