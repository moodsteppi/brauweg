/**
 * Die gefilterte Sicht.
 *
 * Hier — und nur hier — entsteht die Sichtbarkeit (game-api, Grundsatz 2).
 * Bei einem Memory ist das die ganze Spielmechanik: Wer die verdeckten Motive
 * kennt, hat gewonnen. Deshalb geht fuer einen verdeckten Platz `null` raus
 * und nicht etwa das Motiv mit einem Merker "bitte nicht anzeigen".
 *
 * Was der Client zum Vorladen braucht, bekommt er trotzdem: `motive` nennt die
 * zwanzig Kennungen dieser Partie, SORTIERT. Die Menge zu kennen hilft beim
 * Laden und verraet nichts ueber die Lage — beim Aufdecken kann jedes der
 * uebrigen Motive kommen.
 *
 * Was ABSICHTLICH NICHT drinsteht: eine Liste der schon einmal umgedrehten
 * Karten. Sie waere oeffentliches Wissen (beide haben sie gesehen) und wuerde
 * den Bot spielstark machen — aber im Memory ist genau das Sich-Merken das
 * ganze Spiel. Wer sie mitschickte, liefe darauf hinaus, dass ein Skript mit
 * offener Entwicklerkonsole jede Partie gewinnt.
 */

import type { MememoryPartie, Pause } from './partie.js';
import { sieger } from './partie.js';

export interface MememorySicht {
  readonly spalten: number;
  readonly zeilen: number;
  /** Die Motive dieser Partie, sortiert. Grundlage des Vorladens. */
  readonly motive: readonly string[];
  /** Je Platz die Motivkennung — nur wenn offen oder besessen, sonst null. */
  readonly feld: readonly (string | null)[];
  readonly besitzer: readonly (number | null)[];
  readonly offen: readonly number[];
  readonly punkte: Readonly<Record<number, number>>;
  readonly namen: Readonly<Record<number, string>>;
  readonly dran: number;
  readonly pause: Pause | null;
  /** Damit der Client die Rueckdreh-Animation gleich lang laufen laesst. */
  readonly merkzeitMs: number;
  readonly fertig: boolean;
  readonly sieger: number | null;
  readonly leftSeats: readonly number[];
  /** true = neutrale Zuschauersicht. */
  readonly zuschauer: boolean;
}

function sichtbaresFeld(partie: MememoryPartie): readonly (string | null)[] {
  return partie.feld.map((motivNummer, platz) => {
    const sichtbar = partie.besitzer[platz] !== null || partie.offen.includes(platz);
    return sichtbar ? (partie.motive[motivNummer] ?? null) : null;
  });
}

function grundsicht(partie: MememoryPartie, zuschauer: boolean): MememorySicht {
  return {
    spalten: partie.regeln.spalten,
    zeilen: partie.regeln.zeilen,
    motive: partie.motive,
    feld: sichtbaresFeld(partie),
    besitzer: partie.besitzer,
    offen: partie.offen,
    punkte: partie.punkte,
    namen: partie.namen,
    dran: partie.dran,
    pause: partie.pause,
    merkzeitMs: partie.regeln.merkzeitMs,
    fertig: partie.fertig,
    sieger: sieger(partie),
    leftSeats: partie.leftSeats,
    zuschauer,
  };
}

/**
 * Sicht eines Sitzes.
 *
 * Sie ist fuer beide Sitze IDENTISCH — anders als bei einem Kartenspiel gibt
 * es keine eigene Hand. Genau das verlangt der Auftrag: Beide Geraete sehen
 * dieselbe Anordnung. Welcher Sitz man selbst ist, steht ohnehin schon in der
 * Nachrichtenhuelle (`ViewMessage.seat`), also wird es hier nicht doppelt
 * mitgeschickt.
 */
export function sichtFuer(partie: MememoryPartie, _sitz: number): MememorySicht {
  return grundsicht(partie, false);
}

/**
 * Zuschauersicht. Bei Mememory dieselbe Sicht wie die der Spieler — es gibt
 * kein Geheimnis, das ein Zuschauer weiterreichen koennte. Der Merker bleibt
 * trotzdem drin, damit ein Bot nie versehentlich darauf laeuft.
 */
export function zuschauerSicht(partie: MememoryPartie): MememorySicht {
  return grundsicht(partie, true);
}
