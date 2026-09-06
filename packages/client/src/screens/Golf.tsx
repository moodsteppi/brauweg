import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type Me } from '../api';
import { FARBEN, farbeVon } from '../minispiele/golf/farben';
import { schlagAus, trifftBall, vorschau } from '../minispiele/golf/eingabe';
import { Kamera } from '../minispiele/golf/kamera';
import { KARTEN } from '../minispiele/golf/karten';
import { Golfnetz } from '../minispiele/golf/netz';
import {
  MAX_ZUG,
  PAUSE_TAKTE,
  TAKT_MS,
  gesamtschlaege,
  platzierungen,
  pruefsumme,
  schlagErlaubt,
  troedelRest,
  type Partiezustand,
} from '../minispiele/golf/physik';
import type { GolfSicht } from '../minispiele/golf/sicht';
import { Zeichner, type Zielbild } from '../minispiele/golf/zeichnen';
import type { BotLevel, SeatInfo, TaktMessage, ViewMessage } from '../protocol';
import { useTable } from '../useTable';

/**
 * Golf — Minigolf aus der Vogelperspektive, 1 bis 8 Spieler gleichzeitig.
 *
 * Ein Bildschirm mit drei Gesichtern, wie bei Filler: ohne Tisch das Menü, mit
 * Tisch aber ohne Sicht die Gruppe (Lobby), mit Sicht die Bahn.
 *
 * **Was diesen Bildschirm von allen anderen unterscheidet.** Golf ist wie
 * Feldherr Echtzeit im Gleichschritt: Über die Leitung gehen nur SCHLÄGE, die
 * Physik läuft auf jedem Gerät selbst (`minispiele/golf/physik.ts`). Anders als
 * bei Feldherr wartet aber niemand auf den langsamsten Mitspieler — jedes
 * Gerät läuft mit der Wanduhr und spult zurück, wenn ein Schlag verspätet
 * eintrifft. Die ganze Netzrechnung steckt deshalb in `netz.ts` und nicht hier;
 * dieser Bildschirm reicht nur Nachrichten hinein und Bilder heraus.
 *
 * **Der Bildschirm bildet keine Regel nach.** Ob geschlagen werden darf, sagt
 * `schlagErlaubt` aus dem Kern; wer wartet, sagt `troedelRest`; wie die
 * Rangliste aussieht, sagt `platzierungen`. Nachgerechnet wird hier nichts —
 * eine zweite Fassung derselben Regel läuft beim ersten geänderten Zähler
 * auseinander (siehe CLAUDE.md, Tafelrunde).
 */

/* --------------------------------------------------------------------------
 * Gemerkte Einstellungen
 * ----------------------------------------------------------------------- */

const SCHLUESSEL_LOECHER = 'golf.loecher';
const SCHLUESSEL_BOTS = 'golf.bots';
const SCHLUESSEL_STUFE = 'golf.botstufe';

/** Aus dem Browser lesen. Gesperrte Seitendaten sind kein Fehler, nur leer. */
function gemerkt(schluessel: string, vorgabe: number, min: number, max: number): number {
  try {
    const wert = Number(localStorage.getItem(schluessel));
    if (!Number.isFinite(wert) || wert < min || wert > max) return vorgabe;
    return Math.round(wert);
  } catch {
    return vorgabe;
  }
}

function merke(schluessel: string, wert: string | number): void {
  try {
    localStorage.setItem(schluessel, String(wert));
  } catch {
    /* Privates Fenster. Die Wahl gilt trotzdem — nur eben nicht morgen. */
  }
}

const STUFEN: readonly BotLevel[] = ['anfaenger', 'standard', 'experte', 'genie'];
const STUFE_NAME: Record<BotLevel, string> = {
  anfaenger: 'Anfänger',
  standard: 'Normal',
  experte: 'Experte',
  genie: 'Profi',
};

function istStufe(wert: unknown): wert is BotLevel {
  return STUFEN.includes(wert as BotLevel);
}

function gemerkteStufe(): BotLevel {
  try {
    const wert = localStorage.getItem(SCHLUESSEL_STUFE);
    return istStufe(wert) ? wert : 'standard';
  } catch {
    return 'standard';
  }
}

/* --------------------------------------------------------------------------
 * Golfball als Zeichen
 * ----------------------------------------------------------------------- */

/** Feste Dimple-Stellen. Ausgezählt statt gerechnet: Es sind immer dieselben. */
const DIMPLES: readonly [number, number][] = [
  [16, 8],
  [10.5, 12],
  [21.5, 12],
  [16, 16],
  [10, 20],
  [22, 20],
  [16, 24],
];

/**
 * Der Golfball in Spielerfarbe.
 *
 * Gezeichnet und nicht geladen: Für acht Farben bräuchte es acht Dateien, und
 * ein `<img>` auf eine Datei, die es nicht gibt, ist der Fehler aus der
 * CLAUDE.md, der hier schon dreimal live ging.
 */
function Golfball({ farbe, groesse = 28 }: { farbe: string; groesse?: number }): React.JSX.Element {
  return (
    <svg
      className="gf-ballzeichen"
      viewBox="0 0 32 32"
      width={groesse}
      height={groesse}
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="15" fill={farbe} />
      {DIMPLES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="rgba(0, 0, 0, 0.14)" />
      ))}
      <ellipse cx="11" cy="10" rx="4.8" ry="3" fill="rgba(255, 255, 255, 0.5)" transform="rotate(-28 11 10)" />
      <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(0, 0, 0, 0.3)" strokeWidth="1.4" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
 * Der Bildschirm
 * ----------------------------------------------------------------------- */

interface Abschlussdaten {
  /** `[loch][sitz]` — Kopie, weil der Kernzustand lebt und weiterläuft. */
  ergebnis: number[][];
  gesamt: number[];
  platz: { sitz: number; schlaege: number; platz: number }[];
}

export function Golf({
  startTisch,
  onBack,
}: {
  /** Tisch aus dem „Weiterspielen" des Hubs. Sonst fängt alles im Menü an. */
  startTisch?: string | null;
  onBack: () => void;
}): React.JSX.Element {
  const [tischId, setTischId] = useState<string | null>(startTisch ?? null);
  const [botsOffen, setBotsOffen] = useState(false);
  const [bots, setBots] = useState(() => gemerkt(SCHLUESSEL_BOTS, 3, 1, 7));
  const [loecher, setLoecher] = useState(() => gemerkt(SCHLUESSEL_LOECHER, 9, 2, 15));
  const [stufe, setStufe] = useState<BotLevel>(gemerkteStufe);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ich, setIch] = useState<Me | null>(null);
  const [abschluss, setAbschluss] = useState<Abschlussdaten | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  /*
   * Die Brücke zum Gleichschritt lebt länger als jeder Render und darf
   * deshalb nicht in einem State liegen. Sie wird beim ersten Bedarf gebaut
   * und beim Tischwechsel weggeworfen.
   */
  const netzRef = useRef<Golfnetz | null>(null);
  const sendRef = useRef<(a: unknown) => void>(() => {});
  const sendTaktRef = useRef<(d: { takt: number; grenzTakt: number; pruef: string }) => void>(
    () => {},
  );
  const neuVerbindenRef = useRef<() => void>(() => {});

  const holeNetz = useCallback((): Golfnetz => {
    let netz = netzRef.current;
    if (netz === null) {
      netz = new Golfnetz({
        sende: (a) => sendRef.current(a),
        sendeTakt: (d) => sendTaktRef.current(d),
        neuVerbinden: () => neuVerbindenRef.current(),
        jetzt: () => performance.now(),
        karten: KARTEN,
        melde: (text) => setHinweis(text),
      });
      netzRef.current = netz;
    }
    return netz;
  }, []);

  /**
   * Herzschläge und Sichten gehen am React-Zustand VORBEI direkt in den Kern.
   *
   * Ein `setState` je Puls zeichnete den Bildschirm fünfmal je Sekunde neu,
   * und eine Sicht, die erst über einen Effekt ankommt, kann sich um hunderte
   * Millisekunden verspäten — der Kern rechnete derweil über den Takt des
   * Schlags hinweg und führte ihn verschoben aus. Genau daran ist bei
   * Feldherr schon ein Haus-Zug zerbrochen.
   */
  const beiTakt = useCallback((m: TaktMessage) => holeNetz().fremderTakt(m.takt), [holeNetz]);
  const beiSicht = useCallback(
    (m: ViewMessage<GolfSicht>) => holeNetz().nimmSicht(m.view),
    [holeNetz],
  );
  const beiAbweisung = useCallback(() => holeNetz().abgewiesen(), [holeNetz]);

  const tisch = useTable<GolfSicht>(tischId, 'golf', beiTakt, beiSicht, beiAbweisung);
  sendRef.current = tisch.send;
  sendTaktRef.current = tisch.sendTakt;
  neuVerbindenRef.current = tisch.reconnect;

  const sicht = tisch.view?.view ?? null;
  const eigenerSitz = tisch.view?.seat ?? -1;

  /* Beim Tischwechsel fängt alles von vorn an — auch der Kern. */
  useEffect(() => {
    netzRef.current = null;
    setAbschluss(null);
    setHinweis(null);
  }, [tischId]);

  /* Wer ich bin, entscheidet in der Lobby über den Startknopf. */
  useEffect(() => {
    let lebt = true;
    void api
      .me()
      .then((m) => {
        if (lebt) setIch(m);
      })
      .catch(() => {
        /* Ohne Antwort bleibt der Startknopf beim ersten Sitz — er darf
           ohnehin jeder Sitzende drücken, der Server prüft es. */
      });
    return () => {
      lebt = false;
    };
  }, []);

  /** Den Herzschlag absetzen, solange eine Partie läuft. */
  useEffect(() => {
    if (sicht === null) return;
    const takt = window.setInterval(() => netzRef.current?.herzschlag(), 250);
    return () => window.clearInterval(takt);
  }, [sicht !== null]);

  /* ---------------------------------------------------------------- */

  /**
   * Online spielen: der offenen Gruppe beitreten, sonst eine aufmachen.
   *
   * Ohne `config`: Der Server nimmt dann `defaultConfig()` des Moduls. Eine
   * mitgeschickte Kopie des Regelsatzes überstimmte das Modul, ohne dass es
   * irgendwo auffiele (siehe CLAUDE.md, Tafelrunde).
   */
  const spieleOnline = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      const liste = await api.tables('golf');
      const offen = liste.find((zeile) => zeile.gameId === 'golf' && zeile.occupied < zeile.seats);
      if (offen) {
        await api.joinTable(offen.id);
        setTischId(offen.id);
        return;
      }
      const { id } = await api.createTable({
        gameId: 'golf',
        seats: 8,
        rounds: 9,
        visibility: 'public',
      });
      setTischId(id);
    } catch {
      setFehler('Die Gruppe ließ sich nicht öffnen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, []);

  /**
   * Gegen Bots: eigener Tisch, `on_request` und sofort mit Bots gefüllt.
   *
   * Ein Bot-Tisch in der öffentlichen Liste fängt genau die Leute ab, die
   * gerade einen Menschen suchen — dieselbe Begründung wie bei Filler.
   */
  const spieleGegenBots = useCallback(async (): Promise<void> => {
    setFehler(null);
    setLaedt(true);
    try {
      const { id } = await api.createTable({
        gameId: 'golf',
        seats: 1 + bots,
        rounds: loecher,
        visibility: 'on_request',
        fillWithBots: true,
        botLevel: stufe,
      });
      setTischId(id);
    } catch {
      setFehler('Der Platz ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setLaedt(false);
    }
  }, [bots, loecher, stufe]);

  const verlasse = useCallback((): void => {
    const id = tischId;
    setTischId(null);
    setAbschluss(null);
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  const verlasseUndZurueck = useCallback((): void => {
    const id = tischId;
    /*
     * Erst aufgeben, dann gehen: Die Plattform meldet einen Abwesenden erst
     * nach fuenf Minuten ab, und bis dahin warteten die anderen an jedem Loch
     * auf einen Ball, den niemand mehr schlaegt. Die Aufgabe heftet das Modul
     * an die Zugliste, und jedes Geraet macht den Sitz am selben Takt fertig.
     * Nach dem Ende ist sie harmlos — das Modul weist sie ab, ohne etwas zu
     * aendern, und die Abweisung interessiert hier niemanden mehr.
     */
    if (id && tisch.view !== null && abschluss === null) tisch.send({ art: 'aufgabe' });
    if (id) void api.leaveTable(id).catch(() => {});
    onBack();
  }, [tischId, onBack, tisch, abschluss]);

  /**
   * Das Ergebnis EINMAL melden — und nach einem Neuladen noch einmal.
   *
   * Das Modul nimmt je Sitz die erste Meldung; ein zweiter Versuch ist
   * deshalb harmlos und ausdrücklich gewollt: Wer neu lädt, hat seine
   * Meldung vielleicht nie abgesetzt.
   */
  const meldeErgebnis = useCallback(
    (zustand: Partiezustand): Abschlussdaten => {
      const gesamt = gesamtschlaege(zustand);
      const daten: Abschlussdaten = {
        ergebnis: zustand.ergebnis.map((reihe) => [...(reihe ?? [])]),
        gesamt,
        platz: platzierungen(zustand),
      };
      sendRef.current({ art: 'ergebnis', schlaege: gesamt, pruef: pruefsumme(zustand.ergebnis) });
      return daten;
    },
    [],
  );

  /* ---------------------------------------------------------------- */
  /* Menü                                                              */
  /* ---------------------------------------------------------------- */

  if (!tischId) {
    return (
      <main className="gf-seite gf-menue">
        <button className="gf-zurueck" type="button" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <div className="gf-menue-mitte">
          <h1 className="gf-titel">Golf</h1>
          <p className="gf-untertitel">
            Minigolf von oben, alle gleichzeitig auf derselben Bahn. Zieh deinen
            Ball zurück wie einen Flitzebogen, lass los — und wer nach allen
            Löchern die wenigsten Schläge hat, gewinnt.
          </p>
          <div className="gf-probe" aria-hidden="true">
            {FARBEN.map((farbe, i) => (
              <Golfball key={i} farbe={farbe} groesse={30} />
            ))}
          </div>
          <button
            className="gf-knopf gf-knopf-haupt"
            type="button"
            data-golf-online=""
            onClick={() => void spieleOnline()}
            disabled={laedt}
          >
            Online spielen
          </button>
          <div className="gf-botblock">
            <button
              className="gf-knopf gf-knopf-neben"
              type="button"
              data-golf-bots=""
              aria-expanded={botsOffen}
              onClick={() => setBotsOffen((an) => !an)}
            >
              Gegen Bots
            </button>
            {botsOffen && (
              <div className="gf-regler">
                <Regler
                  titel="Bots"
                  wert={bots}
                  min={1}
                  max={7}
                  onWahl={(w) => {
                    setBots(w);
                    merke(SCHLUESSEL_BOTS, w);
                  }}
                />
                <Regler
                  titel="Löcher"
                  wert={loecher}
                  min={2}
                  max={15}
                  onWahl={(w) => {
                    setLoecher(w);
                    merke(SCHLUESSEL_LOECHER, w);
                  }}
                />
                <div className="gf-stufen" role="group" aria-label="Spielstärke der Bots">
                  {STUFEN.map((s) => (
                    <button
                      key={s}
                      type="button"
                      data-an={stufe === s ? '' : undefined}
                      aria-pressed={stufe === s}
                      onClick={() => {
                        setStufe(s);
                        merke(SCHLUESSEL_STUFE, s);
                      }}
                    >
                      {STUFE_NAME[s]}
                    </button>
                  ))}
                </div>
                <button
                  className="gf-knopf gf-knopf-haupt"
                  type="button"
                  data-golf-los=""
                  onClick={() => void spieleGegenBots()}
                  disabled={laedt}
                >
                  Los
                </button>
              </div>
            )}
          </div>
          {KARTEN.length === 0 && (
            <p className="gf-fehler">
              Es sind noch keine Bahnen eingebaut — spielen lässt sich noch nicht.
            </p>
          )}
          {fehler && <p className="gf-fehler">{fehler}</p>}
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Abschluss                                                         */
  /* ---------------------------------------------------------------- */

  if (abschluss !== null) {
    return (
      <Abschluss
        daten={abschluss}
        sicht={sicht}
        eigenerSitz={eigenerSitz}
        sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
        onZurueck={verlasseUndZurueck}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /* Lobby                                                             */
  /* ---------------------------------------------------------------- */

  if (sicht === null) {
    return (
      <Lobby
        sitze={tisch.table?.seats ?? []}
        plaetze={tisch.table?.seats.length ?? 8}
        meineKennung={ich?.id ?? null}
        verbunden={tisch.status === 'open'}
        loecher={loecher}
        onLoecher={(w) => {
          setLoecher(w);
          merke(SCHLUESSEL_LOECHER, w);
        }}
        onStart={() => tisch.startNow(loecher)}
        onZurueck={verlasse}
      />
    );
  }

  /* ---------------------------------------------------------------- */
  /* Partie                                                            */
  /* ---------------------------------------------------------------- */

  if (KARTEN.length === 0) {
    return (
      <main className="gf-seite gf-menue">
        <button className="gf-zurueck" type="button" onClick={verlasseUndZurueck} aria-label="Zurück">
          ←
        </button>
        <div className="gf-menue-mitte">
          <h1 className="gf-titel">Bahnen fehlen</h1>
          <p className="gf-untertitel">
            Dieser Stand bringt noch keine Bahnen mit. Ohne sie lässt sich die
            Partie nicht rechnen — der Tisch bleibt bestehen.
          </p>
        </div>
      </main>
    );
  }

  return (
    <Partie
      netz={holeNetz()}
      sicht={sicht}
      eigenerSitz={eigenerSitz}
      sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
      hinweis={hinweis}
      onFertig={(zustand) => setAbschluss(meldeErgebnis(zustand))}
      onZurueck={verlasseUndZurueck}
    />
  );
}

/* --------------------------------------------------------------------------
 * Regler
 * ----------------------------------------------------------------------- */

/**
 * Ein Schieberegler mit großer Zahl daneben.
 *
 * `label` bekommt hier `margin: 0` (styles.css): Global steht ein
 * `margin-bottom` auf jedem Label, und in einer Flexzeile schiebt das die
 * Beschriftung aus der Mitte — die Falle aus Mememory.
 */
function Regler({
  titel,
  wert,
  min,
  max,
  onWahl,
}: {
  titel: string;
  wert: number;
  min: number;
  max: number;
  onWahl: (wert: number) => void;
}): React.JSX.Element {
  return (
    <label className="gf-reglerzeile">
      <span className="gf-reglertitel">{titel}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={wert}
        onChange={(e) => onWahl(Number(e.target.value))}
      />
      <strong className="gf-reglerwert">{wert}</strong>
    </label>
  );
}

/* --------------------------------------------------------------------------
 * Lobby
 * ----------------------------------------------------------------------- */

function Lobby({
  sitze,
  plaetze,
  meineKennung,
  verbunden,
  loecher,
  onLoecher,
  onStart,
  onZurueck,
}: {
  sitze: readonly SeatInfo[];
  plaetze: number;
  meineKennung: string | null;
  verbunden: boolean;
  loecher: number;
  onLoecher: (wert: number) => void;
  onStart: () => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const anwesend = sitze.filter((s) => s.accountId !== null || s.isBot);
  const host = sitze[0] ?? null;
  /*
   * Host ist, wer auf Sitz 0 sitzt. Starten DARF laut Server jeder Sitzende —
   * der Knopf steht trotzdem nur bei einem, weil sonst zwei Leute gleichzeitig
   * mit verschiedenen Lochzahlen starten und einer sich wundert.
   */
  const binHost = host !== null && meineKennung !== null && host.accountId === meineKennung;

  return (
    <main className="gf-seite gf-menue">
      <button className="gf-zurueck" type="button" onClick={onZurueck} aria-label="Zurück">
        ←
      </button>
      <div className="gf-menue-mitte">
        <h1 className="gf-titel">Gruppe</h1>
        <p className="gf-untertitel">
          {anwesend.length}/{plaetze} in der Gruppe
        </p>
        {!verbunden && <p className="gf-fehler">Keine Verbindung — es wird neu aufgebaut …</p>}

        <ul className="gf-gruppe">
          {sitze.map((platz) => {
            const eigen = meineKennung !== null && platz.accountId === meineKennung;
            const leer = platz.accountId === null && !platz.isBot;
            return (
              <li
                key={platz.seat}
                className="gf-gruppenzeile"
                data-golf-sitz={platz.seat}
                data-leer={leer ? '' : undefined}
                data-eigen={eigen ? '' : undefined}
              >
                <Golfball farbe={leer ? '#5b6b5f' : farbeVon(platz.seat)} groesse={26} />
                <span className="gf-gruppenname">
                  {leer ? 'frei' : (platz.displayName ?? (platz.isBot ? 'Bot' : 'Spieler'))}
                </span>
                {eigen && <em className="gf-du">du</em>}
              </li>
            );
          })}
        </ul>

        {binHost ? (
          <div className="gf-regler">
            <Regler titel="Löcher" wert={loecher} min={2} max={15} onWahl={onLoecher} />
            <button
              className="gf-knopf gf-knopf-haupt"
              type="button"
              data-golf-start=""
              onClick={onStart}
              disabled={!verbunden}
            >
              Starten
            </button>
          </div>
        ) : (
          <p className="gf-warten" aria-live="polite">
            <span>
              Warten, bis {host?.displayName ?? 'der Erste'} startet
            </span>
            <span className="gf-lauf" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
        )}
      </div>
    </main>
  );
}

/* --------------------------------------------------------------------------
 * Partie
 * ----------------------------------------------------------------------- */

/** Was das HUD anzeigt. Bewusst flach: So lässt es sich als Zeichenkette vergleichen. */
interface Hudstand {
  loch: number;
  loecher: number;
  bahn: string;
  par: number;
  restS: number;
  schlaege: number[];
  gesamt: number[];
  fertig: boolean[];
  dabei: boolean[];
  eingelocht: boolean[];
  pause: boolean;
  pauseRest: number;
  troedel: number;
  binTroedler: boolean;
}

const HUD_LEER: Hudstand = {
  loch: 0,
  loecher: 0,
  bahn: '',
  par: 0,
  restS: 0,
  schlaege: [],
  gesamt: [],
  fertig: [],
  dabei: [],
  eingelocht: [],
  pause: false,
  pauseRest: 0,
  troedel: 0,
  binTroedler: false,
};

/** Der Zustand des Zielens — liegt in einer Ref, nicht im State. */
interface Zielstand {
  zeiger: number;
  ballX: number;
  ballY: number;
  zuX: number;
  zuY: number;
  grob: boolean;
}

function Partie({
  netz,
  sicht,
  eigenerSitz,
  sitze,
  hinweis,
  onFertig,
  onZurueck,
}: {
  netz: Golfnetz;
  sicht: GolfSicht;
  eigenerSitz: number;
  sitze: readonly SeatInfo[];
  hinweis: string | null;
  onFertig: (zustand: Partiezustand) => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const leinwandRef = useRef<HTMLCanvasElement | null>(null);
  const zeichnerRef = useRef<Zeichner | null>(null);
  const kameraRef = useRef<Kamera>(new Kamera());
  const zielRef = useRef<Zielstand | null>(null);
  /** Wiederverwendeter Puffer der Bahnvorschau — im Bildpfad wird nichts angelegt. */
  const bahnRef = useRef<number[]>([]);
  const zielbildRef = useRef<Zielbild | null>(null);
  const uebersichtRef = useRef(false);
  const [uebersicht, setUebersicht] = useState(false);
  const [hud, setHud] = useState<Hudstand>(HUD_LEER);
  const hudKeyRef = useRef('');
  const fertigRef = useRef(false);
  const onFertigRef = useRef(onFertig);
  onFertigRef.current = onFertig;
  const sitzRef = useRef(eigenerSitz);
  sitzRef.current = eigenerSitz;

  /* -------------------------------------------------------------- */
  /* Bildschleife                                                    */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const leinwand = leinwandRef.current;
    if (leinwand === null) return;
    const zeichner = new Zeichner(leinwand);
    zeichnerRef.current = zeichner;
    let laeuft = true;
    let bild = 0;
    let letzteMs = performance.now();

    let letztesBildMs = performance.now();

    /**
     * Rechnen, Ende melden, HUD nachziehen — alles, was auch im VERDECKTEN
     * Tab passieren muss. Dort feuert `requestAnimationFrame` nicht (und im
     * Browser-Pane der Werkzeuge auch nicht, solange es zugeklappt ist);
     * ohne diesen Teil bliebe der Zustand stehen, und wer beim Matchende
     * gerade in einer anderen App war, meldete sein Ergebnis nie.
     */
    const rechne = (): void => {
      const gs = netz.kern;
      if (gs === null) return;

      /*
       * Erst rechnen, dann malen. In EINZELSCHRITTEN, solange es wenige sind:
       * `letzteEreignisse` trägt nur die Deko des zuletzt gerechneten Takts,
       * und wer zehn Takte am Stück rechnet, verliert neun Funkenwolken. Beim
       * echten Aufholen (verdeckter Tab, langes Nachladen) zählt das nicht
       * mehr — dort geht Tempo vor Zierrat.
       */
      const ziel = netz.taktJetzt();
      let einzeln = 0;
      while (gs.takt < ziel && einzeln < 30) {
        gs.rechneBis(gs.takt + 1);
        zeichner.nimmEffekte(gs.zustand().letzteEreignisse);
        einzeln += 1;
      }
      if (gs.takt < ziel) gs.rechneBis(ziel);

      const z = gs.zustand();
      const karte = KARTEN[z.aktuell.karte];
      if (karte === undefined) return;

      if (z.fertig && !fertigRef.current) {
        fertigRef.current = true;
        onFertigRef.current(z);
        return;
      }

      const neu = baueHud(z, karte, sitzRef.current);
      const schluessel = hudSchluessel(neu);
      if (schluessel !== hudKeyRef.current) {
        hudKeyRef.current = schluessel;
        setHud(neu);
      }
    };

    const takt = (): void => {
      if (!laeuft) return;
      bild = requestAnimationFrame(takt);
      letztesBildMs = performance.now();
      rechne();
      const gs = netz.kern;
      if (gs === null || fertigRef.current) return;

      // Im verdeckten Tab wird gerechnet, aber nicht gemalt: Der Browser
      // liefert dort ohnehin kaum Bilder, und die Wanduhr holt beim
      // Zurückkommen von selbst auf.
      if (typeof document !== 'undefined' && document.hidden) return;

      const z = gs.zustand();
      const karte = KARTEN[z.aktuell.karte];
      if (karte === undefined) return;

      const jetzt = performance.now();
      const dt = jetzt - letzteMs;
      letzteMs = jetzt;

      const sitz = sitzRef.current;
      const eigen = sitz >= 0 ? z.baelle[sitz] : undefined;
      const zielX = eigen && eigen.dabei && !eigen.eingelocht ? eigen.x : karte.loch[0];
      const zielY = eigen && eigen.dabei && !eigen.eingelocht ? eigen.y : karte.loch[1];

      const zs = zielRef.current;
      const zugLaenge =
        zs === null ? 0 : Math.hypot(zs.zuX - zs.ballX, zs.zuY - zs.ballY);
      const blick = kameraRef.current.schritt(
        karte,
        zielX,
        zielY,
        zugLaenge,
        uebersichtRef.current,
        zeichner.seitenverhaeltnis,
        dt,
      );

      zeichner.zeichne({
        karte,
        zustand: z,
        vorher: gs.vorher(),
        anteil: netz.taktBruch(),
        blick,
        eigenerSitz: sitz,
        ziel: zielbildRef.current,
        uhrMs: jetzt,
        uebersicht: uebersichtRef.current,
      });

      schreibeMarken(leinwand, zeichner, z, sitz);
    };

    /*
     * Rückfall für den verdeckten Tab: Kommt 300 ms lang kein Bild, rechnet
     * der Zeitgeber weiter. 250 ms sind grob genug, dass ein gedrosselter
     * Hintergrund-Tab (Browser lassen dort etwa einen Aufruf je Sekunde zu)
     * nicht leidet, und fein genug, dass beim Zurückkommen kaum aufzuholen ist.
     */
    const rueckfall = window.setInterval(() => {
      if (!laeuft) return;
      if (performance.now() - letztesBildMs > 300) rechne();
    }, 250);

    bild = requestAnimationFrame(takt);
    return () => {
      laeuft = false;
      cancelAnimationFrame(bild);
      window.clearInterval(rueckfall);
      zeichnerRef.current = null;
    };
  }, [netz]);

  /* -------------------------------------------------------------- */
  /* Zielen                                                          */
  /* -------------------------------------------------------------- */

  const rechneZiel = useCallback((): void => {
    const zs = zielRef.current;
    const gs = netz.kern;
    if (zs === null || gs === null) {
      zielbildRef.current = null;
      return;
    }
    const wunsch = schlagAus(zs.zuX - zs.ballX, zs.zuY - zs.ballY);
    if (wunsch === null) {
      zielbildRef.current = null;
      return;
    }
    const z = gs.zustand();
    vorschau(z, sitzRef.current, wunsch.rx, wunsch.ry, wunsch.kraft, KARTEN, bahnRef.current);
    zielbildRef.current = {
      x: zs.ballX,
      y: zs.ballY,
      rx: wunsch.rx,
      ry: wunsch.ry,
      kraft: wunsch.kraft,
      bahn: bahnRef.current,
    };
  }, [netz]);

  const beiZeigerAb = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): void => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // In der Übersicht wird nicht gezielt: Ein Tipp bringt sie zurück.
      if (uebersichtRef.current) {
        uebersichtRef.current = false;
        setUebersicht(false);
        return;
      }
      const gs = netz.kern;
      const zeichner = zeichnerRef.current;
      const leinwand = leinwandRef.current;
      const sitz = sitzRef.current;
      if (gs === null || zeichner === null || leinwand === null || sitz < 0) return;
      const z = gs.zustand();
      // Ob geschlagen werden darf, sagt der KERN — nicht dieser Bildschirm.
      if (!schlagErlaubt(z, sitz)) return;
      const ball = z.baelle[sitz];
      const kasten = leinwand.getBoundingClientRect();
      const welt = zeichner.zuWelt(e.clientX - kasten.left, e.clientY - kasten.top);
      const grob = e.pointerType !== 'mouse';
      if (!trifftBall(ball.x, ball.y, welt.x, welt.y, grob)) return;
      zielRef.current = {
        zeiger: e.pointerId,
        ballX: ball.x,
        ballY: ball.y,
        zuX: welt.x,
        zuY: welt.y,
        grob,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* Manche Browser verweigern das Fangen; das Ziehen geht trotzdem. */
      }
      rechneZiel();
    },
    [netz, rechneZiel],
  );

  const beiZeigerZug = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): void => {
      const zs = zielRef.current;
      const zeichner = zeichnerRef.current;
      const leinwand = leinwandRef.current;
      if (zs === null || zs.zeiger !== e.pointerId || zeichner === null || leinwand === null) return;
      const kasten = leinwand.getBoundingClientRect();
      const welt = zeichner.zuWelt(e.clientX - kasten.left, e.clientY - kasten.top);
      // Der Zug wird auf die Maximallänge gedeckelt: Weiter zu ziehen ändert
      // nichts mehr, und ein Pfeil, der aus dem Bild läuft, sagt das nicht.
      const dx = welt.x - zs.ballX;
      const dy = welt.y - zs.ballY;
      const laenge = Math.hypot(dx, dy);
      if (laenge > MAX_ZUG) {
        zs.zuX = zs.ballX + (dx / laenge) * MAX_ZUG;
        zs.zuY = zs.ballY + (dy / laenge) * MAX_ZUG;
      } else {
        zs.zuX = welt.x;
        zs.zuY = welt.y;
      }
      rechneZiel();
    },
    [rechneZiel],
  );

  const beiZeigerAuf = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): void => {
      const zs = zielRef.current;
      if (zs === null || zs.zeiger !== e.pointerId) return;
      zielRef.current = null;
      zielbildRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* War nie gefangen. */
      }
      const wunsch = schlagAus(zs.zuX - zs.ballX, zs.zuY - zs.ballY);
      // Unter der Mindestkraft ist es ein Abbruch und kein Schlag — genau
      // dafür ist die Schwelle da.
      if (wunsch === null) return;
      netz.schlage(sitzRef.current, wunsch.rx, wunsch.ry, wunsch.kraft);
    },
    [netz],
  );

  const beiZeigerWeg = useCallback((e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (zielRef.current?.zeiger !== e.pointerId) return;
    zielRef.current = null;
    zielbildRef.current = null;
  }, []);

  /* -------------------------------------------------------------- */

  const name = (sitz: number): string => {
    const zeile = sitze.find((s) => s.seat === sitz);
    return zeile?.displayName ?? (zeile?.isBot ? 'Bot' : `P${sitz + 1}`);
  };

  return (
    <main className="gf-seite gf-partie">
      <canvas
        className="gf-leinwand"
        data-golf-leinwand=""
        ref={leinwandRef}
        onPointerDown={beiZeigerAb}
        onPointerMove={beiZeigerZug}
        onPointerUp={beiZeigerAuf}
        onPointerCancel={beiZeigerWeg}
      />

      <div className="gf-hud">
        <div className="gf-hudkopf">
          <button className="gf-zurueck gf-zurueck-tisch" type="button" onClick={onZurueck} aria-label="Zurück">
            ←
          </button>
          <span className="gf-bahnzeile">
            Loch {hud.loch + 1}/{hud.loecher} · {hud.bahn} · Par {hud.par}
          </span>
          <span className="gf-zeit" data-knapp={hud.restS <= 10 ? '' : undefined}>
            {zeitText(hud.restS)}
          </span>
        </div>

        <div className="gf-chips">
          {hud.schlaege.map((schlaege, sitz) => (
            <span
              key={sitz}
              className="gf-chip"
              data-eigen={sitz === eigenerSitz ? '' : undefined}
              data-weg={hud.dabei[sitz] ? undefined : ''}
              style={{ background: farbeVon(sitz) }}
              title={name(sitz)}
            >
              <strong>{schlaege}</strong>
              <em>
                {hud.eingelocht[sitz] ? '✓' : hud.fertig[sitz] ? '–' : ''}
                {hud.gesamt[sitz]}
              </em>
              <i>{name(sitz).slice(0, 3)}</i>
            </span>
          ))}
        </div>

        {hud.binTroedler && hud.troedel > 0 && (
          <p className="gf-troedel" aria-live="polite">
            Alle warten auf dich: {hud.troedel}
          </p>
        )}
        {hinweis && <p className="gf-hinweis">{hinweis}</p>}
      </div>

      {hud.pause && (
        <div className="gf-pause">
          <h2>Loch {hud.loch + 1} — Zwischenstand</h2>
          <table className="gf-tafel">
            <thead>
              <tr>
                <th />
                <th>Loch</th>
                <th>Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {hud.schlaege.map((schlaege, sitz) => (
                <tr key={sitz} data-eigen={sitz === eigenerSitz ? '' : undefined}>
                  <td>
                    <Golfball farbe={farbeVon(sitz)} groesse={20} />
                    <span>{name(sitz)}</span>
                  </td>
                  <td>{schlaege}</td>
                  <td>{hud.gesamt[sitz]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="gf-pausezeit">
            {hud.loch + 1 >= hud.loecher
              ? 'Gleich das Ergebnis …'
              : `Loch ${hud.loch + 2} beginnt … ${hud.pauseRest}`}
          </p>
        </div>
      )}

      <button
        className="gf-uebersicht"
        type="button"
        data-golf-uebersicht=""
        data-an={uebersicht ? '' : undefined}
        aria-pressed={uebersicht}
        onClick={() => {
          const an = !uebersichtRef.current;
          uebersichtRef.current = an;
          zielRef.current = null;
          zielbildRef.current = null;
          setUebersicht(an);
        }}
        aria-label="Übersicht"
      >
        <Kartenzeichen />
      </button>
      {uebersicht && <p className="gf-uebersichthinweis">Übersicht — tippe zum Zurück</p>}
    </main>
  );
}

/** Das Kartensymbol des Übersichtsknopfs. */
function Kartenzeichen(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 4v13.5M15 6.5V20" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
 * HUD-Rechnungen
 * ----------------------------------------------------------------------- */

function baueHud(
  z: Partiezustand,
  karte: { name: string; par: number; zeitLimitS: number },
  eigenerSitz: number,
): Hudstand {
  const schlaege: number[] = [];
  const fertig: boolean[] = [];
  const dabei: boolean[] = [];
  const eingelocht: boolean[] = [];
  for (let s = 0; s < z.sitze; s += 1) {
    const b = z.baelle[s];
    schlaege.push(b?.schlaege ?? 0);
    fertig.push(b !== undefined && b.fertigTakt !== -1);
    dabei.push(b?.dabei ?? false);
    eingelocht.push(b?.eingelocht ?? false);
  }
  const verstrichen = ((z.takt - z.aktuell.startTakt) * TAKT_MS) / 1000;
  const troedel = troedelRest(z);
  const pause = z.aktuell.endeTakt !== -1;
  /*
   * `gesamtschlaege` zählt die ABGESCHLOSSENEN Löcher. Solange das Loch
   * läuft, steht sein Stand nur an den Bällen und muss dazugerechnet werden —
   * sobald es vorbei ist, steht er in `ergebnis` und wäre sonst doppelt drin.
   * Genau dieser Übergang passiert mitten in der Pausentafel, in der beide
   * Zahlen nebeneinanderstehen.
   */
  const abgeschlossen = gesamtschlaege(z);
  const gesamt = abgeschlossen.map((wert, s) => wert + (pause ? 0 : schlaege[s]));
  return {
    loch: z.aktuell.loch,
    loecher: z.loecher,
    bahn: karte.name,
    par: karte.par,
    restS: Math.max(0, Math.ceil(karte.zeitLimitS - verstrichen)),
    schlaege,
    gesamt,
    fertig,
    dabei,
    eingelocht,
    pause,
    pauseRest: pause
      ? Math.max(0, Math.ceil(((z.aktuell.pauseBis - z.takt) * TAKT_MS) / 1000))
      : Math.ceil((PAUSE_TAKTE * TAKT_MS) / 1000),
    troedel: troedel === null ? 0 : Math.ceil((troedel.rest * TAKT_MS) / 1000),
    binTroedler: troedel !== null && troedel.sitz === eigenerSitz,
  };
}

/**
 * Ein Vergleichsschlüssel des HUD.
 *
 * Der Bildschirm rechnet sechzigmal je Sekunde, React soll aber nur zeichnen,
 * wenn sich am angezeigten Text etwas ändert — bei acht Chips sonst 60
 * Aktualisierungen je Sekunde für eine Zahl, die sich alle paar Sekunden
 * bewegt.
 */
function hudSchluessel(h: Hudstand): string {
  return [
    h.loch,
    h.loecher,
    h.bahn,
    h.par,
    h.restS,
    h.schlaege.join(','),
    h.gesamt.join(','),
    h.fertig.join(','),
    h.dabei.join(','),
    h.eingelocht.join(','),
    h.pause ? 1 : 0,
    h.pauseRest,
    h.troedel,
    h.binTroedler ? 1 : 0,
  ].join('|');
}

function zeitText(sekunden: number): string {
  const m = Math.floor(sekunden / 60);
  const s = sekunden % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Marken an der Leinwand, für Prüfläufe im Browser.
 *
 * Direkt am DOM-Knoten und NICHT über React: Diese Werte ändern sich in jedem
 * Bild, und ein `setState` dafür zeichnete den ganzen Bildschirm sechzigmal je
 * Sekunde neu. Ein Selbstspieler in der Entwicklerkonsole liest daran ab, wo
 * der eigene Ball auf dem Schirm liegt und ob gerade geschlagen werden darf —
 * ohne die Kamera nachrechnen zu müssen.
 */
function schreibeMarken(
  leinwand: HTMLCanvasElement,
  zeichner: Zeichner,
  z: Partiezustand,
  sitz: number,
): void {
  const b = sitz >= 0 ? z.baelle[sitz] : undefined;
  if (b !== undefined && b.dabei && !b.eingelocht) {
    const p = zeichner.zuBild(b.x, b.y);
    const wert = `${Math.round(p.px)},${Math.round(p.py)}`;
    if (leinwand.dataset.golfBall !== wert) leinwand.dataset.golfBall = wert;
  } else if (leinwand.dataset.golfBall !== undefined) {
    delete leinwand.dataset.golfBall;
  }
  const bereit = sitz >= 0 && schlagErlaubt(z, sitz) ? '1' : '0';
  if (leinwand.dataset.golfBereit !== bereit) leinwand.dataset.golfBereit = bereit;
  const loch = String(z.aktuell.loch);
  if (leinwand.dataset.golfLoch !== loch) leinwand.dataset.golfLoch = loch;
}

/* --------------------------------------------------------------------------
 * Abschluss
 * ----------------------------------------------------------------------- */

function Abschluss({
  daten,
  sicht,
  eigenerSitz,
  sitze,
  onZurueck,
}: {
  daten: Abschlussdaten;
  sicht: GolfSicht | null;
  eigenerSitz: number;
  sitze: readonly SeatInfo[];
  onZurueck: () => void;
}): React.JSX.Element {
  const ausgang = sicht?.ausgang ?? null;
  const name = (sitz: number): string => {
    const zeile = sitze.find((s) => s.seat === sitz);
    return zeile?.displayName ?? (zeile?.isBot ? 'Bot' : `Spieler ${sitz + 1}`);
  };

  return (
    <main className="gf-seite gf-menue">
      <div className="gf-menue-mitte gf-breit">
        <h1 className="gf-titel">Ergebnis</h1>
        <ol className="gf-rangliste">
          {daten.platz.map((zeile) => (
            <li
              key={zeile.sitz}
              data-sieger={zeile.platz === 1 ? '' : undefined}
              data-eigen={zeile.sitz === eigenerSitz ? '' : undefined}
            >
              <span className="gf-rangplatz">{zeile.platz}</span>
              <Golfball farbe={farbeVon(zeile.sitz)} groesse={26} />
              <span className="gf-rangname">{name(zeile.sitz)}</span>
              <span className="gf-rangloecher">
                {daten.ergebnis.map((reihe, loch) => (
                  <i key={loch}>{reihe[zeile.sitz] ?? '–'}</i>
                ))}
              </span>
              <strong className="gf-rangsumme">{zeile.schlaege}</strong>
            </li>
          ))}
        </ol>
        {ausgang === null ? (
          <p className="gf-untertitel gf-klein">Ergebnis wird bestätigt …</p>
        ) : ausgang.strittig ? (
          <p className="gf-fehler">
            Die Geräte sind auf verschiedene Ergebnisse gekommen — die Partie
            zählt als strittig, alle stehen auf Platz 1.
          </p>
        ) : null}
        <button className="gf-knopf gf-knopf-haupt" type="button" onClick={onZurueck}>
          Zurück ins Menü
        </button>
      </div>
    </main>
  );
}
