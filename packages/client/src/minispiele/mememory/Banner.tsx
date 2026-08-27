/**
 * Das Banner von Mememory in der Spielauswahl — mit echten Memes darauf.
 *
 * Bis zum 27. August lag dort ein gemaltes Stillleben: eine Pinnwand voller
 * erfundener Tierkarten. Das sah nach Mememory aus, zeigte aber nichts, was
 * es im Spiel wirklich gibt. Jetzt haengen dort Bilder aus dem
 * Vorschlagskasten — dieselben, die im Spiel auf den Karten liegen.
 *
 * **Nur hochgeladene, ausdruecklich keine Grundmotive.** Die 88 aus dem
 * Katalog sind gezeichnet und gerechnet; das Banner soll zeigen, was die
 * Leute selbst eingeschickt haben. Deshalb kommt hier `hochgeladen` zum
 * Einsatz und nicht `grund`.
 *
 * **Und keine neue Datei.** Der Untergrund ist die rote Tischdecke aus dem
 * Spiel (`decke-rot.webp`, 19 kB, laedt am Tisch ohnehin), die Karten sind
 * die Motive selbst. Ein bestelltes Bild waere hier auch gar nicht moeglich:
 * Was darauf liegt, steht erst fest, wenn jemand etwas einreicht.
 *
 * **Faellt der Abruf aus oder ist noch nichts eingereicht, bleibt es beim
 * gemalten Banner.** Eine leere rote Flaeche sieht nach Fehler aus, das
 * Stillleben nach Absicht — dieselbe Regel wie ueberall in diesem Haus: kein
 * `<img>` auf etwas, das es noch nicht gibt.
 */

import { useEffect, useState } from 'react';

import { api } from '../../api';
import { spielBanner } from '../../hub';
import { motivBildPfad } from './bildpfad';

/** So viele Karten passen nebeneinander, ohne dass eine briefmarkig wird. */
const KARTEN = 5;

export function MememoryBanner(): React.JSX.Element {
  /** `null` = noch nicht gefragt oder fehlgeschlagen. Dann das gemalte Bild. */
  const [karten, setKarten] = useState<string[] | null>(null);

  useEffect(() => {
    let lebt = true;
    void api
      .mememoryMotive()
      .then((antwort) => {
        if (!lebt) return;
        const alle = antwort.hochgeladen ?? [];
        if (alle.length === 0) return;
        setKarten(waehle(alle, KARTEN));
      })
      .catch(() => {
        /* Kein Netz: Dann haengt eben das gemalte Banner da. */
      });
    return () => {
      lebt = false;
    };
  }, []);

  if (!karten || karten.length === 0) {
    return <img src={spielBanner('mememory')} alt="" draggable={false} />;
  }

  return (
    <span className="mm-banner">
      {/*
        * Die Tischdecke aus dem Spiel als Untergrund. Sie ist hochkant und
        * wird hier quer gebraucht — `object-fit: cover` schneidet den Rest
        * weg, und weil es ein Stoff ohne Motiv ist, faellt kein Ausschnitt
        * auf. Genau dafuer ist sie brauchbar und ein gemaltes Bild nicht.
        */}
      <img className="mm-banner-tuch" src="/mememory/decke-rot.webp" alt="" draggable={false} />
      <span className="mm-banner-reihe">
        {karten.map((kennung, i) => (
          <img
            key={kennung}
            className="mm-banner-karte"
            src={motivBildPfad(kennung)}
            alt=""
            draggable={false}
            /*
             * Die Neigung kommt aus der Stelle in der Reihe und nicht aus
             * dem Zufall: Sie soll bei jedem Blick dieselbe sein, sonst
             * zappelt das Banner bei jedem Zeichnen. Aussen staerker als in
             * der Mitte — das ist der Faecher, den man auf dem Tisch auch
             * mit der Hand hinlegt.
             */
            style={
              {
                '--mm-dreh': `${(i - (karten.length - 1) / 2) * 5.5}deg`,
                '--mm-hoch': `${Math.abs(i - (karten.length - 1) / 2) * 3}%`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
    </span>
  );
}

/**
 * `anzahl` Stueck herausgreifen, ohne Wiederholung.
 *
 * Gewuerfelt und nicht die ersten: Wer die Spielauswahl aufmacht, soll
 * andere Bilder sehen als beim letzten Mal — das ist der halbe Reiz. Gezogen
 * wird einmal beim Laden und nicht beim Zeichnen, sonst sprangen die Karten
 * bei jedem Neuzeichnen des Hubs.
 */
function waehle(alle: readonly string[], anzahl: number): string[] {
  const topf = [...alle];
  const ausgewaehlt: string[] = [];
  while (ausgewaehlt.length < anzahl && topf.length > 0) {
    const [gezogen] = topf.splice(Math.floor(Math.random() * topf.length), 1);
    if (gezogen) ausgewaehlt.push(gezogen);
  }
  return ausgewaehlt;
}
