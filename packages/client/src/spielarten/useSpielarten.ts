import { useCallback, useEffect, useState } from 'react';

import { spielartenApi, type Spielart } from '../api';

/**
 * Die Spielarten eines Spiels vom Server und die gewaehlte davon.
 *
 * Die Liste kommt aus dem Modul (`GameMeta.spielarten`) — der Client schreibt
 * keinen Regelsatz ab. Die Wahl ist eine Vorwahl fuer den naechsten Tisch und
 * wird im Browser gemerkt (wie die Spielart bei Farbduell): Wer gestern
 * „Hart" gespielt hat, will das meistens wieder. Fehlt die gemerkte Kennung
 * in der Liste (Spielart entfernt), gilt die erste — die Vorgabe des Moduls.
 */
export interface Spielartwahl {
  /** null, solange die Antwort aussteht; leer fuer ein Spiel ohne Spielarten. */
  readonly spielarten: readonly Spielart[] | null;
  /** Die gewaehlte, oder null ohne Spielarten (bzw. vor der Antwort). */
  readonly gewaehlt: Spielart | null;
  readonly waehle: (id: string) => void;
  /** Der Ruf ist fehlgeschlagen — der Bildschirm zeigt dann den Einstieg ohne Karten. */
  readonly fehler: boolean;
}

const merkKey = (gameId: string): string => `spielart.${gameId}`;

function gemerkt(gameId: string): string | null {
  try {
    return localStorage.getItem(merkKey(gameId));
  } catch {
    return null;
  }
}

/** Die Spielart, die bei leerer oder unbekannter Wahl gilt: die erste. */
export function wirksameSpielart(liste: readonly Spielart[], id: string | null): Spielart | null {
  return liste.find((a) => a.id === id) ?? liste[0] ?? null;
}

export function useSpielarten(gameId: string): Spielartwahl {
  const [spielarten, setSpielarten] = useState<readonly Spielart[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [id, setId] = useState<string | null>(() => gemerkt(gameId));

  useEffect(() => {
    let lebt = true;
    setSpielarten(null);
    setFehler(false);
    setId(gemerkt(gameId));
    spielartenApi
      .liste(gameId)
      .then((antwort) => {
        if (lebt) setSpielarten(antwort.spielarten);
      })
      .catch(() => {
        if (!lebt) return;
        setSpielarten([]);
        setFehler(true);
      });
    return () => {
      lebt = false;
    };
  }, [gameId]);

  const waehle = useCallback(
    (neu: string): void => {
      setId(neu);
      try {
        localStorage.setItem(merkKey(gameId), neu);
      } catch {
        /* Gesperrte Seitendaten: Die Wahl gilt trotzdem, nur nicht morgen. */
      }
    },
    [gameId],
  );

  return {
    spielarten,
    gewaehlt: spielarten ? wirksameSpielart(spielarten, id) : null,
    waehle,
    fehler,
  };
}
