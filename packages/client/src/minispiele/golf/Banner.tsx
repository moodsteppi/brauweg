/**
 * Das Banner von Golf in der Spielauswahl: eine Bahn, die sich selbst spielt.
 *
 * Wie bei Eiland und Tafelrunde ist das Motiv das Spiel selbst. Anders als
 * dort ist es hier aber KEINE Abschrift der Regeln: Golfs Kern liegt im
 * Client (`physik.ts`, `bot.ts`, `gleichschritt.ts`) und nicht in einem
 * Spielpaket — das Banner darf ihn deshalb einfach benutzen. Vier Bots
 * spielen eine kleine Bahn, dieselbe Physik und derselbe Zeichner wie in der
 * Partie. Was hier läuft, läuft im Spiel genauso.
 *
 * Für dieses Spiel gibt es noch kein gemaltes Banner. „Weniger Bewegung"
 * heißt deshalb nicht „anderes Bild", sondern EIN Bild: Es wird ein einziges
 * Mal gezeichnet und danach nichts mehr. Ein `<img>` auf eine Datei, die es
 * nicht gibt, wäre der Fehler aus der CLAUDE.md.
 *
 * Bei verdecktem Tab passiert nichts — dieselbe Regel wie bei den anderen
 * Bannern.
 */

import { useEffect, useRef, useState } from 'react';

import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import { klemme, weltMasse } from './kamera';
import { TAKT_MS } from './physik';
import { Zeichner } from './zeichnen';

/**
 * Die Bahn des Banners — ein breiter Streifen statt einer Bahn im Hochformat.
 *
 * Das Format ist kein Geschmack, sondern Vorgabe: Die Kachel der Spielauswahl
 * ist 4:1 (`aspect-ratio` in styles.css, dieselbe Form wie die gemalten
 * Banner). Eine Bahn im Spielformat läge darin als briefmarkengroßer Streifen
 * in der Mitte. Breite und Höhe sind deshalb so gewählt, dass die Bahn samt
 * Rahmen die Kachel FÜLLT und oben und unten ein paar Zentimeter Rahmen
 * abgeschnitten werden — lieber randlos beschnitten als mittig verloren.
 *
 * Inhaltlich absichtlich einfach: ein Tor, zwei Prallkörper, ein Beschleuniger
 * und eine Sandkuhle. Genug, dass in zehn Sekunden etwas passiert, und wenig
 * genug, dass die vier Bots das Loch auch wirklich finden.
 */
const BAHN: Karte = {
  id: 'banner-golf',
  name: 'Schaubahn',
  schwierigkeit: 2,
  breite: 36,
  hoehe: 8.4,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 50,
  abschlaege: [
    [2, 1.9],
    [2, 4.2],
    [2, 6.5],
    [3.6, 4.2],
  ],
  loch: [32, 4.2],
  waende: [
    { x: 15, y: 0, w: 0.7, h: 2.8 },
    { x: 15, y: 5.6, w: 0.7, h: 2.8 },
    { x: 24, y: 2.6, w: 0.7, h: 3.2 },
  ],
  zonen: [
    { art: 'beschleuniger', x: 8, y: 3.2, w: 3, h: 2, rx: 1, ry: 0, staerke: 26 },
    { art: 'bumper', x: 19, y: 1.9, r: 0.75 },
    { art: 'bumper', x: 19, y: 6.5, r: 0.75 },
    { art: 'sand', x: 26.5, y: 5.6, w: 4, h: 2.4 },
  ],
  dekor: 'wiese',
};

const SITZE = 4;
/** So lange bleibt die fertige Bahn stehen, bevor die nächste beginnt. */
const ENDE_MS = 2400;

function neuerLauf(saat: number): Gleichschritt {
  return new Gleichschritt({
    saat,
    sitze: SITZE,
    botSitze: [0, 1, 2, 3],
    loecher: 4,
    karten: [BAHN],
    botStufe: 'standard',
  });
}

export function GolfBanner(): React.JSX.Element {
  const [ruhig] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const leinwandRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const leinwand = leinwandRef.current;
    if (leinwand === null) return;
    const zeichner = new Zeichner(leinwand);
    if (!zeichner.bereit) return;

    let gs = neuerLauf(Math.floor(Math.random() * 1e9));
    let t0 = performance.now();
    let fertigSeit = 0;
    let laeuft = true;
    let bild = 0;

    const male = (jetzt: number): void => {
      const z = gs.zustand();
      zeichner.messe();
      const welt = weltMasse(BAHN);
      /*
       * Auf die BREITE gestellt, nicht auf beides: Ein Banner folgt keinem
       * Ball, es zeigt die ganze Bahn — und lieber randlos mit ein paar
       * beschnittenen Zentimetern Rahmen als mit dunklen Balken links und
       * rechts. `klemme` rückt die Höhe dabei in die Mitte.
       */
      const breite = welt.breite;
      zeichner.zeichne({
        karte: BAHN,
        zustand: z,
        vorher: gs.vorher(),
        anteil: 0.5,
        blick: klemme(welt.mx, welt.my, breite, welt, zeichner.seitenverhaeltnis),
        eigenerSitz: -1,
        ziel: null,
        uhrMs: jetzt,
        uebersicht: true,
      });
    };

    const takt = (): void => {
      if (!laeuft) return;
      bild = requestAnimationFrame(takt);
      if (typeof document !== 'undefined' && document.hidden) return;
      const jetzt = performance.now();
      const z = gs.zustand();
      if (z.fertig) {
        // Kurz stehen lassen, dann eine frische Partie — sonst endete das
        // Banner nach einer Minute in einem Standbild.
        if (fertigSeit === 0) fertigSeit = jetzt;
        else if (jetzt - fertigSeit > ENDE_MS) {
          gs = neuerLauf(Math.floor(Math.random() * 1e9));
          t0 = jetzt;
          fertigSeit = 0;
        }
      } else {
        gs.rechneBis(Math.floor((jetzt - t0) / TAKT_MS));
      }
      male(jetzt);
    };

    if (ruhig) {
      /*
       * Ein einziges Bild: die aufgestellten Bälle am Abschlag. Erst im
       * nächsten Bild und nicht sofort — beim Aufbau hat die Leinwand noch
       * keine Größe, und ein Bild in eine 0 × 0 große Fläche zu malen heißt,
       * dass danach nie wieder eines kommt.
       */
      bild = requestAnimationFrame(() => male(performance.now()));
      return () => cancelAnimationFrame(bild);
    }
    bild = requestAnimationFrame(takt);
    return () => {
      laeuft = false;
      cancelAnimationFrame(bild);
    };
  }, [ruhig]);

  return <canvas className="gf-banner" ref={leinwandRef} aria-hidden="true" />;
}
