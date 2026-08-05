import { useSyncExternalStore } from 'react';

import {
  abonniere,
  holeEinstellungen,
  setzeEinstellungen,
  spiele,
  type Einstellungen,
} from '../klang';

/**
 * Einstellungen — wie laut, und sonst nichts.
 *
 * Ein eigenes Blatt statt eines weiteren Abschnitts im Profil: Der Profil-Tab
 * ist schon lang (Pinguin, Geburtstag, Statistik, Freunde), und Einstellungen
 * wären dort ganz unten gelandet — also da, wo niemand sie sucht. Als Blatt
 * hat es außerdem Platz für das, was später dazukommt: Sprache,
 * Benachrichtigungen, Kartensortierung.
 *
 * **Was man hört, steht hier nicht — das ist die Klanghalle.** Zwei Regler
 * sind eine Einstellung, die Auswahl unter gekaufter Musik ist Besitz. Beides
 * in dasselbe Blatt zu legen hieße, dass eine wachsende Sammlung eine
 * Lautstärkeeinstellung immer weiter nach unten schiebt.
 */
export function EinstellungenBlatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  const werte = useKlang();

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div
        className="doko-sheet-card einstellungen"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Einstellungen</h2>

        <Regler
          name="Sounds"
          hinweis="Karten, Knöpfe, Abrechnung"
          wert={werte.sounds}
          onChange={(sounds) => setzeEinstellungen({ sounds })}
          // Erst beim Loslassen ein Beispiel: Beim Ziehen feuert `change`
          // dutzendfach, und dann klickt es wie eine Nähmaschine.
          onFertig={() => spiele('karte-legen')}
        />

        <Regler
          name="Musik"
          hinweis="Im Menü und am Spieltisch"
          wert={werte.musik}
          onChange={(musik) => setzeEinstellungen({ musik })}
        />

        <p className="einstellungen-fussnote muted">
          Welches Stück läuft und welches Klangpaket gilt, steht in der
          Klanghalle in deinem Profil.
        </p>

        {/*
          Der Satz zum Klingelschalter steht hier, weil sonst genau eine
          Fehlermeldung entsteht: "Ich habe alles aufgedreht und höre nichts."
          Wir melden den Ton bewusst als "ambient" an, damit Musik aus anderen
          Apps weiterläuft — der Preis ist, dass der stumme Klingelschalter
          uns mit stummschaltet.
        */}
        <p className="einstellungen-fussnote muted">
          Läuft bei dir Musik in einer anderen App, spielt sie weiter — wir
          drängeln uns nicht davor. Dafür schaltet am iPhone der
          Klingelschalter auch uns stumm.
        </p>

        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button className="hub-knopf hub-knopf--a" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Ein Regler von 0 bis 100.
 *
 * Die Zahl steht daneben, nicht nur der Balken: "ungefähr in der Mitte" ist
 * keine Einstellung, die man am nächsten Tag wiederfindet.
 */
function Regler({
  name,
  hinweis,
  wert,
  onChange,
  onFertig,
}: {
  name: string;
  hinweis: string;
  wert: number;
  onChange: (wert: number) => void;
  onFertig?: () => void;
}): React.JSX.Element {
  return (
    <div className="einstellungen-zeile">
      <div className="einstellungen-text">
        <strong>{name}</strong>
        <span className="muted">{hinweis}</span>
      </div>
      <div className="einstellungen-regler">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={wert}
          aria-label={name}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={onFertig}
          onKeyUp={onFertig}
        />
        <span className="einstellungen-wert">{wert}</span>
      </div>
    </div>
  );
}

/**
 * Die Klangeinstellungen als React-Zustand.
 *
 * `useSyncExternalStore` statt eines Effekts mit `useState`: Die Werte leben
 * außerhalb von React — der Spieltisch ändert sie nicht, aber er liest sie
 * bei jedem Klang. Ein zweiter Ort für dieselbe Wahrheit wäre genau die Art
 * Doppelung, die irgendwann auseinanderläuft.
 */
export function useKlang(): Einstellungen {
  return useSyncExternalStore(abonniere, holeEinstellungen, holeEinstellungen);
}
