import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from './api';

/**
 * Den Regelsatz eines Spielmoduls beim Server holen, statt ihn abzuschreiben.
 *
 * WARUM ES DAS GIBT: Wer beim Tischanlegen eine `config` mitschickt,
 * UEBERSTIMMT das Modul — der Server schreibt sie unveraendert als Regelsatz
 * des Tisches fest (packages/server/src/tables/service.ts). Solange ein
 * Bildschirm die Vorgabezahlen also selbst ausschreibt, laeuft jeder echte
 * Tisch mit seiner Abschrift weiter, wenn im Modul eine Zahl umgestellt wird;
 * rot wird dabei nichts. Genau das ist Tafelrunde beinahe zweimal passiert
 * (siehe CLAUDE.md, Abschnitt „Was das Modul weiss, schreibt der Client
 * nicht ab").
 *
 * Ein Bildschirm, der GAR NICHTS einstellen laesst, laesst `config` einfach
 * weg — dann nimmt der Server `defaultConfig()`. Filler, Eiland und Mememory
 * koennen das nicht: Sie legen eine Wahl des Nutzers obendrauf (`variante`
 * bzw. `zusatz`/`botStufen`) und brauchen deshalb den Rest des Regelsatzes.
 * Fuer sie ist der Weg: die Vorgabe beim Oeffnen des Menues VORAB holen und
 * die Wahl darauf legen.
 *
 * Vorab, weil der Knopf sonst auf eine zusaetzliche Antwort warten muesste,
 * bevor er den Tisch aufmacht — das war der urspruengliche Grund fuer die
 * Abschriften. Der Effekt laeuft beim Aufbau des Bildschirms; bis jemand die
 * Spielart gewaehlt und getippt hat, liegt die Antwort laengst vor.
 *
 * Kommt sie doch nicht rechtzeitig, WARTET der Knopf statt zu raten: Eine
 * eingebaute Ersatzzahl waere wieder eine Abschrift, und zwar eine, die nur
 * im Fehlerfall greift und die deshalb niemand je bemerkt. Schlaegt der Ruf
 * fehl, schlaegt das Tischanlegen mit derselben Meldung fehl wie jeder andere
 * Netzfehler auch.
 */
export interface Spielvorgabe {
  /**
   * Den Regelsatz holen — aus dem Gedaechtnis, sonst vom Server. Wartet, wenn
   * der Vorab-Ruf noch laeuft, und schickt keine zweite Anfrage los.
   */
  readonly holen: () => Promise<Record<string, unknown>>;
  /**
   * Derselbe Regelsatz zum ANZEIGEN, sobald er da ist — vorher `null`.
   *
   * Getrennt vom Holen, weil eine Vorschau nicht warten kann: Sie zeichnet
   * beim ersten Aufbau schon einmal ohne und noch einmal, wenn die Antwort
   * eintrifft. Wer nur einen Tisch aufmacht, braucht dieses Feld nicht.
   */
  readonly vorgabe: Record<string, unknown> | null;
}

export function useSpielVorgabe(gameId: string): Spielvorgabe {
  /*
   * Referenz UND Zustand: Die Referenz beantwortet den Klick ohne Umweg ueber
   * ein Neuzeichnen, der Zustand loest das Neuzeichnen der Vorschau aus.
   *
   * `laeuft` haelt die laufende Anfrage fest, damit ein Klick waehrend des
   * Vorab-Rufs nicht eine zweite ausloest.
   */
  const gehalten = useRef<Record<string, unknown> | null>(null);
  const laeuft = useRef<Promise<Record<string, unknown>> | null>(null);
  const [vorgabe, setVorgabe] = useState<Record<string, unknown> | null>(null);

  const holen = useCallback(async (): Promise<Record<string, unknown>> => {
    if (gehalten.current) return gehalten.current;
    if (!laeuft.current) {
      laeuft.current = api
        .defaults(gameId)
        .then((antwort) => {
          gehalten.current = antwort.config;
          setVorgabe(antwort.config);
          return antwort.config;
        })
        .finally(() => {
          laeuft.current = null;
        });
    }
    return laeuft.current;
  }, [gameId]);

  useEffect(() => {
    // Fehler hier bewusst schlucken: Der Vorab-Ruf hat keinen Bildschirm, auf
    // dem er sich beschweren koennte. Wer danach auf den Knopf drueckt,
    // bekommt die Meldung an der Stelle, an die sie gehoert.
    void holen().catch(() => {});
  }, [holen]);

  return { holen, vorgabe };
}

/** Eine Zahl aus einem Regelsatz lesen, den der Server als `unknown` liefert. */
export function zahlAus(
  vorgabe: Record<string, unknown> | null,
  feld: string,
  ersatz: number,
): number {
  const wert = vorgabe?.[feld];
  return typeof wert === 'number' ? wert : ersatz;
}
