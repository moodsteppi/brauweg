import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import { motivBildPfad } from '../minispiele/mememory/bildpfad';
import { spieleKlang, setzeTon, tonAn } from '../minispiele/mememory/klaenge';
import { Vorschlagskasten } from '../minispiele/mememory/Vorschlagskasten';
import type { ReaktionMessage } from '../protocol';
import { useTable } from '../useTable';

/**
 * Mememory — Memory-Duell zu zweit.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie beim Feldherr: ohne Tisch das
 * Hauptmenue mit der Match-Suche, mit Tisch das Brett. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Match-Suche muss den Tisch
 * unter Umstaenden wechseln (siehe die Wettrennen-Regel unten), und ein
 * Wechsel ueber zwei Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul: Der Bildschirm bildet KEINE Regel nach.
 * Er schickt genau das, was der Spieler antippt, und zeichnet, was in der
 * Sicht steht. Die einzige Ausnahme ist die Vorwegnahme des eigenen Tipps
 * (`getippt`) — sie dreht die Karte sofort, damit die Bewegung nicht auf die
 * Funkstrecke wartet, und wird von der naechsten Sicht bestaetigt oder
 * zurueckgenommen.
 */

/** Sicht des Moduls, siehe packages/game-mememory/src/sicht.ts. */
interface MememorySicht {
  spalten: number;
  zeilen: number;
  /** Die Motive dieser Partie, sortiert — Grundlage des Vorladens. */
  motive: string[];
  /** Motivkennung je Platz, oder null solange die Karte verdeckt liegt. */
  feld: (string | null)[];
  besitzer: (number | null)[];
  offen: number[];
  punkte: Record<number, number>;
  namen: Record<number, string>;
  dran: number;
  pause: 'treffer' | 'daneben' | null;
  merkzeitMs: number;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}


/**
 * Regelsatz, mit dem die Match-Suche einen Tisch aufmacht.
 *
 * Muss zu DEFAULT_REGELN in packages/game-mememory/src/regeln.ts passen —
 * dort steht auch, warum es vier Spalten sind und nicht fuenf. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Die Suche soll nicht
 * auf eine zusaetzliche Antwort warten, bevor sie den Tisch aufmacht.
 */
const REGELSATZ = { spalten: 4, zeilen: 6, merkzeitMs: 1100 };

/**
 * Zeichenvorrat der Reaktionen.
 *
 * Die REIHENFOLGE ist Protokoll: Ueber die Leitung geht nur die Nummer, nicht
 * das Zeichen (der Server soll gar nicht wissen, was da fliegt — aus einer
 * Zahl laesst sich niemand beleidigen). Wer hier etwas einfuegt, verschiebt
 * die Bedeutung aller folgenden Nummern und muss die Modulversion hochsetzen.
 * Anhaengen ist gefahrlos.
 */
const REAKTIONEN = ['😂', '😮', '😎', '😭', '🔥'] as const;

/** Viermal je Sekunde, so wie es der Server auch deckelt. */
const REAKTION_PAUSE_MS = 250;

/** So viele Emojis duerfen hoechstens gleichzeitig fliegen. */
const FLIEGER_MAX = 12;

/**
 * Teamfarbe haengt am SITZ, nicht daran, wer man selbst ist.
 *
 * Sonst saehe jeder sich blau und den Gegner rot — und ein Screenshot des
 * einen widerspraeche dem des anderen. Sitz 0 ist blau, Sitz 1 ist rot, auf
 * beiden Geraeten.
 */
function farbeVon(sitz: number): 'blau' | 'rot' {
  return sitz === 0 ? 'blau' : 'rot';
}

interface Flieger {
  readonly id: number;
  readonly zeichen: number;
  readonly richtung: 'hoch' | 'runter';
  /** Seitlicher Versatz, damit zwei schnelle Reaktionen nicht uebereinander liegen. */
  readonly ab: number;
}

export function Mememory({
  startTisch,
  istAufsicht = false,
  onBack,
}: {
  /** Tisch aus dem "Weiterspielen" des Hubs. Sonst faengt alles im Menue an. */
  startTisch?: string | null;
  /**
   * Testkonto: darf im Vorschlagskasten freigeben, ablehnen und direkt
   * aufnehmen. Kommt fertig aus App.tsx — der Client rechnet nichts aus
   * Rechten aus, und der Server prueft es ohnehin ein zweites Mal.
   */
  istAufsicht?: boolean;
  onBack: () => void;
}): React.JSX.Element {
  const [tischId, setTischId] = useState<string | null>(startTisch ?? null);
  /** Tisch, den ich selbst aufgemacht habe — nur dann wird gewechselt. */
  const [eigenerTisch, setEigenerTisch] = useState<string | null>(null);
  const [sucht, setSucht] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [ton, setTonZustand] = useState(tonAn);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Der Vorschlagskasten liegt ueber dem Menue, sobald er offen ist. */
  const [kastenOffen, setKastenOffen] = useState(false);
  /** Wie viele Vorschlaege warten. Nur die Aufsicht bekommt die Zahl. */
  const [warten, setWarten] = useState(0);
  /**
   * Namen der hochgeladenen Motive, Kennung -> Name.
   *
   * Nur die hochgeladenen haben einen; die 88 Grundmotive heissen nirgends
   * anders als in ihrer Kennung, und eine aus `dj-katze` gebastelte
   * Beschriftung waere geraten, nicht benannt. Steht kein Name da, blendet
   * das Brett auch nichts ein — besser als ein leeres Band.
   */
  const [motivNamen, setMotivNamen] = useState<Record<string, string>>({});
  /**
   * Der Name, der gerade ueber dem Brett aufblitzt. Die Nummer ist der
   * Schluessel der Animation: Zwei Treffer hintereinander mit demselben
   * Namen muessen sie neu starten, und dafuer muss sich der Schluessel
   * aendern.
   */
  const [namensblitz, setNamensblitz] = useState<{ nr: number; name: string } | null>(null);
  const blitzNr = useRef(0);
  /**
   * Platz, den ich gerade angetippt habe — dreht sofort, ohne auf den Server
   * zu warten.
   *
   * Mit der Revision, die zum Zeitpunkt des Tipps galt: Sobald irgendeine
   * neuere Sicht eintrifft, hat der Server den Tipp verarbeitet (oder
   * abgelehnt), und die Vorwegnahme hat ausgedient.
   *
   * Der erste Anlauf verglich stattdessen, ob der Platz in `offen` auftaucht —
   * und blieb haengen, sobald zwei Sichten im selben Takt eintrafen: React
   * fasst sie zusammen, die Zwischenstufe mit dem eigenen Platz wird nie
   * gerendert, und die Karte blieb fuer den Rest der Partie umgedreht.
   */
  const [getippt, setGetippt] = useState<{ platz: number; revision: number } | null>(null);

  /**
   * Motive, deren Bild fertig geladen UND entpackt ist.
   *
   * Der Grund ist die Umdreh-Bewegung: Wer eine Karte antippt, sieht die
   * Rueckseite wegdrehen — und dahinter lag bis eben eine weisse Flaeche,
   * weil das Bild erst mit der Serverantwort kommt und danach noch entpackt
   * werden muss. Die Karte dreht deshalb in zwei Stufen (siehe `data-halb`).
   */
  const [bereiteBilder, setBereiteBilder] = useState<ReadonlySet<string>>(new Set());

  /** Emojis, die gerade ueber den Tisch fliegen. */
  const [flieger, setFlieger] = useState<readonly Flieger[]>([]);
  const fliegerNr = useRef(0);
  const letzteReaktion = useRef(0);
  /**
   * Das Zeichen, das der Knopf gerade anbietet.
   *
   * Es wandert von selbst weiter (siehe unten). Gesendet wird GENAU dieses —
   * der erste Anlauf wuerfelte beim Tippen, und dann stand auf dem Knopf
   * etwas anderes, als beim Gegner ankam.
   */
  const [angeboten, setAngeboten] = useState(0);
  const knopfRef = useRef<HTMLButtonElement | null>(null);

  const zeigeFlieger = useCallback((zeichen: number, richtung: 'hoch' | 'runter'): void => {
    const id = (fliegerNr.current += 1);
    const ab = Math.round((Math.random() - 0.5) * 90);
    // Der Deckel ist kein Schoenheitsfehler: Ohne ihn haelt ein Dauerklicker
    // beliebig viele Knoten am Leben, und der Bildschirm ruckelt.
    setFlieger((alt) => [...alt, { id, zeichen, richtung, ab }].slice(-FLIEGER_MAX));
    window.setTimeout(() => setFlieger((alt) => alt.filter((f) => f.id !== id)), 1400);
  }, []);

  /**
   * Eine Reaktion der Gegenseite. Der Server spiegelt dem Absender nichts
   * zurueck — was hier ankommt, ist immer fremd und faellt deshalb von oben.
   */
  const beiReaktion = useCallback(
    (nachricht: ReaktionMessage): void => zeigeFlieger(nachricht.zeichen, 'runter'),
    [zeigeFlieger],
  );

  const tisch = useTable<MememorySicht>(
    tischId,
    'mememory',
    undefined,
    undefined,
    undefined,
    beiReaktion,
  );
  const sicht = tisch.view?.view ?? null;
  const eigenerSitz = tisch.view?.seat ?? 0;
  const gegnerSitz = eigenerSitz === 0 ? 1 : 0;

  // -------------------------------------------------------------------------
  // Aktive Spieler
  // -------------------------------------------------------------------------

  // Auch im Wartebereich weiterzaehlen: Dort steht die Zahl noch einmal, und
  // eine eingefrorene Null waehrend der Suche sieht aus, als suchte man allein.
  // Erst wenn die Partie laeuft, hoert die Abfrage auf.
  useEffect(() => {
    if (sicht) return;
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveSpieler('mememory')
        .then((antwort) => {
          if (lebt) setAktiv(antwort.aktiv);
        })
        .catch(() => {
          /* Die Zahl ist Beiwerk. Ein Fehlversuch darf das Menue nicht stoeren. */
        });
    };
    hole();
    const takt = window.setInterval(hole, 5000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [sicht !== null]);

  /**
   * Die Namen der hochgeladenen Motive.
   *
   * Einmal beim Aufschlagen des Bildschirms, fuer BEIDE Seiten — nicht nur
   * fuer den, der den Tisch aufmacht. Faellt der Abruf aus, bleibt es beim
   * stummen Brett; ein Name ist Beiwerk und darf keine Partie aufhalten.
   */
  useEffect(() => {
    let lebt = true;
    void api
      .mememoryMotive()
      .then((antwort) => {
        if (lebt) setMotivNamen(antwort.namen ?? {});
      })
      .catch(() => {
        /* ohne Namen weiterspielen */
      });
    return () => {
      lebt = false;
    };
  }, []);

  /**
   * Die Zahl am Briefkasten: wie viele Vorschlaege warten.
   *
   * Nur fuer die Aufsicht und nur im Menue — und bewusst OHNE Takt. Ein
   * Vorschlagskasten ist nichts, was im Sekundentakt neu gezaehlt werden
   * muesste; einmal beim Aufschlagen des Menues und nach jedem Schliessen
   * des Kastens reicht.
   */
  useEffect(() => {
    if (!istAufsicht || tischId || kastenOffen) return;
    let lebt = true;
    void api
      .mememoryOffen()
      .then((antwort) => {
        if (lebt) setWarten(antwort.offen);
      })
      .catch(() => {
        /* Kein Recht, kein Netz: Dann steht am Knopf eben keine Zahl. */
      });
    return () => {
      lebt = false;
    };
  }, [istAufsicht, tischId, kastenOffen]);

  // -------------------------------------------------------------------------
  // Match-Suche
  // -------------------------------------------------------------------------

  /**
   * Einen Gegner finden: an einem offenen Tisch Platz nehmen, sonst selbst
   * einen aufmachen.
   *
   * Die Plattform hat keine Warteschlange; gesucht wird deshalb ueber die
   * gewoehnliche Tischliste. Das reicht, weil `joinTable` serverseitig
   * absichert, dass zwei gleichzeitige Beitritte nicht denselben Platz
   * bekommen — der Verlierer des Rennens bekommt einen Fehler und sucht weiter.
   */
  const suche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const zeilen = await api.tables('mememory');
      const offen = zeilen
        .filter((zeile) => zeile.occupied < zeile.seats)
        .sort((a, b) => a.id.localeCompare(b.id));
      const ziel = offen[0];
      if (ziel) {
        await api.joinTable(ziel.id);
        setEigenerTisch(null);
        setTischId(ziel.id);
        return;
      }
      /**
       * Die hochgeladenen Motive kommen als `zusatz` mit an den Tisch.
       *
       * Erst hier und nicht beim Aufbau des Bildschirms: Wer beitritt,
       * braucht sie nicht — der Topf steht am Tisch, den der andere
       * aufgemacht hat. Und faellt der Abruf aus, spielt der Tisch eben mit
       * den 88 Grundmotiven; ein Fehlschlag darf keine Partie verhindern.
       */
      const zusatz = await api
        .mememoryMotive()
        .then((antwort) => antwort.hochgeladen)
        .catch(() => []);
      const { id } = await api.createTable({
        gameId: 'mememory',
        config: zusatz.length > 0 ? { ...REGELSATZ, zusatz } : REGELSATZ,
        seats: 2,
        rounds: 1,
      });
      setEigenerTisch(id);
      setTischId(id);
    } catch {
      setSucht(false);
      setFehler('Die Suche ist fehlgeschlagen. Noch einmal versuchen?');
    }
  }, []);

  /**
   * Das Wettrennen aufloesen.
   *
   * Tippen zwei Leute gleichzeitig auf "Suchen", sieht keiner den Tisch des
   * anderen und beide machen einen auf. Wechselten danach BEIDE zum jeweils
   * anderen, taeten sie das fuer immer. Deshalb bewegt sich nur einer: der mit
   * der groesseren Tischkennung. Die Kennungen sind auf beiden Geraeten
   * dieselben, also braucht die Regel keine Absprache.
   */
  const wechseltGerade = useRef(false);
  useEffect(() => {
    if (!tischId || !eigenerTisch || tischId !== eigenerTisch) return;
    if (tisch.table && tisch.table.status !== 'waiting') return;
    let lebt = true;
    const pruefe = (): void => {
      void api
        .tables('mememory')
        .then(async (zeilen: TableRow[]) => {
          if (!lebt || wechseltGerade.current) return;
          const kleiner = zeilen
            .filter((z) => z.occupied < z.seats && z.id < tischId)
            .sort((a, b) => a.id.localeCompare(b.id))[0];
          if (!kleiner) return;
          wechseltGerade.current = true;
          try {
            // Kein leaveTable davor: joinTable raeumt serverseitig alle
            // anderen Warteplaetze desselben Kontos ab.
            await api.joinTable(kleiner.id);
            if (!lebt) return;
            setEigenerTisch(null);
            setTischId(kleiner.id);
          } catch {
            /* Der Tisch war schneller voll. Beim naechsten Takt weiter. */
          } finally {
            wechseltGerade.current = false;
          }
        })
        .catch(() => {});
    };
    const takt = window.setInterval(pruefe, 2500);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [tischId, eigenerTisch, tisch.table?.status]);

  const brichAb = useCallback((): void => {
    const id = tischId;
    setSucht(false);
    setTischId(null);
    setEigenerTisch(null);
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  // -------------------------------------------------------------------------
  // Vorladen, Klang
  // -------------------------------------------------------------------------

  /**
   * Bilder vorladen UND entpacken, sobald die Motivliste da ist.
   *
   * `decode()` statt `onload` ist hier der Unterschied, auf den es ankommt:
   * Ein geladenes, aber noch nicht entpacktes Bild erscheint erst einen
   * Bildlauf spaeter — und genau dieser eine Bildlauf ist das Aufblitzen der
   * leeren Karte mitten in der Drehung.
   *
   * Ein Fehlschlag zaehlt ausdruecklich auch als "fertig". Sonst bliebe eine
   * Karte, deren Datei fehlt, fuer immer halb gedreht stehen — ein fehlendes
   * Bild darf das Spiel nicht anhalten.
   */
  useEffect(() => {
    if (!sicht) return;
    let lebt = true;
    for (const kennung of sicht.motive) {
      const bild = new Image();
      const fertig = (): void => {
        if (!lebt) return;
        setBereiteBilder((alt) => (alt.has(kennung) ? alt : new Set(alt).add(kennung)));
      };
      bild.src = motivBildPfad(kennung);
      if (typeof bild.decode === 'function') void bild.decode().then(fertig, fertig);
      else {
        bild.onload = fertig;
        bild.onerror = fertig;
      }
    }
    return () => {
      lebt = false;
    };
  }, [sicht?.motive.join(',')]);

  /** Klangausloeser. Verglichen wird gegen den vorigen Stand, nicht gegen die Zeit. */
  const vorigeOffen = useRef<number[]>([]);
  const vorigePause = useRef<MememorySicht['pause']>(null);
  const siegGespielt = useRef(false);
  useEffect(() => {
    if (!sicht) return;
    // Fremde Karte umgedreht: der eigene Tipp hat schon beim Antippen geklungen.
    const neu = sicht.offen.filter((platz) => !vorigeOffen.current.includes(platz));
    if (neu.length > 0 && sicht.dran !== eigenerSitz) spieleKlang('dreh');
    vorigeOffen.current = [...sicht.offen];

    if (sicht.pause !== vorigePause.current) {
      if (sicht.pause === 'treffer') {
        spieleKlang(sicht.dran === eigenerSitz ? 'treffer' : 'gefunden');
        /*
         * Der Name des gefundenen Paares blitzt auf.
         *
         * Die Kennung steht in der Sicht an jedem der beiden offenen
         * Plaetze — waehrend der Schaupause sind sie aufgedeckt. Hat das
         * Motiv keinen Namen (alle 88 Grundmotive), passiert nichts.
         */
        const platz = sicht.offen[0];
        const kennung = platz === undefined ? null : sicht.feld[platz];
        const name = kennung ? motivNamen[kennung] : undefined;
        if (name) setNamensblitz({ nr: (blitzNr.current += 1), name });
      } else if (sicht.pause === 'daneben') {
        spieleKlang('daneben');
      }
      vorigePause.current = sicht.pause;
    }

    if (sicht.fertig && !siegGespielt.current) {
      siegGespielt.current = true;
      if (sicht.sieger !== null) {
        spieleKlang(sicht.sieger === eigenerSitz ? 'sieg' : 'niederlage');
      }
    }
  }, [sicht, eigenerSitz, motivNamen]);

  /**
   * Der Namensblitz raeumt sich selbst weg.
   *
   * Etwas laenger als die Animation (1500 ms), damit sie sicher zu Ende
   * gelaufen ist, bevor der Knoten verschwindet — sonst bricht sie im
   * letzten Bild ab. Der Schluessel ist die Nummer: Ein neuer Treffer setzt
   * eine neue, und der alte Zeitgeber wird beim Aufraeumen abgeraeumt.
   */
  useEffect(() => {
    if (!namensblitz) return;
    const uhr = window.setTimeout(() => setNamensblitz(null), 1600);
    return () => window.clearTimeout(uhr);
  }, [namensblitz]);

  /**
   * Das Angebot wandert im Zweisekundentakt weiter.
   *
   * Damit ist der Knopf ein kleines Spiel im Spiel: Wer ein bestimmtes Zeichen
   * schicken will, muss den Moment abpassen. Der Reihe nach und nicht
   * gewuerfelt — nur so laesst sich abwarten, dass das gewuenschte Zeichen
   * gleich kommt.
   *
   * Laeuft nur am Brett: Im Menue gibt es keinen Knopf, und ein Takt, der
   * dort weiterliefe, zeichnete den Bildschirm alle zwei Sekunden umsonst neu.
   */
  useEffect(() => {
    if (!sicht) return;
    const takt = window.setInterval(
      () => setAngeboten((n) => (n + 1) % REAKTIONEN.length),
      2000,
    );
    return () => window.clearInterval(takt);
  }, [sicht !== null]);

  /** Die Vorwegnahme faellt mit der naechsten Sicht — bestaetigt oder nicht. */
  const revision = tisch.view?.revision ?? -1;
  useEffect(() => {
    if (getippt !== null && revision !== getippt.revision) setGetippt(null);
  }, [revision, getippt]);

  // -------------------------------------------------------------------------
  // Hauptmenue
  // -------------------------------------------------------------------------

  const schalteTon = (): void => {
    const neu = !ton;
    setTonZustand(neu);
    setzeTon(neu);
    if (neu) spieleKlang('dreh');
  };

  const tonKnopf = (
    <button
      className="mm-ton"
      type="button"
      aria-pressed={ton}
      aria-label={ton ? 'Ton ausschalten' : 'Ton einschalten'}
      onClick={schalteTon}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {ton ? (
          <>
            <path
              d="M16.5 8.5a5 5 0 0 1 0 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M19 6a8.5 8.5 0 0 1 0 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        ) : (
          // Der rote Balken ist der ganze Unterschied: durchgestrichen = aus.
          <path
            d="M3 3 L21 21"
            fill="none"
            stroke="#ff4d4d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );

  /**
   * Der Briefkasten. Er sitzt unten LINKS, gegenueber dem Lautsprecher:
   * Beides sind Nebensachen, und die Mitte gehoert der Match-Suche.
   */
  const kastenKnopf = (
    <button
      className="mm-kasten-knopf"
      type="button"
      onClick={() => setKastenOffen(true)}
      aria-label="Vorschlagskasten öffnen"
      title="Meme vorschlagen"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {/* Briefkasten: Kasten, Klappe, Fahne. Ein Bild waere eine Datei mehr
            fuer ein Zeichen, das in drei Strichen erzaehlt ist. */}
        <path
          d="M4 10a4 4 0 0 1 8 0v8H5a1 1 0 0 1-1-1v-7z"
          fill="currentColor"
          opacity="0.9"
        />
        <path d="M12 18V10a4 4 0 0 1 8 0v7a1 1 0 0 1-1 1h-7z" fill="currentColor" />
        <path d="M6.5 10h3" stroke="#0b0716" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M17 6V3.5h2.6" stroke="#ff9b90" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </svg>
      {warten > 0 && <em>{warten}</em>}
    </button>
  );

  if (!tischId) {
    return (
      <main className="mm-menue">
        {/* Der Zurueck-Knopf sitzt bewusst nicht ganz oben: Auf iPhones mit
            Notch liegt die obere Ecke unter der Statusleiste. */}
        <button className="mm-zurueck" type="button" onClick={onBack}>
          ← Zurück
        </button>

        <div className="mm-menue-mitte">
          <h1 className="mm-titel">Mememory</h1>
          <p className="mm-untertitel">Zwei Bilder, ein Paar, zwei Spieler.</p>

          <button className="mm-suchen" type="button" onClick={() => void suche()} disabled={sucht}>
            <span>Online Match suchen…</span>
            {/* Die Zahl steht in Klammern daneben und nicht im Satz: Sie
                aendert sich alle fuenf Sekunden, und ein springendes Wort
                mitten im Text liest sich wie ein Fehler. */}
            <em>({aktiv ?? '…'})</em>
          </button>

          {fehler && <p className="mm-fehler">{fehler}</p>}
        </div>

        {tonKnopf}
        {kastenKnopf}
        {kastenOffen && (
          <Vorschlagskasten istAufsicht={istAufsicht} onFertig={() => setKastenOffen(false)} />
        )}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Wartebereich
  // -------------------------------------------------------------------------

  if (!sicht) {
    const besetzt = (tisch.table?.seats ?? []).filter((platz) => platz.accountId).length;
    return (
      <main className="mm-menue">
        <button className="mm-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="mm-menue-mitte">
          <h1 className="mm-titel">Suche läuft</h1>
          <p className="mm-untertitel">
            {tisch.status === 'open'
              ? `${besetzt} von 2 Plätzen besetzt`
              : 'Verbindung wird aufgebaut…'}
          </p>
          <div className="mm-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="mm-untertitel">{aktiv ?? '…'} Spieler gerade in Mememory</p>
        </div>
        {tonKnopf}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Brett
  // -------------------------------------------------------------------------

  const meinZug = sicht.dran === eigenerSitz && sicht.pause === null && !sicht.fertig;
  const offenLokal =
    getippt === null || sicht.offen.includes(getippt.platz)
      ? sicht.offen
      : [...sicht.offen, getippt.platz];
  const deckeFarbe = sicht.fertig ? 'weiss' : farbeVon(sicht.dran);
  /**
   * Der Gegner ist am Zug — dann liegt das ganze Brett blasser da.
   *
   * Das war vorher ein Zufall: Solange man nicht dran war, trugen ALLE Karten
   * das `disabled`-Merkmal, und WebKit zeichnet deaktivierte Knoepfe blasser.
   * Der Nebeneffekt (auch die gerade selbst umgedrehte Karte war blass) ist
   * weg, die Anzeige bleibt — jetzt als eigene Regel, die auch sagt, was sie
   * meint. Massgeblich ist `dran`, nicht `meinZug`: Waehrend der eigenen
   * Schaupause ist man nicht am Zug, aber eben auch nicht am Warten.
   */
  const wartend = !sicht.fertig && sicht.dran !== eigenerSitz;

  const tippe = (platz: number): void => {
    if (!meinZug || offenLokal.length >= 2) return;
    if (sicht.besitzer[platz] !== null || offenLokal.includes(platz)) return;
    setGetippt({ platz, revision });
    spieleKlang('dreh');
    tisch.send({ typ: 'aufdecken', platz });
  };

  const reagiere = (): void => {
    const jetzt = Date.now();
    // Die Bremse steht auch hier, nicht nur im Server: Was ohnehin verworfen
    // wuerde, muss die Leitung gar nicht erst belasten.
    if (jetzt - letzteReaktion.current < REAKTION_PAUSE_MS) return;
    letzteReaktion.current = jetzt;

    // Genau das, was auf dem Knopf steht. Beide Seiten schlagen dieselbe
    // Nummer im selben Vorrat nach, also fliegt drueben dasselbe Zeichen.
    const zeichen = angeboten;
    zeigeFlieger(zeichen, 'hoch');
    tisch.sendeReaktion(zeichen);

    /*
     * Der Knopfdruck wird ueber die Web-Animations-Schnittstelle gespielt und
     * nicht ueber CSS: Eine CSS-Animation startet nur dann neu, wenn sich der
     * Animationsname aendert oder das Element neu entsteht — beim vierten
     * Tipp je Sekunde also gar nicht. `animate()` beginnt jedes Mal von vorn.
     */
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      knopfRef.current?.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(.86)', offset: 0.35 },
          { transform: 'scale(1.06)', offset: 0.7 },
          { transform: 'scale(1)' },
        ],
        { duration: 280, easing: 'cubic-bezier(.2,.8,.25,1)' },
      );
    }
  };

  /**
   * Am Tisch steht der Name des KONTOS, nicht ein selbstgewaehlter.
   *
   * Bis zum 26. August gab es im Menue ein Feld dafuer, und die Sicht traegt
   * mit `namen` weiterhin die Moeglichkeit — das Spielmodul kann es, es
   * benutzt hier nur niemand mehr. Ein zweiter Name je Spiel war eine
   * Einladung, sich am selben Abend unter drei Namen zu zeigen; die
   * Plattform hat ohnehin einen, und der steht auch auf jeder Rangliste.
   */
  const namenVon = (sitz: number): string =>
    tisch.table?.seats.find((platz) => platz.seat === sitz)?.displayName ||
    (sitz === eigenerSitz ? 'Du' : 'Gegner');

  return (
    <main className="mm-buehne" data-dran={deckeFarbe}>
      {/* Drei Bilder uebereinander statt eines eingefaerbten: Der Farbwechsel
          beim Zugwechsel wird so eine Ueberblendung und kein Bildsprung. */}
      <div className="mm-grund" aria-hidden="true">
        <img src="/mememory/decke-weiss.webp" alt="" data-an={deckeFarbe === 'weiss'} />
        <img src="/mememory/decke-blau.webp" alt="" data-an={deckeFarbe === 'blau'} />
        <img src="/mememory/decke-rot.webp" alt="" data-an={deckeFarbe === 'rot'} />
      </div>

      <header className="mm-leiste oben" data-farbe={farbeVon(gegnerSitz)}>
        <button className="mm-raus" type="button" onClick={onBack} aria-label="Spiel verlassen">
          ←
        </button>
        <span className="mm-name">{namenVon(gegnerSitz)}</span>
        <span className="mm-stand">{sicht.punkte[gegnerSitz] ?? 0}</span>
      </header>

      <div className="mm-mitte">
        <div
          className="mm-brett"
          data-warten={wartend || undefined}
          style={
            {
              '--mm-spalten': sicht.spalten,
              '--mm-zeilen': sicht.zeilen,
            } as React.CSSProperties
          }
        >
          {sicht.feld.map((kennung, platz) => {
            const besitzer = sicht.besitzer[platz];
            /** Die Karte SOLL gedreht sein — ob sie es ganz kann, steht darunter. */
            const gewuenscht = kennung !== null || offenLokal.includes(platz);
            /** Ganz drehen darf sie erst, wenn das Bild auch zeigbar ist. */
            const zeigbar = kennung !== null && bereiteBilder.has(kennung);
            return (
              <button
                key={platz}
                type="button"
                className="mm-karte"
                data-offen={zeigbar || undefined}
                data-halb={(gewuenscht && !zeigbar) || undefined}
                data-besitz={besitzer === null ? undefined : farbeVon(besitzer)}
                /*
                 * KEIN `disabled`.
                 *
                 * Ein deaktivierter Knopf wird von Safari halbdurchsichtig
                 * gezeichnet — und damit sah jede gerade umgedrehte Karte
                 * blass aus, weil sie in dem Moment nicht mehr anklickbar
                 * ist. Ob ein Tipp zaehlt, entscheidet ohnehin `tippe`.
                 */
                aria-disabled={!meinZug || gewuenscht || undefined}
                onClick={() => tippe(platz)}
                aria-label={gewuenscht ? `Karte ${platz + 1}, aufgedeckt` : `Karte ${platz + 1}`}
              >
                <span className="mm-innen">
                  <span className="mm-rueck" />
                  <span className="mm-vorn">
                    {/* Kein <img> auf eine Datei, die es noch nicht gibt: Bis
                        die Sicht die Kennung liefert, bleibt die Flaeche leer. */}
                    {kennung && <img src={motivBildPfad(kennung)} alt="" draggable={false} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/*
        * Der Name des gefundenen Paares.
        *
        * Liegt ueber dem Brett und nimmt keine Tipper an (`pointer-events`
        * steht im Blatt auf none) — waehrend der Schaupause darf man weiter
        * auf Karten zielen. Der Schluessel ist die Blitznummer: Ohne ihn
        * bliebe React beim selben Knoten, und ein zweiter Treffer mit
        * demselben Namen liefe die Animation gar nicht noch einmal.
        */}
      {namensblitz && (
        <div className="mm-namensblitz" aria-hidden="true">
          <span key={namensblitz.nr}>{namensblitz.name}</span>
        </div>
      )}

      {/* Reaktionen: ein Tipp, ein Emoji, kein Menue. Der Knopf bietet alle
          zwei Sekunden ein anderes Zeichen an — wer ein bestimmtes schicken
          will, passt den Moment ab. Eine Auswahlliste waere mitten in der
          Partie zu lange Beschaeftigung, ein fester Zufall waere Willkuer. */}
      <div className="mm-reaktionsleiste">
        <button
          ref={knopfRef}
          className="mm-reaktion"
          type="button"
          onClick={reagiere}
          aria-label={`Reaktion ${REAKTIONEN[angeboten] ?? ''} senden`}
        >
          {/*
           * Das Zeichen sitzt in einem eigenen Kasten, der den Knopf ganz
           * ausfuellt, und wird DARIN zentriert — nicht vom Knopf selbst.
           * Ein <button> bringt eine eigene Polsterung mit und legt seinen
           * Inhalt in einen anonymen Kasten; beides zusammen hat das Emoji
           * sichtbar aus der Mitte geschoben.
           */}
          <span className="mm-reaktion-zeichen" aria-hidden="true">
            {REAKTIONEN[angeboten] ?? REAKTIONEN[0]}
          </span>
        </button>
      </div>

      <footer className="mm-leiste unten" data-farbe={farbeVon(eigenerSitz)}>
        <span className="mm-name">{namenVon(eigenerSitz)}</span>
        <span className="mm-zug">{meinZug ? 'Du bist dran' : ''}</span>
        <span className="mm-stand">{sicht.punkte[eigenerSitz] ?? 0}</span>
      </footer>

      <div className="mm-flug" aria-hidden="true">
        {flieger.map((f) => (
          <span
            key={f.id}
            className="mm-flieger"
            data-richtung={f.richtung}
            style={{ '--mm-ab': `${f.ab}px` } as React.CSSProperties}
          >
            {REAKTIONEN[f.zeichen] ?? REAKTIONEN[0]}
          </span>
        ))}
      </div>

      {tisch.status !== 'open' && <div className="mm-funk">Verbindung…</div>}

      {sicht.fertig && (
        <div className="mm-ende">
          <div className="mm-ende-blatt">
            <h2>
              {sicht.sieger === null
                ? 'Unentschieden'
                : sicht.sieger === eigenerSitz
                  ? 'Gewonnen!'
                  : 'Verloren'}
            </h2>
            <p className="mm-ende-stand">
              <b data-farbe={farbeVon(eigenerSitz)}>{sicht.punkte[eigenerSitz] ?? 0}</b>
              <span>:</span>
              <b data-farbe={farbeVon(gegnerSitz)}>{sicht.punkte[gegnerSitz] ?? 0}</b>
            </p>
            <button
              className="mm-suchen"
              type="button"
              onClick={() => {
                siegGespielt.current = false;
                vorigeOffen.current = [];
                vorigePause.current = null;
                setGetippt(null);
                setFlieger([]);
                setTischId(null);
                setEigenerTisch(null);
                setSucht(false);
              }}
            >
              <span>Noch eine Runde</span>
            </button>
            <button className="mm-zweitknopf" type="button" onClick={onBack}>
              Zurück zur Spielauswahl
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
