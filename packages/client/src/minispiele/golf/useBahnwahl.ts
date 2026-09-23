/**
 * Die Bahnauswahl am Tisch: Lobbydaten holen, den Regelsatz des Tisches
 * lesen, die Wahl von Sitz 0 an den Server geben (seit dem 22.09.2026).
 *
 * Getrennt von `Bahnauswahl.tsx`, weil hier `api` hereinkommt — das Bauteil
 * selbst soll ohne Server zu zeigen sein.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../../api';
import {
  type Bahnwahl,
  type Lobbydaten,
  gleicheWahl,
  liesLobbydaten,
  regelnAusWahl,
  wahlAusRegeln,
  wahlUnfertig,
} from './bahnwahl';
import { type Golfmodus, modusAus } from './modifikator';

export interface Lobbystand {
  /** Kurse und Themen vom Modul; `null`, solange sie fehlen — dann gibt es nur Zufall. */
  daten: Lobbydaten | null;
  /** Der Regelsatz des Moduls, auf den eine Wahl für einen neuen Tisch aufsetzt. */
  vorgabe: Record<string, unknown>;
}

const LEER: Lobbystand = { daten: null, vorgabe: {} };
let zwischen: Promise<Lobbystand> | null = null;

/**
 * Einmal je Seitenaufruf: Die Daten ändern sich nur mit einem Deploy. Ein
 * Fehlschlag wird nicht gemerkt — der nächste Aufbau fragt noch einmal.
 */
function holeLobby(): Promise<Lobbystand> {
  if (zwischen === null) {
    zwischen = Promise.resolve()
      .then(() => api.defaults('golf'))
      .then((antwort) => ({
        daten: liesLobbydaten(antwort?.lobby),
        vorgabe: (antwort?.config ?? {}) as Record<string, unknown>,
      }))
      .catch(() => {
        zwischen = null;
        return LEER;
      });
  }
  return zwischen;
}

export function useGolfLobby(): Lobbystand {
  const [stand, setStand] = useState<Lobbystand>(LEER);
  useEffect(() => {
    let lebt = true;
    void holeLobby().then((s) => {
      if (lebt) setStand(s);
    });
    return () => {
      lebt = false;
    };
  }, []);
  return stand;
}

/** So lange nach dem letzten Tipp wird gesendet — sonst wäre jeder Tipp einer Einzelauswahl eine neue Regelsatzversion. */
const SENDEVERZUG_MS = 350;

/**
 * Wahl und Regelsatz eines wartenden Tisches.
 *
 * Wahrheit ist der Regelsatz des Tisches: Er wird neu geholt, sobald sich
 * der `regelstand` der Tischnachricht ändert — so sehen alle in der Gruppe,
 * was Sitz 0 eingestellt hat. Sitz 0 sieht während des Einstellens seine
 * eigene Wahl (`lokal`), damit ein Tipp nicht erst nach der Runde über den
 * Server aufleuchtet.
 *
 * `bereitZumStart` MUSS vor dem Start aufgerufen werden: Es schickt eine
 * noch wartende Wahl sofort. Der Server arbeitet die Nachrichten einer
 * Verbindung der Reihe nach ab (`kette` im Gateway), die Wahl kommt also vor
 * dem Start an — sonst startete die Partie mit dem alten Regelsatz.
 */
export function useTischBahnwahl({
  tischId,
  regelstand,
  setRules,
  daten,
}: {
  tischId: string | null;
  regelstand: string | undefined;
  setRules: ((config: Record<string, unknown>) => void) | undefined;
  daten: Lobbydaten | null;
}): {
  wahl: Bahnwahl;
  setzeWahl: (wahl: Bahnwahl) => void;
  bereitZumStart: () => void;
  /** Die Spielart im Regelsatz des Tisches (seit dem 23.09.2026, Fun-Modus). */
  modus: Golfmodus;
  /** Sitz 0 stellt die Spielart ein — sofort, ohne Sendeverzug: ein Tipp, eine Wahl. */
  setzeModus: (modus: Golfmodus) => void;
} {
  const [regeln, setRegeln] = useState<Record<string, unknown> | null>(null);
  const [lokal, setLokal] = useState<Bahnwahl | null>(null);
  const ausstehend = useRef<Bahnwahl | null>(null);
  const uhr = useRef<number | null>(null);

  useEffect(() => {
    setRegeln(null);
    setLokal(null);
    ausstehend.current = null;
  }, [tischId]);

  useEffect(() => {
    if (tischId === null) return;
    let lebt = true;
    void Promise.resolve()
      .then(() => api.tableRules(tischId))
      .then((antwort) => {
        if (!lebt) return;
        setRegeln(antwort?.config ?? {});
        // Der Server hat nachgezogen: Ab hier zeigt auch Sitz 0 wieder, was
        // wirklich gilt — ausser er tippt gerade oder die Auswahl ist unfertig.
        if (ausstehend.current === null) setLokal((l) => (l !== null && wahlUnfertig(l) !== null ? l : null));
      })
      .catch(() => {
        /* Älterer Server oder kurz weg: Es bleibt, was angezeigt ist. */
      });
    return () => {
      lebt = false;
    };
  }, [tischId, regelstand]);

  useEffect(
    () => () => {
      if (uhr.current !== null) window.clearTimeout(uhr.current);
    },
    [],
  );

  const regelnRef = useRef(regeln);
  regelnRef.current = regeln;
  const datenRef = useRef(daten);
  datenRef.current = daten;
  const setRulesRef = useRef(setRules);
  setRulesRef.current = setRules;

  const sende = useCallback((wahl: Bahnwahl): void => {
    if (wahlUnfertig(wahl) !== null) return;
    const bisher = regelnRef.current ?? {};
    if (gleicheWahl(wahl, wahlAusRegeln(bisher)) && regelnRef.current !== null) return;
    setRulesRef.current?.(regelnAusWahl(wahl, bisher, datenRef.current));
  }, []);

  const setzeWahl = useCallback(
    (wahl: Bahnwahl): void => {
      setLokal(wahl);
      ausstehend.current = wahl;
      if (uhr.current !== null) window.clearTimeout(uhr.current);
      uhr.current = window.setTimeout(() => {
        uhr.current = null;
        const w = ausstehend.current;
        ausstehend.current = null;
        if (w !== null) sende(w);
      }, SENDEVERZUG_MS);
    },
    [sende],
  );

  /*
   * Die Spielart geht über denselben Regelsatz wie die Bahnwahl, aber als
   * eigenes Feld: `regelnAusWahl` behält fremde Felder (`...rest`), eine
   * spätere Bahnwahl nimmt `modus` also mit. Damit das auch gilt, bevor der
   * Server nachgezogen hat, schreibt der Tipp den Regelsatz hier gleich mit —
   * sonst ginge eine Bahnwahl kurz danach mit dem alten Regelsatz raus und
   * nähme den Fun-Modus wieder weg. Klassisch heißt: Feld weg, wie ein
   * Regelsatz von davor.
   */
  const setzeModus = useCallback((modus: Golfmodus): void => {
    const bisher = regelnRef.current ?? {};
    if (modusAus(bisher.modus) === modus && regelnRef.current !== null) return;
    const { modus: _alt, ...rest } = bisher;
    const neu: Record<string, unknown> = modus === 'fun' ? { ...rest, modus: 'fun' } : rest;
    regelnRef.current = neu;
    setRegeln(neu);
    setRulesRef.current?.(neu);
  }, []);

  const bereitZumStart = useCallback((): void => {
    if (uhr.current !== null) window.clearTimeout(uhr.current);
    uhr.current = null;
    const w = ausstehend.current;
    ausstehend.current = null;
    if (w !== null) sende(w);
  }, [sende]);

  return {
    wahl: lokal ?? wahlAusRegeln(regeln),
    setzeWahl,
    bereitZumStart,
    modus: modusAus(regeln?.modus),
    setzeModus,
  };
}
