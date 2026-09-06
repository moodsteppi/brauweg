import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, api, type Suchstand, type TableRow, type TischVorschau } from '../api';
import { t } from '../i18n';
import type { BotLevel } from '../protocol';
import { Bankreihe, Einheitenmarke, Hexbrett } from '../minispiele/tafelrunde/Brett';
import { Buehne } from '../minispiele/tafelrunde/Buehne';
import { Endbild } from '../minispiele/tafelrunde/Endbild';
import { type Kaufhindernis, Ladenkarte, kaufhindernis } from '../minispiele/tafelrunde/Ladenkarte';
import { Ladebildschirm } from '../minispiele/tafelrunde/Ladebildschirm';
import { Mitspielerleiste } from '../minispiele/tafelrunde/Mitspieler';
import { Phasenzeile } from '../minispiele/tafelrunde/Phasenzeile';
import {
  type Platz,
  gegnerDieseRunde,
  leistenplaetze,
} from '../minispiele/tafelrunde/platzierung';
import type { Einheit, TafelrundeSicht } from '../minispiele/tafelrunde/sicht';
import { TISCH_PARAMETER, beitrittsLink } from '../minispiele/tafelrunde/tischlink';
import { GoldZeichen, KOSTEN_FARBE, LebenZeichen, RollenZeichen } from '../minispiele/tafelrunde/Zeichen';
import {
  KampfAnzeige,
  type Kampfpaarung,
  type Paarungsergebnis,
  abzuspielen,
} from '../minispiele/tafelrunde/KampfAnzeige';
import {
  type Synergie,
  type Synergiestand,
  Fremdmarken,
  Markennamen,
  Synergieleiste,
  markennamen,
  schwellenPruefer,
} from '../minispiele/tafelrunde/Synergien';
import {
  type Ort,
  bestandVon,
  darfSchieben,
  fehlendeKopien,
  neuVerschmolzen,
  ortLesen,
  ortSchluessel,
  tippfolge,
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

/*
 * Sie steht seit dem 06.09.2026 in minispiele/tafelrunde/sicht.ts und nicht
 * mehr hier. Grund: Der Vertrag unter src/vertrag/ haelt diese Typen gegen
 * die echte Modulsicht, und ein Import aus DIESEM Bildschirm zoege React
 * samt aller Bauteile in einen Test, der nur Typen vergleichen will.
 */

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

/*
 * HIER STAND BIS ZUM 05.09.2026 DER REGELSATZ, wortgleich abgeschrieben von
 * DEFAULT_REGELN (packages/game-tafelrunde/src/regeln.ts): sieben Zahlen, die
 * `createTable` als `config` mitbekam. Der Server schreibt eine mitgeschickte
 * `config` als Regelsatz des Tisches fest — die Kopie UEBERSTIMMTE also das
 * Modul, ohne dass irgendwo ein Fehler auffiel. Zweimal an einem Tag waere
 * genau das durchgerutscht: bei der Umstellung auf 20 Startleben und noch
 * einmal bei der auf 14.
 *
 * Heute laesst dieser Bildschirm `config` weg. Der Server nimmt dann
 * `defaultConfig()` des Moduls (tables/service.ts) — dieselbe Quelle, aus der
 * auch die serverseitige Mitspielersuche ihren Tisch baut. Wer wieder etwas
 * mitschickt, holt die Doppelung zurueck.
 */

/**
 * Sitze am Bot-Tisch: vier.
 *
 * Nur fuer "Gegen Bots spielen". Die Mitspielersuche baut ihren Tisch
 * serverseitig und nimmt dort die volle Acht — dort wartet niemand auf
 * Menschen, die freien Plaetze fuellt der Server nach 30 Sekunden mit Bots.
 * Hier gegen die KI sind vier genug: Acht Bots rechnen laenger, ohne dass es
 * sich anders spielt.
 *
 * Exportiert wie SITZ_WAHL nur fuer den Vertrag: Eine Sitzzahl, die das Modul
 * nicht kennt, weist der Server ab (`seatCountUnsupported`), und der Knopf
 * fuehrt dann ins Leere.
 */
export const SITZE = 4;

/**
 * Takt, in dem der Stand der Suche abgefragt wird.
 *
 * Eine Sekunde, weil daneben ein Countdown laeuft: Bei einem traegeren Takt
 * springt die Zahl. Der Abruf ist zugleich das Lebenszeichen an den Server —
 * hoert er auf, faellt man von selbst aus der Schlange (siehe suche/schlange.ts).
 */
const SUCH_TAKT_MS = 1000;

/**
 * Sitzzahlen des geplanten Tisches.
 *
 * Zwei bis acht, aber nicht alles als Knopf: Sieben Knoepfe nebeneinander
 * liest niemand. Angeboten wird, was man sich verabredet.
 *
 * Das ist bewusst eine AUSWAHL und keine Kopie — anders als der Regelsatz,
 * der hier bis zum 05.09.2026 abgeschrieben stand. Der Server weist ab, was
 * das Modul nicht kennt (`seatCountUnsupported`), und dass jede Zahl von hier
 * in SEAT_COUNTS steht, haelt `src/vertrag/tafelrunde-tisch.test.ts` fest.
 * Exportiert allein dafuer.
 */
export const SITZ_WAHL = [2, 3, 4, 6, 8] as const;

/**
 * Die Bot-Stufen, wie sie hier heissen.
 *
 * Drei statt der vier der Plattform, weil das Modul nur drei Gangarten hat
 * (`gangartVon` in packages/game-tafelrunde/src/adapter.ts) — ein vierter
 * Knopf, der genauso spielt wie der dritte, waere eine Beschriftung ohne
 * Unterschied.
 */
const BOT_STUFEN: readonly { id: BotLevel; name: string }[] = [
  { id: 'anfaenger', name: 'Sanft' },
  { id: 'standard', name: 'Normal' },
  { id: 'experte', name: 'Hart' },
];

/**
 * Wie viele Runden ein Tisch gehen soll.
 *
 * Tafelrunde ist ein Turnier bis zum letzten Ueberlebenden, es gibt nichts zu
 * rotieren — `suggestedRounds` liefert genau diese Eins, und die Partie endet,
 * wenn sie endet (`rundenGrenze` im Regelsatz).
 */
const RUNDEN = 1;

/**
 * Ein Tisch aus der Zeit vor den Synergien schickt das Feld nicht mit. Die
 * leere Liste steht als KONSTANTE hier und nicht als `?? []` an der
 * Verwendung: Ein frisches Array bei jedem Rundruf waere eine neue
 * Abhaengigkeit und wuerde den Pruefer darunter jedes Mal neu bauen.
 */
const OHNE_SYNERGIEN: Synergiestand[] = [];

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
  /**
   * Welche Menueseite offen ist. Der geplante Tisch braucht zwei eigene
   * Bildschirme; ein Langformular unter der Schnellsuche waere im Weg fuer
   * alle, die nur schnell spielen wollen.
   *
   * Ein Link mit `?tisch=CODE` fuehrt gleich in die Beitreten-Ansicht.
   */
  const [menue, setMenue] = useState<'start' | 'erstellen' | 'beitreten'>(() =>
    new URLSearchParams(window.location.search).get(TISCH_PARAMETER) ? 'beitreten' : 'start',
  );
  /**
   * Gesetzt, solange man in einem VERABREDETEN Tisch sitzt und die Partie noch
   * nicht laeuft — dann steht der Wartesaal statt des Ladehinweises.
   *
   * Der Unterschied ist wichtig: Der Tisch der Schnellsuche und der Bot-Tisch
   * starten von selbst, dort gibt es nichts zu bedienen. Beim verabredeten
   * Tisch entscheidet der Gastgeber, wann es losgeht.
   */
  const [wartesaal, setWartesaal] = useState<{
    code: string | null;
    gastgeber: boolean;
    botsFuellen: boolean;
  } | null>(null);
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

  // -------------------------------------------------------------------------
  // Der verabredete Tisch
  // -------------------------------------------------------------------------

  /** Einstellungen des Erstellen-Formulars. */
  const [sitze, setSitze] = useState(4);
  const [oeffentlich, setOeffentlich] = useState(false);
  const [botsFuellen, setBotsFuellen] = useState(true);
  const [botStufe, setBotStufe] = useState<BotLevel>('standard');

  /** Beitreten: der eingetippte Code, sein Tisch und die offene Tischliste. */
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get(TISCH_PARAMETER) ?? '',
  );
  const [vorschau, setVorschau] = useState<TischVorschau | null>(null);
  const [offeneTische, setOffeneTische] = useState<TableRow[]>([]);

  /**
   * Ein Tisch, den Freunde betreten koennen.
   *
   * `fillWithBots` bleibt aus, obwohl der Gastgeber die Auffuellung gewaehlt
   * haben kann: Mit dem Haken waere der Tisch in dem Augenblick startklar, in
   * dem der Gastgeber sich hinsetzt (`isReadyToStart` im Server), und die
   * Partie liefe los, bevor der erste Freund den Code eingetippt hat. Die
   * freien Plaetze werden deshalb erst beim Druck auf "Partie starten"
   * besetzt — dieselben Zurufe, die auch der Doppelkopf-Wartebereich schickt.
   */
  const erstelleTisch = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const antwort = await api.createTable({
        gameId: 'tafelrunde',
        seats: sitze,
        rounds: RUNDEN,
        visibility: oeffentlich ? 'public' : 'on_request',
        fillWithBots: false,
        botLevel: botStufe,
      });
      setWartesaal({ code: antwort.joinCode, gastgeber: true, botsFuellen });
      setTischId(antwort.id);
    } catch (err) {
      setFehler(
        err instanceof ApiError ? t(err.messageKey) : 'Der Tisch ließ sich nicht aufmachen.',
      );
    } finally {
      setStartet(false);
    }
  }, [sitze, oeffentlich, botStufe, botsFuellen]);

  /** Beitreten per Code. Ein Ruf, damit zwischen Nachsehen und Setzen nichts passt. */
  const treteBeiPerCode = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const { tableId } = await api.beitretenPerCode(code);
      setWartesaal({ code: code.toUpperCase(), gastgeber: false, botsFuellen: false });
      setTischId(tableId);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : 'Beitreten fehlgeschlagen.');
    } finally {
      setStartet(false);
    }
  }, [code]);

  /** Beitreten aus der Liste der oeffentlichen Tische. */
  const treteBeiTisch = useCallback(async (id: string): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      await api.joinTable(id);
      setWartesaal({ code: null, gastgeber: false, botsFuellen: false });
      setTischId(id);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : 'Beitreten fehlgeschlagen.');
    } finally {
      setStartet(false);
    }
  }, []);

  /**
   * In der Beitreten-Ansicht: den Tisch hinter dem Code ansehen und die
   * offenen Tische holen.
   *
   * Der Effekt haengt am Code als Zeichenkette und an der Ansicht, nicht an
   * einem Objekt — sonst raeumte er bei jedem Tastendruck seinen eigenen
   * Zeitgeber ab (siehe CLAUDE.md).
   */
  const codeFertig = code.replace(/[^A-Za-z0-9]/g, '').length >= 6;
  useEffect(() => {
    if (menue !== 'beitreten' || !codeFertig) {
      setVorschau(null);
      return;
    }
    let lebt = true;
    void api
      .tischPerCode(code)
      .then((v) => {
        if (lebt) setVorschau(v);
      })
      .catch(() => {
        // Ein unbekannter Code ist hier kein Fehler zum Anschreien: Man tippt
        // noch. Die Absage kommt beim Beitreten.
        if (lebt) setVorschau(null);
      });
    return () => {
      lebt = false;
    };
  }, [menue, code, codeFertig]);

  useEffect(() => {
    if (menue !== 'beitreten') return;
    let lebt = true;
    const hole = (): void => {
      void api
        .tables('tafelrunde')
        .then((zeilen) => {
          // Nur Tische mit freiem Platz — ein voller ist kein Angebot.
          if (lebt) setOffeneTische(zeilen.filter((z) => z.occupied < z.seats));
        })
        .catch(() => {
          /* Die Liste ist Beiwerk; der Code ist der Hauptweg. */
        });
    };
    hole();
    const takt = window.setInterval(hole, 4000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [menue]);

  /**
   * Zurueck ins Menue, bevor die Partie laeuft. Der Platz am Tisch wird dabei
   * geraeumt — der Server schliesst einen Tisch, an dem danach kein Mensch
   * mehr sitzt.
   */
  const brichAb = useCallback((): void => {
    const id = tischId;
    setTischId(null);
    setWartesaal(null);
    setMenue('start');
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
  // Tisch erstellen
  // -------------------------------------------------------------------------

  if (!tischId && menue === 'erstellen') {
    return (
      <main className="tr-seite tr-menue">
        <button className="tr-zurueck" type="button" onClick={() => setMenue('start')}>
          ← Zurück
        </button>
        <div className="tr-menue-mitte">
          <h1 className="tr-titel tr-titel-klein">Tisch erstellen</h1>

          <h2 className="tr-feldtitel">Plätze</h2>
          <div className="tr-chips">
            {SITZ_WAHL.map((zahl) => (
              <button
                key={zahl}
                type="button"
                className={`tr-chip${sitze === zahl ? ' is-an' : ''}`}
                aria-pressed={sitze === zahl}
                onClick={() => setSitze(zahl)}
              >
                {zahl}
              </button>
            ))}
          </div>

          <h2 className="tr-feldtitel">Für wen</h2>
          <div className="tr-chips">
            <button
              type="button"
              className={`tr-chip${oeffentlich ? '' : ' is-an'}`}
              aria-pressed={!oeffentlich}
              onClick={() => setOeffentlich(false)}
            >
              Nur mit Code
            </button>
            <button
              type="button"
              className={`tr-chip${oeffentlich ? ' is-an' : ''}`}
              aria-pressed={oeffentlich}
              onClick={() => setOeffentlich(true)}
            >
              Offen für alle
            </button>
          </div>

          <h2 className="tr-feldtitel">Freie Plätze</h2>
          <div className="tr-chips">
            <button
              type="button"
              className={`tr-chip${botsFuellen ? ' is-an' : ''}`}
              aria-pressed={botsFuellen}
              onClick={() => setBotsFuellen(true)}
            >
              Mit Bots füllen
            </button>
            <button
              type="button"
              className={`tr-chip${botsFuellen ? '' : ' is-an'}`}
              aria-pressed={!botsFuellen}
              onClick={() => setBotsFuellen(false)}
            >
              Frei lassen
            </button>
          </div>

          {/* Die Stufe zeigt nur, wer Bots will — sonst stellt man etwas ein,
              das an diesem Tisch nie zum Zug kommt. */}
          {botsFuellen && (
            <>
              <h2 className="tr-feldtitel">Wie hart spielen die Bots</h2>
              <div className="tr-chips">
                {BOT_STUFEN.map((stufe) => (
                  <button
                    key={stufe.id}
                    type="button"
                    className={`tr-chip${botStufe === stufe.id ? ' is-an' : ''}`}
                    aria-pressed={botStufe === stufe.id}
                    onClick={() => setBotStufe(stufe.id)}
                  >
                    {stufe.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            className="tr-suchen"
            type="button"
            onClick={() => void erstelleTisch()}
            disabled={startet}
          >
            Tisch aufmachen
          </button>
          <p className="tr-untertitel tr-klein">
            {oeffentlich
              ? 'Der Tisch steht in der Liste und ist zusätzlich über seinen Code erreichbar.'
              : 'Nur wer den Code hat, kommt an diesen Tisch. Du startest, wann du willst.'}
          </p>
          {fehler && <p className="tr-fehler">{fehler}</p>}
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------------------
  // Tisch beitreten
  // -------------------------------------------------------------------------

  if (!tischId && menue === 'beitreten') {
    return (
      <main className="tr-seite tr-menue">
        <button className="tr-zurueck" type="button" onClick={() => setMenue('start')}>
          ← Zurück
        </button>
        <div className="tr-menue-mitte">
          <h1 className="tr-titel tr-titel-klein">Tisch beitreten</h1>
          <p className="tr-untertitel">
            Tippe den Code ein, den du bekommen hast — oder nimm einen offenen Tisch.
          </p>

          <input
            className="tr-codefeld"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            aria-label="Beitrittscode"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
          />
          {vorschau && (
            <p className="tr-untertitel">
              {vorschau.host ? `Tisch von ${vorschau.host}` : 'Offener Tisch'} ·{' '}
              {vorschau.occupied}/{vorschau.seats} Plätzen besetzt
            </p>
          )}
          <button
            className="tr-suchen"
            type="button"
            onClick={() => void treteBeiPerCode()}
            disabled={startet || !codeFertig}
          >
            Beitreten
          </button>

          <h2 className="tr-feldtitel">Offene Tische</h2>
          {offeneTische.length === 0 ? (
            <p className="tr-untertitel">
              Gerade steht kein offener Tisch. Mach selbst einen auf.
            </p>
          ) : (
            <div className="tr-tischliste">
              {offeneTische.map((zeile) => (
                <button
                  key={zeile.id}
                  type="button"
                  className="tr-tischzeile"
                  onClick={() => void treteBeiTisch(zeile.id)}
                  disabled={startet}
                >
                  <span>{zeile.host ? `Tisch von ${zeile.host}` : 'Offener Tisch'}</span>
                  <span className="tr-tischzahl">
                    {zeile.occupied}/{zeile.seats}
                  </span>
                </button>
              ))}
            </div>
          )}
          {fehler && <p className="tr-fehler">{fehler}</p>}
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
          {/* Der geplante Weg neben der Schnellsuche: einen Tisch aufmachen
              und den Code weitergeben. Zwei Knoepfe statt eines, weil
              Aufmachen und Beitreten zwei verschiedene Rollen sind — wer den
              Code bekommen hat, sucht keinen Erstellen-Knopf. */}
          <div className="tr-menue-paar">
            <button
              className="tr-nebenknopf"
              type="button"
              onClick={() => {
                setFehler(null);
                setMenue('erstellen');
              }}
              disabled={startet}
            >
              Tisch erstellen
            </button>
            <button
              className="tr-nebenknopf"
              type="button"
              onClick={() => {
                setFehler(null);
                setMenue('beitreten');
              }}
              disabled={startet}
            >
              Tisch beitreten
            </button>
          </div>
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

  if (!sicht && wartesaal) {
    return (
      <Wartesaal
        wartesaal={wartesaal}
        sitze={tisch.table?.seats ?? []}
        botStufe={tisch.table?.botLevel ?? botStufe}
        onBotStufe={(stufe) => {
          setBotStufe(stufe);
          tisch.setBotLevel(stufe);
        }}
        onBotsFuellen={(an) => setWartesaal({ ...wartesaal, botsFuellen: an })}
        onStart={() => {
          if (wartesaal.botsFuellen) {
            // Jeden freien Platz mit einem Bot besetzen. Mit dem letzten faellt
            // `isReadyToStart` im Server auf wahr und die Partie geht los —
            // derselbe Weg wie im Doppelkopf-Wartebereich.
            for (const platz of tisch.table?.seats ?? []) {
              if (!platz.accountId && !platz.isBot) tisch.addBot(platz.seat);
            }
          } else {
            // Ohne Bots: Der Tisch schrumpft serverseitig auf die Besetzten.
            tisch.startNow();
          }
        }}
        onAbbrechen={brichAb}
      />
    );
  }

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
        rundenfrist={tisch.view?.phaseDeadline ?? null}
        sitze={tisch.table?.seats ?? tisch.party?.seats ?? []}
        onAktion={(aktion) => tisch.send(aktion)}
        onZurueck={verlasseUndZurueck}
      />
    </Markennamen.Provider>
  );
}

// ---------------------------------------------------------------------------
// Der Wartesaal des verabredeten Tisches
// ---------------------------------------------------------------------------

/**
 * Was zwischen "Tisch aufgemacht" und "Partie laeuft" auf dem Schirm steht.
 *
 * Der Gastgeber sieht seinen Code, die Beigetretenen und den Startknopf; die
 * Gaeste sehen dasselbe ohne Knoepfe. Beide sehen dieselbe Sitzliste — sie
 * kommt aus dem Rundruf des Tisches und nicht aus einer eigenen Abfrage,
 * deshalb fuellt sie sich ohne Zutun, sobald jemand beitritt.
 *
 * Der Wartesaal bildet keine Regel nach: WANN gestartet werden darf,
 * entscheidet der Server (`isReadyToStart`, `schrumpfeAufBesetzte`). Hier
 * steht nur, wann der Knopf grau ist — und das ist dieselbe Zahl, die
 * daneben steht.
 */
function Wartesaal({
  wartesaal,
  sitze,
  botStufe,
  onBotStufe,
  onBotsFuellen,
  onStart,
  onAbbrechen,
}: {
  wartesaal: { code: string | null; gastgeber: boolean; botsFuellen: boolean };
  sitze: SitzZeile[];
  botStufe: BotLevel;
  onBotStufe: (stufe: BotLevel) => void;
  onBotsFuellen: (an: boolean) => void;
  onStart: () => void;
  onAbbrechen: () => void;
}): React.JSX.Element {
  const [kopiert, setKopiert] = useState<'code' | 'link' | null>(null);
  const menschen = sitze.filter((platz) => platz.accountId).length;

  const kopiere = (was: 'code' | 'link', text: string): void => {
    // Ohne Zwischenablage (aeltere Browser, unsicherer Kontext) passiert
    // nichts Schlimmes: Der Code steht gross daneben und laesst sich ablesen.
    void navigator.clipboard
      ?.writeText(text)
      .then(() => setKopiert(was))
      .catch(() => {});
  };

  return (
    <main className="tr-seite tr-menue">
      <button className="tr-zurueck" type="button" onClick={onAbbrechen}>
        ← Verlassen
      </button>
      <div className="tr-menue-mitte">
        <h1 className="tr-titel tr-titel-klein">Dein Tisch</h1>

        {wartesaal.code && (
          <>
            <p className="tr-code" aria-label={`Beitrittscode ${wartesaal.code}`}>
              {wartesaal.code}
            </p>
            <div className="tr-menue-paar">
              <button
                className="tr-nebenknopf"
                type="button"
                onClick={() => kopiere('code', wartesaal.code!)}
              >
                {kopiert === 'code' ? 'Code kopiert' : 'Code kopieren'}
              </button>
              <button
                className="tr-nebenknopf"
                type="button"
                onClick={() => kopiere('link', beitrittsLink(wartesaal.code!))}
              >
                {kopiert === 'link' ? 'Link kopiert' : 'Link kopieren'}
              </button>
            </div>
          </>
        )}

        {sitze.length === 0 ? (
          <p className="tr-untertitel">Verbindung wird aufgebaut…</p>
        ) : (
          <div className="tr-sitzliste">
            {sitze.map((platz) => (
              <div
                key={platz.seat}
                className={`tr-sitz${platz.accountId || platz.isBot ? ' is-besetzt' : ''}`}
              >
                <span>
                  {platz.displayName ?? (platz.isBot ? 'Bot' : 'Freier Platz')}
                </span>
                {platz.seat === 0 && <span className="tr-sitzmarke">Gastgeber</span>}
              </div>
            ))}
          </div>
        )}

        {wartesaal.gastgeber ? (
          <>
            <h2 className="tr-feldtitel">Freie Plätze beim Start</h2>
            <div className="tr-chips">
              <button
                type="button"
                className={`tr-chip${wartesaal.botsFuellen ? ' is-an' : ''}`}
                aria-pressed={wartesaal.botsFuellen}
                onClick={() => onBotsFuellen(true)}
              >
                Mit Bots füllen
              </button>
              <button
                type="button"
                className={`tr-chip${wartesaal.botsFuellen ? '' : ' is-an'}`}
                aria-pressed={!wartesaal.botsFuellen}
                onClick={() => onBotsFuellen(false)}
              >
                Weglassen
              </button>
            </div>

            {wartesaal.botsFuellen && (
              <div className="tr-chips">
                {BOT_STUFEN.map((stufe) => (
                  <button
                    key={stufe.id}
                    type="button"
                    className={`tr-chip${botStufe === stufe.id ? ' is-an' : ''}`}
                    aria-pressed={botStufe === stufe.id}
                    onClick={() => onBotStufe(stufe.id)}
                  >
                    {stufe.name}
                  </button>
                ))}
              </div>
            )}

            <button
              className="tr-suchen"
              type="button"
              onClick={onStart}
              disabled={!wartesaal.botsFuellen && menschen < 2}
            >
              Partie starten
            </button>
            <p className="tr-untertitel tr-klein">
              {wartesaal.botsFuellen
                ? 'Freie Plätze übernehmen Bots — du kannst sofort losspielen.'
                : menschen < 2
                  ? 'Ohne Bots braucht es mindestens einen Mitspieler.'
                  : `Es spielen ${menschen} Menschen, die leeren Plätze fallen weg.`}
            </p>
          </>
        ) : (
          <p className="tr-untertitel">
            {menschen} {menschen === 1 ? 'Spieler ist' : 'Spieler sind'} da. Der Gastgeber
            startet die Partie.
          </p>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Die Ruestkammer
// ---------------------------------------------------------------------------

interface SitzZeile {
  seat: number;
  displayName: string | null;
  /**
   * Kennung des Menschen auf diesem Platz, null bei Bots und freien Plaetzen.
   * Der Wartesaal unterscheidet daran "wartet noch" von "sitzt schon" — ein
   * Bot hat einen Anzeigenamen, ist aber kein Mitspieler, auf den man wartet.
   */
  accountId: string | null;
  avatarUrl: string | null;
  isBot: boolean;
}

/**
 * Der Ablegeplatz unter einem Bildschirmpunkt — als Schluessel, oder null.
 *
 * Die Trefferpruefung laeuft ueber `document.elementFromPoint`, weil das Ziel
 * unter dem FINGER liegt und nicht unter dem Ereignis (das gehoert wegen der
 * Zeigererfassung immer noch der gezogenen Einheit). Beide Aufrufer — die
 * Vorschau waehrend des Ziehens und das Ablegen am Ende — gehen durch diese
 * eine Funktion: Was leuchtet, ist damit garantiert dasselbe Feld, auf dem
 * die Einheit gleich landet.
 *
 * `elementFromPoint` gibt es in jsdom nicht. Ohne die Pruefung waere jeder
 * Test, der zieht, ein Absturz statt einer Aussage.
 */
function zielUnter(x: number, y: number): string | null {
  if (typeof document.elementFromPoint !== 'function') return null;
  const unten = document.elementFromPoint(x, y);
  return (unten?.closest('[data-ziel]') as HTMLElement | null)?.dataset.ziel ?? null;
}

function Ruestkammer({
  sicht,
  katalog,
  synergieTabelle,
  legaleZuege,
  revision,
  frist,
  rundenfrist,
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
  /**
   * Frist der Platzierungsphase (`phaseDeadline`), waehrend der Vorbereitung
   * gesetzt. Zwei Felder und nicht eins, weil sie zwei verschiedene Dinge
   * meinen: Die Schaupause laeuft, waehrend NIEMAND handeln darf, und die
   * Kampfanzeige rechnet ihr Aufholen daraus aus (`startVersatz`). Ihr die
   * Frist der Ruestphase unterzuschieben hiesse, den Kampf mitten im Getuemmel
   * beginnen zu lassen.
   */
  rundenfrist: number | null;
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
  /*
   * Ob gerade wirklich gezogen wird — dieselbe Auskunft wie `zug.zieht`, nur
   * synchron lesbar. Der Bewegungs-Behandler hat keine Abhaengigkeiten (er
   * soll bei jedem Zeigerereignis derselbe bleiben) und sieht den Zustand
   * deshalb nicht. Ohne diese Merkzelle bliebe die Vorschau auf dem letzten
   * Feld stehen, sobald der Finger in die Naehe seines Ausgangspunkts
   * zurueckkehrt: Dort ist die Strecke wieder kurz, `weit` also falsch.
   */
  const zieht = useRef(false);

  /**
   * Welches Feld gerade UNTER dem Finger liegt — als Schluessel, nicht als Ort.
   *
   * Ohne diese Anzeige laesst man eine Einheit blind los: Der Schatten haengt
   * am Finger und verdeckt genau die Wabe, auf die man zielt. Gesucht wird
   * mit demselben Griff wie beim Ablegen (`elementFromPoint` auf
   * `[data-ziel]`), damit Vorschau und Ergebnis nicht auseinanderlaufen
   * koennen: Was hier leuchtet, ist buchstaeblich dasselbe Element, das
   * `beiZeigerEnde` gleich findet.
   *
   * Als Zeichenkette gehalten und nur bei WECHSEL gesetzt: Ein neuer Ort bei
   * jedem Zeigerereignis waere ein neues Objekt und damit ein Neuzeichnen des
   * ganzen Bretts sechzigmal je Sekunde.
   */
  const [ueberZiel, setUeberZiel] = useState<string | null>(null);

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
      zieht.current = false;
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
    if (weit) zieht.current = true;
    setZug((alt) =>
      alt ? { ...alt, x: ereignis.clientX, y: ereignis.clientY, zieht: alt.zieht || weit } : alt,
    );
    if (zieht.current) setUeberZiel(zielUnter(ereignis.clientX, ereignis.clientY));
  }, []);

  /**
   * Der Browser hat das Ziehen abgebrochen — ein Anruf, eine Geste des
   * Betriebssystems, ein zweiter Finger. Ohne diesen Aufraeumer bliebe der
   * Schatten am Bildschirm kleben und die Einheit blass an ihrem Platz.
   */
  const beiZeigerAbbruch = useCallback((): void => {
    startPunkt.current = null;
    zieht.current = false;
    setZug(null);
    setUeberZiel(null);
  }, []);

  const beiZeigerEnde = useCallback(
    (ort: Ort, ereignis: React.PointerEvent): void => {
      const gezogen = zug?.zieht === true;
      startPunkt.current = null;
      zieht.current = false;
      setZug(null);
      setUeberZiel(null);
      if (!gezogen) {
        // Ein Tipp, keine Bewegung: Auswahl statt Ziehen.
        tippeOrt(ort);
        return;
      }
      const ziel = ortLesen(zielUnter(ereignis.clientX, ereignis.clientY));
      if (ziel) schiebe(ort, ziel);
    },
    [zug?.zieht, tippeOrt, schiebe],
  );

  /**
   * Das Feld unter dem Finger — aber nur, wenn die gezogene Einheit dort auch
   * landen DARF.
   *
   * Die Vorschau soll nicht mehr versprechen, als das Ablegen einloest: Ueber
   * einem vollen Brett leuchtet nichts, und genau das ist die Auskunft.
   * Geprueft wird mit derselben Funktion wie beim Ablegen (`zielbar`), also
   * mit den zwei Zahlen aus der Sicht — hier wird keine Regel nachgebaut.
   */
  const ablegeZiel = useMemo(() => {
    if (zug?.zieht !== true || ueberZiel === null) return null;
    const ort = ortLesen(ueberZiel);
    return ort && zielbar(zug.von, ort) ? ueberZiel : null;
  }, [zug?.zieht, zug?.von, ueberZiel, zielbar]);

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
   * Warum ein Ladenplatz gesperrt ist — die Auskunft steht bei der Karte
   * selbst (`kaufhindernis` in Ladenkarte.tsx), damit die Probe
   * `/probe/ruestkammer` dieselbe bekommt. Hier haengen nur die beiden Zahlen
   * der Sicht davor.
   */
  const hindernis = useCallback(
    (angeboten: Einheit | undefined): Kaufhindernis =>
      eigenes ? kaufhindernis(eigenes.gold, !eigenes.bank.includes(null), angeboten) : null,
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

  /**
   * Wie viele Sitze noch dabei und davon schon bereit sind.
   *
   * Das ist die Auskunft, die in der Platzierungsphase an der Stelle der
   * Restzeit steht — und die einzige, die dort ehrlich ist: Die Phase endet
   * nicht nach Zeit, sondern wenn der Letzte bereit ist (siehe Kopf von
   * Phasenzeile.tsx). Gezaehlt wird ueber dieselbe Reihe, aus der auch die
   * Mitspielerleiste entsteht, damit beide nie unterschiedlich zaehlen.
   */
  const sitzreihe = leistenplaetze(eigenes, sicht.gegner, gegnerJetzt);
  const offeneSitze = sitzreihe.filter((p) => p.ausRunde === null).length;
  const bereitZahl = sitzreihe.filter((p) => p.ausRunde === null && p.bereit).length;

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
        paarungen={kampfbild.paarungen}
        ich={sicht.ich}
        brettReihen={sicht.brettReihen}
        arenaReihen={sicht.arenaReihen}
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

  /**
   * Laeuft gerade ein Kampf auf dem Schirm?
   *
   * An `kampfbild` und nicht an `sicht.phase === 'kampf'`: Die Arena bleibt
   * nach dem Phasenwechsel noch einen Wimpernschlag stehen, um zu verblassen
   * (`useKampfbild`). Ginge das Eingeklappte schon beim Wechsel wieder auf,
   * spraenge die halbe Seite unter der verblassenden Buehne hervor.
   */
  const kampfLaeuft = kampfbild !== null;

  if (!eigenes) {
    // Zuschauer: kein Laden, keine Bank, kein Gold (sicht.ts). Es bleibt das
    // Brett — und das ist oeffentlich.
    return (
      <main className="tr-seite tr-tisch">
        {/* Dieselbe Kopfleiste wie am Spielertisch — sie ist die Auskunft
            ueber das Turnier, und die gilt fuer Zuschauer genauso. */}
        <div className="tr-oben">
          <div className="tr-oben-reihe">
            <button
              className="tr-zurueck-oben"
              type="button"
              onClick={onZurueck}
              aria-label="Zurück"
            >
              ←
            </button>
            {/* Ein Zuschauer bekommt alle Sitze als `gegner` (sicht.ts) und
                hat selbst keinen — deshalb `eigenes={null}` und keine
                Gegnermarke. */}
            <Mitspielerleiste
              eigenes={null}
              gegner={sicht.gegner}
              gegnerJetzt={null}
              gezeigt={gegner?.sitz ?? null}
              sitze={sitze}
              onWahl={setGezeigterGegner}
            />
          </div>
          <Phasenzeile
            runde={sicht.runde}
            phase={sicht.phase}
            frist={frist ?? rundenfrist}
            bereit={bereitZahl}
            offen={offeneSitze}
          />
        </div>
        <p className="tr-hinweis">Du schaust zu</p>
        {arena ||
          (gegner && (
            <div className="tr-bretter">
              <section className="tr-brettteil">
                {/* Name und Marken in einer Zeile, wie am Spielertisch
                    (`.tr-brettkopf`): Zwei Zeilen Beiwerk ueber einem Brett
                    kosten am Handy 33 Pixel, nebeneinander 18. */}
                <div className="tr-brettkopf">
                  <h2 className="tr-bretttitel">{spielername(zeile(gegner.sitz), gegner.sitz)}</h2>
                  {/* Die Marken des gezeigten Bretts. Ein Zuschauer bekommt das
                      Feld `synergien` an jedem Sitz genau wie ein Spieler
                      (sicht.ts) — bis heute stand hier nichts davon. */}
                  <Fremdmarken
                    staende={gegner.synergien ?? OHNE_SYNERGIEN}
                    tabelle={synergieTabelle}
                    katalog={katalog}
                    beschriftung={`Marken von ${spielername(zeile(gegner.sitz), gegner.sitz)}`}
                  />
                </div>
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
      {/* ---- Ganz oben und festgeheftet: das Turnier --------------------- */}
      {/*
        Mitspielerleiste und Phasenzeile stehen zusammen in EINEM Kasten, und
        der klebt beim Rollen oben fest (`.tr-oben` in styles.css). Das ist
        der Kern des Umbaus vom 05.09.2026: Vorher war die Leiste eine
        zuklappbare Liste mitten im Fluss — wer zum Laden runterrollte, sah
        weder, wie viel Leben die anderen haben, noch in welcher Phase er
        gerade ist.

        Der Zurueck-Knopf steht IN dieser Reihe und nicht mehr als eigene
        Ebene darueber: An seinem alten Platz (oben links, absolut) laege er
        jetzt auf der ersten Spielerkachel.
      */}
      <div className="tr-oben">
        <div className="tr-oben-reihe">
          <button
            className="tr-zurueck-oben"
            type="button"
            onClick={onZurueck}
            aria-label="Zurück"
          >
            ←
          </button>
          <Mitspielerleiste
            eigenes={eigenes}
            gegner={sicht.gegner}
            gegnerJetzt={gegnerJetzt}
            gezeigt={gegner?.sitz ?? null}
            sitze={sitze}
            onWahl={setGezeigterGegner}
          />
        </div>
        <Phasenzeile
          runde={sicht.runde}
          phase={sicht.phase}
          frist={frist ?? rundenfrist}
          bereit={bereitZahl}
          offen={offeneSitze}
        />
      </div>

      {/* ---- Die Statuszeile: eigene Werte und Marken in EINER Reihe ----- */}
      {/*
        Bis zum 06.09.2026 waren das zwei Baender untereinander: ein Kasten
        mit zwei grossen Kacheln (Leben, Rang/Feld) und darunter die
        Markenleiste. Auf Robins Handybild (440 x 956, IMG_1047) kosteten
        fuenf kleine Angaben zusammen 88 Pixel — Platz, der dem Brett und dem
        Laden fehlte. Nebeneinander in einer Reihe sind es 22.

        Die Werte sehen jetzt aus wie die Markenchips daneben, weil sie
        dasselbe sind: kurze Auskunft, kein Bedienfeld. Ihre Masse stehen in
        styles.css (`.tr-wert`), die der Marken in Synergien.module.css — der
        Chip des Nachbarn wird NICHT abgeschrieben, beide Bauteile behalten
        ihr eigenes Stylesheet.

        WAEHREND DES KAMPFES STEHEN NUR DIE MARKEN DA. Leben und Rang sind
        dort entbehrlich: Das eigene Leben steht ohnehin auf der eigenen
        Kachel in der Mitspielerleiste darueber, und Rang wie Feldplaetze kann
        man im Kampf weder aendern noch brauchen. Die Marken bleiben, denn wer
        zusieht, plant schon die naechste Runde.
      */}
      <div className="tr-statuszeile">
        {!kampfLaeuft && (
          <header className="tr-kopf">
            <span className="tr-wert tr-wert-leben">
              <LebenZeichen />
              <strong>{eigenes.leben}</strong>
              <em>Leben</em>
            </span>
            <span className="tr-wert tr-wert-level">
              <em>Rang</em>
              <strong>{eigenes.level}</strong>
            </span>
            <span className="tr-wert tr-wert-feld">
              <strong>
                {eigenes.belegt}/{eigenes.feldplaetze} Feld
              </strong>
            </span>
          </header>
        )}
        {/* Am Desktop haengt die Leiste seitlich statt hier — das entscheidet
            allein Synergien.module.css, und weil sie sich dort selbst aus dem
            Fluss nimmt (`position: fixed`), bleibt diese Reihe davon
            unberuehrt. */}
        <Synergieleiste staende={eigeneSynergien} tabelle={synergieTabelle} katalog={katalog} />
      </div>

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
              {/* Name und Marken in EINER Zeile, seit dem 06.09.2026 — aus
                  demselben Grund wie bei der eigenen Statuszeile darueber:
                  Zwei Zeilen Beiwerk ueber einem Brett kosteten am Handy
                  33 Pixel, nebeneinander sind es 18. Der Gegnerteil ist die
                  Haelfte, die ohnehin schon zurueckgenommen ist; ihm zwei
                  volle Zeilen zu geben und dem Laden darunter keinen Platz
                  waere die falsche Reihenfolge. */}
              <div className="tr-brettkopf">
                <h2 className="tr-bretttitel">
                  {spielername(zeile(gegner.sitz), gegner.sitz)}
                  {gegner.ausRunde !== null ? ' · ausgeschieden' : ''}
                </h2>
                {/* Womit der Gegner antritt — dieselben Zeichen und Zaehler wie
                    in der eigenen Leiste. Ohne sie muesste man seine Figuren
                    einzeln abzaehlen, um zu sehen, dass er auf sechs Waechter
                    zugeht. Die Zahlen kommen aus SEINER Sicht; abgezaehlt wird
                    auch hier nichts. */}
                <Fremdmarken
                  staende={gegner.synergien ?? OHNE_SYNERGIEN}
                  tabelle={synergieTabelle}
                  katalog={katalog}
                  beschriftung={`Marken von ${spielername(zeile(gegner.sitz), gegner.sitz)}`}
                />
              </div>
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
              /* Wo die Einheit landet, wenn der Finger jetzt loslaesst. Nur
                 waehrend eines Zuges gesetzt — sonst leuchtete das Brett
                 unter jedem Mauszeiger. */
              unterZeiger={ablegeZiel}
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
      {/* Die Reihe selbst steht in minispiele/tafelrunde/Brett.tsx; hier
          steht nur, dass sie unmittelbar nach dem Brett kommt und WANN sie
          ueberhaupt dasteht.

          WAEHREND DES KAMPFES IST SIE ZU — aus demselben Grund, aus dem der
          Laden darunter zu ist: Es geht nichts von ihr aufs Feld und nichts
          zurueck, sie ist in dieser Minute ein Bild. Als Streifen unter dem
          Brett kostet sie auf einem 390-px-Schirm 55 Pixel, und die stehen der
          Arena besser. Der Satz „Deine Bank ist leer" faellt mit ihr weg: Er
          schickt zum Laden, und der ist im Kampf ebenfalls zu. */}
      {!kampfLaeuft && (
        <Bankreihe
          /* Aus der Sicht und nicht aus dem Stylesheet: `bankPlaetze` steht
             im Regelsatz und ist damit je Tisch verstellbar. */
          plaetze={sicht.bankPlaetze}
          bank={eigenes.bank}
          katalog={katalog}
          maxStufe={sicht.maxStufe}
          gewaehlt={gewaehlt}
          istZiel={gewaehlt ? (ort) => zielbar(gewaehlt, ort) : undefined}
          onWaehlen={tippeOrt}
          ziehtVon={zug?.zieht ? zug.von : null}
          unterZeiger={ablegeZiel}
          fehlendeKopien={fehlen}
          frischVerschmolzen={verschmolzen}
          aktiv={darfHandeln}
          onZeigerStart={beiZeigerStart}
          onZeigerBewegung={beiZeigerBewegung}
          onZeigerEnde={beiZeigerEnde}
          onZeigerAbbruch={beiZeigerAbbruch}
        />
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
            {/* Der Ladenkopf: links das Wort, rechts das Gold — gross, weil
                es die Zahl ist, gegen die man jeden Preis darunter rechnet.
                Es stand bis zum 05.09.2026 als eine von vier gleich grossen
                Kacheln ganz oben, also weit weg von den Preisen. */}
            <div className="tr-ladenkopf">
              <span className="tr-ladenwort">Laden</span>
              <span className="tr-goldstand">
                <GoldZeichen />
                <strong>{eigenes.gold}</strong>
                {/* Was die naechste Runde einbringt, steht klein daneben:
                    Zins und Serienbonus sind sonst unsichtbar und wirken
                    wie Zufall. */}
                <em>+{eigenes.einkommen}</em>
              </span>
            </div>
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
            {/* Seit das Nachbesetzen greift, steht hier kein Platz mehr leer,
                weil jemand gekauft hat — nur noch, wenn der Vorrat nichts mehr
                hergibt. Der alte Satz ("würfle neu für frische Recken")
                schickte den Spieler dann auf einen Knopf, der nichts mehr
                ändern kann. */}
            {eigenes.laden.every((id) => id === null) && (
              <p className="tr-leer-satz">
                Der Vorrat gibt nichts mehr her — alle Recken sind im Umlauf.
                Mach dich bereit.
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
                {/* Kostet das Wuerfeln nichts (Vorgabe seit dem 05.09.2026),
                    faellt die Preisangabe ganz weg. "0 Gold" waere schlechter
                    als nichts: Es liest sich wie ein Preis, den man erst
                    nachrechnen muss. Ein Tisch darf den Preis weiterhin
                    setzen, dann steht er wieder da.

                    Der Preis wird rot, wenn das Gold nicht reicht — sonst
                    sieht ein gesperrter Knopf aus wie ein kaputter. Beide
                    Bedingungen muessen zutreffen: `legalActions` hat den Zug
                    abgelehnt UND die Zahlen der Sicht erklaeren es auch.
                    Erklaeren sie es nicht, bleibt der Preis ruhig statt zu
                    raten. */}
                {eigenes.neuwuerfelnKosten > 0 && (
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
                )}
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
          platzierung={sicht.platzierung}
          ausRunde={eigenes.ausRunde}
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
function useKampfbild(sicht: TafelrundeSicht): (Kampfbild & { verblasst: boolean }) | null {
  const kaempfe = sicht.phase === 'kampf' ? (sicht.kaempfe ?? []) : [];
  const laeuft = kaempfe.length > 0;
  const bild: Kampfbild = { kaempfe, paarungen: paarungenAus(sicht, kaempfe) };
  const zuletzt = useRef<Kampfbild | null>(null);
  const [ausklang, setAusklang] = useState<Kampfbild | null>(null);
  if (laeuft) zuletzt.current = bild;

  useEffect(() => {
    if (sicht.phase === 'kampf') {
      setAusklang(null);
      return;
    }
    const alte = zuletzt.current;
    if (!alte) return;
    zuletzt.current = null;
    setAusklang(alte);
    const uhr = window.setTimeout(() => setAusklang(null), AUSKLANG_MS);
    return () => window.clearTimeout(uhr);
  }, [sicht.phase]);

  if (laeuft) return { ...bild, verblasst: false };
  if (ausklang) return { ...ausklang, verblasst: true };
  return null;
}

/** Was die Arena zeigt: der abzuspielende Kampf und die Ergebnisse daneben. */
interface Kampfbild {
  kaempfe: Kampfpaarung[];
  paarungen: Paarungsergebnis[];
}

/**
 * Die Ergebnisliste der Runde — notfalls aus den Kaempfen abgeleitet.
 *
 * Ein Tisch, der vor dieser Sicht aufgemacht wurde, fuehrt `paarungen` nicht.
 * Dann bleibt, was schon vorher da war: Ein Zuschauer hat alle Kaempfe und
 * bekommt daraus dieselbe Liste, ein Spieler nur seinen eigenen — und der
 * faellt in der Anzeige ohnehin heraus, die Ergebniszeilen bleiben also leer
 * wie bisher. Kein Stolpern, nur kein Zugewinn.
 */
function paarungenAus(
  sicht: TafelrundeSicht,
  kaempfe: readonly Kampfpaarung[],
): Paarungsergebnis[] {
  if (sicht.paarungen) return sicht.paarungen;
  return kaempfe.map((k) => ({
    a: k.a,
    b: k.b,
    geist: k.geist,
    sieger: k.bericht.sieger,
    schaden: k.bericht.sieger === null ? 0 : k.bericht.schaden,
    dauerMs: k.bericht.dauerMs,
  }));
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

/*
 * Brett, Bank, Einheitenmarke und Ladenkarte standen bis zum 06.09.2026 HIER
 * — zusammen rund 500 Zeilen mitten in diesem Bildschirm und alle vier
 * privat. Sie liegen jetzt in minispiele/tafelrunde/Brett.tsx und
 * Ladenkarte.tsx, damit die Probe `/probe/ruestkammer` sie EINHAENGEN kann,
 * statt `.tr-wabe`, `.tr-einheit` und `.tr-karte` nachzubauen; die
 * Kleinteile (Rollenname, Kostenfarbe, die vier Zeichen) stehen in
 * Zeichen.tsx. Dieselbe Bewegung wie bei der Mitspielerleiste darueber und
 * aus demselben Grund: Was ausserhalb des Tisches gezeigt werden soll, darf
 * nicht im Tisch eingeschlossen sein.
 */

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
 * Adapter, bis zu 46,5 Sekunden). Wer hier etwas einbaut, das eine feste
 * Dauer annimmt, liegt daneben.
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
 * Wortlaut nach dem Muster von Filler und Eiland.
 *
 * BIS ZUM 05.09.2026 STAND HIER EIN ABSCHNITT "Noch nicht dabei": Solange die
 * Kampfphase uebersprungen wurde und die Marken-Boni fehlten, nannte das Blatt
 * beides ausdruecklich, damit der erste Spieler die folgenlose Runde nicht fuer
 * einen Fehler haelt. Beide Gruende sind weg — die Kaempfe laufen ab
 * (`loeseKampfAuf`) und die Synergien greifen im Modul (synergien.ts, Schwellen
 * 2/3/5) —, also ist der Abschnitt weg und die Synergie steht als Regel bei den
 * anderen. Ein Regelblatt, das ein vorhandenes Spielelement als fehlend
 * ankuendigt, ist schlimmer als keins: Wer die Leiste sieht, glaubt dann eher
 * dem Text als dem Bildschirm.
 *
 * Die Schwellen stehen hier als Zahlen im Fliesstext, weil ein Regeltext sie
 * nennen muss, um verstaendlich zu sein. Gerechnet wird mit ihnen NICHT — das
 * tut allein das Modul, und die Leiste zeichnet nur, was in der Sicht steht
 * (siehe Synergien.tsx). Wer die Schwellen im Modul verschiebt, zieht diesen
 * Satz mit.
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
          Recken gehören Klassen an wie Krieger, Wächter oder Untot. Stehen{' '}
          <strong>zwei Träger derselben Klasse auf dem Feld</strong>, wird die
          Klasse stärker; ab drei und ab fünf noch einmal deutlicher. Der Bonus
          gilt nur für die Träger selbst und nur auf dem Feld — was auf der Bank
          liegt, zählt nicht mit. Was gerade greift und wie weit es bis zur
          nächsten Stufe ist, zeigt die Synergie-Leiste. Tippe einen Zähler
          darin an, und du bekommst alle Stufen der Klasse und alle Recken, die
          sie tragen.
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
      <h3>Ziel</h3>
      <p>Als Letzter am Tisch stehen bleiben.</p>
    </div>
  );
}
