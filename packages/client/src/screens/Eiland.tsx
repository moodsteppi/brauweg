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
  /** 'nebel' oder 'klar' — siehe packages/game-eiland/src/regeln.ts. */
  variante: EilandVariante;
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

/** Die beiden Spielarten, siehe packages/game-eiland/src/regeln.ts. */
type EilandVariante = 'nebel' | 'klar';

/**
 * Regelsatz, mit dem die Match-Suche einen Tisch aufmacht.
 *
 * Muss zu DEFAULT_REGELN in packages/game-eiland/src/regeln.ts passen. Bewusst
 * ausgeschrieben statt ueber `api.defaults()` geholt: Die Suche soll nicht auf
 * eine zusaetzliche Antwort warten, bevor sie den Tisch aufmacht. Die Spielart
 * kommt beim Aufmachen dazu.
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

/**
 * Die Tönung eines gewählten Feldes: die eigene Gebietsfarbe, halb
 * durchsichtig über dem Gelände.
 *
 * Als `background-image` und nicht als `background-color`, weil die
 * Geländefarbe aus dem Stylesheet kommt (`[data-art]`) — ein Verlauf aus
 * einer einzigen Farbe legt sich darüber, ohne sie zu ersetzen. So sieht man
 * beides: was das Feld IST und dass es gleich mir gehören soll.
 */
const GEBIET_TON = ['rgba(226, 96, 63, 0.62)', 'rgba(123, 79, 208, 0.62)'] as const;

function auswahlton(sitz: number): string {
  const ton = GEBIET_TON[sitz % GEBIET_TON.length] ?? GEBIET_TON[0];
  return `linear-gradient(${ton}, ${ton})`;
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
  /**
   * Spielart fuer den naechsten Tisch. Nur eine Vorauswahl fuers Menue — am
   * Tisch gilt, was in dessen Regelsatz steht (siehe regeln.ts).
   */
  const [variante, setVariante] = useState<EilandVariante>('nebel');

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
        /*
         * Nur Tische derselben Spielart. Der Server reicht sie in der
         * Tischliste durch (`varianteVon` in tables/service.ts); ein Tisch von
         * vor dem Umbau hat dort `null` und gilt als Nebel — so wie es
         * `pruefeRegeln` auch tut.
         */
        .filter((zeile) => (zeile.variante ?? 'nebel') === variante)
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
      setEigenerTisch(null);
      setTischId(id);
    } catch {
      setSucht(false);
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
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
        .tables('eiland')
        .then(async (zeilen: TableRow[]) => {
          if (!lebt || wechseltGerade.current) return;
          const kleiner = zeilen
            .filter(
              (z) =>
                z.seats === 2 &&
                z.occupied < z.seats &&
                z.id < tischId &&
                (z.variante ?? 'nebel') === variante,
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
          {/*
            Der Schalter zwischen den beiden Spielarten. Er gehoert HIERHER und
            nicht an den Tisch: Die Spielart steht im Regelsatz und damit seit
            dem Aufmachen fest — mitten in der Partie den Nebel abzuschalten
            waere kein Knopf, sondern ein Schummelzettel.
          */}
          <div className="ei-schalter">
            <button
              type="button"
              data-an={variante === 'nebel' ? '' : undefined}
              onClick={() => setVariante('nebel')}
            >
              Im Nebel
            </button>
            <button
              type="button"
              data-an={variante === 'klar' ? '' : undefined}
              onClick={() => setVariante('klar')}
            >
              Offene Karte
            </button>
            <p className="ei-schalter-text">
              {variante === 'nebel'
                ? 'Du siehst dein Gebiet und drei Felder darüber hinaus.'
                : 'Die ganze Insel liegt offen — für euch beide.'}
            </p>
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

/**
 * Die vier orthogonalen Nachbarn — dieselbe Rechnung wie im Modul.
 *
 * Sie steht hier, weil der Bildschirm die Auswahl zusammenstellt, bevor sie
 * zum Server geht (siehe `waehlbar` in der Karte). Diagonalen zaehlen nicht.
 */
function nachbarnVon(platz: number, spalten: number, zeilen: number): number[] {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const raus: number[] = [];
  if (x > 0) raus.push(platz - 1);
  if (x < spalten - 1) raus.push(platz + 1);
  if (y > 0) raus.push(platz - spalten);
  if (y < zeilen - 1) raus.push(platz + spalten);
  return raus;
}

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
   * Bildschirm EINE Regel kennen muss: Anwaehlbar ist ein freies Wiesenfeld,
   * das an das eigene Gebiet grenzt oder an ein Feld, das schon auf dem Zettel
   * steht. Das ist derselbe Weg, den Skat und der Doppelkopf gehen (der Client
   * baut die Aktion selbst aus der Sicht, `legalActions` ist leer), und der
   * Server prueft den fertigen Zettel ohnehin noch einmal — weicht die
   * Rechnung hier je ab, weist er ihn ab, statt ihn falsch auszufuehren.
   */
  const [wahl, setWahl] = useState<number[]>([]);
  /*
   * Neue Runde, leerer Zettel. Am RUNDENZAEHLER aufgehaengt und nicht am
   * Sichten-Objekt: Ein Effekt mit dem Objekt in der Abhaengigkeitsliste
   * liefe bei jedem Serverfunk neu und wuerde die halbfertige Auswahl
   * mitten im Ueberlegen wegwerfen.
   */
  useEffect(() => {
    setWahl([]);
  }, [sicht.runde]);

  const kontingent = sicht.kontingent[eigenerSitz] ?? 1;
  const binBereit = sicht.bereit[eigenerSitz] === true;
  /** Nach dem Abgeben zeigt die Karte, was auf dem Zettel steht. */
  const gewaehlt = useMemo(
    () => new Set(binBereit ? sicht.wahl : wahl),
    [binBereit, sicht.wahl, wahl],
  );

  /** Frei, Wiese, kein Nebel — die Bedingung, die ein Feld ueberhaupt zulaesst. */
  const nehmbar = (platz: number): boolean =>
    sicht.gelaende[platz] === GRAS && sicht.besitzer[platz] === null;

  /**
   * Was jetzt anwaehlbar ist: der Rand des eigenen Gebiets (kommt fertig vom
   * Server) plus der Rand dessen, was schon auf dem Zettel steht.
   */
  const waehlbar = useMemo(() => {
    const raus = new Set<number>(sicht.waehlbar);
    for (const platz of wahl) {
      for (const n of nachbarnVon(platz, sicht.spalten, sicht.zeilen)) {
        if (nehmbar(n)) raus.add(n);
      }
    }
    for (const platz of wahl) raus.delete(platz);
    return raus;
  }, [sicht.waehlbar, sicht.gelaende, sicht.besitzer, sicht.spalten, sicht.zeilen, wahl]);

  /**
   * Ein Feld an- oder abwaehlen.
   *
   * Beim Abwaehlen faellt alles mit, was nur ueber dieses Feld erreichbar war:
   * Ein Vorstoss haengt an seinem ersten Feld, und eine Insel mitten im Freien
   * wuerde der Server ohnehin abweisen. Wer es sieht, versteht es sofort — wer
   * es nicht saehe, wuerde am Ende einen Zettel abschicken, der zurueckkommt.
   */
  const tippe = (platz: number): void => {
    if (!darfPlanen || wartet) return;
    if (gewaehlt.has(platz)) {
      setWahl((alt) => haengtZusammen(alt.filter((p) => p !== platz)));
      return;
    }
    if (wahl.length >= kontingent) return;
    if (!waehlbar.has(platz)) return;
    setWahl((alt) => [...alt, platz]);
  };

  /** Von den eigenen Feldern aus durch die Auswahl laufen; der Rest faellt weg. */
  function haengtZusammen(auswahl: readonly number[]): number[] {
    const offenListe = new Set(auswahl);
    const erreicht = new Set<number>();
    const rand: number[] = [];
    for (let platz = 0; platz < sicht.besitzer.length; platz++) {
      if (sicht.besitzer[platz] === eigenerSitz) rand.push(platz);
    }
    while (rand.length > 0) {
      const platz = rand.pop()!;
      for (const n of nachbarnVon(platz, sicht.spalten, sicht.zeilen)) {
        if (!offenListe.has(n) || erreicht.has(n)) continue;
        erreicht.add(n);
        rand.push(n);
      }
    }
    // Die urspruengliche Reihenfolge bleibt: Sie ist die des Tippens.
    return auswahl.filter((p) => erreicht.has(p));
  }
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

  const offen = kontingent - wahl.length;
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
            const mein = gewaehlt.has(platz);
            const kannWaehlen =
              darfPlanen && !wartet && (mein || (wahl.length < kontingent && waehlbar.has(platz)));
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
                data-waehlbar={kannWaehlen && !mein ? '' : undefined}
                data-gewaehlt={mein ? '' : undefined}
                data-abgegeben={mein && binBereit ? '' : undefined}
                data-kampf={kampf === undefined ? undefined : kampf === eigenerSitz ? 'sieg' : 'verlust'}
                style={{
                  background: imNebel
                    ? (GRAUTOENE[sicht.grau[platz] ?? 0] ?? GRAUTOENE[0])
                    : besitzer !== null
                      ? gebietsfarbe(besitzer)
                      : undefined,
                  // Gewählt heißt: in meiner Farbe getönt. Der gelbe Rahmen im
                  // Stylesheet sagt „noch nicht abgeschickt", die Tönung sagt
                  // „das soll meins werden".
                  backgroundImage: mein ? auswahlton(eigenerSitz) : undefined,
                }}
                onClick={() => tippe(platz)}
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
            {/*
              Der Zaehler steht oben und zaehlt MIT, waehrend man tippt — er
              ist die einzige Rueckmeldung darauf, wie viel man noch vergeben
              darf, und war frueher erst nach der Serverantwort richtig.
            */}
            <p className="ei-hinweis">
              {offen > 0
                ? `Noch ${offen} ${offen === 1 ? 'Feld' : 'Felder'}`
                : 'Alle Felder vergeben'}
            </p>
            <div className="ei-knoepfe">
              <button
                type="button"
                className="ei-knopf"
                disabled={wahl.length === 0 || wartet}
                onClick={() => setWahl([])}
              >
                Zurücksetzen
              </button>
              <button
                type="button"
                className="ei-knopf ei-knopf-stark"
                disabled={wartet}
                onClick={() => onAbgeben(wahl)}
              >
                {wartet ? 'Wird gesendet…' : wahl.length === 0 ? 'Passen' : `Zug abschicken (${wahl.length})`}
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
