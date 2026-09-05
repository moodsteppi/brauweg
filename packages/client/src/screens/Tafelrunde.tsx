import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, type Suchstand } from '../api';
import { Buehne } from '../minispiele/tafelrunde/Buehne';
import { Endbild } from '../minispiele/tafelrunde/Endbild';
import { UNTERGRUND } from '../minispiele/tafelrunde/figuren';
import { Ladebildschirm } from '../minispiele/tafelrunde/Ladebildschirm';
import { Mitspielerleiste } from '../minispiele/tafelrunde/Mitspieler';
import { gegnerDieseRunde } from '../minispiele/tafelrunde/platzierung';
import {
  Figurbild,
  KampfAnzeige,
  type Kampfpaarung,
  abzuspielen,
} from '../minispiele/tafelrunde/KampfAnzeige';
import {
  type Synergie,
  type Synergiestand,
  KARTE_TRIFFT,
  Markennamen,
  Markenzeichen,
  Synergieleiste,
  markennamen,
  schwellenPruefer,
} from '../minispiele/tafelrunde/Synergien';
import {
  type Kaempfer,
  type Ort,
  bestandVon,
  darfSchieben,
  fehlendeKopien,
  neuVerschmolzen,
  ortLesen,
  ortSchluessel,
  platzVon,
  rastermass,
  tippfolge,
  wabenLage,
} from '../minispiele/tafelrunde/zuege';
import { useVorladen } from '../minispiele/tafelrunde/vorladen';
import { useTable } from '../useTable';

/**
 * Tafelrunde — Auto-Battler mit Verschmelzen, im Fantasy-Gewand.
 *
 * Ein Bildschirm mit zwei Gesichtern, wie bei Filler und Eiland: ohne Tisch
 * das Hauptmenue, mit Tisch die Ruestkammer. Der Tisch wird HIER gehalten und
 * nicht ueber App.tsx geroutet — die Match-Suche muss den Tisch unter
 * Umstaenden wechseln (Wettrennen-Regel, siehe unten), und ein Wechsel ueber
 * zwei Bildschirmzustaende hinweg waere ein Flackern.
 *
 * Arbeitsteilung mit dem Spielmodul (`packages/game-tafelrunde`): Der
 * Bildschirm bildet KEINE Regel nach. Was man kaufen darf, steht in
 * `legalActions` und nicht in einer Goldrechnung hier; wie viele Einheiten
 * aufs Brett duerfen, steht als Zahl in der Sicht (`feldplaetze`); wie viele
 * Kopien verschmelzen, ebenfalls (`verschmelzZahl`). Der Client zaehlt nur ab.
 *
 * Die eine Ausnahme ist das Verschieben: `legalActions` zaehlt es bewusst
 * nicht auf (es waere ein Paar aus 19 Plaetzen, also bis zu 342 Eintraege in
 * jeder Sicht). Deshalb prueft der Bildschirm hier selbst genau EINE
 * Bedingung — Bank auf ein freies Brettfeld nur, solange `belegt` unter
 * `feldplaetze` liegt. Das ist keine nachgebaute Regel, sondern der Vergleich
 * zweier Zahlen, die das Modul liefert; der Server prueft sie ohnehin noch
 * einmal.
 */

// ---------------------------------------------------------------------------
// Die Sicht des Moduls
// ---------------------------------------------------------------------------

/** Kampfrolle. Siehe packages/game-tafelrunde/src/katalog.ts. */
type Rolle = 'wache' | 'schuetze' | 'magier' | 'meuchler' | 'beistand';

interface Einheit {
  id: string;
  name: string;
  kosten: number;
  rolle: Rolle;
  marken: string[];
  leben: number;
  angriff: number;
  tempo: number;
  reichweite: number;
  ruestung: number;
}

/*
 * `Kaempfer` und `Ort` stehen in minispiele/tafelrunde/zuege.ts — zusammen
 * mit der Rechnerei, die sie benutzt. Ein zweiter Satz hier liefe beim ersten
 * neuen Feld auseinander.
 */

interface Serie {
  art: 'sieg' | 'niederlage' | null;
  laenge: number;
}

/** Alles, was nur dem eigenen Sitz gehoert. */
interface EigeneSicht {
  sitz: number;
  leben: number;
  gold: number;
  level: number;
  laden: (string | null)[];
  bank: (Kaempfer | null)[];
  brett: (Kaempfer | null)[];
  serie: Serie;
  bereit: boolean;
  ausRunde: number | null;
  feldplaetze: number;
  belegt: number;
  einkommen: number;
  neuwuerfelnKosten: number;
  aufstiegKosten: number | null;
  darfHandeln: boolean;
  /**
   * Die Marken auf dem eigenen BRETT mit Anzahl, erreichter und naechster
   * Schwelle (sicht.ts). Nur Marken mit mindestens einem Traeger stehen
   * drin — das Modul laesst die uebrigen weg.
   *
   * Wahlfrei gefuehrt wie `kaempfe`: Ein Tisch, der vor den Synergien
   * aufgemacht wurde, hat das Feld nicht. Dann bleibt die Leiste leer,
   * statt dass der Bildschirm stolpert.
   */
  synergien?: Synergiestand[];
}

interface FremdeSicht {
  sitz: number;
  leben: number;
  level: number;
  serie: Serie;
  brett: (Kaempfer | null)[];
  bereit: boolean;
  ausRunde: number | null;
  verlassen: boolean;
  /** Auch beim Gegner: Das Brett ist oeffentlich, also sind es seine Marken. */
  synergien?: Synergiestand[];
}

interface TafelrundeSicht {
  ich: number | null;
  runde: number;
  rundenGrenze: number;
  phase: 'vorbereitung' | 'kampf' | 'ende';
  fertig: boolean;
  sieger: number | null;
  zuschauer: boolean;
  ladenPlaetze: number;
  bankPlaetze: number;
  brettFelder: number;
  brettReihen: number;
  brettSpalten: number;
  verschmelzZahl: number;
  maxStufe: number;
  vorrat: Record<string, number>;
  eigenes: EigeneSicht | null;
  gegner: FremdeSicht[];
  leftSeats: number[];
  /**
   * Die Kaempfe der laufenden Kampfphase mit vollem Ablaufprotokoll — ein
   * Spieler bekommt seinen eigenen, ein Zuschauer alle; ausserhalb der
   * Kampfphase leer (sicht.ts). Als wahlfrei gefuehrt, weil eine Sicht aus
   * der Zeit vor der Kampfsimulation das Feld nicht hat — der Bildschirm
   * zeigt dann die Wartezeile statt zu stolpern.
   */
  kaempfe?: Kampfpaarung[];
  /** Kommt NUR in der ersten Sicht nach dem Beitritt, siehe sicht.ts. */
  katalog?: Einheit[];
  /**
   * Die Synergie-Tabelle mit allen Stufen — wie der Katalog nur in der ersten
   * Sicht und aus demselben Grund: Sie aendert sich nie. Wer sie nicht
   * festhaelt, hat ab dem zweiten Rundruf keine Schwellen mehr.
   */
  synergieTabelle?: Synergie[];
}

/**
 * Warum ein Kauf gerade nicht geht — die AUSKUNFT, nicht die Entscheidung.
 *
 * Ob gekauft werden darf, sagt allein `legalActions`. Dieser Wert wird erst
 * gebildet, wenn dort nichts steht, und beschriftet nur noch die schon
 * gefallene Absage. Andersherum waere es der Fehler, vor dem der Kopf dieser
 * Datei warnt: Ein Client, der selbst entscheidet, zeigt frueher oder spaeter
 * einen Knopf, den der Server abweist.
 */
type Kaufhindernis = 'gold' | 'bank' | null;

/** Aktion des Moduls, siehe partie.ts. */
type Aktion =
  | { typ: 'kaufen'; platz: number }
  | { typ: 'neuwuerfeln' }
  | { typ: 'levelAuf' }
  | { typ: 'verschieben'; von: Ort; nach: Ort }
  | { typ: 'verkaufen'; ort: Ort }
  | { typ: 'bereit' };

// ---------------------------------------------------------------------------
// Feste Werte
// ---------------------------------------------------------------------------

/**
 * Regelsatz, mit dem die Match-Suche einen Tisch aufmacht.
 *
 * Muss zu DEFAULT_REGELN in packages/game-tafelrunde/src/regeln.ts passen.
 * Bewusst ausgeschrieben statt ueber `api.defaults()` geholt: Die Suche soll
 * nicht auf eine zusaetzliche Antwort warten, bevor sie den Tisch aufmacht —
 * dieselbe Ueberlegung wie bei Filler.
 *
 * ACHTUNG, DIESE KOPIE WIRD MITGESCHICKT und nicht nur angezeigt: `config`
 * geht an `createTable`, der Server nimmt sie als Regelsatz des Tisches. Eine
 * veraltete Zahl hier ueberstimmt also DEFAULT_REGELN, ohne dass irgendwo ein
 * Fehler auffaellt. Genau das waere am 05.09.2026 bei der Umstellung auf 20
 * Leben passiert. Dass diese Liste ueberhaupt doppelt steht, ist ein eigener
 * Punkt auf dem Board.
 */
const REGELSATZ = {
  startLeben: 20,
  startGold: 2,
  ladenPlaetze: 5,
  bankPlaetze: 9,
  neuwuerfelnKosten: 2,
  grundeinkommen: 5,
  rundenGrenze: 30,
};

/**
 * Sitze am Bot-Tisch: vier.
 *
 * Nur fuer "Gegen Bots spielen". Die Mitspielersuche baut ihren Tisch
 * serverseitig und nimmt dort die volle Acht — dort wartet niemand auf
 * Menschen, die freien Plaetze fuellt der Server nach 30 Sekunden mit Bots.
 * Hier gegen die KI sind vier genug: Acht Bots rechnen laenger, ohne dass es
 * sich anders spielt.
 */
const SITZE = 4;

/**
 * Takt, in dem der Stand der Suche abgefragt wird.
 *
 * Eine Sekunde, weil daneben ein Countdown laeuft: Bei einem traegeren Takt
 * springt die Zahl. Der Abruf ist zugleich das Lebenszeichen an den Server —
 * hoert er auf, faellt man von selbst aus der Schlange (siehe suche/schlange.ts).
 */
const SUCH_TAKT_MS = 1000;

/**
 * Farbe je Kostenstufe. Reine Zeichnung, kein Bedeutungstraeger der
 * Plattform — deshalb steht sie hier und nicht als CSS-Variable in
 * styles.css (DESIGN.md: Variablen sind fuer Gruen/Gold/Lila/Rot reserviert,
 * und eine Kostenstufe ist keins davon).
 */
const KOSTEN_FARBE: Record<number, string> = {
  1: '#8fa3ad',
  2: '#5aa86a',
  3: '#5ea0f0',
};

/**
 * Ein Tisch aus der Zeit vor den Synergien schickt das Feld nicht mit. Die
 * leere Liste steht als KONSTANTE hier und nicht als `?? []` an der
 * Verwendung: Ein frisches Array bei jedem Rundruf waere eine neue
 * Abhaengigkeit und wuerde den Pruefer darunter jedes Mal neu bauen.
 */
const OHNE_SYNERGIEN: Synergiestand[] = [];

const ROLLE_NAME: Record<Rolle, string> = {
  wache: 'Wache',
  schuetze: 'Schütze',
  magier: 'Magier',
  meuchler: 'Meuchler',
  beistand: 'Beistand',
};

/**
 * Das Zeichen einer Rolle — gezeichnet, nicht geladen.
 *
 * Seit es Figuren gibt (figuren.ts), ist das hier der RUECKFALL: Jede Einheit
 * zeigt ihr Bild, und nur wenn dazu keins vorliegt oder es nicht laedt, tritt
 * diese Strichzeichnung an seine Stelle (`Figurbild`). Fuer die fuenf Rollen
 * selbst gibt es weiterhin keine Bilder, und ein `<img>` auf eine Datei, die
 * es nicht gibt, ist ein weisser Kasten (CLAUDE.md und DESIGN.md) — deshalb
 * bleiben es fuenf schlichte Pfade.
 */
function RollenZeichen({ rolle }: { rolle: Rolle }): React.JSX.Element {
  const pfade: Record<Rolle, React.JSX.Element> = {
    wache: <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />,
    schuetze: <path d="M5 19 19 5M19 5h-6M19 5v6M5 19c4-1 7-4 8-8" />,
    magier: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.5 6.5l3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />,
    meuchler: <path d="M6 18 18 6l1 4-9 9-4-1ZM6 18l-2 2" />,
    beistand: <path d="M12 4v16M4 12h16" />,
  };
  return (
    <svg className="tr-rolle" viewBox="0 0 24 24" aria-hidden="true">
      {pfade[rolle]}
    </svg>
  );
}

/** Muenze und Herz stehen als Zeichen daneben, damit die Zahl nicht nackt ist. */
function GoldZeichen(): React.JSX.Element {
  return (
    <svg className="tr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.8h4a1.9 1.9 0 0 1 0 3.8h-3a1.9 1.9 0 0 0 0 3.8h4" />
    </svg>
  );
}

function LebenZeichen(): React.JSX.Element {
  return (
    <svg className="tr-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-.8c0 .3.0.4 0 .6C19 15.7 12 20 12 20Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Der Bildschirm
// ---------------------------------------------------------------------------

export function Tafelrunde({
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
  const [startet, setStartet] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);

  const tisch = useTable<TafelrundeSicht>(tischId, 'tafelrunde');
  const sicht = tisch.view?.view ?? null;

  /**
   * Figuren und Untergrund holen, ab dem ersten Bild dieses Bildschirms.
   *
   * Angestossen wird HIER und nicht erst am Tisch: Vom Antippen im Hub bis zur
   * ersten Runde liegen Menue, Suche und Tischaufbau — Zeit, in der die Leitung
   * nichts zu tun hat. Wer 30 Sekunden auf Mitspieler wartet, soll danach
   * keinen Ladebildschirm mehr sehen.
   *
   * Gewartet wird trotzdem, und zwar unten vor der Ruestkammer: Sonst kauft man
   * in Runde 1 eine Einheit und sieht einen leeren Platz, bis die Datei da ist
   * (der Befund vom 05.09.2026). Haengen kann das nicht — bleibt eine Datei
   * aus, gibt der Lauf nach seiner Ruhefrist auf und laesst weiterspielen
   * (`FRIST_MS`, siehe vorladen.ts).
   */
  const vorrat = useVorladen();

  /**
   * Der Katalog kommt nur EINMAL, in der ersten Sicht nach dem Beitritt
   * (`seit === 0`, siehe sicht.ts). Danach steht in jeder Sicht `katalog:
   * undefined` — wer ihn nicht festhaelt, hat ab dem zweiten Rundruf keine
   * Namen und keine Werte mehr und zeichnet leere Karten.
   */
  const [katalog, setKatalog] = useState<Record<string, Einheit>>({});
  useEffect(() => {
    if (!sicht?.katalog) return;
    setKatalog(Object.fromEntries(sicht.katalog.map((e) => [e.id, e])));
  }, [sicht?.katalog]);

  /** Und aus demselben Grund die Synergie-Tabelle: auch sie kommt nur einmal. */
  const [synergieTabelle, setSynergieTabelle] = useState<Synergie[]>([]);
  useEffect(() => {
    if (!sicht?.synergieTabelle) return;
    setSynergieTabelle(sicht.synergieTabelle);
  }, [sicht?.synergieTabelle]);

  // -------------------------------------------------------------------------
  // Match-Suche
  // -------------------------------------------------------------------------

  /**
   * Mitspieler suchen — seit dem 05.09.2026 ueber die Suchschlange des
   * Servers und nicht mehr ueber die Tischliste.
   *
   * Der alte Weg (offenen Tisch suchen, sonst selbst einen aufmachen, und ein
   * Wettrennen zweier gleichzeitiger Tische per Kennungsvergleich aufloesen)
   * ist damit weg: Er konnte zwei Menschen in zwei getrennten Tischen
   * festsetzen, und vor allem hatte er kein Ende — wer als Einziger suchte,
   * wartete bis zum Verfall des Tisches. Jetzt sammelt der Server 30 Sekunden
   * lang, setzt danach alle Gefundenen an EINEN Tisch und fuellt den Rest mit
   * Bots.
   */
  const starteSuche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const stand = await api.sucheStarten('tafelrunde');
      if (stand.tischId) setTischId(stand.tischId);
      else setSuchstand(stand);
    } catch {
      setFehler('Die Suche ist fehlgeschlagen. Noch einmal versuchen?');
    } finally {
      setStartet(false);
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
        .sucheStand('tafelrunde')
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
            // Die Schlange kennt uns nicht mehr — etwa nach einem Neustart
            // des Servers. Lieber ehrlich melden als stumm weiterdrehen.
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
      if (suchtRef.current) void api.sucheAbbrechen('tafelrunde').catch(() => {});
    },
    [],
  );

  const brichSucheAb = useCallback((): void => {
    setSuchstand(null);
    void api.sucheAbbrechen('tafelrunde').catch(() => {});
  }, []);

  /**
   * Einen Tisch gegen den Computer aufmachen.
   *
   * Steht seit dem 05.09.2026 UNTER der Suche statt darueber. Der Grund fuer
   * die alte Reihenfolge war, dass die Suche kein Ende hatte und man als
   * Erster auf eine Runde wartete, die es an diesem Abend nicht gab. Das
   * 30-Sekunden-Fenster nimmt ihr diesen Nachteil: Die Suche endet immer, im
   * schlechtesten Fall mit demselben Bot-Tisch.
   */
  const starteBots = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const { id } = await api.createTable({
        gameId: 'tafelrunde',
        config: REGELSATZ,
        seats: SITZE,
        rounds: 1,
        visibility: 'on_request',
        fillWithBots: true,
      });
      setTischId(id);
    } catch {
      setFehler('Der Tisch ließ sich nicht aufmachen. Noch einmal versuchen?');
    } finally {
      setStartet(false);
    }
  }, []);

  /**
   * Zurueck ins Menue, bevor die Partie laeuft. Der Platz am Tisch wird dabei
   * geraeumt — der Server schliesst einen Tisch, an dem danach kein Mensch
   * mehr sitzt.
   */
  const brichAb = useCallback((): void => {
    const id = tischId;
    setTischId(null);
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  const verlasseUndZurueck = useCallback((): void => {
    const id = tischId;
    if (id) void api.leaveTable(id).catch(() => {});
    onBack();
  }, [tischId, onBack]);

  // Auch im Wartebereich weiterzaehlen: Eine eingefrorene Null waehrend der
  // Suche sieht aus, als suchte man allein.
  useEffect(() => {
    if (sicht) return;
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveSpieler('tafelrunde')
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
  // Mitspieler suchen
  // -------------------------------------------------------------------------

  if (!tischId && suchstand) {
    const sekunden = Math.ceil(suchstand.restMs / 1000);
    const gefunden = suchstand.suchende;
    return (
      <main className="tr-seite tr-menue">
        <button className="tr-zurueck" type="button" onClick={brichSucheAb}>
          ← Abbrechen
        </button>
        <div className="tr-menue-mitte">
          <h1 className="tr-titel">Mitspieler suchen</h1>
          {/* Die Zahl gross und ohne Einheit: Sie zaehlt sichtbar herunter und
              beantwortet damit die einzige Frage, die man hier hat. */}
          <p className="tr-countdown" aria-live="polite">
            {sekunden}
          </p>
          <p className="tr-untertitel">
            {gefunden === 1
              ? 'Noch niemand sonst — bleibt es dabei, wird mit Bots aufgefüllt.'
              : `${gefunden} Spieler gefunden`}
          </p>
          <div className="tr-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="tr-untertitel tr-klein">{aktiv ?? '…'} Spieler gerade in Tafelrunde</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Menue
  // -------------------------------------------------------------------------

  if (!tischId) {
    return (
      <main className="tr-seite tr-menue">
        <button className="tr-zurueck" type="button" onClick={onBack} aria-label="Zurück">
          ←
        </button>
        <div className="tr-menue-mitte">
          <h1 className="tr-titel">Tafelrunde</h1>
          <p className="tr-untertitel">
            Kaufe Recken, stelle sie aufs Feld und lege drei gleiche zusammen —
            aus dreien wird eine stärkere. Wer am längsten steht, gewinnt.
          </p>
          <div className="tr-probe" aria-hidden="true">
            {(['wache', 'schuetze', 'magier', 'meuchler', 'beistand'] as const).map((r) => (
              <span key={r} style={{ color: KOSTEN_FARBE[2] }}>
                <RollenZeichen rolle={r} />
              </span>
            ))}
          </div>
          <button
            className="tr-suchen"
            type="button"
            onClick={() => void starteSuche()}
            disabled={startet}
          >
            Mitspieler suchen
          </button>
          <button
            className="tr-nebenknopf"
            type="button"
            onClick={() => void starteBots()}
            disabled={startet}
          >
            Gegen Bots spielen
          </button>
          <button
            className="tr-nebenknopf"
            type="button"
            onClick={() => setRegelnOffen(true)}
          >
            So spielt man Tafelrunde
          </button>
          {fehler && <p className="tr-fehler">{fehler}</p>}
          <p className="tr-untertitel tr-klein">{aktiv ?? '…'} Spieler gerade in Tafelrunde</p>
        </div>
        {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Der Tisch steht, die Partie laeuft an
  // -------------------------------------------------------------------------

  if (!sicht) {
    const besetzt = (tisch.table?.seats ?? []).filter((platz) => platz.accountId).length;
    return (
      <main className="tr-seite tr-menue">
        <button className="tr-zurueck" type="button" onClick={brichAb}>
          ← Abbrechen
        </button>
        <div className="tr-menue-mitte">
          <h1 className="tr-titel">Tisch wird aufgebaut</h1>
          <p className="tr-untertitel">
            {tisch.status === 'open'
              ? `${besetzt} von ${tisch.table?.seats.length ?? SITZE} Plätzen besetzt`
              : 'Verbindung wird aufgebaut…'}
          </p>
          <div className="tr-punkte-lauf" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="tr-untertitel tr-klein">{aktiv ?? '…'} Spieler gerade in Tafelrunde</p>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Dateien werden heruntergeladen
  // -------------------------------------------------------------------------

  /*
   * Erst der Tisch, dann die Dateien — die Reihenfolge ist Absicht. Waehrend
   * der Mitspielersuche steht die nuetzlichere Auskunft auf dem Schirm ("3 von
   * 4 Plaetzen besetzt"), und in deren 30 Sekunden sind die 47 kB ohnehin
   * durch. Sichtbar wird dieser Vorhang deshalb vor allem beim Bot-Tisch, der
   * sofort steht — und auf einer langsamen Leitung.
   *
   * Beim ZWEITEN Mal kommt er nicht wieder: `useVorladen` merkt sich den Lauf
   * modulweit, `fertig` steht dann schon beim ersten Bild.
   */
  if (!vorrat.fertig) return <Ladebildschirm stand={vorrat} onAbbrechen={brichAb} />;

  return (
    /* Die Anzeigenamen der Marken stehen tief im Baum an jeder Einheit — auf
       neunzehn Feldern, neun Bankplaetzen und fuenf Ladenkarten. Als Kontext
       und nicht als durchgereichte Eigenschaft, siehe Synergien.tsx. */
    <Markennamen.Provider value={markennamen(synergieTabelle)}>
      <Ruestkammer
        sicht={sicht}
        katalog={katalog}
        synergieTabelle={synergieTabelle}
        /* `legalActions` ist im Protokoll als Kartenspiel-Aktion typisiert
           ({type, seat}); dieses Modul schickt seine eigene Form. Der Server
           reicht die Liste unveraendert durch (runtime/party.ts), deshalb ist
           die Umdeutung hier korrekt und nicht bloss bequem. */
        legaleZuege={(tisch.view?.legalActions ?? []) as unknown as Aktion[]}
        revision={tisch.view?.revision ?? -1}
        frist={tisch.view?.interludeDeadline ?? null}
        sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
        onAktion={(aktion) => tisch.send(aktion)}
        onZurueck={verlasseUndZurueck}
      />
    </Markennamen.Provider>
  );
}

// ---------------------------------------------------------------------------
// Die Ruestkammer
// ---------------------------------------------------------------------------

interface SitzZeile {
  seat: number;
  displayName: string | null;
  avatarUrl: string | null;
  isBot: boolean;
}

function Ruestkammer({
  sicht,
  katalog,
  synergieTabelle,
  legaleZuege,
  revision,
  frist,
  sitze,
  onAktion,
  onZurueck,
}: {
  sicht: TafelrundeSicht;
  katalog: Record<string, Einheit>;
  /** Alle Stufen aller Marken — einmal beim Beitritt geholt und festgehalten. */
  synergieTabelle: Synergie[];
  legaleZuege: Aktion[];
  revision: number;
  /** Frist der Schaupause (`interludeDeadline`), waehrend des Kampfes gesetzt. */
  frist: number | null;
  sitze: readonly SitzZeile[];
  onAktion: (aktion: Aktion) => void;
  onZurueck: () => void;
}): React.JSX.Element {
  const eigenes = sicht.eigenes;
  const kampfbild = useKampfbild(sicht);
  /** Gegner, dessen Brett oben liegt. Null = niemand ausgewaehlt. */
  const [gezeigterGegner, setGezeigterGegner] = useState<number | null>(null);
  const [regelnOffen, setRegelnOffen] = useState(false);

  /**
   * Welches Endbild schon weggeklickt wurde.
   *
   * Es gibt ZWEI Anlaesse — ich scheide aus, und die Partie endet — und der
   * zweite kommt nach dem ersten. Deshalb wird der Anlass gemerkt und nicht
   * bloss ein `false`: Wer sein Ausscheiden wegklickt, um weiter zuzusehen,
   * bekaeme sonst am Ende der Partie kein Schlussbild mehr.
   */
  const [endbildWeg, setEndbildWeg] = useState<'aus' | 'ende' | null>(null);

  /**
   * Was ich angetippt habe und noch nicht losgelassen — der ausgewaehlte Ort.
   *
   * Der zweite Bedienweg neben dem Ziehen: antippen, dann Ziel antippen. Er
   * ist nicht nur Ausweichlösung fuer wackelige Finger, sondern der schnellere
   * Weg auf einem kleinen Schirm — und der einzige, der mit einem
   * Vorlesegeraet ueberhaupt funktioniert.
   */
  const [gewaehlt, setGewaehlt] = useState<Ort | null>(null);

  /**
   * Eine abgesetzte Aktion sperrt die Bedienung, bis der Server geantwortet
   * hat (also bis die Revision steigt). Ohne diese Sperre setzt ein zweiter
   * Tipp im selben Moment einen zweiten Kauf ab, den der Server abweist — und
   * der Spieler sieht einen Fehler fuer etwas, das er richtig gemacht hat.
   * Dieselbe Bauart wie `getippt` in Filler.tsx.
   */
  const [gesendet, setGesendet] = useState<number | null>(null);
  useEffect(() => {
    setGesendet((alt) => (alt !== null && revision > alt ? null : alt));
  }, [revision]);
  /*
   * Und eine Notbremse dazu, die Filler nicht braucht: Dort ist man einmal je
   * Zug an der Reihe, hier bei JEDER Aktion. Weist der Server eine ab, steigt
   * die Revision nicht — die Sperre bliebe fuer immer stehen und der Spieler
   * saesse vor einem toten Bildschirm. Nach zweieinhalb Sekunden geht sie
   * deshalb von selbst auf; kam die Antwort inzwischen, ist sie ohnehin weg.
   */
  useEffect(() => {
    if (gesendet === null) return;
    const uhr = window.setTimeout(() => setGesendet(null), 2500);
    return () => window.clearTimeout(uhr);
  }, [gesendet]);
  const wartet = gesendet !== null;

  const schicke = useCallback(
    (aktion: Aktion): void => {
      if (wartet) return;
      setGesendet(revision);
      setGewaehlt(null);
      onAktion(aktion);
    },
    [wartet, revision, onAktion],
  );

  // -------------------------------------------------------------------------
  // Verschmelzen sichtbar machen
  // -------------------------------------------------------------------------

  /**
   * Welche (Einheit, Stufe) ich zuletzt besass — daraus entsteht die Meldung
   * "verschmolzen".
   *
   * Der Vergleich ist noetig, weil das Modul beim Kauf STILL verschmilzt: In
   * der neuen Sicht liegt einfach eine staerkere Einheit, und die drei
   * schwachen sind weg. Ohne diesen Vergleich saehe man nur das Ergebnis und
   * fragte sich, wo die Karten hin sind — genau das soll der Bildschirm
   * verhindern.
   */
  const letzterBestand = useRef<Map<string, number> | null>(null);
  const [verschmolzen, setVerschmolzen] = useState<{
    id: string;
    stufe: number;
    marke: number;
  } | null>(null);

  useEffect(() => {
    if (!eigenes) return;
    const jetzt = bestandVon(eigenes);
    const vorher = letzterBestand.current;
    letzterBestand.current = jetzt;
    if (!vorher) return;
    const frisch = neuVerschmolzen(vorher, jetzt);
    // Die Marke ist der Ausloeser fuer den Timer weiter unten: Zweimal
    // dasselbe Verschmelzen hintereinander ergaebe sonst dasselbe Objekt,
    // und die zweite Meldung stuende ohne Uhr da.
    if (frisch) setVerschmolzen({ ...frisch, marke: Date.now() });
  }, [eigenes]);

  // Die Meldung verschwindet von selbst. An die Marke gehaengt und nicht an
  // das Objekt: Sonst raeumt jeder Serverfunk den Timer ab, und die Meldung
  // stuende bis zum naechsten Zug (STAND.md, "React-Effekte an einen
  // Schluessel haengen").
  useEffect(() => {
    if (!verschmolzen) return;
    const uhr = window.setTimeout(() => setVerschmolzen(null), 2200);
    return () => window.clearTimeout(uhr);
  }, [verschmolzen?.marke]);

  // -------------------------------------------------------------------------
  // Ziehen und Antippen
  // -------------------------------------------------------------------------

  /** Was gerade am Finger haengt, samt Bildschirmkoordinate fuer den Schatten. */
  const [zug, setZug] = useState<{ von: Ort; x: number; y: number; zieht: boolean } | null>(null);
  const startPunkt = useRef<{ x: number; y: number } | null>(null);

  const darfHandeln = eigenes?.darfHandeln === true && !wartet;

  /**
   * Darf eine Einheit von `von` nach `nach`?
   *
   * Die einzige Bedingung, die der Bildschirm selbst prueft — und sie besteht
   * aus zwei Zahlen der Sicht (siehe Kopf dieser Datei). Alles andere weist
   * der Server ab, falls es doch einmal danebengeht.
   */
  const zielbar = useCallback(
    (von: Ort, nach: Ort): boolean => (eigenes ? darfSchieben(eigenes, von, nach) : false),
    [eigenes],
  );

  const schiebe = useCallback(
    (von: Ort, nach: Ort): void => {
      if (!darfHandeln || !zielbar(von, nach)) return;
      schicke({ typ: 'verschieben', von, nach });
    },
    [darfHandeln, zielbar, schicke],
  );

  /**
   * Ein Ort ist angetippt worden — entweder als Auswahl oder als Ziel.
   *
   * Beide Wege laufen hier zusammen, damit sie nie auseinanderlaufen: Wer
   * etwas gewaehlt hat und dasselbe noch einmal tippt, hebt die Wahl auf; wer
   * ein anderes Feld tippt, schiebt dorthin; wer nichts gewaehlt hat, waehlt.
   */
  const tippeOrt = useCallback(
    (ort: Ort): void => {
      if (!darfHandeln || !eigenes) return;
      const folge = tippfolge(eigenes, gewaehlt, ort);
      if (folge.art === 'waehlen') setGewaehlt(folge.ort);
      else if (folge.art === 'abwaehlen') setGewaehlt(null);
      else if (folge.art === 'schieben') schiebe(folge.von, folge.nach);
    },
    [darfHandeln, eigenes, gewaehlt, schiebe],
  );

  /**
   * Ziehen mit dem Finger.
   *
   * Pointer-Ereignisse und NICHT die HTML5-Zieh-Schnittstelle: `dragstart`
   * gibt es auf iOS und Android schlicht nicht, ein Brett, das nur mit der
   * Maus zu bedienen ist, waere am Handy unbenutzbar — und die App wird am
   * Handy gespielt. Die Trefferpruefung laeuft ueber
   * `document.elementFromPoint`, weil das Ziel unter dem Finger liegt und
   * nicht unter dem Ereignis.
   */
  const beiZeigerStart = useCallback(
    (ort: Ort, ereignis: React.PointerEvent): void => {
      if (!darfHandeln) return;
      startPunkt.current = { x: ereignis.clientX, y: ereignis.clientY };
      setZug({ von: ort, x: ereignis.clientX, y: ereignis.clientY, zieht: false });
      // Ohne Zeigererfassung verliert das Element die Bewegung, sobald der
      // Finger es verlaesst — und das tut er sofort.
      (ereignis.currentTarget as HTMLElement).setPointerCapture?.(ereignis.pointerId);
    },
    [darfHandeln],
  );

  const beiZeigerBewegung = useCallback((ereignis: React.PointerEvent): void => {
    const start = startPunkt.current;
    if (!start) return;
    const weit =
      Math.abs(ereignis.clientX - start.x) > 8 || Math.abs(ereignis.clientY - start.y) > 8;
    setZug((alt) =>
      alt ? { ...alt, x: ereignis.clientX, y: ereignis.clientY, zieht: alt.zieht || weit } : alt,
    );
  }, []);

  /**
   * Der Browser hat das Ziehen abgebrochen — ein Anruf, eine Geste des
   * Betriebssystems, ein zweiter Finger. Ohne diesen Aufraeumer bliebe der
   * Schatten am Bildschirm kleben und die Einheit blass an ihrem Platz.
   */
  const beiZeigerAbbruch = useCallback((): void => {
    startPunkt.current = null;
    setZug(null);
  }, []);

  const beiZeigerEnde = useCallback(
    (ort: Ort, ereignis: React.PointerEvent): void => {
      const gezogen = zug?.zieht === true;
      startPunkt.current = null;
      setZug(null);
      if (!gezogen) {
        // Ein Tipp, keine Bewegung: Auswahl statt Ziehen.
        tippeOrt(ort);
        return;
      }
      const unten = document.elementFromPoint(ereignis.clientX, ereignis.clientY);
      const ziel = ortLesen(
        (unten?.closest('[data-ziel]') as HTMLElement | null)?.dataset.ziel,
      );
      if (ziel) schiebe(ort, ziel);
    },
    [zug?.zieht, tippeOrt, schiebe],
  );

  // -------------------------------------------------------------------------
  // Ableitungen aus legalActions
  // -------------------------------------------------------------------------

  /** Ladenplaetze, die der Server gerade zum Kauf freigibt. */
  const kaufbar = useMemo(() => {
    const raus = new Set<number>();
    for (const zug of legaleZuege) if (zug.typ === 'kaufen') raus.add(zug.platz);
    return raus;
  }, [legaleZuege]);
  const darfWuerfeln = legaleZuege.some((z) => z.typ === 'neuwuerfeln');
  const darfLevel = legaleZuege.some((z) => z.typ === 'levelAuf');

  const bestand = useMemo<Map<string, number>>(
    () => (eigenes ? bestandVon(eigenes) : new Map()),
    [eigenes],
  );

  /**
   * Wie viele Kopien einer Einheit auf Stufe 1 mir zum Verschmelzen fehlen.
   *
   * Die Zahl `verschmelzZahl` kommt aus der Sicht und nicht als 3 aus dem
   * Client — siehe Kopf dieser Datei.
   */
  const fehlen = useCallback(
    (id: string, stufe = 1): number =>
      fehlendeKopien(bestand, sicht.verschmelzZahl, id, stufe),
    [bestand, sicht.verschmelzZahl],
  );

  /**
   * Warum ein Ladenplatz gesperrt ist.
   *
   * Beide Groessen stehen in der Sicht — das Gold und die Bank —, es wird
   * also keine Regel nachgerechnet, sondern eine Absage beschriftet, die
   * `legalActions` schon ausgesprochen hat (siehe `Kaufhindernis`). Die
   * Reihenfolge ist Absicht: Fehlt beides, nennt der Bildschirm das Gold,
   * denn daran laesst sich in derselben Runde noch etwas aendern.
   *
   * Gibt bewusst `null` zurueck, wenn die Zahlen die Sperre NICHT erklaeren.
   * Dann steht der Grund woanders (Kampfphase, schon bereit, ausgeschieden),
   * und eine geratene Beschriftung waere schlimmer als keine.
   */
  const hindernis = useCallback(
    (angeboten: Einheit | undefined): Kaufhindernis => {
      if (!angeboten || !eigenes) return null;
      if (eigenes.gold < angeboten.kosten) return 'gold';
      // Eine volle Bank verbietet den Kauf nur, wenn er nicht sofort
      // verschmilzt — genau dann steht er aber in `legalActions`, und diese
      // Funktion laeuft gar nicht erst.
      if (!eigenes.bank.includes(null)) return 'bank';
      return null;
    },
    [eigenes],
  );

  // -------------------------------------------------------------------------
  // Synergien
  // -------------------------------------------------------------------------

  /**
   * Was die Sicht ueber die eigenen Marken sagt — nicht mehr und nicht
   * weniger. Der Bildschirm zaehlt das Brett dafuer NICHT ab: Die Schwellen
   * und die Boni stehen im Modul (synergien.ts), und zwei Wahrheiten ueber
   * einen Bonus waeren eine zu viel.
   */
  const eigeneSynergien = eigenes?.synergien ?? OHNE_SYNERGIEN;

  /**
   * Erreicht der Kauf einer Marke gerade eine Schwelle? Einmal gebunden, damit
   * der Rahmen der Karte und das Leuchten am Zeichen dieselbe Antwort geben.
   */
  const trifftSchwelle = useMemo(
    () => schwellenPruefer(eigeneSynergien, synergieTabelle),
    [eigeneSynergien, synergieTabelle],
  );

  const zeile = (sitz: number): SitzZeile | undefined => sitze.find((s) => s.seat === sitz);

  /**
   * Gegen wen ich diese Runde antrete — null, solange es niemand weiss.
   *
   * Die Sicht fuehrt `kaempfe` nur waehrend der Kampfphase, und das Modul
   * setzt die Paarungen auch erst beim Phasenwechsel an (setzeAn in
   * partie.ts). In der Vorbereitung gibt es die Auskunft also nirgends —
   * nicht nur hier nicht.
   */
  const gegnerJetzt = gegnerDieseRunde(sicht.kaempfe, sicht.ich);

  const lebendeGegner = sicht.gegner.filter((g) => g.ausRunde === null);
  const gegner =
    sicht.gegner.find((g) => g.sitz === gezeigterGegner) ?? lebendeGegner[0] ?? sicht.gegner[0];

  /**
   * Die Arena an der Stelle der beiden Bretter, solange ein Kampf zu zeigen
   * ist — und noch einen Wimpernschlag darueber hinaus, damit sie verblassen
   * kann statt zu verschwinden (siehe `useKampfbild`). Der Schluessel ist der
   * Kampf selbst: Ein neuer Kampf ist eine neue Anzeige mit frischer Uhr, ein
   * weiterer Rundruf desselben Kampfes nicht.
   */
  const arena = kampfbild && (
    /*
     * Die Buehne steht UM die Arena herum und nicht in ihr: Sie entsteht mit
     * der Kampfphase und vergeht mit ihr, und daran haengt ihre Rundenansage
     * (Buehne.tsx). Zwischen den Kaempfen gibt es sie nicht — die
     * Ruestkammer ist kein Schauplatz, sondern ein Werktisch.
     */
    <Buehne runde={sicht.runde} verblasst={kampfbild.verblasst}>
      <KampfAnzeige
        key={kampfSchluessel(kampfbild.kaempfe, sicht.ich)}
        kaempfe={kampfbild.kaempfe}
        ich={sicht.ich}
        brettReihen={sicht.brettReihen}
        brettSpalten={sicht.brettSpalten}
        katalog={katalog}
        nameVon={(sitz) => spielername(zeile(sitz), sitz)}
        /* Die Figur holt sich die Arena selbst aus figuren.ts; hier kommt nur
           der Rueckfall herein — dieselbe Strichzeichnung wie auf dem Brett,
           damit man seine Einheiten auch dann wiedererkennt, wenn ein Bild
           fehlt. */
        ersatzzeichen={(einheit) => <RollenZeichen rolle={einheit.rolle} />}
        farbeVon={(einheit) => KOSTEN_FARBE[einheit.kosten] ?? KOSTEN_FARBE[1]!}
        frist={frist}
        verblasst={kampfbild.verblasst}
      />
    </Buehne>
  );

  if (!eigenes) {
    // Zuschauer: kein Laden, keine Bank, kein Gold (sicht.ts). Es bleibt das
    // Brett — und das ist oeffentlich.
    return (
      <main className="tr-seite tr-tisch">
        <header className="tr-kopf">
          <button
            className="tr-zurueck tr-zurueck-tisch"
            type="button"
            onClick={onZurueck}
            aria-label="Zurück"
          >
            ←
          </button>
          <p className="tr-hinweis">Du schaust zu · Runde {sicht.runde}</p>
        </header>
        {/* Ein Zuschauer bekommt alle Sitze als `gegner` (sicht.ts) und hat
            selbst keinen — deshalb `eigenes={null}` und keine Gegnermarke. */}
        <Mitspielerleiste
          eigenes={null}
          gegner={sicht.gegner}
          gegnerJetzt={null}
          gezeigt={gegner?.sitz ?? null}
          sitze={sitze}
          onWahl={setGezeigterGegner}
        />
        {arena ||
          (gegner && (
            <div className="tr-bretter">
              <section className="tr-brettteil">
                <h2 className="tr-bretttitel">{spielername(zeile(gegner.sitz), gegner.sitz)}</h2>
                <Hexbrett
                  reihen={sicht.brettReihen}
                  spalten={sicht.brettSpalten}
                  felder={gegner.brett}
                  katalog={katalog}
                  maxStufe={sicht.maxStufe}
                />
              </section>
            </div>
          ))}
      </main>
    );
  }

  /**
   * Warum gerade ein Endbild faellig ist — oder null.
   *
   * `ausRunde` und nicht `leben <= 0`: Zwischen dem Kampf und dem
   * Rundenwechsel faellt beides auseinander (siehe `eigenesLebt` in
   * sicht.ts). Das Ende der Partie sticht das Ausscheiden, damit ein
   * weggeklicktes Ausscheiden das Schlussbild nicht verschluckt.
   */
  const endanlass: 'aus' | 'ende' | null = sicht.fertig
    ? 'ende'
    : eigenes.ausRunde !== null
      ? 'aus'
      : null;

  /** Die gewaehlte Einheit, fuer die Beschriftung des Auswahlbands. */
  const gewaehlterKaempfer = gewaehlt
    ? gewaehlt.bereich === 'bank'
      ? eigenes.bank[gewaehlt.platz]
      : eigenes.brett[gewaehlt.platz]
    : null;
  const gewaehlteEinheit = gewaehlterKaempfer ? katalog[gewaehlterKaempfer.id] : undefined;

  const gezogeneEinheit =
    zug?.zieht === true
      ? zug.von.bereich === 'bank'
        ? eigenes.bank[zug.von.platz]
        : eigenes.brett[zug.von.platz]
      : null;

  return (
    <main className="tr-seite tr-tisch">
      {/* ---- Kopfzeile: Leben, Gold, Runde, Level ---------------------- */}
      <header className="tr-kopf">
        <button
          className="tr-zurueck tr-zurueck-tisch"
          type="button"
          onClick={onZurueck}
          aria-label="Zurück"
        >
          ←
        </button>
        <div className="tr-werte">
          <span className="tr-wert tr-wert-leben">
            <LebenZeichen />
            <strong>{eigenes.leben}</strong>
            <em>Leben</em>
          </span>
          <span className="tr-wert tr-wert-gold">
            <GoldZeichen />
            <strong>{eigenes.gold}</strong>
            {/* Was die naechste Runde einbringt, steht klein daneben: Zins und
                Serienbonus sind sonst unsichtbar und wirken wie Zufall. */}
            <em>+{eigenes.einkommen}</em>
          </span>
          <span className="tr-wert">
            <strong>{sicht.runde}</strong>
            <em>Runde</em>
          </span>
          <span className="tr-wert tr-wert-level">
            <strong>{eigenes.level}</strong>
            <em>
              {eigenes.belegt}/{eigenes.feldplaetze} Feld
            </em>
          </span>
        </div>
      </header>

      {/* ---- Mitspieler: wer lebt, wie viel Leben, gegen wen ich spiele -- */}
      <Mitspielerleiste
        eigenes={eigenes}
        gegner={sicht.gegner}
        gegnerJetzt={gegnerJetzt}
        gezeigt={gegner?.sitz ?? null}
        sitze={sitze}
        onWahl={setGezeigterGegner}
      />

      {/* ---- Die Marken auf dem eigenen Brett ---------------------------- */}
      {/* Sie steht ueber dem Brett und damit auch waehrend des Kampfes da:
          Wer gerade zusieht, plant schon die naechste Runde — und nach dem
          Kampf ist sie ohnehin die erste Frage. Am Desktop haengt sie
          seitlich, das entscheidet allein Synergien.module.css. */}
      <Synergieleiste staende={eigeneSynergien} tabelle={synergieTabelle} />

      {/* Waehrend des Kampfes steht hier die Arena statt der beiden Bretter —
          gleiche Breite, gleiche Stelle, damit nichts springt. */}
      {arena || (
        <div className="tr-bretter">
          {/* Das gegnerische Brett liegt oben und GESPIEGELT — so, wie die
              Heere spaeter aufeinandertreffen. Es ist oeffentlich (sicht.ts),
              also gibt es hier nichts auszublenden. Zusammen mit der eigenen
              Haelfte sind das die vier Reihen aus dem Konzept. */}
          {gegner && (
            <section className="tr-brettteil tr-brettteil-fremd">
              <h2 className="tr-bretttitel">
                {spielername(zeile(gegner.sitz), gegner.sitz)}
                {gegner.ausRunde !== null ? ' · ausgeschieden' : ''}
              </h2>
              <Hexbrett
                reihen={sicht.brettReihen}
                spalten={sicht.brettSpalten}
                felder={gegner.brett}
                katalog={katalog}
                gespiegelt
                maxStufe={sicht.maxStufe}
              />
            </section>
          )}
  
          <section className="tr-brettteil">
            {eigenes.belegt === 0 && (
              /* Eine leere Flaeche sagt nicht, dass sie zu fuellen ist. Der Satz
                 liegt UEBER dem Brett und nimmt keine Zeiger an (CSS): Sonst
                 verschluckt ausgerechnet der Hinweis den ersten Zug, zu dem er
                 auffordert. `belegt` kommt aus der Sicht — der Client zaehlt
                 das Brett nicht selbst ab. */
              <p className="tr-leer-satz tr-leer-brett">
                Dein Feld ist leer — zieh einen Recken von der Bank auf eine Wabe
                oder tipp erst ihn, dann die Wabe an.
              </p>
            )}
            <Hexbrett
              reihen={sicht.brettReihen}
              spalten={sicht.brettSpalten}
              felder={eigenes.brett}
              katalog={katalog}
              maxStufe={sicht.maxStufe}
              eigen
              gewaehlt={gewaehlt}
              /* Wohin die gewaehlte Einheit darf — auf dem Brett und nicht nur
                 auf der Bank. Ohne diese Zeile leuchtet beim Antipp-Weg
                 ausgerechnet die Flaeche nicht, auf die man will; und steht das
                 Feld voll, leuchtet nichts, was die Absage von selbst
                 erklaert. */
              istZiel={gewaehlt ? (ort) => zielbar(gewaehlt, ort) : undefined}
              onWaehlen={tippeOrt}
              ziehtVon={zug?.zieht ? zug.von : null}
              fehlendeKopien={fehlen}
              frischVerschmolzen={verschmolzen}
              aktiv={darfHandeln}
              onZeigerStart={beiZeigerStart}
              onZeigerBewegung={beiZeigerBewegung}
              onZeigerEnde={beiZeigerEnde}
              onZeigerAbbruch={beiZeigerAbbruch}
              onLeeresZiel={tippeOrt}
            />
          </section>
        </div>
      )}

      {/* ---- Reservebank ------------------------------------------------ */}
      {/* Die Spaltenzahl kommt aus der Sicht und nicht aus dem Stylesheet:
          `bankPlaetze` steht im Regelsatz und ist damit je Tisch verstellbar. */}
      <div
        className="tr-bank"
        role="group"
        aria-label="Reservebank"
        style={{ gridTemplateColumns: `repeat(${sicht.bankPlaetze}, 1fr)` }}
      >
        {Array.from({ length: sicht.bankPlaetze }, (_, platz) => {
          const ort: Ort = { bereich: 'bank', platz };
          const k = eigenes.bank[platz] ?? null;
          return (
            <div
              key={platz}
              className="tr-bankplatz"
              data-ziel={ortSchluessel(ort)}
              data-leer={k ? undefined : ''}
              data-gewaehlt={
                gewaehlt?.bereich === 'bank' && gewaehlt.platz === platz ? '' : undefined
              }
              data-zielbar={gewaehlt && zielbar(gewaehlt, ort) ? '' : undefined}
            >
              {k ? (
                <Einheitenmarke
                  kaempfer={k}
                  katalog={katalog}
                  maxStufe={sicht.maxStufe}
                  fehlt={fehlen(k.id, k.stufe)}
                  frisch={verschmolzen?.id === k.id && verschmolzen.stufe === k.stufe}
                  aktiv={darfHandeln}
                  versteckt={zug?.zieht === true && zug.von.bereich === 'bank' && zug.von.platz === platz}
                  onZeigerStart={(e) => beiZeigerStart(ort, e)}
                  onZeigerBewegung={beiZeigerBewegung}
                  onZeigerEnde={(e) => beiZeigerEnde(ort, e)}
                  onZeigerAbbruch={beiZeigerAbbruch}
                  onWaehlen={() => tippeOrt(ort)}
                />
              ) : (
                /* Dieselbe echte Schaltflaeche wie das leere Brettfeld, und
                   aus demselben Grund: Ein `onClick` am Kasten hat weder
                   Namen noch Tastaturweg — der Rueckweg auf die Bank waere
                   mit einem Vorlesegeraet gar nicht vorhanden. */
                <button
                  type="button"
                  className="tr-bankplatz-ziel"
                  disabled={!darfHandeln}
                  aria-label={`Bankplatz ${platz + 1}`}
                  onClick={() => tippeOrt(ort)}
                />
              )}
            </div>
          );
        })}
      </div>
      {eigenes.bank.every((k) => k === null) && (
        <p className="tr-leer-satz">
          Deine Bank ist leer — kauf dir unten im Laden einen Recken.
        </p>
      )}

      {/* ---- Was mit der Auswahl geschehen kann ------------------------- */}
      {gewaehlt && darfHandeln && (
        <div className="tr-auswahlband">
          <span>{gewaehlteEinheit?.name ?? 'Einheit'} gewählt — Ziel antippen</span>
          <button
            type="button"
            className="tr-verkaufen"
            onClick={() => schicke({ typ: 'verkaufen', ort: gewaehlt })}
          >
            Verkaufen
          </button>
          <button type="button" className="tr-abwaehlen" onClick={() => setGewaehlt(null)}>
            Abbrechen
          </button>
        </div>
      )}

      {/* ---- Laden ------------------------------------------------------ */}
      <div className="tr-fuss">
        {sicht.fertig ? (
          <Abschluss sicht={sicht} onZurueck={onZurueck} />
        ) : sicht.phase === 'kampf' ? (
          arena ? (
            /* Der Kampf laeuft oben in der Arena. Hier nur der Satz, der
               erklaert, warum der Laden zu ist — und dass er von selbst
               wieder aufgeht, denn die Dauer bestimmt der Server. */
            <p className="tr-hinweis">
              Der Kampf läuft von selbst — danach geht der Laden wieder auf.
            </p>
          ) : (
            <Kampfband />
          )
        ) : eigenes.ausRunde !== null ? (
          <p className="tr-hinweis">
            In Runde {eigenes.ausRunde} ausgeschieden. Du kannst weiter zusehen.
          </p>
        ) : (
          <>
            <div
              className="tr-laden"
              role="group"
              aria-label="Laden"
              style={{ gridTemplateColumns: `repeat(${sicht.ladenPlaetze}, 1fr)` }}
            >
              {Array.from({ length: sicht.ladenPlaetze }, (_, platz) => {
                const id = eigenes.laden[platz];
                const angeboten = id ? katalog[id] : undefined;
                const darfKaufen = kaufbar.has(platz) && darfHandeln;
                return (
                  <Ladenkarte
                    key={platz}
                    einheit={angeboten}
                    kaufbar={darfKaufen}
                    /* "Der Kauf verschmilzt" heisst: Mir fehlt genau noch
                       diese eine Kopie. Die Zahl kommt aus der Sicht, nicht
                       aus einer 3 im Client. */
                    verschmilzt={id ? fehlen(id) === 1 : false}
                    fehlt={id ? fehlen(id) : 0}
                    verschmelzZahl={sicht.verschmelzZahl}
                    /* Die Marken der Einheit und die Frage, ob EINE davon mit
                       diesem Kauf voll wuerde. Beides aus der Sicht: die
                       Marken aus dem Katalog, die Schwelle aus `synergien`. */
                    marken={angeboten?.marken ?? []}
                    trifftSchwelle={trifftSchwelle}
                    /* Nur beschriften, was gerade wirklich am Spieler liegt:
                       Wer schon bereit ist oder ausgeschieden, bekommt keinen
                       Grund an die Karte geschrieben — dann steht er
                       woanders. */
                    grund={darfHandeln && !darfKaufen ? hindernis(angeboten) : null}
                    onKauf={() => schicke({ typ: 'kaufen', platz })}
                  />
                );
              })}
            </div>
            {eigenes.laden.every((id) => id === null) && (
              <p className="tr-leer-satz">
                Der Laden ist leergekauft — würfle neu für frische Recken oder
                mach dich bereit.
              </p>
            )}
            <div className="tr-ladenknoepfe">
              <button
                type="button"
                className="tr-ladenknopf"
                disabled={!darfWuerfeln || !darfHandeln}
                onClick={() => schicke({ typ: 'neuwuerfeln' })}
              >
                Neu würfeln
                {/* Der Preis wird rot, wenn das Gold nicht reicht — sonst
                    sieht ein gesperrter Knopf aus wie ein kaputter. Beide
                    Bedingungen muessen zutreffen: `legalActions` hat den Zug
                    abgelehnt UND die Zahlen der Sicht erklaeren es auch.
                    Erklaeren sie es nicht, bleibt der Preis ruhig statt zu
                    raten. */}
                <em
                  data-teuer={
                    darfHandeln && !darfWuerfeln && eigenes.gold < eigenes.neuwuerfelnKosten
                      ? ''
                      : undefined
                  }
                >
                  <GoldZeichen />
                  {eigenes.neuwuerfelnKosten}
                </em>
              </button>
              <button
                type="button"
                className="tr-ladenknopf"
                disabled={!darfLevel || !darfHandeln}
                onClick={() => schicke({ typ: 'levelAuf' })}
              >
                {eigenes.aufstiegKosten === null ? 'Höchster Rang' : 'Rang steigern'}
                {eigenes.aufstiegKosten !== null && (
                  <em
                    data-teuer={
                      darfHandeln && !darfLevel && eigenes.gold < eigenes.aufstiegKosten
                        ? ''
                        : undefined
                    }
                  >
                    <GoldZeichen />
                    {eigenes.aufstiegKosten}
                  </em>
                )}
              </button>
              <button
                type="button"
                className="tr-bereitknopf"
                data-bereit={eigenes.bereit ? '' : undefined}
                disabled={eigenes.bereit || !darfHandeln}
                onClick={() => schicke({ typ: 'bereit' })}
              >
                {eigenes.bereit ? 'Wartet…' : 'Bereit'}
              </button>
            </div>
            <p className="tr-hinweis">
              {eigenes.bereit
                ? 'Auf die anderen warten'
                : gewaehlt
                  ? 'Ziel antippen — oder abbrechen'
                  : 'Karte antippen zum Kaufen · Einheit ziehen oder antippen zum Setzen'}
            </p>
          </>
        )}
        <button className="tr-regelzeile" type="button" onClick={() => setRegelnOffen(true)}>
          So spielt man Tafelrunde
        </button>
      </div>

      {/* ---- Die Meldung ueber ein Verschmelzen -------------------------- */}
      {verschmolzen && (
        <div className="tr-verschmolzen-band" role="status">
          <span className="tr-sterne" aria-hidden="true">
            {'★'.repeat(verschmolzen.stufe)}
          </span>
          {sicht.verschmelzZahl}× {katalog[verschmolzen.id]?.name ?? 'Einheit'} verschmolzen
        </div>
      )}

      {/* ---- Was am Finger haengt --------------------------------------- */}
      {zug?.zieht && gezogeneEinheit && (
        <div
          className="tr-schatten"
          style={{ left: zug.x, top: zug.y }}
          aria-hidden="true"
        >
          <Einheitenmarke
            kaempfer={gezogeneEinheit}
            katalog={katalog}
            maxStufe={sicht.maxStufe}
            fehlt={0}
            aktiv={false}
          />
        </div>
      )}

      {/* ---- Endbild ---------------------------------------------------- */}
      {/* Es liegt UEBER dem Tisch und nimmt ihn nicht weg: Wer ausscheidet,
          klickt es weg und sieht weiter zu. Beim Ende der Partie gibt es
          nichts mehr zuzusehen — dann fehlt der Knopf. */}
      {endanlass && endanlass !== endbildWeg && (
        <Endbild
          sitz={eigenes.sitz}
          brett={eigenes.brett}
          katalog={katalog}
          eigenes={eigenes}
          gegner={sicht.gegner}
          runde={sicht.runde}
          fertig={sicht.fertig}
          sitze={sitze}
          onZurueck={onZurueck}
          onZusehen={endanlass === 'aus' ? () => setEndbildWeg('aus') : undefined}
        />
      )}

      {regelnOffen && <Regelblatt onClose={() => setRegelnOffen(false)} />}
    </main>
  );
}

/**
 * Wie ein Sitz heisst.
 *
 * An EINER Stelle, weil der Name an drei Orten steht (Leiste, Bretttitel,
 * Zuschauersicht) und drei Fassungen davon sich sonst im Rueckfall
 * unterscheiden. Kein `<img>` auf ein Profilbild: In dieser Leiste ist fuer
 * eins kein Platz, und ein fehlendes waere ein weisser Kasten.
 */
function spielername(zeile: SitzZeile | undefined, sitz: number): string {
  return zeile?.displayName ?? (zeile?.isBot ? 'KI' : `Sitz ${sitz + 1}`);
}

// ---------------------------------------------------------------------------
// Die Kampfphase
// ---------------------------------------------------------------------------

/** Wie lange die Arena nach dem Phasenwechsel noch verblasst. */
const AUSKLANG_MS = 400;

/**
 * Welche Kaempfe die Arena zeigt — und ob sie gerade verblasst.
 *
 * Waehrend der Kampfphase sind es die Kaempfe der Sicht. Wechselt der Server
 * die Phase, verschwindet `kaempfe` aus der Sicht im selben Rundruf; die
 * Arena soll aber nicht schlagartig weg sein, sondern kurz verblassen. Dafuer
 * haelt dieser Hook die zuletzt gezeigten Kaempfe noch `AUSKLANG_MS` fest.
 *
 * Nur der Server beendet die Anzeige: Der Client blendet nie frueher aus, auch
 * nicht, wenn sein eigener Kampf laengst vorbei ist — die Schaupause richtet
 * sich nach dem laengsten Kampf der Runde (adapter.ts), und wer frueher zum
 * Laden zurueckkehrte, koennte dort ohnehin noch nichts kaufen.
 *
 * An die PHASE gehaengt und nicht an das Sichtobjekt: Sonst liefe der Effekt
 * bei jedem Rundruf neu und raeumte seinen Timer ab (CLAUDE.md).
 */
function useKampfbild(
  sicht: TafelrundeSicht,
): { kaempfe: Kampfpaarung[]; verblasst: boolean } | null {
  const kaempfe = sicht.phase === 'kampf' ? (sicht.kaempfe ?? []) : [];
  const laeuft = kaempfe.length > 0;
  const zuletzt = useRef<Kampfpaarung[]>([]);
  const [ausklang, setAusklang] = useState<Kampfpaarung[] | null>(null);
  if (laeuft) zuletzt.current = kaempfe;

  useEffect(() => {
    if (sicht.phase === 'kampf') {
      setAusklang(null);
      return;
    }
    const alte = zuletzt.current;
    if (alte.length === 0) return;
    zuletzt.current = [];
    setAusklang(alte);
    const uhr = window.setTimeout(() => setAusklang(null), AUSKLANG_MS);
    return () => window.clearTimeout(uhr);
  }, [sicht.phase]);

  if (laeuft) return { kaempfe, verblasst: false };
  if (ausklang) return { kaempfe: ausklang, verblasst: true };
  return null;
}

/**
 * Der Schluessel eines Kampfes fuer React: die Saat des abgespielten
 * Kampfes. Sie ist je Runde und Paarung eindeutig (kampfSaat in partie.ts),
 * und derselbe Kampf ueber mehrere Rundrufe behaelt so seine laufende Uhr.
 */
function kampfSchluessel(kaempfe: readonly Kampfpaarung[], ich: number | null): string {
  const kampf = abzuspielen(kaempfe, ich);
  return kampf ? `${kampf.a}:${kampf.b}:${kampf.bericht.saat}` : 'keiner';
}

/*
 * Die Leiste der Mitspieler stand bis zum 05.09.2026 HIER als `Gegnerleiste`
 * — ein Streifen mit Name und Leben der Gegner, ohne den eigenen Sitz und
 * ohne die Paarung der Runde. Sie ist nach
 * minispiele/tafelrunde/Mitspieler.tsx gezogen und dort geprueft; die
 * Klassen `.tr-gegnerleiste` und `.tr-gegner` in styles.css sind damit
 * verwaist (styles.css gehoert nicht zu dieser Aufgabe).
 */

// ---------------------------------------------------------------------------
// Das Hexbrett
// ---------------------------------------------------------------------------

/**
 * Ein versetztes Sechseckraster ("odd-r", siehe brett.ts).
 *
 * Die Lage jedes Feldes wird in PROZENT gerechnet und nicht in Pixeln: Das
 * Brett skaliert mit der Bildschirmbreite, und eine in Pixeln gesetzte Wabe
 * saesse auf einem schmalen Handy neben ihrem Platz — dieselbe Ueberlegung wie
 * bei den Mauern in Filler.tsx.
 *
 * Die Zahlen stehen hier und nicht im Stylesheet, weil Reihen und Spalten aus
 * der Sicht kommen: Ein festes Raster in CSS waere beim ersten groesseren
 * Brett falsch, und das kommt mit der Kampfarena (Phase 2).
 */
function Hexbrett({
  reihen,
  spalten,
  felder,
  katalog,
  maxStufe,
  gespiegelt,
  eigen,
  gewaehlt,
  istZiel,
  onWaehlen,
  ziehtVon,
  fehlendeKopien,
  frischVerschmolzen,
  aktiv,
  onZeigerStart,
  onZeigerBewegung,
  onZeigerEnde,
  onZeigerAbbruch,
  onLeeresZiel,
}: {
  reihen: number;
  spalten: number;
  felder: (Kaempfer | null)[];
  katalog: Record<string, Einheit>;
  maxStufe: number;
  /** Das gegnerische Brett steht auf dem Kopf — so treffen die Heere sich. */
  gespiegelt?: boolean;
  eigen?: boolean;
  gewaehlt?: Ort | null;
  /** Darf die gerade gewaehlte Einheit hierhin? Ohne Auswahl nicht gesetzt. */
  istZiel?: (ort: Ort) => boolean;
  /** Auswahl ueber Tastatur oder Vorlesegeraet, siehe Einheitenmarke. */
  onWaehlen?: (ort: Ort) => void;
  ziehtVon?: Ort | null;
  fehlendeKopien?: (id: string, stufe?: number) => number;
  frischVerschmolzen?: { id: string; stufe: number } | null;
  aktiv?: boolean;
  onZeigerStart?: (ort: Ort, e: React.PointerEvent) => void;
  onZeigerBewegung?: (e: React.PointerEvent) => void;
  onZeigerEnde?: (ort: Ort, e: React.PointerEvent) => void;
  onZeigerAbbruch?: () => void;
  /** Ein leeres Feld ist angetippt worden (nicht gezogen). */
  onLeeresZiel?: (ort: Ort) => void;
}): React.JSX.Element {
  const mass = rastermass(reihen, spalten);

  return (
    /* Der Holz-Untergrund kommt als Pfad aus figuren.ts und nicht als zweite
       Abschrift im Stylesheet: Wer die Textur tauscht, aendert eine Zeile und
       nicht zwei. Wie er kachelt und wie dunkel der Schleier darueber liegt,
       steht in styles.css. */
    <div
      className="tr-brett"
      style={{
        aspectRatio: `${mass.seitenverhaeltnis}`,
        backgroundImage: `url(${UNTERGRUND})`,
      }}
    >
      {Array.from({ length: reihen * spalten }, (_, i) => {
        const platz = platzVon(i, reihen, spalten, gespiegelt === true);
        const reihe = Math.floor(i / spalten);
        const spalte = i % spalten;
        const lage = wabenLage(mass, reihe, spalte);
        const k = felder[platz] ?? null;
        const ort: Ort = { bereich: 'brett', platz };
        const stil: React.CSSProperties = {
          left: `${lage.links}%`,
          top: `${lage.oben}%`,
          width: `${mass.wabenBreite}%`,
          height: `${mass.wabenHoehe}%`,
        };
        return (
          <div
            key={platz}
            className="tr-wabe"
            style={stil}
            data-ziel={eigen ? ortSchluessel(ort) : undefined}
            data-leer={k ? undefined : ''}
            data-gewaehlt={
              gewaehlt?.bereich === 'brett' && gewaehlt.platz === platz ? '' : undefined
            }
            data-zielbar={istZiel?.(ort) ? '' : undefined}
          >
            {k ? (
              <Einheitenmarke
                kaempfer={k}
                katalog={katalog}
                maxStufe={maxStufe}
                fehlt={fehlendeKopien?.(k.id, k.stufe) ?? 0}
                frisch={
                  frischVerschmolzen?.id === k.id && frischVerschmolzen.stufe === k.stufe
                }
                aktiv={eigen === true && aktiv === true}
                versteckt={ziehtVon?.bereich === 'brett' && ziehtVon.platz === platz}
                onZeigerStart={eigen && onZeigerStart ? (e) => onZeigerStart(ort, e) : undefined}
                onZeigerBewegung={eigen ? onZeigerBewegung : undefined}
                onZeigerEnde={eigen && onZeigerEnde ? (e) => onZeigerEnde(ort, e) : undefined}
                onZeigerAbbruch={eigen ? onZeigerAbbruch : undefined}
                onWaehlen={eigen && onWaehlen ? () => onWaehlen(ort) : undefined}
              />
            ) : (
              eigen && (
                /* Ein leeres Feld ist ein Ziel und deshalb eine Schaltflaeche:
                   Wer eine Einheit gewaehlt hat, tippt hier hin. Ohne Knopf
                   waere der Antipp-Weg auf halbem Weg zu Ende. */
                <button
                  type="button"
                  className="tr-wabe-ziel"
                  disabled={!aktiv}
                  /* Der Name sagt beim Vorlesen mit, ob dieses Feld gerade
                     ein Ziel ist — sichtbar leuchtet es, hoerbar bisher
                     nicht. */
                  aria-label={`Feld ${platz + 1}${istZiel?.(ort) ? ' · Ziel' : ''}`}
                  /* Klick und nicht Zeiger-Loslassen: Ein abgelegtes Ziehen
                     endet dank Zeigererfassung IMMER an der gezogenen
                     Einheit, nie hier — und erzeugt deshalb auch keinen
                     Klick. Der Klick gehoert also allein dem Antipp-Weg. */
                  onClick={() => onLeeresZiel?.(ort)}
                />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eine Einheit
// ---------------------------------------------------------------------------

function Einheitenmarke({
  kaempfer,
  katalog,
  maxStufe,
  fehlt,
  frisch,
  aktiv,
  versteckt,
  onZeigerStart,
  onZeigerBewegung,
  onZeigerEnde,
  onZeigerAbbruch,
  onWaehlen,
}: {
  kaempfer: Kaempfer;
  katalog: Record<string, Einheit>;
  maxStufe: number;
  /** Wie viele Kopien noch fehlen, bis diese Stufe verschmilzt. */
  fehlt: number;
  frisch?: boolean;
  aktiv: boolean;
  versteckt?: boolean;
  onZeigerStart?: (e: React.PointerEvent) => void;
  onZeigerBewegung?: (e: React.PointerEvent) => void;
  onZeigerEnde?: (e: React.PointerEvent) => void;
  onZeigerAbbruch?: () => void;
  /**
   * Auswaehlen ohne Zeiger — Tastatur oder Vorlesegeraet.
   *
   * Der Antipp-Weg lief bisher allein ueber `pointerup`, und genau das
   * erreicht ein Vorlesegeraet nicht: VoiceOver und TalkBack loesen beim
   * Doppeltippen einen KLICK aus, keine Zeigerfolge. Ohne diesen Weg war die
   * Zusage aus dem Kopf dieser Datei — Antippen sei der Weg, der mit einem
   * Vorlesegeraet funktioniert — schlicht nicht eingeloest.
   */
  onWaehlen?: () => void;
}): React.JSX.Element {
  const einheit = katalog[kaempfer.id];
  const farbe = KOSTEN_FARBE[einheit?.kosten ?? 1] ?? KOSTEN_FARBE[1];
  const greifbar = aktiv && onWaehlen !== undefined;
  return (
    <div
      className="tr-einheit"
      data-frisch={frisch ? '' : undefined}
      data-still={versteckt ? '' : undefined}
      data-fassbar={aktiv ? '' : undefined}
      style={{ '--tr-kosten': farbe } as React.CSSProperties}
      role={greifbar ? 'button' : undefined}
      tabIndex={greifbar ? 0 : undefined}
      aria-label={
        einheit
          ? `${einheit.name}, ${ROLLE_NAME[einheit.rolle]}, Stufe ${kaempfer.stufe}`
          : kaempfer.id
      }
      onPointerDown={aktiv ? onZeigerStart : undefined}
      onPointerMove={aktiv ? onZeigerBewegung : undefined}
      onPointerUp={aktiv ? onZeigerEnde : undefined}
      onPointerCancel={aktiv ? onZeigerAbbruch : undefined}
      /*
       * `detail === 0` trennt den erzeugten Klick vom echten: Tastatur und
       * Vorlesegeraet melden 0, Maus und Finger melden mindestens 1. Ohne
       * diese Pruefung liefe jeder Tipp doppelt — einmal ueber `pointerup`
       * und gleich darauf ueber den Klick, den der Browser hinterherschickt.
       * Das Ergebnis waere waehlen und im selben Moment wieder abwaehlen.
       */
      onClick={
        greifbar
          ? (e) => {
              if (e.detail === 0) onWaehlen?.();
            }
          : undefined
      }
      onKeyDown={
        greifbar
          ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              // Sonst rollt die Leertaste den Bildschirm unter dem Brett weg.
              e.preventDefault();
              onWaehlen?.();
            }
          : undefined
      }
      title={einheit ? `${einheit.name} · ${ROLLE_NAME[einheit.rolle]}` : kaempfer.id}
    >
      {einheit ? (
        <Figurbild
          einheit={einheit}
          klasse="tr-figur"
          ersatz={<RollenZeichen rolle={einheit.rolle} />}
        />
      ) : (
        /* Der Katalog kommt erst mit der ersten Sicht. Ein Fragezeichen ist
           hier ehrlicher als ein Bild, dessen Namen wir noch nicht kennen. */
        <span>?</span>
      )}
      {/* Die Marken als Zeichen in der Ecke — dieselben Zeichen und Farben wie
          in der Leiste, damit man eine Aufstellung im Vorbeisehen zaehlen
          kann. Kein Text: Auf einer Wabe ist dafuer kein Platz, und vorgelesen
          wird ohnehin das `aria-label` oben. */}
      {einheit && <Markenzeichen marken={einheit.marken} ort="einheit" />}
      <span className="tr-einheit-name">{einheit?.name ?? kaempfer.id}</span>
      {/* Der Name der Marke nennt die Stufe schon; hier waere sie doppelt. */}
      <span className="tr-sterne" aria-hidden="true">
        {'★'.repeat(kaempfer.stufe)}
      </span>
      {/*
        * "Noch eine" statt einer stillen Ueberraschung: Wer zwei von drei
        * haelt, soll es sehen, bevor er den Laden neu wuerfelt. Nur unterhalb
        * der Hoechststufe — dort verschmilzt nichts mehr.
        */}
      {fehlt === 1 && kaempfer.stufe < maxStufe && (
        <span className="tr-fehlt" aria-hidden="true">
          noch 1
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Der Laden
// ---------------------------------------------------------------------------

function Ladenkarte({
  einheit,
  kaufbar,
  verschmilzt,
  fehlt,
  verschmelzZahl,
  marken,
  trifftSchwelle,
  grund,
  onKauf,
}: {
  einheit: Einheit | undefined;
  kaufbar: boolean;
  verschmilzt: boolean;
  fehlt: number;
  /** Wie viele Kopien verschmelzen — aus der Sicht, nie als 3 im Client. */
  verschmelzZahl: number;
  /** Die Klassen-Marken dieser Einheit (Katalog). Leer, solange er fehlt. */
  marken: string[];
  /** Wuerde ein Traeger dieser Marke eine Schwelle erreichen? Siehe Synergien.tsx. */
  trifftSchwelle: (marke: string) => boolean;
  /** Warum nicht kaufbar, falls die Zahlen der Sicht es erklaeren. */
  grund: Kaufhindernis;
  onKauf: () => void;
}): React.JSX.Element {
  if (!einheit) {
    // Gekauft oder Vorrat erschoepft. Ein leerer Rahmen statt einer Luecke:
    // Sonst rutscht der Laden bei jedem Kauf zusammen, und der Daumen trifft
    // die Karte daneben.
    return <div className="tr-karte tr-karte-leer" aria-hidden="true" />;
  }
  const farbe = KOSTEN_FARBE[einheit.kosten] ?? KOSTEN_FARBE[1];
  /* Der Rahmen sagt "hier wird eine Schwelle voll", das leuchtende Zeichen
     darunter sagt welche. Genug fuer den Rahmen ist EINE Marke — eine Einheit
     traegt bis zu zwei. */
  const trifft = marken.some(trifftSchwelle);
  return (
    <button
      type="button"
      className={trifft ? `tr-karte ${KARTE_TRIFFT}` : 'tr-karte'}
      disabled={!kaufbar}
      data-verschmilzt={verschmilzt ? '' : undefined}
      style={{ '--tr-kosten': farbe } as React.CSSProperties}
      onClick={onKauf}
    >
      <span className="tr-karte-kopf">
        {/* Die Figur steht an der Stelle, an der bisher das Rollenzeichen
            stand — die Rolle selbst steht als Wort darunter und geht damit
            nicht verloren. */}
        <Figurbild
          einheit={einheit}
          klasse="tr-figur"
          ersatz={<RollenZeichen rolle={einheit.rolle} />}
        />
        {/* Der Preis wird rot, wenn das Gold nicht reicht: Eine Karte, die
            man sich nicht leisten kann, soll anders aussehen als eine, die
            man gerade nicht kaufen kann, weil man schon bereit ist. */}
        <span className="tr-karte-preis" data-teuer={grund === 'gold' ? '' : undefined}>
          <GoldZeichen />
          {einheit.kosten}
        </span>
      </span>
      <strong className="tr-karte-name">{einheit.name}</strong>
      <span className="tr-karte-rolle">{ROLLE_NAME[einheit.rolle]}</span>
      {/* Beschriftet, weil die Karte eine Schaltflaeche ist und ihren Namen
          aus dem Inhalt bezieht: "Dorfwache, Wache, Krieger" ist genau die
          Auskunft, die ein Vorlesegeraet fuer den Kauf braucht. */}
      <Markenzeichen marken={einheit.marken} trifft={trifftSchwelle} beschriftet ort="laden" />
      {/* Der Hinweis, der aus einem Kauf eine Entscheidung macht — und, wenn
          nichts zu entscheiden ist, der Grund dafuer. Der Grund steht vorn:
          Wer nicht kaufen kann, will zuerst wissen warum, und erst danach,
          dass es verschmolzen waere.

          Der Zaehler nennt `verschmelzZahl` und nicht "von 3". Hier stand
          die 3 einmal ausgeschrieben — wer sie im Modul auf vier stellte,
          bekam eine Karte, die "1 von 3" behauptet und bei drei Kopien nicht
          verschmilzt. */}
      {grund !== null ? (
        <span className="tr-karte-marke tr-karte-marke-hindernis">
          {grund === 'gold' ? 'Zu wenig Gold' : 'Bank voll'}
        </span>
      ) : verschmilzt ? (
        <span className="tr-karte-marke">verschmilzt!</span>
      ) : fehlt < verschmelzZahl ? (
        <span className="tr-karte-marke tr-karte-marke-leise">
          {verschmelzZahl - fehlt} von {verschmelzZahl}
        </span>
      ) : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Kleinteile
// ---------------------------------------------------------------------------

/**
 * Die Kampfphase OHNE eigenen Kampf.
 *
 * Wer einen Kampf hat, sieht ihn oben in der Arena (KampfAnzeige.tsx). Diese
 * Zeile bleibt fuer die uebrigen: Ausgeschiedene bekommen keinen Kampf mehr
 * (`sicht.kaempfe` ist bei ihnen leer), und eine Sicht aus der Zeit vor der
 * Kampfsimulation kennt das Feld gar nicht. Fuer sie steht wenigstens eine
 * laufende Zeile da, damit die Pause nicht wie ein haengender Tisch aussieht;
 * dieselbe Ueberlegung wie beim Warteband in Filler.
 *
 * Die Pause ist so lang wie der laengste Kampf der Runde (`interludeMs` im
 * Adapter, bis zu 47 Sekunden). Wer hier etwas einbaut, das eine feste Dauer
 * annimmt, liegt daneben.
 */
function Kampfband(): React.JSX.Element {
  return (
    <p className="tr-hinweis tr-wartet" aria-live="polite">
      <span>Die Heere treten an</span>
      <span className="tr-lauf" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </p>
  );
}

function Abschluss({
  sicht,
  onZurueck,
}: {
  sicht: TafelrundeSicht;
  onZurueck: () => void;
}): React.JSX.Element {
  const ich = sicht.eigenes?.sitz ?? -1;
  const wort =
    sicht.sieger === null ? 'Unentschieden' : sicht.sieger === ich ? 'Gewonnen!' : 'Verloren';
  return (
    <div className="tr-abschluss">
      <h2 data-sieg={sicht.sieger === ich ? '' : undefined}>{wort}</h2>
      <p>
        {sicht.runde} Runden gespielt
        {sicht.eigenes?.ausRunde ? ` · ausgeschieden in Runde ${sicht.eigenes.ausRunde}` : ''}
      </p>
      <button className="tr-suchen" type="button" onClick={onZurueck}>
        Zurück
      </button>
    </div>
  );
}

/**
 * Das Regelblatt.
 *
 * Wortlaut nach dem Muster von Filler und Eiland. Der letzte Absatz nennt
 * ausdruecklich, was noch FEHLT — sonst haelt der erste Spieler die
 * uebersprungene Kampfphase fuer einen Fehler.
 */
function Regelblatt({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="tr-blatt" role="dialog" aria-label="So spielt man Tafelrunde">
      <button className="tr-blatt-zu" type="button" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
      <h2>So spielt man Tafelrunde</h2>
      <h3>Regeln</h3>
      <ol>
        <li>
          Jede Runde legt der Laden fünf Recken aus. Kaufen kostet Gold; wer
          nichts findet, würfelt neu.
        </li>
        <li>
          Gekaufte Recken landen auf der Reservebank. Aufs Feld kommen sie,
          indem du sie auf eine Wabe ziehst — oder antippst und dann die Wabe
          antippst.
        </li>
        <li>
          <strong>Drei gleiche Recken derselben Stufe verschmelzen von selbst</strong>{' '}
          zu einem stärkeren. Aus drei Einsternigen wird ein Zweisterniger, aus
          drei davon ein Dreisterniger.
        </li>
        <li>
          Wie viele Recken gleichzeitig auf dem Feld stehen dürfen, sagt dein
          Rang. Rang steigern kostet Gold und bringt einen Feldplatz — und
          bessere Karten im Laden.
        </li>
        <li>
          Gold gibt es jede Runde: ein Grundbetrag, Zins auf dein Erspartes und
          ein Bonus für Serien. Was die nächste Runde bringt, steht klein neben
          deinem Gold.
        </li>
        <li>
          Sind alle bereit, kämpft dein Feld gegen das eines Mitspielers — von
          selbst, du siehst nur zu. Der Verlierer verliert Leben: je mehr
          Gegner noch stehen, desto mehr.
        </li>
        <li>Wer keine Lebenspunkte mehr hat, scheidet aus. Der Letzte gewinnt.</li>
      </ol>
      <h3>Noch nicht dabei</h3>
      <p>
        Die Boni für gleiche Klassen fehlen noch; sie kommen als eigener Ausbau.
        Aufrüsten, verschmelzen, aufstellen und kämpfen ist vollständig da.
      </p>
      <h3>Ziel</h3>
      <p>Als Letzter am Tisch stehen bleiben.</p>
    </div>
  );
}
