/**
 * Alles vor dem Tisch: Schnellsuche, Bot-Tisch, verabredeter Tisch, Beitreten.
 *
 * DIE LOGIK IST DIE VON screens/Tafelrunde.tsx, und zwar mit Absicht als
 * Uebernahme und nicht als gemeinsame Funktion: Das alte Tafelrunde bleibt
 * bis zur Abnahme unangetastet der Standard (docs/TAFELRUNDE-NEU-UMSETZUNG.md,
 * Abschnitt 7) und wird danach entfernt (Abschnitt 11). Ein Umbau des alten
 * Bildschirms, nur damit beide sich einen Haken teilen, haette genau das
 * Spiel angefasst, das weiterlaufen muss. Die Begruendungen der einzelnen
 * Entscheidungen stehen dort ausfuehrlich; hier steht jeweils der Kern.
 *
 * Was sich unterscheidet: Die Suche fuehrt die WARTENDEN mit (Name und Bild,
 * seit dem 27.11.2026 im Suchstand), und `nochmal` setzt nach dem Abschluss
 * direkt eine neue Suche ab.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api, type Suchstand, type TableRow, type TischVorschau } from '../../../api';
import { t } from '../../../i18n';
import type { BotLevel } from '../../../protocol';
import { tz } from '../text';
import { TISCH_PARAMETER } from '../tischlink';

/** Sitze am Bot-Tisch — dieselbe Zahl wie `SITZE` im alten Bildschirm. */
export const BOT_SITZE = 4;

/**
 * Sitzzahlen zur Auswahl. Eine AUSWAHL, keine Kopie einer Regel: Was das
 * Modul nicht kennt, weist der Server ab (`seatCountUnsupported`), und der
 * Vertrag `tafelrunde-tisch.test.ts` haelt dieselbe Liste des alten
 * Bildschirms fest — diese hier zieht ein eigener Test nach.
 */
export const SITZ_WAHL = [2, 3, 4, 6, 8] as const;

/** Takt der Suchabfrage: eine Sekunde, weil daneben die Restzeit laeuft. */
const SUCH_TAKT_MS = 1000;

/** Die Bot-Stufen dieses Spiels — beim Zeichnen nachgeschlagen (Sprache). */
export function botStufen(): readonly { id: BotLevel; name: string }[] {
  return [
    { id: 'anfaenger', name: tz('bot.sanft') },
    { id: 'standard', name: tz('bot.normal') },
    { id: 'experte', name: tz('bot.hart') },
  ];
}

export interface Wartesaal {
  code: string | null;
  gastgeber: boolean;
  botsFuellen: boolean;
}

export type Menue = 'start' | 'erstellen' | 'beitreten';

export function useLobby(startTisch: string | null, sichtDa: boolean) {
  const [tischId, setTischId] = useState<string | null>(startTisch);
  const [suchstand, setSuchstand] = useState<Suchstand | null>(null);
  const [menue, setMenue] = useState<Menue>(() =>
    new URLSearchParams(window.location.search).get(TISCH_PARAMETER) ? 'beitreten' : 'start',
  );
  const [wartesaal, setWartesaal] = useState<Wartesaal | null>(null);
  const [startet, setStartet] = useState(false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // --- Schnellsuche --------------------------------------------------------

  const starteSuche = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const stand = await api.sucheStarten('tafelrunde');
      if (stand.tischId) setTischId(stand.tischId);
      else setSuchstand(stand);
    } catch {
      setFehler(tz('fehler.suche'));
    } finally {
      setStartet(false);
    }
  }, []);

  /*
   * Abfragen, solange gesucht wird — am SCHLUESSEL `suchtGerade` und nicht am
   * Stand: Der Effekt setzt jede Sekunde einen neuen Stand und raeumte sonst
   * seinen eigenen Zeitgeber ab (CLAUDE.md).
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
            setSuchstand(null);
            setTischId(stand.tischId);
            return;
          }
          if (!stand.sucht) {
            setSuchstand(null);
            setFehler(tz('fehler.sucheBeendet'));
            return;
          }
          setSuchstand(stand);
        })
        .catch(() => {
          /* Ein Fehlversuch ist kein Abbruch; der Server wirft erst nach
             mehreren stillen Sekunden aus der Schlange. */
        });
    };
    const takt = window.setInterval(frage, SUCH_TAKT_MS);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [suchtGerade]);

  /* Wer den Bildschirm verlaesst, verlaesst die Suche — sonst saesse er
     womoeglich an einem Tisch, den niemand mehr ansieht. */
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

  // --- Bot-Tisch -----------------------------------------------------------

  const starteBots = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const { id } = await api.createTable({
        gameId: 'tafelrunde',
        seats: BOT_SITZE,
        rounds: 1,
        visibility: 'on_request',
        fillWithBots: true,
      });
      setTischId(id);
    } catch {
      setFehler(tz('fehler.tischNochmal'));
    } finally {
      setStartet(false);
    }
  }, []);

  // --- Verabredeter Tisch --------------------------------------------------

  const [sitze, setSitze] = useState(4);
  const [oeffentlich, setOeffentlich] = useState(false);
  const [botsFuellen, setBotsFuellen] = useState(true);
  const [botStufe, setBotStufe] = useState<BotLevel>('standard');
  const [code, setCode] = useState(
    () => new URLSearchParams(window.location.search).get(TISCH_PARAMETER) ?? '',
  );
  const [vorschau, setVorschau] = useState<TischVorschau | null>(null);
  const [offeneTische, setOffeneTische] = useState<TableRow[]>([]);

  /*
   * `config` bleibt weg: Der Server nimmt den Regelsatz des Moduls (CLAUDE.md,
   * „Was das Modul weiss, schreibt der Client nicht ab"). `fillWithBots` bleibt
   * aus, sonst liefe die Partie los, bevor der erste Freund den Code getippt
   * hat — die Bots kommen erst mit „Partie starten".
   */
  const erstelleTisch = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const antwort = await api.createTable({
        gameId: 'tafelrunde',
        seats: sitze,
        rounds: 1,
        visibility: oeffentlich ? 'public' : 'on_request',
        fillWithBots: false,
        botLevel: botStufe,
      });
      setWartesaal({ code: antwort.joinCode, gastgeber: true, botsFuellen });
      setTischId(antwort.id);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : tz('fehler.tisch'));
    } finally {
      setStartet(false);
    }
  }, [sitze, oeffentlich, botStufe, botsFuellen]);

  const treteBeiPerCode = useCallback(async (): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      const { tableId } = await api.beitretenPerCode(code);
      setWartesaal({ code: code.toUpperCase(), gastgeber: false, botsFuellen: false });
      setTischId(tableId);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : tz('fehler.beitreten'));
    } finally {
      setStartet(false);
    }
  }, [code]);

  const treteBeiTisch = useCallback(async (id: string): Promise<void> => {
    setFehler(null);
    setStartet(true);
    try {
      await api.joinTable(id);
      setWartesaal({ code: null, gastgeber: false, botsFuellen: false });
      setTischId(id);
    } catch (err) {
      setFehler(err instanceof ApiError ? t(err.messageKey) : tz('fehler.beitreten'));
    } finally {
      setStartet(false);
    }
  }, []);

  /* Vorschau des Codes — am Code als Zeichenkette, nicht an einem Objekt. */
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

  /** Zurueck ins Menue, bevor die Partie laeuft — der Platz wird geraeumt. */
  const brichAb = useCallback((): void => {
    const id = tischId;
    setTischId(null);
    setWartesaal(null);
    setMenue('start');
    if (id) void api.leaveTable(id).catch(() => {});
  }, [tischId]);

  /**
   * Nach dem Abschluss gleich weiter: den alten Tisch verlassen und eine neue
   * Suche absetzen. Der Tisch ist zu dem Zeitpunkt beendet; das Verlassen
   * raeumt nur den eigenen Platz, damit „Weiterspielen" im Hub ihn nicht mehr
   * anbietet.
   */
  const nochmal = useCallback((): void => {
    const id = tischId;
    setTischId(null);
    setWartesaal(null);
    setMenue('start');
    if (id) void api.leaveTable(id).catch(() => {});
    void starteSuche();
  }, [tischId, starteSuche]);

  /* Mitspielerzahl im Menue und waehrend der Suche — am Schluessel `sichtDa`. */
  useEffect(() => {
    if (sichtDa) return;
    let lebt = true;
    const hole = (): void => {
      void api
        .aktiveSpieler('tafelrunde')
        .then((antwort) => {
          if (lebt) setAktiv(antwort.aktiv);
        })
        .catch(() => {
          /* Beiwerk. */
        });
    };
    hole();
    const takt = window.setInterval(hole, 5000);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [sichtDa]);

  return {
    tischId,
    suchstand,
    menue,
    setMenue: (m: Menue) => {
      setFehler(null);
      setMenue(m);
    },
    wartesaal,
    setWartesaal,
    startet,
    aktiv,
    fehler,
    starteSuche,
    brichSucheAb,
    starteBots,
    erstelleTisch,
    treteBeiPerCode,
    treteBeiTisch,
    brichAb,
    nochmal,
    formular: {
      sitze,
      setSitze,
      oeffentlich,
      setOeffentlich,
      botsFuellen,
      setBotsFuellen,
      botStufe,
      setBotStufe,
    },
    beitreten: { code, setCode, codeFertig, vorschau, offeneTische },
  };
}
