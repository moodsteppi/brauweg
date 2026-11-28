import { useCallback, useEffect, useRef, useState } from 'react';

import { api, type Suchstand } from '../api';

/**
 * Die Mitspielersuche eines Spiels — derselbe Ablauf wie bei Farbduell
 * (screens/Filler.tsx), herausgeloest fuer den Spieleinstieg aller Spiele.
 *
 * Gesucht wird ueber die Schlange des Servers (`POST /api/suche/:gameId`)
 * mit der `config` der gewaehlten Spielart: Die Schlange topft nach
 * `config.variante`, wer „Hart" sucht, landet also nicht an einem
 * Anfaengertisch. Nach 30 Sekunden setzt der Server alle Gefundenen an EINEN
 * Tisch und fuellt den Rest mit Bots.
 *
 * Abgefragt wird jede Sekunde: Daneben laeuft ein Countdown, und der Abruf ist
 * zugleich das Lebenszeichen — hoert er auf, faellt man aus der Schlange.
 */
const SUCH_TAKT_MS = 1000;

export interface Schnellsuche {
  /** Stand der Suche; null heisst: es wird nicht gesucht. */
  readonly suchstand: Suchstand | null;
  /** Ein Knopf ist gedrueckt, die Antwort steht noch aus. */
  readonly startet: boolean;
  /** Fehler als Uebersetzungsschluessel, oder null. */
  readonly fehler: string | null;
  readonly starte: (config: unknown) => Promise<void>;
  readonly brichAb: () => void;
}

export function useSchnellsuche(gameId: string, onTisch: (tischId: string) => void): Schnellsuche {
  const [suchstand, setSuchstand] = useState<Suchstand | null>(null);
  const [startet, setStartet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Als Ref: Der Takt soll nicht neu aufgesetzt werden, nur weil der Aufrufer
  // bei jedem Zeichnen eine neue Funktion uebergibt.
  const aufTisch = useRef(onTisch);
  aufTisch.current = onTisch;

  const starte = useCallback(
    async (config: unknown): Promise<void> => {
      setFehler(null);
      setStartet(true);
      try {
        const stand = await api.sucheStarten(gameId, config);
        if (stand.tischId) aufTisch.current(stand.tischId);
        else setSuchstand(stand);
      } catch {
        setFehler('einstieg.suche.fehler');
      } finally {
        setStartet(false);
      }
    },
    [gameId],
  );

  /*
   * Am SCHLUESSEL `suchstand !== null` und nicht am Objekt: Jeder Takt setzt
   * einen neuen Stand, und mit dem Objekt in der Liste raeumte der Effekt
   * seinen eigenen Zeitgeber ab (CLAUDE.md).
   */
  const suchtGerade = suchstand !== null;
  useEffect(() => {
    if (!suchtGerade) return;
    let lebt = true;
    const takt = window.setInterval(() => {
      void api
        .sucheStand(gameId)
        .then((stand) => {
          if (!lebt) return;
          if (stand.tischId) {
            setSuchstand(null);
            aufTisch.current(stand.tischId);
            return;
          }
          if (!stand.sucht) {
            // Die Schlange kennt uns nicht mehr (etwa nach einem Neustart).
            setSuchstand(null);
            setFehler('einstieg.suche.beendet');
            return;
          }
          setSuchstand(stand);
        })
        .catch(() => {
          /* Ein einzelner Fehlversuch ist kein Abbruch. */
        });
    }, SUCH_TAKT_MS);
    return () => {
      lebt = false;
      window.clearInterval(takt);
    };
  }, [suchtGerade, gameId]);

  /* Den Bildschirm verlassen heisst die Suche verlassen — sonst saesse man
     womoeglich an einem Tisch, den niemand mehr ansieht. */
  const suchtRef = useRef(false);
  suchtRef.current = suchtGerade;
  useEffect(
    () => () => {
      if (suchtRef.current) void api.sucheAbbrechen(gameId).catch(() => {});
    },
    [gameId],
  );

  const brichAb = useCallback((): void => {
    setSuchstand(null);
    void api.sucheAbbrechen(gameId).catch(() => {});
  }, [gameId]);

  return { suchstand, startet, fehler, starte, brichAb };
}
