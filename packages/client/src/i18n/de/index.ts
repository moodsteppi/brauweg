/**
 * Das deutsche Wörterbuch: jede Datei dieses Ordners ein Bereich.
 *
 * Deutsch ist die Bezugssprache: Es legt fest, welche Bereiche und welche
 * Schlüssel es gibt. Jede andere Sprache wird in `i18n.test.ts` dagegen
 * gehalten — Bereich für Bereich, Datei gegen gleichnamige Datei.
 *
 * Hier wird nichts eingetragen: Die Dateien sammelt `import.meta.glob` selbst
 * ein (Begründung in `../bereiche.ts`). Ein neuer Bereich ist je Sprache
 * genau EINE neue Datei — keine Zeile in einer gemeinsamen Datei.
 *
 * Wer welchen Bereich übersetzt (Projekt „BroweGGames Language", jeder
 * Bereich genau EINER Aufgabe):
 *
 *   Bereich             | Aufgabe  | Inhalt
 *   --------------------+----------+------------------------------------------
 *   spiele              | 5d61f9ab | Hub: Spielnamen, Modi, Blätter
 *   fehler              | 5d61f9ab | Hub: Meldungen des Servers (`error.`)
 *   ware                | 5d61f9ab | Hub: Währungen, Truhen, Shop, Aufgaben, Weg
 *   einladung           | 5d61f9ab | Hub: Beitritt per Code
 *   regeln-allgemein    | 5d61f9ab | Hub: Kennungen, die mehrere Spiele melden
 *   tisch               | d89b6c50 | Doppelkopf: Phasen und Spielarten
 *   karten              | d89b6c50 | Doppelkopf: Farb- und Wertnamen
 *   regeln-doppelkopf   | d89b6c50 | Doppelkopf: Regeln, BOCK/PFLICHTANSAGE/…
 *   karten-zauberer     | 49536609 | Zauberer: Zauberer und Narr
 *   regeln-zauberer     | 49536609 | Zauberer
 *   regeln-skat         | fc73e53a | Skat
 *   regeln-cambio       | 64ba25df | Cambio
 *   regeln-poker        | 64ba25df | Poker
 *   golf                | b74f8cbc | Golf: Anzeigen
 *   regeln-golf         | b74f8cbc | Golf
 *   regeln-feldherr     | b74f8cbc | Feldherr
 *   regeln-eiland       | b74f8cbc | Eiland
 *   regeln-mememory     | b74f8cbc | Mememory
 *   regeln-brochess     | b74f8cbc | BroChess
 *   regeln-partykiste   | 8e6fc988 | Partykiste
 *   regeln-brocooked    | 8e6fc988 | BroCooked
 *   regeln-tafelrunde   | 8e6fc988 | Tafelrunde
 *   regeln-farbduell    | 4024e380 | Farbduell (game-filler)
 *   sprache             | d4599641 | Sprachgrundlage — schon vollständig
 *
 * `karten-zauberer` ist eine eigene Datei, damit die Zauberer-Aufgabe ihre
 * zwei Sonderkarten übersetzen kann, ohne `karten.ts` anzufassen.
 * Zahlen und Daten (dc192f47) sind kein Bereich, sondern `i18n/format.ts`
 * (siehe Kopf von `../sprachen.ts`).
 *
 * Texte, die heute noch fest im Bildschirm stehen, bekommen einen NEUEN
 * Bereich mit dem Namen des Spiels bzw. der Fläche der zuständigen Aufgabe —
 * `de/doppelkopf.ts` und `en/doppelkopf.ts`, `de/clan.ts` und `en/clan.ts`
 * usw. Solche neuen Bereiche werden in dieser Tabelle NICHT nachgetragen: Der
 * Dateiname nennt den Eigentümer, und eine Zeile hier wäre wieder die
 * gemeinsame Stelle, an der acht Zweige zusammenstoßen. Ein Schlüssel steht
 * in genau einem Bereich (die Probe prüft das über alle Dateien).
 */
import { bereicheAus } from '../bereiche';

export const de = bereicheAus(
  import.meta.glob(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true }),
);
