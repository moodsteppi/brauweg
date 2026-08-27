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
import type { MememoryStufe } from './stufen.js';

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
  /**
   * Wie viele Karten noch auf dem Stapel warten.
   *
   * Nur die ZAHL, nicht die Karten: Welche Motive dort liegen, steht ohnehin
   * schon in `motive` (das ist der Topf der ganzen Partie), aber in welcher
   * Reihenfolge sie kommen, geht niemanden etwas an — sonst wuesste man nach
   * dem Mischen, welche vier Paare neu dabei sind.
   */
  readonly vorrat: number;
  /**
   * Wie oft schon gemischt wurde. Der Client erkennt daran, dass das Brett
   * neu liegt, und spielt die Bewegung — auch nach einem Neuverbinden.
   */
  readonly mischung: number;
  readonly fertig: boolean;
  readonly sieger: number | null;
  readonly leftSeats: readonly number[];
  /** true = neutrale Zuschauersicht. */
  readonly zuschauer: boolean;
  /**
   * Spielstaerke dieses Sitzes — steht NUR in der Sicht eines Bot-Sitzes.
   *
   * `botAction` bekommt nichts als die Sicht, und die Stufe der Plattform
   * (`botLevel`) gilt fuer den ganzen Tisch. Damit spaeter drei Bots
   * verschiedener Staerke am selben Brett sitzen koennen, reist sie hier mit.
   */
  readonly stufe?: MememoryStufe;
  /**
   * Was dieser Bot behalten hat: Platz und Kennung, sonst nichts.
   *
   * **Und warum das kein Verrat ist.** Die Sicht traegt bewusst keine Liste
   * der schon gesehenen Karten (siehe oben) — hier steht sie trotzdem, aber
   * nur fuer Sitze, die in `regeln.botStufen` stehen. In diesem Spiel sieht
   * ohnehin JEDER jede umgedrehte Karte; die Liste enthaelt also nichts, was
   * nicht schon auf dem Tisch lag, und ein eigener Client koennte sie
   * mitschreiben (steht so in docs/MEMEMORY-PLAN.md). Was sie NICHT
   * enthaelt: verdeckte Karten. Die stehen nirgends ausser im Zustand.
   */
  readonly erinnerung?: readonly { readonly platz: number; readonly kennung: string }[];
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
    vorrat: partie.vorrat.length,
    mischung: partie.mischung,
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
export function sichtFuer(partie: MememoryPartie, sitz: number): MememorySicht {
  const stufe = partie.regeln.botStufen?.[sitz];
  if (!stufe) return grundsicht(partie, false);

  // Ein Bot-Sitz bekommt zusaetzlich sein Gedaechtnis. Plaetze, die inzwischen
  // jemandem gehoeren, fallen dabei heraus: Sie sind vom Brett, und ein Bot,
  // der sie noch mitfuehrt, verrechnet sich beim Meiden bekannter Felder.
  const erinnerung = (partie.erinnerung[sitz] ?? [])
    .filter((stueck) => partie.besitzer[stueck.platz] === null)
    .map((stueck) => ({ platz: stueck.platz, kennung: partie.motive[stueck.motiv] ?? '' }))
    .filter((stueck) => stueck.kennung !== '');

  return { ...grundsicht(partie, false), stufe, erinnerung };
}

/**
 * Zuschauersicht. Bei Mememory dieselbe Sicht wie die der Spieler — es gibt
 * kein Geheimnis, das ein Zuschauer weiterreichen koennte. Der Merker bleibt
 * trotzdem drin, damit ein Bot nie versehentlich darauf laeuft.
 */
export function zuschauerSicht(partie: MememoryPartie): MememorySicht {
  return grundsicht(partie, true);
}
