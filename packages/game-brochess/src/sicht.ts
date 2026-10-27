/**
 * Was ein Sitz von der Partie sieht.
 *
 * Beim Schach ist das alles: Es gibt nichts Verdecktes, Spieler und
 * Zuschauer sehen dasselbe Brett. Die Trennung von `sichtFuer` und
 * `zuschauerSicht` bleibt trotzdem, weil nur der Sitz eine eigene Farbe hat
 * — und weil der Bot laut game-api nie auf einer Zuschauersicht laufen
 * darf.
 *
 * Die Wiederholungszaehlung geht NICHT mit: Sie ist Buchhaltung des Servers,
 * und der Bildschirm braucht sie fuer nichts, was er zeigt.
 */

import { type Farbe, imSchach, materialStand, vorabZiele, zuFen } from './brett.js';
import { type BroChessPartie, type Ende, farbeVonSitz } from './partie.js';
import { zeitkontrolle } from './regeln.js';

export interface BroChessSicht {
  readonly zuschauer: boolean;
  /**
   * Die Stellung als FEN. Der Bildschirm liest `brett`; die FEN ist fuer den
   * Bot da, der laut game-api nur die Sicht bekommt und daraus seine
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
  /** Gespielte Zuege in Kurzschrift (SAN), ab dem ersten. */
  readonly verlauf: readonly string[];
  /**
   * Schachuhr oder null. `restMs` je Sitz steht auf dem Stand vor dem
   * laufenden Zug; fuer den Sitz am Zug zaehlt der Bildschirm von
   * `turnDeadline` herunter (die Plattform setzt sie aufs Ende seines Kontos).
   */
  readonly uhr: {
    readonly restMs: readonly number[];
    readonly bedenkzeitMs: number;
    readonly zuschlagMs: number;
  } | null;
  /** Vom Brett genommene Figuren je Farbe (Kleinbuchstaben, staerkste zuerst). */
  readonly geschlagen: { readonly w: readonly string[]; readonly b: readonly string[] };
  /** Materialvorsprung von Weiss; negativ, wenn Schwarz vorn liegt. */
  readonly vorsprung: number;
  /**
   * Ziele fuer einen Vorab-Zug (Premove), Feld → Felder. Nur fuer den Sitz,
   * der gerade NICHT am Zug ist; sonst leer. Die Gangart rechnet das Modul
   * (vorabZiele in brett.ts), ob der Zug dann geht, sagt `legalActions`.
   */
  readonly vorab: Readonly<Record<string, readonly string[]>>;
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
    verlauf: partie.verlauf,
    uhr: (() => {
      const kontrolle = zeitkontrolle(partie.regeln);
      return partie.uhr && kontrolle ? { restMs: partie.uhr.restMs, ...kontrolle } : null;
    })(),
    ...materialStand(partie.stellung.brett),
    vorab:
      meineFarbe !== null && partie.ende === null && partie.stellung.amZug !== meineFarbe
        ? vorabZiele(partie.stellung, meineFarbe)
        : {},
  };
}

export function sichtFuer(partie: BroChessPartie, sitz: number): BroChessSicht {
  return sicht(partie, farbeVonSitz(partie, sitz));
}

export function zuschauerSicht(partie: BroChessPartie): BroChessSicht {
  return sicht(partie, null);
}
