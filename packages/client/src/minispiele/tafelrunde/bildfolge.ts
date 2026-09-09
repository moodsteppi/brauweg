/**
 * Welches Bild einer 3D-Bildfolge gerade dran ist — die Rechnung hinter den
 * Figuren der Kampfanzeige.
 *
 * Was unter `public/tafelrunde/figuren3d/` liegt und wie es aufgebaut ist,
 * steht ausschliesslich in `src/figuren3d/figuren3d.ts` (Zeilen, Bildzahl,
 * Bildrate, Schleife, Blickrichtung). Diese Datei rechnet damit und schreibt
 * nichts davon ab.
 *
 * DIE AUFTEILUNG: Hier steht, WELCHES Bild — in `KampfAnzeige.tsx` steht, wann
 * es an den Bildschirm kommt. Beides zu trennen ist kein Selbstzweck: Die
 * Auswahl ist eine reine Funktion von Zeitstempeln und damit pruefbar, ohne
 * eine Uhr laufen zu lassen.
 *
 * DIE ZUORDNUNG IST DIE ROLLE, NICHT DIE EINHEIT. Es gibt fuenf Blaetter fuer
 * 22 Einheiten; jede Einheit spielt das Blatt ihrer Rolle. Seit dem 6.9.2026
 * gilt das ueberall: Brett, Bank und Ladenkarte zeigen dieselbe Figur wie die
 * Arena, nur stehend (`Figur3D.tsx`). Die 22 Pixelfiguren aus `figuren.ts`
 * sind seitdem der RUECKFALL — sie treten an, wenn ein Blatt fehlt oder nicht
 * laedt, und der Name der Einheit steht ohnehin daneben.
 */

import {
  type Bewegung3D,
  type Rolle3D,
  FIGUREN3D_FUSSPUNKT,
  FIGUREN3D_KANTE,
  FIGUREN3D_SPALTEN,
  FIGUREN3D_ZEILEN,
  FIGUREN3D_ZELLHOEHE_METER,
  blattVon,
  folgeVon,
  zelleVon,
} from '../../figuren3d/figuren3d';

// ---------------------------------------------------------------------------
// Das Blatt einer Rolle
// ---------------------------------------------------------------------------

const ROLLEN_3D: readonly string[] = ['wache', 'meuchler', 'schuetze', 'magier', 'beistand'];

/**
 * Ob eine Rolle aus der Sicht eine ist, fuer die es ein Blatt gibt.
 *
 * Die Sicht liefert die Rolle als gewoehnliche Zeichenkette (protocol.ts).
 * Ohne diese Pruefung stuende in `blattVon` eine Rolle, die es nicht gibt, und
 * das Ergebnis waere `undefined` im `src` — genau der weisse Kasten, vor dem
 * CLAUDE.md warnt. Kommt je eine sechste Rolle in den Katalog, faellt sie hier
 * auf die Pixelfigur zurueck und nicht auf ein Loch.
 */
export function istRolle3D(rolle: string): rolle is Rolle3D {
  return ROLLEN_3D.includes(rolle);
}

/** Der Pfad zum Blatt einer Rolle, oder null, wenn es dafuer keines gibt. */
export function blattPfad(rolle: string): string | null {
  if (!istRolle3D(rolle)) return null;
  return blattVon(rolle)?.datei ?? null;
}

/** Alle fuenf Blaetter — fuer das Vorladen (vorladen.ts). */
export const BLATT_PFADE: readonly string[] = ROLLEN_3D.map((r) => blattPfad(r)).filter(
  (p): p is string => p !== null,
);

// ---------------------------------------------------------------------------
// Das Tempo
// ---------------------------------------------------------------------------

/**
 * Um wie viel schneller die Bildfolgen laufen als im Modell gemessen.
 *
 * ES IST DER ZEITRAFFER DES KAMPFES. `STANDARD_REGLER.zeitraffer` in
 * `packages/game-tafelrunde/src/kampf.ts` steht auf 2: Angriffstempo und
 * Schrittweite laufen doppelt so schnell wie die Werte im Katalog. Die
 * Bildraten in `figuren3d.ts` sind dagegen die des Modells, also fuer
 * einfaches Tempo. Wer sie unveraendert abspielt, bekommt Figuren, die
 * zweimal je Sekunde treffen und dabei in Zeitlupe ausholen.
 *
 * NACHGEMESSEN am aufgezeichneten Kampf der Probe (`proben/kampf/`, Runde 10,
 * 155 Treffer): Der kuerzeste Abstand zwischen zwei Schlaegen DESSELBEN
 * Angreifers ist 500 ms (44-mal), der Median 600 ms. Die Schlagfolge hat sechs
 * Bilder; bei der Modellrate 6 dauerte sie 1000 ms und man saehe nie mehr als
 * das Ausholen. Mit dem Faktor 2 sind es 500 ms — die Folge laeuft also auch
 * beim schnellsten Angreifer gerade durch, bevor der naechste Schlag faellt.
 *
 * Wer den Zeitraffer im Modul aendert, aendert diese Zahl mit. Sie steht
 * NICHT in der Sicht (der Client bekommt sie nicht), deshalb ist sie hier eine
 * Abschrift — wie der Rollentyp und die Ereignisformen auch.
 *
 * AUSGENOMMEN IST `stand`: Das Atmen im Stillstand haengt an keiner Zeit des
 * Protokolls. Verdoppelt saehe es nicht schneller aus, sondern nervoes.
 */
export const KAMPF_TEMPO = 2;

/**
 * Wie lange die Figur von Feld zu Feld gleitet, in Millisekunden.
 *
 * Der Weg selbst ist ein CSS-Uebergang (`.figur` in KampfAnzeige.module.css);
 * die Lauffolge muss genau so lange laufen wie er, sonst rudert die Figur
 * noch, wenn sie laengst steht. Damit es dafuer nicht zwei Zahlen gibt, setzt
 * die Komponente den Uebergang aus DIESEM Wert (`--gleiten`).
 *
 * FRUEHER STANDEN HIER 380 MS, und die Begruendung dafuer stimmte nicht mehr:
 * Sie waren an `SCHRITT_MS = 500` gemessen, dem Schritt bei EINFACHEM Tempo.
 * Mit dem Zeitraffer x2 dauert ein Schritt `schrittdauer()` = 300 ms (250
 * aufgerundet auf ganze Takte, kampf.ts) — der Uebergang war also laenger als
 * der Schritt, und zwei Schritte hintereinander schoben sich uebereinander.
 * Im Kampf der Probe steht der Beleg: Die ersten beiden Zuege derselben Figur
 * liegen 300 ms auseinander. 280 laesst sie ankommen, bevor der naechste
 * faellig ist.
 */
export const GLEITEN_MS = 280;

/**
 * Wie lange der Fall einer Gefallenen dauert, in Millisekunden.
 *
 * GERECHNET UND NICHT GESCHRIEBEN: Bildzahl der Todesfolge geteilt durch ihre
 * Bildrate, im Zeitraffer des Kampfes. Wer im Renderskript ein Bild ergaenzt
 * oder die Rate aendert, bekommt die neue Dauer geschenkt. Genau das ist am
 * 06.09.2026 passiert: Die Todeszeile laeuft seitdem bis zum LIEGEN durch
 * statt nur bis zum Zusammensacken (acht Bilder statt sechs, Bildrate 10 statt
 * 15), und aus 200 ms wurden 400 — ohne dass hier eine Zahl zu aendern war.
 *
 * Gebraucht wird sie vom Stylesheet (`--sacken` an `.figur`): Das Verblassen
 * der Gefallenen faengt erst NACH dem Fall an. Frueher schrumpfte und
 * drehte sich dort die Platte, weil es keine Todesfolge gab — heute waeren
 * das zwei Sterbebewegungen uebereinander, und die zweite machte die erste
 * unsichtbar, bevor sie zu Ende ist. Und das Liegen ist das Bild, wegen dessen
 * die Zeile ueberhaupt bis zum Ende gerendert wird.
 *
 * `bilder` und nicht `bilder - 1`: Das letzte Bild ist die liegende Figur, und
 * die soll ihren eigenen Taktschlag lang stehen, bevor sie zu verblassen
 * anfaengt. Mit `bilder - 1` faenge das Verblassen genau in dem Augenblick an,
 * in dem sie ankommt.
 */
export const SACKEN_MS: number = Math.round(
  (folgeVon('tod').bilder / (folgeVon('tod').bildrate * KAMPF_TEMPO)) * 1000,
);

// ---------------------------------------------------------------------------
// Welche Bewegung, welches Bild
// ---------------------------------------------------------------------------

/**
 * Was einer Figur zuletzt widerfahren ist — Zeitstempel AUS DEM PROTOKOLL.
 *
 * Alle vier Werte sind woertlich das `zeitMs` des jeweiligen Ereignisses
 * (`wendeAn` in KampfAnzeige.tsx schreibt sie ab). Hier wird daraus nichts
 * abgeleitet, was das Spiel entscheidet — nur, welches Bild zu sehen ist.
 */
export interface Bewegungsspur {
  /** Kennung der Figur; sie versetzt das Atmen im Stand. */
  readonly id: number;
  /** Wann diese Figur zuletzt SELBST getroffen hat. */
  readonly schlagAb: number | null;
  /** Wann diese Figur zuletzt getroffen WURDE. */
  readonly getroffenAb: number | null;
  /** Wann diese Figur zuletzt das Feld gewechselt hat. */
  readonly zugAb: number | null;
  /** Wann diese Figur gefallen ist. */
  readonly totAb: number | null;
}

export interface Bildstand {
  readonly bewegung: Bewegung3D;
  readonly bild: number;
}

/** Bildnummer seit dem Beginn einer Folge, ohne Ruecksicht auf ihr Ende. */
function bildNummer(bewegung: Bewegung3D, verstrichenMs: number): number {
  const folge = folgeVon(bewegung);
  // Nur das Atmen laeuft im Modelltempo — Begruendung an KAMPF_TEMPO.
  const tempo = bewegung === 'stand' ? 1 : KAMPF_TEMPO;
  return Math.floor((verstrichenMs * folge.bildrate * tempo) / 1000);
}

/**
 * Das Bild einer EINMAL-Folge, oder null, wenn sie schon durchgelaufen ist.
 *
 * Gemessen wird immer gegen den Zeitstempel des Ereignisses und nicht gegen
 * den Beginn der Anzeige. Das ist der Grund, warum eine kurze Zuckung eine
 * laufende Schlagfolge nur unterbricht statt sie zurueckzusetzen: Sobald sie
 * vorbei ist, steht der Schlag da, wo er ohne sie auch stuende.
 */
function einmalBild(bewegung: Bewegung3D, ab: number | null, zeitMs: number): number | null {
  if (ab === null || zeitMs < ab) return null;
  const bild = bildNummer(bewegung, zeitMs - ab);
  return bild < folgeVon(bewegung).bilder ? bild : null;
}

/** Das Bild einer Schleife, mit Versatz in ganzen Bildern. */
function schleifenBild(bewegung: Bewegung3D, verstrichenMs: number, versatz = 0): number {
  const folge = folgeVon(bewegung);
  const roh = bildNummer(bewegung, verstrichenMs) + versatz;
  return ((roh % folge.bilder) + folge.bilder) % folge.bilder;
}

/**
 * Welches Bild diese Figur zum Zeitpunkt `zeitMs` zeigt.
 *
 * DIE REIHENFOLGE, in der entschieden wird — und warum sie so ist:
 *
 *  1. **tod** schlaegt alles und bleibt auf dem letzten Bild stehen. Eine
 *     Gefallene holt nicht mehr aus.
 *  2. **getroffen** vor **schlag**, obwohl der eigene Schlag die wichtigere
 *     Auskunft ist. Grund ist die Laenge: Die Zuckung hat zwei Bilder und ist
 *     nach gut 90 ms vorbei, die Schlagfolge dauert 500 ms und laeuft
 *     darunter weiter (siehe `einmalBild`). Andersherum saehe man an einer
 *     Figur, die dauernd austeilt, nie, dass sie selbst einsteckt — und
 *     genau daran liest man ab, wer gerade untergeht.
 *  3. **lauf** vor **schlag**, solange die Figur gleitet (`GLEITEN_MS`). Wer
 *     laeuft, hat sein Ziel gerade verloren und geht zum naechsten; bliebe
 *     der Schlag oben, glitte die Figur ausholend ueber das Brett. Belegt an
 *     der Probe: Die Schattenklinge erschlaegt in Sekunde 10,5 ihr Ziel und
 *     tritt 100 ms spaeter das Feld weiter an — die ganze Wanderung laege
 *     sonst in den 500 ms ihrer Schlagfolge und waere nie zu sehen.
 *  4. **stand** in Schleife, je Figur versetzt: Ohne den Versatz atmete das
 *     ganze Heer im Gleichschritt. Dieselbe Ueberlegung wie bei `--schwebe`
 *     im Stylesheet, nur in ganzen Bildern statt in Sekunden.
 *
 * `ruhig` ist `prefers-reduced-motion`: Dieselbe Bewegung wird gewaehlt, aber
 * ohne Bildwechsel. Stehen bleibt das ERSTE Bild — ausser beim Tod, wo das
 * letzte stehenbleibt.
 *
 * Der Tod ist die einzige Folge, deren Zustand am ENDE steht: Die Figur sackt
 * zusammen und bleibt so liegen. Alle anderen kehren in die Haltung zurueck,
 * aus der sie gekommen sind — ihr letztes Bild ist kein Zustand, sondern der
 * weiteste Punkt der Bewegung. Beim Schlag ist das ein Ausfallschritt mit
 * gestreckter Waffe; als Dauerbild sieht eine ganze Reihe davon aus, als waere
 * die Anzeige haengengeblieben.
 *
 * Damit geht nichts verloren, was nicht ohnehin schon fehlte: Unter
 * `prefers-reduced-motion` entfallen im Stylesheet auch Blitz, Einschlag,
 * Staub und Schadenszahl. Die Auskunft steckt dort im Lebensbalken und in der
 * gefallenen Figur — und die gefallene Figur ist genau das Bild, das bleibt.
 */
export function bildstand(spur: Bewegungsspur, zeitMs: number, ruhig = false): Bildstand {
  const roh = laufender(spur, zeitMs);
  if (!ruhig) return roh;
  const bild = roh.bewegung === 'tod' ? folgeVon('tod').bilder - 1 : 0;
  return { bewegung: roh.bewegung, bild };
}

function laufender(spur: Bewegungsspur, zeitMs: number): Bildstand {
  if (spur.totAb !== null && zeitMs >= spur.totAb) {
    const letztes = folgeVon('tod').bilder - 1;
    return { bewegung: 'tod', bild: Math.min(letztes, bildNummer('tod', zeitMs - spur.totAb)) };
  }
  const getroffen = einmalBild('getroffen', spur.getroffenAb, zeitMs);
  if (getroffen !== null) return { bewegung: 'getroffen', bild: getroffen };
  if (spur.zugAb !== null && zeitMs >= spur.zugAb && zeitMs - spur.zugAb < GLEITEN_MS) {
    return { bewegung: 'lauf', bild: schleifenBild('lauf', zeitMs - spur.zugAb) };
  }
  const schlag = einmalBild('schlag', spur.schlagAb, zeitMs);
  if (schlag !== null) return { bewegung: 'schlag', bild: schlag };
  return { bewegung: 'stand', bild: schleifenBild('stand', zeitMs, spur.id) };
}

// ---------------------------------------------------------------------------
// Wohin das Blatt geschoben wird
// ---------------------------------------------------------------------------

/**
 * Der Versatz des Blattes, damit die gewuenschte Zelle im Ausschnitt steht.
 *
 * Gedacht als `transform: translate(x%, y%)` fuer ein Bild, das im Ausschnitt
 * `FIGUREN3D_SPALTEN` mal so breit und `FIGUREN3D_ZEILEN` mal so hoch liegt.
 * Prozent bei `translate()` beziehen sich auf die EIGENE Groesse des Bildes,
 * also ist eine Spalte 1/6 seiner Breite und eine Zeile 1/5 seiner Hoehe.
 *
 * Warum `transform` und nicht `left`/`top` oder `background-position`: Ein
 * Bildwechsel darf keinen Umbruch ausloesen — auf dem Brett stehen bis zu
 * sechzehn Figuren, die bis zu dreissigmal je Sekunde ihr Bild wechseln. Und
 * `background-position` schied aus, weil ein Hintergrund kein `onError`
 * kennt: Ein ausgefallenes Blatt waere ein leeres Feld statt eines Rueckfalls.
 *
 * Gerundet auf drei Stellen — das sind bei einem 128er Blatt Bruchteile eines
 * Pixels, und ungerundet stuenden im DOM Zeichenketten wie
 * `-16.666666666666664%`.
 */
export function blattVersatz(stand: Bildstand): string {
  // Ueber `zelleVon` und nicht ueber eine eigene Rechnung: Die Zeilenaufteilung
  // des Blattes steht in figuren3d.ts, und eine zweite Fassung davon liefe beim
  // ersten Umsortieren der Zeilen auseinander.
  const zelle = zelleVon(stand.bewegung, stand.bild);
  const x = -(zelle.x / FIGUREN3D_KANTE / FIGUREN3D_SPALTEN) * 100;
  const y = -(zelle.y / FIGUREN3D_KANTE / FIGUREN3D_ZEILEN) * 100;
  return `translate(${runde(x)}%, ${runde(y)}%)`;
}

/**
 * Wie breit der Ausschnitt bei diesem Bild sein muss — als Vielfaches seiner
 * Hoehe.
 *
 * Fast immer 1: Eine Zelle ist quadratisch. Die Todeszeile ist es nicht, weil
 * eine liegende Figur breiter ist als eine stehende hoch (siehe `weite` in
 * figuren3d.ts). Der Ausschnitt muss deshalb im Augenblick des Todes breiter
 * werden — die Figur darin bleibt gleich gross, sie liegt nur quer.
 *
 * Nicht abgeschrieben, sondern aus der Zelle gerechnet: Wer die Zeilen im
 * Renderskript umbaut, aendert eine Zahl und nicht zwei.
 */
export function zellWeite(stand: Bildstand): number {
  return zelleVon(stand.bewegung, stand.bild).breite / FIGUREN3D_KANTE;
}

// ---------------------------------------------------------------------------
// Wie gross der Ausschnitt auf der Karte ist
//
// WORAUF SICH ALLE PROZENTE HIER BEZIEHEN: auf den KOERPER, nicht auf die
// Wabenkarte. Der Koerper ist der Stellplatz der Figur und misst 74 x 62 % der
// Karte (`.stellplatz` in KampfAnzeige.module.css); die Werte von hier stehen
// als CSS-Variablen an einer Regel, die in ihm liegt. Der Kuerze halber stand
// bis zum 06.09.2026 in jeder zweiten Zeile „Kartenhoehe" — wer das woertlich
// nimmt, rechnet jede Figur um 61 % zu gross (1 / 0,62).
// ---------------------------------------------------------------------------

/**
 * Wie viele Weltmeter die HOEHE eines Figurenkoerpers abbildet — der Massstab
 * der Arena.
 *
 * DAS IST DIE ENTSCHEIDUNG, alles andere hier ist Rechnung. Sie ist Robins vom
 * 06.09.2026, gemessen auf /probe/kampf bei 390 px: Eine Wache soll 72 auf 52
 * Pixel gross sein und nicht 50 auf 36 — bei der kleineren Groesse blieb von
 * der vorgerenderten 3D-Figur eine farbige Silhouette ohne Ruestung, Gesicht
 * oder Waffe. Im Stylesheet stand sie als „260 %"; das war dieselbe Aussage,
 * aber nur solange eine Zelle 4,29 Meter Welt trug.
 *
 * IN METERN UND NICHT IN PROZENT, weil sie sonst den naechsten Satz Blaetter
 * nicht ueberlebt: Wie viel Figur in einer Zelle steckt, entscheidet der
 * gemessene Ausschnitt. Seit die Todeszeile ihre eigene, breitere Zelle hat,
 * sind es 3,76 Meter — dieselben 260 % waeren 82 statt 72 Pixel gewesen, also
 * 14 % mehr, als abgenommen wurde. 4,29 / 2,60 = 1,65 sagt dasselbe, ohne den
 * Ausschnitt zu kennen.
 *
 * Wer die Figuren groesser oder kleiner will, aendert DIESE Zahl: kleiner
 * heisst groessere Figuren.
 */
const MASSSTAB_METER = 1.65;

/**
 * Wo die Figur aufsetzt, als Anteil der Koerperhoehe von OBEN.
 *
 * 83,6 % heisst: Der Fuss steht 16,4 % ueber der Unterkante des Koerpers, knapp
 * ueber den Sternen und auf der Hoehe des Lebensbalkens. Tiefer, und die Figur
 * steht auf ihrer eigenen Stufenanzeige; hoeher, und sie schwebt ueber dem
 * Feld.
 */
const STANDLINIE = 0.836;

/**
 * Hoehe und Bodenversatz des Figurenausschnitts, in Prozent der Koerperhoehe.
 *
 * GERECHNET UND NICHT PROBIERT, und zwar aus dem Massstab: Eine Zelle traegt
 * `FIGUREN3D_ZELLHOEHE_METER` Meter Welt, ein Koerper soll `MASSSTAB_METER`
 * zeigen — daraus folgt die Hoehe. Der Fusspunkt sagt, wo in der Zelle die
 * Figur aufsetzt; daraus folgt, wie weit die Zelle unter den Koerper reichen
 * muss, damit sie auf der Standlinie steht.
 *
 * WARUM NICHT ZWEI FESTE PROZENTZAHLEN, wie bis zum 06.09.2026: Die haengen am
 * gemessenen Ausschnitt, ohne ihn zu nennen. Als die Todeszeile ihre eigene
 * Zelle bekam, wurde der Ausschnitt von 4,29 auf 3,76 Meter enger — dieselben
 * 260 % haetten jede Figur der Arena um 14 % wachsen lassen, ohne dass jemand
 * an der Groesse etwas geaendert haette. Und zwar genau die 260 %, die am
 * selben Tag an einem Bild abgenommen worden waren.
 */
export const FIGURENKASTEN = {
  /** Hoehe des Ausschnitts, in Prozent der Koerperhoehe. */
  hoehe: runde((FIGUREN3D_ZELLHOEHE_METER / MASSSTAB_METER) * 100),
  /** Unterkante gegen die des Koerpers, in Prozent — negativ heisst tiefer. */
  boden: runde(
    (1 -
      STANDLINIE -
      (FIGUREN3D_ZELLHOEHE_METER / MASSSTAB_METER) * (1 - FIGUREN3D_FUSSPUNKT.y)) *
      100,
  ),
} as const;

/**
 * Wie viele Weltmeter die HOEHE einer 32er-Pixelkachel zeigt — der Massstab
 * des RUECKFALLS.
 *
 * Wozu eine Pixelkachel einen Massstab braucht: Faellt ein 3D-Blatt aus, tritt
 * die Pixelfigur der Einheit an seine Stelle (`figuren.ts`, eingehaengt als
 * `ersatz` von `Figur3D`). Sie muss dann ungefaehr so gross dastehen wie die
 * Figuren daneben, sonst sieht der Rueckfall nach Fehler aus statt nach
 * Ersatz. Bis zum 06.09.2026 stand ihre Groesse als „72 % der Koerperhoehe" im
 * Stylesheet und hatte mit den 3D-Figuren nichts zu tun: Als die auf den
 * Massstab von 1,65 Metern kamen, wuchsen sie auf 72 Pixel — die Pixelfigur
 * blieb bei 34, also halb so gross wie ihre Nachbarn.
 *
 * IN METERN UND NICHT IN PROZENT, aus demselben Grund wie bei
 * `MASSSTAB_METER`: So haengt der Rueckfall an der ENTSCHEIDUNG ueber die
 * Figurengroesse und nicht am gemessenen Ausschnitt der Blaetter. Wer die
 * Figuren groesser will, aendert `MASSSTAB_METER` — und die Pixelfigur waechst
 * mit. Wer die Blaetter neu rendert und damit `FIGUREN3D_ZELLHOEHE_METER`
 * verschiebt, aendert an ihr nichts, und das ist richtig so: Die 3D-Figur wird
 * dabei ja auch nicht groesser.
 *
 * WOHER DIE 2,845 KOMMEN — einmal gemessen, damit der Rueckfall dort anfaengt,
 * wo die 3D-Figuren heute stehen. Am Alphakanal der fuenf Blaetter (Zelle 0/0,
 * das ruhende erste Bild) belegt eine stehende Figur 65,6 % (Wache), 59,4 %
 * (Meuchler), 73,4 % (Schuetze), 73,4 % (Magier) und 87,5 % (Beistand) der
 * Zellhoehe; der Median 73,4 % von 3,756 Metern sind 2,757 Meter Figur. Der
 * Median und nicht die Wache, an der die Groesse abgenommen wurde: Der
 * Rueckfall vertritt jede der fuenf Rollen, also nimmt er die mittlere.
 * Gemessen wurden ausserdem die 22 Pixelfiguren — sie fuellen ihre Kachel
 * fast ganz aus (Median 96,9 % der Hoehe, Fuesse bei 100 %). 2,757 / 0,969
 * ergibt die 2,845 Meter, die eine ganze Kachel damit zeigt.
 */
const PIXELKACHEL_METER = 2.845;

/**
 * Hoehe und Bodenversatz der PIXELFIGUR auf einer Arenakarte, in Prozent der
 * Koerperhoehe — dieselben zwei Angaben wie `FIGURENKASTEN`, fuer denselben
 * Ort, nur eben fuer den Rueckfall.
 *
 * ZWEI KAESTEN UND NICHT EINER, weil die beiden Bilder verschieden gebaut
 * sind: Beim 3D-Blatt ist der sichtbare Kasten eine ZELLE mit viel
 * durchsichtigem Rand fuer den ausgeholten Schlag, und die Figur setzt darin
 * bei 80 % auf (`FIGUREN3D_FUSSPUNKT`). Die Pixelkachel dagegen IST die Figur:
 * Sie fuellt ihre Kachel aus und steht mit den Fuessen auf deren Unterkante.
 * Deshalb ist der Bodenversatz hier kein negativer Wert, sondern genau die
 * Standlinie — die Kachelunterkante ist der Fuss.
 *
 * Die Standlinie ist dieselbe wie beim Blatt (16,4 % ueber der Unterkante des
 * Koerpers, knapp ueber den Sternen): Waeren es zwei, staende der Rueckfall
 * auf einer anderen Hoehe als seine Nachbarn und fiele genau dadurch auf.
 */
export const RUECKFALLKASTEN = {
  /** Hoehe der Kachel, in Prozent der Koerperhoehe. */
  hoehe: runde((PIXELKACHEL_METER / MASSSTAB_METER) * 100),
  /** Unterkante gegen die des Koerpers, in Prozent — hier die Standlinie. */
  boden: runde((1 - STANDLINIE) * 100),
} as const;

function runde(wert: number): number {
  return Math.round(wert * 1000) / 1000;
}
