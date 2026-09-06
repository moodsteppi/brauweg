/**
 * Die Kampfsimulation — zwei Bretthaelften treten an, heraus kommt ein Bericht.
 *
 * Hier wird nichts zugesehen und nichts angezeigt: Der ganze Kampf wird in
 * einem Rutsch durchgerechnet, und die Oberflaeche spielt hinterher das
 * Ablaufprotokoll ab. Ein Kampf, den man nachrechnen kann, ist auch ein
 * Kampf, den man aufzeichnen, wiederholen und in einem Fehlerbericht
 * mitschicken kann.
 *
 * Reine Funktion: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser
 * dem uebergebenen Seed (game-api, Grundsatz 1). Die uebergebenen Bretter
 * werden nie veraendert — die Streiter sind Kopien, die nur innerhalb dieser
 * Datei leben.
 *
 * Die Synergie-Boni (synergien.ts) greifen an genau einer Stelle ein:
 * `baueStreiter` rechnet sie einmal je Seite aus und gibt sie an `werteFuer`
 * — danach stehen die Werte und werden nicht mehr angefasst.
 *
 * DIE ROLLE WIRD SEIT DEM 06.09.2026 AUSGEWERTET, aber nur eine: `beistand`
 * heilt, statt anzugreifen (siehe `HEIL_ANTEIL` und `sucheHeilziel`). Alle
 * anderen Rollen sind weiterhin blosse Auskunft fuer Laden und Aufstellung —
 * was eine Wache von einem Meuchler unterscheidet, sind ihre Werte.
 *
 * NOCH NICHT DABEI: Faehigkeiten und Mana. Ein eigener Auftrag; er greift an
 * derselben Stelle der Zugschleife in `simuliereKampf` ein wie die Heilung
 * (vor dem Angriff, mit Mana aus Treffern).
 *
 * ZUR ZEIT: Gerechnet wird in ganzen Millisekunden und in festen Takten von
 * `TAKT_MS`. Keine Gleitkommazeit, kein `Date.now()`. Sekundenbruchteile als
 * Kommazahl aufzusummieren waere der sicherste Weg, zwei Laeufe derselben
 * Saat nach ein paar hundert Angriffen auseinanderlaufen zu lassen — und
 * genau das darf hier nicht passieren.
 */

import {
  type EinheitId,
  type Grundwerte,
  type Rolle,
  type Stufe,
  // Umbenannt, weil `baueStreiter` seine Schleifenvariable `einheit` nennt und
  // die Katalogfunktion sonst dort verdeckt waere.
  einheit as katalogEinheit,
  werteFuer,
} from './katalog.js';
import { bonusFuerEinheit, zaehleMarken } from './synergien.js';
import {
  type Seite,
  SEITEN,
  arenaAbstand,
  arenaNachbarn,
  gegenseite,
  nachArena,
} from './arena.js';
import { type Saat, baueZufall } from './zufall.js';

// ---------------------------------------------------------------------------
// Die Stellschrauben
// ---------------------------------------------------------------------------

/**
 * Die Taktlaenge der Simulation.
 *
 * Hundert Millisekunden sind fein genug, dass ein Zuschauer keine Stufen
 * sieht (die Anzeige blendet zwischen zwei Ereignissen ohnehin weich um), und
 * grob genug, dass ein voller Kampf in ein paar hundert Durchlaeufen erledigt
 * ist. Alle Wartezeiten sind Vielfache davon, damit kein Ereignis zwischen
 * zwei Takte faellt und dort auf den naechsten warten muss.
 */
export const TAKT_MS = 100;

/** Wie lange eine Einheit fuer ein Feld braucht. Zwei Felder je Sekunde. */
export const SCHRITT_MS = 500;

/**
 * Nach dieser Zeit ist Schluss, auch wenn beide Seiten noch stehen.
 *
 * Ohne diese Grenze kann die Schleife ewig laufen: Eine Nahkampfeinheit, die
 * von den eigenen Leuten eingekeilt ist, kommt an ihr Ziel womoeglich nie
 * heran (siehe `schrittZiel`), und zwei Bretter aus lauter Schildknappen
 * halten einander sehr lange aus.
 *
 * WARUM AUSGERECHNET 45 SEKUNDEN: Eine Abbruchgrenze taugt nur etwas, wenn sie
 * die Ausnahme bleibt — sonst entscheidet nicht mehr der Kampf, sondern
 * `entscheideNachZeit`. Auf Brettern aus ECHTEN Partien dauert ein Kampf heute
 * 17,0 s im Median, und 6,1 % laufen in die Grenze (500 Partien zu viert,
 * werkzeug/spielzeit.mjs, nachgemessen am 06.09.2026). Das ist die
 * Groessenordnung, fuer die die 45 s gedacht sind: ein Rettungsseil. Die Zahl
 * ist an zwei Tagen von 1,8 auf 4,6 und dann auf 9,9 Prozent gestiegen und
 * seither wieder auf 6,1 gefallen — dazwischen liegen die beiden
 * Katalogeingriffe vom 05.09. abends (Elementar bekam eine Vorderreihe, der
 * Schildknappe die Marke Untot). Unten steht, woran jeder Schritt lag; hier
 * steht der Grund, aus dem die Zahl ueberhaupt beobachtet wird.
 *
 * DIESE 17 SEKUNDEN HAENGEN AM ZEITRAFFER, und das ist der Satz, um den es
 * hier geht. Die Zahl stand schon einmal an dieser Stelle — damals aus einer
 * anderen Messung: 800 zufaellig besetzte Bretterpaare OHNE Deckel, Median
 * 17 s, das neunte Zehntel bei 35 s, rund 2 bis 4 Prozent abgeschnitten. Auf
 * echten Brettern stimmte sie nie: Ein Bot kauft nicht zufaellig, er nimmt das
 * Beste, verschmilzt auf Stufe 2 und 3 und sammelt Marken, deren Boni Leben
 * und Ruestung dazulegen. Solche Kaempfe dauerten 35,2 s, und abgeschnitten
 * wurden 27,7 % — jeder dritte Kampf ging an die Uhr statt ans Brett
 * (gefunden am 05.09.2026 beim Zerlegen der Spielzeit).
 *
 * Repariert hat das nicht die Grenze, sondern `STANDARD_REGLER.zeitraffer`:
 * Er steht seit demselben Tag auf 2, und damit sind aus 35,2 s wieder 17,3 s
 * geworden und aus 27,7 % noch 1,8 %. WER IHN AUF 1 ZURUECKSTELLT, HOLT DEN
 * ALTEN ZUSTAND MIT ZURUECK — die Begruendung dieser Konstante gilt dann nicht
 * mehr.
 *
 * DIE ZWEITE SCHRAUBE IST DER LADEN, und sie zieht in die Gegenrichtung: Seit
 * ein Kauf den ganzen Laden neu zieht (partie.ts, `fuelleLaden`), stehen sich
 * bessere Bretter gegenueber, und aus den 1,8 % sind 4,6 % geworden. Das ist
 * weiterhin ein Rettungsseil, aber es ist die Zahl, die ein Eingriff am
 * Katalog oder am Laden zuerst bewegt. Die volle Auswertung steht in
 * docs/TAFELRUNDE-SPIELZEIT.md, Abschnitt 6.
 *
 * DIE DRITTE IST DER BOT, und sie zieht am staerksten: Seit er auf Marken
 * spielt (bot.ts, `heerStaerke`), stellt er Synergien auf, die Leben und
 * Ruestung dazulegen — aus 4,6 % sind 9,9 % geworden. Es ist DIESELBE Ursache
 * wie oben, nur eine Stufe weiter: ein besser besetztes Brett. Die kuerzere
 * Partie (12 statt 14 Startleben) hat daran nichts geaendert, sie nimmt die
 * Rundenzahl und nicht die Kampfdauer (9,5 % gegen 9,7 %). WENN DIESE ZAHL
 * WEITER STEIGT, ist es Zeit fuer die Frage, die hier bisher immer mit "nein"
 * beantwortet wurde: nicht die Grenze senken, sondern den Katalog
 * entschaerfen — Ruestung ist der Wert, der jeden Kampf doppelt verlaengert.
 *
 * DIE ZAHL 45_000 SELBST BLEIBT UNVERAENDERT, weil sie das falsche Ende war:
 * Wer sie senkt, laesst mehr Kaempfe von der Uhr entscheiden statt weniger.
 * Kuerzer werden Kaempfe ueber den Ablauf (den Zeitraffer) oder ueber den
 * Katalog.
 *
 * AM 06.09.2026 IST DIESER SATZ NACHGERECHNET WORDEN, weil Robin nach
 * kuerzeren Wartezeiten gefragt hat und die Grenze der einzige Hebel ist, der
 * den SCHWANZ der Kampfdauer trifft (der Median liegt bei 17 s, das neunte
 * Zehntel bei 40 s). Gemessen wurde mit ZWEI Werkzeugen, und die Trennung ist
 * kein Zufall — die eine Frage laesst sich mit dem anderen Verfahren gar
 * nicht beantworten:
 *
 *   werkzeug/hoechstdauer.mjs (300 Partien zu viert, 5.125 Kaempfe): Jede
 *   Paarung wird nach dem gebauten Lauf NOCH EINMAL gerechnet — dieselben
 *   Bretter, dieselbe Kampfsaat, nur die Grenze anders. Nur so laesst sich
 *   sagen, ob derselbe Kampf ANDERS ausgeht; sobald einer das tut, laufen die
 *   Partien auseinander.
 *
 *              Kampf (Mittel)   von der Uhr   anderer Sieger   unentschieden
 *     45 s          20,1 s          6,0 %           —                0,1 %
 *     30 s          18,3 s         19,7 %         1,3 %              0,6 %
 *     25 s          17,1 s         26,6 %         3,0 %              1,4 %
 *     20 s          15,5 s         38,8 %         4,5 %              1,5 %
 *
 *   werkzeug/spielzeit.mjs --nur hoechstdauer (dieselben 300 Partien, aber
 *   jede Zeile mit ihren EIGENEN Partien): Spielzeit im Median 6:32 heute,
 *   6:11 bei 30 s, 6:00 bei 25 s. Die Markenspanne bewegt sich dabei gar
 *   nicht (x0,74-1,34 gegen x0,75-1,33), und ein eindeutiger Sieger kommt
 *   weiterhin in jeder Partie zustande.
 *
 * Zwei Auskuenfte stecken darin, und sie zeigen in verschiedene Richtungen.
 * Die eine: Die Uhr urteilt fast immer wie das Brett — bei 30 s bekommt nur
 * jeder 77. Kampf einen anderen Sieger. Die Ausgewogenheit haelt also. Die
 * andere: Der ANTEIL verdreifacht sich. Bei 30 s endet jeder fuenfte Kampf
 * mit "Zeit abgelaufen", waehrend auf beiden Seiten noch Einheiten stehen —
 * das ist keine Ausnahme mehr, sondern eine Spielart, und "Rettungsseil"
 * waere das falsche Wort dafuer. Dafuer wird die Partie um 5 % kuerzer.
 *
 * DIE ZAHL BLEIBT DESHALB BEI 45_000, und die Entscheidung liegt bei Robin
 * (Karte im Issueboard). Die Wartezeit, um die es ihm ging, kam ohnehin
 * ueberwiegend woanders her: aus dem Takt der Botzuege (`BOT_TAKT_MS` in
 * adapter.ts, 12,8 s im Median je Runde) und aus dem Nachlauf
 * (`KAMPF_NACHLAUF_MS`, 2,5 s je Runde). Beide sind am 06.09.2026 gefallen,
 * ohne eine einzige Regel anzufassen.
 *
 * Zwei Proben halten das fest: die in test/kampf.test.ts auf zufaelligen
 * Brettern (sie sagt etwas ueber den Katalog — dort sind es mit dem
 * Standardregler 10,5 s und 0,3 %) und die in test/spielzeit.test.ts auf
 * Brettern aus echten Partien (sie sagt etwas ueber das Spiel). Die beiden
 * Zahlenpaare liegen auseinander, und zwar immer; wer nur eines liest, zieht
 * den falschen Schluss.
 *
 * WER GEWINNT DANN: siehe `entscheideNachZeit`.
 */
export const HOECHSTDAUER_MS = 45_000;

/**
 * Grundschaden am Verlierer, unabhaengig davon, was noch steht.
 *
 * Ohne ihn koennte ein Spieler, der jede Runde knapp verliert, ewig
 * weiterspielen, sobald der Gegner mit einer einzigen Einheit gewinnt. Der
 * Grundschaden sorgt dafuer, dass eine Niederlage immer kostet.
 */
export const SCHADEN_GRUNDWERT = 1;

/**
 * Durch so viel wird die Stufensumme der ueberlebenden Gegner geteilt.
 *
 * Der Teiler kam am 05.09.2026 mit den 20 Startleben (vorher 100, siehe
 * regeln.ts). Ohne ihn kostet eine Niederlage im spaeten Spiel acht bis zehn
 * Punkte, und eine Partie zu viert war nach acht Runden vorbei — gemessen ueber
 * 300 Partien, nicht geschaetzt. Die Reihe, jeweils Median der Runden zu viert
 * und noch bei 20 Startleben: ohne Teiler 8, mit Teiler 2 dann 13, mit Teiler 3
 * dann 15.
 *
 * DREI, WEIL DIE RUNDE NICHT DIE SCHRAUBE IST, an der gekuerzt wurde. Nach
 * unten begrenzt die Rundenzahl das Spiel selbst: Wer ausscheidet, bevor sein
 * Brett steht, hat nicht verloren, sondern nicht gespielt. Genau deshalb ging
 * die Kuerzung der Partie auf acht Minuten ueberwiegend ueber den Zeitraffer
 * und nur zum kleineren Teil ueber die Startleben (20 auf 14, spaeter auf
 * 12): Der Teiler blieb, wo er ist.
 *
 * HEUTE LIEGT DER MEDIAN BEI 9 RUNDEN (12 Startleben seit dem 05.09.2026
 * abends; 10 waren es bei 14). Die Grenze, ab der die Runde zu kurz wird,
 * steht damit nicht mehr im Gefuehl, sondern gemessen in regeln.ts: Wer
 * ausscheidet, hat im Schnitt 3,35 Einheiten auf dem Brett, und kein
 * einziges Ausscheiden ueber 500 Partien geschah mit hoechstens zweien. Was
 * die Runde kostet, ist das obere Ende — vier Einheiten stehen in 15,2 %
 * statt 21,0 % der Antritte, und die hoechste Synergieschwelle faellt von
 * 0,9 % auf 0,3 %.
 *
 * Wer den Teiler doch anfasst, misst danach mit werkzeug/spielzeit.mjs: Von 3
 * auf 2 sind es heute 8 Runden und 6:42 statt 9 und 7:27.
 *
 * `ceil` und nicht `round`: Eine Niederlage gegen einen einzelnen Ueberlebenden
 * der Stufe 1 soll die vollen zwei Punkte kosten (Grundwert plus eins) und
 * nicht durch die Rundung zum halben Preis werden.
 */
export const SCHADEN_STUFEN_TEILER = 3;

/**
 * Wie viel eine Einheit der Rolle `beistand` je Takt heilt, als Anteil ihres
 * Angriffs.
 *
 * WARUM ES DIESE ZAHL UEBERHAUPT GIBT: Bis zum 06.09.2026 wertete der Kampf
 * die Rolle gar nicht aus — die einzige Fundstelle war `reichweite`. Ein
 * Beistand war damit schlicht eine schwache Einheit ohne Ausgleich: Moosheiler,
 * Runenpriester und Lichtwahrerin liegen 30 bis 38 % unter der Mitte ihrer
 * Kostenstufe, und in einem Monokultur-Turnier (drei Kopien gegen drei Kopien,
 * alle Paarungen je Kostenstufe) gewannen alle drei NULL Kaempfe — jeweils die
 * letzte Zeile ihrer Stufe. Die Werte sind der Preis fuer eine Wirkung, die es
 * nicht gab; jetzt gibt es sie, und die Werte bleiben, wo sie sind.
 *
 * DER ANGRIFF IST DER TRAEGER und keine eigene Spalte im Katalog: Ein Beistand
 * heilt statt anzugreifen, im selben Takt und mit demselben Tempo. Damit
 * braucht die Balance keine zweite Zahl je Einheit, und wer einen Beistand
 * staerker machen will, dreht an genau der Zahl, die auch seinen Schaden
 * bestimmt. Die Stufe zaehlt automatisch mit — `werteFuer` skaliert den
 * Angriff, also skaliert die Heilung.
 *
 * WARUM 1,6 UND NICHT 1,0: Heilung ist schwaecher als derselbe Schaden, und
 * zwar aus zwei Gruenden. Sie geht nicht durch die Ruestung (ein Treffer von 50
 * kostet ein Ziel mit 40 Ruestung nur 30 Leben — die Heilung von 50 gibt volle
 * 50 zurueck, das spricht FUER weniger), sie verpufft aber, sobald niemand
 * verwundet ist oder das Ziel im selben Takt faellt, und sie toetet niemanden:
 * Ein Kampf endet erst, wenn eine Seite steht. Gemessen im Monokultur-Turnier
 * (werkzeug/monokultur.mjs, alle Paarungen je Kostenstufe, drei Kopien je
 * Seite) gewinnt der Beistand seiner Stufe damit:
 *
 *     Anteil 1,0     Moosheiler 24 / Runenpriester 20 / Lichtwahrerin 12
 *     Anteil 1,6     Moosheiler 62 / Runenpriester 55 / Lichtwahrerin 40
 *     Anteil 2,4     Moosheiler 92 / Runenpriester 96 / Lichtwahrerin 79
 *
 * (Von 168 Kaempfen je Einheit auf den Stufen 1 und 2, 120 auf Stufe 3.) Bei
 * 2,4 ist der Beistand nicht mehr ausgeglichen, sondern die beste Einheit
 * seiner Stufe — drei Heiler halten einander gegen alles am Leben, was nicht
 * schneller austeilt, als sie heilen. 1,6 setzt ihn ins Mittelfeld: Er gewinnt
 * gegen Bretter, die auf Dauer spielen, und verliert gegen die, die schnell
 * toeten. Genau das soll eine Rolle tun.
 */
export const HEIL_ANTEIL = 1.6;

// ---------------------------------------------------------------------------
// Die Stellschrauben als Buendel
// ---------------------------------------------------------------------------

/**
 * Dieselben vier Zahlen, aber einstellbar.
 *
 * WOZU: Um zu beantworten, welche Stellschraube eine Partie wie viel kuerzer
 * macht, muss man jede EINZELN drehen und dieselben 500 Partien noch einmal
 * rechnen (docs/TAFELRUNDE-SPIELZEIT.md). Mit vier `const` im Modul ginge das
 * nur, indem der Messstand den Kampf ein zweites Mal nachbaut — und dann misst
 * er seine eigene Kopie und nicht das Spiel.
 *
 * WAS ES NICHT IST: eine Regel des Tisches. Der Regler steht bewusst NICHT in
 * `TafelrundeRegeln` (regeln.ts), denn der Regelsatz kommt als JSON von aussen
 * — ein selbstgebauter Tisch koennte sich sonst einen Zeitraffer von 10
 * einstellen. Wer den Standard aendern will, aendert die Konstanten oben; der
 * Regler ist der Weg, das vorher zu messen.
 */
export interface Kampfregler {
  /** Taktlaenge der Simulation, siehe `TAKT_MS`. */
  readonly taktMs: number;
  /** Abbruchgrenze, siehe `HOECHSTDAUER_MS`. */
  readonly hoechstdauerMs: number;
  /** Teiler der Stufensumme beim Schaden, siehe `SCHADEN_STUFEN_TEILER`. */
  readonly schadenStufenTeiler: number;
  /**
   * Wie viel schneller alles ablaeuft: Angriffstempo UND Schrittweite.
   *
   * 1 ist der ungeraffte Ablauf, 1,5 macht denselben Kampf in zwei Dritteln
   * der Zeit; der Standard steht auf 2, siehe `STANDARD_REGLER`. Ein Faktor
   * und keine zwei Zahlen, weil beides zusammengehoert: Wer
   * nur schneller schlagen, aber gleich langsam laufen laesst, verschiebt das
   * Kraefteverhaeltnis zwischen Nah- und Fernkampf, statt den Kampf zu
   * raffen.
   *
   * ACHTUNG, DAS AENDERT DIE ANZEIGE MIT. Die Oberflaeche spielt das
   * Ablaufprotokoll in Echtzeit ab (`zeitMs`); ein Zeitraffer macht den Kampf
   * am Bildschirm tatsaechlich schneller und nicht nur die Rechnung kuerzer.
   */
  readonly zeitraffer: number;
  /** Heilung je Takt als Anteil des Angriffs, siehe `HEIL_ANTEIL`. */
  readonly heilAnteil: number;
}

/**
 * Der gebaute Ablauf: drei Konstanten dieser Datei und der Zeitraffer.
 *
 * DER ZEITRAFFER STEHT AUF 2 (seit dem 05.09.2026, Robins Entscheidung nach
 * der Messung in docs/TAFELRUNDE-SPIELZEIT.md). Er ist die einzige Schraube,
 * die die Partie kuerzt, ohne eine Runde zu streichen: Der Kampf fiel von
 * 35,2 s auf 17,3 s im Median, die Partie von 13:31 auf 7:25 — bei
 * gleichzeitig 14 Startleben, siehe `DEFAULT_REGELN` in regeln.ts. Die beiden
 * Zahlen gehoeren zusammen und wurden zusammen gemessen; wer eine davon
 * anfasst, misst mit werkzeug/spielzeit.mjs neu.
 *
 * SEIT DIE LADENREGEL DAZUKAM (kostenloses Wuerfeln, ein Kauf zieht den ganzen
 * Laden neu) stehen die Zahlen bei 17,6 s und 7:34 im Median bei 10 Runden.
 * Beide Aenderungen sind am 05.09.2026 auf getrennten Zweigen entstanden und
 * erst beim Zusammenfuehren gemeinsam wirksam geworden — die Messung dazu ist
 * Abschnitt 6 in docs/TAFELRUNDE-SPIELZEIT.md.
 *
 * HEUTE — 12 Startleben und ein Bot, der auf Marken spielt — sind es 17,0 s
 * im Median und 7:04 bei 9 Runden (nachgemessen am 06.09.2026, 500 Partien zu
 * viert; die 20,2 s und 7:23, die hier bis dahin standen, stammen von vor den
 * Katalogeingriffen des 05.09. abends). Der Kampf ist gegenueber dem Stand vor
 * dem Zeitraffer laenger geworden und nicht kuerzer: Staerkere Bretter halten
 * laenger durch. Die Partie ist trotzdem kuerzer, weil sie weniger Runden hat.
 *
 * ACHTUNG: Er wirkt auch am Bildschirm. Die Oberflaeche spielt das
 * Ablaufprotokoll in Echtzeit ab, die Figuren laufen und schlagen also
 * tatsaechlich doppelt so schnell.
 */
export const STANDARD_REGLER: Kampfregler = {
  taktMs: TAKT_MS,
  hoechstdauerMs: HOECHSTDAUER_MS,
  schadenStufenTeiler: SCHADEN_STUFEN_TEILER,
  zeitraffer: 2,
  heilAnteil: HEIL_ANTEIL,
};

// ---------------------------------------------------------------------------
// Was hinein geht
// ---------------------------------------------------------------------------

/**
 * Eine aufgestellte Einheit.
 *
 * Deckungsgleich mit `Kaempfer` aus partie.ts und trotzdem hier noch einmal
 * genannt: Diese Datei darf partie.ts NICHT kennen, weil partie.ts sie kennt.
 * Ein Ringschluss zwischen den beiden waere der Preis fuer einen gesparten
 * Typ von drei Zeilen.
 */
export interface Aufgestellt {
  readonly id: EinheitId;
  readonly stufe: Stufe;
}

/**
 * Eine Bretthaelfte, wie sie im Heer steht: ein Platz je Feld, `null` = leer.
 * Die Platznummern sind BRETTPLAETZE (brett.ts), nicht Arenaplaetze.
 */
export type Brettseite = readonly (Aufgestellt | null)[];

// ---------------------------------------------------------------------------
// Was herauskommt
// ---------------------------------------------------------------------------

/** Warum der Kampf zu Ende ist. */
export type Endgrund =
  /** Eine Seite steht nicht mehr. Der Normalfall. */
  | 'ausgeloescht'
  /** `HOECHSTDAUER_MS` erreicht, beide Seiten stehen noch. */
  | 'zeit';

/**
 * Eine Einheit im Kampf, wie sie nach aussen sichtbar ist.
 *
 * `platz` ist ein ARENAPLATZ, kein Brettplatz — beide Seiten stehen im selben
 * Gitter, sonst gaebe es keinen Abstand zwischen ihnen. Wer daraus wieder
 * einen Brettplatz braucht, nimmt `vonArena` aus arena.ts.
 */
export interface Kaempferstand {
  /** Stabile Kennung innerhalb dieses Kampfes. Alle Ereignisse nennen sie. */
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: EinheitId;
  readonly stufe: Stufe;
  readonly platz: number;
  readonly leben: number;
  readonly hoechstesLeben: number;
}

/**
 * Ein Ereignis des Ablaufprotokolls.
 *
 * Das Protokoll ist der eigentliche Ertrag dieser Datei: Aus ihm spielt die
 * Anzeige den Kampf ab, ohne selbst eine Regel nachzubauen (CLAUDE.md, "Der
 * Client bildet keine Regel nach"). Jedes Ereignis traegt seinen Zeitpunkt in
 * Millisekunden seit Kampfbeginn, und die Liste ist nach `zeitMs` aufsteigend
 * sortiert — die Anzeige kann sie also einfach der Reihe nach abarbeiten.
 *
 * Ereignisse desselben Zeitpunkts stehen in Zugreihenfolge. Auch das ist Teil
 * der Zusicherung: Zwei Laeufe derselben Saat liefern dieselbe Liste, Eintrag
 * fuer Eintrag.
 */
export type Ereignis =
  /** Eine Einheit ist ein Feld weit gezogen. Beide Plaetze sind Arenaplaetze. */
  | {
      readonly art: 'bewegung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly von: number;
      readonly nach: number;
    }
  /** Eine Einheit hat getroffen. `lebenDanach` spart der Anzeige das Mitrechnen. */
  | {
      readonly art: 'treffer';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly schaden: number;
      readonly lebenDanach: number;
    }
  /**
   * Ein Beistand hat einen Verbuendeten geheilt.
   *
   * Dieselbe Form wie `treffer`, nur mit `menge` statt `schaden` — und genau
   * deshalb ein eigenes Ereignis und kein negativer Schaden: Die Anzeige soll
   * beides unterscheiden koennen, ohne auf ein Vorzeichen zu achten.
   */
  | {
      readonly art: 'heilung';
      readonly zeitMs: number;
      readonly wer: number;
      readonly ziel: number;
      readonly menge: number;
      readonly lebenDanach: number;
    }
  /** Eine Einheit ist gefallen. Kommt immer unmittelbar nach dem toedlichen Treffer. */
  | { readonly art: 'tod'; readonly zeitMs: number; readonly wer: number }
  /** Der Kampf ist vorbei. Immer das letzte Ereignis, genau einmal. */
  | {
      readonly art: 'ende';
      readonly zeitMs: number;
      readonly sieger: Seite | null;
      readonly grund: Endgrund;
    };

export interface Kampfbericht {
  /**
   * Die Saat, mit der gerechnet wurde — damit ein Bericht allein nachspielbar
   * ist. Immer als Zeichenkette, auch wenn eine Zahl hereinkam: Sonst haette
   * derselbe Kampf je nach Aufrufer zwei verschiedene Berichte.
   */
  readonly saat: string;
  /** Wer innerhalb eines Taktes zuerst handelt. Kommt aus der Saat, siehe `simuliereKampf`. */
  readonly erstZieher: Seite;
  /** Alle Einheiten mit vollem Leben auf ihrem Startplatz. Der Aufbau der Buehne. */
  readonly start: readonly Kaempferstand[];
  /** Das Ablaufprotokoll, aufsteigend nach Zeit. Endet mit genau einem `ende`. */
  readonly ereignisse: readonly Ereignis[];
  /** `null` heisst unentschieden — dann nimmt niemand Schaden. */
  readonly sieger: Seite | null;
  readonly grund: Endgrund;
  readonly dauerMs: number;
  /** Wer noch steht, mit Restleben und Endplatz. Leer, wenn sich beide ausgeloescht haben. */
  readonly ueberlebende: readonly Kaempferstand[];
  /** Schaden am Verlierer. Bei unentschieden 0. */
  readonly schaden: number;
}

// ---------------------------------------------------------------------------
// Der Zustand waehrend des Kampfes
// ---------------------------------------------------------------------------

/**
 * Ein Streiter waehrend der Simulation — veraenderlich, aber nur hier drin.
 *
 * Das ist die eine Stelle im Paket, an der ein Feld ueberschrieben wird statt
 * ein neues Objekt zu entstehen. Der Grund ist Rechenzeit: Ein Kampf macht
 * bis zu vierhundert Takte mal achtzehn Einheiten, und dabei jedes Mal die
 * ganze Aufstellung neu zu bauen waere Verschwendung. Nach aussen dringt
 * davon nichts — es gehen ausschliesslich frisch gebaute `Kaempferstand`
 * hinaus, und die Eingabe wird nicht angefasst.
 */
interface Streiter {
  readonly id: number;
  readonly seite: Seite;
  readonly einheitId: EinheitId;
  readonly stufe: Stufe;
  /**
   * Die Kampfrolle aus dem Katalog. Sie steht hier als Feld und wird nicht bei
   * jedem Takt nachgeschlagen: Die Zugschleife laeuft bis zu vierhundertmal
   * ueber achtzehn Einheiten, und `einheit()` ist ein Kartenzugriff je Aufruf.
   */
  readonly rolle: Rolle;
  readonly werte: Grundwerte;
  readonly hoechstesLeben: number;
  /** Rang in der Zugreihenfolge. Entscheidet auch den Gleichstand bei der Zielwahl. */
  rang: number;
  platz: number;
  leben: number;
  /** Ab wann diese Einheit wieder angreifen bzw. ziehen darf, in Millisekunden. */
  angriffFreiAb: number;
  schrittFreiAb: number;
}

/**
 * Wartezeit zwischen zwei Angriffen, in ganzen Takten.
 *
 * `tempo` ist die Zahl der Angriffe je Sekunde und eine Kommazahl (0,6 bis
 * 1,05). Sie wird hier EINMAL in eine ganze Zahl von Millisekunden verwandelt
 * und danach nur noch addiert; so kann sich kein Gleitkommarest ueber
 * hunderte Angriffe aufsummieren. Aufgerundet auf ganze Takte, damit ein
 * Angriff nicht zwischen zwei Takten faellig wird und dadurch effektiv
 * langsamer waere, als sein Tempo verspricht.
 *
 * Mindestens ein Takt: Ein Tempo ueber 10 gibt es heute nicht, aber eine
 * Wartezeit von 0 waere eine Endlosschleife im Takt.
 */
export function angriffstakt(tempo: number, regler: Kampfregler = STANDARD_REGLER): number {
  const roh = Math.round(1000 / (tempo * regler.zeitraffer));
  return Math.max(regler.taktMs, Math.ceil(roh / regler.taktMs) * regler.taktMs);
}

/**
 * Wie lange ein Feld weit ziehen dauert, in ganzen Takten.
 *
 * Dieselbe Aufrundung wie beim Angriff und aus demselben Grund: Ein Schritt,
 * der zwischen zwei Takten faellig wird, wartet sonst auf den naechsten und
 * dauert damit effektiv laenger, als `SCHRITT_MS` sagt.
 */
export function schrittdauer(regler: Kampfregler = STANDARD_REGLER): number {
  const roh = Math.round(SCHRITT_MS / regler.zeitraffer);
  return Math.max(regler.taktMs, Math.ceil(roh / regler.taktMs) * regler.taktMs);
}

/**
 * Was ein Angriff nach Ruestung uebrig laesst.
 *
 * Ruestung ist ein Abzug in Prozentpunkten (10 bis 50), nicht ein fester
 * Betrag: Ein fester Abzug macht schwache Angriffe wirkungslos und starke
 * kaum schwaecher, und die 50 des Wurzelriesen wuerden jede Einheit zu einem
 * Gold vollstaendig abprallen lassen.
 *
 * Mindestens 1: Damit ein Kampf immer irgendwann endet, auch wenn spaeter
 * einmal eine Synergie die Ruestung ueber 100 Punkte schiebt. Ohne diesen
 * Boden stuende dann eine unsterbliche Einheit auf dem Feld.
 */
export function schadenNach(angriff: number, ruestung: number): number {
  return Math.max(1, Math.round((angriff * (100 - ruestung)) / 100));
}

/**
 * Was ein Beistand je Takt heilt.
 *
 * Gerundet und mindestens 1, aus demselben Grund wie bei `schadenNach`: Eine
 * Heilung von 0 waere ein Ereignis ohne Wirkung, das die Anzeige trotzdem
 * abspielt — ein Heiler, der sichtbar wirkt und nichts tut, sieht nach einem
 * Fehler aus.
 */
export function heilkraft(angriff: number, anteil: number = HEIL_ANTEIL): number {
  return Math.max(1, Math.round(angriff * anteil));
}

/**
 * Der Verbuendete, den dieser Beistand heilt — oder null.
 *
 * DAS GROESSTE FEHLENDE LEBEN gewinnt, nicht der geringste Anteil: Wer
 * absolut am meisten verloren hat, ist die Einheit, an der die Heilung am
 * wenigsten ueberlaeuft. Bei Gleichstand entscheidet der Rang, wie ueberall in
 * dieser Datei (siehe `sucheZiel`).
 *
 * SICH SELBST HEILT NIEMAND. Ein Beistand ganz ohne verwundete Nachbarn soll
 * angreifen und nicht sich selbst am Leben halten: Zwei einzelne Heiler
 * gegeneinander wuerden sonst bis zur Hoechstdauer aneinander herumdoktern,
 * und die Rolle heisst Beistand und nicht Ausdauer.
 *
 * Ausserhalb der Reichweite wird nicht geheilt — die Reichweite ist die
 * einzige Zahl, die im Kampf ohnehin schon ueber Naehe entscheidet.
 */
function sucheHeilziel(wer: Streiter, alle: readonly Streiter[]): Streiter | null {
  let bestes: Streiter | null = null;
  let groesstesFehlen = 0;
  for (const anderer of alle) {
    if (anderer.seite !== wer.seite || anderer.id === wer.id || anderer.leben <= 0) continue;
    if (arenaAbstand(wer.platz, anderer.platz) > wer.werte.reichweite) continue;
    const fehlt = anderer.hoechstesLeben - anderer.leben;
    if (fehlt <= 0) continue;
    if (fehlt > groesstesFehlen || (fehlt === groesstesFehlen && bestes !== null && anderer.rang < bestes.rang)) {
      bestes = anderer;
      groesstesFehlen = fehlt;
    }
  }
  return bestes;
}

/**
 * Der Schaden, den der Verlierer am Lebensbalken nimmt.
 *
 * Grundschaden plus die geteilte Stufe jeder ueberlebenden Gegnereinheit — so
 * steht es im Konzept ("Schaden am Verlierer nach verbliebenen
 * Gegnereinheiten"). Die Stufe und nicht die Kopfzahl, weil ein einzelner
 * Stufe-3-Riese ein knapperes Ergebnis ist als drei unversehrte
 * Stufe-1-Einheiten, aber ein schwererer Gegner als eine einzelne
 * Stufe-1-Einheit.
 *
 * Warum ueberhaupt geteilt wird, steht bei `SCHADEN_STUFEN_TEILER`.
 */
export function schadenFuerVerlierer(
  ueberlebende: readonly Kaempferstand[],
  teiler: number = SCHADEN_STUFEN_TEILER,
): number {
  const stufen = ueberlebende.reduce((summe, k) => summe + k.stufe, 0);
  return SCHADEN_GRUNDWERT + Math.ceil(stufen / teiler);
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

function standVon(s: Streiter): Kaempferstand {
  return {
    id: s.id,
    seite: s.seite,
    einheitId: s.einheitId,
    stufe: s.stufe,
    platz: s.platz,
    leben: s.leben,
    hoechstesLeben: s.hoechstesLeben,
  };
}

/**
 * Baut aus den beiden Bretthaelften die Streiterliste.
 *
 * Nur was auf dem BRETT steht, kaempft — die Bank sieht zu, sie kommt hier gar
 * nicht erst an. Die Reihenfolge ist fest (erst Seite 0 in Brettordnung, dann
 * Seite 1), und daraus entstehen die Kennungen. Sie sind damit unabhaengig von
 * der Saat: Zwei Kaempfe derselben Bretter mit verschiedenen Saaten reden
 * trotzdem von denselben Einheiten, und ein Fehlerbericht bleibt vergleichbar.
 *
 * Hier kommen die Synergie-Boni auf die Werte — an genau einer Stelle, weil
 * `werte` danach nicht mehr angefasst wird. Gezaehlt wird je Seite ueber die
 * EIGENE Bretthaelfte: Die Krieger des Gegners staerken nicht meine.
 */
function baueStreiter(bretter: readonly [Brettseite, Brettseite]): Streiter[] {
  const streiter: Streiter[] = [];
  for (const seite of SEITEN) {
    const zaehlung = zaehleMarken(bretter[seite]);
    bretter[seite].forEach((einheit, brettPlatz) => {
      if (!einheit) return;
      const w = werteFuer(einheit.id, einheit.stufe, bonusFuerEinheit(einheit.id, zaehlung));
      streiter.push({
        id: streiter.length,
        seite,
        einheitId: einheit.id,
        stufe: einheit.stufe,
        rolle: katalogEinheit(einheit.id).rolle,
        werte: w,
        hoechstesLeben: w.leben,
        rang: 0, // wird gleich vergeben, sobald der Erstzieher feststeht
        platz: nachArena(brettPlatz, seite),
        leben: w.leben,
        angriffFreiAb: 0,
        schrittFreiAb: 0,
      });
    });
  }
  return streiter;
}

/**
 * Die Zugreihenfolge innerhalb eines Taktes.
 *
 * Erst alle Einheiten des Erstziehers in Brettordnung, dann die der anderen
 * Seite. Der Rang steht fuer den ganzen Kampf fest und entscheidet ausserdem
 * den Gleichstand bei der Zielwahl — beides aus demselben Grund an derselben
 * Zahl: Waeren es zwei verschiedene Ordnungen, muesste man bei jedem Befund
 * zweimal nachsehen, welche gerade greift.
 */
function vergibRaenge(streiter: Streiter[], erstZieher: Seite): Streiter[] {
  const reihenfolge = [...streiter].sort((a, b) => {
    if (a.seite !== b.seite) return a.seite === erstZieher ? -1 : 1;
    return a.id - b.id;
  });
  reihenfolge.forEach((s, i) => {
    s.rang = i;
  });
  return reihenfolge;
}

// ---------------------------------------------------------------------------
// Zielwahl und Bewegung
// ---------------------------------------------------------------------------

/**
 * Das naechstgelegene lebende Ziel auf der Gegenseite.
 *
 * Bei gleichem Abstand gewinnt der niedrigere Rang. Irgendeine feste Regel
 * muss es geben, sonst haengt das Ziel an der Reihenfolge, in der die Liste
 * gerade durchlaufen wird — und die aendert sich, sobald jemand die
 * Streiterliste umbaut. Der Rang ist die Ordnung, die ohnehin schon feststeht.
 */
function sucheZiel(wer: Streiter, alle: readonly Streiter[]): Streiter | null {
  const feindSeite = gegenseite(wer.seite);
  let bestes: Streiter | null = null;
  let besterAbstand = Infinity;
  for (const anderer of alle) {
    if (anderer.seite !== feindSeite || anderer.leben <= 0) continue;
    const d = arenaAbstand(wer.platz, anderer.platz);
    if (
      d < besterAbstand ||
      (d === besterAbstand && bestes !== null && anderer.rang < bestes.rang)
    ) {
      bestes = anderer;
      besterAbstand = d;
    }
  }
  return bestes;
}

/**
 * Der Nachbarplatz, der dem Ziel naeher liegt und frei ist — oder null.
 *
 * Ausschliesslich STRIKT naeher. Ein Zug auf ein gleich weit entferntes Feld
 * saehe wie Ausweichen aus, fuehrt aber dazu, dass zwei blockierte Einheiten
 * bis zum Zeitablauf umeinander herumlaufen und dabei jeden Takt ein Ereignis
 * ins Protokoll schreiben. Wer nicht naeher kommt, bleibt stehen; dass eine
 * eingekeilte Einheit ihr Ziel dann womoeglich nie erreicht, faengt die
 * Hoechstdauer ab.
 *
 * Bei mehreren gleich guten Feldern gewinnt das erste in der Ordnung von
 * `arenaNachbarn` — fest und damit wiederholbar.
 */
function schrittZiel(
  wer: Streiter,
  zielPlatz: number,
  belegt: ReadonlyMap<number, number>,
): number | null {
  let bestes: number | null = null;
  let besterAbstand = arenaAbstand(wer.platz, zielPlatz);
  for (const platz of arenaNachbarn(wer.platz)) {
    if (belegt.has(platz)) continue;
    const d = arenaAbstand(platz, zielPlatz);
    if (d < besterAbstand) {
      bestes = platz;
      besterAbstand = d;
    }
  }
  return bestes;
}

// ---------------------------------------------------------------------------
// Das Ende
// ---------------------------------------------------------------------------

function lebende(alle: readonly Streiter[], seite: Seite): Streiter[] {
  return alle.filter((s) => s.seite === seite && s.leben > 0);
}

/**
 * Wer gewinnt, wenn die Zeit ablaeuft?
 *
 * DIE ENTSCHEIDUNG, mit Begruendung — die Aufgabe verlangt sie ausdruecklich:
 *
 * 1. Der HOEHERE ANTEIL am eigenen Gesamtleben gewinnt. Nicht die absolute
 *    Lebenssumme: Ein Brett aus teuren Einheiten hat von Haus aus mehr Leben
 *    und wuerde jedes Zeitpatt gewinnen, ohne im Kampf irgendetwas geleistet
 *    zu haben. Der Anteil misst dagegen, wer den anderen naeher an den Tod
 *    gedrueckt hat — und das ist die einzige Leistung, die in einem Kampf
 *    ohne Sieger ueberhaupt messbar ist.
 * 2. Bei gleichem Anteil zaehlt, wer mehr Einheiten stehen hat. Das ist der
 *    Massstab, mit dem der Schaden am Verlierer ohnehin gerechnet wird.
 * 3. Sonst ist es UNENTSCHIEDEN, und dann nimmt niemand Schaden. Ein
 *    Muenzwurf aus der Saat waere hier moeglich und trotzdem falsch: Der
 *    Spieler saehe zwei identische Kaempfe und einmal Schaden, einmal nicht.
 *
 * Gerechnet wird mit Kreuzmultiplikation statt mit einer Division, damit der
 * Vergleich exakt bleibt. Zwei Anteile als Gleitkommazahl koennen bei
 * gleichem Verhaeltnis um ein Bit auseinanderliegen — und dann faellt ein
 * Unentschieden zufaellig auf eine Seite.
 */
function entscheideNachZeit(alle: readonly Streiter[]): Seite | null {
  const werte = SEITEN.map((seite) => {
    const stehende = lebende(alle, seite);
    return {
      seite,
      leben: stehende.reduce((s, k) => s + k.leben, 0),
      gesamt: alle.filter((k) => k.seite === seite).reduce((s, k) => s + k.hoechstesLeben, 0),
      koepfe: stehende.length,
    };
  });
  const a = werte[0]!;
  const b = werte[1]!;

  const linkeSeite = a.leben * b.gesamt;
  const rechteSeite = b.leben * a.gesamt;
  if (linkeSeite !== rechteSeite) return linkeSeite > rechteSeite ? a.seite : b.seite;
  if (a.koepfe !== b.koepfe) return a.koepfe > b.koepfe ? a.seite : b.seite;
  return null;
}

// ---------------------------------------------------------------------------
// Die Simulation
// ---------------------------------------------------------------------------

/**
 * Rechnet einen ganzen Kampf durch.
 *
 * `bretter[0]` kaempft gegen `bretter[1]`; welcher Spieler auf welcher Seite
 * steht, entscheidet die Partie, nicht diese Datei. Uebergeben wird jeweils
 * `heer.brett` — nur das Brett, die Bank bleibt aussen vor.
 *
 * WOFUER DIE SAAT GEBRAUCHT WIRD: fuer genau eine Frage — wer innerhalb eines
 * Taktes zuerst handelt. Alles andere am Kampf ist fest gerechnet, und das
 * soll auch so bleiben: Ein Wuerfel auf jeden einzelnen Treffer waere fuer
 * den Zuschauer nicht mehr nachvollziehbar. Der Erstzieher ist aber keine
 * Kleinigkeit, sondern der einzige systematische Vorteil im ganzen Modell:
 * Bei zwei gleichen Brettern gewinnt zwangslaeufig, wer zuerst schlaegt.
 * Waere das immer Seite 0, haette in jedem Spiegelkampf derselbe Sitz recht —
 * ein Vorteil, den niemand erspielt hat. Die Saat verteilt ihn.
 *
 * Gleiche Saat plus gleiche Bretter ergibt denselben Ablauf, Ereignis fuer
 * Ereignis (siehe test/kampf.test.ts).
 */
export function simuliereKampf(
  bretter: readonly [Brettseite, Brettseite],
  saat: Saat,
  regler: Kampfregler = STANDARD_REGLER,
): Kampfbericht {
  const alsText = String(saat);
  const schritt = schrittdauer(regler);
  const zufall = baueZufall(alsText);
  const erstZieher: Seite = zufall() < 0.5 ? 0 : 1;

  const alle = baueStreiter(bretter);
  const reihenfolge = vergibRaenge(alle, erstZieher);
  const start = alle.map(standVon);

  // Wer steht wo. Der Wert ist die Kennung und nicht nur ein Haken: Beim
  // Nachsehen, warum eine Einheit nicht vorankommt, will man wissen, WER ihr
  // im Weg steht.
  const belegt = new Map<number, number>();
  for (const s of alle) belegt.set(s.platz, s.id);

  const ereignisse: Ereignis[] = [];
  let jetzt = 0;
  let grund: Endgrund = 'ausgeloescht';

  for (;;) {
    // Erst pruefen, dann handeln: Ein bereits entschiedener Kampf soll nicht
    // noch einen Takt lang Ereignisse erzeugen, in denen Ueberlebende auf
    // niemanden mehr einschlagen.
    if (lebende(alle, 0).length === 0 || lebende(alle, 1).length === 0) {
      grund = 'ausgeloescht';
      break;
    }
    if (jetzt >= regler.hoechstdauerMs) {
      grund = 'zeit';
      break;
    }

    for (const wer of reihenfolge) {
      if (wer.leben <= 0) continue; // im selben Takt schon gefallen

      const ziel = sucheZiel(wer, alle);
      if (!ziel) break; // Gegenseite ausgeloescht — der Rest des Taktes entfaellt

      // Der Beistand heilt, statt anzugreifen: im selben Takt, mit demselben
      // Tempo und derselben Reichweite. Die Pruefung steht VOR der des
      // Angriffs, sonst heilte er nur dann, wenn er ohnehin schon zuschlagen
      // koennte — ein Heiler steht aber hinten, und sein Ziel ist der eigene
      // Nachbar und nicht der Gegner. Findet er niemanden zum Heilen, faellt er
      // in das normale Verhalten zurueck und kaempft mit.
      if (wer.rolle === 'beistand' && jetzt >= wer.angriffFreiAb) {
        const patient = sucheHeilziel(wer, alle);
        if (patient) {
          const menge = Math.min(
            heilkraft(wer.werte.angriff, regler.heilAnteil),
            patient.hoechstesLeben - patient.leben,
          );
          patient.leben += menge;
          wer.angriffFreiAb = jetzt + angriffstakt(wer.werte.tempo, regler);
          ereignisse.push({
            art: 'heilung',
            zeitMs: jetzt,
            wer: wer.id,
            ziel: patient.id,
            menge,
            lebenDanach: patient.leben,
          });
          continue;
        }
      }

      if (arenaAbstand(wer.platz, ziel.platz) <= wer.werte.reichweite) {
        if (jetzt < wer.angriffFreiAb) continue;
        const schaden = schadenNach(wer.werte.angriff, ziel.werte.ruestung);
        ziel.leben = Math.max(0, ziel.leben - schaden);
        wer.angriffFreiAb = jetzt + angriffstakt(wer.werte.tempo, regler);
        ereignisse.push({
          art: 'treffer',
          zeitMs: jetzt,
          wer: wer.id,
          ziel: ziel.id,
          schaden,
          lebenDanach: ziel.leben,
        });
        if (ziel.leben === 0) {
          belegt.delete(ziel.platz);
          ereignisse.push({ art: 'tod', zeitMs: jetzt, wer: ziel.id });
        }
        continue;
      }

      if (jetzt < wer.schrittFreiAb) continue;
      const nach = schrittZiel(wer, ziel.platz, belegt);
      if (nach === null) continue; // eingekeilt: stehen bleiben statt im Kreis zu laufen
      const von = wer.platz;
      belegt.delete(von);
      belegt.set(nach, wer.id);
      wer.platz = nach;
      wer.schrittFreiAb = jetzt + schritt;
      ereignisse.push({ art: 'bewegung', zeitMs: jetzt, wer: wer.id, von, nach });
    }

    jetzt += regler.taktMs;
  }

  // `dauerMs` liegt damit einen Takt hinter dem letzten Ereignis: Der Takt, in
  // dem der letzte Gegner faellt, wird zu Ende gespielt, und erst der naechste
  // Schleifendurchlauf stellt das Ende fest. Das ist gewollt — die Anzeige
  // braucht nach dem letzten Todesstoss ohnehin einen Wimpernschlag, bevor sie
  // das Ergebnis einblendet.

  const sieger =
    grund === 'zeit'
      ? entscheideNachZeit(alle)
      : lebende(alle, 0).length > 0
        ? 0
        : lebende(alle, 1).length > 0
          ? 1
          : null;

  ereignisse.push({ art: 'ende', zeitMs: jetzt, sieger, grund });

  const ueberlebende = alle.filter((s) => s.leben > 0).map(standVon);
  const schaden =
    sieger === null
      ? 0
      : schadenFuerVerlierer(
          ueberlebende.filter((k) => k.seite === sieger),
          regler.schadenStufenTeiler,
        );

  return {
    saat: alsText,
    erstZieher,
    start,
    ereignisse,
    sieger,
    grund,
    dauerMs: jetzt,
    ueberlebende,
    schaden,
  };
}

/**
 * Ein Kampfbericht als Zeichenkette, Zeile fuer Zeile.
 *
 * Nicht fuer die Oberflaeche, sondern fuer Proben und Fehlerberichte: Zwei
 * Laeufe zu vergleichen heisst dann, zwei Texte zu vergleichen, und die erste
 * abweichende Zeile nennt Zeitpunkt und Beteiligte. Ohne so eine Form endet
 * jede Determinismus-Probe in einer Objektdiagonale, in der niemand sieht,
 * WELCHES der vierhundert Ereignisse abweicht.
 */
export function protokollText(bericht: Kampfbericht): string {
  const zeilen = bericht.ereignisse.map((e) => {
    const zeit = String(e.zeitMs).padStart(6, ' ');
    switch (e.art) {
      case 'bewegung':
        return `${zeit} bewegung ${e.wer} ${e.von} -> ${e.nach}`;
      case 'treffer':
        return `${zeit} treffer  ${e.wer} -> ${e.ziel} ${e.schaden} (${e.lebenDanach})`;
      case 'heilung':
        return `${zeit} heilung  ${e.wer} -> ${e.ziel} ${e.menge} (${e.lebenDanach})`;
      case 'tod':
        return `${zeit} tod      ${e.wer}`;
      case 'ende':
        return `${zeit} ende     sieger=${e.sieger ?? '-'} grund=${e.grund}`;
    }
  });
  return zeilen.join('\n');
}

/** Alle Ueberlebenden einer Seite — das braucht die Partie fuer den Schaden. */
export function ueberlebendeVon(bericht: Kampfbericht, seite: Seite): readonly Kaempferstand[] {
  return bericht.ueberlebende.filter((k) => k.seite === seite);
}
