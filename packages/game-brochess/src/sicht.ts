/**
 * Was ein Sitz von der Partie sieht.
 *
 * Beim Schach ist das alles: Es gibt nichts Verdecktes, Spieler und
 * Zuschauer sehen dasselbe Brett. Die Trennung von `sichtFuer` und
 * `zuschauerSicht` bleibt trotzdem, weil nur der Sitz eine eigene Farbe hat
 * — und weil der Ersatzbot laut game-api nie auf einer Zuschauersicht laufen
 * darf.
 *
 * Die Wiederholungszaehlung geht NICHT mit: Sie ist Buchhaltung des Servers,
 * und der Bildschirm braucht sie fuer nichts, was er zeigt.
 */

import { type Farbe, imSchach, zuFen } from './brett.js';
import { type BroChessPartie, type Ende, farbeVonSitz } from './partie.js';

export interface BroChessSicht {
  readonly zuschauer: boolean;
  /**
   * Die Stellung als FEN. Der Bildschirm liest `brett`; die FEN ist fuer den
   * Ersatzbot da, der laut game-api nur die Sicht bekommt und daraus seine
   * Zuege rechnen muss.
   */
  readonly fen: string;
  /** 64 Felder, a1 zuerst, Figuren in FEN-Schreibweise, '' ist leer. */
  readonly brett: readonly string[];
  readonly amZug: Farbe;
  /** Eigene Farbe, null fuer Zuschauer. */
  readonly meineFarbe: Farbe | null;
  readonly weissSitz: number;
  /** Steht die Seite am Zug im Schach? Auch bei Matt wahr. */
  readonly schach: boolean;
  readonly letzterZug: { readonly von: string; readonly nach: string } | null;
  readonly ende: Ende | null;
}

function sicht(partie: BroChessPartie, meineFarbe: Farbe | null): BroChessSicht {
  return {
    zuschauer: meineFarbe === null,
    fen: zuFen(partie.stellung),
    brett: partie.stellung.brett,
    amZug: partie.stellung.amZug,
    meineFarbe,
    weissSitz: partie.weissSitz,
    schach: imSchach(partie.stellung),
    letzterZug: partie.letzterZug,
    ende: partie.ende,
  };
}

export function sichtFuer(partie: BroChessPartie, sitz: number): BroChessSicht {
  return sicht(partie, farbeVonSitz(partie, sitz));
}

export function zuschauerSicht(partie: BroChessPartie): BroChessSicht {
  return sicht(partie, null);
}
