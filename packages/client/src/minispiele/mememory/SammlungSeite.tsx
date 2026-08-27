/**
 * Die Sammlung — eine ganze Seite, kein Kaesten mehr.
 *
 * Oben die drei Gurtfaecher (was im Spiel fliegt), darunter der Bestand nach
 * Sammlungen gruppiert. Wer ein Motiv einmal als PAAR aufgedeckt hat, hat es
 * (gemeldet wird das am Tisch, siehe Mememory.tsx).
 *
 * **Was noch fehlt, bekommt kein Bild.** Ein unbekanntes Motiv ist ein
 * dunkles Feld mit einem Fragezeichen und nicht das verschleierte Bild — aus
 * zwei Gruenden, und der zweite ist der wichtigere: Ein Filter ist Zierde,
 * die Datei laedt trotzdem; ein frisches Konto zoege so ueber hundert Bilder,
 * um sie unkenntlich zu machen. Und was im Blatt steht, laesst sich mit einer
 * geoeffneten Entwicklerkonsole ansehen — die Ueberraschung waere futsch.
 *
 * **Gruppen sind schon der Aufbau, auch wenn es heute erst zwei gibt.** Der
 * Grundstock und der Vorschlagskasten. Ein Pack ist spaeter eine weitere
 * Zeile in `gruppen()`, kein Umbau: Die Seite kennt nur "Titel plus Liste".
 *
 * **Gespeichert wird erst beim Tippen auf "Auswahl merken".** Auswaehlen ist
 * ein Suchvorgang — man tippt eines an, sieht es oben, nimmt es wieder weg.
 * Eine Anfrage je Tipp waere ein Dutzend Anfragen fuer eine Entscheidung, und
 * auf einer Mobilfunkleitung sieht man das.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../../api';
import { Schloss } from '../../zeichen';
import { motivBildPfad } from './bildpfad';

/** Muss zu GURT_MAX in packages/server/src/sammlung.ts passen. */
const GURT_MAX = 3;

export interface Gruppe {
  readonly schluessel: string;
  readonly titel: string;
  readonly kennungen: readonly string[];
}

export function SammlungSeite({
  grund,
  hochgeladen,
  namen,
  onGurt,
}: {
  /** Der feste Katalog des Spielmoduls, durchgereicht vom Server. */
  grund: readonly string[];
  /** Freigegebene Einsendungen. */
  hochgeladen: readonly string[];
  /** Kennung -> Name, soweit bekannt. Nur hochgeladene Motive haben einen. */
  namen: Record<string, string>;
  /** Nach dem Speichern: der Gurt, wie er jetzt gilt. */
  onGurt?: (gurt: string[]) => void;
}): React.JSX.Element {
  const [gesammelt, setGesammelt] = useState<ReadonlySet<string>>(new Set());
  const [gurt, setGurt] = useState<string[]>([]);
  /**
   * Zufallsgurt: In jeder Partie drei andere Memes aus der Sammlung.
   *
   * Der Schalter wirkt SOFORT (eigene Route), der Gurt darunter erst beim
   * Merken. Beides in einem Aufruf hiesse, dass ein Umlegen des Schalters
   * eine halbfertige Auswahl mit festschreibt.
   */
  const [zufall, setZufall] = useState(false);
  /**
   * Welches Fach der Zufall in Ruhe laesst — Stellung fuer Stellung zum Gurt.
   *
   * Eine eigene Liste und kein Feld an der Kennung: Gesperrt wird ein FACH.
   * Wer das Motiv aus dem Fach nimmt, nimmt damit auch das Schloss weg.
   */
  const [gesperrt, setGesperrt] = useState<boolean[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gemerkt, setGemerkt] = useState(false);

  const holen = useCallback(async (): Promise<void> => {
    setLaedt(true);
    try {
      const antwort = await api.mememorySammlung();
      setGesammelt(new Set(antwort.gesammelt.map((zeile) => zeile.kennung)));
      setGurt(antwort.gurt);
      setGesperrt(antwort.gesperrt ?? []);
      setZufall(antwort.zufall === true);
    } catch {
      setFehler('Die Sammlung ließ sich nicht laden.');
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void holen();
  }, [holen]);

  /**
   * Die Gruppen dieser Seite.
   *
   * Der Vorschlagskasten steht ZUERST: Er ist der Teil, der sich aendert —
   * wer hier nachsieht, sucht meistens das Bild, das gestern dazukam. Der
   * Grundstock steht darunter und bleibt, wie er ist.
   *
   * Eine leere Gruppe faellt heraus: Solange niemand etwas eingereicht hat,
   * soll da keine Ueberschrift ueber nichts stehen.
   */
  const gruppen = useMemo<readonly Gruppe[]>(
    () =>
      [
        {
          schluessel: 'hoch',
          titel: 'Aus dem Vorschlagskasten',
          kennungen: hochgeladen,
        },
        { schluessel: 'grund', titel: 'Grundstock', kennungen: grund },
      ].filter((gruppe) => gruppe.kennungen.length > 0),
    [grund, hochgeladen],
  );

  const gesamt = gruppen.reduce((summe, gruppe) => summe + gruppe.kennungen.length, 0);
  /**
   * Gezaehlt wird gegen den KATALOG und nicht gegen die Sammlung.
   *
   * Ein herausgenommenes Motiv bleibt in der Sammlung stehen (die Zeile
   * gehoert dem Konto), taucht aber in keiner Gruppe mehr auf. Ohne diesen
   * Schnitt stuende dort "89 von 88".
   */
  const habe = gruppen.reduce(
    (summe, gruppe) => summe + gruppe.kennungen.filter((k) => gesammelt.has(k)).length,
    0,
  );

  /**
   * Antippen legt ins Gurtfach oder nimmt wieder heraus.
   *
   * Ist der Gurt voll, passiert beim vierten NICHTS — statt heimlich das
   * erste zu verdraengen. Ein Tausch, den man nicht angeordnet hat, ist
   * schlimmer als ein Knopf, der nicht reagiert; die volle Leiste oben sagt
   * ohnehin, woran es liegt.
   */
  const umschalten = (kennung: string): void => {
    if (!gesammelt.has(kennung)) return;
    setGemerkt(false);
    setGurt((alt) => {
      const drin = alt.indexOf(kennung);
      if (drin >= 0) {
        // Das Schloss geht mit dem Motiv aus dem Fach: Es haengt am Fach, und
        // das ist gleich wieder leer.
        setGesperrt((schloesser) => schloesser.filter((_, i) => i !== drin));
        return alt.filter((k) => k !== kennung);
      }
      if (alt.length >= GURT_MAX) return alt;
      setGesperrt((schloesser) => [...schloesser, false]);
      return [...alt, kennung];
    });
  };

  /** Ein Fach sperren oder freigeben. Wirkt erst beim Merken. */
  const schliesse = (fach: number): void => {
    setGemerkt(false);
    setGesperrt((alt) => {
      const neu = [...alt];
      while (neu.length < gurt.length) neu.push(false);
      neu[fach] = !neu[fach];
      return neu;
    });
  };

  /**
   * Den Schalter umlegen. Er geht sofort raus — und faellt bei einem Fehler
   * sichtbar zurueck, statt still stehenzubleiben und beim naechsten Laden
   * anders auszusehen.
   */
  const schalteZufall = (an: boolean): void => {
    setZufall(an);
    void api.mememoryZufall(an).catch(() => setZufall(!an));
  };

  const speichern = async (): Promise<void> => {
    setBusy(true);
    setFehler(null);
    try {
      const antwort = await api.mememoryGurt(gurt, gesperrt.slice(0, gurt.length));
      setGurt(antwort.gurt);
      setGemerkt(true);
      onGurt?.(antwort.gurt);
    } catch {
      setFehler('Das Speichern hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mm-seite mm-seite-sammlung">
      <header className="mm-seite-kopf">
        <h2>Sammlung</h2>
        <p>
          {laedt ? 'Wird geladen…' : `${habe} von ${gesamt} gefunden`}
        </p>
      </header>

      {/* Der Gurt zuerst: Er ist das Ergebnis, das Raster darunter der Weg
          dahin. Drei feste Fächer, damit die Leiste nicht springt. */}
      <div className="mm-gurt mm-gurt-gross" aria-label="Gewählte Memes">
        {Array.from({ length: GURT_MAX }, (_, i) => {
          const kennung = gurt[i];
          const zu = gesperrt[i] === true;
          return (
            <div
              className="mm-gurt-fach"
              key={i}
              data-belegt={kennung ? '' : undefined}
              data-zu={zufall && zu ? '' : undefined}
            >
              {kennung ? (
                <button
                  type="button"
                  onClick={() => umschalten(kennung)}
                  aria-label={`${namen[kennung] ?? 'Meme'} aus dem Gurt nehmen`}
                >
                  <img src={motivBildPfad(kennung)} alt="" draggable={false} />
                </button>
              ) : (
                <span aria-hidden="true">{i + 1}</span>
              )}
              {/*
                * Das Schloss gibt es NUR im Zufallsmodus.
                *
                * Ohne ihn haelt der Gurt ohnehin, was drinsteht — ein
                * Schloss daneben waere ein Knopf, der nichts tut, und der
                * ist schlimmer als gar keiner.
                */}
              {zufall && kennung && (
                <button
                  type="button"
                  className="mm-fach-schloss"
                  onClick={() => schliesse(i)}
                  aria-pressed={zu}
                  aria-label={
                    zu
                      ? `${namen[kennung] ?? 'Meme'} nicht mehr festhalten`
                      : `${namen[kennung] ?? 'Meme'} festhalten`
                  }
                >
                  <Schloss zu={zu} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/*
        * Der Schalter steht ZWISCHEN Gurt und Satz: Er aendert, was die drei
        * Faecher darueber bedeuten, und geht deshalb nicht ans Seitenende.
        */}
      <label className="mm-schalterzeile">
        <span>
          <b>Jede Partie andere Memes</b>
          <em>Drei aus deiner Sammlung, neu gezogen — außer den festgehaltenen.</em>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="mm-schalter"
          checked={zufall}
          disabled={laedt}
          onChange={(e) => schalteZufall(e.target.checked)}
        />
      </label>

      <p className="mm-gurt-satz">
        {habe === 0
          ? 'Noch nichts gefunden. Jedes Paar, das du selbst aufdeckst, landet hier.'
          : zufall
            ? `Tippe auf ein Schloss, um ein Fach festzuhalten — die anderen werden jede Partie neu gezogen.`
            : `Wähle bis zu ${GURT_MAX} aus — die wirfst du im Spiel über den Tisch.`}
      </p>

      <div className="mm-gurt-fuss">
        <button
          type="button"
          className="mm-kasten-los"
          onClick={() => void speichern()}
          disabled={busy || laedt}
        >
          {gemerkt ? 'Gemerkt ✓' : 'Auswahl merken'}
        </button>
      </div>

      {fehler && <p className="mm-kasten-fehler">{fehler}</p>}

      {gruppen.map((gruppe) => (
        <section className="mm-gruppe" key={gruppe.schluessel}>
          <h3>
            {gruppe.titel}
            <em>
              {gruppe.kennungen.filter((k) => gesammelt.has(k)).length}/{gruppe.kennungen.length}
            </em>
          </h3>
          <div className="mm-sammelgitter">
            {gruppe.kennungen.map((kennung) => {
              const habeEs = gesammelt.has(kennung);
              return (
                <button
                  key={kennung}
                  type="button"
                  className="mm-sammelkachel"
                  data-gewaehlt={gurt.includes(kennung) ? '' : undefined}
                  data-fehlt={habeEs ? undefined : ''}
                  onClick={() => umschalten(kennung)}
                  aria-pressed={habeEs ? gurt.includes(kennung) : undefined}
                  disabled={!habeEs}
                  aria-label={habeEs ? (namen[kennung] ?? kennung) : 'Noch nicht gefunden'}
                >
                  {habeEs ? (
                    <img src={motivBildPfad(kennung)} alt="" draggable={false} />
                  ) : (
                    <span className="mm-sammel-frage" aria-hidden="true">
                      ?
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
