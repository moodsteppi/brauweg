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
 * **Gespeichert wird von selbst.** Bis zum 27. August stand darunter ein
 * Knopf "Auswahl merken" — mit dem guten Grund, dass Auswaehlen ein
 * Suchvorgang ist: Man tippt eines an, sieht es oben, nimmt es wieder weg,
 * und eine Anfrage je Tipp waeren ein Dutzend Anfragen fuer eine
 * Entscheidung. Der Grund gilt weiter, die Loesung ist eine andere geworden:
 * Ein Zeitgeber sammelt die Tipps und schickt erst, wenn eine halbe Sekunde
 * lang Ruhe war. Zwoelf Tipps sind damit eine Anfrage — und niemand verliert
 * mehr seine Auswahl, weil er den Knopf uebersehen hat.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../../api';
import { Schloss, Wuerfel } from '../../zeichen';
import { motivBildPfad } from './bildpfad';

/** Muss zu GURT_MAX in packages/server/src/sammlung.ts passen. */
const GURT_MAX = 3;

/**
 * So lange Ruhe, bevor gespeichert wird.
 *
 * Kurz genug, dass es beim Weiterwischen schon draussen ist; lang genug, dass
 * "eines rein, eines raus, doch wieder das erste" eine Anfrage bleibt und
 * nicht drei.
 */
const RUHE_MS = 550;

/** Gurt und Schloesser als eine Zeichenkette — damit ein Vergleich eine Zeile ist. */
function schluessel(gurt: readonly string[], gesperrt: readonly boolean[]): string {
  return gurt.map((kennung, i) => `${kennung}:${gesperrt[i] === true ? 1 : 0}`).join('|');
}

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
   * Der Schalter geht seinen eigenen Weg (eigene Route, sofort) — er ist eine
   * Entscheidung und kein Suchvorgang. Ein Zeitgeber davor waere nur eine
   * halbe Sekunde, in der der Schalter schon umgelegt aussieht und es noch
   * nicht ist.
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
  const [fehler, setFehler] = useState<string | null>(null);
  /** Der Erklaersatz zum Schalter, solange der Finger auf dem Text liegt. */
  const [hilfe, setHilfe] = useState(false);

  /** Was zuletzt beim Server steht. `null` heisst: der naechste Lauf schickt. */
  const gespeichert = useRef<string | null>(null);
  /** Was noch draussen ist, falls die Seite vorher verlassen wird. */
  const offen = useRef<{ gurt: string[]; gesperrt: boolean[] } | null>(null);
  /**
   * `onGurt` liegt in einer Schachtel und nicht in der Abhaengigkeitsliste.
   *
   * Der Aufrufer gibt es als Pfeilfunktion mit — die ist bei jedem Bild eine
   * andere. In der Liste des Zeitgebers stuende damit bei jedem Bild ein
   * neuer Wert, der Zeitgeber wuerde abgeraeumt und neu gestellt, und
   * gespeichert wuerde nie.
   */
  const meldeGurt = useRef(onGurt);
  meldeGurt.current = onGurt;

  const holen = useCallback(async (): Promise<void> => {
    setLaedt(true);
    try {
      const antwort = await api.mememorySammlung();
      setGesammelt(new Set(antwort.gesammelt.map((zeile) => zeile.kennung)));
      setGurt(antwort.gurt);
      setGesperrt(antwort.gesperrt ?? []);
      setZufall(antwort.zufall === true);
      // Der Stand vom Server ist der Stand beim Server: Ohne diese Zeile
      // schickte der Zeitgeber gleich nach dem Laden dasselbe noch einmal.
      gespeichert.current = schluessel(antwort.gurt, antwort.gesperrt ?? []);
    } catch {
      setFehler('Die Sammlung ließ sich nicht laden.');
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void holen();
  }, [holen]);

  /** Einmal wirklich schicken. Stabil, damit der Zeitgeber stehen bleibt. */
  const sende = useCallback(async (last: { gurt: string[]; gesperrt: boolean[] }) => {
    // Vorgemerkt, bevor die Antwort da ist: Sonst schickte ein zweiter Lauf
    // waehrend der Wartezeit denselben Stand ein zweites Mal.
    gespeichert.current = schluessel(last.gurt, last.gesperrt);
    try {
      const antwort = await api.mememoryGurt(last.gurt, last.gesperrt);
      if (offen.current === last) offen.current = null;
      setFehler(null);
      meldeGurt.current?.(antwort.gurt);
    } catch {
      // Zurueckgenommen, damit die naechste Aenderung es wieder versucht.
      gespeichert.current = null;
      setFehler('Das Speichern hat nicht geklappt.');
    }
  }, []);

  /**
   * Der Zeitgeber. Jede Aenderung raeumt ihn ab und stellt ihn neu — erst
   * wenn eine halbe Sekunde nichts mehr passiert, geht die Auswahl raus.
   */
  useEffect(() => {
    if (laedt) return;
    const jetzt = schluessel(gurt, gesperrt);
    if (jetzt === gespeichert.current) return;
    // Die Schloesser werden auf die Laenge des Gurts gebracht: Der Server
    // liest sie Fach fuer Fach, ein Ueberhang waere ein Schloss ohne Fach.
    const last = { gurt: [...gurt], gesperrt: gurt.map((_, i) => gesperrt[i] === true) };
    offen.current = last;
    const uhr = window.setTimeout(() => void sende(last), RUHE_MS);
    return () => window.clearTimeout(uhr);
  }, [gurt, gesperrt, laedt, sende]);

  /**
   * Beim Verlassen der Seite geht der Rest sofort raus.
   *
   * Ohne das verloere genau der seine Auswahl, der sie zuletzt getroffen und
   * dann weitergewischt hat — also der wahrscheinlichste Fall ueberhaupt.
   */
  useEffect(
    () => () => {
      const rest = offen.current;
      offen.current = null;
      if (rest) void api.mememoryGurt(rest.gurt, rest.gesperrt).catch(() => undefined);
    },
    [],
  );

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

  /** Ein Fach sperren oder freigeben. */
  const schliesse = (fach: number): void => {
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

  /* --- Der Erklaersatz zum Schalter --------------------------------------
     Er kommt beim Gedrueckthalten des Namens und geht beim Loslassen. Vorher
     stand er fest unter dem Namen: dort war er laenger als das, was er
     erklaert, und stand auch fuer die da, die den Schalter laengst kennen. */
  const halteUhr = useRef<number | null>(null);
  /**
   * Nach einem langen Druck darf der Klick den Schalter NICHT umlegen.
   *
   * Beim Loslassen schickt der Browser trotzdem einen Klick auf die
   * Beschriftung, und eine Beschriftung schaltet ihr Kaestchen. Wer sich also
   * die Erklaerung ansieht, haette damit nebenbei den Schalter umgelegt.
   */
  const unterdrueckt = useRef(false);

  const haltAn = (): void => {
    halteUhr.current = window.setTimeout(() => {
      halteUhr.current = null;
      setHilfe(true);
    }, 400);
  };
  const haltAus = (): void => {
    if (halteUhr.current !== null) {
      window.clearTimeout(halteUhr.current);
      halteUhr.current = null;
    }
    if (hilfe) {
      unterdrueckt.current = true;
      // Nur fuer den einen Klick, der jetzt gleich kommt: Bliebe die Sperre
      // stehen, ginge das naechste normale Antippen ins Leere.
      window.setTimeout(() => {
        unterdrueckt.current = false;
      }, 350);
    }
    setHilfe(false);
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
        * Der Schalter steht ZWISCHEN Gurt und Satz: Er ändert, was die drei
        * Fächer darüber bedeuten, und geht deshalb nicht ans Seitenende.
        *
        * Von links nach rechts Würfel, Name, Schalter — und kein <label> mehr
        * um die ganze Zeile: Der Name trägt jetzt eine eigene Geste (halten =
        * erklären), und die verträgt sich nicht damit, dass ein Tipp
        * irgendwo in der Zeile den Schalter umlegt.
        */}
      <div className="mm-schalterzeile">
        <Wuerfel />
        <label
          className="mm-schalter-name"
          htmlFor="mm-zufallsgurt"
          onPointerDown={haltAn}
          onPointerUp={haltAus}
          onPointerLeave={haltAus}
          onPointerCancel={haltAus}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            if (unterdrueckt.current) e.preventDefault();
          }}
        >
          Random Memes
        </label>
        <input
          id="mm-zufallsgurt"
          type="checkbox"
          role="switch"
          className="mm-schalter"
          checked={zufall}
          disabled={laedt}
          onChange={(e) => schalteZufall(e.target.checked)}
        />
        {/*
          * Die Erklärung steht ÜBER der Zeile und mit Abstand: Darunter läge
          * sie unter dem Finger, der sie gerade aufruft.
          */}
        {hilfe && (
          <span className="mm-schalter-hilfe" role="tooltip">
            Jede Partie zieht drei andere Memes aus deiner Sammlung — festgehaltene Fächer
            bleiben.
          </span>
        )}
      </div>

      <p className="mm-gurt-satz">
        {habe === 0
          ? 'Noch nichts gefunden. Jedes Paar, das du selbst aufdeckst, landet hier.'
          : `Wähle bis zu ${GURT_MAX} aus — die wirfst du im Spiel über den Tisch.`}
      </p>

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
