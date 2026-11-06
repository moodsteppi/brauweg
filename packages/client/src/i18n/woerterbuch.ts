/**
 * Ein Bereich eines Wörterbuchs: Schlüssel → fertiger Text.
 *
 * Eigene Datei, damit die Bereichsdateien (`de/*.ts`, `en/*.ts`) nur einen
 * Typ importieren und nicht den Kern samt Spracherkennung — sonst hingen
 * Wörterbuch und Kern im Kreis aneinander.
 */
export type Woerterbuch = Record<string, string>;
