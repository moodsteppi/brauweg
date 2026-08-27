/**
 * Das Heim von Mememory: drei Seiten nebeneinander, eine davon sichtbar.
 *
 * Links die Sammlung, in der Mitte das Menue, rechts "Mehr". Gewischt wird
 * mit dem Finger nach rechts, um die Sammlung zu holen — dieselbe Richtung
 * wie ueberall sonst am Telefon: Der Finger zieht den Inhalt mit, und was
 * links liegt, kommt dabei ins Bild.
 *
 * **Gebaut als Rollflaeche mit Rastpunkten und nicht mit eigener
 * Fingerrechnung.** `scroll-snap` bringt Schwung, Widerstand am Rand,
 * Rueckfederung und die Zeigerbedienung mit, und zwar in genau der Art, die
 * das Geraet auch sonst hat. Wer das nachbaut, schreibt zweihundert Zeilen
 * `touchmove` und bekommt am Ende ein Wischen, das sich anders anfuehlt als
 * jedes andere auf dem Bildschirm.
 *
 * **Die Startseite ist die MITTE, und das ist der heikle Teil.** Eine
 * Rollflaeche steht beim Aufbau links. Die Mitte laesst sich erst
 * einstellen, wenn die Breite feststeht — und die steht bei einem Blatt, das
 * gerade erst entsteht, noch nicht immer. Deshalb wird so lange nachgesetzt,
 * bis es einmal geklappt hat (siehe `stellEin`), und nicht ein einziges Mal
 * auf gut Glueck.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Haus, Winkel } from '../../zeichen';

export type Seite = 'sammlung' | 'menue' | 'mehr';

/** Die Reihenfolge auf dem Streifen — von links nach rechts. */
export const SEITEN: readonly Seite[] = ['sammlung', 'menue', 'mehr'];

const BESCHRIFTUNG: Readonly<Record<Seite, string>> = {
  sammlung: 'Sammlung',
  menue: 'Mememory',
  mehr: 'Mehr',
};

export function Heim({
  sammlung,
  menue,
  mehr,
  onSeite,
}: {
  sammlung: React.ReactNode;
  menue: React.ReactNode;
  mehr: React.ReactNode;
  /** Welche Seite gerade vorne liegt. */
  onSeite?: (seite: Seite) => void;
}): React.JSX.Element {
  const streifenRef = useRef<HTMLDivElement | null>(null);
  const [seite, setSeite] = useState<Seite>('menue');
  /** Stand die Flaeche schon einmal richtig? Danach nicht mehr eingreifen. */
  const gestellt = useRef(false);

  /**
   * Auf die Mitte stellen, ohne Bewegung.
   *
   * `scrollLeft` und nicht `scrollTo({behavior:'smooth'})`: Beim Aufbau soll
   * das Menue einfach DA sein. Eine Bewegung, die den Nutzer von der
   * Sammlung ins Menue schiebt, saehe aus, als haette er sich vertippt.
   */
  const stellEin = useCallback((): void => {
    const streifen = streifenRef.current;
    if (!streifen || gestellt.current) return;
    const breite = streifen.clientWidth;
    // Breite null heisst: Das Blatt ist noch nicht vermessen. Ein Sprung auf
    // 0 * 1 waere die linke Seite — genau das, was hier nie passieren soll.
    if (breite <= 0) return;
    streifen.scrollLeft = breite * SEITEN.indexOf('menue');
    gestellt.current = true;
  }, []);

  useLayoutEffect(() => {
    stellEin();
    const streifen = streifenRef.current;
    if (!streifen || gestellt.current) return;
    // Noch keine Breite: Dann wartet ein Beobachter auf die erste. Das ist
    // der Fall, den ein einzelner Versuch beim Aufbau verpasst.
    const beobachter = new ResizeObserver(() => stellEin());
    beobachter.observe(streifen);
    return () => beobachter.disconnect();
  }, [stellEin]);

  /**
   * Welche Seite liegt vorne?
   *
   * Gerundet und nicht abgeschnitten: Mitten im Wischen steht die Flaeche
   * zwischen zwei Seiten, und der Punkt unten soll dann schon die zeigen,
   * bei der man landen wird.
   */
  useEffect(() => {
    const streifen = streifenRef.current;
    if (!streifen) return;
    const merke = (): void => {
      const breite = streifen.clientWidth;
      if (breite <= 0) return;
      const nr = Math.min(
        SEITEN.length - 1,
        Math.max(0, Math.round(streifen.scrollLeft / breite)),
      );
      setSeite(SEITEN[nr] ?? 'menue');
    };
    streifen.addEventListener('scroll', merke, { passive: true });
    return () => streifen.removeEventListener('scroll', merke);
  }, []);

  useEffect(() => {
    onSeite?.(seite);
  }, [seite, onSeite]);

  /** Zu einer Seite fahren — der Weg fuer die Leiste unten. */
  const geheZu = useCallback((ziel: Seite): void => {
    const streifen = streifenRef.current;
    if (!streifen) return;
    streifen.scrollTo({
      left: streifen.clientWidth * SEITEN.indexOf(ziel),
      behavior: 'smooth',
    });
  }, []);

  return (
    <main className="mm-heim">
      <div className="mm-streifen" ref={streifenRef}>
        <section className="mm-blatt" aria-label="Sammlung">
          {sammlung}
        </section>
        <section className="mm-blatt" aria-label="Mememory">{menue}</section>
        <section className="mm-blatt" aria-label="Mehr">
          {mehr}
        </section>
      </div>

      {/*
        * Die Leiste liegt ueber dem Streifen und rollt nicht mit: Sie ist die
        * Karte, nicht der Inhalt.
        *
        * Sie ist zugleich der einzige sichtbare Hinweis darauf, dass es links
        * und rechts weitergeht — die Randlaschen am Menue sind am 27. August
        * abends wieder herausgeflogen. Deshalb tragen die aeusseren beiden
        * einen WINKEL und keinen Punkt: Ein Punkt sagt "hier ist noch eine
        * Seite", ein Winkel sagt zusaetzlich, in welche Richtung. Der mittlere
        * ist ein Haus, weil dort das Hauptmenue liegt.
        *
        * Angetippt fuehrt jedes Zeichen auf seine Seite. Das gelbe ist das,
        * auf dem man steht.
        */}
      <nav className="mm-punkte" aria-label="Seiten">
        {SEITEN.map((eine) => (
          <button
            key={eine}
            type="button"
            className="mm-punkt"
            data-an={eine === seite ? '' : undefined}
            aria-current={eine === seite ? 'page' : undefined}
            aria-label={BESCHRIFTUNG[eine]}
            onClick={() => geheZu(eine)}
          >
            {eine === 'menue' ? <Haus /> : <Winkel nach={eine === 'sammlung' ? 'links' : 'rechts'} />}
          </button>
        ))}
      </nav>
    </main>
  );
}
