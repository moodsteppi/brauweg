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
  /** Spielart dieses Tisches. Der Kopf des Bretts schreibt sie hin. */
  variante: Variante;
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
  /** Gesetzte Barrieren als Plaetzepaare. Leer ausser in der Spielart `build`. */
  barrieren: [number, number][];
  /** Wie viele Barrieren jedem Sitz noch bleiben. */
  barrierenUebrig: Record<number, number>;
  /**
   * Wohin ich gerade eine Barriere setzen darf. Fehlt, wenn ich nicht am Zug
   * bin oder keine mehr habe.
   *
   * Kommt fertig vom Server, weil die Einsperr-Regel eine REGEL ist — der
   * Client baut sie nicht nach (CLAUDE.md).
   */
  barrierenMoeglich?: [number, number][];
}

/**
 * Regelsatz, mit dem die Match-Suche einen Tisch aufmacht.
 *
 * Muss zu DEFAULT_REGELN in packages/game-filler/src/regeln.ts passen. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Die Suche soll nicht auf
 * eine zusaetzliche Antwort warten, bevor sie den Tisch aufmacht.
 */
const REGELSATZ = { spalten: 8, zeilen: 7, farben: 6, barrieren: 5 };

/**
 * Die beiden Spielarten. Muss zu FillerVariante in
 * packages/game-filler/src/regeln.ts passen.
 */
type Variante = 'nebel' | 'klar' | 'build';

const VARIANTE_NAME: Record<Variante, string> = {
  nebel: 'Nebel',
  klar: 'Normal',
  build: 'Build',
};

const VARIANTE_TEXT: Record<Variante, string> = {
  nebel: 'Du siehst nur dein Gebiet und dessen Rand.',
  klar: 'Das ganze Brett liegt offen — wie im Original.',
  build: 'Offenes Brett, dazu fünf Mauern je Spieler. Eine Mauer kostet einen Zug.',
};

/**
 * Die zuletzt gewaehlte Spielart ueberlebt das Schliessen.
 *
 * Wer einmal offen spielen wollte, will es beim naechsten Mal meistens wieder
 * — und muesste den Schalter sonst jedes Mal neu suchen. Im Browser des
 * Spielers, nicht auf dem Server: Es ist eine Bequemlichkeit und kein Besitz.
 */
const VARIANTE_SCHLUESSEL = 'filler.variante';

function istVariante(wert: unknown): wert is Variante {
  return wert === 'nebel' || wert === 'klar' || wert === 'build';
}

function gelesenevariante(): Variante {
  try {
    const wert = localStorage.getItem(VARIANTE_SCHLUESSEL);
    return istVariante(wert) ? wert : 'nebel';
  } catch {
    // Privates Fenster, gesperrte Seitendaten: Dann eben die Vorgabe.
    return 'nebel';
  }
}

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

/**
 * Passt ein Tisch aus der Liste zur gesuchten Spielart?
 *
 * `null` heisst: Der Tisch nennt keine — er stammt vom 31. August, als es nur
 * den Nebel gab. Solche Tische zaehlen deshalb als Nebeltische und nicht als
 * "passt zu allem": Wer offen spielen will, soll dort nicht landen.
 */
function passt(tischArt: string | null, gesucht: Variante): boolean {
  return (tischArt ?? 'nebel') === gesucht;
}

/** Kantenschluessel wie im Modul: kleinerer Platz zuerst. */
function kante(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Die vier Seiten eines Feldes, in der Reihenfolge oben, rechts, unten, links. */
const SEITEN = ['oben', 'rechts', 'unten', 'links'] as const;
type Seite = (typeof SEITEN)[number];

function nachbarAn(
  platz: number,
  seite: Seite,
  spalten: number,
  zeilen: number,
): number | null {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  if (seite === 'oben') return y > 0 ? platz - spalten : null;
  if (seite === 'unten') return y < zeilen - 1 ? platz + spalten : null;
  if (seite === 'links') return x > 0 ? platz - 1 : null;
  return x < spalten - 1 ? platz + 1 : null;
}

/** Die Innenschatten-Kante fuer eine Seite. Dicke in Pixeln. */
const KANTENSCHATTEN: Record<Seite, (dick: number, farbe: string) => string> = {
  oben: (d, f) => `inset 0 ${d}px 0 ${f}`,
  unten: (d, f) => `inset 0 -${d}px 0 ${f}`,
  links: (d, f) => `inset ${d}px 0 0 ${f}`,
  rechts: (d, f) => `inset -${d}px 0 0 ${f}`,
};

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
  /**
   * Die Spielart, mit der gesucht wird.
   *
   * Sie ist eine Vorwahl fuer den naechsten Tisch und NICHT der Zustand des
   * laufenden: Was am Tisch gilt, steht in `sicht.variante` und kommt vom
   * Server. Wer das verwechselt, baut einen Schalter, der mitten in der Partie
   * den Nebel abzuschalten scheint und nichts tut.
   */
  const [variante, setVariante] = useState<Variante>(gelesenevariante);

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
        .filter((zeile) => passt(zeile.variante, variante))
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
        config: { ...REGELSATZ, variante },
        seats: 2,
        rounds: 1,
      });
      setEigenerTisch(id);
      setTischId(id);
    } catch {
      setSucht(false);
      setFehler('Die Suche ist fehlgeschlagen. Noch einmal versuchen?');
    }
  }, [variante]);

  /**
   * Einen Tisch gegen den Computer aufmachen.
   *
   * `fillWithBots` besetzt den freien Platz; `on_request` haelt den Tisch aus
   * der Lobbyliste heraus. Beides wie bei Mememory und Easy Poker, und aus
   * demselben Grund: Ein Bot-Tisch in der oeffentlichen Liste faengt genau die
   * Leute ab, die gerade einen Menschen suchen.
   */
  const starteBot = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const { id } = await api.createTable({
        gameId: 'filler',
        config: { ...REGELSATZ, variante },
        seats: 2,
        rounds: 1,
        visibility: 'on_request',
        fillWithBots: true,
      });
      setEigenerTisch(null);
      setTischId(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setSucht(false);
    }
  }, [variante]);

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
            // Nur in den EIGENEN Topf wechseln: Ein Nebeltisch ist keine
            // Loesung fuer jemanden, der offen spielen wollte.
            .filter((z) => passt(z.variante, variante))
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
  }, [tischId, eigenerTisch, tisch.table?.status, variante]);

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

  /**
   * Eine Mauer setzen.
   *
   * Dieselbe Sperre wie beim Faerben: Bis der Server geantwortet hat, geht
   * kein zweiter Zug raus. `getippt` traegt dafuer die -1 — es gibt keine
   * Farbe mit dieser Nummer, also kann die Palette sie nie hervorheben, und
   * die Sperre gilt trotzdem.
   */
  const setzeBarriere = useCallback(
    (von: number, nach: number): void => {
      if (!binDran || getippt) return;
      setGetippt({ farbe: -1, revision });
      tisch.send({ typ: 'barriere', von, nach });
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
          {/*
            * Der Schalter steht ÜBER den beiden Knoepfen und nicht darunter:
            * Er entscheidet, WAS die Knoepfe aufmachen. Wer ihn erst nach dem
            * Tippen sieht, hat ihn zu spaet gesehen.
            */}
          <Spielartschalter wert={variante} onWahl={setVariante} />
          <button className="fl-suchen" type="button" onClick={() => void suche()} disabled={sucht}>
            Online Match suchen…
          </button>
          {/* Ruhiger gefaerbt als die Match-Suche: Der Mensch bleibt das
              Angebot, gegen das man zuerst spielt. Dieselbe Staffelung wie
              bei Mememory. */}
          <button className="fl-botknopf" type="button" onClick={() => void starteBot()} disabled={sucht}>
            Gegen Bot spielen
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
          <p className="fl-untertitel fl-klein">
            {aktiv ?? '…'} Spieler gerade in Filler · Spielart {VARIANTE_NAME[variante]}
          </p>
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
      gegenBot={(tisch.table?.seats ?? []).some((platz) => platz.isBot)}
      getippt={getippt?.farbe ?? null}
      onWaehle={waehle}
      onBarriere={setzeBarriere}
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
  gegenBot,
  getippt,
  onWaehle,
  onBarriere,
  onZurueck,
}: {
  sicht: FillerSicht;
  eigenerSitz: number;
  sitze: readonly SitzZeile[];
  binDran: boolean;
  /** Am Tisch sitzt ein Bot. Der Wartetext heisst dann anders. */
  gegenBot: boolean;
  getippt: number | null;
  onWaehle: (farbe: number) => void;
  onBarriere: (von: number, nach: number) => void;
  onZurueck: () => void;
}): React.JSX.Element {
  /**
   * Der Bau-Knopf ist gedrueckt: Die Setzflaechen liegen ueber dem Brett.
   *
   * Ein Zustand und kein Dauerzustand — nach dem Setzen faellt er von selbst
   * zurueck (siehe unten). Ohne diesen Schalter laegen 97 Schaltflaechen
   * dauerhaft ueber dem Brett, und ein Daumen, der eine Farbe waehlen will,
   * traefe staendig eine Kante.
   */
  const [baut, setBaut] = useState(false);
  const meineBarrieren = sicht.barrierenUebrig[eigenerSitz] ?? 0;
  // Sobald ich nicht mehr dran bin oder nichts mehr habe, ist der Bau vorbei.
  useEffect(() => {
    if (!binDran || meineBarrieren <= 0) setBaut(false);
  }, [binDran, meineBarrieren]);

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
  /**
   * Umkehrung: Wo auf dem Bildschirm liegt Platz n?
   *
   * Bei einer Drehung um 180 Grad ist die Umkehrung dieselbe Rechnung. Sie
   * steht trotzdem unter eigenem Namen da: Die Waende brauchen die Richtung
   * Platz -> Bildschirm, und `platzVon` an dieser Stelle zu lesen hiesse,
   * sich jedes Mal neu zu ueberlegen, warum das gutgeht.
   */
  const anzeigeIndex = (platz: number): number => (gedreht ? plaetze - 1 - platz : platz);
  /** Setzflaechen zeigen, solange der Bau-Knopf gedrueckt ist. */
  const bautGerade = baut && (sicht.barrierenMoeglich?.length ?? 0) > 0;

  const gegner = Object.keys(sicht.punkte)
    .map(Number)
    .filter((s) => s !== eigenerSitz);
  const gegnerSitz = gegner[0] ?? (eigenerSitz === 0 ? 1 : 0);

  const gesperrt = new Set(Object.values(sicht.farbe));

  const zeile = (sitz: number): SitzZeile | undefined => sitze.find((s) => s.seat === sitz);

  /**
   * Die weisse Kontur um das gegnerische Gebiet — nur im Nebel.
   *
   * In der offenen Spielart braucht sie niemand: Dort sieht man das ganze
   * Brett und damit auch, wo der Gegner steht. Im Nebel dagegen taucht sein
   * Gebiet nur stueckweise auf, sobald man an es heranwaechst — und ein
   * aufgedecktes Feld sieht genauso aus wie jedes andere farbige Feld.
   *
   * Weiss wird eine Kante, an der sich der Besitz AENDERT: Auf der einen
   * Seite der Gegner, auf der anderen nicht. Das zeichnet einen Umriss statt
   * eines Gitters — wuerde jede Kante eines Gegnerfeldes weiss, laege ueber
   * seinem Gebiet ein Raster, und man saehe die Form nicht mehr.
   *
   * `null` auf einer Seite heisst "weiss ich nicht" und faerbt nichts: Was
   * hinter dem Nebel liegt, darf der Bildschirm nicht erraten.
   */
  const gegnerKante = (platz: number, seite: Seite): boolean => {
    if (sicht.variante !== 'nebel') return false;
    const n = nachbarAn(platz, seite, sicht.spalten, sicht.zeilen);
    if (n === null) return false;
    const hier = sicht.besitzer[platz] ?? null;
    const dort = sicht.besitzer[n] ?? null;
    const hierFremd = hier !== null && hier !== eigenerSitz;
    const dortFremd = dort !== null && dort !== eigenerSitz;
    return hierFremd !== dortFremd;
  };

  /**
   * Der komplette Innenschatten eines Feldes.
   *
   * Er wird HIER zusammengesetzt und nicht im Stylesheet, weil `box-shadow`
   * sich nicht stapeln laesst: Zwei Regeln fuer dasselbe Feld ueberschreiben
   * einander, statt sich zu ergaenzen. Der Ring um das eigene Gebiet und die
   * weissen Gegnerkanten muessen deshalb in EINER Zeichenkette stehen.
   */
  const schattenFuer = (platz: number): string | undefined => {
    const teile: string[] = [];
    const besitzer = sicht.besitzer[platz] ?? null;
    if (besitzer === eigenerSitz) teile.push('inset 0 0 0 1px rgba(255, 255, 255, 0.55)');
    else if (besitzer !== null) teile.push('inset 0 0 0 1px rgba(0, 0, 0, 0.28)');
    for (const seite of SEITEN) {
      if (gegnerKante(platz, seite)) teile.push(KANTENSCHATTEN[seite](3, '#ffffff'));
    }
    return teile.length > 0 ? teile.join(', ') : undefined;
  };

  /**
   * Wo eine Kante auf dem Brett liegt, in Prozent des Rasters.
   *
   * Prozent und nicht Pixel: Das Brett skaliert mit der Bildschirmbreite
   * (`min(90vw, 520px)`), und eine in Pixeln gerechnete Wand saesse auf einem
   * schmalen Handy neben ihrer Kante. Gerechnet wird auf der GEDREHTEN
   * Ansicht — sonst laege die Wand bei Sitz 1 spiegelverkehrt.
   */
  const kantenLage = (
    a: number,
    b: number,
  ): { stil: React.CSSProperties; quer: boolean } | null => {
    const ia = anzeigeIndex(a);
    const ib = anzeigeIndex(b);
    const links = Math.min(ia, ib);
    const rechts = Math.max(ia, ib);
    const sp = sicht.spalten;
    const breite = 100 / sp;
    const hoehe = 100 / sicht.zeilen;
    if (rechts - links === 1 && Math.floor(links / sp) === Math.floor(rechts / sp)) {
      // Senkrechte Wand zwischen zwei Nachbarn derselben Zeile.
      return {
        stil: {
          left: `${(links % sp) * breite + breite}%`,
          top: `${Math.floor(links / sp) * hoehe}%`,
          height: `${hoehe}%`,
        },
        quer: false,
      };
    }
    if (rechts - links === sp) {
      // Waagerechte Wand zwischen zwei Zeilen.
      return {
        stil: {
          left: `${(links % sp) * breite}%`,
          top: `${Math.floor(links / sp) * hoehe + hoehe}%`,
          width: `${breite}%`,
        },
        quer: true,
      };
    }
    // Keine Nachbarschaft: nichts zeichnen statt irgendwo einen Strich.
    return null;
  };

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
        {/*
          * Woran man spielt, steht am Tisch und nicht nur im Menue: Nach einem
          * Neuladen ist die Vorwahl von vorhin keine Auskunft mehr ueber
          * DIESEN Tisch. Die Spielart kommt deshalb aus der Sicht.
          *
          * Unter der Punktereihe und nicht in der Ecke: Oben rechts sitzt das
          * Bild des Gegners, und die Marke lag genau darauf.
          */}
        <span className="fl-art" data-klar={sicht.variante === 'klar' ? '' : undefined}>
          {VARIANTE_NAME[sicht.variante] ?? VARIANTE_NAME.nebel}
        </span>
      </div>

      <div className="fl-brett-huelle">
        <div
          className="fl-brett"
          data-baut={bautGerade ? '' : undefined}
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
                  boxShadow: schattenFuer(platz),
                }}
              />
            );
          })}

          {/*
            * Waende und Setzflaechen liegen als eigene Schicht ueber dem
            * Raster und nicht als Rand an den Feldern.
            *
            * Der Grund ist die Fuge: Eine Wand steht ZWISCHEN zwei Feldern,
            * also genau auf dem Millimeter, der beiden gehoert. Als Rand
            * gezeichnet saesse sie in einem der beiden Felder und waere je
            * nach Blickrichtung um eine halbe Fuge versetzt. Als eigene
            * Schicht liegt sie mittig auf der Kante — und ueberdeckt dabei
            * kein Feld, weil sie nur ein paar Pixel dick ist.
            */}
          {sicht.barrieren.map(([a, b]) => {
            const lage = kantenLage(a, b);
            if (!lage) return null;
            return (
              <span
                key={kante(a, b)}
                className="fl-wand"
                data-quer={lage.quer ? '' : undefined}
                style={lage.stil}
              />
            );
          })}

          {bautGerade &&
            (sicht.barrierenMoeglich ?? []).map(([a, b]) => {
              const lage = kantenLage(a, b);
              if (!lage) return null;
              return (
                <button
                  key={kante(a, b)}
                  type="button"
                  className="fl-kantenziel"
                  data-quer={lage.quer ? '' : undefined}
                  style={lage.stil}
                  onClick={() => onBarriere(a, b)}
                  aria-label={`Mauer zwischen Feld ${a + 1} und ${b + 1}`}
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
            <div className="fl-palette" data-ruht={bautGerade ? '' : undefined}>
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
            {/*
              * Der Bau-Knopf steht NEBEN der Farbwahl und nicht darueber: Es
              * sind zwei Zuege, zwischen denen man sich entscheidet, und
              * nicht zwei Schritte nacheinander.
              */}
            {sicht.variante === 'build' && (
              <button
                className="fl-bauknopf"
                type="button"
                data-an={bautGerade ? '' : undefined}
                disabled={meineBarrieren <= 0 || getippt !== null}
                onClick={() => setBaut((an) => !an)}
              >
                Mauer <em>{meineBarrieren}</em>
              </button>
            )}
            <p className="fl-hinweis">
              {bautGerade ? 'Kante antippen' : 'Farbe wählen'}
            </p>
          </>
        ) : (
          <Warteband gegenBot={gegenBot} farbzahl={sicht.farbzahl} />
        )}
      </div>
    </main>
  );
}

/**
 * Der Wartezustand: der Gegner ist am Zug.
 *
 * **Warum die Punkte laufen muessen.** Wer nicht am Zug ist, sieht ein Brett,
 * an dem sich nichts bewegt, und eine Farbauswahl, die nicht reagiert — das
 * ist von einem haengenden Bildschirm nicht zu unterscheiden. Am Handy, wo die
 * Leitung beim Wegschauen ohnehin gerne stirbt (siehe useTable.ts), ist das
 * der Moment, in dem Leute die App schliessen. Die drei laufenden Punkte sind
 * deshalb keine Zierde, sondern die Auskunft "es lebt".
 *
 * Die Palette bleibt darunter stehen, nur blass: Sie verschwinden zu lassen
 * hiesse, den Fuss um 60 px schrumpfen zu lassen, und dann huepft das Brett
 * bei jedem Zugwechsel.
 */
function Warteband({
  gegenBot,
  farbzahl,
}: {
  gegenBot: boolean;
  farbzahl: number;
}): React.JSX.Element {
  return (
    <>
      <div className="fl-palette fl-palette-ruht" aria-hidden="true">
        {Array.from({ length: farbzahl }, (_, nr) => (
          <span key={nr} className="fl-farbe" style={{ background: farbeVon(nr) }} />
        ))}
      </div>
      {/*
        * `aria-live` und ein vollstaendiger Text fuer Vorlesegeraete: Drei
        * huepfende Punkte sind fuer sie nichts, und "Auf anderen Spieler
        * warten" ohne Hinweis auf das Warten waere eine Halbaussage.
        */}
      <p className="fl-hinweis fl-wartet" aria-live="polite">
        <span>{gegenBot ? 'Bot ist am Zug' : 'Auf anderen Spieler warten'}</span>
        <span className="fl-lauf" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="fl-nur-vorlesen">, bitte warten</span>
      </p>
    </>
  );
}

/**
 * Der Schalter zwischen den beiden Spielarten.
 *
 * Zwei Knoepfe und kein Kippschalter: Ein Kippschalter sagt nur, dass etwas an
 * oder aus ist, und "Nebel aus" ist kein Name fuer eine Spielart. So stehen
 * beide da und man liest, wofuer man sich entscheidet.
 */
function Spielartschalter({
  wert,
  onWahl,
}: {
  wert: Variante;
  onWahl: (v: Variante) => void;
}): React.JSX.Element {
  const waehle = (v: Variante): void => {
    onWahl(v);
    try {
      localStorage.setItem(VARIANTE_SCHLUESSEL, v);
    } catch {
      /* Gesperrte Seitendaten. Die Wahl gilt trotzdem — nur eben nicht morgen. */
    }
  };
  return (
    <div className="fl-schalter" role="group" aria-label="Spielart">
      {(['nebel', 'klar', 'build'] as const).map((v) => (
        <button
          key={v}
          type="button"
          data-an={wert === v ? '' : undefined}
          aria-pressed={wert === v}
          onClick={() => waehle(v)}
        >
          {VARIANTE_NAME[v]}
        </button>
      ))}
      <span className="fl-schalter-text">{VARIANTE_TEXT[wert]}</span>
    </div>
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
      <h3>Die drei Spielarten</h3>
      <p>
        <strong>Normal</strong> ist das Original: Das ganze Brett liegt offen.
      </p>
      <p>
        <strong>Nebel</strong> zeigt dir nur dein eigenes Gebiet und die Felder,
        die direkt daran grenzen. Alles andere liegt grau — auch für den Gegner.
        Wo ein aufgedecktes Feld an sein Gebiet stößt, steht eine weiße Kante.
      </p>
      <p>
        <strong>Build</strong> spielt auf offenem Brett, gibt aber jedem fünf
        Mauern. Eine Mauer steht zwischen zwei Feldern und hält beide Seiten
        auf — auch dich. Sie zu setzen kostet einen ganzen Zug; in dieser Runde
        färbst du also nicht. Und du darfst den Gegner damit nicht einsperren:
        Kanten, nach denen er kein freies Feld mehr erreichen könnte, lassen
        sich nicht bebauen.
      </p>
      <h3>Ziel</h3>
      <p>Wer am Ende die meisten Felder hält, gewinnt.</p>
    </div>
  );
}
