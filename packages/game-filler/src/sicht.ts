/**
 * Die gefilterte Sicht — und damit die ganze Abwandlung dieses Spiels.
 *
 * Im Vorbild liegt das Brett offen. Hier sieht ein Spieler nur das EIGENE
 * Gebiet und die Felder, die daran grenzen; alles andere bleibt grau. Das ist
 * kein Anzeigetrick: Die Farben stehen gar nicht erst in der Nachricht, die
 * an den Client geht (game-api, Grundsatz 2). Wer die Entwicklerkonsole
 * aufmacht, findet dort `null` — sonst waere die Abwandlung an dem Tag
 * erledigt, an dem der Erste nachsieht.
 *
 * Was ABSICHTLICH mitgeht:
 *
 *   - `grau`: der Farbton, in dem ein verdecktes Feld gezeichnet wird. Er ist
 *     unabhaengig aus der Saat gezogen (siehe partie.ts) und verraet nichts.
 *     Ohne ihn waere der Nebel eine Flaeche statt eines Rasters.
 *   - `farbe` je Sitz: Die Regel "die Farbe des Gegners ist gesperrt" laesst
 *     sich nicht befolgen, ohne sie zu kennen. Im Vorbild steht sie als
 *     ausgegrautes Feld unter dem Brett, hier genauso.
 *   - `punkte` je Sitz: Der Punktestand steht im Vorbild oben ueber dem
 *     Brett. Er sagt, WIE VIELE Felder der Gegner haelt, nicht welche.
 */

import type { FillerPartie } from './partie.js';
import { nachbarn, sieger } from './partie.js';
import type { FillerVariante } from './regeln.js';

export interface FillerSicht {
  /**
   * Der eigene Sitz, oder null fuer Zuschauer.
   *
   * Steht in der Sicht und nicht nur in der Nachrichtenhuelle
   * (`ViewMessage.seat`), weil der BOT nichts als die Sicht bekommt
   * (`botAction` in game-api). Ohne diese Zahl wuesste er nicht, welche
   * Felder seine sind, und koennte nicht einmal anfangen zu rechnen. Ein Leck
   * ist es nicht: Die eigene Sitznummer kennt man ohnehin.
   */
  readonly ich: number | null;
  readonly spalten: number;
  readonly zeilen: number;
  readonly farbzahl: number;
  /**
   * Spielart dieses Tisches.
   *
   * Der Client zeichnet in beiden Faellen dasselbe — was er nicht weiss,
   * malt er grau —, aber er soll es BENENNEN koennen ("Nebel" am Kopf des
   * Bretts). Und ohne dieses Feld liesse sich nach einem Neuladen nicht mehr
   * sagen, an welchem Tisch man eigentlich sitzt.
   */
  readonly variante: FillerVariante;
  /** Farbnummer je Platz — nur fuer sichtbare Plaetze, sonst null. */
  readonly feld: readonly (number | null)[];
  /** Grauton je Platz, fuer die Zeichnung verdeckter Felder. */
  readonly grau: readonly number[];
  /** Wem ein Platz gehoert — nur fuer sichtbare Plaetze, sonst null. */
  readonly besitzer: readonly (number | null)[];
  /** Gebietsfarbe je Sitz. Oeffentlich, siehe oben. */
  readonly farbe: Readonly<Record<number, number>>;
  readonly punkte: Readonly<Record<number, number>>;
  readonly dran: number;
  readonly zug: number;
  readonly fertig: boolean;
  readonly sieger: number | null;
  readonly leftSeats: readonly number[];
  /** true = neutrale Zuschauersicht. */
  readonly zuschauer: boolean;
}

/**
 * Sichtbar ist ein Platz, wenn er mir gehoert oder an eines meiner Felder
 * grenzt.
 *
 * "Grenzt" heisst orthogonal, genau wie beim Schlucken. Diagonal mitzuzeigen
 * waere kein Fehler in der Anzeige, sondern in der Regel: Man saehe Felder,
 * die man in diesem Zug gar nicht erreichen kann.
 */
function sichtbareplaetze(partie: FillerPartie, sitz: number): boolean[] {
  const { spalten, zeilen } = partie.regeln;
  /*
   * Offene Spielart: alles sichtbar. Das ist der EINZIGE Unterschied zwischen
   * den beiden Modi — Regeln, Zuege, Bot und Brettaufbau sind identisch. Wer
   * hier einen zweiten Unterschied einbaut, hat zwei Spiele statt einem.
   */
  if (partie.regeln.variante === 'klar') return partie.besitzer.map(() => true);
  const sichtbar = partie.besitzer.map((b) => b === sitz);
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] !== sitz) continue;
    for (const n of nachbarn(platz, spalten, zeilen)) sichtbar[n] = true;
  }
  return sichtbar;
}

function grundsicht(
  partie: FillerPartie,
  ich: number | null,
): Omit<FillerSicht, 'feld' | 'besitzer'> {
  return {
    ich,
    spalten: partie.regeln.spalten,
    zeilen: partie.regeln.zeilen,
    farbzahl: partie.regeln.farben,
    variante: partie.regeln.variante,
    grau: partie.grau,
    farbe: partie.farbe,
    punkte: partie.punkte,
    dran: partie.dran,
    zug: partie.zug,
    fertig: partie.fertig,
    sieger: sieger(partie),
    leftSeats: partie.leftSeats,
    zuschauer: ich === null,
  };
}

/**
 * Sicht eines Sitzes.
 *
 * Anders als bei einem Kartenspiel unterscheiden sich die beiden Sichten
 * nicht in der Hand, sondern im AUSSCHNITT: Jeder sieht seinen eigenen Rand.
 * Am Ende der Partie faellt der Nebel — dann gehoert jedes Feld jemandem, und
 * jedes Feld grenzt an ein eigenes oder ist eines.
 */
export function sichtFuer(partie: FillerPartie, sitz: number): FillerSicht {
  const sichtbar = sichtbareplaetze(partie, sitz);
  return {
    ...grundsicht(partie, sitz),
    feld: partie.feld.map((f, platz) => (sichtbar[platz] ? f : null)),
    besitzer: partie.besitzer.map((b, platz) => (sichtbar[platz] ? b : null)),
  };
}

/**
 * Zuschauersicht.
 *
 * Sie zeigt die BESITZVERHAELTNISSE vollstaendig — man soll den Gebieten beim
 * Wachsen zusehen koennen —, aber von keinem freien Feld die Farbe. Genau die
 * ist das Geheimnis der Partie, und ein Zuschauer mit Fernblick waere ein
 * perfekter Komplize: Er muesste einem Spieler nur sagen, welche Farbe hinter
 * seinem Rand liegt.
 *
 * Dass die Gebietsformen dabei sichtbar werden, ist der bewusst in Kauf
 * genommene Rest. Sie sagen nur, wo nichts mehr zu holen ist — und wie gross
 * sie sind, steht ohnehin als Punktzahl ueber dem Brett.
 */
export function zuschauerSicht(partie: FillerPartie): FillerSicht {
  // In der offenen Spielart gibt es nichts zu verbergen: Dort liegt das Brett
  // fuer die Spieler ohnehin offen, ein Zuschauer erfaehrt also nichts, was
  // nicht schon beide wissen.
  const offen = partie.regeln.variante === 'klar';
  return {
    ...grundsicht(partie, null),
    feld: partie.feld.map((f, platz) =>
      offen || partie.besitzer[platz] !== null ? f : null,
    ),
    besitzer: partie.besitzer,
  };
}
