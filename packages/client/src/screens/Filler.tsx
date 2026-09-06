import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type Suchstand } from '../api';
import { FARBEN, GRAUTOENE, farbeVon } from '../minispiele/filler/farben';
import type { FillerSicht, Variante } from '../minispiele/filler/sicht';
import { useTable } from '../useTable';

/**
 * Filler — Flaechenduell zu zweit, im Nebel.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie bei Mememory: ohne Tisch das
 * Hauptmenue mit der Match-Suche, mit Tisch das Brett. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Suche reicht ihre
 * Tischkennung mitten im Bildschirm nach, und ein Wechsel ueber zwei
 * Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul: Der Bildschirm bildet KEINE Regel nach.
 * Welche Farben waehlbar sind, steht nicht hier, sondern kommt als
 * `sicht.farbe` vom Server — und was ein Feld traegt, weiss er nur, wenn die
 * Sicht es hergibt. Ein `null` in `sicht.feld` ist Nebel und wird grau
 * gezeichnet; der Client kennt die Farbe dahinter gar nicht.
 */

/*
 * Die Sicht des Moduls steht seit dem 06.09.2026 in
 * minispiele/filler/sicht.ts — zusammen mit der Spielart. Grund: Der Vertrag
 * unter src/vertrag/ haelt sie gegen die echte Modulsicht, und ein Import aus
 * DIESEM Bildschirm zoege React samt aller Bauteile in einen Test, der nur
 * Typen vergleicht.
 */

/**
 * Regelsatz, mit dem der BOT-Tisch aufgemacht wird.
 *
 * Muss zu DEFAULT_REGELN in packages/game-filler/src/regeln.ts passen. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Der Knopf soll nicht auf
 * eine zusaetzliche Antwort warten, bevor er den Tisch aufmacht.
 *
 * Nur noch hier und nicht mehr in der Mitspielersuche: Die baut ihren Tisch
 * seit dem 06.09.2026 serverseitig und nimmt dort `defaultConfig()` des
 * Moduls. Wer diese Zahlen anfasst, aendert also den Bot-Tisch und sonst
 * nichts — die Spielart eingeschlossen.
 */
const REGELSATZ = { spalten: 8, zeilen: 7, barrieren: 10 };

/**
 * Takt, in dem der Stand der Suche abgefragt wird.
 *
 * Eine Sekunde, weil daneben ein Countdown laeuft: Bei einem traegeren Takt
 * springt die Zahl. Der Abruf ist zugleich das Lebenszeichen an den Server —
 * hoert er auf, faellt man von selbst aus der Schlange (siehe
 * packages/server/src/suche/schlange.ts).
 */
const SUCH_TAKT_MS = 1000;

const VARIANTE_NAME: Record<Variante, string> = {
  nebel: 'Nebel',
  klar: 'Normal',
  build: 'Build',
  extreme: 'Extreme',
};

/** Spielarten mit Mauern. Muss zu mitBarrieren in regeln.ts passen. */
function mitMauern(v: Variante): boolean {
  return v === 'build' || v === 'extreme';
}

/**
 * Farbzahl je Spielart: sieben in Extreme, sonst sechs.
 *
 * Steht im Regelsatz, den der Client beim Aufmachen des Tisches mitschickt —
 * die Vorgabe des Moduls kennt nur die sechs. Ein Tisch, der einmal mit
 * sieben aufgemacht wurde, behaelt sie.
 */
function farbenFuer(v: Variante): number {
  return v === 'extreme' ? 7 : 6;
}

const VARIANTE_TEXT: Record<Variante, string> = {
  nebel: 'Du siehst nur dein Gebiet und dessen Rand.',
  klar: 'Das ganze Brett liegt offen — wie im Original.',
  build: 'Offenes Brett, dazu zehn Mauern je Spieler — eine je Zug, färben darfst du danach trotzdem.',
  extreme: 'Build mit sieben Farben und drei Sternfeldern: Ein Stern bringt zwei Punkte und eine Mauer extra.',
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
  return wert === 'nebel' || wert === 'klar' || wert === 'build' || wert === 'extreme';
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

/*
 * FARBEN, GRAUTOENE und farbeVon liegen seit dem 04.09.2026 in
 * minispiele/filler/farben.ts, weil das bewegte Banner der Spielauswahl
 * dieselben Werte braucht — ein zweiter Satz liefe auseinander.
 */

/**
 * Farben, auf denen weisse Schrift nicht mehr lesbar ist.
 *
 * Ausgezaehlt und nicht gerechnet: Es sind sechs feste Werte, und eine
 * Helligkeitsformel im Client waere eine Zeile, die bei jedem Rendern dasselbe
 * Ergebnis ausrechnet.
 */
const DUNKLE_SCHRIFT = new Set([1, 2]);

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
  /** Stand der Mitspielersuche. `null` heisst: es wird nicht gesucht. */
  const [suchstand, setSuchstand] = useState<Suchstand | null>(null);
  /** Ein Knopf ist gedrueckt, die Antwort steht noch aus. */
  const [sucht, setSucht] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);
  /**
   * Die Spielart des BOT-Tisches.
   *
   * Sie ist eine Vorwahl fuer den naechsten Tisch und NICHT der Zustand des
   * laufenden: Was am Tisch gilt, steht in `sicht.variante` und kommt vom
   * Server. Wer das verwechselt, baut einen Schalter, der mitten in der Partie
   * den Nebel abzuschalten scheint und nichts tut.
   *
   * Fuer die Mitspielersuche gilt sie seit dem 06.09.2026 NICHT mehr: Die
   * Schlange kennt nur die `gameId` und baut ihren Tisch mit `defaultConfig()`
   * des Moduls. Deshalb steht der Schalter jetzt beim Bot-Knopf und nicht mehr
   * ueber beiden — einer, der auf den oberen Knopf nicht wirkt, waere eine
   * Beschriftung, die nicht stimmt.
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
   * Einen Gegner finden — seit dem 06.09.2026 ueber die Suchschlange des
   * Servers und nicht mehr ueber die Tischliste.
   *
   * Der alte Weg (offenen Tisch suchen, sonst selbst einen aufmachen, und ein
   * Wettrennen zweier gleichzeitig aufgemachter Tische per Kennungsvergleich
   * im 2,5-Sekunden-Takt aufloesen) ist damit weg. Er konnte zwei Menschen in
   * zwei getrennten Tischen festsetzen, und vor allem hatte er kein Ende: Wer
   * als Einziger suchte, wartete bis zum Verfall seines Tisches. Jetzt sammelt
   * der Server 30 Sekunden lang, setzt danach alle Gefundenen an EINEN Tisch
   * und fuellt den Rest mit Bots — bei zwei Sitzen also hoechstens einen.
   */
  const starteSuche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const stand = await api.sucheStarten('filler');
      if (stand.tischId) setTischId(stand.tischId);
      else setSuchstand(stand);
    } catch {
      setFehler('Die Suche ist fehlgeschlagen. Noch einmal versuchen?');
    } finally {
      setSucht(false);
    }
  }, []);

  /**
   * Nachfragen, solange gesucht wird.
   *
   * Abhaengig ist der Effekt vom SCHLUESSEL `suchstand !== null` und nicht vom
   * Objekt: Er setzt bei jedem Takt einen neuen Stand, und mit dem Objekt in
   * der Liste raeumte er dabei jedes Mal seinen eigenen Zeitgeber ab (siehe
   * CLAUDE.md).
   */
  const suchtGerade = suchstand !== null;
  useEffect(() => {
    if (!suchtGerade) return;
    let lebt = true;
    const frage = (): void => {
      void api
        .sucheStand('filler')
        .then((stand) => {
          if (!lebt) return;
          if (stand.tischId) {
            // Ohne Rueckfrage hinueber: Wer 30 Sekunden gewartet hat, will
            // spielen und keinen zweiten Knopf.
            setSuchstand(null);
            setTischId(stand.tischId);
            return;
          }
          if (!stand.sucht) {
            // Die Schlange kennt uns nicht mehr — etwa nach einem Neustart des
            // Servers. Lieber ehrlich melden als stumm weiterdrehen.
            setSuchstand(null);
            setFehler('Die Suche wurde beendet. Noch einmal versuchen?');
            return;
          }
          setSuchstand(stand);
        })
        .catch(() => {
          /* Ein einzelner Fehlversuch ist kein Abbruch: Der Server wirft uns
             erst nach mehreren stillen Sekunden aus der Schlange. */
        });
    };
    const takt = window.setInterval(frage, SUCH_TAKT_MS);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [suchtGerade]);

  /**
   * Den Bildschirm verlassen heisst die Suche verlassen.
   *
   * Ohne das stuende man nach dem Weggehen noch bis zu acht Sekunden in der
   * Schlange und wuerde womoeglich an einen Tisch gesetzt, den niemand mehr
   * ansieht.
   */
  const suchtRef = useRef(false);
  suchtRef.current = suchtGerade;
  useEffect(
    () => () => {
      if (suchtRef.current) void api.sucheAbbrechen('filler').catch(() => {});
    },
    [],
  );

  const brichSucheAb = useCallback((): void => {
    setSuchstand(null);
    void api.sucheAbbrechen('filler').catch(() => {});
  }, []);

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
        config: { ...REGELSATZ, farben: farbenFuer(variante), variante },
        seats: 2,
        rounds: 1,
        visibility: 'on_request',
        fillWithBots: true,
      });
      setTischId(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setSucht(false);
    }
  }, [variante]);

  const brichAb = useCallback((): void => {
    const id = tischId;
    setSucht(false);
    setTischId(null);
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
  // Mitspieler suchen
  // -------------------------------------------------------------------------

  if (!tischId && suchstand) {
    const sekunden = Math.ceil(suchstand.restMs / 1000);
    const gefunden = suchstand.suchende;
    return (
      <main className="fl-seite fl-menue">
        <button className="fl-zurueck" type="button" onClick={brichSucheAb}>
          ← Abbrechen
        </button>
        <div className="fl-menue-mitte">
          <h1 className="fl-titel">Gegner suchen</h1>
          {/* Die Zahl gross und ohne Einheit: Sie zaehlt sichtbar herunter und
              beantwortet damit die einzige Frage, die man hier hat. */}
          <p className="fl-countdown" aria-live="polite">
            {sekunden}
          </p>
          <p className="fl-untertitel">
            {gefunden === 1
              ? 'Noch niemand sonst — bleibt es dabei, spielst du gegen einen Bot.'
              : `${gefunden} Spieler gefunden`}
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
            {FARBEN.slice(0, farbenFuer(variante)).map((farbe, i) => (
              <span key={i} style={{ background: farbe }} />
            ))}
          </div>
          <button
            className="fl-suchen"
            type="button"
            onClick={() => void starteSuche()}
            disabled={sucht}
          >
            Online Match suchen…
          </button>
          {/*
            * Der Schalter sass bis zum 06.09.2026 ÜBER beiden Knoepfen, weil er
            * entschied, WAS beide aufmachen. Seit die Suche ueber die Schlange
            * des Servers laeuft, entscheidet er nur noch ueber den Bot-Tisch —
            * die Schlange nimmt den Regelsatz des Moduls. Deshalb steht er
            * jetzt IN diesem Block: Ein Schalter ueber einem Knopf, auf den er
            * nicht wirkt, ist schlimmer als gar keiner.
            */}
          <div className="fl-botblock">
            <p className="fl-blocktitel">Gegen Bot — hier wählst du die Spielart</p>
            <Spielartschalter wert={variante} onWahl={setVariante} />
            {/* Ruhiger gefaerbt als die Match-Suche: Der Mensch bleibt das
                Angebot, gegen das man zuerst spielt. Dieselbe Staffelung wie
                bei Mememory. */}
            <button
              className="fl-botknopf"
              type="button"
              onClick={() => void starteBot()}
              disabled={sucht}
            >
              Gegen Bot spielen
            </button>
          </div>
          <button className="fl-regelknopf" type="button" onClick={() => setRegelnOffen(true)}>
            So spielt man Filler
          </button>
          {fehler && <p className="fl-fehler">{fehler}</p>}
          <p className="fl-untertitel fl-klein">{aktiv ?? '…'} Spieler gerade in Filler</p>
          <Vorschau variante={variante} />
        </div>
        {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Tisch wird aufgebaut
  // -------------------------------------------------------------------------

  if (!sicht) {
    const besetzt = (tisch.table?.seats ?? []).filter((platz) => platz.accountId).length;
    return (
      <main className="fl-seite fl-menue">
        <button className="fl-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="fl-menue-mitte">
          <h1 className="fl-titel">Tisch wird aufgebaut</h1>
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
          {/* Ohne Spielart: Der Tisch aus der Schlange traegt den Regelsatz
              des Moduls, nicht den Schalter aus dem Menue — die Zeile haette
              dort schlicht gelogen. Was gilt, steht am Brett (`sicht.variante`). */}
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
  /**
   * Darf ich JETZT mauern?
   *
   * Die Antwort steht in der Sicht und wird hier nicht nachgerechnet: Ob noch
   * eine Kante frei ist, ob der Vorrat reicht und ob ich in diesem Zug schon
   * gebaut habe, entscheidet das Modul (`barrierenMoeglich`). Der Client
   * kennt die Regel nicht — er liest ab, ob es Ziele gibt.
   */
  const kannMauern = (sicht.barrierenMoeglich?.length ?? 0) > 0;
  const sterne = new Set(sicht.sterne ?? []);
  const mauerSperre = sicht.mauerSperre ?? 0;
  /*
   * Der Bau-Zustand faellt von selbst zurueck, sobald es nichts zu setzen
   * gibt — nach der gesetzten Mauer, am Ende des Zuges, beim leeren Vorrat.
   * Ohne das stuende der Knopf beim naechsten eigenen Zug wieder gedrueckt
   * da, ohne dass ihn jemand gedrueckt haette.
   */
  useEffect(() => {
    if (!kannMauern) setBaut(false);
  }, [kannMauern]);

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
  const bautGerade = baut && kannMauern;

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
              >
                {/* Der Stern ist Zeichnung: Was er bringt, rechnet das Modul. */}
                {sterne.has(platz) && <i className="fl-stern" />}
              </span>
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
            {/*
              * Der Bau-Knopf steht seit dem 06.09.2026 UEBER der Farbwahl,
              * groesser und mit Bild: Er war neben den Farben zu leicht zu
              * uebersehen, und wer ihn nicht sieht, spielt Build wie Normal.
              * Er gehoert zum Zug davor — erst bauen, dann faerben —, und in
              * dieser Reihenfolge steht er jetzt auch da.
              */}
            {mitMauern(sicht.variante) && (
              <button
                className="fl-bauknopf"
                type="button"
                data-an={bautGerade ? '' : undefined}
                data-gesperrt={mauerSperre > 0 ? '' : undefined}
                disabled={!kannMauern || getippt !== null}
                onClick={() => setBaut((an) => !an)}
                aria-label={
                  mauerSperre > 0
                    ? `Mauern noch ${mauerSperre} ${mauerSperre === 1 ? 'Zug' : 'Züge'} gesperrt`
                    : `Mauer bauen, noch ${meineBarrieren}`
                }
              >
                {/*
                  * In der Eroeffnung liegt eine Kette ueber dem Knopf und ein
                  * Schloss zaehlt die Zuege herunter — die Zahl kommt aus der
                  * Sicht (`mauerSperre`), der Client rechnet sie nicht nach.
                  */}
                {mauerSperre > 0 ? <Schlossicon zahl={mauerSperre} /> : <Mauericon />}
                <span>Mauer</span>
                <em>{meineBarrieren}</em>
              </button>
            )}
            <div
              className="fl-palette"
              data-ruht={bautGerade ? '' : undefined}
              data-viele={sicht.farbzahl > 6 ? '' : undefined}
            >
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
      {(['nebel', 'klar', 'build', 'extreme'] as const).map((v) => (
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
        {meine} zu {seine} {sicht.variante === 'extreme' ? 'Punkten' : 'Feldern'}
      </p>
      <button className="fl-suchen" type="button" onClick={onZurueck}>
        Zurück
      </button>
    </div>
  );
}


/**
 * Kette mit Vorhaengeschloss und Zahl: die Mauer-Sperre der Eroeffnung.
 *
 * Die Kettenglieder laufen links und rechts vom Schloss weg und enden am
 * Knopfrand; das Schloss traegt die Zahl der noch gesperrten Zuege. Alles
 * aus `currentColor`, wie das Ziegelbild.
 */
function Schlossicon({ zahl }: { zahl: number }): React.JSX.Element {
  const glied = (x: number): React.JSX.Element => (
    <rect key={x} x={x} y="11" width="9" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
  );
  return (
    <svg className="fl-schlossicon" viewBox="0 0 84 30" width="84" height="30" aria-hidden="true">
      {[0, 7, 14].map(glied)}
      {[61, 68, 75].map(glied)}
      {/* Buegel */}
      <path d="M32 13 V9 a10 10 0 0 1 20 0 V13" fill="none" stroke="currentColor" strokeWidth="3" />
      {/* Koerper */}
      <rect x="27" y="12" width="30" height="18" rx="4" fill="currentColor" />
      <text x="42" y="26.5" textAnchor="middle" fontSize="15" fontWeight="900" fontFamily="system-ui" className="fl-schlosszahl">
        {zahl}
      </text>
    </svg>
  );
}

/** Drei Reihen Ziegel. Fuellt sich aus `currentColor`, passt also zu jedem Zustand des Knopfs. */
function Mauericon(): React.JSX.Element {
  return (
    <svg className="fl-mauericon" viewBox="0 0 24 16" width="22" height="15" aria-hidden="true">
      <rect x="0" y="0" width="7" height="4.4" rx="0.8" />
      <rect x="8.5" y="0" width="7" height="4.4" rx="0.8" />
      <rect x="17" y="0" width="7" height="4.4" rx="0.8" />
      <rect x="0" y="5.8" width="3" height="4.4" rx="0.8" />
      <rect x="4.5" y="5.8" width="7" height="4.4" rx="0.8" />
      <rect x="13" y="5.8" width="7" height="4.4" rx="0.8" />
      <rect x="21.5" y="5.8" width="2.5" height="4.4" rx="0.8" />
      <rect x="0" y="11.6" width="7" height="4.4" rx="0.8" />
      <rect x="8.5" y="11.6" width="7" height="4.4" rx="0.8" />
      <rect x="17" y="11.6" width="7" height="4.4" rx="0.8" />
    </svg>
  );
}

/**
 * Die Vorschau im Menue: ein kleines Brett, das die gewaehlte Spielart zeigt.
 *
 * Kein Screenshot und keine Simulation, sondern ein festes Muster, das je
 * Spielart anders gezeichnet wird — Nebel grau bis auf den eigenen Rand,
 * Build voller Waende, Extreme mit sieben Farben und drei Sternen. Wer
 * die Spielarten zum ersten Mal sieht, soll am Bild erkennen, was der
 * Schalter tut, bevor er einen Tisch aufmacht.
 */
const VORSCHAU_SPALTEN = 8;
const VORSCHAU_ZEILEN = 5;
/** Farbmuster: kein Feld traegt die Farbe seines linken oder oberen Nachbarn. */
function vorschauFarbe(platz: number, farbzahl: number): number {
  const x = platz % VORSCHAU_SPALTEN;
  const y = Math.floor(platz / VORSCHAU_SPALTEN);
  return (x * 3 + y * 5 + Math.floor(x / 3)) % farbzahl;
}
/** Das eigene Gebiet unten links: drei Felder, wie nach dem ersten Zug. */
const VORSCHAU_EIGEN = new Set([32, 33, 24]);
const VORSCHAU_FREMD = new Set([7, 6, 15]);
const VORSCHAU_STERNE = [12, 27, 21];
/** Build zeigt VIELE Waende — das ist die Spielart; Extreme nur drei, damit die Sterne zu sehen bleiben. */
const VORSCHAU_WAENDE_BUILD: [number, number][] = [
  [1, 2],
  [9, 10],
  [10, 18],
  [18, 19],
  [26, 27],
  [4, 12],
  [12, 13],
  [13, 21],
  [21, 29],
  [29, 30],
  [30, 31],
  [25, 33],
  [5, 6],
  [14, 22],
];
const VORSCHAU_WAENDE_EXTREME: [number, number][] = [
  [25, 26],
  [18, 26],
  [13, 14],
];

function Vorschau({ variante }: { variante: Variante }): React.JSX.Element {
  const farbzahl = farbenFuer(variante);
  const nebel = variante === 'nebel';
  const mauern = variante === 'build' || variante === 'extreme';
  const sterne = variante === 'extreme' ? new Set(VORSCHAU_STERNE) : new Set<number>();
  /* Im Nebel sichtbar: das eigene Gebiet und dessen Nachbarn. */
  const sichtbar = new Set<number>();
  for (const p of VORSCHAU_EIGEN) {
    sichtbar.add(p);
    const n = nachbarAn(p, 'oben', VORSCHAU_SPALTEN, VORSCHAU_ZEILEN);
    const r = nachbarAn(p, 'rechts', VORSCHAU_SPALTEN, VORSCHAU_ZEILEN);
    const l = nachbarAn(p, 'links', VORSCHAU_SPALTEN, VORSCHAU_ZEILEN);
    const u = nachbarAn(p, 'unten', VORSCHAU_SPALTEN, VORSCHAU_ZEILEN);
    for (const x of [n, r, l, u]) if (x !== null) sichtbar.add(x);
  }
  const breite = 100 / VORSCHAU_SPALTEN;
  const hoehe = 100 / VORSCHAU_ZEILEN;
  return (
    <div className="fl-vorschau" aria-hidden="true" data-variante={variante}>
      <div
        className="fl-vorschau-brett"
        style={{ gridTemplateColumns: `repeat(${VORSCHAU_SPALTEN}, 1fr)` }}
      >
        {Array.from({ length: VORSCHAU_SPALTEN * VORSCHAU_ZEILEN }, (_, platz) => {
          const eigen = VORSCHAU_EIGEN.has(platz);
          const fremd = VORSCHAU_FREMD.has(platz);
          const verdeckt = nebel && !sichtbar.has(platz);
          const farbe = eigen ? 0 : fremd ? 3 : vorschauFarbe(platz, farbzahl);
          return (
            <span
              key={platz}
              data-eigen={eigen ? '' : undefined}
              data-fremd={fremd && !verdeckt ? '' : undefined}
              style={{
                background: verdeckt
                  ? (GRAUTOENE[(platz * 7) % GRAUTOENE.length] ?? GRAUTOENE[0])
                  : farbeVon(farbe),
              }}
            >
              {sterne.has(platz) && <i className="fl-stern" />}
            </span>
          );
        })}
        {mauern &&
          (variante === 'build' ? VORSCHAU_WAENDE_BUILD : VORSCHAU_WAENDE_EXTREME).map(([a, b]) => {
            const quer = b - a === VORSCHAU_SPALTEN;
            const links = a % VORSCHAU_SPALTEN;
            const oben = Math.floor(a / VORSCHAU_SPALTEN);
            const stil = quer
              ? { left: `${links * breite}%`, top: `${oben * hoehe + hoehe}%`, width: `${breite}%` }
              : { left: `${links * breite + breite}%`, top: `${oben * hoehe}%`, height: `${hoehe}%` };
            return <span key={`${a}:${b}`} className="fl-wand" data-quer={quer ? '' : undefined} style={stil} />;
          })}
      </div>
      <p className="fl-vorschau-text">Vorschau: {VARIANTE_NAME[variante]}</p>
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
          Abwechselnd färbt man sein Gebiet in eine von sechs Farben (sieben in
          Extreme) und nimmt dabei alle angrenzenden Felder dieser Farbe mit.
        </li>
        <li>Die Farbe des Gegners darf man nicht wählen.</li>
        <li>Die Partie endet, wenn kein Feld mehr frei ist.</li>
      </ol>
      <h3>Die vier Spielarten</h3>
      <p>
        <strong>Normal</strong> ist das Original: Das ganze Brett liegt offen.
      </p>
      <p>
        <strong>Nebel</strong> zeigt dir nur dein eigenes Gebiet und die Felder,
        die direkt daran grenzen. Alles andere liegt grau — auch für den Gegner.
        Wo ein aufgedecktes Feld an sein Gebiet stößt, steht eine weiße Kante.
      </p>
      <p>
        <strong>Build</strong> spielt auf offenem Brett, gibt aber jedem zehn
        Mauern. Eine Mauer steht zwischen zwei Feldern und hält beide Seiten
        auf — auch dich. Du darfst pro Zug eine setzen und danach ganz normal
        färben; erst das Färben gibt ab. Die ersten drei Züge der Partie sind
        mauerfrei — das Schloss auf dem Knopf zählt sie herunter; ab dem
        zweiten Zug des zweiten Spielers darf gebaut werden. Und du darfst den
        Gegner damit nicht
        einsperren: Kanten, nach denen er kein freies Feld mehr erreichen
        könnte, lassen sich nicht bebauen.
      </p>
      <p>
        <strong>Extreme</strong> ist Build mit sieben Farben und drei
        Sternfeldern. Ein Stern ist ein normales Feld mit einem weißen Stern
        darauf: Wer es schluckt, bekommt dafür zwei Punkte statt einem und eine
        Mauer dazu.
      </p>
      <h3>Ziel</h3>
      <p>Wer am Ende die meisten Felder hält, gewinnt — in Extreme die meisten Punkte.</p>
    </div>
  );
}
