/**
 * Probe A: die aufgezeichnete Arena-Szene in 2D, mit animierten Sprites.
 *
 * Erreichbar unter `/probe/arena-2d` und sonst nirgends — die Seite ist im
 * Spiel nicht verlinkt und haengt nicht an der Anmeldung. Sie dient genau einem
 * Zweck: neben Probe B (3D) dieselbe Szene zu zeigen, damit die Entscheidung
 * zwischen den beiden am Bildschirm faellt und nicht auf dem Papier.
 *
 * Am laufenden Spiel aendert sie NICHTS. Weder `screens/Tafelrunde.tsx` noch
 * `minispiele/tafelrunde/` werden angefasst; die Probe hat ihre eigenen
 * Figuren, ihr eigenes CSS und ihre eigene Abspiellogik.
 *
 * Die Szene kommt aus `../arena-szene.json` — EIN aufgezeichneter Kampf, den
 * beide Proben teilen (erzeugt von `../szene-erzeugen.mjs`).
 *
 * WARUM `?raw` UND `JSON.parse` STATT EINES JSON-IMPORTS: Der Client uebersetzt
 * ohne `resolveJsonModule`. Das anzuschalten waere eine Aenderung an der
 * gemeinsamen `tsconfig.json` wegen einer Wegwerf-Probe; `?raw` kennt Vite von
 * Haus aus und kostet nichts ausser dieser Zeile.
 */

import { useEffect, useMemo, useState } from 'react';

import { namenVon, rolleVon } from '../arena-einheiten';
import rohszene from '../arena-szene.json?raw';

import css from './Arena2D.module.css';
import { NACHSPANN_MS, VORLAUF_MS, standBei, type Kampfbericht } from './ablauf';
import { BILDER_JE_BEWEGUNG, FIGUREN_2D, HOLZ_UNTERGRUND, bildVersatz } from './figuren2d';

const SZENE = JSON.parse(rohszene) as Kampfbericht;

function sekunden(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

export function Arena2D() {
  /**
   * Der Neustart-Zaehler ist der ganze Knopf "nochmal": Er haengt am Effekt
   * unten, und der setzt die Uhr auf null. Ein zweiter Zustand fuer "laeuft
   * gerade" waere eine zweite Wahrheit — der Stand kommt ausschliesslich aus
   * `standBei(bericht, zeit)`.
   */
  const [durchgang, setDurchgang] = useState(0);
  const [zeitMs, setZeitMs] = useState(-VORLAUF_MS);

  useEffect(() => {
    /*
     * Die Uhr laeuft ueber requestAnimationFrame und misst gegen den ERSTEN
     * Zeitstempel, nicht ueber aufaddierte Abstaende. Aufsummierte
     * Bildabstaende laufen bei jedem verschluckten Bild weiter auseinander —
     * und ein Handy, das kurz in die Sperre geht, verschluckt viele.
     */
    let beginn: number | null = null;
    let angefordert = 0;
    const takt = (jetzt: number) => {
      if (beginn === null) beginn = jetzt;
      // Die Kampfuhr faengt negativ an — der Vorlauf zeigt die Aufstellung,
      // bevor bei Null der erste Schlag faellt.
      const vergangen = jetzt - beginn - VORLAUF_MS;
      setZeitMs(vergangen);
      if (vergangen < SZENE.dauerMs + NACHSPANN_MS) {
        angefordert = requestAnimationFrame(takt);
      }
    };
    setZeitMs(-VORLAUF_MS);
    angefordert = requestAnimationFrame(takt);
    return () => cancelAnimationFrame(angefordert);
  }, [durchgang]);

  const stand = useMemo(() => standBei(SZENE, zeitMs), [zeitMs]);

  return (
    <div className={css.seite}>
      <div className={css.kopf}>
        <h1 className={css.titel}>Probe A — Arena in 2D</h1>
        <span className={css.uhr}>
          {sekunden(Math.min(Math.max(0, zeitMs), SZENE.dauerMs))} / {sekunden(SZENE.dauerMs)}
        </span>
      </div>

      <div className={css.buehne} style={{ backgroundImage: `url('${HOLZ_UNTERGRUND}')` }}>
        <div className={css.schleier} />
        <div className={css.mitte} />
        <span className={`${css.seitenschild} ${css.linksSchild}`}>Seite 0</span>
        <span className={`${css.seitenschild} ${css.rechtsSchild}`}>Seite 1</span>

        <div className={css.feld}>
          {stand.figuren.map((figur) => {
            const satz = FIGUREN_2D[rolleVon(figur.einheitId)];
            const anteil = Math.round((figur.leben / figur.hoechstesLeben) * 100);
            return (
              <div
                key={figur.id}
                className={css.figur}
                data-seite={figur.seite}
                data-tot={figur.tot ? 'ja' : 'nein'}
                style={{
                  left: `${figur.ort.x}%`,
                  top: `${figur.ort.y}%`,
                  /*
                   * Wer weiter unten steht, deckt den ab, der weiter oben steht —
                   * sonst schiebt sich eine hintere Figur vor eine vordere,
                   * sobald sich beide ueberlappen. Gefallene ganz nach hinten.
                   */
                  zIndex: figur.tot ? 1 : 2 + Math.round(figur.ort.y),
                }}
              >
                <span className={css.beschriftung}>
                  <span className={css.name}>{namenVon(figur.einheitId)}</span>
                  <span className={css.balken} aria-hidden={figur.tot}>
                    {!figur.tot && (
                      <span className={css.balkenFuellung} style={{ width: `${anteil}%` }} />
                    )}
                  </span>
                </span>
                <span
                  /*
                   * Der Schluessel traegt den Beginn der Bewegung. Damit baut
                   * React das Element bei jedem neuen Schlag neu auf, und die
                   * CSS-Bewegung faengt von vorn an. Ohne ihn liefe die
                   * Schlagbewegung einmal durch und der zweite Schlag waere
                   * unsichtbar — bei 97 Treffern in der Szene faellt das auf.
                   */
                  key={`${figur.bewegung}-${figur.bewegungAb}`}
                  className={`${css.sprite} ${css[figur.bewegung]}`}
                  data-bewegung={figur.bewegung}
                  style={{
                    backgroundImage: `url('${satz.bogen}')`,
                    backgroundSize: `${BILDER_JE_BEWEGUNG * 100}% ${satz.zeilen * 100}%`,
                    backgroundPositionY: bildVersatz(satz.zeile[figur.bewegung], satz.zeilen),
                  }}
                />
              </div>
            );
          })}
        </div>

        {stand.vorbei && (
          <div className={css.ergebnis}>
            {stand.sieger === null ? 'Unentschieden' : `Seite ${stand.sieger} gewinnt`}
          </div>
        )}
      </div>

      <button type="button" className={css.knopf} onClick={() => setDurchgang((n) => n + 1)}>
        nochmal
      </button>

      <p className={css.fuss}>
        Dieselbe aufgezeichnete Szene wie Probe B (3D): {SZENE.ereignisse.length} Ereignisse,{' '}
        {sekunden(SZENE.dauerMs)}, Saat „{SZENE.saat}". Figuren: UnitForge (unitforge.net),
        frei fuer jede Nutzung ohne Namensnennung; Boden: ambientCG Wood051, CC0 1.0. Herkunft
        und Aufbau je Figur stehen in <code>figuren2d.ts</code>.
      </p>
    </div>
  );
}
