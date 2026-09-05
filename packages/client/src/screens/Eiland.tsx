import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, type Suchstand } from '../api';
import { GRAUTOENE, auswahlton, gebietsfarbe, kampffarbe } from '../minispiele/eiland/farben';
import {
  type Modus,
  type Punkt,
  haengtZusammen,
  laufe,
  selberFleck,
  treffer,
  waehlbarMit,
  zelleVon,
} from '../minispiele/eiland/gesten';
import { Ornamentbild } from '../minispiele/eiland/Ornament';
import { useTable } from '../useTable';

/**
 * Eiland — Landnahme zu zweit, gleichzeitig gezogen.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie bei Filler und Mememory: ohne Tisch
 * das Hauptmenue mit der Match-Suche, mit Tisch die Karte. Der Tisch wird HIER
 * gehalten und nicht ueber App.tsx geroutet — die Suche reicht ihre
 * Tischkennung mitten im Bildschirm nach, und ein Wechsel ueber zwei
 * Bildschirmzustaende hinweg waere ein Flackern.
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
  /** 'nebel' oder 'klar' — siehe packages/game-eiland/src/regeln.ts. */
  variante: EilandVariante;
  /** 0 Gras, 1 Wasser, 2 Berg — oder null, solange das Feld im Nebel liegt. */
  gelaende: (number | null)[];
  ornament: (number | null)[];
  /** Eingesammelte Ornamente, die als Bauwerk stehen geblieben sind. */
  bauwerk: (number | null)[];
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
    /** In Entscheidungsreihenfolge; `einsatz` = Sitze, die ein Feld darauf gesetzt haben. */
    kaempfe: { platz: number; sieger: number; einsatz: number[] }[];
    reserve: Record<number, number>;
    genommen: Record<number, number[]>;
    verfallen: Record<number, number[]>;
    ornamente: Record<number, number>;
  } | null;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}

/** Die beiden Spielarten, siehe packages/game-eiland/src/regeln.ts. */
type EilandVariante = 'nebel' | 'klar';

/**
 * Takt, in dem der Stand der Suche abgefragt wird.
 *
 * Eine Sekunde, weil daneben ein Countdown laeuft: Bei einem traegeren Takt
 * springt die Zahl. Der Abruf ist zugleich das Lebenszeichen an den Server —
 * hoert er auf, faellt man von selbst aus der Schlange (siehe
 * packages/server/src/suche/schlange.ts).
 */
const SUCH_TAKT_MS = 1000;

/**
 * Regelsatz, mit dem der KI-Tisch aufgemacht wird.
 *
 * Muss zu DEFAULT_REGELN in packages/game-eiland/src/regeln.ts passen. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Der Knopf soll nicht auf
 * eine zusaetzliche Antwort warten, bevor er den Tisch aufmacht. Die Spielart
 * kommt beim Aufmachen dazu.
 *
 * Nur noch hier und nicht mehr in der Mitspielersuche: Die baut ihren Tisch
 * seit dem 06.09.2026 serverseitig und nimmt dort `defaultConfig()` des
 * Moduls.
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

/**
 * Wie lange die Auswahl gesperrt bleibt, wenn der Server auf einen
 * abgeschickten Zettel nicht antwortet.
 *
 * Ohne diese Grenze war die Sperre eine Falle: Sie loeste sich nur, wenn eine
 * NEUE Revision eintraf — und genau die bleibt aus, wenn der Server die
 * Aktion als wirkungslos verwirft oder die Nachricht unterwegs verlorengeht.
 * Wer dann nicht mehr tippen kann, gilt nach fuenf Minuten als ausgestiegen,
 * und der Tisch loest sich auf. Sechs Sekunden sind mehr als jede Antwortzeit
 * und weniger als jede Geduld.
 */
const SPERRE_MAX_MS = 6000;

/* GRAS (0) braucht dieser Bildschirm nicht mehr selbst — die Regel, was
   nehmbar ist, liegt in minispiele/eiland/gesten.ts. */
const WASSER = 1;
const BERG = 2;

/**
 * Der Flug eines Einsatzes aufs Streitfeld: so lange dauert einer, und so
 * dicht folgen sie aufeinander. Schnell, weil sie eine Auskunft sind und
 * kein Schauspiel — nach der dritten Runde will das niemand mehr abwarten.
 * Die Kampfmarke auf dem Feld wartet, bis der Einsatz gelandet ist
 * (`--ei-kampf-verzoegerung`), sonst staende das Ergebnis vor der Ursache.
 */
const FLUG_MS = 340;
const FLUG_TAKT_MS = 150;

/**
 * Der Einschlag, wenn der Einsatz landet (04.09.2026, Nutzerwunsch: laenger
 * und mit Funken): ein Schein und Funken in der Farbe dessen, der gezahlt
 * hat — zahlen beide, tragen die Funken beide Farben und der Schein die
 * Mischung. So liest man am Feld ab, WER hier ein Feld verwettet hat, ohne
 * die Fussleiste zu suchen. Deutlich laenger als der Flug, weil er das
 * Ergebnis ist und nicht der Weg dorthin; die Kampfmarke im Stylesheet
 * (`ei-kampf`) haelt genauso lange durch.
 */
const SCHEIN_MS = 900;
const FUNKEN_MS = 1100;
const FUNKEN_JE_FARBE = 9;

export function Eiland({
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
   * Spielart des KI-Tisches. Nur eine Vorauswahl fuers Menue — am Tisch gilt,
   * was in dessen Regelsatz steht (siehe regeln.ts).
   *
   * Vorgabe ist seit dem 04.09.2026 die offene Karte (Nutzerwunsch): Sie ist
   * die Spielart, die man ohne Erklaerung versteht, der Nebel die fuer den
   * zweiten Abend.
   *
   * ACHTUNG, seit dem 06.09.2026 gilt sie nur noch fuer den KI-Knopf: Die
   * Mitspielersuche laeuft ueber die Schlange des Servers, und die baut ihren
   * Tisch mit `defaultConfig()` des Moduls — dort steht `variante: 'nebel'`.
   * Das Online-Match spielt also im Nebel, egal was hier gewaehlt ist. Der
   * Widerspruch zum Nutzerwunsch steht als Karte auf dem Issueboard; er laesst
   * sich nur an einer von zwei Stellen aufloesen (Schlange mit Regelsatz oder
   * DEFAULT_REGELN umstellen), und beides ist keine Sache dieses Bildschirms.
   */
  const [variante, setVariante] = useState<EilandVariante>('klar');

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
      const stand = await api.sucheStarten('eiland');
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
        .sucheStand('eiland')
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
      if (suchtRef.current) void api.sucheAbbrechen('eiland').catch(() => {});
    },
    [],
  );

  const brichSucheAb = useCallback((): void => {
    setSuchstand(null);
    void api.sucheAbbrechen('eiland').catch(() => {});
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
        config: { ...REGELSATZ, variante },
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
   * Der abgeschickte Zettel, auf dessen Antwort wir warten — samt der
   * Revision, die dabei galt.
   *
   * Er sperrt nur den ABSENDEKNOPF, nicht mehr die Karte: Gewaehlt wird
   * seitdem bei uns (siehe Karte), und erst der fertige Zettel geht ueber die
   * Leitung. Vorher war jedes einzelne Feld ein Gang zum Server, und wer sechs
   * Felder hatte, wartete sechsmal.
   */
  const [gesendet, setGesendet] = useState<{ revision: number } | null>(null);
  const revision = tisch.view?.revision ?? -1;
  useEffect(() => {
    setGesendet((alt) => (alt && revision > alt.revision ? null : alt));
  }, [revision]);

  /**
   * Die Notbremse zur Sperre.
   *
   * Die Sperre oben loest sich nur bei einer NEUEN Revision — und genau die
   * bleibt aus, wenn der Server die Aktion als wirkungslos verwirft (siehe
   * `act` in runtime/party.ts) oder die Nachricht unterwegs verlorengeht. Ohne
   * diesen Wecker bliebe der Knopf dann fuer immer tot; nach fuenf Minuten
   * ohne Zug gilt man als ausgestiegen, und der Tisch loest sich auf. Genau
   * das ist einmal passiert.
   */
  useEffect(() => {
    if (!gesendet) return;
    const wecker = window.setTimeout(() => setGesendet(null), SPERRE_MAX_MS);
    return () => window.clearTimeout(wecker);
  }, [gesendet]);

  const binDabei = sicht !== null && !sicht.fertig && eigenerSitz >= 0;
  const binBereit = sicht?.bereit[eigenerSitz] === true;
  const darfPlanen = binDabei && !binBereit;

  const gibAb = useCallback(
    (felder: readonly number[]): void => {
      if (!darfPlanen || gesendet !== null) return;
      setGesendet({ revision });
      tisch.send({ typ: 'plan', felder: [...felder] });
    },
    [darfPlanen, gesendet, revision, tisch],
  );

  // -------------------------------------------------------------------------
  // Mitspieler suchen
  // -------------------------------------------------------------------------

  if (!tischId && suchstand) {
    const sekunden = Math.ceil(suchstand.restMs / 1000);
    const gefunden = suchstand.suchende;
    return (
      <main className="ei-seite ei-menue">
        <button className="ei-zurueck" type="button" onClick={brichSucheAb}>
          ← Abbrechen
        </button>
        <div className="ei-menue-mitte">
          <h1 className="ei-titel">Gegner suchen</h1>
          {/* Die Zahl gross und ohne Einheit: Sie zaehlt sichtbar herunter und
              beantwortet damit die einzige Frage, die man hier hat. */}
          <p className="ei-countdown" aria-live="polite">
            {sekunden}
          </p>
          <p className="ei-untertitel">
            {gefunden === 1
              ? 'Noch niemand sonst — bleibt es dabei, spielst du gegen die KI.'
              : `${gefunden} Spieler gefunden`}
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
            {variante === 'nebel' && <span data-art="nebel" />}
          </div>
          <button
            className="ei-suchen"
            type="button"
            onClick={() => void starteSuche()}
            disabled={sucht}
          >
            Online Match suchen…
          </button>
          {/*
            Der Schalter zwischen den beiden Spielarten. Er gehoert ins Menue
            und nicht an den Tisch: Die Spielart steht im Regelsatz und damit
            seit dem Aufmachen fest — mitten in der Partie den Nebel
            abzuschalten waere kein Knopf, sondern ein Schummelzettel.

            Seit dem 06.09.2026 sitzt er UNTER der Suche, im Block des
            KI-Knopfes: Die Suchschlange nimmt den Regelsatz des Moduls, der
            Schalter wirkt also nur noch auf den Knopf darunter. Ueber beiden
            stehend waere er eine Beschriftung, die nicht stimmt.
          */}
          <div className="ei-kiblock">
            <p className="ei-blocktitel">Gegen die KI — hier wählst du die Spielart</p>
            <div className="ei-schalter">
              {/* Die offene Karte links, weil sie die Vorgabe ist — der Reiter
                  sitzt beim Oeffnen dort, wo der Blick zuerst hinfaellt. */}
              <button
                type="button"
                data-an={variante === 'klar' ? '' : undefined}
                onClick={() => setVariante('klar')}
              >
                Offene Karte
              </button>
              <button
                type="button"
                data-an={variante === 'nebel' ? '' : undefined}
                onClick={() => setVariante('nebel')}
              >
                Im Nebel
              </button>
              <p className="ei-schalter-text">
                {variante === 'nebel'
                  ? 'Du siehst dein Gebiet und drei Felder darüber hinaus.'
                  : 'Die ganze Insel liegt offen — für euch beide.'}
              </p>
            </div>
            <button
              className="ei-botknopf"
              type="button"
              onClick={() => void gegenKi()}
              disabled={sucht}
            >
              Gegen die KI spielen
            </button>
          </div>
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
  // Tisch wird aufgebaut
  // -------------------------------------------------------------------------

  if (!sicht) {
    const besetzt = (tisch.table?.seats ?? []).filter((platz) => platz.accountId).length;
    return (
      <main className="ei-seite ei-menue">
        <button className="ei-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="ei-menue-mitte">
          <h1 className="ei-titel">Tisch wird aufgebaut</h1>
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
      darfPlanen={darfPlanen}
      wartet={gesendet !== null}
      onAbgeben={gibAb}
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

/**
 * Was die Gesten sich merken, solange ein Finger auf der Karte liegt. Die
 * Rechnung dazu steht in minispiele/eiland/gesten.ts — hier nur, was an den
 * Zeiger gebunden ist.
 */
interface Geste {
  readonly pointerId: number;
  readonly modus: Modus;
  /** Zuletzt betretene Zelle (Anzeigeindex): Jede wirkt nur einmal je Betreten. */
  zelle: number;
}

function Karte({
  sicht,
  eigenerSitz,
  sitze,
  darfPlanen,
  wartet,
  onAbgeben,
  onVerlassen,
}: {
  sicht: EilandSicht;
  eigenerSitz: number;
  sitze: readonly SitzZeile[];
  darfPlanen: boolean;
  wartet: boolean;
  onAbgeben: (felder: readonly number[]) => void;
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

  /**
   * Die Auswahl, die noch bei uns liegt.
   *
   * Der ganze Zug wird hier zusammengestellt und erst am Ende abgeschickt —
   * ein Umlauf je Runde statt einem je Feld. Der Preis dafuer ist, dass dieser
   * Bildschirm EINE Regel kennen muss (siehe waehlbarMit). Das ist derselbe
   * Weg, den Skat und der Doppelkopf gehen (der Client baut die Aktion selbst
   * aus der Sicht, `legalActions` ist leer), und der Server prueft den
   * fertigen Zettel ohnehin noch einmal — weicht die Rechnung hier je ab,
   * weist er ihn ab, statt ihn falsch auszufuehren.
   *
   * Sie steht ZWEIMAL: als Zustand fuers Zeichnen und als Ref fuer die
   * Zeigergesten. Beim Wischen kommen mehrere Bewegungen an, bevor React
   * einmal gezeichnet hat — wer da aus dem Zustand liest, sieht die Auswahl
   * von vor drei Feldern und haengt dasselbe Feld dreimal an. Die Ref ist die
   * Wahrheit waehrend der Geste, der Zustand ihr Abbild.
   */
  const [wahl, setWahlZustand] = useState<number[]>([]);
  const wahlRef = useRef<number[]>([]);
  const setzeWahl = (neu: number[]): void => {
    wahlRef.current = neu;
    setWahlZustand(neu);
  };
  const geste = useRef<Geste | null>(null);
  const letzterTipp = useRef<{ punkt: Punkt; platz: number } | null>(null);
  const karteRef = useRef<HTMLDivElement>(null);
  const flugRef = useRef<HTMLDivElement>(null);
  /*
   * Neue Runde, leerer Zettel. Am RUNDENZAEHLER aufgehaengt und nicht am
   * Sichten-Objekt: Ein Effekt mit dem Objekt in der Abhaengigkeitsliste
   * liefe bei jedem Serverfunk neu und wuerde die halbfertige Auswahl
   * mitten im Ueberlegen wegwerfen.
   */
  useEffect(() => {
    wahlRef.current = [];
    setWahlZustand([]);
    geste.current = null;
    letzterTipp.current = null;
  }, [sicht.runde]);

  const kontingent = sicht.kontingent[eigenerSitz] ?? 1;
  const binBereit = sicht.bereit[eigenerSitz] === true;
  /** Nach dem Abgeben zeigt die Karte, was auf dem Zettel steht. */
  const gewaehlt = useMemo(
    () => new Set(binBereit ? sicht.wahl : wahl),
    [binBereit, sicht.wahl, wahl],
  );
  const waehlbar = useMemo(() => waehlbarMit(sicht, wahl), [sicht, wahl]);

  // -- Waehlen ---------------------------------------------------------------

  const nimm = (platz: number): boolean => {
    const auswahl = wahlRef.current;
    if (auswahl.length >= kontingent) return false;
    if (!waehlbarMit(sicht, auswahl).has(platz)) return false;
    setzeWahl([...auswahl, platz]);
    return true;
  };

  const lass = (platz: number): boolean => {
    const auswahl = wahlRef.current;
    if (!auswahl.includes(platz)) return false;
    setzeWahl(haengtZusammen(sicht, eigenerSitz, auswahl.filter((p) => p !== platz)));
    return true;
  };

  const wende = (platz: number, modus: Modus): boolean =>
    modus === 'nehmen' ? nimm(platz) : lass(platz);

  const zuruecksetzen = (): void => {
    setzeWahl([]);
    letzterTipp.current = null;
  };

  // -- Zeiger ----------------------------------------------------------------

  /**
   * Zeigerlage in Rasterkoordinaten.
   *
   * Aus der Geometrie der Karte gerechnet und nicht aus dem Ziel des
   * Ereignisses: Waehrend einer Geste ist der Zeiger an die Karte gebunden
   * (setPointerCapture), und das Ziel ist dann immer die Karte selbst. Rand
   * und Fuge sind je 1 px (siehe .ei-karte), ein Rasterschritt ist Feld plus
   * Fuge — bei einer 1-px-Fuge liegt die Fuge rechnerisch beim Feld davor,
   * was niemand merkt.
   */
  const rasterPunkt = (ev: { clientX: number; clientY: number }): Punkt | null => {
    const el = karteRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const schrittX = (rect.width - 1) / sicht.spalten;
    const schrittY = (rect.height - 1) / sicht.zeilen;
    return { u: (ev.clientX - rect.left - 1) / schrittX, v: (ev.clientY - rect.top - 1) / schrittY };
  };

  /**
   * Die Geste auf jede betretene Zelle anwenden — die Rechnung des Weges
   * steht in gesten.ts, hier nur die Anbindung an Auswahl und Drehung.
   */
  const wandere = (von: number, nach: number, modus: Modus): void => {
    const taugt = (zelle: number): boolean => {
      const auswahl = wahlRef.current;
      return modus === 'nehmen'
        ? waehlbarMit(sicht, auswahl).has(platzVon(zelle))
        : auswahl.includes(platzVon(zelle));
    };
    laufe(von, nach, sicht.spalten, taugt, (zelle) => {
      wende(platzVon(zelle), modus);
    });
  };

  const beiZeigerAb = (ev: React.PointerEvent<HTMLDivElement>): void => {
    if (!darfPlanen || wartet || geste.current) return;
    if (ev.button !== 0) return;
    const p = rasterPunkt(ev);
    if (!p) return;
    const zelle = zelleVon(sicht, p);
    if (zelle === null) return;
    // Kein Fokusrahmen, kein Textmarkieren — und keine Maus-Ersatzereignisse.
    ev.preventDefault();
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      /*
       * Kein aktiver Zeiger unter dieser Kennung (der Browser hat ihn schon
       * losgelassen, oder das Ereignis kam aus einer Pruefung). Ohne Bindung
       * endet ein Wischen am Rand der Karte — der Tipp selbst gilt trotzdem.
       */
    }

    let modus: Modus;
    const vorher = letzterTipp.current;
    if (vorher && selberFleck(vorher.punkt, p) && wahlRef.current.includes(vorher.platz)) {
      // Derselbe Fleck noch einmal: zuruecknehmen, was der vorige Tipp nahm.
      lass(vorher.platz);
      letzterTipp.current = null;
      modus = 'lassen';
    } else {
      const platz = platzVon(treffer(sicht, wahlRef.current, kontingent, platzVon, p, zelle));
      if (wahlRef.current.includes(platz)) {
        lass(platz);
        letzterTipp.current = null;
        modus = 'lassen';
      } else {
        // Auch wenn hier nichts zu nehmen war (eigenes Land, Wasser): Die
        // Geste ist trotzdem ein Nehmen — wer auf seinem Gebiet ansetzt und
        // ueber den Rand hinauswischt, will Land.
        letzterTipp.current = nimm(platz) ? { punkt: p, platz } : null;
        modus = 'nehmen';
      }
    }
    geste.current = { pointerId: ev.pointerId, modus, zelle };
  };

  const beiZeigerZug = (ev: React.PointerEvent<HTMLDivElement>): void => {
    const g = geste.current;
    if (!g || g.pointerId !== ev.pointerId) return;
    const p = rasterPunkt(ev);
    if (!p) return;
    const zelle = zelleVon(sicht, p);
    if (zelle === null || zelle === g.zelle) return;
    // Wer weiterzieht, wischt — der „selbe Fleck" gilt danach nicht mehr.
    letzterTipp.current = null;
    wandere(g.zelle, zelle, g.modus);
    g.zelle = zelle;
  };

  const beiZeigerAuf = (ev: React.PointerEvent<HTMLDivElement>): void => {
    const g = geste.current;
    if (!g || g.pointerId !== ev.pointerId) return;
    geste.current = null;
  };

  /**
   * Tastatur: Leertaste oder Eingabe auf einem Feld. Ein Klick, der von
   * einem Zeiger kommt, traegt `detail >= 1` und ist oben schon erledigt —
   * ihn hier noch einmal auszuwerten hiesse, jedes Feld zweimal zu schalten.
   */
  const beiKlick = (ev: React.MouseEvent<HTMLButtonElement>, platz: number): void => {
    if (ev.detail !== 0) return;
    if (!darfPlanen || wartet) return;
    if (wahlRef.current.includes(platz)) lass(platz);
    else nimm(platz);
  };

  /**
   * Die Kaempfe der letzten Runde. Sie liegen kurz als Marke auf dem Feld —
   * eine Runde lang, nicht als Zustand mit eigener Uhr: Was in `sicht.letzte`
   * steht, wird mit der naechsten Aufloesung ohnehin ersetzt.
   */
  const kaempfe = useMemo(() => {
    const karte = new Map<number, { sieger: number; verzoegerung: number }>();
    (sicht.letzte?.kaempfe ?? []).forEach((kampf, i) => {
      // Die Marke erscheint, wenn der LETZTE Einsatz landet (der zweite
      // fliegt 60 ms nach dem ersten, siehe unten) — ohne Einsatz sofort im
      // Takt, damit die Reihenfolge der Entscheidung auch ohne Flug lesbar ist.
      const landung = kampf.einsatz.length > 0 ? (kampf.einsatz.length - 1) * 60 + FLUG_MS * 0.8 : 0;
      karte.set(kampf.platz, { sieger: kampf.sieger, verzoegerung: i * FLUG_TAKT_MS + landung });
    });
    return karte;
  }, [sicht.letzte]);

  /**
   * Die Einsaetze fliegen aufs Streitfeld.
   *
   * Der eigene aus der Restkachel unten (dort lag er, seit man ihn nicht
   * gesetzt hat), der des Gegners aus seinem Punktestand oben — in der
   * Reihenfolge, in der der Server die Streitfelder entschieden hat. Es sind
   * Kacheln in der Gebietsfarbe, ueber die Web-Animations-Schnittstelle
   * bewegt und danach entfernt: kein Zustand, keine Uhr, und ein neuer
   * Rundruf mitten im Flug raeumt ueber den Aufraeumer alles ab.
   *
   * Am RUNDENZAEHLER der Meldung aufgehaengt, nicht an der Sicht: Sie kommt
   * bei jedem Serverfunk neu, die Runde nur einmal je Aufloesung.
   */
  const letzteRunde = sicht.letzte?.runde ?? -1;
  useEffect(() => {
    const letzte = sicht.letzte;
    const buehne = flugRef.current;
    const karte = karteRef.current;
    if (!letzte || !buehne || !karte) return;
    if (!letzte.kaempfe.some((k) => k.einsatz.length > 0)) return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const wurzel = buehne.getBoundingClientRect();
    const startVon = (sitz: number): DOMRect | undefined => {
      if (sitz === eigenerSitz) {
        return (document.querySelector('.ei-rest') ?? document.querySelector('.ei-fuss'))?.getBoundingClientRect();
      }
      return document.querySelector('.ei-spieler:not([data-eigen]) .ei-punkte')?.getBoundingClientRect();
    };
    const gestartet: Animation[] = [];
    const wecker: number[] = [];
    /**
     * Ein Element auf die Buehne, das nach seiner Animation von selbst geht.
     *
     * Im Hintergrund-Tab laeuft die Animation nicht an und `onfinish` kommt
     * nie — das Element bliebe als Fleck liegen, bis die naechste Runde
     * aufraeumt. Deshalb ein Wecker als zweiter Weg hinaus.
     */
    const auftritt = (
      element: HTMLElement,
      bilder: Keyframe[],
      takt: { duration: number; delay: number; easing: string },
    ): void => {
      buehne.appendChild(element);
      const lauf = element.animate(bilder, { ...takt, fill: 'backwards' });
      lauf.onfinish = () => element.remove();
      wecker.push(window.setTimeout(() => element.remove(), takt.delay + takt.duration + 250));
      gestartet.push(lauf);
    };
    letzte.kaempfe.forEach((kampf, i) => {
      const feld = karte.children[gedreht ? plaetze - 1 - kampf.platz : kampf.platz];
      if (!(feld instanceof HTMLElement)) return;
      const ziel = feld.getBoundingClientRect();
      const x1 = ziel.left - wurzel.left;
      const y1 = ziel.top - wurzel.top;
      kampf.einsatz.forEach((sitz, k) => {
        const von = startVon(sitz);
        if (!von) return;
        const kachel = document.createElement('span');
        kachel.className = 'ei-flug';
        kachel.style.width = `${ziel.width}px`;
        kachel.style.height = `${ziel.height}px`;
        kachel.style.background = gebietsfarbe(sitz);
        const x0 = von.left + von.width / 2 - ziel.width / 2 - wurzel.left;
        const y0 = von.top + von.height / 2 - ziel.height / 2 - wurzel.top;
        kachel.style.transform = `translate(${x0}px, ${y0}px) scale(0.7)`;
        auftritt(
          kachel,
          [
            { transform: `translate(${x0}px, ${y0}px) scale(0.7)`, opacity: 0.95 },
            { transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: 1, offset: 0.8 },
            { transform: `translate(${x1}px, ${y1}px) scale(1.3)`, opacity: 0 },
          ],
          {
            duration: FLUG_MS,
            // Der Gegner-Einsatz einen Wimpernschlag nach dem eigenen: Zwei
            // Kacheln, die zugleich landen, saehen aus wie eine.
            delay: i * FLUG_TAKT_MS + k * 60,
            easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          },
        );
      });
      if (kampf.einsatz.length === 0) return;

      /*
       * Der Einschlag, sobald der letzte Einsatz gelandet ist: erst der
       * Schein in der Kampffarbe (bei zwei Zahlern die Mischung — DAS ist der
       * Hinweis, dass beide gesetzt haben), darueber die Funken, abwechselnd
       * in den Farben der Zahler. Alles beginnt unsichtbar (`opacity: 0` im
       * ersten Bild): `fill: backwards` zeigt sonst das erste Bild schon
       * waehrend der Wartezeit, und dann laege der Einschlag auf dem Feld,
       * bevor die Kachel ankommt.
       */
      const landung = i * FLUG_TAKT_MS + (kampf.einsatz.length - 1) * 60 + FLUG_MS * 0.8;
      const farben = kampf.einsatz.map(gebietsfarbe);
      const mitteX = x1 + ziel.width / 2;
      const mitteY = y1 + ziel.height / 2;

      const schein = document.createElement('span');
      schein.className = 'ei-kampfschein';
      schein.style.width = `${ziel.width}px`;
      schein.style.height = `${ziel.height}px`;
      schein.style.background = `radial-gradient(closest-side, ${kampffarbe(kampf.einsatz)}, transparent)`;
      schein.style.transform = `translate(${x1}px, ${y1}px) scale(0.5)`;
      auftritt(
        schein,
        [
          { transform: `translate(${x1}px, ${y1}px) scale(0.5)`, opacity: 0 },
          { transform: `translate(${x1}px, ${y1}px) scale(1.1)`, opacity: 0.95, offset: 0.12 },
          { transform: `translate(${x1}px, ${y1}px) scale(2.8)`, opacity: 0 },
        ],
        { duration: SCHEIN_MS, delay: landung, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      );

      const anzahl = FUNKEN_JE_FARBE * farben.length;
      for (let f = 0; f < anzahl; f++) {
        const funke = document.createElement('span');
        funke.className = 'ei-funke';
        const groesse = ziel.width * (0.16 + Math.random() * 0.14);
        funke.style.width = `${groesse}px`;
        funke.style.height = `${groesse}px`;
        funke.style.background = farben[f % farben.length] ?? farben[0]!;
        // Gleichmaessig um den Kreis verteilt, mit etwas Streuung — sonst
        // saehe jeder Einschlag gleich aus. Am Ende sinken sie ein Stueck,
        // wie Splitter, die zu Boden gehen.
        const winkel = (f / anzahl) * Math.PI * 2 + Math.random() * 0.6;
        const weite = ziel.width * (0.8 + Math.random() * 1.1);
        const sx = mitteX - groesse / 2;
        const sy = mitteY - groesse / 2;
        const ex = sx + Math.cos(winkel) * weite;
        const ey = sy + Math.sin(winkel) * weite + ziel.height * 0.3;
        const drehung = Math.round((Math.random() - 0.5) * 540);
        funke.style.transform = `translate(${sx}px, ${sy}px)`;
        auftritt(
          funke,
          [
            { transform: `translate(${sx}px, ${sy}px) rotate(0deg) scale(1)`, opacity: 0 },
            { transform: `translate(${sx}px, ${sy}px) rotate(0deg) scale(1.15)`, opacity: 1, offset: 0.06 },
            {
              transform: `translate(${(sx + ex) / 2}px, ${(sy + ey) / 2 - ziel.height * 0.25}px) rotate(${drehung / 2}deg) scale(0.95)`,
              opacity: 1,
              offset: 0.45,
            },
            { transform: `translate(${ex}px, ${ey}px) rotate(${drehung}deg) scale(0.2)`, opacity: 0 },
          ],
          {
            duration: FUNKEN_MS + Math.random() * 300,
            delay: landung + Math.random() * 80,
            easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)',
          },
        );
      }
    });
    return () => {
      for (const flug of gestartet) flug.cancel();
      for (const w of wecker) window.clearTimeout(w);
      buehne.replaceChildren();
    };
  }, [letzteRunde]);

  const offen = Math.max(0, kontingent - wahl.length);
  /** Nach dem Abgeben: Was nicht gesetzt wurde, ist der Einsatz bei Streitfeldern. */
  const einsatz = Math.max(0, kontingent - sicht.wahl.length);
  /** Leer, teils, voll — die Ampel des Abgabeknopfs. */
  const stand = wahl.length === 0 ? 'leer' : offen === 0 ? 'voll' : 'teils';
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
            {sicht.variante === 'nebel' ? 'Nebel · Runde' : 'Offen · Runde'}
            <strong>{sicht.runde}</strong>
          </span>
          <Spielerstand sitz={gegnerSitz} zeile={zeile(gegnerSitz)} sicht={sicht} />
        </div>
      </div>

      <div className="ei-karte-huelle">
        {/*
          Die Karte nimmt die Zeiger selbst entgegen, nicht die Felder: Nur so
          laeuft ein Wischen ueber Feldgrenzen hinweg, und nur so kann ein Tipp
          ein NACHBARFELD meinen (siehe treffer). Die Felder bleiben Knoepfe —
          fuer Tastatur und Vorlesegeraet.
        */}
        <div
          ref={karteRef}
          className="ei-karte"
          style={{ gridTemplateColumns: `repeat(${sicht.spalten}, 1fr)` }}
          onPointerDown={beiZeigerAb}
          onPointerMove={beiZeigerZug}
          onPointerUp={beiZeigerAuf}
          onPointerCancel={beiZeigerAuf}
          onLostPointerCapture={beiZeigerAuf}
        >
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
            const mein = gewaehlt.has(platz);
            const kannWaehlen =
              darfPlanen && !wartet && (mein || (wahl.length < kontingent && waehlbar.has(platz)));
            const kampf = kaempfe.get(platz);
            const ornament = sicht.ornament[platz] ?? null;
            const bauwerk = sicht.bauwerk[platz] ?? null;
            const stil: React.CSSProperties & { '--ei-kampf-verzoegerung'?: string } = {
              background: imNebel
                ? (GRAUTOENE[sicht.grau[platz] ?? 0] ?? GRAUTOENE[0])
                : besitzer !== null
                  ? gebietsfarbe(besitzer)
                  : undefined,
              // Gewählt heißt: in meiner Farbe getönt. Der gelbe Rahmen im
              // Stylesheet sagt „noch nicht abgeschickt", die Tönung sagt
              // „das soll meins werden".
              backgroundImage: mein ? auswahlton(eigenerSitz) : undefined,
            };
            if (kampf) stil['--ei-kampf-verzoegerung'] = `${kampf.verzoegerung}ms`;
            return (
              <button
                key={platz}
                type="button"
                className="ei-feld"
                /*
                 * Kein `disabled`: Ein abgeschalteter Knopf verschluckt in
                 * manchen Browsern die Zeigerereignisse, die die Karte
                 * darueber auswertet — dann risse jedes Wischen an Wasser
                 * oder Nebel ab. Fuer die Tastatur ist ein Feld, das man
                 * nicht waehlen kann, trotzdem keine Schaltflaeche.
                 */
                tabIndex={kannWaehlen ? 0 : -1}
                aria-disabled={kannWaehlen ? undefined : true}
                data-art={imNebel ? 'nebel' : art === WASSER ? 'wasser' : art === BERG ? 'berg' : 'gras'}
                data-eigen={besitzer === eigenerSitz ? '' : undefined}
                data-fremd={besitzer !== null && besitzer !== eigenerSitz ? '' : undefined}
                data-waehlbar={kannWaehlen && !mein ? '' : undefined}
                data-gewaehlt={mein ? '' : undefined}
                data-abgegeben={mein && binBereit ? '' : undefined}
                data-kampf={kampf === undefined ? undefined : kampf.sieger === eigenerSitz ? 'sieg' : 'verlust'}
                style={stil}
                onClick={(ev) => beiKlick(ev, platz)}
                aria-label={feldName(art ?? null, besitzer ?? null, eigenerSitz, ornament, bauwerk)}
              >
                {ornament !== null && <Ornamentbild art={ornament} />}
                {bauwerk !== null && <Ornamentbild art={bauwerk} eingesammelt />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hier landen die fliegenden Einsaetze (siehe den Effekt oben). Ueber
          allem, ohne Zeiger — die Karte darunter bleibt bedienbar. */}
      <div ref={flugRef} className="ei-flugbuehne" aria-hidden="true" />

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
            {/*
              Dieselben drei Bausteine wie beim Planen, nur still: So bleibt
              die Fussleiste gleich hoch, und die Kachel zeigt, was auf dem
              Spiel steht — die nicht gesetzten Felder sind der Einsatz bei
              Streitfeldern, und genau von hier fliegen sie gleich los.
            */}
            <span
              className="ei-rest"
              data-leer={einsatz === 0 ? '' : undefined}
              style={einsatz > 0 ? { background: gebietsfarbe(eigenerSitz) } : undefined}
              role="status"
              aria-label={einsatz === 1 ? 'Ein Feld als Einsatz' : `${einsatz} Felder als Einsatz`}
            >
              {einsatz}
            </span>
            <button type="button" className="ei-abgeben ei-wartet" data-stand="wartet" disabled>
              Warten auf den Gegner…
            </button>
            <p className="ei-knopf ei-zuruecksetzen ei-zugsteht">
              {einsatz > 0 ? `${einsatz} ${einsatz === 1 ? 'Feld' : 'Felder'} als Einsatz` : 'Dein Zug steht.'}
            </p>
          </>
        ) : (
          <>
            {/*
              Was noch zu vergeben ist, steht als KACHEL da — in der eigenen
              Gebietsfarbe, mit der Zahl darin, grau sobald nichts mehr
              uebrig ist. Sie zaehlt MIT, waehrend man tippt: die einzige
              Rueckmeldung darauf, wie viel man noch vergeben darf.
            */}
            <span
              className="ei-rest"
              data-leer={offen === 0 ? '' : undefined}
              style={offen > 0 ? { background: gebietsfarbe(eigenerSitz) } : undefined}
              role="status"
              aria-label={offen === 1 ? 'Noch ein Feld' : `Noch ${offen} Felder`}
            >
              {offen}
            </span>
            {/*
              Die Ampel: grau ohne Auswahl (Passen), gelb mit einer
              angefangenen, gruen mit einer vollen. Der Knopf sagt damit auf
              einen Blick, ob der Zug fertig ist, ohne dass man die Kachel
              darueber lesen muss.
            */}
            <button
              type="button"
              className="ei-abgeben"
              data-stand={stand}
              disabled={wartet}
              onClick={() => onAbgeben(wahl)}
            >
              {wartet ? 'Wird gesendet…' : wahl.length === 0 ? 'Passen' : 'Abgeben'}
            </button>
            <button
              type="button"
              className="ei-knopf ei-zuruecksetzen"
              disabled={wahl.length === 0 || wartet}
              onClick={zuruecksetzen}
            >
              Zurücksetzen
            </button>
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
  bauwerk: number | null,
): string {
  if (art === null) return 'Unbekanntes Feld';
  const grund = art === WASSER ? 'Wasser' : art === BERG ? 'Berg' : 'Wiese';
  const wem =
    besitzer === null ? 'frei' : besitzer === eigenerSitz ? 'dein Gebiet' : 'gegnerisches Gebiet';
  const zier = ornament === null ? '' : ornament === 0 ? ', Stadt' : ', Brunnen';
  const bau = bauwerk === null ? '' : bauwerk === 0 ? ', mit eingesammelter Stadt' : ', mit eingesammeltem Brunnen';
  return `${grund}, ${wem}${zier}${bau}`;
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
        <li>
          Felder, die du in einer Runde <strong>nicht setzt</strong>, sind dein
          Einsatz: Bei jedem Streitfeld fliegt einer aufs Feld. Hat nur einer
          von euch einen, gewinnt er das Feld sicher; haben beide einen,
          entscheidet wieder der Münzwurf. Die Streitfelder kommen in
          zufälliger Reihenfolge dran, bis die Einsätze verbraucht sind — der
          Rest bleibt fünfzig zu fünfzig.
        </li>
        <li>Die Partie endet, wenn keiner mehr irgendwohin kann.</li>
      </ol>
      <h3>Ornamente</h3>
      <p>
        Städte und Brunnen liegen verstreut auf der Insel. Wer das Feld nimmt,
        auf dem eines steht, nimmt von da an ein Feld mehr pro Runde. Es liegen
        immer vier auf der Karte — für jedes eingesammelte rückt eines nach.
      </p>
      <h3>Zwei Spielarten</h3>
      <p>
        <strong>Im Nebel</strong> siehst du dein Gebiet und drei Felder darüber
        hinaus; alles andere liegt grau — auch für den Gegner. Auf der{' '}
        <strong>offenen Karte</strong> seht ihr beide die ganze Insel. Was auf
        dem Zettel des anderen steht, bleibt in beiden Fällen geheim.
      </p>
      <h3>Ziel</h3>
      <p>Wer am Ende die meisten Felder hält, gewinnt.</p>
    </div>
  );
}
