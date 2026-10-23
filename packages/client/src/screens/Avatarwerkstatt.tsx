import { Suspense, lazy, useEffect, useRef, useState } from 'react';

import { api, type Getragen } from '../api';
import { spiele } from '../klang';
import {
  BREITEN,
  FARBEN,
  LEERE_BEMALUNG,
  mitStrich,
  ohneLetzten,
  type Bemalung,
  type Strich,
} from '../bemalung';
import { Schliessen } from './HbBlatt';
import './werkstatt.css';

/**
 * Avatar-Werkstatt — die Figur drehen, anziehen und anmalen.
 *
 * **Warum ein eigenes Blatt und nicht der Kleiderschrank.** Der Kleiderschrank
 * zieht den gemalten 2D-Pinguin an und kann dreiunddreißig Stücke auf sechs
 * Plätzen. In 3D gibt es bisher eines. Beides zusammenzulegen hieße,
 * zweiunddreißig Stücke aus der Oberfläche zu nehmen, damit eines neu ist. Der
 * Weg dorthin steht in `docs/UEBERGABE-ANNI.md`: dieselben Plätze, dieselben
 * Kennungen, dann tauscht man die Darstellung und sonst nichts.
 *
 * **Das Ganze wird nachgeladen.** `three` und `drei` wiegen rund 900 kB — mehr
 * als das übrige Bündel zusammen.
 */

const Avatar3D = lazy(() => import('../Avatar3D'));

export function Avatarwerkstatt({
  bemalung: gespeichert,
  getragen = {},
  onClose,
  onGespeichert,
  neu = false,
}: {
  /** Neues Hub: Vollbild in Nachtblau & Gold statt des alten Holzblatts. */
  neu?: boolean;
  /** Was am Konto steht. `null` heißt: nie bemalt. */
  bemalung?: Bemalung | null;
  /**
   * Was angezogen ist. Voreinstellung leer, damit die Entwicklerstrecke
   * `?dev=werkstatt` ohne Anmeldung weiter aufgeht.
   */
  getragen?: Getragen;
  onClose: () => void;
  /** Nach dem Speichern, damit das Profil die neue Figur zeigt. */
  onGespeichert?: (bemalung: Bemalung) => void;
}): React.JSX.Element {
  /** Zubehör anzeigen. An, weil die Figur so aussieht wie überall sonst. */
  const [zubehoer, setZubehoer] = useState(true);
  const [bemalung, setBemalung] = useState<Bemalung>(gespeichert ?? LEERE_BEMALUNG);
  const [malen, setMalen] = useState(false);
  const [farbe, setFarbe] = useState(FARBEN[0].wert);
  const [breite, setBreite] = useState(BREITEN[1].wert);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  /**
   * Die Leinwand entsteht erst, wenn die Bühne einmal vermessen ist.
   * Verhindert eine Leinwand der Größe null, wenn das Blatt noch einfährt.
   */
  const buehne = useRef<HTMLDivElement>(null);
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

  /**
   * Der Anstoß — ein Notnagel, und als solcher benannt.
   *
   * Nachweislich hilft nur eines: dass die Seite ein Größenereignis sieht.
   * Dann zeichnet R3F die Figur, und danach läuft alles. Ein echtes `resize`
   * am `window` und nicht das Verstellen der eigenen Höhe: R3F vermisst über
   * `react-use-measure`, und das horcht an **beidem** — am Element über einen
   * `ResizeObserver` und am Fenster. Nur der zweite Weg wirkt.
   *
   * **Wer die Ursache findet, wirft das hier raus.**
   */
  const anstossen = (): void => {
    window.dispatchEvent(new Event('resize'));
  };

  const schliessen = (): void => {
    spiele('blatt-zu');
    onClose();
  };

  /**
   * Speichern ist ausdrücklich und nicht nebenbei.
   *
   * Jeden Strich sofort zu schicken wäre ein Aufruf je Fingerzug — beim Malen
   * also dutzende in der Minute. Und wer sich vermalt hat, will das Blatt
   * verlassen können, ohne dass es schon am Konto klebt.
   */
  const speichern = (): void => {
    if (speichert) return;
    setSpeichert(true);
    setFehler(null);
    void api
      .setFigur(bemalung)
      .then(() => {
        spiele('kauf');
        onGespeichert?.(bemalung);
        onClose();
      })
      .catch(() => setFehler('Konnte nicht gespeichert werden.'))
      .finally(() => setSpeichert(false));
  };

  const neuerStrich = (strich: Strich): void => {
    setBemalung((b) => mitStrich(b, strich));
  };

  const bemalbar = bemalung.design === 'bemalt';

  const figur = (
    <Suspense fallback={<p className="muted werkstatt-laedt">Figur wird geladen…</p>}>
      {vermessen && (
        <Avatar3D
          getragen={zubehoer ? getragen : {}}
          bemalung={bemalung}
          malen={malen}
          farbe={farbe}
          breite={breite}
          onStrich={neuerStrich}
          onBereit={anstossen}
        />
      )}
    </Suspense>
  );

  if (neu) {
    return (
      <div className="hb-voll ws" role="dialog" aria-modal="true" aria-label="Deine Figur">
        <header className="hb-voll-kopf">
          <Schliessen onClick={schliessen} />
          <div className="hb-voll-titel">
            <h1>Deine Figur</h1>
            <span>Drehen, anmalen, Zubehör</span>
          </div>
        </header>

        <div className="hb-voll-rolle ws-rolle">
          <div className={`ws-buehne${malen ? ' is-malen' : ''}${bemalbar ? ' is-klein' : ''}`} ref={buehne}>
            {figur}
            <span className="ws-hinweis" aria-live="polite">
              {malen ? 'Mit dem Finger malen' : 'Zum Drehen wischen'}
            </span>
          </div>

          {/* „Original" ist der Pinguin, wie er gemalt wurde; „Anmalen" gibt
              ihm einen hellen Grundton, auf dem man arbeitet. */}
          <Umschalter
            name="Aussehen"
            wahl={bemalbar ? 'bemalt' : 'standard'}
            werte={[
              { wert: 'standard', text: 'Original' },
              { wert: 'bemalt', text: 'Anmalen' },
            ]}
            onWahl={(wert) => {
              if (wert === 'standard') {
                spiele('tipp');
                setMalen(false);
              } else {
                spiele('schalter');
              }
              setBemalung((b) => ({ ...b, design: wert as Bemalung['design'] }));
            }}
          />

          {bemalbar && (
            <section className="ws-pinsel" aria-label="Pinsel">
              <Umschalter
                name="Werkzeug"
                wahl={malen ? 'pinsel' : 'drehen'}
                werte={[
                  { wert: 'drehen', text: 'Drehen' },
                  { wert: 'pinsel', text: 'Pinsel' },
                ]}
                onWahl={(wert) => {
                  spiele('tipp');
                  setMalen(wert === 'pinsel');
                }}
              />
              <div className="ws-farben" role="group" aria-label="Farbe">
                {FARBEN.map((f) => (
                  <button
                    type="button"
                    key={f.wert}
                    className={`ws-farbe${f.wert === farbe ? ' is-an' : ''}`}
                    style={{ background: f.wert }}
                    aria-label={f.name}
                    aria-pressed={f.wert === farbe}
                    onClick={() => {
                      setFarbe(f.wert);
                      setMalen(true);
                    }}
                  />
                ))}
              </div>
              <div className="ws-zeile">
                <div className="hb-chips ws-breiten" role="group" aria-label="Pinselgröße">
                  {BREITEN.map((b) => (
                    <button
                      type="button"
                      key={b.wert}
                      className={`hb-chip${b.wert === breite ? ' is-an' : ''}`}
                      aria-pressed={b.wert === breite}
                      onClick={() => setBreite(b.wert)}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="ws-rund"
                  aria-label="Letzten Strich zurücknehmen"
                  disabled={bemalung.striche.length === 0}
                  onClick={() => {
                    spiele('blatt-zu');
                    setBemalung(ohneLetzten);
                  }}
                >
                  <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 14L4 9l5-5" />
                    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ws-rund is-rot"
                  aria-label="Alles wegwischen"
                  disabled={bemalung.striche.length === 0}
                  onClick={() => {
                    spiele('fehler');
                    setBemalung((b) => ({ ...b, striche: [] }));
                  }}
                >
                  <svg viewBox="0 0 24 24" className="hb-ic" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </div>
            </section>
          )}

          {/* Zubehör nur ausblenden, nicht ausziehen — damit man den Kopf
              bemalen kann (Begründung in der alten Fassung unten). */}
          <label className="ws-schalter">
            <span>
              <strong>Zubehör zeigen</strong>
              <small>Zum Bemalen des Kopfes kurz ausblenden — angezogen bleibt es.</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={zubehoer}
              onChange={(e) => {
                spiele(e.target.checked ? 'schalter' : 'tipp');
                setZubehoer(e.target.checked);
              }}
            />
            <i aria-hidden="true" />
          </label>

          {fehler && <p className="hb-fehler">{fehler}</p>}
        </div>

        <footer className="ws-fuss">
          <button type="button" className="hb-kn is-gold is-haupt is-breit" disabled={speichert} onClick={speichern}>
            {speichert ? 'Wird gespeichert…' : 'Speichern'}
          </button>
          <button type="button" className="hb-leise-knopf" onClick={schliessen}>
            Abbrechen
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="doko-sheet doko-sheet--mitte" onClick={schliessen}>
      <div
        className="doko-sheet-card werkstatt"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Deine Figur</h2>

        <div className="werkstatt-buehne" ref={buehne}>
          {figur}
        </div>

        <p className="muted werkstatt-hinweis">
          {malen ? 'Mit dem Finger malen' : 'Zum Drehen wischen'}
        </p>

        {/* Design. „Original" ist der Pinguin, wie er gemalt wurde; „Anmalen"
            gibt ihm einen hellen Grundton, auf dem man arbeitet. Zubehör wie
            die Mütze behält in beiden Fällen seine Farben. */}
        <div className="werkstatt-wahl">
          <button
            className={`hub-knopf hub-knopf--a werkstatt-knopf${!bemalbar ? ' is-gewaehlt' : ''}`}
            aria-pressed={!bemalbar}
            onClick={() => {
              spiele('tipp');
              setMalen(false);
              setBemalung((b) => ({ ...b, design: 'standard' }));
            }}
          >
            Original
          </button>
          <button
            className={`hub-knopf hub-knopf--a werkstatt-knopf${bemalbar ? ' is-gewaehlt' : ''}`}
            aria-pressed={bemalbar}
            onClick={() => {
              spiele('schalter');
              setBemalung((b) => ({ ...b, design: 'bemalt' }));
            }}
          >
            Anmalen
          </button>
        </div>

        {/* Der Pinselkasten erscheint nur beim bemalbaren Design — im Original
            gäbe es nichts zu bemalen, und ein abgeblendeter Kasten wäre nur
            Platz für eine Auskunft, die der Umschalter schon gibt. */}
        {bemalbar && (
          <div className="werkstatt-pinsel">
            <div className="werkstatt-wahl">
              <button
                className={`hub-knopf hub-knopf--a werkstatt-knopf${!malen ? ' is-gewaehlt' : ''}`}
                aria-pressed={!malen}
                onClick={() => {
                  spiele('tipp');
                  setMalen(false);
                }}
              >
                Drehen
              </button>
              <button
                className={`hub-knopf hub-knopf--a werkstatt-knopf${malen ? ' is-gewaehlt' : ''}`}
                aria-pressed={malen}
                onClick={() => {
                  spiele('tipp');
                  setMalen(true);
                }}
              >
                Pinsel
              </button>
            </div>

            <div className="werkstatt-farben">
              {FARBEN.map((f) => (
                <button
                  key={f.wert}
                  className={`werkstatt-farbe${f.wert === farbe ? ' is-gewaehlt' : ''}`}
                  style={{ background: f.wert }}
                  aria-label={f.name}
                  aria-pressed={f.wert === farbe}
                  onClick={() => {
                    setFarbe(f.wert);
                    // Eine Farbe zu wählen heißt, malen zu wollen — den
                    // Umschalter gleich mit umzulegen spart einen Tipp.
                    setMalen(true);
                  }}
                />
              ))}
            </div>

            <div className="werkstatt-breiten">
              {BREITEN.map((b) => (
                <button
                  key={b.wert}
                  className={`lobby-chip${b.wert === breite ? ' is-an' : ''}`}
                  aria-pressed={b.wert === breite}
                  onClick={() => setBreite(b.wert)}
                >
                  {b.name}
                </button>
              ))}
            </div>

            <div className="hub-knopfreihe hub-knopfreihe--a">
              <button
                className="hub-knopf hub-knopf--a"
                disabled={bemalung.striche.length === 0}
                onClick={() => {
                  spiele('blatt-zu');
                  setBemalung(ohneLetzten);
                }}
              >
                Zurück
              </button>
              <button
                className="hub-knopf hub-knopf--a-raus"
                disabled={bemalung.striche.length === 0}
                onClick={() => {
                  spiele('fehler');
                  setBemalung((b) => ({ ...b, striche: [] }));
                }}
              >
                Alles weg
              </button>
            </div>
          </div>
        )}

        {/*
          Zubehör aus- und wieder anblenden.

          Vorher war das ein Mützenschalter, der bei „Ohne" anfing — und weil
          die Figur im Spiel ohnehin nie etwas trug, war er der einzige Ort,
          an dem man die Mütze überhaupt zu sehen bekam. Jetzt trägt die Figur
          überall, was angezogen ist, und dieser Schalter tut das, wofür man
          ihn hier wirklich braucht: Er nimmt das Zubehör kurz weg, damit man
          den Kopf bemalen kann. Angezogen bleibt es trotzdem — hier wird
          nichts ausgezogen, nur nicht angezeigt.
        */}
        <div className="werkstatt-wahl werkstatt-muetze">
          <button
            className={`hub-knopf hub-knopf--a werkstatt-knopf${zubehoer ? ' is-gewaehlt' : ''}`}
            aria-pressed={zubehoer}
            onClick={() => {
              spiele('schalter');
              setZubehoer(true);
            }}
          >
            Mit Zubehör
          </button>
          <button
            className={`hub-knopf hub-knopf--a werkstatt-knopf${!zubehoer ? ' is-gewaehlt' : ''}`}
            aria-pressed={!zubehoer}
            onClick={() => {
              spiele('tipp');
              setZubehoer(false);
            }}
          >
            Ohne
          </button>
        </div>

        {fehler && <p className="error">{fehler}</p>}

        <div className="hub-knopfreihe hub-knopfreihe--a">
          <button className="hub-knopf hub-knopf--a" onClick={schliessen}>
            Abbrechen
          </button>
          <button
            className="hub-knopf hub-knopf--a-gold"
            disabled={speichert}
            onClick={speichern}
          >
            {speichert ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Zwei bis drei Möglichkeiten nebeneinander, eine gewählt — im Hub-Stil. */
function Umschalter({
  name,
  wahl,
  werte,
  onWahl,
}: {
  name: string;
  wahl: string;
  werte: readonly { wert: string; text: string }[];
  onWahl: (wert: string) => void;
}): React.JSX.Element {
  return (
    <div className="ws-umschalter" role="radiogroup" aria-label={name}>
      {werte.map((w) => (
        <button
          type="button"
          role="radio"
          key={w.wert}
          aria-checked={w.wert === wahl}
          className={w.wert === wahl ? 'is-an' : undefined}
          onClick={() => w.wert !== wahl && onWahl(w.wert)}
        >
          {w.text}
        </button>
      ))}
    </div>
  );
}
