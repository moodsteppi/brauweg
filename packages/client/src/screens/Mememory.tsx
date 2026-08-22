import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import { spieleKlang, setzeTon, tonAn } from '../minispiele/mememory/klaenge';
import { useTable } from '../useTable';

/**
 * Mememory — Memory-Duell zu zweit.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie beim Feldherr: ohne Tisch das
 * Hauptmenue mit der Match-Suche, mit Tisch das Brett. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Match-Suche muss den Tisch
 * unter Umstaenden wechseln (siehe `wechsleZuKleinerem`), und ein Wechsel ueber
 * zwei Bildschirmzustaende hinweg waere ein Flackern.
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

const NAME_SCHLUESSEL = 'mememory.name';
const NAME_MAX = 16;

/** Bildpfad eines Motivs. Eine Stelle, damit Katalog und Ordner nie auseinanderlaufen. */
function motivBild(kennung: string): string {
  return `/mememory/motive/${kennung}.webp`;
}

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

function gelesenerName(): string {
  try {
    return window.localStorage.getItem(NAME_SCHLUESSEL) ?? '';
  } catch {
    return '';
  }
}

export function Mememory({
  startTisch,
  onBack,
}: {
  /** Tisch aus dem "Weiterspielen" des Hubs. Sonst faengt alles im Menue an. */
  startTisch?: string | null;
  onBack: () => void;
}): React.JSX.Element {
  const [tischId, setTischId] = useState<string | null>(startTisch ?? null);
  /** Tisch, den ich selbst aufgemacht habe — nur dann wird gewechselt. */
  const [eigenerTisch, setEigenerTisch] = useState<string | null>(null);
  const [sucht, setSucht] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [name, setName] = useState(gelesenerName);
  const [ton, setTonZustand] = useState(tonAn);
  const [fehler, setFehler] = useState<string | null>(null);
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

  const tisch = useTable<MememorySicht>(tischId, 'mememory');
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
      const { id } = await api.createTable({
        gameId: 'mememory',
        config: { spalten: 5, zeilen: 8, merkzeitMs: 1100 },
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
  // Name, Vorladen, Klang
  // -------------------------------------------------------------------------

  /** Den eigenen Namen einmal an die Partie reichen, sobald sie steht. */
  const nameGesendet = useRef<string | null>(null);
  useEffect(() => {
    if (!sicht || !tischId) return;
    const gewuenscht = name.trim();
    if (!gewuenscht || nameGesendet.current === `${tischId}:${gewuenscht}`) return;
    nameGesendet.current = `${tischId}:${gewuenscht}`;
    tisch.send({ typ: 'name', name: gewuenscht });
  }, [sicht !== null, tischId, name]);

  /**
   * Bilder vorladen, sobald die Motivliste da ist.
   *
   * Der Auftrag verlangt ausdruecklich, dass es keine Ladephasen gibt. Ein
   * Motiv, das erst beim Umdrehen geladen wird, zeigt fuer einen Wimpernschlag
   * eine leere Karte — und das ist genau der Moment, in dem man hinsieht.
   */
  useEffect(() => {
    if (!sicht) return;
    for (const kennung of sicht.motive) {
      const bild = new Image();
      bild.decoding = 'async';
      bild.src = motivBild(kennung);
    }
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
  }, [sicht, eigenerSitz]);

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

  const merkeName = (roh: string): void => {
    const gekuerzt = [...roh].slice(0, NAME_MAX).join('');
    setName(gekuerzt);
    try {
      window.localStorage.setItem(NAME_SCHLUESSEL, gekuerzt);
    } catch {
      /* Privater Modus: der Name gilt dann nur fuer diese Sitzung. */
    }
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

          <input
            className="mm-namensfeld"
            type="text"
            inputMode="text"
            enterKeyHint="done"
            maxLength={NAME_MAX}
            placeholder="Name…"
            value={name}
            onChange={(e) => merkeName(e.target.value)}
          />

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

  const tippe = (platz: number): void => {
    if (!meinZug || offenLokal.length >= 2) return;
    if (sicht.besitzer[platz] !== null || offenLokal.includes(platz)) return;
    setGetippt({ platz, revision });
    spieleKlang('dreh');
    tisch.send({ typ: 'aufdecken', platz });
  };

  const namenVon = (sitz: number): string =>
    sicht.namen[sitz] ||
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
          style={
            {
              '--mm-spalten': sicht.spalten,
              '--mm-zeilen': sicht.zeilen,
            } as React.CSSProperties
          }
        >
          {sicht.feld.map((kennung, platz) => {
            const besitzer = sicht.besitzer[platz];
            const aufgedeckt = kennung !== null || offenLokal.includes(platz);
            return (
              <button
                key={platz}
                type="button"
                className="mm-karte"
                data-offen={aufgedeckt || undefined}
                data-besitz={besitzer === null ? undefined : farbeVon(besitzer)}
                disabled={!meinZug || aufgedeckt}
                onClick={() => tippe(platz)}
                aria-label={aufgedeckt ? `Karte ${platz + 1}, aufgedeckt` : `Karte ${platz + 1}`}
              >
                <span className="mm-innen">
                  <span className="mm-rueck" />
                  <span className="mm-vorn">
                    {/* Kein <img> auf eine Datei, die es noch nicht gibt: Bis
                        die Sicht die Kennung liefert, bleibt die Flaeche leer. */}
                    {kennung && <img src={motivBild(kennung)} alt="" draggable={false} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <footer className="mm-leiste unten" data-farbe={farbeVon(eigenerSitz)}>
        <span className="mm-name">{namenVon(eigenerSitz)}</span>
        <span className="mm-zug">{meinZug ? 'Du bist dran' : ''}</span>
        <span className="mm-stand">{sicht.punkte[eigenerSitz] ?? 0}</span>
      </footer>

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
                nameGesendet.current = null;
                setGetippt(null);
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
