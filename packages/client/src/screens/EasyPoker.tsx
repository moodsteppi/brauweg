import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiError, type TableRow } from '../api';
import { cardName, isRed, rankLabel, suitSymbol } from '../i18n';
import { useTable } from '../useTable';

/**
 * Easy Poker — Texas Hold'em zu zweit bis sechst, Hochkant-Handy.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie bei Feldherr und Mememory: ohne
 * Tisch das Hauptmenue, mit Tisch der Filz. Der Tisch wird HIER gehalten und
 * nicht ueber App.tsx geroutet — die Match-Suche muss den Tisch unter
 * Umstaenden wechseln (Wettrennen-Regel weiter unten), und ein Wechsel ueber
 * zwei Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul: Dieser Bildschirm bildet KEINE Pokerregel
 * nach (DESIGN-DOKO). Die vier Schaltflaechen entstehen aus `legalActions`,
 * und was ein Mitgehen oder Erhoehen kostet, steht als Betrag in der erlaubten
 * Aktion — gerechnet hat das der Server. Der Bildschirm weiss deshalb nicht
 * einmal, was ein grosser Blind ist; er zeigt Zahlen an, die er bekommt.
 *
 * Der ganze Aufbau ist fuer eine Hand im Hochformat entworfen: Kopfzeile,
 * Gegner um den Filz, Brett in der Mitte, eigene Karten und Aktionsleiste
 * unten am Daumen. Zu sechst sitzen fuenf Gegner auf dem Oval, man selbst
 * bleibt unten — dieselbe Orientierung wie am Doppelkopftisch.
 */

// ---------------------------------------------------------------------------
// Was vom Server kommt (siehe packages/game-easypoker/src/sicht.ts)
// ---------------------------------------------------------------------------

interface Karte {
  farbe: string;
  wert: string;
  id: number;
}

interface Bewertung {
  kategorie: number;
  werte: number[];
  karten: Karte[];
}

type Aktionsart = 'passen' | 'schieben' | 'mitgehen' | 'setzen';

interface LetzteAktion {
  sitz: number;
  art: Aktionsart;
  betrag: number | null;
}

interface HandErgebnis {
  gewinner: number[];
  durchAufgabe: boolean;
  topf: number;
  gezeigt: Record<number, Karte[]>;
  bewertung: Record<number, Bewertung>;
  gewinn: Record<number, number>;
}

interface EasyPokerSicht {
  handNr: number;
  handMax: number;
  strasse: 'preflop' | 'flop' | 'turn' | 'river';
  brett: Karte[];
  meineKarten: Karte[];
  gegnerKarten: Karte[] | null;
  gegnerVerdeckt: number;
  fremdeKarten: Record<number, Karte[] | null>;
  fremdeVerdeckt: Record<number, number>;
  sitze: number[];
  imSpiel: number[];
  kleinerSitz: number;
  grosserSitz: number;
  meineStaerke: Bewertung | null;
  jetons: Record<number, number>;
  einsatz: Record<number, number>;
  topf: number;
  geber: number;
  dran: number | null;
  zuZahlen: number;
  setzKosten: number | null;
  letzteAktion: LetzteAktion | null;
  ergebnis: HandErgebnis | null;
  pauseMs: number | null;
  kleinerBlind: number;
  grosserBlind: number;
  startJetons: number;
  namen: Record<number, string>;
  fertig: boolean;
  sieger: number | null;
  leftSeats: number[];
  zuschauer: boolean;
}

type Aktion =
  | { typ: 'passen' }
  | { typ: 'schieben' }
  | { typ: 'mitgehen'; betrag: number }
  | { typ: 'setzen'; betrag: number }
  | { typ: 'name'; name: string };

// ---------------------------------------------------------------------------
// Feste Werte
// ---------------------------------------------------------------------------

const NAME_SCHLUESSEL = 'easypoker.name';
const NAME_MAX = 16;
/** Online immer 6-max: wer dazukommt, setzt sich dazu, der Rest kann mit Bots aufgefuellt werden. */
const ONLINE_SITZE = 6;

type PokerRegeln = { startJetons: number; kleinerBlind: number; grosserBlind: number };

/**
 * Drei fertige Einsaetze. Der Host kann sie uebernehmen oder die Zahlen
 * darunter selbst drehen — Buy-in und Blinds gehoeren an den Tisch, nicht
 * fest ins Spiel.
 */
const EINSATZ_VORGABEN: readonly { name: string; regelsatz: PokerRegeln }[] = [
  { name: 'Locker', regelsatz: { startJetons: 200, kleinerBlind: 2, grosserBlind: 4 } },
  { name: 'Abend', regelsatz: { startJetons: 500, kleinerBlind: 5, grosserBlind: 10 } },
  { name: 'Hoch', regelsatz: { startJetons: 2_000, kleinerBlind: 20, grosserBlind: 40 } },
];

const BUY_IN_STUFEN = [200, 500, 1_000, 2_000, 5_000] as const;
const SB_STUFEN = [1, 2, 5, 10, 25, 50, 100] as const;

const REGELSATZ_VORGABE = EINSATZ_VORGABEN[0]!.regelsatz;

function blindsZuBuyIn(buyIn: number): Pick<PokerRegeln, 'kleinerBlind' | 'grosserBlind'> {
  const kleinerBlind = Math.max(1, Math.round(buyIn / 100));
  return { kleinerBlind, grosserBlind: kleinerBlind * 2 };
}

function regelsatzOk(r: PokerRegeln): boolean {
  return r.kleinerBlind >= 1 && r.grosserBlind > r.kleinerBlind && r.startJetons >= r.grosserBlind * 10;
}

function gleicherEinsatz(zeile: TableRow, r: PokerRegeln): boolean {
  const s = zeile.stakes;
  return (
    !!s &&
    s.startJetons === r.startJetons &&
    s.kleinerBlind === r.kleinerBlind &&
    s.grosserBlind === r.grosserBlind
  );
}

function pokerFehler(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code === 'broJetonsInsufficient') {
    return 'Dafür fehlen dir BroJetons. Im Shop gibt es welche gegen Münzen.';
  }
  return fallback;
}

/**
 * Rund zwoelf Haende, auf ein Vielfaches der Sitzzahl gehoben — die Plattform
 * verlangt das, weil der Knopf jede Hand wandert.
 */
function haendeFuer(sitze: number): number {
  return Math.ceil(12 / sitze) * sitze;
}

/**
 * Die Namen der Kartenkombinationen.
 *
 * Die ZAHLEN sind Protokoll und stehen als `KATEGORIE` in
 * packages/game-easypoker/src/karten.ts. Wer sie dort verschiebt, muss sie
 * hier mitverschieben — deshalb steht die Herkunft in dieser Zeile und nicht
 * nur im Modul.
 */
const KOMBINATION: Record<number, string> = {
  1: 'Höchste Karte',
  2: 'Ein Paar',
  3: 'Zwei Paare',
  4: 'Drilling',
  5: 'Straße',
  6: 'Flush',
  7: 'Full House',
  8: 'Vierling',
  9: 'Straight Flush',
};

/** Deutsche Beschriftung der Züge — für die Sprechblase des Gegners. */
const AKTIONSWORT: Record<Aktionsart, string> = {
  passen: 'Fold',
  schieben: 'Check',
  mitgehen: 'Call',
  setzen: 'Bet',
};

const STRASSENWORT: Record<EasyPokerSicht['strasse'], string> = {
  preflop: 'Vor dem Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

type GegnerOrt = 'oben' | 'links' | 'rechts' | 'oben-links' | 'oben-rechts';

/**
 * Sitze um das Oval, immer so gedreht, dass man selbst unten sitzt.
 *
 * Die Reihenfolge ist linksherum vom eigenen Platz: wer am Tisch links sitzt,
 * steht auf dem Bildschirm links. Die fuenf Orte reichen fuer sechs Sitze;
 * weniger Gegner lassen die inneren Plaetze einfach weg.
 */
function gegnerOrte(sitze: readonly number[], ich: number): { sitz: number; ort: GegnerOrt }[] {
  const stelle = sitze.indexOf(ich);
  const andere: number[] = [];
  for (let k = 1; k < sitze.length; k++) {
    andere.push(sitze[(stelle + k + sitze.length) % sitze.length]!);
  }
  const layout: Record<number, GegnerOrt[]> = {
    1: ['oben'],
    2: ['links', 'rechts'],
    3: ['links', 'oben', 'rechts'],
    4: ['links', 'oben-links', 'oben-rechts', 'rechts'],
    5: ['links', 'oben-links', 'oben', 'oben-rechts', 'rechts'],
  };
  const orte = layout[andere.length] ?? layout[5]!;
  return andere.map((sitz, index) => ({ sitz, ort: orte[index] ?? 'oben' }));
}

function wenigerBewegung(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function gelesenerName(): string {
  try {
    return window.localStorage.getItem(NAME_SCHLUESSEL) ?? '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Karten
// ---------------------------------------------------------------------------

/**
 * Eine Spielkarte, gezeichnet und nicht geladen (DESIGN.md: "Alles gemalt,
 * nichts geladen").
 *
 * Als SVG mit fester `viewBox`, damit alles exakt mit der Kartengroesse
 * mitskaliert — von der 44 px breiten Brettkarte bis zur 100 px breiten
 * Handkarte muss keine Schriftgroesse je Platz gerechnet werden. Dasselbe
 * Verhaeltnis wie am Doppelkopftisch (`--pc-ratio` 1.452), damit Karten
 * ueberall in Brauweg gleich proportioniert sind.
 *
 * Wert und Farbe stehen oben links UND gross in der Mitte: Oben links liest
 * man sie im Fächer, in der Mitte auf einen Blick. Mehr Zeichen braucht die
 * Karte nicht — der Auftrag sagt ausdruecklich "sehr simpel".
 */
function Spielkarte({
  karte,
  hervor,
  gehoben,
  verzoegerung,
  onClick,
}: {
  karte: Karte;
  /** Teil der gewerteten Kombination — bekommt den goldenen Rand. */
  hervor?: boolean;
  gehoben?: boolean;
  verzoegerung?: number;
  onClick?: () => void;
}): React.JSX.Element {
  /*
   * Das Spielmodul nennt die Felder deutsch (`farbe`/`wert`), die
   * Kartenhelfer der Plattform erwarten die Namen des Kartenprotokolls
   * (`suit`/`rank`). Umbenannt wird an dieser einen Stelle — so bleiben
   * Farbzeichen, Wertkuerzel und Vorlese-Name im ganzen Produkt dieselben,
   * ohne dass das Modul die englische Schreibweise uebernehmen muss.
   */
  const alsBlatt = { suit: karte.farbe, rank: karte.wert };
  const rot = isRed(alsBlatt);
  const zeichen = suitSymbol(karte.farbe);
  const wert = rankLabel(karte.wert);
  const Element = onClick ? 'button' : 'span';

  return (
    <Element
      className={`poker-karte${rot ? ' is-rot' : ''}`}
      data-hervor={hervor || undefined}
      data-gehoben={gehoben || undefined}
      style={verzoegerung ? ({ '--poker-ab': `${verzoegerung}ms` } as React.CSSProperties) : undefined}
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
      aria-label={cardName(alsBlatt)}
    >
      <svg viewBox="0 0 100 145" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect className="poker-karte-grund" x="1.5" y="1.5" width="97" height="142" rx="11" />
        {/* Die Zehn ist zweistellig und braucht eine kleinere Schrift, sonst
            schneidet der Kartenrand ihre Eins ab — aus der Zehn wuerde eine
            Null. Dieselbe Falle wie in CardFace.tsx. */}
        <text
          className="poker-tinte"
          x="13"
          y="36"
          fontSize={wert.length > 1 ? 26 : 32}
          fontWeight="800"
        >
          {wert}
        </text>
        <text className="poker-tinte" x="13" y="60" fontSize="23">
          {zeichen}
        </text>
        <text className="poker-tinte" x="58" y="112" fontSize="60" textAnchor="middle">
          {zeichen}
        </text>
      </svg>
    </Element>
  );
}

/** Die Rueckseite: fremde Handkarten. Dieselbe Groesse, dieselbe Form. */
function Kartenruecken({ verzoegerung }: { verzoegerung?: number }): React.JSX.Element {
  return (
    <span
      className="poker-karte is-ruecken"
      style={verzoegerung ? ({ '--poker-ab': `${verzoegerung}ms` } as React.CSSProperties) : undefined}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 145" preserveAspectRatio="xMidYMid meet">
        <rect className="poker-ruecken-grund" x="1.5" y="1.5" width="97" height="142" rx="11" />
        <rect className="poker-ruecken-rand" x="9" y="9" width="82" height="127" rx="7" />
        <path className="poker-ruecken-raute" d="M50 42 L72 72 L50 102 L28 72 Z" />
        <path className="poker-ruecken-raute is-innen" d="M50 57 L62 72 L50 87 L38 72 Z" />
      </svg>
    </span>
  );
}

/**
 * Ein leerer Brettplatz.
 *
 * Er steht schon da, bevor die Karte kommt. Ohne ihn springt das ganze
 * Layout, sobald der Flop faellt — und auf einem kurzen Bildschirm ist ein
 * Sprung von drei Kartenbreiten der Unterschied zwischen "passt" und
 * "abgeschnitten".
 */
function LeererPlatz(): React.JSX.Element {
  return (
    <span className="poker-karte is-leer" aria-hidden="true">
      <svg viewBox="0 0 100 145" preserveAspectRatio="xMidYMid meet">
        <rect x="2" y="2" width="96" height="141" rx="11" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Zahlen, die sich bewegen
// ---------------------------------------------------------------------------

/**
 * Eine Zahl, die zu ihrem neuen Wert laeuft, statt zu springen.
 *
 * Der Jetonstand ist die einzige Zahl auf dem Bildschirm, an der man den
 * Ausgang einer Hand abliest. Ein Sprung von 196 auf 172 ist eine Information,
 * die man verpassen kann; ein Lauf ueber eine halbe Sekunde nicht.
 *
 * Unter "weniger Bewegung" faellt der Lauf ersatzlos weg (DESIGN.md, keine
 * Ausnahme).
 */
function useLaufendeZahl(ziel: number): number {
  const [wert, setWert] = useState(ziel);
  const stand = useRef(ziel);

  useEffect(() => {
    const start = stand.current;
    if (start === ziel) return;

    /*
     * Kein Lauf, wo kein Bildtakt kommt.
     *
     * Ein verdeckter Tab bekommt keine `requestAnimationFrame` — und ein
     * Handybrowser drosselt sie, sobald man kurz woanders hinsieht. Die Zahl
     * ist aber keine Zierde, sondern die einzige Stelle, an der man den
     * Ausgang einer Hand abliest. Sie muss also auch dann stimmen, wenn nie
     * ein Bild gezeichnet wird.
     */
    if (wenigerBewegung() || document.visibilityState !== 'visible') {
      stand.current = ziel;
      setWert(ziel);
      return;
    }

    let laeuft = true;
    const beginn = performance.now();
    const dauer = 520;
    const schritt = (jetzt: number): void => {
      if (!laeuft) return;
      const anteil = Math.min(1, (jetzt - beginn) / dauer);
      // Weich auslaufen: schnell los, sanft ankommen.
      const weich = 1 - Math.pow(1 - anteil, 3);
      const aktuell = Math.round(start + (ziel - start) * weich);
      stand.current = aktuell;
      setWert(aktuell);
      if (anteil < 1) window.requestAnimationFrame(schritt);
    };
    window.requestAnimationFrame(schritt);

    /*
     * Sicherheitsnetz. Wird der Tab genau zwischen Effektstart und erstem Bild
     * verdeckt, laeuft `schritt` nie an, und die Zahl bliebe auf einem alten
     * Stand stehen — beim Prüfen im verdeckten Fenster ist genau das passiert:
     * Topf und Jetons klebten über vier Hände hinweg auf ihrem ersten Wert.
     * Eine Uhr wird zwar auch gedrosselt, aber sie kommt.
     */
    const netz = window.setTimeout(() => {
      if (!laeuft) return;
      stand.current = ziel;
      setWert(ziel);
    }, dauer + 140);

    return () => {
      laeuft = false;
      window.clearTimeout(netz);
      // Der naechste Lauf beginnt beim Ziel und nicht mittendrin, sonst
      // laufen zwei schnelle Aenderungen gegeneinander.
      stand.current = ziel;
    };
  }, [ziel]);

  return wert;
}

function Jetonzahl({ wert }: { wert: number }): React.JSX.Element {
  return <span className="poker-jetons">{useLaufendeZahl(wert)}</span>;
}

function Einsatzwahl({
  regelsatz,
  onChange,
}: {
  regelsatz: PokerRegeln;
  onChange: (r: PokerRegeln) => void;
}): React.JSX.Element {
  const vorgabe = EINSATZ_VORGABEN.find(
    (v) =>
      v.regelsatz.startJetons === regelsatz.startJetons &&
      v.regelsatz.kleinerBlind === regelsatz.kleinerBlind &&
      v.regelsatz.grosserBlind === regelsatz.grosserBlind,
  );
  const bbStufen = [...new Set(SB_STUFEN.map((n) => n * 2))];

  return (
    <section className="poker-einsatz">
      <div className="poker-sitze-wahl" role="group" aria-label="Einsatzvorgabe">
        {EINSATZ_VORGABEN.map((v) => (
          <button
            key={v.name}
            className="poker-sitze-knopf"
            type="button"
            data-an={vorgabe?.name === v.name || undefined}
            onClick={() => onChange(v.regelsatz)}
          >
            {v.name}
          </button>
        ))}
      </div>
      <p className="poker-einsatz-zeile">
        Mindestens {regelsatz.startJetons} · Blinds {regelsatz.kleinerBlind}/
        {regelsatz.grosserBlind}
      </p>
      <div className="poker-sitze-wahl" role="group" aria-label="Mindest-BroJetons">
        {BUY_IN_STUFEN.map((zahl) => (
          <button
            key={zahl}
            className="poker-sitze-knopf"
            type="button"
            data-an={regelsatz.startJetons === zahl || undefined}
            onClick={() => onChange({ startJetons: zahl, ...blindsZuBuyIn(zahl) })}
          >
            {zahl}
          </button>
        ))}
      </div>
      <p className="poker-sitze-text">Mindest-BroJetons</p>
      <div className="poker-sitze-wahl" role="group" aria-label="Small Blind">
        {SB_STUFEN.map((zahl) => (
          <button
            key={zahl}
            className="poker-sitze-knopf"
            type="button"
            data-an={regelsatz.kleinerBlind === zahl || undefined}
            onClick={() =>
              onChange({ ...regelsatz, kleinerBlind: zahl, grosserBlind: zahl * 2 })
            }
          >
            {zahl}
          </button>
        ))}
      </div>
      <p className="poker-sitze-text">Small Blind</p>
      <div className="poker-sitze-wahl" role="group" aria-label="Big Blind">
        {bbStufen.map((zahl) => (
          <button
            key={zahl}
            className="poker-sitze-knopf"
            type="button"
            data-an={regelsatz.grosserBlind === zahl || undefined}
            onClick={() => onChange({ ...regelsatz, grosserBlind: zahl })}
          >
            {zahl}
          </button>
        ))}
      </div>
      <p className="poker-sitze-text">Big Blind</p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Der Bildschirm
// ---------------------------------------------------------------------------

export function EasyPoker({
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
  const [sitzeWahl, setSitzeWahl] = useState(2);
  const [fehler, setFehler] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);
  const [regelsatz, setRegelsatz] = useState<PokerRegeln>(REGELSATZ_VORGABE);
  const [broJetons, setBroJetons] = useState<number | null>(null);
  const [lobbyOffen, setLobbyOffen] = useState(false);
  const [tische, setTische] = useState<TableRow[] | null>(null);
  const [tischEinsatz, setTischEinsatz] = useState<PokerRegeln | null>(null);
  /** Angetippte eigene Karte — sie hebt sich an, damit man sie besser sieht. */
  const [gehobeneKarte, setGehobeneKarte] = useState<number | null>(null);
  /**
   * Revision, bei der ich zuletzt eine Aktion abgeschickt habe.
   *
   * Solange keine neuere Sicht da ist, sind die Knoepfe gesperrt — sonst
   * provoziert ein stummer Knopf das Doppeltippen (DESIGN-DOKO,
   * "Rueckmeldung"). An die Revision gehaengt und nicht an den Inhalt: Treffen
   * zwei Sichten im selben Takt ein, fasst React sie zusammen, und eine
   * Zwischenstufe wird nie gerendert.
   */
  const [gesendetBei, setGesendetBei] = useState<number | null>(null);

  const tisch = useTable<EasyPokerSicht>(tischId, 'easypoker');
  const sicht = tisch.view?.view ?? null;
  const eigenerSitz = tisch.view?.seat ?? 0;
  const sitzeAmTisch = sicht?.sitze ?? tisch.table?.seats.map((platz) => platz.seat) ?? [0, 1];
  const revision = tisch.view?.revision ?? -1;

  useEffect(() => {
    if (gesendetBei !== null && revision !== gesendetBei) setGesendetBei(null);
  }, [revision, gesendetBei]);

  // -------------------------------------------------------------------------
  // Aktive Spieler
  // -------------------------------------------------------------------------

  // Auch im Wartebereich weiterzaehlen: Dort steht die Zahl noch einmal, und
  // eine eingefrorene Null waehrend der Suche sieht aus, als suchte man allein.
  useEffect(() => {
    if (sicht) return;
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveSpieler('easypoker')
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

  useEffect(() => {
    if (sicht) return;
    let lebt = true;
    void api
      .me()
      .then((konto) => {
        if (lebt) setBroJetons(konto.broJetons);
      })
      .catch(() => {
        /* Der Stand ist Beiwerk. Ohne ihn bleibt der Knopf, der Server prueft. */
      });
    return () => {
      lebt = false;
    };
  }, [sicht !== null, tischId]);

  useEffect(() => {
    if (!tischId || sicht) return;
    let lebt = true;
    void api
      .tableRules(tischId)
      .then((antwort) => {
        const s = antwort.config;
        if (
          lebt &&
          typeof s.startJetons === 'number' &&
          typeof s.kleinerBlind === 'number' &&
          typeof s.grosserBlind === 'number'
        ) {
          setTischEinsatz({
            startJetons: s.startJetons,
            kleinerBlind: s.kleinerBlind,
            grosserBlind: s.grosserBlind,
          });
        }
      })
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, [tischId, sicht !== null]);

  // -------------------------------------------------------------------------
  // Einstieg
  // -------------------------------------------------------------------------

  /**
   * Sofort spielen: eigener Tisch, freier Platz mit einem Bot besetzt.
   *
   * `visibility: 'on_request'` ist hier kein Detail. Ein oeffentlicher Tisch
   * stuende in der Lobbyliste, und wer gerade nach einem Menschen sucht,
   * landete mitten in einer laufenden Botpartie.
   */
  const sofortSpielen = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const { id } = await api.createTable({
        gameId: 'easypoker',
        config: regelsatz,
        seats: sitzeWahl,
        rounds: haendeFuer(sitzeWahl),
        visibility: 'on_request',
        fillWithBots: true,
      });
      setEigenerTisch(null);
      setTischId(id);
    } catch (err) {
      setSucht(false);
      setFehler(pokerFehler(err, 'Der Tisch liess sich nicht aufmachen. Noch einmal versuchen?'));
    }
  }, [sitzeWahl, regelsatz]);

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
      const zeilen = await api.tables('easypoker');
      const offen = zeilen
        .filter(
          (zeile) =>
            zeile.occupied < zeile.seats &&
            gleicherEinsatz(zeile, regelsatz) &&
            (broJetons === null || broJetons >= regelsatz.startJetons),
        )
        .sort((a, b) => b.occupied - a.occupied || a.id.localeCompare(b.id));
      const ziel = offen[0];
      if (ziel) {
        await api.joinTable(ziel.id);
        setEigenerTisch(null);
        setLobbyOffen(false);
        setTischId(ziel.id);
        return;
      }
      const { id } = await api.createTable({
        gameId: 'easypoker',
        config: regelsatz,
        seats: ONLINE_SITZE,
        rounds: haendeFuer(ONLINE_SITZE),
      });
      setEigenerTisch(id);
      setLobbyOffen(false);
      setTischId(id);
    } catch (err) {
      setSucht(false);
      setFehler(pokerFehler(err, 'Die Suche ist fehlgeschlagen. Noch einmal versuchen?'));
    }
  }, [regelsatz, broJetons]);

  const oeffneLobby = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLobbyOffen(true);
    setTische(null);
    try {
      setTische(await api.tables('easypoker'));
    } catch {
      setFehler('Die Tischliste liess sich nicht laden.');
      setTische([]);
    }
  }, []);

  const trittBei = useCallback(
    async (id: string): Promise<void> => {
      setFehler(null);
      setSucht(true);
      try {
        await api.joinTable(id);
        setEigenerTisch(null);
        setLobbyOffen(false);
        setTischId(id);
      } catch (err) {
        setSucht(false);
        setFehler(pokerFehler(err, 'Der Platz ist weg. Einen anderen Tisch versuchen?'));
        void oeffneLobby();
      }
    },
    [oeffneLobby],
  );

  const eigenenTisch = useCallback(async (): Promise<void> => {
    setFehler(null);
    setSucht(true);
    try {
      const { id } = await api.createTable({
        gameId: 'easypoker',
        config: regelsatz,
        seats: ONLINE_SITZE,
        rounds: haendeFuer(ONLINE_SITZE),
      });
      setEigenerTisch(id);
      setLobbyOffen(false);
      setTischId(id);
    } catch (err) {
      setSucht(false);
      setFehler(pokerFehler(err, 'Der Tisch liess sich nicht aufmachen. Noch einmal versuchen?'));
    }
  }, [regelsatz]);

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
        .tables('easypoker')
        .then(async (zeilen: TableRow[]) => {
          if (!lebt || wechseltGerade.current) return;
          const kleiner = zeilen
            .filter(
              (z) => z.occupied < z.seats && z.id < tischId && gleicherEinsatz(z, regelsatz),
            )
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
  }, [tischId, eigenerTisch, tisch.table?.status, regelsatz]);

  const brichAb = useCallback((): void => {
    const id = tischId;
    setSucht(false);
    setTischId(null);
    setEigenerTisch(null);
    setLobbyOffen(false);
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  const nochEineRunde = useCallback((): void => {
    setGesendetBei(null);
    setGehobeneKarte(null);
    setTischId(null);
    setEigenerTisch(null);
    setSucht(false);
  }, []);

  // -------------------------------------------------------------------------
  // Name
  // -------------------------------------------------------------------------

  /** Den eigenen Namen einmal an die Partie reichen, sobald sie steht. */
  const nameGesendet = useRef<string | null>(null);
  useEffect(() => {
    if (!sicht || !tischId) return;
    const gewuenscht = name.trim();
    if (!gewuenscht || nameGesendet.current === `${tischId}:${gewuenscht}`) return;
    nameGesendet.current = `${tischId}:${gewuenscht}`;
    tisch.send({ typ: 'name', name: gewuenscht } satisfies Aktion);
  }, [sicht !== null, tischId, name]);

  const merkeName = (roh: string): void => {
    const gekuerzt = [...roh].slice(0, NAME_MAX).join('');
    setName(gekuerzt);
    try {
      window.localStorage.setItem(NAME_SCHLUESSEL, gekuerzt);
    } catch {
      /* Privater Modus: der Name gilt dann nur fuer diese Sitzung. */
    }
  };

  // -------------------------------------------------------------------------
  // Der Gewinn einer Hand, kurz eingeblendet
  // -------------------------------------------------------------------------

  const [flug, setFlug] = useState<{ id: number; betrag: number } | null>(null);
  const flugNr = useRef(0);
  const letztesErgebnis = useRef<string | null>(null);
  useEffect(() => {
    const marke = sicht?.ergebnis ? `${sicht.handNr}` : null;
    if (marke === null || marke === letztesErgebnis.current) {
      if (marke === null) letztesErgebnis.current = null;
      return;
    }
    letztesErgebnis.current = marke;
    const betrag = sicht?.ergebnis?.gewinn[eigenerSitz] ?? 0;
    const id = (flugNr.current += 1);
    setFlug({ id, betrag });
    const uhr = window.setTimeout(() => {
      setFlug((alt) => (alt && alt.id === id ? null : alt));
    }, 1900);
    return () => window.clearTimeout(uhr);
  }, [sicht?.ergebnis, sicht?.handNr, eigenerSitz]);

  const infoKnopf = (wo: 'menue' | 'tisch') => (
    <button
      className={wo === 'menue' ? 'poker-info' : 'poker-info is-tisch'}
      type="button"
      onClick={() => setRegelnOffen(true)}
      aria-label="Regeln nachlesen"
    >
      <b aria-hidden="true">i</b>
      <span>Info</span>
    </button>
  );

  // -------------------------------------------------------------------------
  // Hauptmenue
  // -------------------------------------------------------------------------

  if (!tischId) {
    const reicht = broJetons === null || broJetons >= regelsatz.startJetons;
    const startbar = reicht && regelsatzOk(regelsatz) && !sucht;

    if (lobbyOffen) {
      const liste = tische ?? [];
      return (
        <main className="poker-menue">
          <button
            className="poker-zurueck"
            type="button"
            onClick={() => {
              setLobbyOffen(false);
              setFehler(null);
            }}
          >
            ← Zurück
          </button>
          {infoKnopf('menue')}
          <div className="poker-menue-mitte">
            <h1 className="poker-titel">
              Online-<span>Tisch</span>
            </h1>
            <p className="poker-untertitel">
              Einsatz {regelsatz.startJetons} · Blinds {regelsatz.kleinerBlind}/
              {regelsatz.grosserBlind}
            </p>
            {tische === null ? (
              <p className="poker-sitze-text">Tische werden geladen…</p>
            ) : liste.length === 0 ? (
              <p className="poker-sitze-text">Gerade kein offener Tisch.</p>
            ) : (
              <ul className="poker-lobby">
                {liste.map((zeile) => {
                  const buyIn = zeile.stakes?.startJetons ?? regelsatz.startJetons;
                  const zuTeuer = broJetons !== null && broJetons < buyIn;
                  return (
                    <li key={zeile.id}>
                      <button
                        className="poker-lobby-zeile"
                        type="button"
                        disabled={sucht || zuTeuer}
                        onClick={() => void trittBei(zeile.id)}
                      >
                        <strong>{zeile.host ?? 'Tisch'}</strong>
                        <em>
                          {zeile.occupied}/{zeile.seats}
                          {zeile.stakes
                            ? ` · ${zeile.stakes.startJetons} · ${zeile.stakes.kleinerBlind}/${zeile.stakes.grosserBlind}`
                            : ''}
                          {zuTeuer ? ' · zu hoch' : ''}
                        </em>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              className="poker-hauptknopf"
              type="button"
              onClick={() => void suche()}
              disabled={!startbar}
            >
              <span>Passenden Tisch suchen</span>
              <em>gleicher Einsatz · sonst neu aufmachen</em>
            </button>
            <button
              className="poker-zweitknopf"
              type="button"
              onClick={() => void eigenenTisch()}
              disabled={!startbar}
            >
              <span>Eigenen Tisch aufmachen</span>
              <em>6 Plätze · deine Blinds</em>
            </button>
            {fehler && <p className="poker-fehler">{fehler}</p>}
          </div>
          {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
        </main>
      );
    }

    return (
      <main className="poker-menue">
        {/* Der Zurueck-Knopf sitzt bewusst nicht ganz oben: Auf iPhones mit
            Notch liegt die obere Ecke unter der Statusleiste. */}
        <button className="poker-zurueck" type="button" onClick={onBack}>
          ← Zurück
        </button>
        {infoKnopf('menue')}

        <div className="poker-menue-mitte">
          <h1 className="poker-titel">
            <span>Poker</span>
          </h1>
          <p className="poker-untertitel">Zwei Karten, bis zu sechs am Tisch, vier Knöpfe.</p>

          <p className="poker-guthaben" aria-label={`${broJetons ?? '…'} BroJetons`}>
            <span className="poker-jeton-zeichen" aria-hidden="true" />
            <strong>{broJetons ?? '…'}</strong>
            <em>BroJetons</em>
          </p>

          <input
            className="poker-namensfeld"
            type="text"
            inputMode="text"
            enterKeyHint="done"
            maxLength={NAME_MAX}
            placeholder="Name…"
            value={name}
            onChange={(e) => merkeName(e.target.value)}
          />

          <Einsatzwahl regelsatz={regelsatz} onChange={setRegelsatz} />

          <div className="poker-sitze-wahl" role="group" aria-label="Spielerzahl">
            {[2, 3, 4, 5, 6].map((zahl) => (
              <button
                key={zahl}
                className="poker-sitze-knopf"
                type="button"
                data-an={sitzeWahl === zahl || undefined}
                onClick={() => setSitzeWahl(zahl)}
              >
                {zahl}
              </button>
            ))}
          </div>
          <p className="poker-sitze-text">
            {sitzeWahl === 2 ? 'Du gegen den Computer' : `Du und ${sitzeWahl - 1} Computer`}
          </p>

          <button
            className="poker-hauptknopf"
            type="button"
            onClick={() => void sofortSpielen()}
            disabled={!startbar}
          >
            <span>Sofort spielen</span>
            <em>gegen den Computer · {sitzeWahl} Plätze</em>
          </button>

          <button
            className="poker-zweitknopf"
            type="button"
            onClick={() => void oeffneLobby()}
            disabled={sucht}
          >
            <span>Online spielen</span>
            <em>({aktiv ?? '…'})</em>
          </button>

          {!reicht && (
            <p className="poker-fehler">
              Für diesen Einsatz brauchst du {regelsatz.startJetons} BroJetons. Im Shop gibt es
              welche gegen Münzen.
            </p>
          )}
          {fehler && <p className="poker-fehler">{fehler}</p>}
        </div>

        {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Wartebereich
  // -------------------------------------------------------------------------

  if (!sicht) {
    const plaetze = tisch.table?.seats ?? [];
    const besetzt = plaetze.filter((platz) => platz.accountId).length;
    const frei = plaetze.filter((platz) => !platz.accountId && !platz.isBot);
    const gesamt = plaetze.length || ONLINE_SITZE;
    return (
      <main className="poker-menue">
        <button className="poker-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        {infoKnopf('menue')}
        <div className="poker-menue-mitte">
          <h1 className="poker-titel">
            Am <span>Tisch</span>
          </h1>
          <p className="poker-untertitel">
            {tisch.status === 'open'
              ? `${besetzt} von ${gesamt} Plätzen besetzt`
              : 'Verbindung wird aufgebaut…'}
            {tischEinsatz
              ? ` · ${tischEinsatz.startJetons} · ${tischEinsatz.kleinerBlind}/${tischEinsatz.grosserBlind}`
              : ''}
          </p>
          {plaetze.length > 0 && (
            <ul className="poker-warte-sitze">
              {plaetze.map((platz) => (
                <li key={platz.seat} data-leer={!platz.accountId && !platz.isBot || undefined}>
                  {platz.displayName || (platz.isBot ? 'Computer' : 'Frei')}
                </li>
              ))}
            </ul>
          )}
          <div className="poker-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {tisch.status === 'open' && frei.length > 0 && (
            <button
              className="poker-zweitknopf"
              type="button"
              onClick={() => frei.forEach((platz) => tisch.addBot(platz.seat))}
            >
              <span>Mit Computern auffüllen</span>
              <em>und loslegen</em>
            </button>
          )}
          <p className="poker-untertitel">{aktiv ?? '…'} Spieler gerade am Tisch</p>
        </div>
        {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Tisch
  // -------------------------------------------------------------------------

  const meinZug = sicht.dran === eigenerSitz && !sicht.fertig;
  const wartet = gesendetBei !== null;
  /*
   * Die erlaubten Zuege kommen aus der Nachrichtenhuelle und sind dort
   * bewusst untypisiert (jedes Spiel hat andere). Der Umweg ueber `unknown`
   * ist deshalb kein Trick, sondern die Stelle, an der aus einer
   * Plattformnachricht eine Poker-Aktion wird.
   */
  const erlaubt = (tisch.view?.legalActions ?? []) as unknown as Aktion[];
  const findeZug = (typ: Aktion['typ']): Aktion | undefined =>
    erlaubt.find((zug) => zug.typ === typ);

  const schicke = (zug: Aktion | undefined): void => {
    if (!zug || !meinZug || wartet) return;
    setGesendetBei(revision);
    tisch.send(zug);
  };

  const namenVon = (sitz: number): string =>
    sicht.namen[sitz] ||
    tisch.table?.seats.find((platz) => platz.seat === sitz)?.displayName ||
    (sitz === eigenerSitz ? 'Du' : `Platz ${sitz + 1}`);

  const istBotVon = (sitz: number): boolean =>
    tisch.table?.seats.find((platz) => platz.seat === sitz)?.isBot ?? false;

  /** Karten, die zur gewerteten Kombination gehoeren — sie bekommen Gold. */
  const hervorgehoben = new Set<number>(
    (sicht.ergebnis && !sicht.ergebnis.durchAufgabe
      ? (sicht.ergebnis.gewinner.flatMap(
          (sitz) => sicht.ergebnis?.bewertung[sitz]?.karten ?? [],
        ) as Karte[])
      : []
    ).map((karte) => karte.id),
  );

  const ergebnis = sicht.ergebnis;
  const gegner = gegnerOrte(sitzeAmTisch, eigenerSitz);
  const dranName =
    sicht.dran === null
      ? ''
      : sicht.dran === eigenerSitz
        ? 'Du bist dran'
        : `${namenVon(sicht.dran)} überlegt…`;

  return (
    <main className="poker-buehne" data-dran={meinZug ? 'ich' : 'gegner'} data-sitze={sitzeAmTisch.length}>
      {/* Der Filz ist gemalt und nicht geladen: zwei weiche Lichtkegel auf
          dunklem Gruen, dazu die Holzkante am Rand. Ein Bild waere hier
          hundert Kilobyte fuer eine Flaeche, die niemand ansieht. */}
      <div className="poker-filz" aria-hidden="true" />

      <header className="poker-kopf">
        <button
          className="poker-rund"
          type="button"
          onClick={onBack}
          aria-label="Spiel verlassen"
        >
          ←
        </button>
        <div className="poker-marke">
          <strong>
            <span>Poker</span>
          </strong>
          <em>
            Hand {sicht.handNr}/{sicht.handMax} · {STRASSENWORT[sicht.strasse]} · {sitzeAmTisch.length}
          </em>
        </div>
        <div className="poker-kopfstand" aria-label="Dein Punktestand">
          <span className="poker-jeton-zeichen" aria-hidden="true" />
          <Jetonzahl wert={sicht.jetons[eigenerSitz] ?? 0} />
        </div>
        {infoKnopf('tisch')}
      </header>

      {/*
       * Alles zwischen Kopfzeile und Aktionsleiste liegt auf EINER
       * Tischplatte: die Gegner um das Oval, das Brett in der Mitte, die
       * eigene Hand an der unteren Kante. Derselbe Aufbau wie am
       * Doppelkopftisch: dunkle Stube oben und unten, Filz dazwischen.
       */}
      <div className="poker-tischflaeche" data-sitze={sitzeAmTisch.length}>
      {gegner.map(({ sitz, ort }) => (
        <Fremdsitz
          key={sitz}
          ort={ort}
          name={namenVon(sitz)}
          bot={istBotVon(sitz)}
          jetons={sicht.jetons[sitz] ?? 0}
          einsatz={sicht.einsatz[sitz] ?? 0}
          karten={sicht.fremdeKarten[sitz] ?? null}
          verdeckt={sicht.fremdeVerdeckt[sitz] ?? 0}
          geber={sicht.geber === sitz}
          klein={sicht.kleinerSitz === sitz && sitzeAmTisch.length > 2}
          gross={sicht.grosserSitz === sitz}
          aktiv={sicht.dran === sitz}
          dabei={sicht.imSpiel.includes(sitz)}
          pleite={(sicht.jetons[sitz] ?? 0) <= 0 && !sicht.imSpiel.includes(sitz)}
          aktion={sicht.letzteAktion?.sitz === sitz ? sicht.letzteAktion : null}
          hervorgehoben={hervorgehoben}
          handNr={sicht.handNr}
          revision={revision}
        />
      ))}

      {/* --- Tischmitte --------------------------------------------------- */}
      <section className="poker-mitte">
        <div className="poker-topf" data-leer={sicht.topf === 0 || undefined}>
          <span>Topf</span>
          <b>
            <Jetonzahl wert={sicht.topf} />
          </b>
        </div>

        <div className="poker-brett">
          {Array.from({ length: 5 }, (_, platz) => {
            const karte = sicht.brett[platz];
            if (!karte) return <LeererPlatz key={`leer-${platz}`} />;
            return (
              <Spielkarte
                key={karte.id}
                karte={karte}
                hervor={hervorgehoben.has(karte.id)}
                verzoegerung={platz < 3 ? platz * 110 : 0}
              />
            );
          })}
        </div>

        {ergebnis ? (
          <Ergebnisband
            ergebnis={ergebnis}
            eigenerSitz={eigenerSitz}
            fertig={sicht.fertig}
          />
        ) : (
          /*
             Zwei Zeilen, weil es zwei Fragen sind: "Was habe ich?" und "Wer
             ist dran?". Der erste Anlauf zeigte nur eine — sobald der Flop
             lag, verdraengte die Handstaerke den Zughinweis, und wer nicht
             auf die Knopfleiste sah, wusste nicht mehr, ob er wartet.
          */
          <p className="poker-hinweis">
            {sicht.meineStaerke && (
              <b>{KOMBINATION[sicht.meineStaerke.kategorie] ?? ''}</b>
            )}
            <span>{meinZug ? 'Du bist dran' : dranName || 'Es wird gezeigt…'}</span>
          </p>
        )}
      </section>

      {/* --- Eigener Sitz -------------------------------------------------- */}
      <section className="poker-sitz is-ich" data-aktiv={meinZug || undefined}>
        <Einsatzmarke betrag={sicht.einsatz[eigenerSitz] ?? 0} />
        <div className="poker-sitz-text">
          <span className="poker-sitz-name">
            {namenVon(eigenerSitz)}
            {sicht.geber === eigenerSitz && <b className="poker-knopfmarke">Geber</b>}
            {sicht.kleinerSitz === eigenerSitz && sitzeAmTisch.length > 2 && (
              <b className="poker-knopfmarke">SB</b>
            )}
            {sicht.grosserSitz === eigenerSitz && <b className="poker-knopfmarke">BB</b>}
          </span>
        </div>
        <div className="poker-hand">
          {sicht.meineKarten.map((karte, i) => (
            <Spielkarte
              key={`${sicht.handNr}-${i}`}
              karte={karte}
              hervor={hervorgehoben.has(karte.id)}
              gehoben={gehobeneKarte === karte.id}
              verzoegerung={i * 110}
              onClick={() => setGehobeneKarte((alt) => (alt === karte.id ? null : karte.id))}
            />
          ))}
        </div>
        {flug && (
          <span className="poker-flug" key={flug.id} data-plus={flug.betrag >= 0 || undefined}>
            {flug.betrag >= 0 ? '+' : '−'}
            {Math.abs(flug.betrag)}
          </span>
        )}
      </section>
      </div>

      {/* --- Aktionen ------------------------------------------------------ */}
      <footer className="poker-aktionen" data-an={meinZug && !wartet ? 'true' : undefined}>
        <Aktionsknopf
          art="fold"
          wort="Fold"
          zug={findeZug('passen')}
          gesperrt={!meinZug || wartet}
          onClick={schicke}
        />
        <Aktionsknopf
          art="check"
          wort="Check"
          zug={findeZug('schieben')}
          gesperrt={!meinZug || wartet}
          onClick={schicke}
        />
        <Aktionsknopf
          art="call"
          wort="Call"
          zug={findeZug('mitgehen')}
          gesperrt={!meinZug || wartet}
          onClick={schicke}
        />
        <Aktionsknopf
          art="bet"
          wort="Bet"
          zug={findeZug('setzen')}
          gesperrt={!meinZug || wartet}
          onClick={schicke}
        />
      </footer>

      {tisch.error && <div className="poker-fehlerpille">{tisch.error}</div>}
      {tisch.status !== 'open' && <div className="poker-funk">Verbindung…</div>}

      {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}

      {sicht.fertig && (
        <div className="poker-ende">
          <div className="poker-ende-blatt">
            <h2>
              {sicht.sieger === null
                ? 'Unentschieden'
                : sicht.sieger === eigenerSitz
                  ? 'Gewonnen!'
                  : 'Verloren'}
            </h2>
            <ol className="poker-ende-liste">
              {sitzeAmTisch
                .slice()
                .sort((a, b) => (sicht.jetons[b] ?? 0) - (sicht.jetons[a] ?? 0))
                .map((sitz) => (
                  <li key={sitz} data-mein={sitz === eigenerSitz || undefined}>
                    <span>{namenVon(sitz)}</span>
                    <b>{sicht.jetons[sitz] ?? 0}</b>
                  </li>
                ))}
            </ol>
            <p className="poker-ende-text">
              {sicht.handNr} von {sicht.handMax} Händen gespielt · Start waren{' '}
              {sicht.startJetons} Jetons
            </p>
            <button className="poker-hauptknopf" type="button" onClick={nochEineRunde}>
              <span>Noch eine Runde</span>
            </button>
            <button className="poker-textknopf" type="button" onClick={onBack}>
              Zurück zur Spielauswahl
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Der Einsatz eines Sitzes in dieser Strasse, als Jetonmarke am Tischrand. */
function Einsatzmarke({ betrag }: { betrag: number }): React.JSX.Element | null {
  if (betrag <= 0) return null;
  return (
    <span className="poker-einsatz">
      <span className="poker-jeton-zeichen" aria-hidden="true" />
      {betrag}
    </span>
  );
}

/**
 * Ein fremder Sitz auf dem Oval.
 *
 * Klein und absolut gesetzt, damit fuenf davon um die Brettkarten herum
 * passen. Der eigene Sitz bleibt unten gross — dort liest man die Hand.
 */
function Fremdsitz({
  ort,
  name,
  bot,
  jetons,
  einsatz,
  karten,
  verdeckt,
  geber,
  klein,
  gross,
  aktiv,
  dabei,
  pleite,
  aktion,
  hervorgehoben,
  handNr,
  revision,
}: {
  ort: GegnerOrt;
  name: string;
  bot: boolean;
  jetons: number;
  einsatz: number;
  karten: Karte[] | null;
  verdeckt: number;
  geber: boolean;
  klein: boolean;
  gross: boolean;
  aktiv: boolean;
  dabei: boolean;
  pleite: boolean;
  aktion: LetzteAktion | null;
  hervorgehoben: Set<number>;
  handNr: number;
  revision: number;
}): React.JSX.Element {
  return (
    <section
      className="poker-sitz is-fremd"
      data-ort={ort}
      data-aktiv={aktiv || undefined}
      data-raus={!dabei || undefined}
      data-pleite={pleite || undefined}
    >
      <div className="poker-sitz-karten">
        {karten
          ? karten.map((karte) => (
              <Spielkarte key={karte.id} karte={karte} hervor={hervorgehoben.has(karte.id)} />
            ))
          : Array.from({ length: verdeckt }, (_, i) => (
              <Kartenruecken key={`${handNr}-${i}`} verzoegerung={i * 70} />
            ))}
      </div>
      <div className="poker-sitz-text">
        <span className="poker-sitz-name">
          {name}
          {bot && <em> · CPU</em>}
          {geber && <b className="poker-knopfmarke">G</b>}
          {klein && <b className="poker-knopfmarke">SB</b>}
          {gross && <b className="poker-knopfmarke">BB</b>}
        </span>
        <span className="poker-sitz-stand">
          <span className="poker-jeton-zeichen" aria-hidden="true" />
          <Jetonzahl wert={jetons} />
        </span>
      </div>
      <Einsatzmarke betrag={einsatz} />
      {aktion && (
        <span className="poker-sprechblase" key={`${handNr}-${aktion.art}-${revision}`}>
          {AKTIONSWORT[aktion.art]}
          {aktion.betrag ? ` ${aktion.betrag}` : ''}
        </span>
      )}
    </section>
  );
}

/**
 * Eine der vier Schaltflaechen.
 *
 * Sie steht IMMER da, auch wenn sie gerade nicht geht — das ist der ganze
 * Sinn einer festen Vierer-Leiste: Der Daumen lernt eine Stelle, nicht eine
 * wechselnde Reihenfolge. Was moeglich ist, leuchtet; der Rest liegt blass
 * daneben.
 *
 * Der Betrag kommt aus der erlaubten Aktion und wird hier nur angezeigt. Der
 * Bildschirm rechnet ihn nicht aus — er weiss nicht einmal, wie.
 */
function Aktionsknopf({
  art,
  wort,
  zug,
  gesperrt,
  onClick,
}: {
  art: 'fold' | 'check' | 'call' | 'bet';
  wort: string;
  zug: Aktion | undefined;
  gesperrt: boolean;
  onClick: (zug: Aktion | undefined) => void;
}): React.JSX.Element {
  const moeglich = zug !== undefined && !gesperrt;
  const betrag = zug && 'betrag' in zug ? zug.betrag : null;
  return (
    <button
      className="poker-aktion"
      data-art={art}
      data-moeglich={moeglich || undefined}
      type="button"
      /*
       * KEIN `disabled`.
       *
       * Safari zeichnet deaktivierte Knoepfe von sich aus blasser, und dann
       * haengt das Aussehen der Leiste am Browser statt am Blatt — dieselbe
       * Falle wie bei den Mememory-Karten. Ob ein Tipp zaehlt, entscheidet
       * `onClick`.
       */
      aria-disabled={!moeglich || undefined}
      onClick={() => moeglich && onClick(zug)}
    >
      <span className="poker-aktion-wort">{wort}</span>
      <span className="poker-aktion-zahl">{betrag !== null ? betrag : ''}</span>
    </button>
  );
}

/** Der Ausgang einer Hand, waehrend die Karten noch liegen. */
function Ergebnisband({
  ergebnis,
  eigenerSitz,
  fertig,
}: {
  ergebnis: HandErgebnis;
  eigenerSitz: number;
  fertig: boolean;
}): React.JSX.Element {
  const gewonnen = ergebnis.gewinner.includes(eigenerSitz);
  const geteilt = ergebnis.gewinner.length > 1;
  const kombination = ergebnis.bewertung[eigenerSitz]?.kategorie;

  return (
    <p
      className="poker-band"
      data-ton={geteilt ? 'geteilt' : gewonnen ? 'gut' : 'schlecht'}
      // Ein neuer Schluessel je Hand laesst die Einblendung neu laufen.
      key={`${ergebnis.topf}-${ergebnis.gewinner.join('-')}-${fertig}`}
    >
      <b>
        {geteilt
          ? 'Geteilter Topf'
          : gewonnen
            ? `+${ergebnis.topf} gewonnen`
            : 'Hand verloren'}
      </b>
      <span>
        {ergebnis.durchAufgabe
          ? gewonnen
            ? 'Die anderen sind ausgestiegen.'
            : 'Du hast gefoldet.'
          : kombination
            ? `Du hattest ${KOMBINATION[kombination] ?? ''}.`
            : ''}
      </span>
    </p>
  );
}

/**
 * Das Regelblatt.
 *
 * Alles, was eine Erklaerung braucht, kommt als Blatt von unten und nicht als
 * Text auf dem Tisch (DESIGN-DOKO: "Der Tisch ist heilig"). Tipp auf den
 * Hintergrund schliesst.
 */
function Regelblatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="poker-blatt" onClick={onClose} role="presentation">
      <div className="poker-blatt-karte" onClick={(e) => e.stopPropagation()} role="presentation">
        <h2>So geht Poker</h2>

        <h3>Ziel</h3>
        <p>
          Jeder bekommt zwei verdeckte Karten. In der Mitte liegen nach und
          nach fünf offene Karten. Wer aus seinen zwei und den fünf offenen
          die besten <b>fünf</b> Karten bildet, gewinnt den Topf. Am Tisch
          sitzen zwei bis sechs.
        </p>

        <h3>Die Blinds</h3>
        <p>
          Vor jeder Hand zahlen zwei Sitze einen Pflicht-Einsatz: den kleinen
          Blind (SB) und den großen Blind (BB). Zu zweit zahlt der Geber den
          kleinen, der andere den großen. Zu dritt und mehr sitzt der kleine
          Blind links vom Geber, der große links davon. Der Knopf wandert jede
          Hand weiter.
        </p>

        <h3>Die vier Knöpfe</h3>
        <ul className="poker-blatt-liste">
          <li>
            <b>Fold</b> — aussteigen. Du verlierst, was du schon gesetzt hast,
            mehr nicht.
          </li>
          <li>
            <b>Check</b> — weiter, ohne zu setzen. Geht nur, wenn nichts offen
            steht.
          </li>
          <li>
            <b>Call</b> — den offenen Einsatz bezahlen. Die Zahl auf dem
            Knopf ist der Preis.
          </li>
          <li>
            <b>Bet</b> — setzen oder erhöhen. Auch hier steht der Betrag auf
            dem Knopf.
          </li>
        </ul>

        <h3>Der Ablauf</h3>
        <p>
          Vor dem Flop · Flop (drei Karten) · Turn (eine) · River (eine). Vor
          jeder neuen Karte wird gesetzt. Wer als Letzter nicht gefoldet hat,
          gewinnt ohne Zeigen. Sonst werden die Hände verglichen. Wer all-in
          weniger setzen konnte als die anderen, spielt nur um den Topf bis zu
          seinem Beitrag — der Rest ist ein Nebentopf.
        </p>

        <h3>Was schlägt was</h3>
        <ol className="poker-blatt-rang">
          <li>Straight Flush — fünf in Reihe, alle gleiche Farbe</li>
          <li>Vierling — vier gleiche Werte</li>
          <li>Full House — Drilling und Paar</li>
          <li>Flush — fünf gleiche Farbe</li>
          <li>Straße — fünf in Reihe</li>
          <li>Drilling — drei gleiche Werte</li>
          <li>Zwei Paare</li>
          <li>Ein Paar</li>
          <li>Höchste Karte</li>
        </ol>

        <p className="poker-blatt-fuss">
          Gespielt wird mit BroJetons. Die kauft man im Shop gegen Münzen; zurück
          in Münzen gehen sie nicht. Wer den Tisch aufmacht, stellt Mindest-Einsatz
          und die Blinds ein.
        </p>

        <button className="poker-hauptknopf" type="button" onClick={onClose}>
          <span>Verstanden</span>
        </button>
      </div>
    </div>
  );
}
