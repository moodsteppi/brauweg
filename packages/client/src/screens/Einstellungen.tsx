import { Suspense, lazy, useSyncExternalStore } from 'react';

import {
  abonniere,
  holeEinstellungen,
  setzeEinstellungen,
  spiele,
  type Einstellungen,
} from '../klang';
import { inApp } from '../laufzeit';
import { HbBlatt } from './HbBlatt';

/**
 * Anmeldearten (Apple, Google) — nachgeladen: Dieses Blatt haengt am
 * Startbildschirm und damit im Sofort-Paket, der Abschnitt nicht.
 */
const Anmeldearten = lazy(() =>
  import('../anmeldung/Anmeldearten').then((m) => ({ default: m.Anmeldearten })),
);

/**
 * Mitteilungen (Push) — nur in der App und nachgeladen. Auf der Webseite gibt
 * es keine Mitteilungen, also auch den Abschnitt nicht (docs/PUSH.md).
 */
const Mitteilungen = lazy(() =>
  import('../push/Mitteilungen').then((m) => ({ default: m.Mitteilungen })),
);

/**
 * Einstellungen — wie laut, und womit man sich anmeldet.
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
/**
 * Nur die Mitteilungen, als eigenes Blatt — für „Benachrichtigungen" im
 * Profil (bis zum 13.10.2026 dort eine „Bald"-Zeile). Dieselbe Komponente wie
 * unten in den Einstellungen, nur ohne Ton und Anmeldearten drumherum.
 */
export function MitteilungenBlatt({
  onClose,
  neu = false,
}: {
  onClose: () => void;
  /** Neues Hub: Blatt in Nachtblau & Gold (bis zum 22.10.2026 Holzkarte mit fremden Schaltern). */
  neu?: boolean;
}): React.JSX.Element {
  if (neu) {
    return (
      <HbBlatt titel="Benachrichtigungen" onClose={onClose}>
        <Suspense fallback={<p className="hb-klein">Einen Moment…</p>}>
          <Mitteilungen neu />
        </Suspense>
      </HbBlatt>
    );
  }
  return (
    <div className="doko-sheet" onClick={onClose}>
      <div className="doko-sheet-card einstellungen" onClick={(event) => event.stopPropagation()}>
        <h2>Benachrichtigungen</h2>
        <Suspense fallback={null}>
          <Mitteilungen />
        </Suspense>
        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button className="hub-knopf hub-knopf--a" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}

export function EinstellungenBlatt({
  onClose,
  neu = false,
}: {
  onClose: () => void;
  /** Neues Hub: dieselben Regler und Abschnitte als Hub-Blatt. */
  neu?: boolean;
}): React.JSX.Element {
  const werte = useKlang();

  if (neu) {
    return (
      <HbBlatt titel="Einstellungen" onClose={onClose}>
        <div className="hb-einst">
          <section className="hb-blk">
            <h2 className="hb-ab">Ton</h2>
            <div className="hb-karte hb-einst-karte">
              <ReglerNeu
                symbol="/hub/icon-einstellung-sounds.webp"
                name="Sounds"
                hinweis="Karten, Knöpfe, Abrechnung"
                wert={werte.sounds}
                onChange={(sounds) => setzeEinstellungen({ sounds })}
                onFertig={() => spiele('karte-legen')}
              />
              <ReglerNeu
                symbol="/hub/icon-einstellung-musik.webp"
                name="Musik"
                hinweis="Im Menü und am Spieltisch"
                wert={werte.musik}
                onChange={(musik) => setzeEinstellungen({ musik })}
              />
            </div>
            {/* Beide Sätze wortgleich mit der alten Fassung, Begründung dort. */}
            <p className="hb-klein hb-ohne-rand">
              Welches Stück läuft und welches Klangpaket gilt, steht in der Klanghalle in deinem Profil.
            </p>
            <p className="hb-klein hb-ohne-rand">
              Läuft bei dir Musik in einer anderen App, spielt sie weiter - wir drängeln uns nicht davor.
              Dafür schaltet am iPhone der Klingelschalter auch uns stumm.
            </p>
          </section>

          {inApp && (
            <Suspense fallback={null}>
              <Mitteilungen neu />
            </Suspense>
          )}

          {/* In der App gibt es den Abschnitt nicht (Anmeldearten.tsx). */}
          {!inApp && (
            <Suspense fallback={null}>
              <Anmeldearten />
            </Suspense>
          )}
        </div>
      </HbBlatt>
    );
  }

  return (
    <div className="doko-sheet" onClick={onClose}>
      <div
        className="doko-sheet-card einstellungen"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Einstellungen</h2>

        <Regler
          symbol="/hub/icon-einstellung-sounds.webp"
          name="Sounds"
          hinweis="Karten, Knöpfe, Abrechnung"
          wert={werte.sounds}
          onChange={(sounds) => setzeEinstellungen({ sounds })}
          // Erst beim Loslassen ein Beispiel: Beim Ziehen feuert `change`
          // dutzendfach, und dann klickt es wie eine Nähmaschine.
          onFertig={() => spiele('karte-legen')}
        />

        <Regler
          symbol="/hub/icon-einstellung-musik.webp"
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
          Läuft bei dir Musik in einer anderen App, spielt sie weiter - wir
          drängeln uns nicht davor. Dafür schaltet am iPhone der
          Klingelschalter auch uns stumm.
        </p>

        {inApp && (
          <Suspense fallback={null}>
            <Mitteilungen />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <Anmeldearten />
        </Suspense>

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
  symbol,
  name,
  hinweis,
  wert,
  onChange,
  onFertig,
}: {
  /** Gemaltes Symbol vor dem Namen — Lautsprecher bzw. Note. */
  symbol?: string;
  name: string;
  hinweis: string;
  wert: number;
  onChange: (wert: number) => void;
  onFertig?: () => void;
}): React.JSX.Element {
  return (
    <div className="einstellungen-zeile">
      {symbol && (
        <img className="einstellungen-symbol" src={symbol} alt="" aria-hidden="true" />
      )}
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

/** Neues Hub: derselbe Regler, Schiene in Gold, Zahl rechts. */
function ReglerNeu({
  symbol,
  name,
  hinweis,
  wert,
  onChange,
  onFertig,
}: {
  symbol?: string;
  name: string;
  hinweis: string;
  wert: number;
  onChange: (wert: number) => void;
  onFertig?: () => void;
}): React.JSX.Element {
  return (
    <div className="hb-regler">
      <div className="hb-regler-kopf">
        {symbol && <img src={symbol} alt="" aria-hidden="true" />}
        <span className="hb-regler-text">
          <strong>{name}</strong>
          <small>{hinweis}</small>
        </span>
        <span className="hb-regler-wert">{wert}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={wert}
        aria-label={name}
        style={{ '--hb-regler-anteil': `${wert}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onFertig}
        onKeyUp={onFertig}
      />
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
