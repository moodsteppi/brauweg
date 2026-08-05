import { useEffect, useRef, useState } from 'react';

import { api } from '../api';
import { HUELLE, STIL, starteFeldherr } from '../minispiele/feldherr/kern.js';

/**
 * Feldherr — Minispiel.
 *
 * Anders als Doppelkopf und Zauberer laeuft dieses Spiel im Browser und nicht
 * im Server: Es ist ein Echtzeitspiel, und `GameModule` ist zugbasiert und
 * ausdruecklich uhrlos. Die Begruendung samt Wegen zu einem Netzspiel steht in
 * `docs/FELDHERR-PLAN.md`.
 *
 * Der Kern bringt seine eigene Huelle mit (Leisten, Overlays, Leinwand). Sie
 * wird hier einmal in den Baum gehaengt; anschliessend findet der Kern seine
 * Teile ueber getElementById, genau wie in der eigenstaendigen Datei.
 *
 * Das eingebaute Startmenue des Spiels bleibt aus — welchen Modus es wird,
 * entscheidet der Bildschirm hier, damit die Auswahl aussieht wie im Rest der
 * Anwendung.
 */

type Modus = 'ki' | 'zuZweit';
type Stufe = 'leicht' | 'normal' | 'schwer';
type Feld = 'klein' | 'mittel' | 'gross';

interface Ausgang {
  readonly sieger: number;
  readonly gewonnen: boolean | null;
  readonly gegenKI: boolean;
  readonly stufe: Stufe | null;
  readonly dauer: number;
  readonly feld: Feld;
}

export function FeldherrTisch({ onBack }: { onBack: () => void }): React.JSX.Element {
  const [modus, setModus] = useState<Modus | null>(null);
  const [stufe, setStufe] = useState<Stufe>('normal');
  const [feld, setFeld] = useState<Feld>('mittel');
  const [lohn, setLohn] = useState<{ muenzen: number; xp: number; gedeckelt: boolean } | null>(null);

  const buehne = useRef<HTMLDivElement | null>(null);

  /**
   * Der Effekt haengt bewusst nur an Modus, Stufe und Feld — nicht an einem
   * Objekt. Ein Effekt mit Objekt in der Abhaengigkeitsliste laeuft bei jedem
   * Neuzeichnen und wuerde die Partie mitten im Spiel neu starten.
   */
  useEffect(() => {
    if (!modus || !buehne.current) return;
    const wurzel = buehne.current;
    wurzel.innerHTML = HUELLE;

    const sitzung = starteFeldherr({
      modus,
      stufe,
      feld,
      // Saatkorn aus der Uhr. Im Netzspiel kommt es spaeter vom Server, damit
      // beide Geraete dieselbe Partie rechnen.
      saat: (Date.now() ^ 0x9e3779b9) >>> 0,
      aufEnde: (a: Ausgang) => {
        void melde(a).then(setLohn).catch(() => setLohn(null));
      },
    });
    return () => {
      sitzung.beenden();
      wurzel.innerHTML = '';
    };
  }, [modus, stufe, feld]);

  /** Der Stil des Spiels gilt nur, solange dieser Bildschirm offen ist. */
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = STIL;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  if (modus) {
    return (
      <main className="feldherr-buehne">
        <button className="feldherr-zurueck" onClick={() => setModus(null)}>
          ‹ Zurück
        </button>
        <div ref={buehne} />
        {lohn && (
          <div className="feldherr-lohn" role="status">
            {lohn.gedeckelt
              ? 'Heute schon genug verdient — gespielt wird trotzdem weiter.'
              : `+${lohn.muenzen} Münzen · +${lohn.xp} Erfahrung`}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="hub">
      <header className="hub-kopf">
        <button className="hub-zurueck" onClick={onBack}>
          ‹ Zurück
        </button>
        <h1>Feldherr</h1>
      </header>

      <p className="hub-text">
        Zwei Feldherren, ein Brett, eine Mittellinie. Wer das gegnerische
        Haupthaus einreißt, gewinnt.
      </p>

      <section className="feldherr-wahl">
        <label className="feldherr-zeile">
          <span>Stärke der KI</span>
          <select value={stufe} onChange={(e) => setStufe(e.target.value as Stufe)}>
            <option value="leicht">Leicht</option>
            <option value="normal">Normal</option>
            <option value="schwer">Schwer</option>
          </select>
        </label>
        <label className="feldherr-zeile">
          <span>Feldgröße</span>
          <select value={feld} onChange={(e) => setFeld(e.target.value as Feld)}>
            <option value="klein">Klein</option>
            <option value="mittel">Mittel</option>
            <option value="gross">Groß</option>
          </select>
        </label>
      </section>

      <button className="btn pri" onClick={() => setModus('ki')}>
        Gegen die KI
      </button>
      <button className="btn" onClick={() => setModus('zuZweit')}>
        Zu zweit an einem Gerät
      </button>
      {/*
        Online steht bewusst als gesperrte Schaltflaeche da und nicht als
        stiller Platzhalter: Wer den Knopf sucht, soll sehen, dass er kommt.
        Was dahinter noch fehlt, steht in docs/FELDHERR-PLAN.md, Weg B.
      */}
      <button className="btn gho" disabled title="In Vorbereitung">
        Online spielen
      </button>
    </main>
  );
}

/**
 * Meldet den Ausgang und holt die Belohnung.
 *
 * Der Server rechnet nach seinen eigenen Regeln und deckelt je Tag — was der
 * Client meldet, ist eine Behauptung. Ohne Deckel waere jede geschlossene
 * Runde eine Muenzquelle.
 */
async function melde(a: Ausgang): Promise<{ muenzen: number; xp: number; gedeckelt: boolean }> {
  return api.feldherrEnde({
    gewonnen: a.gewonnen === true,
    gegenKI: a.gegenKI,
    stufe: a.stufe,
    dauer: a.dauer,
  });
}
