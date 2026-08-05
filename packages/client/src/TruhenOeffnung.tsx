/**
 * Truhen-Öffnung — die Animation, die sich alle Truhen teilen.
 *
 * Bewusst getrennt von der Truhe selbst: Diese Datei kennt die **Choreografie**
 * (wackeln → im Raum drehen → Deckel dreidimensional aufklappen → Lichtstrahlen
 * → Belohnung), nicht das Aussehen. Wie eine Truhe aussieht, steht als Daten in
 * `designFuer` — **Körper** und **Deckel** als zwei Ebenen. Eine neue Truhe ist
 * damit nur ein neuer Satz Ebenen; die Animation bleibt unverändert.
 *
 * Bis die gemalten Ebenen geliefert sind (docs/ASSETS-TRUHEN-EBENEN.md),
 * zeichnet ein SVG-Platzhalter Körper und Deckel je Grad — dieselbe Mechanik,
 * nur eine einfachere Haut. Kommt die echte Kunst, trägt man in `designFuer`
 * die URLs ein (`/hub/truhe/<grad>-koerper.webp` und `-deckel.webp`), sonst
 * nichts.
 */

import { Suspense, lazy, useEffect, useState } from 'react';

/**
 * Die 3D-Truhe wird nachgeladen — `three` und `drei` wiegen rund 900 kB.
 * Bis sie da ist, bleibt die Buehne leer; die Oeffnung dauert ohnehin drei
 * Sekunden, und ein Platzhalter, der eine halbe Sekunde spaeter durch etwas
 * anderes ersetzt wird, waere unruhiger als nichts.
 */
const Truhe3D = lazy(() => import('./Truhe3D'));

/**
 * Wann der Deckel aufgeht.
 *
 * Muss zum Wackeln in `styles.css` passen: `truhe-wackeln` laeuft 0,85 s,
 * danach klappt der Deckel auf. Vorher stand diese Zahl als Verzoegerung in
 * der CSS-Animation `truhe-deckel-auf` — jetzt bewegt sich der Deckel im
 * Raum, und die Zahl steht hier.
 */
const DECKEL_AUF_MS = 900;

export type Grad = 'holz' | 'bronze' | 'silber' | 'gold' | 'diamant';

/** Wie lange die ganze Öffnung läuft, bevor „Tippen zum Weiter" erscheint. */
export const TRUHE_DAUER_MS = 3200;

interface Farben {
  readonly base: string;
  readonly dunkel: string;
  readonly metall: string;
  readonly glut: string;
}

const FARBEN: Record<Grad, Farben> = {
  holz: { base: '#9a6531', dunkel: '#5e3a17', metall: '#4a4038', glut: '#ffd27a' },
  bronze: { base: '#bd7a3a', dunkel: '#7d4a1e', metall: '#5a3c22', glut: '#ffcf8a' },
  silber: { base: '#cdd3db', dunkel: '#9aa2ac', metall: '#7d848d', glut: '#eaf3ff' },
  gold: { base: '#e6b53c', dunkel: '#b0821f', metall: '#8a6414', glut: '#fff0b0' },
  diamant: { base: '#aee6f2', dunkel: '#6fb9cc', metall: '#4a90a0', glut: '#dcfbff' },
};

function svgUri(inner: string, w: number, h: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function verlauf(f: Farben, id: string): string {
  return `<defs><linearGradient id='${id}' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${f.base}'/><stop offset='1' stop-color='${f.dunkel}'/></linearGradient></defs>`;
}

/** Platzhalter-Körper: offene Kiste mit dunklem Innenraum, Beschläge, Schloss. */
function koerperUri(f: Farben): string {
  const box = `<rect x='8' y='26' width='144' height='84' rx='10' fill='url(#k)' stroke='${f.metall}' stroke-width='4'/>`;
  const innen = `<ellipse cx='80' cy='28' rx='66' ry='11' fill='#241a12'/>`;
  const rim = `<path d='M10 28 Q80 16 150 28' fill='none' stroke='${f.metall}' stroke-width='5' opacity='0.9'/>`;
  const bands = `<rect x='36' y='30' width='9' height='80' fill='${f.metall}' opacity='0.7'/><rect x='115' y='30' width='9' height='80' fill='${f.metall}' opacity='0.7'/>`;
  const lock = `<rect x='69' y='64' width='22' height='28' rx='4' fill='${f.metall}'/><circle cx='80' cy='76' r='4.5' fill='${f.dunkel}'/>`;
  return svgUri(verlauf(f, 'k') + box + innen + rim + bands + lock, 160, 116);
}

/** Platzhalter-Deckel: gewölbt, unten flach (die Scharnierkante). */
function deckelUri(f: Farben): string {
  const dome = `<path d='M6 60 L6 42 Q84 -4 162 42 L162 60 Z' fill='url(#d)' stroke='${f.metall}' stroke-width='4'/>`;
  const band = `<path d='M8 46 Q84 8 160 46' fill='none' stroke='${f.metall}' stroke-width='7' opacity='0.8'/>`;
  const clasp = `<rect x='72' y='47' width='24' height='15' rx='3' fill='${f.metall}'/>`;
  return svgUri(verlauf(f, 'd') + dome + band + clasp, 168, 64);
}

export interface TruhenDesign {
  /** Untere Ebene (die Kiste). */
  readonly koerper: string;
  /** Obere Ebene (der Deckel), klappt am unteren Rand auf. */
  readonly deckel: string;
  /** Farbe des Lichts, das beim Öffnen herausbricht. */
  readonly glut: string;
}

/**
 * Das Aussehen je Grad. **Hier** wechselt man das Design — die Animation bleibt.
 * Zurzeit SVG-Platzhalter; sobald die gemalten Ebenen unter
 * `/hub/truhe/<grad>-koerper.webp` und `-deckel.webp` liegen, die beiden Werte
 * auf die URLs umstellen.
 */
export function designFuer(grad: Grad): TruhenDesign {
  const f = FARBEN[grad];
  return { koerper: koerperUri(f), deckel: deckelUri(f), glut: f.glut };
}

export function TruhenOeffnung({
  grad,
  muenzen,
  onFertig,
}: {
  grad: Grad;
  /** Was aus der Truhe kommt. Zurzeit immer Münzen. */
  muenzen: number;
  onFertig: () => void;
}): React.JSX.Element {
  const design = designFuer(grad);
  const [fertig, setFertig] = useState(false);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    const auf = window.setTimeout(() => setOffen(true), DECKEL_AUF_MS);
    const handle = window.setTimeout(() => setFertig(true), TRUHE_DAUER_MS);
    return () => {
      window.clearTimeout(auf);
      window.clearTimeout(handle);
    };
  }, []);

  return (
    <div
      className={`truhe-oeffnung grad-${grad}`}
      style={{ '--glut': design.glut } as React.CSSProperties}
      onClick={onFertig}
      role="dialog"
      aria-label="Truhe wird geöffnet"
    >
      <div className="truhe-buehne">
        <div className="truhe-strahlen" aria-hidden="true" />
        <div className="truhe-glut" aria-hidden="true" />
        {/*
          Zwei Wrapper: der äußere dreht die Truhe im Raum, der innere wackelt.
          So stören sich Drehung (rotateY) und Wackeln (rotateZ) nicht.

          **Beides bleibt in CSS, der Deckel nicht.** Wackeln und Drehen
          bewegen die ganze Truhe, und dafür ist eine Transformation auf dem
          Element genau richtig — sie kostet nichts und läuft auf der
          Grafikkarte. Der Deckel dagegen klappt auf: Das ist eine Lage im
          Raum und keine Verzerrung eines Bildes. Er wandert deshalb im Modell
          zwischen den beiden Posen aus `chest_normalize.json`.
        */}
        <div className="truhe-dreh">
          <div className="truhe-schuettel">
            <Suspense fallback={null}>
              <Truhe3D grad={grad} offen={offen} />
            </Suspense>
          </div>
        </div>
        <div className="truhe-belohnung" aria-live="polite">
          <img src="/hub/muenze.png" alt="" draggable={false} />
          <strong>{muenzen}</strong>
        </div>
      </div>
      <p className="truhe-hinweis">{fertig ? 'Tippen zum Weiter' : ' '}</p>
    </div>
  );
}
