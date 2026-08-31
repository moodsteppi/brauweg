import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type TableRow } from '../api';
import { useTable } from '../useTable';

/**
 * Filler — Flaechenduell zu zweit, im Nebel.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie bei Mememory: ohne Tisch das
 * Hauptmenue mit der Match-Suche, mit Tisch das Brett. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Match-Suche muss den Tisch
 * unter Umstaenden wechseln (siehe die Wettrennen-Regel unten), und ein
 * Wechsel ueber zwei Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul: Der Bildschirm bildet KEINE Regel nach.
 * Welche Farben waehlbar sind, steht nicht hier, sondern kommt als
 * `sicht.farbe` vom Server — und was ein Feld traegt, weiss er nur, wenn die
 * Sicht es hergibt. Ein `null` in `sicht.feld` ist Nebel und wird grau
 * gezeichnet; der Client kennt die Farbe dahinter gar nicht.
 */

/** Sicht des Moduls, siehe packages/game-filler/src/sicht.ts. */
interface FillerSicht {
  ich: number | null;
  spalten: number;
  zeilen: number;
  farbzahl: number;
  /** Farbnummer je Platz, oder null solange das Feld im Nebel liegt. */
  feld: (number | null)[];
  /** Grauton je Platz — nur Zeichnung, verraet nichts. */
  grau: number[];
  besitzer: (number | null)[];
  farbe: Record<number, number>;
  punkte: Record<number, number>;
  dran: number;
  zug: number;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}

/**
 * Regelsatz, mit dem die Match-Suche einen Tisch aufmacht.
 *
 * Muss zu DEFAULT_REGELN in packages/game-filler/src/regeln.ts passen. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Die Suche soll nicht auf
 * eine zusaetzliche Antwort warten, bevor sie den Tisch aufmacht.
 */
const REGELSATZ = { spalten: 8, zeilen: 7, farben: 6 };

/**
 * Die sechs Farben des Vorbilds, in dieser REIHENFOLGE.
 *
 * Die Reihenfolge ist Protokoll: Ueber die Leitung geht nur die Nummer. Wer
 * hier etwas einschiebt, faerbt jede laufende Partie um — und zwar auf beiden
 * Geraeten verschieden, solange nur eines neu geladen hat.
 */
const FARBEN = [
  '#f5325a', // 0 Rot
  '#92d84e', // 1 Gruen
  '#fed42a', // 2 Gelb
  '#35b4f0', // 3 Blau
  '#6b4fb5', // 4 Lila
  '#3c3c3c', // 5 Dunkelgrau
] as const;

/**
 * Farben, auf denen weisse Schrift nicht mehr lesbar ist.
 *
 * Ausgezaehlt und nicht gerechnet: Es sind sechs feste Werte, und eine
 * Helligkeitsformel im Client waere eine Zeile, die bei jedem Rendern dasselbe
 * Ergebnis ausrechnet.
 */
const DUNKLE_SCHRIFT = new Set([1, 2]);

/**
 * Die Graustufen des Nebels.
 *
 * Sie muessen zwei Dinge zugleich: sich untereinander unterscheiden (sonst
 * saehe man das Raster nicht mehr) und sich klar vom dunklen Spielgrau
 * abheben (sonst haelt man ein verdecktes Feld fuer ein besetztes). Deshalb
 * liegen sie alle im mittleren Band — dunkler als der Hintergrund, viel
 * heller als `#3c3c3c`.
 *
 * Die Anzahl muss zu GRAUTOENE in packages/game-filler/src/partie.ts passen.
 */
const GRAUTOENE = ['#949494', '#a3a3a3', '#b2b2b2', '#c0c0c0', '#cbcbcb'] as const;

function farbeVon(nr: number): string {
  return FARBEN[nr] ?? FARBEN[0];
}

export function Filler({
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

  const tisch = useTable<FillerSicht>(tischId, 'filler');
  const sicht = tisch.view?.view ?? null;
  /**
   * Der eigene Sitz — als Zuschauer bewusst -1 und nicht 0.
   *
   * Ein Zuschauer sitzt nirgends. Mit 0 bekaeme er "Du bist dran" angezeigt
   * und saehe eine Farbauswahl, die der Server ihm ohnehin abwiese.
   */
  const eigenerSitz = sicht?.zuschauer ? -1 : (sicht?.ich ?? tisch.view?.seat ?? 0);

  // -------------------------------------------------------------------------
  // Match-Suche
  // -------------------------------------------------------------------------

  /**
   * Einen Gegner finden: an einem offenen Tisch Platz nehmen, sonst selbst
   * einen aufmachen.
   *
   * Wortgleich zu Mememory, und das ist Absicht — die Plattform hat keine
   * Warteschlange, gesucht wird ueber die gewoehnliche Tischliste. Das reicht,
   * weil `joinTable` serverseitig absichert, dass zwei gleichzeitige Beitritte
   * nicht denselben Platz bekommen: Der Verlierer des Rennens bekommt einen
   * Fehler und sucht weiter.
   */
  const suche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const zeilen = await api.tables('filler');
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
        gameId: 'filler',
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
        .tables('filler')
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
        .aktiveSpieler('filler')
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
   * Die Farbe, die ich gerade angetippt habe — samt der Revision, die dabei
   * galt.
   *
   * Sie sperrt die Auswahl, bis der Server geantwortet hat. Ohne diese Sperre
   * setzt ein zweiter Tipp im selben Moment einen zweiten Zug ab, den der
   * Server als "nicht am Zug" abweist — und der Spieler sieht einen Fehler
   * fuer etwas, das er richtig gemacht hat.
   */
  const [getippt, setGetippt] = useState<{ farbe: number; revision: number } | null>(null);
  const revision = tisch.view?.revision ?? -1;
  useEffect(() => {
    setGetippt((alt) => (alt && revision > alt.revision ? null : alt));
  }, [revision]);

  const binDran = sicht !== null && !sicht.fertig && sicht.dran === eigenerSitz && eigenerSitz >= 0;

  const waehle = useCallback(
    (farbe: number): void => {
      if (!binDran || getippt) return;
      setGetippt({ farbe, revision });
      tisch.send({ typ: 'faerben', farbe });
    },
    [binDran, getippt, revision, tisch],
  );

  // -------------------------------------------------------------------------
  // Menue
  // -------------------------------------------------------------------------

  if (!tischId) {
    return (
      <main className="fl-seite fl-menue">
        <button className="fl-zurueck" type="button" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <div className="fl-menue-mitte">
          <h1 className="fl-titel">Filler</h1>
          <p className="fl-untertitel">
            Färbe dein Gebiet um und schlucke, was daran grenzt. Nur: Du siehst
            nur deine eigenen Felder und deren Nachbarn — der Rest liegt im Nebel.
          </p>
          <div className="fl-probe" aria-hidden="true">
            {FARBEN.map((farbe, i) => (
              <span key={i} style={{ background: farbe }} />
            ))}
          </div>
          <button className="fl-suchen" type="button" onClick={() => void suche()} disabled={sucht}>
            Online Match suchen…
          </button>
          <button className="fl-regelknopf" type="button" onClick={() => setRegelnOffen(true)}>
            So spielt man Filler
          </button>
          {fehler && <p className="fl-fehler">{fehler}</p>}
          <p className="fl-untertitel fl-klein">{aktiv ?? '…'} Spieler gerade in Filler</p>
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
      <main className="fl-seite fl-menue">
        <button className="fl-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="fl-menue-mitte">
          <h1 className="fl-titel">Suche läuft</h1>
          <p className="fl-untertitel">
            {tisch.status === 'open'
              ? `${besetzt} von ${tisch.table?.seats.length ?? 2} Plätzen besetzt`
              : 'Verbindung wird aufgebaut…'}
          </p>
          <div className="fl-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="fl-untertitel fl-klein">{aktiv ?? '…'} Spieler gerade in Filler</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Brett
  // -------------------------------------------------------------------------

  return (
    <Brett
      sicht={sicht}
      eigenerSitz={eigenerSitz}
      sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
      binDran={binDran}
      getippt={getippt?.farbe ?? null}
      onWaehle={waehle}
      onZurueck={verlasseUndZurueck}
    />
  );
}

// ---------------------------------------------------------------------------
// Das Brett
// ---------------------------------------------------------------------------

interface SitzZeile {
  seat: number;
  displayName: string | null;
  avatarUrl: string | null;
  isBot: boolean;
}

function Brett({
  sicht,
  eigenerSitz,
  sitze,
  binDran,
  getippt,
  onWaehle,
  onZurueck,
}: {
  sicht: FillerSicht;
  eigenerSitz: number;
  sitze: readonly SitzZeile[];
  binDran: boolean;
  getippt: number | null;
  onWaehle: (farbe: number) => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const plaetze = sicht.spalten * sicht.zeilen;
  /**
   * Wer spielt, sitzt unten links.
   *
   * Sitz 1 startet in der Ecke oben rechts (startEcke im Modul). Statt das
   * Brett fuer ihn anders zu bauen — was eine Regel im Client waere —, wird es
   * nur GEDREHT: Platz n von hinten gezaehlt. Eine Drehung um 180 Grad bildet
   * die Ecke oben rechts auf unten links ab, und weil sie sowohl Zeilen als
   * auch Spalten spiegelt, bleiben alle Nachbarschaften erhalten.
   */
  const gedreht = eigenerSitz === 1;
  const platzVon = (i: number): number => (gedreht ? plaetze - 1 - i : i);

  const gegner = Object.keys(sicht.punkte)
    .map(Number)
    .filter((s) => s !== eigenerSitz);
  const gegnerSitz = gegner[0] ?? (eigenerSitz === 0 ? 1 : 0);

  const gesperrt = new Set(Object.values(sicht.farbe));

  const zeile = (sitz: number): SitzZeile | undefined => sitze.find((s) => s.seat === sitz);

  return (
    <main className="fl-seite fl-tisch">
      <div className="fl-kopf">
        <button className="fl-zurueck fl-zurueck-tisch" type="button" onClick={onZurueck} aria-label="Zurück">
          ←
        </button>
        <div className="fl-stand">
          <Spielerstand
            sitz={eigenerSitz}
            zeile={zeile(eigenerSitz)}
            punkte={sicht.punkte[eigenerSitz] ?? 0}
            farbe={sicht.farbe[eigenerSitz] ?? 0}
            eigen
            aktiv={!sicht.fertig && sicht.dran === eigenerSitz}
          />
          <Spielerstand
            sitz={gegnerSitz}
            zeile={zeile(gegnerSitz)}
            punkte={sicht.punkte[gegnerSitz] ?? 0}
            farbe={sicht.farbe[gegnerSitz] ?? 0}
            aktiv={!sicht.fertig && sicht.dran === gegnerSitz}
          />
        </div>
      </div>

      <div className="fl-brett-huelle">
        <div
          className="fl-brett"
          style={{ gridTemplateColumns: `repeat(${sicht.spalten}, 1fr)` }}
        >
          {Array.from({ length: plaetze }, (_, i) => {
            const platz = platzVon(i);
            const farbe = sicht.feld[platz];
            const besitzer = sicht.besitzer[platz];
            /*
             * `null` heisst Nebel und wird grau gezeichnet. Der Client kennt
             * die Farbe dahinter GAR NICHT — es gibt hier nichts auszublenden,
             * und genau deshalb hilft die Entwicklerkonsole niemandem.
             */
            const imNebel = farbe === null || farbe === undefined;
            return (
              <span
                key={platz}
                className="fl-feld"
                data-nebel={imNebel ? '' : undefined}
                data-eigen={besitzer === eigenerSitz ? '' : undefined}
                data-fremd={besitzer !== null && besitzer !== eigenerSitz ? '' : undefined}
                style={{
                  background: imNebel
                    ? (GRAUTOENE[sicht.grau[platz] ?? 0] ?? GRAUTOENE[0])
                    : farbeVon(farbe),
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="fl-fuss">
        {sicht.fertig ? (
          <Abschluss
            sicht={sicht}
            eigenerSitz={eigenerSitz}
            gegnerSitz={gegnerSitz}
            onZurueck={onZurueck}
          />
        ) : binDran ? (
          <>
            <div className="fl-palette">
              {Array.from({ length: sicht.farbzahl }, (_, nr) => (
                <button
                  key={nr}
                  type="button"
                  className="fl-farbe"
                  // Gesperrt sind die beiden Gebietsfarben. Die Regel steht
                  // NICHT hier — sie kommt als `sicht.farbe` vom Server, der
                  // sie beim Zug ohnehin ein zweites Mal prueft.
                  data-gesperrt={gesperrt.has(nr) ? '' : undefined}
                  data-getippt={getippt === nr ? '' : undefined}
                  disabled={gesperrt.has(nr) || getippt !== null}
                  style={{ background: farbeVon(nr) }}
                  onClick={() => onWaehle(nr)}
                  aria-label={`Farbe ${nr + 1}`}
                />
              ))}
            </div>
            <p className="fl-hinweis">Farbe wählen</p>
          </>
        ) : (
          <>
            <div className="fl-palette fl-palette-ruht" aria-hidden="true">
              {Array.from({ length: sicht.farbzahl }, (_, nr) => (
                <span key={nr} className="fl-farbe" style={{ background: farbeVon(nr) }} />
              ))}
            </div>
            <p className="fl-hinweis fl-wartet">Warten auf Gegner…</p>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * Punktestand eines Sitzes: Bild, Zahl, Farbe.
 *
 * Die Zahl steht in der GEBIETSFARBE des Spielers — so wie im Vorbild. Das
 * ist keine Deko: Es ist die einzige Stelle, an der man die eigene Farbe
 * sieht, wenn das eigene Gebiet gerade vom Daumen verdeckt wird.
 */
function Spielerstand({
  zeile,
  punkte,
  farbe,
  eigen,
  aktiv,
}: {
  sitz: number;
  zeile: SitzZeile | undefined;
  punkte: number;
  farbe: number;
  eigen?: boolean;
  aktiv: boolean;
}): React.JSX.Element {
  const name = eigen ? 'Du' : (zeile?.displayName ?? (zeile?.isBot ? 'KI' : 'Gegner'));
  return (
    <div className="fl-spieler" data-eigen={eigen ? '' : undefined} data-aktiv={aktiv ? '' : undefined}>
      <span className="fl-avatar">
        {/* Kein <img> auf eine Datei, die es nicht gibt: Ohne Bild steht der
            Anfangsbuchstabe da. Ein weisser Kasten saehe nach Fehler aus. */}
        {zeile?.avatarUrl ? (
          <img src={zeile.avatarUrl} alt="" draggable={false} />
        ) : (
          <strong>{(name[0] ?? '?').toUpperCase()}</strong>
        )}
      </span>
      <span
        className="fl-punkte"
        style={{
          background: farbeVon(farbe),
          color: DUNKLE_SCHRIFT.has(farbe) ? '#1d1d1d' : '#ffffff',
        }}
      >
        {punkte}
      </span>
      <span className="fl-name">{name}</span>
    </div>
  );
}

function Abschluss({
  sicht,
  eigenerSitz,
  gegnerSitz,
  onZurueck,
}: {
  sicht: FillerSicht;
  eigenerSitz: number;
  gegnerSitz: number;
  onZurueck: () => void;
}): React.JSX.Element {
  const meine = sicht.punkte[eigenerSitz] ?? 0;
  const seine = sicht.punkte[gegnerSitz] ?? 0;
  const wort =
    sicht.sieger === null ? 'Unentschieden' : sicht.sieger === eigenerSitz ? 'Gewonnen!' : 'Verloren';
  return (
    <div className="fl-abschluss">
      <h2 data-sieg={sicht.sieger === eigenerSitz ? '' : undefined}>{wort}</h2>
      <p>
        {meine} zu {seine} Feldern
      </p>
      <button className="fl-suchen" type="button" onClick={onZurueck}>
        Zurück
      </button>
    </div>
  );
}

/**
 * Das Regelblatt.
 *
 * Wortlaut nach dem Vorbild, plus die eine Zeile, die dieses Spiel davon
 * unterscheidet — sonst haelt der erste Spieler den Nebel fuer einen Fehler.
 */
function Regelblatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="fl-blatt" role="dialog" aria-label="So spielt man Filler">
      <button className="fl-blatt-zu" type="button" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <h2>So spielt man Filler</h2>
      <h3>Regeln</h3>
      <ol>
        <li>Jeder Spieler bekommt zu Beginn ein Eckfeld.</li>
        <li>
          Abwechselnd färbt man sein Gebiet in eine von sechs Farben und nimmt
          dabei alle angrenzenden Felder dieser Farbe mit.
        </li>
        <li>Die Farbe des Gegners darf man nicht wählen.</li>
        <li>Die Partie endet, wenn kein Feld mehr frei ist.</li>
      </ol>
      <h3>Der Unterschied</h3>
      <p>
        Du siehst nur dein eigenes Gebiet und die Felder, die direkt daran
        grenzen. Alles andere liegt grau im Nebel — auch für den Gegner.
      </p>
      <h3>Ziel</h3>
      <p>Wer am Ende die meisten Felder hält, gewinnt.</p>
    </div>
  );
}
