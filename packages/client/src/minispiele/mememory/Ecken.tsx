/**
 * Die vier Ecken am Brett: Name, Punktzahl, und der Puck fuer den Zug.
 *
 * Loest die zwei Leisten ab, die bis zum 27. August oben und unten quer ueber
 * dem Brett lagen. Die Leisten konnten genau zwei Spieler; vier haetten sich
 * dort gegenseitig aus dem Bild geschoben. Ecken koennen vier, und zu zweit
 * sehen sie besser aus als eine Leiste: Das Brett bekommt die volle Hoehe.
 *
 * **Name weiss, Punktzahl in der Spielerfarbe, dazwischen ein Halbhochpunkt.**
 * Die Farbe traegt die Zahl und nicht den Namen — ein Name in Farbe waere auf
 * der dunklen Decke schlechter zu lesen, und die Zahl ist ohnehin das, was
 * man im Spiel sucht.
 */

import { useLayoutEffect, useRef } from 'react';

import { eckeVon, farbeVon } from './eckenplan';

export function Ecken({
  sitze,
  eigenerSitz,
  punkte,
  nameVon,
  dran,
}: {
  /** Die Sitze des Tisches, aufsteigend. */
  sitze: readonly number[];
  /** Der eigene Sitz, oder -1 als Zuschauer. */
  eigenerSitz: number;
  punkte: Readonly<Record<number, number>>;
  nameVon: (sitz: number) => string;
  /** Wer am Zug ist, oder null waehrend einer Schaupause bzw. am Ende. */
  dran: number | null;
}): React.JSX.Element {
  const puckRef = useRef<HTMLSpanElement | null>(null);
  /**
   * Wo der Puck zuletzt lag. Grundlage der Wanderung: Beim Zugwechsel baut
   * React ihn in der neuen Ecke neu auf — er waere also einfach woanders.
   * Gemessen wird deshalb VORHER und NACHHER, und die Differenz wird
   * zurueckgespielt (FLIP).
   */
  const letzterOrt = useRef<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const puck = puckRef.current;
    if (!puck) {
      // Niemand am Zug (Schaupause, Partieende). Der naechste Auftritt fangt
      // ohne Wanderung an — von nirgendwo laesst sich nicht laufen.
      letzterOrt.current = null;
      return;
    }
    const kasten = puck.getBoundingClientRect();
    const jetzt = { x: kasten.left, y: kasten.top };
    const vorher = letzterOrt.current;
    letzterOrt.current = jetzt;
    if (!vorher) return;

    const dx = vorher.x - jetzt.x;
    const dy = vorher.y - jetzt.y;
    // Unter einem Pixel ist es derselbe Ort — dann hat nur die Punktzahl die
    // Zeile umgebrochen, und eine Animation darauf waere ein Zucken.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    puck.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: 430, easing: 'cubic-bezier(.34, 1.12, .38, 1)' },
    );
  }, [dran, sitze.length, eigenerSitz]);

  return (
    <>
      {sitze.map((sitz) => (
        <div
          key={sitz}
          className="mm-ecke"
          data-ecke={eckeVon(sitz, eigenerSitz, sitze)}
          data-farbe={farbeVon(sitz)}
        >
          {/*
            * Der Puck liegt ueber dem Namen (untere Ecken) bzw. darunter
            * (obere) — das macht das Blatt ueber `flex-direction`, die
            * Reihenfolge im Text bleibt dieselbe. Sein Fach behaelt seine
            * Hoehe auch leer: Sonst rutschte der Name bei jedem Zugwechsel
            * um zehn Pixel.
            */}
          <span className="mm-puck-fach" aria-hidden="true">
            {dran === sitz && <span className="mm-puck" ref={puckRef} />}
          </span>
          <span className="mm-ecke-zeile">
            <span className="mm-ecke-name">{nameVon(sitz)}</span>
            <span className="mm-ecke-trenner" aria-hidden="true">
              ·
            </span>
            <b className="mm-ecke-stand">{punkte[sitz] ?? 0}</b>
          </span>
        </div>
      ))}
    </>
  );
}
