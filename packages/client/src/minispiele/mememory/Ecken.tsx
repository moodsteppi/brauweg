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
 *
 * **Die Punktzahl steht immer innen.** In den linken Ecken hinter dem Namen,
 * in den rechten davor — das macht `row-reverse` im Blatt, die Reihenfolge im
 * Text bleibt dieselbe. Der Grund ist der Blick: Waehrend einer Partie sucht
 * man den Stand, und alle vier Staende an der Bildmitte zu haben ist ein
 * kurzer Weg. Aussen an den Bildschirmraendern waeren es vier weit
 * auseinanderliegende Punkte.
 */

import { useLayoutEffect, useRef } from 'react';

import { eckeVon, farbeVon } from './eckenplan';

export function Ecken({
  sitze,
  eigenerSitz,
  punkte,
  nameVon,
  stufeVon,
  dran,
}: {
  /** Die Sitze des Tisches, aufsteigend. */
  sitze: readonly number[];
  /** Der eigene Sitz, oder -1 als Zuschauer. */
  eigenerSitz: number;
  punkte: Readonly<Record<number, number>>;
  nameVon: (sitz: number) => string;
  /**
   * Die Spielstaerke eines Bots, fertig zum Anzeigen — oder null fuer einen
   * Menschen.
   *
   * Sie steht NEBEN dem Namen und nicht darin: Am Namen haengt das
   * Abschneiden bei zu wenig Platz (`text-overflow`), und ein abgeschnittenes
   * „KI · Schw…" waere schlechter als gar keine Stufe.
   */
  stufeVon?: (sitz: number) => string | null;
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
          {/*
            * Der Stapel: eine Karte je Punkt, hinter dem Namen hervor.
            *
            * Er steht VOR der Namenszeile im Blatt und rutscht ueber einen
            * negativen Abstand unter sie — so schaut er hinter dem Kissen
            * hervor, statt daneben zu stehen. In den oberen Ecken kehrt
            * `column-reverse` die Reihenfolge um, dort liegt er entsprechend
            * unter dem Namen.
            *
            * Die Karten tragen alle dieselbe Quelle: ein Bild, einmal
            * geladen, danach aus dem Zwischenspeicher. Zwanzig davon je
            * Spieler sind zwanzig Knoten — aber keine zwanzig Anfragen.
            */}
          {(punkte[sitz] ?? 0) > 0 && (
            <span className="mm-ecke-stapel" aria-hidden="true">
              {Array.from({ length: punkte[sitz] ?? 0 }, (_, i) => (
                /*
                 * Schluessel ist die Nummer der Karte. Damit bleiben die
                 * schon liegenden Karten dieselben Knoten, und nur die neue
                 * entsteht — nur sie spielt deshalb die kurze Bewegung.
                 */
                <img key={i} src="/mememory/karte-ruecken.webp" alt="" draggable={false} />
              ))}
            </span>
          )}
          <span className="mm-ecke-zeile">
            <span className="mm-ecke-name">{nameVon(sitz)}</span>
            {/*
              * Die Stufe steht nur da, wo ein Bot sitzt. An einem Menschen
              * gaebe es nichts anzuzeigen, und ein leeres Schildchen waere
              * eine Zeile, die bei zwei Sitzen verschieden hoch ist.
              */}
            {stufeVon?.(sitz) && (
              <span className="mm-ecke-stufe">{stufeVon(sitz)}</span>
            )}
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
