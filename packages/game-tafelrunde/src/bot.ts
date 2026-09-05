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
 *      Paare, die Synergien der Marken und die Staerke. In die geht seit dem
 *      05.09.2026 auch die REICHWEITE ein, aber nur so weit, wie das eigene
 *      Heer eine Vorderreihe hat (`deckungIm`).
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

interface Gangart {
  /**
   * Gold, das ab `POLSTER_AB_RUNDE` liegen bleibt.
   *
   * Sparen ist in diesem Spiel KEINE Staerke, und das war die Ueberraschung
   * der Messung: Der Zins ist bei 5 gedeckelt (`ZINS_MAX`), eine Partie zu
   * zweit dauert rund siebzehn Runden, und in dieser Zeit bringt ein
   * zurueckgehaltenes Gold weniger ein, als eine Einheit auf dem Brett wert
   * ist. Deshalb haelt hier der SANFTE Gegner am meisten zurueck, nicht der
   * harte — Horten ist die Schwaeche, die Robin an einem Menschen wiedererkennt.
   */
  readonly polster: number;
  /** Was nach einem Aufstieg uebrig bleiben soll, um das neue Feld zu fuellen. */
  readonly aufstiegsReserve: number;
  /** Steigt er nur auf, wenn das Brett voll ist? Siehe AUFSTIEG BEI VOLLEM BRETT. */
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
 * ab Runde 4 ein kleines Polster, Aufstieg nur bei vollem Brett, selten ein
 * Fehlgriff. `hart` spielt auf TEMPO — kein Zoegern beim Aufstieg, keine
 * Reserve, kein Fehlgriff. `sanft` sitzt auf seinem Gold, steigt spaet auf,
 * greift meist blind zu und verpasst Verschmelzungen.
 *
 * DASS DIESE REIHENFOLGE STIMMT, IST GEMESSEN und nicht geschaetzt — je 400
 * Partien zu viert, ein Sitz mit der starken Gangart gegen drei mit der
 * schwachen, gezaehlt werden eindeutige Siege. Rechts steht der SCHNITT der
 * drei schwachen Sitze, und ueber zwei unabhaengige Saatbasen, weil eine
 * einzelne nichts beweist (`werkzeug/gangarten.mjs`, neu aufgenommen am
 * 05.09.2026, nachdem die Bewertung die Reichweite bekam):
 *
 *                    gebaut (12 Leben, x2)   langer Stand (20 Leben, x1)
 *     hart : normal   105 :  98    97 : 101     114 : 95   106 : 98
 *     hart : sanft    339 :  20   328 :  24     327 : 24   321 : 26
 *     normal : sanft  364 :  12   370 :  10     348 : 17   358 : 14
 *
 * DIE ERSTE ZEILE IST DUENN GEWORDEN, und das gehoert vor jede Lesung dieser
 * Tabelle: `hart` gegen `normal` steht auf der zweiten Basis bei 97 : 101, also
 * hinten. Die Probe in bot.test.ts misst diese Paarung deshalb ueber DREI
 * Basen und 1.200 Partien (124 + 105 + 103 = 332 gegen 289,3) — und selbst das
 * ist kaum mehr als der Kontrolllauf unten. Der Reichweitenfaktor hat daran
 * uebrigens wenig geaendert: Auf denselben drei Basen stand es vorher
 * 100 + 126 + 122 = 348 gegen 284, und der Unterschied liegt innerhalb eines
 * Standardfehlers von rund 15 Siegen. `hart` war schon vorher duenn.
 *
 * AM 05.09.2026 ZWEIMAL NEU AUFGENOMMEN: einmal, weil der Bot seitdem auf
 * Marken spielt (siehe `heerStaerke`), und einmal nach der Kuerzung auf 12
 * Startleben. Die Reihenfolge steht durch alle drei Staende; der Abstand
 * zwischen `hart` und `normal` ist etwas kleiner geworden (bei 14 Leben und
 * markenblindem Bot waren es 140 : 87), und dazu gehoert die naechste Zeile.
 *
 * DASS BEIDE SPALTEN DASELBE SAGEN, IST DER PUNKT: Die Reihenfolge haengt
 * nicht an der Partielaenge. Die zweite Spalte ist der Stand von gestern (20
 * Leben, kein Zeitraffer, rund fuenfzehn Runden) und wird von der letzten
 * Probe in bot.test.ts mitgeprueft — die Rundenzahl ist die Zahl, an der Robin
 * dreht, und eine darauf geeichte Gangart faellt sonst erst der uebernaechsten
 * Umstellung auf.
 *
 * WARUM DAS HIER SO AUSFUEHRLICH STEHT: Am 05.09.2026 verlor `hart` gegen
 * `normal` — 77 : 107,7. Gemessen wurde das auf dem Zweig, der die 14
 * Startleben und den Zeitraffer brachte, aber die Ladenregel noch nicht hatte.
 * Nachgemessen ist die Ursache NICHT die kurze Partie und schon gar nicht der
 * Zeitraffer (bei 20 Leben aendert er die Zahl von 110 auf 114, also gar
 * nichts), sondern die damalige LADENREGEL:
 *
 *   - Vor dem 05.09.2026 leerte ein Kauf nur seinen Platz, und ein Wurf
 *     kostete 2 Gold. Wer sich frueh Feldplaetze erkaufte, bekam sie in der
 *     elf Runden kurzen Partie nicht mehr voll — `hart` steigt ohne Reserve
 *     und ohne volles Brett auf (siehe unten), und das war dort Tempo ins
 *     Leere.
 *     Beleg: Auf demselben Stand mit GEZAEHMTEM Aufstieg (`aufstiegsReserve`
 *     3, `nurBeiVollemBrett`) stand es 112 : 96,0 statt 77 : 107,7.
 *   - Seit ein Kauf den GANZEN Laden neu zieht, laesst sich ein grosses Brett
 *     auch fuellen, und der Aufstieg traegt sich wieder.
 *
 * Der Wurfpreis war es dagegen nicht: Auf dem heutigen Stand mit wieder
 * eingeschaltetem Preis von 2 Gold gewinnt `hart` sogar deutlicher (174 :
 * 75,3). Wer die naechste Umstellung misst, misst deshalb bitte die Gangarten
 * MIT — eine Regel, die den Laden anfasst, verschiebt sie.
 *
 * WAS `HART` HEUTE TRAEGT, ist die fehlende Patzerquote und nicht das Tempo:
 * nimmt man nur den Patzer weg, steht es 149 : 83,7; mit den Tempo-Schrauben
 * obendrauf 140 : 86,7 (beides gemessen, bevor der Bot auf Marken spielte).
 * Die beiden Zahlen liegen innerhalb eines Standardfehlers (rund 10 Siege bei
 * 400 Partien) — die Tempo-Schrauben sind weder Vorteil noch Nachteil. Sie
 * bleiben trotzdem stehen: Sie geben der Gangart ihr Verhalten, und eine
 * Aenderung auf eine Zahl innerhalb der Streuung waere geraten, nicht
 * gemessen. Als Befund steht das auf dem Board.
 *
 * DER KONTROLLLAUF IST NICHT MEHR NEUTRAL, und das gehoert vor jede dieser
 * Zahlen. Besetzt man ALLE VIER Sitze mit `normal`, gewinnt Sitz 0 trotzdem
 * oefter: 118 und 107 Siege ueber die beiden Basen der Tabelle, gegen 100 im
 * Schnitt. Vor dem Markengewicht war der Lauf sauber (101, 106, 99), mit ihm
 * stand er bei 102 und 108 — der Reichweitenfaktor hat den Sitzvorteil also
 * noch etwas vergroessert, und auch das hat denselben Grund wie unten: Ein Bot,
 * der genauer weiss, was er will, will es haeufiger gleichzeitig mit den
 * anderen. Die Ursache ist der GEMEINSAME VORRAT (partie.ts, `vorrat`):
 * Bots, die auf Synergien spielen, wollen alle dieselben Einheiten, und der
 * Messstand laesst die Sitze der Reihe nach ruesten — wer zuerst kauft,
 * bekommt sie. Am echten Tisch ruesten alle gleichzeitig, dort ist die
 * Reihenfolge keine Sitznummer; der Druck auf den Vorrat ist aber derselbe.
 * Fuer die Tabelle oben heisst das: `hart` gewinnt auf der ersten Basis 105
 * Partien — und derselbe Sitz gewinnt 118, wenn er `normal` spielt wie alle
 * anderen. Die Paarung `hart : normal` sagt fuer sich genommen also gar
 * nichts mehr; getragen wird die Reihenfolge von den 1.200 Partien der Probe
 * in bot.test.ts, und auch dort knapp: 332 Siege gegen 315 im Kontrolllauf
 * ueber dieselben drei Basen. Wer den Abstand als Zahl braucht, misst
 * gegen den Kontrolllauf und nicht gegen 100. Steht als Befund auf dem Board.
 *
 * ZU VIERT UND NICHT ZU ZWEIT, und das ist selbst ein Befund: Solange die
 * Partie 100 Startleben hatte, schlug `hart` den normalen Gegner im Duell mit
 * 125:75. Mit dem kuerzeren Lebensbalken (20 Leben, 05.09.2026) dauerte ein
 * Duell 11 statt 21 Runden, und dort stand es 96:104 fuer `normal`. Am Tisch
 * zu viert — der Besetzung, auf die das Spiel eingestellt ist — bleibt der
 * Abstand stehen. Wer die Gangarten fuer das Duell zurechtruecken will, misst
 * bitte beide Besetzungen; die Zahlen fallen in Sekunden an.
 *
 * Der erste Anlauf hatte die Schrauben andersherum gesetzt — der harte Gegner
 * sparte am meisten und stieg am vorsichtigsten auf — und lag danach ueber 40
 * Partien mit 19:21 GLEICHAUF mit dem sanften. Wer hier etwas verstellt, misst
 * bitte nach: `node packages/game-tafelrunde/werkzeug/gangarten.mjs`, die
 * Probe dazu steht in test/bot.test.ts (imFeld).
 */
const GANGARTEN: Readonly<Record<Schwierigkeit, Gangart>> = {
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
    polster: 4,
    aufstiegsReserve: 0,
    nurBeiVollemBrett: false,
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
 * Was ein Feld Reichweite ueber den Nahkampf hinaus wert ist — bei voller
 * Deckung, und je Feld.
 *
 * Ein Schuetze hinter der eigenen Linie schiesst vom ersten Takt an und wird
 * erst getroffen, wenn die Linie faellt; ein Nahkaempfer laeuft erst einmal
 * los (`schrittZiel` in kampf.ts) und kassiert dabei, ohne zurueckzuschlagen.
 * Mit 0,15 ist eine gedeckte Bogenmeisterin (Reichweite 3) das 1,30-fache
 * wert und der Sturmrufer (Reichweite 4) das 1,45-fache.
 *
 * DIE ZAHL IST GEMESSEN, nicht geschaetzt. Gemessen wird mit
 * `werkzeug/gangarten.mjs`: Ein Sitz rechnet mit Reichweitenfaktor, die drei
 * anderen ohne, sonst spielen alle vier dieselbe Gangart. Je 400 Partien ueber
 * sechs Saatbasen, gezaehlt werden die eindeutigen Siege des einen Sitzes.
 *
 *     ohne Faktor (Kontrolllauf)   595 von 2.400
 *     mit 0,15                     708 von 2.400   auf JEDER Basis mehr
 *
 * Nach oben ist die Zahl begrenzt, und zwar messbar: ueber die ersten drei
 * Basen steht 0,10 bei 355, 0,15 bei 360, 0,25 bei 313 und 0,40 bei 249 —
 * gegen 301 im Kontrolllauf. Ab etwa einem Viertel kippt der Faktor also von
 * Vorteil zu Nachteil, weil der Bot dann Fernkaempfer kauft, wo er eine Wache
 * braeuchte. Zwischen 0,10 und 0,15 entscheidet die Messung nicht; 0,15 steht
 * hier, weil es den groessten gemessenen Abstand hat.
 */
const REICHWEITEN_GEWICHT = 0.15;

/**
 * Wie viele Fernkaempfer eine Einheit der Vorderreihe deckt.
 *
 * DIE MESSUNG UNTERSCHEIDET DIESE ZAHL NICHT, und das gehoert dazu: Mit 1
 * (jede Wache deckt genau eine) stehen ueber drei Basen 359 Siege, mit 8 (also
 * praktisch "eine einzige Wache genuegt fuer alles") 358. Das ganze Gewicht
 * des Modells liegt im Fall NULL — ein Brett voellig ohne Vorderreihe. Genau
 * dort trennen sich die 208 Siege des pauschalen Faktors von den 360 des
 * gedeckten (siehe `deckungIm`).
 *
 * ZWEI UND NICHT EINS, obwohl die Messung schweigt, und dafuer gibt es einen
 * Grund ausserhalb der Siegzahlen: Mit 1 kauft der Bot die Grabfuerstin in 400
 * Partien kein einziges Mal mehr, und die Probe "stellt jede der 22 Einheiten
 * wenigstens einmal auf ein Brett" (test/ausgewogenheit.test.ts) faellt. Sie
 * stand vorher bei zwei Antritten, war also ohnehin am Rand — aber eine
 * Bot-Aenderung, die eine Katalogzeile ganz aus dem Spiel nimmt, ist zu scharf.
 * Ab 1,5 steht die Probe wieder, an den Siegzahlen aendert sich nichts.
 *
 * KEIN HARTER SCHALTER bei "gar keine Wache", obwohl die Messung genau das
 * traegt: Ein Brett mit einer Wache und sechs Schuetzen ist nicht gedeckt, und
 * ein Umschalten bei genau einer Wache waere eine Kante, hinter der der Bot
 * ploetzlich anders einkauft. Das Verhaeltnis sagt dasselbe stetig.
 */
const DECKKRAFT = 2;

/** Kein Rueckhalt: Reichweite bringt der Einheit dann gar nichts. */
const KEINE_DECKUNG = 0;

/** Voller Rueckhalt: Reichweite zaehlt mit `REICHWEITEN_GEWICHT` je Feld. */
const VOLLE_DECKUNG = 1;

/**
 * Wie gut die Vorderreihe dieses Heeres seine Fernkaempfer deckt — 0 bis 1.
 *
 * WARUM DIE REICHWEITE NICHT FUER SICH ALLEIN ZAEHLT, und das ist der Kern
 * dieser Datei: Reichweite ist nichts wert, solange niemand die Linie haelt.
 * Genau daran ist die Marke Elementar am 05.09.2026 gescheitert (siehe
 * Irrlicht in katalog.ts) — fuenf Traeger, alle mit Reichweite 3 oder 4, und
 * eine Siegquote von x0,25. Ein Bot, der Reichweite pauschal aufwertet, baut
 * genau dieses Brett. Gemessen ist er damit deutlich SCHWAECHER als der ohne
 * Faktor: 208 Siege statt 301 (je 400 Partien ueber drei Saatbasen, sonst
 * gleiche Gangart). Der Deckungsanteil macht aus dem Faktor eine Aussage
 * ueber die ZUSAMMENSTELLUNG statt ueber die einzelne Einheit — und erst so
 * traegt er.
 *
 * Ein Verhaeltnis und kein feiner ausgedachtes Mass: so viele Fernkaempfer,
 * wie die Vorderreihe traegt (`DECKKRAFT`), sind gedeckt, der Rest drueckt den
 * Anteil. Ueber 1 wird gekappt — zwei Wachen je Schuetze decken nicht doppelt.
 *
 * Gezaehlt wird nach `reichweite` und nicht nach `rolle`: Die Rolle steuert
 * die Stellung (`platzStrafe`), und das Irrlicht ist seit dem 05.09.2026 der
 * Fall, an dem beides auseinandergeht — Rolle `wache`, aber im Katalog steht
 * eine Reichweite, und die entscheidet hier.
 */
function deckungIm(einheiten: readonly Kaempfer[]): number {
  let nah = 0;
  let fern = 0;
  for (const k of einheiten) {
    if (einheit(k.id).reichweite <= 1) nah += 1;
    else fern += 1;
  }
  // Ohne Fernkaempfer geht die Zahl niemanden etwas an; sie darf nur nicht
  // durch null teilen.
  if (fern === 0) return VOLLE_DECKUNG;
  return Math.min(VOLLE_DECKUNG, (nah * DECKKRAFT) / fern);
}

/**
 * Wie viel eine Einheit dem Bot wert ist: was sie aushaelt MAL dem, was sie
 * austeilt — mal dem, was ihre Reichweite in DIESEM Heer wert ist.
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
 * DIE REICHWEITE STAND BIS ZUM 05.09.2026 NICHT DRIN, mit dem Vermerk, die
 * Stellung (Schuetzen nach hinten) fange das ab. Sie tut es nicht: Wohin eine
 * Einheit gestellt wird, aendert nichts daran, WELCHE gekauft wird, und genau
 * das entscheidet `staerke`. Sie geht deshalb jetzt ein — aber nur so weit,
 * wie das Heer eine Vorderreihe hat (`deckungIm`). Die Vorgabe ist
 * `KEINE_DECKUNG`: Wer eine Einheit ohne ihr Heer bewertet, weiss nichts ueber
 * ihren Rueckhalt und soll ihr keinen andichten.
 *
 * Den Kampf wirklich durchrechnen zu lassen waere verlockend und falsch: Der
 * Bot entscheidet mehrmals je Runde, und `simuliereKampf` ist die teuerste
 * Rechnung des Moduls.
 *
 * Der `bonus` ist der Synergie-Aufschlag, den die Einheit in IHRER Umgebung
 * bekommt (siehe `heerStaerke`). Ohne ihn misst die Funktion die nackte
 * Einheit — das ist der richtige Wert ueberall dort, wo zwei Einheiten
 * unabhaengig von ihren Nachbarn verglichen werden.
 *
 * GERUNDET WIRD ZUM SCHLUSS, und das ist kein Schoenheitsfehler: Der Beweis,
 * dass die Zugschleife endet (Dateikopf), haengt daran, dass jeder Tausch
 * `heerStaerke` um mindestens einen ganzen Punkt hebt. Ein Faktor, der eine
 * Kommazahl stehen laesst, macht aus dem Schritt eine beliebig kleine Zahl.
 */
function staerke(
  k: Kaempfer,
  bonus: Wertebonus = KEIN_BONUS,
  deckung: number = KEINE_DECKUNG,
): number {
  const w = werteFuer(k.id, k.stufe, bonus);
  const haelt = (w.leben * 100) / Math.max(1, 100 - w.ruestung);
  const teiltAus = w.angriff * w.tempo;
  const ausDerFerne = 1 + (w.reichweite - 1) * REICHWEITEN_GEWICHT * deckung;
  return Math.round((haelt * teiltAus * ausDerFerne) / STAERKE_TEILER);
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
 * SEIT DEM 05.09.2026 ENTSTEHT HIER AUCH DIE DECKUNG (`deckungIm`), und aus
 * demselben Grund wie der Markenbonus: Was eine Reichweite wert ist, haengt
 * nicht an der Einheit, sondern daran, wer vor ihr steht. Nur die Liste weiss
 * das — die einzelne Einheit weiss es nie.
 *
 * Der Preis ist eine Zaehlung und eine Bonusrechnung je Einheit, bei
 * hoechstens 18 Einheiten. Das ist etwas anderes als `simuliereKampf`, vor dem
 * der Kommentar oben warnt: Hier wird nichts iteriert, nur addiert.
 */
function heerStaerke(einheiten: readonly Kaempfer[]): number {
  const zaehlung = zaehleMarken(einheiten);
  const deckung = deckungIm(einheiten);
  let summe = 0;
  for (const k of einheiten) summe += staerke(k, bonusFuerEinheit(k.id, zaehlung), deckung);
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
    for (const frei of freie) {
      if (platzStrafe(k, frei, reihen, spalten) < jetzt) {
        return {
          typ: 'verschieben',
          von: { bereich: 'brett', platz },
          nach: { bereich: 'brett', platz: frei },
        };
      }
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
 * Was dieser Kauf dem Heer UEBER DIE EINHEIT HINAUS bringt — der Zuwachs, den
 * das ganze Heer hat, wenn sie dazukommt.
 *
 * Er enthaelt drei Dinge: was die Neue von den schon vertretenen Marken
 * bekommt, was sie allen anderen Traegern ihrer Marken gibt — und seit dem
 * 05.09.2026, was sich an der DECKUNG aendert (`deckungIm`). Eine Wache hebt
 * damit auch die Schuetzen, die schon dastehen, und ein sechster Schuetze
 * drueckt sie. Abgezogen wird die nackte Staerke der Neuen, denn die steht in
 * `kandidaten` schon in der Rechnung; was uebrig bleibt, ist genau das
 * Umfeld.
 *
 * Die Funktion hiess bis dahin `markenGewinn`. Der Name stimmte nicht mehr,
 * sobald die Deckung mitkam — und ein Name, der die Haelfte verschweigt, ist
 * schlimmer als keiner: Wer die Zeile in `kandidaten` liest, haelt den
 * Deckungsanteil sonst fuer verloren.
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
function umfeldGewinn(eigene: readonly Kaempfer[], id: EinheitId): number {
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
    wert += umfeldGewinn(eigene, id);

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
 * Das ist die Regel, nach der `normal` spielt. Die beiden anderen Gangarten
 * weichen in verschiedene Richtungen ab: `hart` laesst BEIDE Haelften weg und
 * steigt auf, sobald es geht; `sanft` haelt sich an die Regel und legt sechs
 * Gold obendrauf, steigt also spaeter auf als beide.
 *
 * DASS DAS TEMPO SICH LOHNT, HAENGT AM LADEN und ist nicht fuer alle Zeiten
 * gemessen: Solange ein Kauf nur seinen Ladenplatz leerte, blieben die frueh
 * gekauften Feldplaetze in einer kurzen Partie leer, und `hart` verlor daran
 * gegen `normal` (77 : 107,7). Heute — ein Kauf zieht den ganzen Laden neu —
 * kostet der frueh Aufstieg nichts mehr, bringt aber auch nichts Messbares.
 * Die Zahlen und der Nachweis stehen bei GANGARTEN.
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
 */
export function botZug(
  sicht: TafelrundeSicht,
  schwierigkeit: Schwierigkeit = 'normal',
): TafelrundeAktion {
  const eigen = sicht.eigenes;
  // Ohne eigenes Heer gibt es nichts zu entscheiden. Bereit zu melden ist die
  // einzige Aktion, die in jeder Lage etwas bewirkt oder wenigstens nicht
  // wirft — und der Adapter faengt den Zuschauerfall ohnehin vorher ab.
  if (!eigen) return { typ: 'bereit' };

  const gangart = GANGARTEN[schwierigkeit];
  return (
    stellungsZug(sicht, eigen) ??
    aufstiegsZug(eigen, gangart) ??
    wuerfelZug(sicht, eigen, gangart) ??
    kaufZug(sicht, eigen, gangart) ?? { typ: 'bereit' }
  );
}
