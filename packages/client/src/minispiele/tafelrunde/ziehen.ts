/**
 * Ziehen mit dem Finger — die Zeigerverdrahtung der Ruestkammer als Haken.
 *
 * Stand bis zum 23.09.2026 in screens/Tafelrunde.tsx und war das letzte
 * Stueck, das beim Herausziehen von Brett und Bank (6.9.2026) dort
 * geblieben ist. Die Probe `/probe/ruestkammer` konnte deshalb nur
 * Antippen—Ziel-antippen, und drei Zustaende waren dort gar nicht zu sehen:
 * die stillgestellte Einheit am Herkunftsplatz (`data-still`), das Feld
 * unter dem Finger (`data-unterzeiger`) und der Zugschatten (`.tr-schatten`).
 * Wer an deren Aussehen etwas aenderte, brauchte dafuer eine Partie. Jetzt
 * benutzen Bildschirm und Probe denselben Haken — eine nachgebaute
 * Verdrahtung in der Probe waere dieselbe Falle, vor der der Kopf von
 * `ProbeRuestkammer.tsx` warnt.
 *
 * Es steht hier KEINE Regel. Ob gehandelt werden darf (`darf`), wohin eine
 * Einheit darf (`zielbar`), was ein Tipp bedeutet (`tippe`) und was das
 * Ablegen ausloest (`schiebe`), kommt vom Aufrufer. Der Haken weiss nur, wie
 * aus Zeigerereignissen ein Tipp oder ein Zug wird.
 *
 * Pointer-Ereignisse und NICHT die HTML5-Zieh-Schnittstelle: `dragstart`
 * gibt es auf iOS und Android schlicht nicht, ein Brett, das nur mit der
 * Maus zu bedienen ist, waere am Handy unbenutzbar — und die App wird am
 * Handy gespielt.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import { type Ort, ortLesen } from './zuege';

/** Ab so vielen Pixeln in eine Richtung ist es ein Zug und kein Tipp mehr. */
const ZIEHSCHWELLE = 8;

/**
 * Der Ablegeplatz unter einem Bildschirmpunkt — als Schluessel, oder null.
 *
 * Die Trefferpruefung laeuft ueber `document.elementFromPoint`, weil das Ziel
 * unter dem FINGER liegt und nicht unter dem Ereignis (das gehoert wegen der
 * Zeigererfassung immer noch der gezogenen Einheit). Beide Aufrufer — die
 * Vorschau waehrend des Ziehens und das Ablegen am Ende — gehen durch diese
 * eine Funktion: Was leuchtet, ist damit garantiert dasselbe Feld, auf dem
 * die Einheit gleich landet.
 *
 * `elementFromPoint` gibt es in jsdom nicht. Ohne die Pruefung waere jeder
 * Test, der zieht, ein Absturz statt einer Aussage.
 */
export function zielUnter(x: number, y: number): string | null {
  if (typeof document.elementFromPoint !== 'function') return null;
  const unten = document.elementFromPoint(x, y);
  return (unten?.closest('[data-ziel]') as HTMLElement | null)?.dataset.ziel ?? null;
}

/** Was gerade am Finger haengt, samt Bildschirmkoordinate fuer den Schatten. */
export interface Zug {
  readonly von: Ort;
  readonly x: number;
  readonly y: number;
}

/** Die vier Rueckrufe, die `Hexbrett` und `Bankreihe` als Eigenschaften nehmen. */
export interface Zeigerrufe {
  onZeigerStart: (ort: Ort, ereignis: React.PointerEvent) => void;
  onZeigerBewegung: (ereignis: React.PointerEvent) => void;
  onZeigerEnde: (ort: Ort, ereignis: React.PointerEvent) => void;
  onZeigerAbbruch: () => void;
}

export interface Ziehen {
  /** Der laufende Zug — erst gesetzt, wenn der Finger die Schwelle ueberschritten hat. */
  readonly zug: Zug | null;
  /** Woher der Zug kommt — fuer `ziehtVon` an Brett und Bank. */
  readonly ziehtVon: Ort | null;
  /** Wo die Einheit landet, wenn der Finger jetzt loslaesst — fuer `unterZeiger`. */
  readonly ablegeZiel: string | null;
  readonly zeiger: Zeigerrufe;
  /**
   * Stellt einen Zug her, ohne dass ein Finger zieht — fuer die Probe, deren
   * Sichtprobe nicht ziehen kann (`?zug=` in ProbeRuestkammer.tsx). Am Tisch
   * ruft das niemand.
   */
  readonly vorfuehren: (von: Ort, x: number, y: number) => void;
}

export function useZiehen({
  darf,
  zielbar,
  tippe,
  schiebe,
}: {
  /** Darf der Spieler gerade handeln? Ohne das faengt kein Zug an. */
  darf: boolean;
  /** Darf eine Einheit von `von` nach `nach`? Dieselbe Pruefung wie beim Antippen. */
  zielbar: (von: Ort, nach: Ort) => boolean;
  /** Ein Tipp ohne Bewegung — derselbe Weg wie beim Antippen. */
  tippe: (ort: Ort) => void;
  /** Losgelassen ueber einem Ablegeplatz. */
  schiebe: (von: Ort, nach: Ort) => void;
}): Ziehen {
  const [zug, setZug] = useState<{ von: Ort; x: number; y: number; zieht: boolean } | null>(null);
  const startPunkt = useRef<{ x: number; y: number } | null>(null);
  /*
   * Ob gerade wirklich gezogen wird — dieselbe Auskunft wie `zug.zieht`, nur
   * synchron lesbar. Der Bewegungs-Behandler hat keine Abhaengigkeiten (er
   * soll bei jedem Zeigerereignis derselbe bleiben) und sieht den Zustand
   * deshalb nicht. Ohne diese Merkzelle bliebe die Vorschau auf dem letzten
   * Feld stehen, sobald der Finger in die Naehe seines Ausgangspunkts
   * zurueckkehrt: Dort ist die Strecke wieder kurz, `weit` also falsch.
   */
  const zieht = useRef(false);

  /**
   * Welches Feld gerade UNTER dem Finger liegt — als Schluessel, nicht als Ort.
   *
   * Ohne diese Anzeige laesst man eine Einheit blind los: Der Schatten haengt
   * am Finger und verdeckt genau die Wabe, auf die man zielt. Gesucht wird
   * mit demselben Griff wie beim Ablegen (`zielUnter`), damit Vorschau und
   * Ergebnis nicht auseinanderlaufen koennen.
   *
   * Als Zeichenkette gehalten und nur bei WECHSEL gesetzt: Ein neuer Ort bei
   * jedem Zeigerereignis waere ein neues Objekt und damit ein Neuzeichnen des
   * ganzen Bretts sechzigmal je Sekunde.
   */
  const [ueberZiel, setUeberZiel] = useState<string | null>(null);

  const onZeigerStart = useCallback(
    (ort: Ort, ereignis: React.PointerEvent): void => {
      if (!darf) return;
      startPunkt.current = { x: ereignis.clientX, y: ereignis.clientY };
      zieht.current = false;
      setZug({ von: ort, x: ereignis.clientX, y: ereignis.clientY, zieht: false });
      // Ohne Zeigererfassung verliert das Element die Bewegung, sobald der
      // Finger es verlaesst — und das tut er sofort.
      (ereignis.currentTarget as HTMLElement).setPointerCapture?.(ereignis.pointerId);
    },
    [darf],
  );

  const onZeigerBewegung = useCallback((ereignis: React.PointerEvent): void => {
    const start = startPunkt.current;
    if (!start) return;
    const weit =
      Math.abs(ereignis.clientX - start.x) > ZIEHSCHWELLE ||
      Math.abs(ereignis.clientY - start.y) > ZIEHSCHWELLE;
    if (weit) zieht.current = true;
    setZug((alt) =>
      alt ? { ...alt, x: ereignis.clientX, y: ereignis.clientY, zieht: alt.zieht || weit } : alt,
    );
    if (zieht.current) setUeberZiel(zielUnter(ereignis.clientX, ereignis.clientY));
  }, []);

  /**
   * Der Browser hat das Ziehen abgebrochen — ein Anruf, eine Geste des
   * Betriebssystems, ein zweiter Finger. Ohne diesen Aufraeumer bliebe der
   * Schatten am Bildschirm kleben und die Einheit blass an ihrem Platz.
   */
  const onZeigerAbbruch = useCallback((): void => {
    startPunkt.current = null;
    zieht.current = false;
    setZug(null);
    setUeberZiel(null);
  }, []);

  const onZeigerEnde = useCallback(
    (ort: Ort, ereignis: React.PointerEvent): void => {
      /*
       * Aus der Merkzelle und nicht aus `zug.zieht`: Bis zum 23.09.2026 stand
       * hier der Zustand, und kamen Bewegung und Loslassen im selben Takt an,
       * sah dieser Behandler noch den alten Stand — der Zug galt dann als
       * Tipp und schlug das Blatt auf, statt abzulegen.
       */
      const gezogen = zieht.current;
      startPunkt.current = null;
      zieht.current = false;
      setZug(null);
      setUeberZiel(null);
      if (!gezogen) {
        // Ein Tipp, keine Bewegung: Auswahl statt Ziehen.
        tippe(ort);
        return;
      }
      const ziel = ortLesen(zielUnter(ereignis.clientX, ereignis.clientY));
      if (ziel) schiebe(ort, ziel);
    },
    [tippe, schiebe],
  );

  const vorfuehren = useCallback((von: Ort, x: number, y: number): void => {
    zieht.current = true;
    setZug({ von, x, y, zieht: true });
    setUeberZiel(zielUnter(x, y));
  }, []);

  /**
   * Das Feld unter dem Finger — aber nur, wenn die gezogene Einheit dort auch
   * landen DARF.
   *
   * Die Vorschau soll nicht mehr versprechen, als das Ablegen einloest: Ueber
   * einem vollen Brett leuchtet nichts, und genau das ist die Auskunft.
   * Geprueft wird mit derselben Funktion wie beim Ablegen (`zielbar`) — hier
   * wird keine Regel nachgebaut.
   */
  const laeuft = zug?.zieht === true;
  const ablegeZiel = useMemo(() => {
    if (!laeuft || !zug || ueberZiel === null) return null;
    const ort = ortLesen(ueberZiel);
    return ort && zielbar(zug.von, ort) ? ueberZiel : null;
  }, [laeuft, zug?.von, ueberZiel, zielbar]);

  const zeiger = useMemo(
    () => ({ onZeigerStart, onZeigerBewegung, onZeigerEnde, onZeigerAbbruch }),
    [onZeigerStart, onZeigerBewegung, onZeigerEnde, onZeigerAbbruch],
  );

  return {
    zug: laeuft && zug ? { von: zug.von, x: zug.x, y: zug.y } : null,
    ziehtVon: laeuft && zug ? zug.von : null,
    ablegeZiel,
    zeiger,
    vorfuehren,
  };
}
