import { Suspense, lazy, useEffect, useRef, useState } from 'react';

import { spiele } from '../klang';

/**
 * Avatar-Werkstatt — der Pinguin in drei Dimensionen, zum Drehen und Anziehen.
 *
 * **Warum ein eigener Bildschirm und nicht der Kleiderschrank.** Der
 * Kleiderschrank zieht den gemalten Pinguin an, und der kann heute
 * dreiunddreißig Stücke auf sechs Plätzen. In drei Dimensionen gibt es genau
 * eines: die lila Mütze. Den Kleiderschrank jetzt umzustellen hieße,
 * zweiunddreißig Stücke aus der Oberfläche zu nehmen, damit eines neu ist.
 *
 * Also steht 3D daneben, bis es den gemalten Pinguin einholt. Der Weg dorthin
 * steht in `docs/UEBERGABE-ANNI.md`: dieselben Plätze, dieselben Kennungen,
 * dann tauscht man die Darstellung und sonst nichts.
 *
 * **Das Ganze wird nachgeladen.** `three` und `drei` wiegen rund 900 kB —
 * mehr als das ganze übrige Bündel. Wer nie hierherkommt, lädt sie nie.
 */

const Avatar3D = lazy(() => import('../Avatar3D'));

export function Avatarwerkstatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [muetze, setMuetze] = useState(false);

  /**
   * Die Leinwand entsteht erst, wenn die Bühne einmal vermessen ist.
   *
   * Ohne das blieb sie beim ersten Öffnen schwarz — und zwar hartnäckig:
   * `frameloop`, Bilder von Hand nachfordern, R3Fs eigene Vermessung
   * umstellen, die Modelle vor der Leinwand laden — nichts davon half.
   * Sichtbar wurde die Figur nur, wenn sich das Fenster um einen Pixel
   * änderte. Also bekommt die Leinwand einen Platz, der schon steht, statt
   * einen, der sich unter ihr noch einrichtet.
   */
  const buehne = useRef<HTMLDivElement>(null);

  /**
   * Der Anstoß — ein Notnagel, und als solcher benannt.
   *
   * Nachweislich hilft nur eines: dass sich die Größe der Bühne einmal
   * ändert. Dann zeichnet R3F die Figur, und danach läuft alles. Warum das
   * erste Bild ohne diese Änderung leer bleibt, habe ich nicht gefunden —
   * `frameloop`, nachgeforderte Bilder, R3Fs eigene Vermessung und das Laden
   * der Modelle vor der Leinwand waren alle nicht die Ursache.
   *
   * Also wird die Höhe für ein Bild um einen Pixel verstellt und sofort
   * wieder zurückgenommen. Man sieht es nicht, es kostet nichts, und es tut
   * genau das, was von Hand auch funktioniert.
   *
   * **Wer die Ursache findet, wirft das hier raus** — der Rest der Datei
   * hängt nicht daran.
   */
  const anstossen = (): void => {
    const el = buehne.current;
    if (!el) return;
    const hoehe = el.clientHeight;
    el.style.height = `${hoehe + 1}px`;
    // Lange genug halten, dass der ResizeObserver zwei verschiedene Größen
    // sieht. Innerhalb eines Bildes fasst er beide zusammen, und dann ist
    // unterm Strich nichts passiert.
    window.setTimeout(() => {
      el.style.height = '';
    }, 120);
  };
  const [vermessen, setVermessen] = useState(false);
  useEffect(() => {
    const el = buehne.current;
    if (!el) return;
    const beobachter = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setVermessen(true);
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  const schliessen = (): void => {
    spiele('blatt-zu');
    onClose();
  };

  return (
    <div className="doko-sheet doko-sheet--mitte" onClick={schliessen}>
      <div
        className="doko-sheet-card werkstatt"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Deine Figur</h2>

        <div className="werkstatt-buehne" ref={buehne}>
          {/*
            Der Rückfall ist bewusst ein Text und kein Platzhalterbild: Die
            Modelle sind 700 kB, das dauert im Zug einen Moment, und ein
            stehender grauer Kasten sieht in dieser Zeit nach Fehler aus.
          */}
          <Suspense
            fallback={<p className="muted werkstatt-laedt">Figur wird geladen…</p>}
          >
            {vermessen && <Avatar3D muetze={muetze} onBereit={anstossen} />}
          </Suspense>
        </div>

        <p className="muted werkstatt-hinweis">Zum Drehen wischen</p>

        <div className="werkstatt-wahl">
          {/*
            Holzknoepfe statt `lobby-chip`: Der Umschalter der Lobby haengt an
            `menue-schalter-an/aus.webp`, und die sind noch aus der alten
            flachen Lieferung. Neben dem gemalten Rahmen sehen sie aus wie
            vergessen. Gewaehlt zeigt hier ein goldener Ring statt einer
            anderen Farbe — gruen hiesse "tun", und ausgesucht ist nicht getan.
          */}
          <button
            className={`hub-knopf hub-knopf--a werkstatt-knopf${!muetze ? ' is-gewaehlt' : ''}`}
            aria-pressed={!muetze}
            onClick={() => {
              spiele('tipp');
              setMuetze(false);
            }}
          >
            Ohne
          </button>
          <button
            className={`hub-knopf hub-knopf--a werkstatt-knopf${muetze ? ' is-gewaehlt' : ''}`}
            aria-pressed={muetze}
            onClick={() => {
              spiele('schalter');
              setMuetze(true);
            }}
          >
            Mit Mütze
          </button>
        </div>

        <p className="muted werkstatt-fuss">
          Erste Anprobe in 3D. Deine gemalten Sachen liegen weiter im
          Kleiderschrank — sie ziehen nach.
        </p>

        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button className="hub-knopf hub-knopf--a" onClick={schliessen}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
