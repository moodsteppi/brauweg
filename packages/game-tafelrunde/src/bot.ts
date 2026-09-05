/**
 * Der Bot.
 *
 * Er bekommt ausschliesslich die gefilterte Sicht (game-api, `botAction`) und
 * kann deshalb bauartbedingt nicht schummeln — den Laden des Gegners sieht er
 * so wenig wie ein Mensch.
 *
 * Den KATALOG holt er sich dagegen direkt aus dem Modul und nicht aus der
 * Sicht. Das ist kein Umweg um die Filterung: Der Katalog ist oeffentlich, er
 * steht in jeder Sicht beim ersten Ausliefern. Aber er steht dort eben nur
 * beim ERSTEN, und ein Bot, der von der Belieferungsmarke abhinge, spielte je
 * nach Rundruf verschieden.
 *
 * WAS ER SPIELT. Bis zum 04.09.2026 kaufte er das Teuerste, was er sich
 * leisten konnte, schob es auf das naechstbeste freie Feld und stieg auf,
 * sobald das Gold reichte. Robin hat dagegen gespielt: "Sie sind da, aber sie
 * spielen nicht." Seitdem folgt er vier benannten Regeln, jede mit ihrer
 * eigenen Ueberschrift weiter unten:
 *
 *   1. KAUFEN NACH WERT — eine Verschmelzung schlaegt alles, danach zaehlen
 *      Paare, die Synergien der Marken und die reine Staerke.
 *   2. AUFSTELLEN NACH ROLLE — Wachen und Meuchler nach vorn, Schuetzen,
 *      Magier und Beistand nach hinten, Meuchler zusaetzlich an den Rand.
 *      WELCHE aufgestellt wird, entscheidet seit dem 05.09.2026 das ganze
 *      Brett und nicht die staerkste Einzelne (siehe `heerStaerke`).
 *   3. AUFSTIEG BEI VOLLEM BRETT — ein Feldplatz nuetzt nur, wenn etwas
 *      darauf steht.
 *   4. NEU-WUERFELN NUR BEI FREMDEM LADEN — wenn das Brett voll ist, kein
 *      Ladenplatz zum eigenen Heer passt und danach noch ein Kauf drin ist.
 *
 * EINE AKTION JE AUFRUF. Die Plattform ruft `botAction` so lange, bis der Bot
 * `bereit` meldet; jede Aktion geht einzeln ueber den Server. Dass diese
 * Schleife endet, ist deshalb keine Nebensache, sondern die Bedingung dafuer,
 * dass eine Runde ueberhaupt zu Ende geht. Sie endet, weil jede Aktion ein
 * Mass echt verkleinert, das nicht unter null kann:
 *
 *   - Kaufen, Neu-Wuerfeln und Aufsteigen kosten GOLD, und in der Vorbereitung
 *     kommt keines nach (der Bot verkauft nichts).
 *   - Die drei Stellungszuege verkleinern das Tripel (freie Feldplaetze,
 *     -Brettstaerke, Stellungskosten) der Reihe nach: Aufstellen den ersten
 *     Wert, Austauschen den zweiten, Umstellen den dritten. Jeder von ihnen
 *     laesst die davorstehenden unberuehrt. "Brettstaerke" ist dabei
 *     `heerStaerke` ueber das Brett — auch sie faellt nie und ist nach oben
 *     beschraenkt, der Beweis traegt also weiter.
 *
 * KEIN Math.random. Wo der Bot wuerfelt — und das tut er nur bei der
 * Patzerregel der leichten Gangarten —, kommt die Zahl aus `baueZufall` ueber
 * eine Saat, die sich vollstaendig aus der Sicht ergibt. Dieselbe Lage ergibt
 * damit denselben Zug, und zwar auf jedem Rechner (Grundsatz 1).
 */

import type { Kaempfer, TafelrundeAktion } from './partie.js';
import type { EigeneSicht, TafelrundeSicht } from './sicht.js';
import {
  type EinheitId,
  type Marke,
  type Wertebonus,
  KEIN_BONUS,
  einheit,
  werteFuer,
} from './katalog.js';
import { bonusFuerEinheit, zaehleMarken } from './synergien.js';
import { baueZufall } from './zufall.js';

// ---------------------------------------------------------------------------
// Gangarten
// ---------------------------------------------------------------------------

/**
 * Wie hart der Gegner spielt.
 *
 * Ein Parameter mit Vorgabe und kein Feld im Regelsatz: Der Tisch waehlt heute
 * noch keine Gangart aus, und eine Stellschraube, die niemand stellt, gehoert
 * nicht in `TafelrundeRegeln` — dort stuende sie in jedem gespeicherten
 * Snapshot und in jedem Konfigurationsformular.
 */
export type Schwierigkeit = 'sanft' | 'normal' | 'hart';

export interface Gangart {
  /**
   * Gold, das ab `POLSTER_AB_RUNDE` liegen bleibt.
   *
   * Sparen ist in diesem Spiel KEINE Staerke, und das war die Ueberraschung
   * der Messung: Der Zins ist bei 5 gedeckelt (`ZINS_MAX`), eine Partie zu
   * zweit dauert rund siebzehn Runden, und in dieser Zeit bringt ein
   * zurueckgehaltenes Gold weniger ein, als eine Einheit auf dem Brett wert
   * ist. Deshalb haelt hier der SANFTE Gegner am meisten zurueck, nicht der
   * harte — Horten ist die Schwaeche, die Robin an einem Menschen wiedererkennt.
   *
   * GAR NICHTS ZURUECKZUHALTEN IST TROTZDEM SCHLECHTER als ein kleines
   * Polster, und das ist keine Feinheit, sondern ein Vorzeichenwechsel: Auf 0
   * gestellt faellt `hart` unter seinen Wert bei 2 zurueck. Wer bis auf den
   * letzten Goldtaler kauft, fuellt die Bank mit Kleinkram — und eine volle
   * Bank laesst nur noch Verschmelzungskaeufe zu. Die Kurve steht bei
   * GANGARTEN; wer sie neu aufnehmen will, braucht dafuer keinen Eingriff hier
   * (`gangarten.mjs --schraube polster=…`).
   */
  readonly polster: number;
  /**
   * Was nach einem Aufstieg uebrig bleiben soll, um das neue Feld zu fuellen.
   *
   * Die schaerfste Schraube im Feld: zwischen 0 und 5 liegt bei `hart` der
   * Unterschied zwischen 221 und 32 Siegen je 400 Partien. Wer sie anfasst,
   * misst — die Zahlen stehen bei GANGARTEN.
   */
  readonly aufstiegsReserve: number;
  /**
   * Steigt er nur auf, wenn das Brett voll ist? Siehe AUFSTIEG BEI VOLLEM BRETT.
   *
   * Seit dem 06.09.2026 sagen ALLE DREI Gangarten hier ja. `hart` sagte bis
   * dahin nein, und das kostete es rund 57 Siege je 400 Partien: Ein Feldplatz
   * ohne Einheit darauf ist bezahlter Leerstand.
   */
  readonly nurBeiVollemBrett: boolean;
  /** Wuerfelt er einen Laden neu, der nicht zu ihm passt? */
  readonly wuerfeltNeu: boolean;
  /**
   * Wie oft er statt des besten einen beliebigen bezahlbaren Kauf nimmt.
   *
   * Ein schwaecherer Gegner soll nicht weniger TUN — ein Bot mit halb leerer
   * Bank war der Anlass dieser Arbeit —, sondern schlechter WAEHLEN. Deshalb
   * kauft auch der sanfte in jeder Runde und fuellt sein Brett; er kauft nur
   * oft das Falsche.
   */
  readonly patzerQuote: number;
  /**
   * Greift er jedes Mal zu, wenn ein Kauf sofort verschmilzt?
   *
   * Was in diesem Spiel ueber Sieg und Niederlage entscheidet, ist die
   * Sternstufe: Eine Verschmelzung hebt Leben und Angriff auf das 1,8-fache,
   * im Zusammenspiel also auf gut das Dreifache. Wer sie mitnimmt, gewinnt.
   * Nur der sanfte Gegner darf sie verpassen.
   */
  readonly nimmtVerschmelzungImmer: boolean;
}

/**
 * Die drei Gangarten.
 *
 * `normal` ist die Vorgabe und zugleich die Fassung, die nach Lehrbuch spielt:
 * ab Runde 4 ein Polster von vier Gold, Aufstieg nur bei vollem Brett und erst
 * mit drei Gold Reserve darauf, selten ein Fehlgriff. `hart` spielt auf TEMPO —
 * halb so grosses Polster, keine Reserve nach dem Aufstieg, kein Fehlgriff.
 * `sanft` sitzt auf seinem Gold, steigt spaet auf, greift meist blind zu und
 * verpasst Verschmelzungen.
 *
 * TEMPO HEISST SEIT DEM 06.09.2026 ETWAS ANDERES, und das ist die Aenderung,
 * um die es in diesem Absatz geht. Vorher liess `hart` beim Aufstieg BEIDE
 * Bedingungen von `normal` weg — keine Reserve UND kein volles Brett —, und
 * das hiess zusammen "kein Zoegern". Von den beiden traegt nur die erste: Ein
 * Bot ohne die Bedingung "Brett voll" kauft Feldplaetze, auf denen nichts
 * steht, und in einer Partie ueber neun Runden holt er das nicht mehr ein.
 * Sie war also nicht wirkungslos, wie es einen Tag lang aussah, sondern ein
 * Nachteil. Beide Haelften einzeln gemessen (sechs unabhaengige Saatbasen zu
 * je 400 Partien zu viert, Schnitt der Siege von Sitz 0 je 400 — 100 waere
 * unentschieden):
 *
 *     wie vorher: Polster 4, ohne volles Brett          133
 *     nur das volle Brett wieder gefordert              190
 *     nur das Polster auf 2                             156
 *     beides zusammen — der heutige Stand               221
 *
 * Die Reserve bleibt bei 0, und sie ist die Schraube, die das Tempo heute
 * traegt: `hart` steigt auf, sobald das Brett voll ist und das Gold GENAU
 * reicht, waehrend `normal` noch drei Gold obendrauf sehen will. Auf drei
 * gesetzt faellt er von 221 auf 166, auf fuenf auf 32 — die Reserve ist die
 * schaerfste Schraube im Feld, und der sanfte Gegner ist mit seinen sechs
 * genau deshalb schwach.
 *
 * DAS POLSTER HAT EIN OPTIMUM UND KEINE RICHTUNG. Von 4 auf 2 gewinnt `hart`
 * (190 → 221), von 2 auf 0 verliert es wieder (175). Wer daraus "weniger
 * sparen ist immer besser" liest, hat die Kurve nicht gemessen: Wer bis auf
 * den letzten Goldtaler kauft, fuellt seine Bank mit Kleinkram, und eine volle
 * Bank laesst nur noch Verschmelzungskaeufe zu (`passeBankAn` in partie.ts).
 * Gemessen wurde 0/1/2/3/4 — 175 / 193 / 221 / 208 / 190.
 *
 * DASS DIE REIHENFOLGE STIMMT, IST GEMESSEN und nicht geschaetzt — je 400
 * Partien zu viert, ein Sitz mit der starken Gangart gegen drei mit der
 * schwachen, gezaehlt werden eindeutige Siege. Rechts steht der SCHNITT der
 * drei schwachen Sitze, und ueber zwei unabhaengige Saatbasen, weil eine
 * einzelne nichts beweist (`werkzeug/gangarten.mjs`, Stand 06.09.2026):
 *
 *                    gebaut (12 Leben, x2)     langer Stand (20 Leben, x1)
 *     hart : normal   228 : 57,3  231 : 56,3    190 : 70,0  201 : 66,3
 *     hart : sanft    386 :  4,7  389 :  3,7    384 :  5,3  385 :  5,0
 *     normal : sanft  372 :  9,3  367 : 11,0    362 : 12,7  349 : 17,0
 *
 * DASS BEIDE SPALTEN DASSELBE SAGEN, IST DER PUNKT: Die Reihenfolge haengt
 * nicht an der Partielaenge. Die zweite Spalte ist der lange Stand (20 Leben,
 * kein Zeitraffer, rund fuenfzehn Runden) und wird von der letzten Probe in
 * bot.test.ts mitgeprueft — die Rundenzahl ist die Zahl, an der Robin dreht,
 * und eine darauf geeichte Gangart faellt sonst erst der uebernaechsten
 * Umstellung auf. Auch das DUELL zu zweit traegt sie inzwischen (315 : 84,5 je
 * 400 Partien, sechs Basen); dort lag `hart` nach der Kuerzung des
 * Lebensbalkens einmal hinten — 96 : 104 —, und das war der Grund, aus dem zu
 * viert gemessen wird. Der Grund ist damit weg, die Besetzung bleibt: Zu viert
 * ist die Besetzung, auf die das Spiel eingestellt ist.
 *
 * WAS `HART` TRAEGT, traegt es aus vier Schrauben und nicht aus einer. Je eine
 * davon auf den Wert einer schwaecheren Gangart zurueckgedreht (die drei
 * Zahlen auf `normal`, das Neu-Wuerfeln auf `sanft`), sechs Saatbasen zu je
 * 400 Partien, Schnitt je 400:
 *
 *     `hart` wie gebaut                          221
 *     mit dem Polster von `normal` (4)           190
 *     ohne die Patzerfreiheit (0,15)             177
 *     ohne das Neu-Wuerfeln                      172
 *     mit der Reserve von `normal` (3)           166
 *     alle drei Zahlen zugleich auf `normal`     110
 *
 * Jede einzelne liegt weit ausserhalb des Standardfehlers (rund 10 Siege bei
 * 400 Partien). Bis zum 06.09.2026 stand hier das Gegenteil: Damals trug allein
 * die fehlende Patzerquote, und die Tempo-Schrauben lagen innerhalb der
 * Streuung. Das war richtig gemessen und ist der Anlass dieser Aenderung
 * gewesen — eine Charakterisierung ohne Wirkung ist keine.
 *
 * DIE VERGLEICHE OBEN SIND GEPAART, und deshalb zaehlen dort auch kleine
 * Unterschiede: `werkzeug/gangarten.mjs` baut die Saat jeder Partie aus der
 * Saatbasis und den NAMEN der beiden Gangarten, nicht aus ihren Werten. Zwei
 * Laeufe mit `--schraube` sehen also dieselben Laeden, dieselben Gegner und
 * dieselben Kaempfe; verglichen wird die Entscheidung und nicht die
 * Stichprobe. Nur der Sprung nach `--stark normal` zieht eine andere
 * Stichprobe — daher steht in der letzten Zeile 110 und nicht die 98,7 des
 * Kontrolllaufs. Diese Differenz ist Streuung und kein Sitzvorteil.
 *
 * DER KONTROLLLAUF IST WIEDER NEUTRAL, und das gehoert vor jede dieser Zahlen:
 * Besetzt man ALLE VIER Sitze gleich, gewinnt Sitz 0 ueber sechs Saatbasen zu
 * je 400 Partien 98,7 mal mit `normal`, 100,2 mit `hart` und 107,5 mit `sanft`
 * — gegen 100 im Schnitt. Am 05.09.2026 stand hier noch ein Sitzvorteil von
 * 110 bis 116 mit `normal`, gemessen ueber drei Basen; ueber sechs sind es
 * 101,7 (bei 14 Leben) und 98,7 (bei 12). Der Vorteil war eine Stichprobe.
 * DIE URSACHE IST TROTZDEM NICHT WEG und kann jederzeit wiederkommen: Der
 * VORRAT ist gemeinsam (partie.ts, `vorrat`), Bots auf Marken wollen alle
 * dieselben Einheiten, und der Messstand laesst die Sitze der Reihe nach
 * ruesten — wer zuerst kauft, bekommt sie. Am echten Tisch ruesten alle
 * gleichzeitig; der Druck auf den Vorrat ist aber derselbe. Dass ausgerechnet
 * `sanft` ueber 100 liegt, passt dazu: Wer hortet, kauft spaeter. Wer eine
 * Gangart misst, misst den Kontrolllauf mit.
 *
 * WAS DIE ZAHLEN SCHON ZWEIMAL GEKIPPT HAT, WAR DER LADEN. Am 05.09.2026
 * verlor `hart` gegen `normal` (77 : 107,7) — nicht wegen der kurzen Partie
 * und schon gar nicht wegen des Zeitraffers (bei 20 Leben bewegt er die Zahl
 * von 110 auf 114), sondern weil ein Kauf damals nur SEINEN Ladenplatz leerte:
 * Ein frueh vergroessertes Brett bekam man nicht mehr voll. Seit ein Kauf den
 * ganzen Laden neu zieht, traegt sich der Ausbau wieder. Der Wurfpreis war es
 * dagegen nie — mit wieder eingeschaltetem Preis von 2 Gold gewinnt `hart`
 * sogar deutlicher. WER DEN LADEN ANFASST, MISST DIE GANGARTEN MIT.
 *
 * Der erste Anlauf hatte die Schrauben andersherum gesetzt — der harte Gegner
 * sparte am meisten und stieg am vorsichtigsten auf — und lag danach ueber 40
 * Partien mit 19:21 GLEICHAUF mit dem sanften. Wer hier etwas verstellt, misst
 * bitte nach, und zwar ohne diese Datei anzufassen:
 * `node packages/game-tafelrunde/werkzeug/gangarten.mjs --schraube polster=0`
 * stellt eine einzelne Schraube um. Die Probe steht in test/bot.test.ts
 * (imFeld).
 */
export const GANGARTEN: Readonly<Record<Schwierigkeit, Gangart>> = {
  sanft: {
    polster: 8,
    aufstiegsReserve: 6,
    nurBeiVollemBrett: true,
    wuerfeltNeu: false,
    patzerQuote: 0.75,
    nimmtVerschmelzungImmer: false,
  },
  normal: {
    polster: 4,
    aufstiegsReserve: 3,
    nurBeiVollemBrett: true,
    wuerfeltNeu: true,
    patzerQuote: 0.15,
    nimmtVerschmelzungImmer: true,
  },
  hart: {
    polster: 2,
    aufstiegsReserve: 0,
    nurBeiVollemBrett: true,
    wuerfeltNeu: true,
    patzerQuote: 0,
    nimmtVerschmelzungImmer: true,
  },
};

/**
 * Vor dieser Runde bleibt kein Gold liegen.
 *
 * In den ersten drei Runden ist jedes zurueckgehaltene Gold verschenkt: Der
 * Zins beginnt erst bei zehn, das Brett hat ein bis drei Plaetze, und wer sie
 * leer laesst, verliert die Kaempfe, die den Rest der Partie bezahlen.
 */
const POLSTER_AB_RUNDE = 4;

// ---------------------------------------------------------------------------
// Bewertung einer Einheit
// ---------------------------------------------------------------------------

/**
 * Damit die Staerken dreistellig bleiben und nicht sechsstellig. Reine
 * Lesbarkeit — verglichen werden sie nur untereinander.
 */
const STAERKE_TEILER = 100;

/**
 * Wie viel eine Einheit dem Bot wert ist: was sie aushaelt MAL dem, was sie
 * austeilt.
 *
 * Das Produkt und nicht die Summe, und das ist der Kern der Bewertung: Eine
 * Einheit teilt so lange aus, wie sie steht, ihr Beitrag ist also beides
 * miteinander. Addiert man stattdessen, gewinnt jeder Sandsack — der
 * Schildknappe (700 Leben, 45 Ruestung, aber knapp 17 Schaden je Sekunde)
 * stuende dann vor jedem Angreifer, und der Bot baute ein Heer, das nichts
 * umbringt.
 *
 * Die Ruestung ist ein Faktor auf das Leben und keine Zugabe: Der Kampf
 * mindert jeden Treffer um ihren Prozentsatz (`schadenNach` in kampf.ts), 50
 * Ruestung verdoppeln also das, was eine Einheit aushaelt.
 *
 * Was hier NICHT eingeht, ist die Reichweite — ein Schuetze mit denselben
 * Werten ist mehr wert als ein Nahkaempfer. Der Bot faengt das ueber die
 * Stellung ab (Schuetzen nach hinten) und nicht ueber einen weiteren
 * geschaetzten Faktor.
 *
 * Den Kampf wirklich durchrechnen zu lassen waere verlockend und falsch: Der
 * Bot entscheidet mehrmals je Runde, und `simuliereKampf` ist die teuerste
 * Rechnung des Moduls.
 *
 * Der `bonus` ist der Synergie-Aufschlag, den die Einheit in IHRER Umgebung
 * bekommt (siehe `heerStaerke`). Ohne ihn misst die Funktion die nackte
 * Einheit — das ist der richtige Wert ueberall dort, wo zwei Einheiten
 * unabhaengig von ihren Nachbarn verglichen werden.
 */
function staerke(k: Kaempfer, bonus: Wertebonus = KEIN_BONUS): number {
  const w = werteFuer(k.id, k.stufe, bonus);
  const haelt = (w.leben * 100) / Math.max(1, 100 - w.ruestung);
  const teiltAus = w.angriff * w.tempo;
  return Math.round((haelt * teiltAus) / STAERKE_TEILER);
}

/**
 * Was eine ZUSAMMENSTELLUNG wert ist: die Summe der Staerken, jede mit dem
 * Bonus, den ihre Marken bei genau dieser Zusammenstellung geben.
 *
 * Damit sieht der Bot die Synergien ueberhaupt erst. Bis zum 05.09.2026 tat er
 * das nicht: Sein einziger Markenbegriff war ein Aufschlag von 25 Punkten je
 * schon vertretenem Gefaehrten (`MARKEN_GEWICHT`), gegen Einheitenstaerken von
 * 130 bis 970. Gemessen ueber 2.000 Partien zu viert hielt eine Marke die
 * Schwelle 4 in 1,2 % der Antritte und die Schwelle 6 in KEINEM einzigen —
 * die halbe Synergietabelle war damit tot, und ob sie zu hoch angesetzt ist,
 * war gar nicht entscheidbar, solange niemand auf sie hinspielte.
 *
 * Der Aufschlag ist eine STUFENFUNKTION und keine Gerade — genau das konnte
 * die alte Zahl nicht abbilden. Der vierte Krieger ist ein Sprung fuer alle
 * vier, der fuenfte bringt bis zur naechsten Schwelle nichts. Wer diesen
 * Unterschied nicht sieht, sammelt breit statt tief und kommt nie an.
 *
 * Gezaehlt wird ueber die uebergebene Liste, und WELCHE das ist, entscheidet
 * die Aufrufstelle: Beim Aufstellen ist es das Brett (nur dort zaehlen die
 * Marken, siehe synergien.ts), beim Kaufen das ganze Heer samt Bank (die
 * vierte Einheit einer Marke liegt zuerst auf der Bank — wer nur das Brett
 * zaehlte, kaufte sie nie).
 *
 * Der Preis ist eine Zaehlung und eine Bonusrechnung je Einheit, bei
 * hoechstens 18 Einheiten. Das ist etwas anderes als `simuliereKampf`, vor dem
 * der Kommentar oben warnt: Hier wird nichts iteriert, nur addiert.
 */
function heerStaerke(einheiten: readonly Kaempfer[]): number {
  const zaehlung = zaehleMarken(einheiten);
  let summe = 0;
  for (const k of einheiten) summe += staerke(k, bonusFuerEinheit(k.id, zaehlung));
  return summe;
}

/** Alle eigenen Einheiten, Brett und Bank zusammen. */
function eigeneEinheiten(eigen: EigeneSicht): Kaempfer[] {
  return [...eigen.brett, ...eigen.bank].filter((k): k is Kaempfer => k !== null);
}

/** Wie viele Kopien der untersten Stufe schon da sind — die verschmelzen. */
function kopienVon(eigene: readonly Kaempfer[], id: EinheitId): number {
  return eigene.filter((k) => k.id === id && k.stufe === 1).length;
}

/** Wie oft jede Marke im eigenen Heer vertreten ist. */
function markenZaehlung(eigene: readonly Kaempfer[]): Map<Marke, number> {
  const zaehlung = new Map<Marke, number>();
  for (const k of eigene) {
    for (const marke of einheit(k.id).marken) {
      zaehlung.set(marke, (zaehlung.get(marke) ?? 0) + 1);
    }
  }
  return zaehlung;
}

// ---------------------------------------------------------------------------
// 2. AUFSTELLEN NACH ROLLE
// ---------------------------------------------------------------------------

/**
 * Reihe 0 ist die vorderste — sie liegt in der Arena an der Mittellinie, und
 * zwar fuer BEIDE Seiten (siehe `nachArena` in arena.ts). Wer das verwechselt,
 * stellt seine Wachen in die hinterste Reihe und schickt die Magier voran.
 */
const VORDERSTE_REIHE = 0;

/** Eine falsche Reihe wiegt schwerer als eine falsche Spalte. */
const REIHEN_GEWICHT = 10;

/** Und ein Meuchler in der Mitte schwerer als eine Wache neben der Mitte. */
const RAND_GEWICHT = 2;

/**
 * Wie schlecht dieser Platz fuer diese Einheit ist. Null ist ideal.
 *
 * Die Rolle steht im Katalog, die Vorlieben sind die des Kampfes:
 *
 *   - `wache` nach vorn und in die Mitte. Sie soll zuerst getroffen werden,
 *     und in der Mitte deckt sie mehr Nachbarfelder (Sechseckraster, sechs
 *     Nachbarn statt vier).
 *   - `schuetze`, `magier`, `beistand` nach hinten und in die Mitte. Alle drei
 *     haben Reichweite 2 bis 4 und wenig Leben; vorn sterben sie, bevor sie
 *     zweimal geschossen haben. Der Beistand steht ausdruecklich dabei,
 *     obwohl die Aufgabe ihn nicht nennt: Mit Reichweite 2 und dem niedrigsten
 *     Angriff des Katalogs gehoert er nirgendwo anders hin.
 *   - `meuchler` nach vorn an den RAND. Er hat Reichweite 1 und das hoechste
 *     Tempo; am Rand laeuft er an der gegnerischen Front vorbei, statt sich in
 *     ihr festzubeissen.
 *
 * `reihen` und `spalten` kommen aus der Sicht und nicht aus brett.ts: Die
 * beiden Zahlen stehen dort, damit niemand sie nachbaut — auch der Bot nicht.
 */
function platzStrafe(k: Kaempfer, platz: number, reihen: number, spalten: number): number {
  const reihe = Math.floor(platz / spalten);
  const spalte = platz % spalten;
  const nachHinten = reihen - 1 - reihe;
  const zurMitte = Math.abs(spalte - (spalten - 1) / 2);
  const zumRand = Math.min(spalte, spalten - 1 - spalte);

  switch (einheit(k.id).rolle) {
    case 'wache':
      return REIHEN_GEWICHT * (reihe - VORDERSTE_REIHE) + zurMitte;
    case 'meuchler':
      return REIHEN_GEWICHT * (reihe - VORDERSTE_REIHE) + RAND_GEWICHT * zumRand;
    default:
      return REIHEN_GEWICHT * nachHinten + zurMitte;
  }
}

/** Der beste freie Platz fuer diese Einheit; bei Gleichstand der kleinste. */
function bestesFeld(
  k: Kaempfer,
  freie: readonly number[],
  reihen: number,
  spalten: number,
): number {
  let bester = freie[0]!;
  let beste = platzStrafe(k, bester, reihen, spalten);
  for (const platz of freie) {
    const strafe = platzStrafe(k, platz, reihen, spalten);
    if (strafe < beste) {
      bester = platz;
      beste = strafe;
    }
  }
  return bester;
}

interface Stelle {
  readonly platz: number;
  readonly k: Kaempfer;
}

/**
 * Welche Einheit der Bank das Brett am meisten hebt. Bei Gleichstand die am
 * weitesten links — die feste Reihenfolge ist dieselbe Zusage wie bei
 * `kandidaten`: dieselbe Lage, derselbe Zug (Grundsatz 1).
 */
function besteZugabe(brett: readonly Kaempfer[], bank: readonly Stelle[]): Stelle {
  let beste = bank[0]!;
  let bester = heerStaerke([...brett, beste.k]);
  for (const stelle of bank.slice(1)) {
    const wert = heerStaerke([...brett, stelle.k]);
    if (wert > bester) {
      beste = stelle;
      bester = wert;
    }
  }
  return beste;
}

/**
 * Der beste Tausch Bank gegen Brett, oder null, wenn keiner das Brett ECHT
 * staerker macht.
 *
 * Das "echt" ist kein Feinschliff, sondern der Abbruch: Ohne es schoebe der
 * Bot zwei gleichwertige Einheiten bis zum Zeitablauf hin und her (siehe
 * `stellungsZug`). Jeder Tausch hebt `heerStaerke` des Bretts um mindestens
 * einen Punkt, und die Zahl ist nach oben beschraenkt — damit endet die
 * Aufrufschleife.
 */
function besterTausch(
  brett: readonly Kaempfer[],
  stehen: readonly Stelle[],
  bank: readonly Stelle[],
): { readonly vonBank: number; readonly aufsBrett: number } | null {
  let bester = heerStaerke(brett);
  let gefunden: { vonBank: number; aufsBrett: number } | null = null;

  for (const vonBank of bank) {
    for (let i = 0; i < stehen.length; i += 1) {
      const danach = brett.slice();
      danach[i] = vonBank.k;
      const wert = heerStaerke(danach);
      if (wert > bester) {
        bester = wert;
        gefunden = { vonBank: vonBank.platz, aufsBrett: stehen[i]!.platz };
      }
    }
  }
  return gefunden;
}

/**
 * Der naechste Zug am eigenen Brett, oder null, wenn nichts zu ruecken ist.
 *
 * Drei Faelle in dieser Reihenfolge, und die Reihenfolge ist zugleich der
 * Beweis, dass die Aufrufschleife endet (siehe Dateikopf):
 *
 *   a) AUFSTELLEN: ein Feldplatz frei und etwas auf der Bank.
 *   b) AUSTAUSCHEN: Brett voll, aber auf der Bank steht etwas Staerkeres.
 *   c) UMSTELLEN: dieselben Einheiten stehen besser, wenn eine auf ein freies
 *      Feld rueckt oder zwei ihre Plaetze tauschen.
 *
 * Fall (b) und (c) verlangen einen ECHTEN Gewinn. Ohne dieses "echt" schoebe
 * der Bot zwei gleich gute Einheiten bis zum Zeitablauf hin und her, und die
 * Runde endete nie.
 */
function stellungsZug(sicht: TafelrundeSicht, eigen: EigeneSicht): TafelrundeAktion | null {
  const reihen = sicht.brettReihen;
  const spalten = sicht.brettSpalten;

  const freie: number[] = [];
  const stehen: Stelle[] = [];
  eigen.brett.forEach((k, platz) => {
    if (k === null) freie.push(platz);
    else stehen.push({ platz, k });
  });

  const bank: Stelle[] = [];
  eigen.bank.forEach((k, platz) => {
    if (k !== null) bank.push({ platz, k });
  });

  /*
   * Gemessen wird das BRETT und nicht das Heer: Die Synergien zaehlen nur, was
   * aufgestellt ist (synergien.ts). Deshalb steht hier `heerStaerke` ueber
   * `aufDemBrett` und nicht ueber `eigeneEinheiten` — sonst bekaeme eine
   * Einheit den Bonus von Gefaehrten angerechnet, die auf der Bank zusehen.
   */
  const aufDemBrett = stehen.map((s) => s.k);

  // a) Aufstellen. Ein freies Brettfeld allein genuegt nicht — die Grenze ist
  //    `feldplaetze`, und darueber hinaus weist `fuehreAus` den Zug ab.
  //
  //    Welche der Bank hinaufkommt, entscheidet seit dem 05.09.2026 das ganze
  //    Brett und nicht mehr die nackte Staerke der Einzelnen: Der vierte
  //    Krieger kann schwaecher sein als der zweite Meuchler und trotzdem der
  //    richtige Zug, weil er drei andere mit hebt. Wer hier nach Einzelstaerke
  //    aufstellt, kauft zwar auf Marken hin (siehe KAUFEN NACH WERT), stellt
  //    sie aber nie auf — und die Schwelle bleibt so leer wie vorher.
  if (eigen.belegt < eigen.feldplaetze && freie.length > 0 && bank.length > 0) {
    const beste = besteZugabe(aufDemBrett, bank);
    return {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: beste.platz },
      nach: { bereich: 'brett', platz: bestesFeld(beste.k, freie, reihen, spalten) },
    };
  }

  // b) Austauschen. Ein Tausch aendert die Belegung nicht und ist deshalb auch
  //    bei vollem Brett erlaubt (siehe `verschieben` in fuehreAus).
  //
  //    Gesucht wird das beste PAAR aus Bank und Brett und nicht mehr die
  //    staerkste gegen die schwaechste: Ein Tausch kann die Marke des
  //    Abgeloesten unter eine Schwelle druecken und damit trotz staerkerer
  //    Einzeleinheit ein schwaecheres Brett hinterlassen.
  const tausch = besterTausch(aufDemBrett, stehen, bank);
  if (tausch !== null) {
    return {
      typ: 'verschieben',
      von: { bereich: 'bank', platz: tausch.vonBank },
      nach: { bereich: 'brett', platz: tausch.aufsBrett },
    };
  }

  // c) Umstellen: erst der Umzug auf ein freies Feld, dann der Tausch zweier
  //    Einheiten. Beides bewegt nur, was schon steht — die Belegung bleibt.
  for (const { platz, k } of stehen) {
    const jetzt = platzStrafe(k, platz, reihen, spalten);
    if (freie.length === 0) break;
    /*
     * Auf das BESTE freie Feld und nicht auf das erstbeste bessere.
     *
     * Bis zum 06.09.2026 nahm diese Schleife das erste Feld aus `freie`, das
     * ueberhaupt eine Verbesserung war. `freie` laeuft aufsteigend, also von
     * Reihe 0 nach hinten — fuer eine Wache ist das gerade richtig, fuer
     * Schuetze, Magier und Beistand aber genau verkehrt herum: Sie bekamen
     * zuerst ein etwas besseres Feld in derselben Reihe, im naechsten Aufruf
     * eine Reihe weiter, und so fort. Ein Umzug wurde so zu bis zu drei.
     *
     * Auf zwei Reihen fiel das kaum auf, auf vieren schon: Der fleissigste
     * Sitz einer Runde kam damit auf 43 Handgriffe statt 23 und riss in
     * 0,72 % der Runden die Rundenfrist von 45 s (spielzeit.test.ts). Mit dem
     * besten Feld sind es 18 — weniger als die 23 von vorher, auf zwei Reihen
     * 17 statt 23. Der Bot stellt dasselbe auf, nur in einem Zug statt in
     * dreien.
     */
    const bestes = bestesFeld(k, freie, reihen, spalten);
    if (platzStrafe(k, bestes, reihen, spalten) < jetzt) {
      return {
        typ: 'verschieben',
        von: { bereich: 'brett', platz },
        nach: { bereich: 'brett', platz: bestes },
      };
    }
  }
  for (const eins of stehen) {
    for (const zwei of stehen) {
      if (zwei.platz <= eins.platz) continue;
      const vorher =
        platzStrafe(eins.k, eins.platz, reihen, spalten) +
        platzStrafe(zwei.k, zwei.platz, reihen, spalten);
      const nachher =
        platzStrafe(eins.k, zwei.platz, reihen, spalten) +
        platzStrafe(zwei.k, eins.platz, reihen, spalten);
      if (nachher < vorher) {
        return {
          typ: 'verschieben',
          von: { bereich: 'brett', platz: eins.platz },
          nach: { bereich: 'brett', platz: zwei.platz },
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 1. KAUFEN NACH WERT
// ---------------------------------------------------------------------------

/**
 * Was eine dritte Kopie wert ist.
 *
 * Die Drei ist geschaetzt, aber nicht gegriffen: Die naechste Sternstufe hebt
 * Leben UND Angriff auf das 1,8-fache (`STUFEN_FAKTOR`), im Produkt der beiden
 * also auf gut das Dreifache. Genau das ist die Staerke, die aus den drei
 * Karten wird.
 */
const VERSCHMELZ_FAKTOR = 3;

/** Und was eine zweite wert ist — der halbe Weg dorthin. */
const PAAR_FAKTOR = 1.5;

/**
 * Was die MARKEN dieses Kaufs zusaetzlich wert sind — der Zuwachs, den das
 * Heer allein aus den Synergien hat, wenn diese Einheit dazukommt.
 *
 * Er enthaelt beides: was die Neue von den schon vertretenen bekommt, und was
 * sie allen anderen Traegern ihrer Marken gibt. Abgezogen wird ihre nackte
 * Staerke, denn die steht in `kandidaten` schon in der Rechnung.
 *
 * BIS ZUM 05.09.2026 STAND HIER EINE ZAHL: `MARKEN_GEWICHT = 25` je schon
 * vertretenem Gefaehrten, gegen Einheitenstaerken von 130 bis 970 — und linear
 * obendrein, wo die Synergietabelle Stufen kennt. Der Bot spielte damit
 * messbar gar nicht auf Marken hin. Die Zahl ist ersatzlos weg: Was eine Marke
 * wert ist, steht in synergien.ts und wird hier ausgerechnet, nicht geschaetzt.
 * Wer dort einen Bonus aendert, aendert das Kaufverhalten mit — vorher musste
 * er daran denken, hier eine zweite Zahl nachzuziehen.
 *
 * Die Verschmelzung ist hier NICHT abgebildet: Drei Kopien werden zu einer,
 * die Marke faellt also von drei Traegern auf einen zurueck. Diese Einbusse
 * sieht der Bot nicht — sie waere eine zweite Fassung der Verschmelzregel im
 * Haus (siehe `kandidaten`), und der Aufstieg auf die naechste Sternstufe
 * ueberwiegt sie ohnehin deutlich.
 */
function markenGewinn(eigene: readonly Kaempfer[], id: EinheitId): number {
  const neu: Kaempfer = { id, stufe: 1 };
  return heerStaerke([...eigene, neu]) - heerStaerke(eigene) - staerke(neu);
}

interface Kandidat {
  readonly platz: number;
  readonly id: EinheitId;
  /** Vervollstaendigt der Kauf sofort eine Verschmelzung? */
  readonly verschmilzt: boolean;
  readonly wert: number;
}

/**
 * Alle Ladenplaetze, die der Bot kaufen KOENNTE, mit ihrem Wert — der beste
 * zuerst, bei Gleichstand der am weitesten links.
 *
 * Die feste Reihenfolge ist kein Schoenheitsfehler: Derselbe Laden muss
 * denselben Kauf ergeben, sonst haengt die Partie an der Sortierung der
 * Laufzeit (Grundsatz 1).
 */
function kandidaten(sicht: TafelrundeSicht, eigen: EigeneSicht, polster: number): Kandidat[] {
  const eigene = eigeneEinheiten(eigen);
  const bankFrei = eigen.bank.includes(null);
  const noetig = sicht.verschmelzZahl - 1;

  const gefunden: Kandidat[] = [];
  eigen.laden.forEach((id, platz) => {
    if (id === null) return;
    const art = einheit(id);
    if (art.kosten > eigen.gold) return;

    /*
     * Bei voller Bank ist nur der Kauf erlaubt, der sofort verschmilzt (siehe
     * `passeBankAn` in partie.ts). Der Bot ZAEHLT dafuer nur Kopien; die
     * Verschmelzregel baut er nicht nach, die Zahl dazu nimmt er aus der
     * Sicht. Wer hier die Kettenreaktion nachrechnen wollte, haette dieselbe
     * Regel zweimal im Haus — und zwei Fassungen laufen auseinander.
     */
    const kopien = kopienVon(eigene, id);
    const verschmilzt = kopien >= noetig;
    if (!bankFrei && !verschmilzt) return;

    /*
     * Das Polster gilt fuer den Verschmelzungskauf NICHT. Er ist der einzige
     * Kauf, der drei Karten zu einer macht und dabei Bankplatz freiraeumt —
     * ihn wegen zweier Goldstuecke liegen zu lassen waere in jeder Lage
     * falsch.
     */
    if (!verschmilzt && eigen.gold - art.kosten < polster) return;

    let wert = staerke({ id, stufe: 1 });
    if (verschmilzt) wert *= VERSCHMELZ_FAKTOR;
    else if (kopien > 0) wert *= PAAR_FAKTOR;
    wert += markenGewinn(eigene, id);

    gefunden.push({ platz, id, verschmilzt, wert });
  });

  return gefunden.sort((a, b) => b.wert - a.wert || a.platz - b.platz);
}

/**
 * Eine Zufallszahl aus der Lage.
 *
 * Die Saat entsteht vollstaendig aus der Sicht: Runde, Sitz, Gold, Level und
 * was in Laden, Bank und Brett liegt. Damit ist der Zug nachrechenbar
 * (dieselbe Lage, derselbe Wurf) und trotzdem nicht in jedem Aufruf derselbe —
 * nach jedem Kauf steht eine andere Lage da.
 *
 * Der `zweck` trennt die Stroeme: Zwei Entscheidungen in derselben Lage sollen
 * nicht dieselbe Zahl bekommen.
 */
function wurf(sicht: TafelrundeSicht, eigen: EigeneSicht, zweck: string): number {
  const zeichen = (k: Kaempfer | null) => (k === null ? '-' : `${k.id}${k.stufe}`);
  const saat = [
    'tafelrunde-bot',
    zweck,
    sicht.runde,
    eigen.sitz,
    eigen.gold,
    eigen.level,
    eigen.laden.map((id) => id ?? '-').join(','),
    eigen.bank.map(zeichen).join(','),
    eigen.brett.map(zeichen).join(','),
  ].join('|');
  return baueZufall(saat)();
}

/**
 * GENAU EIN Kauf, danach ist Schluss.
 *
 * `kandidaten` liefert zwar eine sortierte Liste, aber sie darf nie als
 * Einkaufszettel abgearbeitet werden: Seit dem 05.09.2026 zieht ein Kauf den
 * GANZEN Laden neu (partie.ts, Fall 'kaufen'). Der zweitbeste Platz von eben
 * liegt danach nicht mehr aus — wer hier zwei Aktionen hintereinander baute,
 * kaufte den Platz einer Karte, die inzwischen eine andere ist. Der Bot wird
 * ohnehin so lange gerufen, bis er "bereit" meldet, und sieht bei jedem Ruf
 * den frischen Laden.
 */
function kaufZug(
  sicht: TafelrundeSicht,
  eigen: EigeneSicht,
  gangart: Gangart,
): TafelrundeAktion | null {
  const polster = sicht.runde >= POLSTER_AB_RUNDE ? gangart.polster : 0;
  const moeglich = kandidaten(sicht, eigen, polster);
  if (moeglich.length === 0) return null;

  const bester = moeglich[0]!;
  /*
   * Der Verschmelzungskauf ist bei `normal` und `hart` von der Patzerregel
   * ausgenommen: "Wer drei gleiche zusammenbekommt, nimmt sie" ist die Regel,
   * die dieses Spiel ausmacht. Nur der sanfte Gegner darf sie verpassen — und
   * genau daran haengt, dass er schwaecher ist als die anderen beiden.
   */
  if (bester.verschmilzt && gangart.nimmtVerschmelzungImmer) {
    return { typ: 'kaufen', platz: bester.platz };
  }

  /*
   * Gepatzt wird nicht "eine Stufe schlechter", sondern blind: irgendein
   * bezahlbarer Ladenplatz. Der zweitbeste Kauf war messbar kaum schlechter
   * als der beste — drei Gangarten, die sich nur darin unterschieden, lagen
   * ueber 40 Partien gleichauf.
   */
  if (moeglich.length > 1 && wurf(sicht, eigen, 'kauf') < gangart.patzerQuote) {
    const gewaehlt = Math.min(
      moeglich.length - 1,
      Math.floor(wurf(sicht, eigen, 'patzer') * moeglich.length),
    );
    return { typ: 'kaufen', platz: moeglich[gewaehlt]!.platz };
  }
  return { typ: 'kaufen', platz: bester.platz };
}

// ---------------------------------------------------------------------------
// 3. AUFSTIEG BEI VOLLEM BRETT
// ---------------------------------------------------------------------------

/**
 * Aufsteigen, wenn das Brett voll ist und danach noch Gold fuer das neue Feld
 * bleibt.
 *
 * Beide Haelften zaehlen. Ohne "Brett voll" kauft der Bot Feldplaetze, auf
 * denen nichts steht — genau das Bild, das den Anlass zu dieser Arbeit gab.
 * Ohne die Reserve steigt er auf, sobald er es gerade eben kann, und steht mit
 * einem groesseren Brett und leerem Beutel da.
 *
 * An "Brett voll" halten sich seit dem 06.09.2026 alle drei Gangarten; sie
 * weichen nur noch in der RESERVE voneinander ab. `hart` legt nichts obendrauf
 * und steigt auf, sobald das volle Brett und das blanke Aufstiegsgeld da sind;
 * `normal` will drei Gold uebrig sehen, `sanft` sechs.
 *
 * DIE ERSTE HAELFTE WEGZULASSEN WAR EIN FEHLER, und er hat zwei Tage
 * ueberlebt, weil er sich als Charakterzug las. `hart` liess bis zum
 * 06.09.2026 beide Haelften weg — "kein Zoegern beim Aufstieg" —, und weil
 * eine Messung vom Vortag das fuer folgenlos hielt, blieb es stehen. Auf dem
 * heutigen Stand ist es das nicht: Allein die Bedingung "Brett voll"
 * zurueckzuholen bringt `hart` von 133 auf 190 Siege je 400 Partien. Ein
 * Feldplatz, den niemand besetzt, ist in einer Partie ueber neun Runden
 * bezahlter Leerstand.
 *
 * DASS DAS TEMPO SICH LOHNT, HAENGT AM LADEN und ist nicht fuer alle Zeiten
 * gemessen: Solange ein Kauf nur seinen Ladenplatz leerte, blieben die frueh
 * gekauften Feldplaetze in einer kurzen Partie leer, und `hart` verlor daran
 * gegen `normal` (77 : 107,7). Die Zahlen und der Nachweis stehen bei
 * GANGARTEN.
 */
function aufstiegsZug(eigen: EigeneSicht, gangart: Gangart): TafelrundeAktion | null {
  if (eigen.aufstiegKosten === null) return null;
  if (gangart.nurBeiVollemBrett && eigen.belegt < eigen.feldplaetze) return null;
  if (eigen.gold < eigen.aufstiegKosten + gangart.aufstiegsReserve) return null;
  return { typ: 'levelAuf' };
}

// ---------------------------------------------------------------------------
// 4. NEU-WUERFELN NUR BEI FREMDEM LADEN
// ---------------------------------------------------------------------------

/**
 * Was nach dem Wuerfeln noch dasein muss: der Preis der teuersten Einheit.
 *
 * Ein Neu-Wuerfeln, nach dem das Gold fuer keinen Kauf mehr reicht, ist
 * bezahlte Aussicht — der neue Laden geht am Rundenende ohnehin verloren.
 */
const KAUF_RUECKLAGE = 3;

/**
 * Wie oft ein Bot in EINER Runde hoechstens neu wuerfelt.
 *
 * Die Zahl ist kein Feintuning, sondern der Abbruch: Ohne sie hat der Bot seit
 * dem kostenlosen Wuerfeln keinen Grund mehr aufzuhoeren (siehe wuerfelZug).
 * Vier reichen — er wuerfelt nur in der Lage "Brett voll, nichts passt", und
 * die loest sich in aller Regel beim ersten oder zweiten Wurf.
 */
const WUERFE_JE_RUNDE = 4;

/**
 * Neu wuerfeln, wenn das Brett voll ist und KEIN Ladenplatz zum eigenen Heer
 * passt.
 *
 * "Passt" heisst: verschmilzt, macht ein Paar oder verstaerkt eine schon
 * vertretene Marke. Steht dort nur Fremdes, ist ein neuer Laden mehr wert als
 * die Einheit, die man sonst dafuer bekaeme.
 *
 * DAS VOLLE BRETT IST BEDINGUNG, und zwar aus einem Fehler heraus, den die
 * erste Fassung dieser Regel hatte: Ohne sie wuerfelte der Bot in Runde 2 sein
 * ganzes Gold weg. Zu einem leeren Heer passt naemlich NICHTS — es gibt weder
 * eine Kopie noch eine vertretene Marke —, und die Regel haette genau dann
 * gegriffen, wenn er dringend seine erste Einheit braucht. Solange ein
 * Feldplatz frei ist, ist die schlechteste Einheit besser als der schoenste
 * Laden.
 *
 * Deshalb steht diese Regel auch VOR dem Kauf: Sie greift nur in der Lage, in
 * der ein Kauf ohnehin nur die Bank fuellte, und danach kaeme sie nie zum Zug.
 *
 * DASS ER SICH NICHT FESTWUERFELT, GARANTIERT SEIT DEM 05.09.2026 DER DECKEL
 * und nicht mehr das Gold. Vorher kostete jeder Wurf, und in der Vorbereitung
 * kam keines nach — das war die Bremse. Seit die Vorgabe 0 Gold lautet, gibt
 * es sie nicht mehr: Passt im Laden nichts, wuerfelte der Bot ohne
 * WUERFE_JE_RUNDE endlos weiter, denn die Plattform ruft ihn so lange, bis er
 * "bereit" meldet. Die Goldregel bleibt trotzdem stehen, weil ein Tisch den
 * Preis wieder setzen darf.
 */
function wuerfelZug(
  sicht: TafelrundeSicht,
  eigen: EigeneSicht,
  gangart: Gangart,
): TafelrundeAktion | null {
  if (!gangart.wuerfeltNeu) return null;
  if (eigen.belegt < eigen.feldplaetze) return null;
  if (!eigen.bank.includes(null)) return null;
  if (eigen.wuerfeRunde >= WUERFE_JE_RUNDE) return null;

  /*
   * Die Ruecklage nur, wenn das Wuerfeln ueberhaupt etwas kostet. Ein
   * kostenloser Wurf ist auch dann richtig, wenn danach kein Gold mehr da
   * ist: Er nimmt nichts weg.
   */
  if (eigen.neuwuerfelnKosten > 0) {
    const polster = sicht.runde >= POLSTER_AB_RUNDE ? gangart.polster : 0;
    if (eigen.gold - eigen.neuwuerfelnKosten < polster + KAUF_RUECKLAGE) return null;
  }

  const eigene = eigeneEinheiten(eigen);
  const marken = markenZaehlung(eigene);
  const passt = eigen.laden.some((id) => {
    if (id === null) return false;
    if (kopienVon(eigene, id) > 0) return true;
    return einheit(id).marken.some((marke) => (marken.get(marke) ?? 0) > 0);
  });
  if (passt) return null;

  return { typ: 'neuwuerfeln' };
}

// ---------------------------------------------------------------------------
// Der Zug
// ---------------------------------------------------------------------------

/**
 * Der naechste Zug des Bots.
 *
 * Die Reihenfolge der vier Regeln ist Teil der Strategie:
 *
 *   1. Erst das BRETT in Ordnung bringen. Andersherum kaufte der Bot die Bank
 *      voll und stellte erst danach auf — und weil jede Aktion einzeln ueber
 *      die Plattform laeuft, staende sein Brett bis kurz vor dem Kampf leer.
 *      Sieht man ihm zu, soll er wie jemand wirken, der sein Heer aufbaut, und
 *      nicht wie jemand, der hamstert.
 *   2. Dann der AUFSTIEG. Er kommt vor dem Kauf, weil ein Feldplatz mehr wert
 *      ist als eine weitere Einheit auf der Bank — aber eben nur, wenn das
 *      Brett schon voll ist, sonst greift die Regel gar nicht.
 *   3. Dann das NEU-WUERFELN. Auch das steht vor dem Kauf, und dort steht es
 *      begruendet: Nach dem Kauf kaeme es nie zum Zug.
 *   4. Und erst dann KAUFEN — oder bereit melden.
 *
 * STATT DES NAMENS DARF AUCH EINE GANGART SELBST UEBERGEBEN WERDEN. Der Tisch
 * tut das nie — er kennt nur `sanft`, `normal`, `hart` (siehe `gangartVon` im
 * Adapter). Die Oeffnung ist fuer den Messstand da: `werkzeug/gangarten.mjs`
 * kann damit EINE Schraube verstellen und den Vorschlag messen, ohne ihn
 * einzubauen (`--schraube polster=0`). Vorher ging das nur ueber eine Aenderung
 * an dieser Datei samt Neubau, und genau daran ist die Frage "was traegt `hart`
 * eigentlich?" zweimal liegengeblieben.
 */
export function botZug(
  sicht: TafelrundeSicht,
  wahl: Schwierigkeit | Gangart = 'normal',
): TafelrundeAktion {
  const eigen = sicht.eigenes;
  // Ohne eigenes Heer gibt es nichts zu entscheiden. Bereit zu melden ist die
  // einzige Aktion, die in jeder Lage etwas bewirkt oder wenigstens nicht
  // wirft — und der Adapter faengt den Zuschauerfall ohnehin vorher ab.
  if (!eigen) return { typ: 'bereit' };

  const gangart = typeof wahl === 'string' ? GANGARTEN[wahl] : wahl;
  return (
    stellungsZug(sicht, eigen) ??
    aufstiegsZug(eigen, gangart) ??
    wuerfelZug(sicht, eigen, gangart) ??
    kaufZug(sicht, eigen, gangart) ?? { typ: 'bereit' }
  );
}
