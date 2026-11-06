/**
 * Was ein Sitz von der Partie sieht.
 *
 * Offen liegen alle Pinguine, der Ablagestapel und der letzte Zug. Verdeckt
 * bleiben die fremden Haende (nur ihre Groesse) und der Nachziehstapel (nur
 * seine Hoehe). Zuschauer sehen gar keine Hand.
 */

import type { Karte, KartenArt } from './karten.js';
import { type DreckBroPartie, type Ende, type LetzterZug, type Pinguin, amZug } from './partie.js';
import { ZUG_GRENZE } from './regeln.js';

export interface DreckBroSicht {
  readonly zuschauer: boolean;
  /** Eigener Sitz; null fuer Zuschauer. */
  readonly meinSitz: number | null;
  readonly sitze: number;
  readonly amZug: number | null;
  /** Je Sitz die drei Pinguine, offen fuer alle. */
  readonly pinguine: readonly (readonly Pinguin[])[];
  /** Die eigene Hand; leer fuer Zuschauer. */
  readonly hand: readonly Karte[];
  readonly handAnzahl: readonly number[];
  readonly stapel: number;
  /** Oberste Karte der Ablage. */
  readonly ablage: KartenArt | null;
  readonly letzterZug: LetzterZug | null;
  readonly ende: Ende | null;
  readonly zuege: number;
  /**
   * Nach so vielen Zuegen pfeift die Partie ab (`ZUG_GRENZE`). Steht in der
   * Sicht, damit der Tisch die Zahl im Abpfiff-Text nicht abschreibt — eine
   * feste 400 im Client stimmte nach der ersten geaenderten Konstante nicht mehr.
   */
  readonly zugGrenze: number;
}

function sicht(partie: DreckBroPartie, sitz: number | null): DreckBroSicht {
  return {
    zuschauer: sitz === null,
    meinSitz: sitz,
    sitze: partie.sitze,
    amZug: amZug(partie),
    pinguine: partie.pinguine,
    hand: sitz === null ? [] : partie.haende[sitz]!,
    handAnzahl: partie.haende.map((h) => h.length),
    stapel: partie.stapel.length,
    ablage: partie.ablage.at(-1)?.art ?? null,
    letzterZug: partie.letzterZug,
    ende: partie.ende,
    zuege: partie.zuege,
    zugGrenze: ZUG_GRENZE,
  };
}

export function sichtFuer(partie: DreckBroPartie, sitz: number): DreckBroSicht {
  return sicht(partie, sitz);
}

export function zuschauerSicht(partie: DreckBroPartie): DreckBroSicht {
  return sicht(partie, null);
}
