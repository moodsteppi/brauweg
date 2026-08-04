import { useEffect, useState, useSyncExternalStore } from 'react';

import { api, type RegalWare } from '../api';
import {
  PAKET_NAMEN,
  abonniere,
  holeEinstellungen,
  kannVibrieren,
  setzeEinstellungen,
  spiele,
  vibriere,
  type Einstellungen,
} from '../klang';

/**
 * Einstellungen — bisher genau das, was klingt und spürbar ist.
 *
 * Ein eigenes Blatt statt eines weiteren Abschnitts im Profil: Der Profil-Tab
 * ist schon lang (Pinguin, Geburtstag, Statistik, Freunde), und Einstellungen
 * wären dort ganz unten gelandet — also da, wo niemand sie sucht. Als Blatt
 * hat es außerdem Platz für das, was später dazukommt: Sprache,
 * Benachrichtigungen, Kartensortierung.
 */
export function EinstellungenBlatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  const werte = useKlang();
  const vibrationMoeglich = kannVibrieren();
  const meins = useMeineKlangware();

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

        {/* Nur wenn es überhaupt etwas zu wählen gibt: Wer ein einziges Paket
            hat, braucht keine Liste mit einem Eintrag. */}
        {meins.pakete.length > 1 && (
          <Auswahl
            name="Klangpaket"
            hinweis="Weitere gibt es im Shop"
            wert={werte.paket ?? 'grund'}
            stuecke={meins.pakete.map((w) => ({
              wert: w.wert,
              name: PAKET_NAMEN[w.wert] ?? w.wert,
            }))}
            onWahl={(wahl) => {
              setzeEinstellungen({ paket: wahl === 'grund' ? null : wahl });
              // Sofort hörbar machen, worauf man gerade umgestellt hat.
              spiele('karte-legen');
            }}
          />
        )}

        <Regler
          name="Musik"
          hinweis="Im Menü und am Spieltisch"
          wert={werte.musik}
          onChange={(musik) => setzeEinstellungen({ musik })}
        />

        {meins.stuecke.length > 0 && (
          <Auswahl
            name="Musikstück"
            hinweis="Was im Hintergrund läuft"
            wert={werte.stueck ?? ''}
            stuecke={[
              { wert: '', name: 'Keins' },
              ...meins.stuecke.map((w) => ({ wert: w.wert, name: w.wert })),
            ]}
            onWahl={(wahl) => setzeEinstellungen({ stueck: wahl === '' ? null : wahl })}
          />
        )}

        <div className={`einstellungen-zeile${vibrationMoeglich ? '' : ' is-aus'}`}>
          <div className="einstellungen-text">
            <strong>Vibration</strong>
            <span className="muted">
              {vibrationMoeglich
                ? 'Kurzer Stups beim Legen und bei Fehlern'
                : 'Dieser Browser kann nicht vibrieren — am iPhone gibt es dafür keinen Weg'}
            </span>
          </div>
          <button
            className={`lobby-chip${werte.vibration && vibrationMoeglich ? ' is-an' : ''}`}
            disabled={!vibrationMoeglich}
            aria-pressed={werte.vibration && vibrationMoeglich}
            onClick={() => {
              const an = !werte.vibration;
              setzeEinstellungen({ vibration: an });
              spiele('schalter');
              // Beim Einschalten einmal spüren lassen, worum es geht.
              if (an) vibriere(20);
            }}
          >
            {werte.vibration && vibrationMoeglich ? 'An' : 'Aus'}
          </button>
        </div>

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

/** Eine Liste zum Durchtippen — für zwei bis fünf Stücke besser als ein Menü. */
function Auswahl({
  name,
  hinweis,
  wert,
  stuecke,
  onWahl,
}: {
  name: string;
  hinweis: string;
  wert: string;
  stuecke: { wert: string; name: string }[];
  onWahl: (wert: string) => void;
}): React.JSX.Element {
  return (
    <div className="einstellungen-zeile einstellungen-zeile--auswahl">
      <div className="einstellungen-text">
        <strong>{name}</strong>
        <span className="muted">{hinweis}</span>
      </div>
      <div className="lobby-chips einstellungen-chips">
        {stuecke.map((s) => (
          <button
            key={s.wert}
            className={`lobby-chip${s.wert === wert ? ' is-an' : ''}`}
            aria-pressed={s.wert === wert}
            onClick={() => onWahl(s.wert)}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Was mir an Klangware gehört.
 *
 * Der Shop entscheidet über Besitz, nicht dieses Blatt: Gefragt wird der
 * Server, und was nicht zurückkommt, steht auch nicht zur Wahl. Schlägt der
 * Aufruf fehl, bleibt die Liste leer und die Auswahl verschwindet — das ist
 * richtig so, denn ohne Auskunft über den Besitz wäre jede angebotene Wahl
 * geraten.
 */
function useMeineKlangware(): { pakete: RegalWare[]; stuecke: RegalWare[] } {
  const [ware, setWare] = useState<RegalWare[]>([]);
  useEffect(() => {
    void api
      .shop()
      .then((s) => setWare(s.tischware.filter((w) => w.besessen)))
      .catch(() => undefined);
  }, []);
  return {
    pakete: ware.filter((w) => w.art === 'klang'),
    stuecke: ware.filter((w) => w.art === 'musik'),
  };
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
