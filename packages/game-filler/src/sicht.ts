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
import { moeglicheBarrieren, nachbarn, sieger } from './partie.js';
import { type FillerVariante, liegtOffen } from './regeln.js';

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
  /**
   * Gesetzte Barrieren als Plaetzepaare. Oeffentlich in jeder Sicht: Eine Wand
   * steht sichtbar auf dem Brett, sie zu verstecken waere kein Geheimnis,
   * sondern eine Falle.
   *
   * Auch in der Spielart `nebel` ginge das — dort gibt es nur keine.
   */
  readonly barrieren: readonly (readonly [number, number])[];
  /** Wie viele Barrieren jedem Sitz noch bleiben. */
  readonly barrierenUebrig: Readonly<Record<number, number>>;
  /**
   * Wohin DIESER Sitz gerade eine Barriere setzen duerfte.
   *
   * Sie steht in der Sicht, damit der Client die Einsperr-Regel nicht
   * nachbaut (CLAUDE.md: "Der Client bildet keine Regel nach"). Sie zu
   * rechnen heisst, je Kante einmal ueber das Brett zu laufen — deshalb steht
   * sie nur da, wenn sie gebraucht wird: in der Spielart `build`, beim Sitz
   * am Zug, solange er noch Barrieren hat.
   */
  readonly barrierenMoeglich?: readonly (readonly [number, number])[];
  /**
   * Plaetze der Sternfelder. Oeffentlich in jeder Sicht, auch im Nebel —
   * dort gibt es nur keine. Der Client malt den Stern auf das Feld; was das
   * Feld bringt, rechnet das Modul (siehe STERN_BONUS in partie.ts).
   */
  readonly sterne: readonly number[];
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
  if (liegtOffen(partie.regeln.variante)) return partie.besitzer.map(() => true);
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
    barrieren: partie.barrieren.map((k) => {
      const [a, b] = k.split(':');
      return [Number(a), Number(b)] as const;
    }),
    barrierenUebrig: partie.barrierenUebrig,
    sterne: partie.sterne,
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
  const moeglich =
    !partie.fertig && partie.dran === sitz ? moeglicheBarrieren(partie, sitz) : [];
  return {
    ...grundsicht(partie, sitz),
    feld: partie.feld.map((f, platz) => (sichtbar[platz] ? f : null)),
    besitzer: partie.besitzer.map((b, platz) => (sichtbar[platz] ? b : null)),
    // Leere Liste weglassen statt mitschicken: Ein Feld, das in den meisten
    // Sichten nie etwas bedeutet, laedt zum Fehlschluss "es gibt hier keine
    // Barrieren" ein — dabei heisst es nur "du kannst gerade keine setzen".
    ...(moeglich.length > 0 ? { barrierenMoeglich: moeglich } : {}),
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
  const offen = liegtOffen(partie.regeln.variante);
  return {
    ...grundsicht(partie, null),
    feld: partie.feld.map((f, platz) =>
      offen || partie.besitzer[platz] !== null ? f : null,
    ),
    besitzer: partie.besitzer,
  };
}
