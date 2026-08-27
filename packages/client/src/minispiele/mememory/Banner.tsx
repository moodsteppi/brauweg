/**
 * Das Banner von Mememory in der Spielauswahl — mit echten Memes darauf, und
 * seit dem 27. August abends spielt es sich selbst.
 *
 * Bis zum 27. August lag dort ein gemaltes Stillleben: eine Pinnwand voller
 * erfundener Tierkarten. Das sah nach Mememory aus, zeigte aber nichts, was
 * es im Spiel wirklich gibt. Jetzt haengen dort genau die Motive, die eine
 * Partie auf die Karten legt.
 *
 * **Gezogen wird aus dem ganzen Topf, der im Spiel liegt** — dem festen
 * Katalog UND den freigegebenen Einsendungen. Das ist die Auskunft, die das
 * Banner geben soll: So sieht dieses Spiel aus. Ein Banner nur aus
 * Einsendungen war der erste Anlauf und ging am Ziel vorbei: Solange kaum
 * jemand etwas eingereicht hat, zeigte es dieselben zwei Bilder oder fiel
 * ganz auf das gemalte Stillleben zurueck — also auf alles ausser den
 * Memes, um die es geht.
 *
 * **Und keine neue Datei.** Der Untergrund ist die rote Tischdecke aus dem
 * Spiel (`decke-rot.webp`, 19 kB, laedt am Tisch ohnehin), die Karten sind
 * die Motive selbst, und die Rueckseite ist dieselbe `.mm-rueck` wie am
 * Brett — reines CSS, kein Byte Uebertragung.
 *
 * **Faellt der Abruf aus, bleibt es beim gemalten Banner.** Eine leere rote
 * Flaeche sieht nach Fehler aus, das Stillleben nach Absicht — dieselbe
 * Regel wie ueberall in diesem Haus: kein `<img>` auf etwas, das es gerade
 * nicht gibt.
 *
 * ---
 *
 * ## Der Takt
 *
 * Alle vier bis zehn Sekunden dreht sich eine Karte um, bleibt kurz verdeckt
 * liegen und kommt mit einem anderen Meme zurueck. In einem von vier Faellen
 * ist das andere Meme eines, das schon auf dem Banner liegt: Dann drehen
 * BEIDE zu, werden nacheinander aufgedeckt — und es gibt Konfetti. Das ist
 * das Spiel in fuenf Sekunden erzaehlt, ohne ein Wort.
 *
 * **Getauscht wird, waehrend die Karte verdeckt liegt.** Die Vorderseite
 * traegt `backface-visibility: hidden`, ist also in dieser Zeit unsichtbar;
 * der Wechsel der Bildquelle faellt damit niemandem auf.
 *
 * **Der Takt haengt an einem SCHLUESSEL und nicht an den Karten.** Ein Effekt
 * mit dem Kartenfeld in der Abhaengigkeitsliste liefe bei jedem Tausch neu
 * und raeumte dabei seine eigenen Uhren ab — der Takt bliebe nach dem ersten
 * Umdrehen stehen. Der aktuelle Stand kommt deshalb aus einem Ref
 * (CLAUDE.md, "Was regelmaessig Zeit kostet": Effekte an einen Schluessel
 * haengen, nicht an ein Objekt).
 *
 * **Bei verdecktem Tab passiert nichts.** `setTimeout` wird dort auf eine
 * Sekunde gedeckelt und die CSS-Uebergaenge stehen still; ein Takt, der
 * trotzdem weiterliefe, arbeitete nur gegen den Akku.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../api';
import { spielBanner } from '../../hub';
import { motivBildPfad } from './bildpfad';

/** So viele Karten passen nebeneinander, ohne dass eine briefmarkig wird. */
const KARTEN = 5;

/**
 * Wie lange eine halbe Drehung dauert. Muss zum Uebergang von
 * `.mm-banner-blatt` in styles.css passen — laeuft die Uhr hier schneller,
 * wechselt das Bild, waehrend die Vorderseite noch zu sehen ist.
 */
const DREH_MS = 300;

/** Wie lange die Karte verdeckt liegen bleibt. In dieser Zeit wird getauscht. */
const ZU_MS = 420;

/** Abstand zwischen den beiden Aufdeckern eines Paares. */
const REIHE_MS = 280;

/** So lange fliegt das Konfetti. Muss zu `mm-konfetti-flug` passen. */
const KONFETTI_MS = 900;

/** Jede vierte Drehung legt ein Paar. So steht es im Auftrag. */
const PAAR_CHANCE = 0.25;

/**
 * Kuerzester und laengster Halt des Zeigers auf einer Karte.
 *
 * Er wird von Sprung zu Sprung laenger (siehe `sprungdauern`) — das liest
 * sich wie ein Rad, das ausrollt und stehenbleibt, und macht aus dem Warten
 * eine Ankuendigung statt eines Flackerns.
 */
const HALT_MIN = 360;
const HALT_MAX = 900;

/** Wie viel jeder weitere Sprung auf die Haltezeit drauflegt. */
const HALT_ZUWACHS = 110;

interface Karte {
  readonly kennung: string;
  /** Liegt gerade verdeckt. */
  readonly zu: boolean;
}

export function MememoryBanner(): React.JSX.Element {
  /** `null` = noch nicht gefragt oder fehlgeschlagen. Dann das gemalte Bild. */
  const [karten, setKarten] = useState<readonly Karte[] | null>(null);
  /** Der ganze Topf, aus dem nachgezogen wird. */
  const topf = useRef<readonly string[]>([]);
  /**
   * Der aktuelle Stand fuer den Takt.
   *
   * Er liest hier und nicht aus `karten`: Der Takt darf nicht bei jedem
   * Tausch neu aufgesetzt werden (siehe Kopf).
   */
  const stand = useRef<readonly Karte[] | null>(null);
  stand.current = karten;
  /**
   * An welchem Platz gerade Konfetti fliegt, und in welchem Durchgang.
   *
   * Die Nummer ist der Schluessel der Animation: Zwei Paare hintereinander an
   * derselben Stelle muessen sie neu starten, und dafuer muss sich der
   * Schluessel aendern — dieselbe Ueberlegung wie beim Namensblitz am Brett.
   */
  const [konfetti, setKonfetti] = useState<{ platz: number; nr: number } | null>(null);
  const konfettiNr = useRef(0);
  /**
   * Welche Karte gerade hervorgehoben ist, oder `null`.
   *
   * Waehrend der Wartezeit wandert der Zeiger ueber die Karten und bleibt am
   * Ende auf der stehen, die gleich umgedreht wird. Er ist damit kein
   * Schmuck, sondern eine Ankuendigung: Wer hinsieht, weiss eine Sekunde
   * vorher, wo etwas passiert.
   */
  const [schweber, setSchweber] = useState<number | null>(null);

  useEffect(() => {
    let lebt = true;
    void api
      .mememoryMotive()
      .then((antwort) => {
        if (!lebt) return;
        const alle = [...(antwort.grund ?? []), ...(antwort.hochgeladen ?? [])];
        if (alle.length === 0) return;
        topf.current = alle;
        setKarten(waehle(alle, KARTEN).map((kennung) => ({ kennung, zu: false })));
      })
      .catch(() => {
        /* Kein Netz: Dann haengt eben das gemalte Banner da. */
      });
    return () => {
      lebt = false;
    };
  }, []);

  /** Eine einzelne Karte umschreiben, ohne die anderen anzufassen. */
  const setzeKarte = useCallback((platz: number, teil: Partial<Karte>): void => {
    setKarten((alt) => (alt ? alt.map((k, i) => (i === platz ? { ...k, ...teil } : k)) : alt));
  }, []);

  const laeuft = karten !== null;

  useEffect(() => {
    if (!laeuft) return;
    // Ohne Bewegung bleibt das Banner ein Bild. "Reduzieren" heisst
    // reduzieren; eine Karte, die still ihr Motiv wechselt, ist auch Bewegung.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let lebt = true;
    /**
     * Offene Uhren. Beim Aufraeumen werden sie nicht nur gestoppt, sondern
     * auch aufgeloest: Sonst haenge der Ablauf unten fuer immer in seinem
     * naechsten `await`, und der ganze Verschluss bliebe im Speicher.
     */
    const offen = new Set<() => void>();
    const schlaf = (ms: number): Promise<void> =>
      new Promise((fertig) => {
        const loesen = (): void => {
          window.clearTimeout(uhr);
          offen.delete(loesen);
          fertig();
        };
        const uhr = window.setTimeout(loesen, ms);
        offen.add(loesen);
      });

    /**
     * Die Haltezeiten eines Durchlaufs, zusammen genau `gesamt`.
     *
     * Vorne kurz, hinten lang: Jeder Sprung bekommt HALT_ZUWACHS mehr als
     * sein Vorgaenger, gedeckelt bei HALT_MAX. Der letzte Eintrag ist der
     * Rest und gehoert der Zielkarte — er ist damit immer der laengste
     * Halt, und genau das laesst die Wahl endgueltig aussehen.
     */
    const sprungdauern = (gesamt: number): number[] => {
      const dauern: number[] = [];
      let rest = gesamt;
      let i = 0;
      // Solange noch Platz fuer einen Sprung UND den Schlusshalt ist.
      while (rest > HALT_MAX + HALT_MIN) {
        const d = Math.min(HALT_MAX, HALT_MIN + i * HALT_ZUWACHS + Math.random() * 160);
        dauern.push(d);
        rest -= d;
        i += 1;
      }
      dauern.push(rest);
      return dauern;
    };

    /**
     * Der Zeiger wandert ueber die Karten und bleibt auf `ziel` stehen.
     *
     * Er springt nie auf die Karte, auf der er schon steht — ein Sprung, den
     * man nicht sieht, ist keiner. Und der VORLETZTE Halt meidet zusaetzlich
     * das Ziel: Sonst waere der letzte Sprung ein Stehenbleiben, und das
     * Landen ginge unter.
     */
    const wandere = async (ziel: number, anzahl: number, gesamt: number): Promise<void> => {
      const dauern = sprungdauern(gesamt);
      let steht = -1;
      for (let k = 0; k < dauern.length; k += 1) {
        const letzter = k === dauern.length - 1;
        const vorletzter = k === dauern.length - 2;
        let naechste = ziel;
        if (!letzter) {
          const auswahl = [...Array(anzahl).keys()].filter(
            (x) => x !== steht && !(vorletzter && x === ziel),
          );
          naechste = auswahl[Math.floor(Math.random() * auswahl.length)] ?? ziel;
        }
        steht = naechste;
        setSchweber(naechste);
        await schlaf(dauern[k] ?? HALT_MIN);
        if (!lebt) return;
      }
    };

    const lauf = async (): Promise<void> => {
      while (lebt) {
        /*
         * Verdeckter Tab: nichts tun, aber weiter nachsehen. Der Zeiger
         * bliebe sonst irgendwo stehen, und beim Zurueckkommen saehe man
         * eine willkuerlich hervorgehobene Karte.
         */
        if (document.visibilityState !== 'visible') {
          setSchweber(null);
          await schlaf(2000);
          if (!lebt) return;
          continue;
        }

        const jetzt = stand.current;
        if (!jetzt || jetzt.length < 2) {
          await schlaf(2000);
          if (!lebt) return;
          continue;
        }

        /*
         * Entschieden wird VOR der Wartezeit.
         *
         * Anders ginge es nicht: Der Zeiger soll waehrend des Wartens genau
         * auf die Karte zulaufen, die danach umgedreht wird. Waehrend der
         * Wartezeit aendert sich am Stand nichts — es gibt nur diesen einen
         * Takt —, die Entscheidung ist am Ende also noch gueltig.
         */
        const platz = Math.floor(Math.random() * jetzt.length);
        /**
         * Ein Paar, wenn der Wuerfel es sagt UND es einen Partner gibt, der
         * nicht schon dasselbe Motiv traegt. Zwei gleiche Karten ein zweites
         * Mal zu paaren waere kein Fund, sondern Stillstand.
         */
        const partner = jetzt
          .filter((k, i) => i !== platz && k.kennung !== jetzt[platz]?.kennung)
          .map((k) => k.kennung);
        const paart = Math.random() < PAAR_CHANCE && partner.length > 0;

        if (paart) {
          const kennung = partner[Math.floor(Math.random() * partner.length)] ?? '';
          const zweiter = jetzt.findIndex((k, i) => i !== platz && k.kennung === kennung);

          await wandere(platz, jetzt.length, 4000 + Math.random() * 6000);
          if (!lebt) return;
          // Beide zudrehen — von hier an ist es eine Runde Memory.
          setSchweber(null);
          setzeKarte(platz, { zu: true });
          setzeKarte(zweiter, { zu: true });
          await schlaf(DREH_MS + ZU_MS);
          if (!lebt) return;
          // Der Tausch passiert unsichtbar hinter der Rueckseite.
          setzeKarte(platz, { kennung, zu: false });
          await schlaf(REIHE_MS);
          if (!lebt) return;
          setzeKarte(zweiter, { zu: false });
          await schlaf(DREH_MS);
          if (!lebt) return;
          konfettiNr.current += 1;
          setKonfetti({ platz: zweiter, nr: konfettiNr.current });
          await schlaf(KONFETTI_MS);
          if (!lebt) return;
          setKonfetti(null);
        } else {
          // Ein Motiv, das gerade NICHT auf dem Banner liegt: Sonst entstuende
          // ein Paar, und das ist der andere Zweig.
          const liegt = new Set(jetzt.map((k) => k.kennung));
          const frei = topf.current.filter((k) => !liegt.has(k));
          if (frei.length === 0) {
            await schlaf(2000);
            if (!lebt) return;
            continue;
          }
          const kennung = frei[Math.floor(Math.random() * frei.length)] ?? '';
          /*
           * Vorladen, solange die Karte noch offen liegt. Ein Bild, das erst
           * beim Aufdecken laedt, blitzt als weisse Karte auf — genau der
           * Fehler, den `decode()` am Brett verhindert. Seit der Zeiger
           * wandert, hat es dafuer die ganze Wartezeit.
           */
          const bild = new Image();
          bild.src = motivBildPfad(kennung);

          await wandere(platz, jetzt.length, 4000 + Math.random() * 6000);
          if (!lebt) return;
          setSchweber(null);
          setzeKarte(platz, { zu: true });
          await schlaf(DREH_MS + ZU_MS);
          if (!lebt) return;
          setzeKarte(platz, { kennung, zu: false });
        }
      }
    };

    void lauf();
    return () => {
      lebt = false;
      for (const loesen of [...offen]) loesen();
    };
  }, [laeuft, setzeKarte]);

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
        {karten.map((karte, i) => (
          <span
            /*
             * Der Schluessel ist der PLATZ und nicht die Kennung: Beim Paar
             * liegt dieselbe Kennung zweimal, und zwei gleiche Schluessel
             * sind fuer React ein Fehler. Die Plaetze stehen ohnehin fest.
             */
            key={i}
            className="mm-banner-karte"
            data-zu={karte.zu || undefined}
            data-hebt={schweber === i || undefined}
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
          >
            <span className="mm-banner-blatt">
              <img
                className="mm-banner-vorn"
                src={motivBildPfad(karte.kennung)}
                alt=""
                draggable={false}
              />
              {/* Dieselbe Rueckseite wie am Brett: reines CSS, kein Byte
                  Uebertragung, und man erkennt das Spiel wieder. */}
              <span className="mm-rueck mm-banner-rueck" />
            </span>
            {konfetti?.platz === i && <Konfetti key={konfetti.nr} />}
          </span>
        ))}
      </span>
    </span>
  );
}

/** So viele Schnipsel fliegen. Klein halten: Es ist ein Banner, kein Feuerwerk. */
const SCHNIPSEL = 12;

/**
 * Ein kleiner Konfettiwurf ueber der Karte, die das Paar vollgemacht hat.
 *
 * Die Farben sind die vier Spielerfarben plus Gold — dieselben, die am Brett
 * die Punktzahlen tragen (siehe eckenplan.ts).
 *
 * Richtung und Weite kommen aus dem Zufall, aber nur EINMAL: Sie stehen in
 * den Stilvariablen des Schnipsels, und die Bewegung selbst ist eine
 * CSS-Animation. Ein Wurf, der bei jedem Bild neu rechnet, kostet die
 * Bildrate der ganzen Spielauswahl — und die zeichnet sieben Banner.
 */
function Konfetti(): React.JSX.Element {
  const [schnipsel] = useState(() =>
    Array.from({ length: SCHNIPSEL }, () => {
      const winkel = Math.random() * Math.PI * 2;
      const weite = 24 + Math.random() * 24;
      return {
        dx: Math.cos(winkel) * weite,
        // Nach oben versetzt: Konfetti faellt, es steigt nicht gleichmaessig
        // in alle Richtungen.
        dy: Math.sin(winkel) * weite - 12,
        dreh: (Math.random() - 0.5) * 540,
        verzug: Math.random() * 90,
        farbe: ['#7fb3ff', '#ff8a80', '#e8c96a', '#86c48f', '#ffd873'][
          Math.floor(Math.random() * 5)
        ],
      };
    }),
  );

  return (
    <span className="mm-konfetti" aria-hidden="true">
      {schnipsel.map((s, i) => (
        <i
          key={i}
          style={
            {
              '--mm-kx': `${s.dx}px`,
              '--mm-ky': `${s.dy}px`,
              '--mm-kdreh': `${s.dreh}deg`,
              '--mm-kverzug': `${s.verzug}ms`,
              background: s.farbe,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * `anzahl` Stueck herausgreifen, ohne Wiederholung.
 *
 * Gewuerfelt und nicht die ersten: Wer die Spielauswahl aufmacht, soll
 * andere Bilder sehen als beim letzten Mal — bei ueber neunzig Motiven im
 * Topf sind das jedes Mal andere fuenf, und das ist der halbe Reiz. Gezogen
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
