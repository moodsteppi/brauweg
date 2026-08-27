/**
 * "KI-Match erstellen" — wie viele Gegner, und wie stark ist jeder.
 *
 * Ein eigener Bildschirm und kein Auswahlfeld im Menue: Die vier Stufen
 * spielen sich spuerbar verschieden, und wer sie zum ersten Mal sieht, will
 * wissen, was ihn erwartet. Dafuer braucht jede einen Satz — und vier Saetze
 * passen nicht neben einen Knopf.
 *
 * **Seit dem 27. August bis zu drei Gegner, jeder mit eigener Stufe.** Der
 * Zustand war von Anfang an eine LISTE, auch als genau eine Stufe darin
 * stand; hier kommt jetzt nur eine Zeile je Gegner dazu. Die Liste geht als
 * `botStufen` sitzweise an den Tisch: Der Ersteller sitzt auf 0, die Bots ab
 * 1, also bekommt der erste Eintrag Sitz 1, der zweite Sitz 2.
 */

import { useState } from 'react';

import { Kreuz } from '../../zeichen';
import { STUFEN, Stufenregler, type Stufe } from './Stufenregler';

/**
 * So viele Bots passen an einen Tisch. Vier Sitze, einer ist der Mensch.
 *
 * Die vier Stufen samt ihren Saetzen stehen im Regler (Stufenregler.tsx) —
 * sie werden dort UND im Wartebereich gebraucht, und zwei Abschriften
 * derselben Liste laufen auseinander.
 */
const GEGNER_MAX = 3;

export function KiMatch({
  laeuft,
  fehler,
  onStart,
  onBack,
}: {
  /** Der Tisch wird gerade aufgemacht — der Knopf darf nicht zweimal gehen. */
  laeuft: boolean;
  fehler: string | null;
  onStart: (stufen: Stufe[]) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [gegner, setGegner] = useState<Stufe[]>(['mittel']);

  const setze = (index: number, stufe: Stufe): void => {
    setGegner((alt) => alt.map((wert, i) => (i === index ? stufe : wert)));
  };

  return (
    <main className="mm-menue">
      <button className="mm-zurueck" type="button" onClick={onBack} disabled={laeuft}>
        ← Zurück
      </button>

      <div className="mm-menue-mitte">
        <h1 className="mm-titel mm-titel-klein">KI-Match erstellen</h1>
        <p className="mm-untertitel">
          {gegner.length === 1
            ? 'Wie gut soll dein Gegner sich erinnern?'
            : `${gegner.length} Gegner — jeder mit eigenem Gedächtnis.`}
        </p>

        {gegner.map((gewaehlt, index) => (
          <div className="mm-gegner" key={index}>
            {/* Die Kopfzeile erscheint erst ab dem zweiten Gegner: Bei genau
                einem waere "Gegner 1" eine Beschriftung ohne Aussage. */}
            {gegner.length > 1 && (
              <div className="mm-gegner-kopf">
                <span>Gegner {index + 1}</span>
                <button
                  type="button"
                  className="mm-gegner-weg"
                  onClick={() => setGegner((alt) => alt.filter((_, i) => i !== index))}
                  disabled={laeuft}
                  aria-label={`Gegner ${index + 1} entfernen`}
                >
                  <Kreuz />
                </button>
              </div>
            )}
            <Stufenregler
              wert={gewaehlt}
              onWert={(stufe) => setze(index, stufe)}
              gesperrt={laeuft}
              beschriftung={`Spielstärke von Gegner ${index + 1}`}
            />
            <p className="mm-stufensatz">
              {STUFEN.find((eintrag) => eintrag.stufe === gewaehlt)?.satz}
            </p>
          </div>
        ))}

        {/*
          * Der Knopf verschwindet beim dritten Gegner, statt nur grau zu
          * werden: Ein Knopf, der nichts mehr tut, ist eine Einladung zum
          * Danebentippen. Wie viele es hoechstens sind, sagt der Satz
          * darunter ohnehin.
          */}
        {gegner.length < GEGNER_MAX && (
          <button
            className="mm-gegner-mehr"
            type="button"
            onClick={() => setGegner((alt) => [...alt, 'mittel'])}
            disabled={laeuft}
          >
            <span>+ Gegner hinzufügen</span>
            <em>bis zu {GEGNER_MAX}</em>
          </button>
        )}

        <button
          className="mm-suchen"
          type="button"
          onClick={() => onStart(gegner)}
          disabled={laeuft}
        >
          <span>{laeuft ? 'Tisch wird aufgemacht…' : 'Match starten'}</span>
        </button>

        {fehler && <p className="mm-fehler">{fehler}</p>}
      </div>
    </main>
  );
}
