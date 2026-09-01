import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import { useTable } from '../useTable';

/**
 * Eiland — Landnahme zu zweit, gleichzeitig gezogen.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie bei Filler und Mememory: ohne Tisch
 * das Hauptmenue mit der Match-Suche, mit Tisch die Karte. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Match-Suche muss den Tisch
 * unter Umstaenden wechseln (siehe die Wettrennen-Regel unten), und ein
 * Wechsel ueber zwei Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul: Der Bildschirm bildet KEINE Regel nach.
 * Welche Felder anwaehlbar sind, rechnet er nicht aus — sie stehen als
 * `sicht.waehlbar` in der Sicht. Was hinter dem Nebel liegt, weiss er gar
 * nicht: Dort steht `null`, und ein `null` wird grau gezeichnet.
 */

/** Sicht des Moduls, siehe packages/game-eiland/src/sicht.ts. */
interface EilandSicht {
  ich: number | null;
  spalten: number;
  zeilen: number;
  sichtweite: number;
  /** 0 Gras, 1 Wasser, 2 Berg — oder null, solange das Feld im Nebel liegt. */
  gelaende: (number | null)[];
  ornament: (number | null)[];
  besitzer: (number | null)[];
  /** Grauton je Platz — nur Zeichnung, verraet nichts. */
  grau: number[];
  punkte: Record<number, number>;
  gesammelt: Record<number, number>;
  kontingent: Record<number, number>;
  bereit: Record<number, boolean>;
  wahl: number[];
  waehlbar: number[];
  runde: number;
  letzte: {
    runde: number;
    kaempfe: { platz: number; sieger: number }[];
    genommen: Record<number, number[]>;
    verfallen: Record<number, number[]>;
    ornamente: Record<number, number>;
  } | null;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}

/**
 * Regelsatz, mit dem die Match-Suche einen Tisch aufmacht.
 *
 * Muss zu DEFAULT_REGELN in packages/game-eiland/src/regeln.ts passen. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Die Suche soll nicht auf
 * eine zusaetzliche Antwort warten, bevor sie den Tisch aufmacht.
 */
const REGELSATZ = {
  spalten: 10,
  zeilen: 10,
  seen: 2,
  berge: 4,
  ornamente: 4,
  sichtweite: 3,
  kontingentMax: 6,
};

const GRAS = 0;
const WASSER = 1;
const BERG = 2;

/**
 * Die Farben der beiden Gebiete, in dieser REIHENFOLGE nach Sitznummer.
 *
 * Warm gegen kalt und nicht zwei Bunttoene: Auf einer Karte aus Gruen und Blau
 * muessen die Gebiete auf den ersten Blick vom Gelaende zu unterscheiden sein,
 * und Rot gegen Violett waere daneben nur "irgendeine Farbe mehr".
 */
const GEBIET = ['#e2603f', '#7b4fd0'] as const;

/**
 * Die Graustufen des Nebels.
 *
 * Sie muessen zwei Dinge zugleich: sich untereinander unterscheiden (sonst
 * sieht man das Raster nicht mehr) und sich klar vom Gelaende abheben. Deshalb
 * liegen sie alle im mittleren Band, weit weg von Gruen, Blau und Braun.
 *
 * Die Anzahl muss zu GRAUTOENE in packages/game-eiland/src/partie.ts passen.
 */
const GRAUTOENE = ['#9a9a9a', '#a6a6a6', '#b1b1b1', '#bcbcbc', '#c6c6c6'] as const;

function gebietsfarbe(sitz: number): string {
  return GEBIET[sitz % GEBIET.length] ?? GEBIET[0];
}

export function Eiland({
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
  const [fehler, setFehler] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);

  const tisch = useTable<EilandSicht>(tischId, 'eiland');
  const sicht = tisch.view?.view ?? null;
  /**
   * Der eigene Sitz — als Zuschauer bewusst -1 und nicht 0.
   *
   * Ein Zuschauer sitzt nirgends. Mit 0 bekaeme er "Du bist dran" angezeigt
   * und saehe eine Auswahl, die der Server ihm ohnehin abwiese.
   */
  const eigenerSitz = sicht?.zuschauer ? -1 : (sicht?.ich ?? tisch.view?.seat ?? 0);

  // -------------------------------------------------------------------------
  // Match-Suche
  // -------------------------------------------------------------------------

  /**
   * Einen Gegner finden: an einem offenen Tisch Platz nehmen, sonst selbst
   * einen aufmachen.
   *
   * Wortgleich zu Filler und Mememory, und das ist Absicht — die Plattform hat
   * keine Warteschlange, gesucht wird ueber die gewoehnliche Tischliste. Das
   * reicht, weil `joinTable` serverseitig absichert, dass zwei gleichzeitige
   * Beitritte nicht denselben Platz bekommen: Der Verlierer des Rennens
   * bekommt einen Fehler und sucht weiter.
   */
  const suche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const zeilen = await api.tables('eiland');
      const offen = zeilen
        .filter((zeile) => zeile.seats === 2 && zeile.occupied < zeile.seats)
        .sort((a, b) => a.id.localeCompare(b.id));
      const ziel = offen[0];
      if (ziel) {
        await api.joinTable(ziel.id);
        setEigenerTisch(null);
        setTischId(ziel.id);
        return;
      }
      const { id } = await api.createTable({
        gameId: 'eiland',
        config: REGELSATZ,
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
   * Sofort gegen die KI. Ein eigener Tisch auf Anfrage, den der Server mit
   * einem Bot auffuellt — so kommt niemand hinein, der auf einen Menschen
   * hofft.
   */
  const gegenKi = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const { id } = await api.createTable({
        gameId: 'eiland',
        config: REGELSATZ,
        seats: 2,
        rounds: 1,
        visibility: 'on_request',
        fillWithBots: true,
      });
      setEigenerTisch(null);
      setTischId(id);
    } catch {
      setSucht(false);
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
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
        .tables('eiland')
        .then(async (zeilen: TableRow[]) => {
          if (!lebt || wechseltGerade.current) return;
          const kleiner = zeilen
            .filter((z) => z.seats === 2 && z.occupied < z.seats && z.id < tischId)
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

  /**
   * Zurueck zur Spielauswahl — und dem Server sagen, dass man weg ist.
   *
   * Kein `await`: Zurueck geht es sofort. Ob der Tisch dabei geschlossen wird,
   * entscheidet der Server und nicht der Client.
   */
  const verlasseUndZurueck = useCallback((): void => {
    const id = tischId;
    if (id) void api.leaveTable(id).catch(() => {});
    onBack();
  }, [tischId, onBack]);

  // Auch im Wartebereich weiterzaehlen: Dort steht die Zahl noch einmal, und
  // eine eingefrorene Null waehrend der Suche sieht aus, als suchte man allein.
  useEffect(() => {
    if (sicht) return;
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveSpieler('eiland')
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
  // Ziehen
  // -------------------------------------------------------------------------

  /**
   * Der Tipp, der beim Server noch nicht angekommen ist — samt der Revision,
   * die dabei galt.
   *
   * Er sperrt das Brett, bis die Antwort da ist. Ohne diese Sperre setzt ein
   * zweiter Tipp im selben Moment einen zweiten Zug ab, den der Server als
   * "nicht waehlbar" abweist — und der Spieler sieht einen Fehler fuer etwas,
   * das er richtig gemacht hat.
   */
  const [getippt, setGetippt] = useState<{ platz: number | null; revision: number } | null>(null);
  const revision = tisch.view?.revision ?? -1;
  useEffect(() => {
    setGetippt((alt) => (alt && revision > alt.revision ? null : alt));
  }, [revision]);

  const binDabei = sicht !== null && !sicht.fertig && eigenerSitz >= 0;
  const binBereit = sicht?.bereit[eigenerSitz] === true;
  const darfTippen = binDabei && !binBereit && getippt === null;

  const sende = useCallback(
    (aktion: Record<string, unknown>, platz: number | null): void => {
      if (!darfTippen) return;
      setGetippt({ platz, revision });
      tisch.send(aktion);
    },
    [darfTippen, revision, tisch],
  );

  // -------------------------------------------------------------------------
  // Menue
  // -------------------------------------------------------------------------

  if (!tischId) {
    return (
      <main className="ei-seite ei-menue">
        <button className="ei-zurueck" type="button" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <div className="ei-menue-mitte">
          <h1 className="ei-titel">Eiland</h1>
          <p className="ei-untertitel">
            Nimm Land, sammle Ornamente und komm dem anderen zuvor. Ihr zieht
            gleichzeitig — und wer dasselbe Feld will, muss darum kämpfen.
          </p>
          <div className="ei-probe" aria-hidden="true">
            <span data-art="gras" />
            <span data-art="gras">
              <Ornamentbild art={0} />
            </span>
            <span data-art="wasser" />
            <span data-art="berg" />
            <span data-art="nebel" />
          </div>
          <button className="ei-suchen" type="button" onClick={() => void suche()} disabled={sucht}>
            Online Match suchen…
          </button>
          <button
            className="ei-botknopf"
            type="button"
            onClick={() => void gegenKi()}
            disabled={sucht}
          >
            Gegen die KI spielen
          </button>
          <button className="ei-regelknopf" type="button" onClick={() => setRegelnOffen(true)}>
            So spielt man Eiland
          </button>
          {fehler && <p className="ei-fehler">{fehler}</p>}
          <p className="ei-untertitel ei-klein">{aktiv ?? '…'} Spieler gerade in Eiland</p>
        </div>
        {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Suche laeuft
  // -------------------------------------------------------------------------

  if (!sicht) {
    const besetzt = (tisch.table?.seats ?? []).filter((platz) => platz.accountId).length;
    return (
      <main className="ei-seite ei-menue">
        <button className="ei-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="ei-menue-mitte">
          <h1 className="ei-titel">Suche läuft</h1>
          <p className="ei-untertitel">
            {tisch.status === 'open'
              ? `${besetzt} von ${tisch.table?.seats.length ?? 2} Plätzen besetzt`
              : 'Verbindung wird aufgebaut…'}
          </p>
          <div className="ei-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="ei-untertitel ei-klein">{aktiv ?? '…'} Spieler gerade in Eiland</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Karte
  // -------------------------------------------------------------------------

  return (
    <Karte
      sicht={sicht}
      eigenerSitz={eigenerSitz}
      sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
      getippt={getippt?.platz ?? null}
      darfTippen={darfTippen}
      onWaehle={(platz) => sende({ typ: 'waehlen', platz }, platz)}
      onZurueck={() => sende({ typ: 'zuruecknehmen' }, null)}
      onBereit={() => sende({ typ: 'bereit' }, null)}
      onVerlassen={verlasseUndZurueck}
    />
  );
}

// ---------------------------------------------------------------------------
// Die Karte
// ---------------------------------------------------------------------------

interface SitzZeile {
  seat: number;
  displayName: string | null;
  avatarUrl: string | null;
  isBot: boolean;
}

function Karte({
  sicht,
  eigenerSitz,
  sitze,
  getippt,
  darfTippen,
  onWaehle,
  onZurueck,
  onBereit,
  onVerlassen,
}: {
  sicht: EilandSicht;
  eigenerSitz: number;
  sitze: readonly SitzZeile[];
  getippt: number | null;
  darfTippen: boolean;
  onWaehle: (platz: number) => void;
  onZurueck: () => void;
  onBereit: () => void;
  onVerlassen: () => void;
}): React.JSX.Element {
  const plaetze = sicht.spalten * sicht.zeilen;
  /**
   * Wer spielt, sitzt unten links.
   *
   * Sitz 1 startet in der Ecke oben rechts (startEcke im Modul). Statt die
   * Karte fuer ihn anders zu bauen — was eine Regel im Client waere —, wird sie
   * nur GEDREHT: Platz n von hinten gezaehlt. Eine Drehung um 180 Grad bildet
   * die Ecke oben rechts auf unten links ab, und weil sie Zeilen wie Spalten
   * spiegelt, bleiben alle Nachbarschaften erhalten. Dass die Karte selbst
   * punktsymmetrisch ist, macht die Drehung sogar unsichtbar.
   */
  const gedreht = eigenerSitz === 1;
  const platzVon = (i: number): number => (gedreht ? plaetze - 1 - i : i);

  const gegner = Object.keys(sicht.punkte)
    .map(Number)
    .filter((s) => s !== eigenerSitz);
  const gegnerSitz = gegner[0] ?? (eigenerSitz === 0 ? 1 : 0);

  const waehlbar = useMemo(() => new Set(sicht.waehlbar), [sicht.waehlbar]);
  const gewaehlt = useMemo(() => new Set(sicht.wahl), [sicht.wahl]);
  /**
   * Die Kaempfe der letzten Runde. Sie liegen kurz als Marke auf dem Feld —
   * eine Runde lang, nicht als Zustand mit eigener Uhr: Was in `sicht.letzte`
   * steht, wird mit der naechsten Aufloesung ohnehin ersetzt.
   */
  const kaempfe = useMemo(() => {
    const karte = new Map<number, number>();
    for (const kampf of sicht.letzte?.kaempfe ?? []) karte.set(kampf.platz, kampf.sieger);
    return karte;
  }, [sicht.letzte]);

  const binBereit = sicht.bereit[eigenerSitz] === true;
  const offen = (sicht.kontingent[eigenerSitz] ?? 1) - sicht.wahl.length;
  const zeile = (sitz: number): SitzZeile | undefined => sitze.find((s) => s.seat === sitz);

  return (
    <main className="ei-seite ei-tisch">
      <div className="ei-kopf">
        <button
          className="ei-zurueck ei-zurueck-tisch"
          type="button"
          onClick={onVerlassen}
          aria-label="Zurück"
        >
          ←
        </button>
        <div className="ei-stand">
          <Spielerstand
            sitz={eigenerSitz}
            zeile={zeile(eigenerSitz)}
            sicht={sicht}
            eigen
          />
          <span className="ei-runde">
            Runde
            <strong>{sicht.runde}</strong>
          </span>
          <Spielerstand sitz={gegnerSitz} zeile={zeile(gegnerSitz)} sicht={sicht} />
        </div>
      </div>

      <div className="ei-karte-huelle">
        <div className="ei-karte" style={{ gridTemplateColumns: `repeat(${sicht.spalten}, 1fr)` }}>
          {Array.from({ length: plaetze }, (_, i) => {
            const platz = platzVon(i);
            const art = sicht.gelaende[platz];
            const besitzer = sicht.besitzer[platz];
            /*
             * `null` heisst Nebel und wird grau gezeichnet. Der Client kennt
             * das Gelaende dahinter GAR NICHT — es gibt hier nichts
             * auszublenden, und genau deshalb hilft die Entwicklerkonsole
             * niemandem.
             */
            const imNebel = art === null || art === undefined;
            const kannWaehlen = darfTippen && waehlbar.has(platz);
            const mein = gewaehlt.has(platz);
            const kampf = kaempfe.get(platz);
            return (
              <button
                key={platz}
                type="button"
                className="ei-feld"
                // Ein Feld, das man nicht waehlen kann, ist keine Schaltflaeche
                // fuer die Tastatur — aber es bleibt sichtbar und lesbar.
                disabled={!kannWaehlen}
                data-art={imNebel ? 'nebel' : art === WASSER ? 'wasser' : art === BERG ? 'berg' : 'gras'}
                data-eigen={besitzer === eigenerSitz ? '' : undefined}
                data-fremd={besitzer !== null && besitzer !== eigenerSitz ? '' : undefined}
                data-waehlbar={kannWaehlen ? '' : undefined}
                data-gewaehlt={mein ? '' : undefined}
                data-getippt={getippt === platz ? '' : undefined}
                data-kampf={kampf === undefined ? undefined : kampf === eigenerSitz ? 'sieg' : 'verlust'}
                style={{
                  background: imNebel
                    ? (GRAUTOENE[sicht.grau[platz] ?? 0] ?? GRAUTOENE[0])
                    : besitzer !== null
                      ? gebietsfarbe(besitzer)
                      : undefined,
                }}
                onClick={() => onWaehle(platz)}
                aria-label={feldName(art ?? null, besitzer ?? null, eigenerSitz, sicht.ornament[platz] ?? null)}
              >
                {sicht.ornament[platz] !== null && sicht.ornament[platz] !== undefined && (
                  <Ornamentbild art={sicht.ornament[platz]!} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="ei-fuss">
        {sicht.fertig ? (
          <Abschluss
            sicht={sicht}
            eigenerSitz={eigenerSitz}
            gegnerSitz={gegnerSitz}
            onZurueck={onVerlassen}
          />
        ) : binBereit ? (
          <>
            <p className="ei-hinweis ei-wartet">Warten auf den Gegner…</p>
            <p className="ei-klein">Dein Zug steht. Gleich wird aufgelöst.</p>
          </>
        ) : (
          <>
            <p className="ei-hinweis">
              {offen > 0 ? `Noch ${offen} ${offen === 1 ? 'Feld' : 'Felder'}` : 'Zug steht'}
            </p>
            <div className="ei-knoepfe">
              <button
                type="button"
                className="ei-knopf"
                disabled={!darfTippen || sicht.wahl.length === 0}
                onClick={onZurueck}
              >
                Zurücknehmen
              </button>
              <button
                type="button"
                className="ei-knopf ei-knopf-stark"
                disabled={!darfTippen}
                onClick={onBereit}
              >
                Fertig
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/** Beschreibung fuer Vorlesegeraete. Die Karte ist sonst eine Wand aus Knoepfen. */
function feldName(
  art: number | null,
  besitzer: number | null,
  eigenerSitz: number,
  ornament: number | null,
): string {
  if (art === null) return 'Unbekanntes Feld';
  const grund = art === WASSER ? 'Wasser' : art === BERG ? 'Berg' : 'Wiese';
  const wem =
    besitzer === null ? 'frei' : besitzer === eigenerSitz ? 'dein Gebiet' : 'gegnerisches Gebiet';
  const zier = ornament === null ? '' : ornament === 0 ? ', Stadt' : ', Brunnen';
  return `${grund}, ${wem}${zier}`;
}

/**
 * Stadt und Brunnen, gezeichnet statt geladen.
 *
 * Es gibt fuer dieses Spiel noch keine Bilder, und ein `<img>` auf eine Datei,
 * die es nicht gibt, ist ein weisser Kasten — der sieht nach Fehler aus, ein
 * gezeichnetes Zeichen nach Absicht (siehe CLAUDE.md). Zwei Pfade in einem
 * SVG kosten nichts und skalieren mit dem Feld.
 */
function Ornamentbild({ art }: { art: number }): React.JSX.Element {
  return (
    <svg className="ei-ornament" viewBox="0 0 24 24" aria-hidden="true">
      {art === 0 ? (
        <>
          {/* Stadt: drei Haeuser mit Giebel. */}
          <path d="M3 21V12l4-3 4 3v9z" />
          <path d="M13 21V8l4-3 4 3v13z" />
        </>
      ) : (
        <>
          {/* Brunnen: Dach, Pfosten, Schacht. */}
          <path d="M4 8 12 3l8 5z" />
          <path d="M7 10h2v11H7zM15 10h2v11h-2z" />
          <path d="M9 15h6v6H9z" />
        </>
      )}
    </svg>
  );
}

/**
 * Punktestand eines Sitzes: Bild, Felder, Kontingent.
 *
 * Die Zahl steht in der GEBIETSFARBE des Spielers. Das ist keine Deko: Sie ist
 * die einzige Stelle, an der man seine Farbe sieht, wenn das eigene Gebiet
 * gerade vom Daumen verdeckt wird. Darunter steht, wie viele Felder er je
 * Runde nimmt — die Auskunft, die sagt, wie schnell er gerade waechst.
 */
function Spielerstand({
  sitz,
  zeile,
  sicht,
  eigen,
}: {
  sitz: number;
  zeile: SitzZeile | undefined;
  sicht: EilandSicht;
  eigen?: boolean;
}): React.JSX.Element {
  const name = eigen ? 'Du' : (zeile?.displayName ?? (zeile?.isBot ? 'KI' : 'Gegner'));
  const bereit = sicht.bereit[sitz] === true && !sicht.fertig;
  return (
    <div className="ei-spieler" data-eigen={eigen ? '' : undefined} data-bereit={bereit ? '' : undefined}>
      <span className="ei-avatar">
        {/* Kein <img> auf eine Datei, die es nicht gibt: Ohne Bild steht der
            Anfangsbuchstabe da. Ein weisser Kasten saehe nach Fehler aus. */}
        {zeile?.avatarUrl ? (
          <img src={zeile.avatarUrl} alt="" draggable={false} />
        ) : (
          <strong>{(name[0] ?? '?').toUpperCase()}</strong>
        )}
      </span>
      <span className="ei-zahlen">
        <span className="ei-punkte" style={{ background: gebietsfarbe(sitz) }}>
          {sicht.punkte[sitz] ?? 0}
        </span>
        <span className="ei-tempo">
          {sicht.kontingent[sitz] ?? 1}/Runde
          {(sicht.gesammelt[sitz] ?? 0) > 0 ? ` · ${sicht.gesammelt[sitz]} ⌂` : ''}
        </span>
      </span>
    </div>
  );
}

function Abschluss({
  sicht,
  eigenerSitz,
  gegnerSitz,
  onZurueck,
}: {
  sicht: EilandSicht;
  eigenerSitz: number;
  gegnerSitz: number;
  onZurueck: () => void;
}): React.JSX.Element {
  const meine = sicht.punkte[eigenerSitz] ?? 0;
  const seine = sicht.punkte[gegnerSitz] ?? 0;
  const wort =
    sicht.sieger === null ? 'Unentschieden' : sicht.sieger === eigenerSitz ? 'Gewonnen!' : 'Verloren';
  return (
    <div className="ei-abschluss">
      <h2 data-sieg={sicht.sieger === eigenerSitz ? '' : undefined}>{wort}</h2>
      <p>
        {meine} zu {seine} Feldern
      </p>
      <button className="ei-suchen" type="button" onClick={onZurueck}>
        Zurück
      </button>
    </div>
  );
}

/**
 * Das Regelblatt.
 *
 * Es erklaert vier Dinge, die man dem Brett nicht ansieht: dass gleichzeitig
 * gezogen wird, was bei einem Streitfeld passiert, was Ornamente bringen und
 * wie weit man sieht. Ohne den letzten Punkt haelt der erste Spieler den Nebel
 * fuer einen Fehler.
 */
function Regelblatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="ei-blatt" role="dialog" aria-label="So spielt man Eiland">
      <button className="ei-blatt-zu" type="button" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <h2>So spielt man Eiland</h2>
      <h3>Regeln</h3>
      <ol>
        <li>Jeder startet mit einem Feld in seiner Ecke der Insel.</li>
        <li>
          Pro Runde nimmst du ein freies Wiesenfeld, das an dein Gebiet grenzt —
          und ein Feld mehr für jedes Ornament, das du eingesammelt hast.
        </li>
        <li>
          Wasser und Berge gehören niemandem. Gegnerisches Gebiet kannst du
          nicht nehmen: Dort ist deine Grenze.
        </li>
        <li>
          Ihr wählt <strong>gleichzeitig</strong>, ohne die Wahl des anderen zu
          sehen. Wollen beide dasselbe Feld, wird darum gekämpft — der Ausgang
          steht fünfzig zu fünfzig. Wer verliert, kommt an dieser Stelle nicht
          weiter; Felder dahinter bleiben frei.
        </li>
        <li>Die Partie endet, wenn keiner mehr irgendwohin kann.</li>
      </ol>
      <h3>Ornamente</h3>
      <p>
        Städte und Brunnen liegen verstreut auf der Insel. Wer das Feld nimmt,
        auf dem eines steht, nimmt von da an ein Feld mehr pro Runde. Es liegen
        immer vier auf der Karte — für jedes eingesammelte rückt eines nach.
      </p>
      <h3>Der Nebel</h3>
      <p>
        Du siehst dein Gebiet und drei Felder darüber hinaus. Alles andere liegt
        grau im Nebel — auch für den Gegner.
      </p>
      <h3>Ziel</h3>
      <p>Wer am Ende die meisten Felder hält, gewinnt.</p>
    </div>
  );
}
