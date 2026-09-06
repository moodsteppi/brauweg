/*
 * Karten vormerken, ohne sie zu spielen.
 *
 * Beim Skat gibt es zwei Stellen, an denen genau zwei Karten gewählt werden,
 * bevor etwas passiert: das Drücken nach dem Skataufnehmen und das Schieben
 * beim Schieberamsch. Für beide liefert das Spielmodul absichtlich KEINE
 * Aktionsliste — `legalActions` ist dort leer, weil die Auswahl aus der Sicht
 * entsteht und nicht aus einer Aufzählung (dasselbe gilt beim Doppelkopf für
 * die Armut).
 *
 * Das heißt: Hier baut der Client eine Spielregel nach. Genau solche Stellen
 * gehören geprüft — sie sind die einzigen, an denen ein Fehler nicht vom
 * Server abgefangen wird.
 */

/** Wie viele Karten beim Drücken und Schieben gewählt werden. */
export const DRUECK_ANZAHL = 2;

/**
 * Eine Karte an- oder abwählen.
 *
 * Ist sie schon gewählt, fliegt sie raus — auch dann, wenn die Auswahl voll
 * ist. Das ist der Punkt, an dem eine naive Fassung („voll? dann nichts tun")
 * den Spieler festsetzt: Er hätte zwei falsche Karten gewählt und käme ohne
 * Umweg über einen Neuaufbau der Ansicht nicht mehr davon los.
 *
 * Ist sie nicht gewählt, kommt sie dazu, solange Platz ist. Bei voller
 * Auswahl bleibt alles, wie es ist — bewusst nicht „die älteste rausschieben":
 * Wer die dritte Karte antippt, hat sich meist vertan, und stillschweigend
 * eine andere abzuwählen wäre eine Entscheidung, die ihm gehört.
 */
export function waehleZumDruecken(
  gewaehlt: readonly number[],
  karte: number,
  hoechstens: number = DRUECK_ANZAHL,
): number[] {
  if (gewaehlt.includes(karte)) return gewaehlt.filter((x) => x !== karte);
  if (gewaehlt.length >= hoechstens) return [...gewaehlt];
  return [...gewaehlt, karte];
}

/**
 * Text für den Knopf, solange noch Karten fehlen.
 *
 * Steht hier, weil die Beugung („1 Karte", „2 Karten") schon einmal falsch
 * war und ein Text, den niemand prüft, genau so lange falsch bleibt, bis er
 * jemandem auffällt.
 */
export function fehlenText(gewaehlt: number, hoechstens: number = DRUECK_ANZAHL): string | null {
  const fehlen = hoechstens - gewaehlt;
  if (fehlen <= 0) return null;
  return `Noch ${fehlen} Karte${fehlen === 1 ? '' : 'n'} wählen`;
}
