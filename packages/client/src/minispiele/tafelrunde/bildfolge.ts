/**
 * Welches Bild einer Figurenfolge gerade dran ist — die Rechnung hinter den
 * Figuren im Kampf von TafelrundeNeu (`neu/Kampf.tsx`).
 *
 * Wie die Blaetter aufgebaut sind (Zeilen, Bildzahl, Bildrate, Schleife),
 * steht ausschliesslich in `src/figuren3d/figuren3d.ts`; diese Datei rechnet
 * damit und schreibt nichts davon ab. Die Blaetter selbst nennt
 * `figuren3d/grafik-neu.ts` (je Einheit eins, 256 px, dasselbe Raster).
 *
 * DIE AUFTEILUNG: Hier steht, WELCHES Bild — in `neu/Kampf.tsx` steht, wann
 * es an den Bildschirm kommt. Die Auswahl ist eine reine Funktion von
 * Zeitstempeln und damit pruefbar, ohne eine Uhr laufen zu lassen.
 *
 * Bis zum 28.11.2026 standen hier ausserdem die Rollenblaetter der alten
 * KayKit-Figuren (`blattPfad`) und die gemessenen Kaesten fuer Brett, Bank
 * und Ladenkarte des alten Tafelrunde. Beides ist mit ihm gegangen.
 */

import {
  type Bewegung3D,
  FIGUREN3D_KANTE,
  FIGUREN3D_SPALTEN,
  FIGUREN3D_ZEILEN,
  folgeVon,
  zelleVon,
} from '../../figuren3d/figuren3d';

// ---------------------------------------------------------------------------
// Der Takt des Kampfes
// ---------------------------------------------------------------------------

/**
 * Wie schnell der Kampf laeuft — AUS DER SICHT und nicht aus dieser Datei.
 *
 * Beide Zahlen kommen vom Modul (`zeitraffer` und `schrittMs` in
 * `packages/game-tafelrunde/src/sicht.ts`); die Anzeige reicht sie herein
 * (neu/Kampf.tsx). Bis zum 18.09.2026 stand der Zeitraffer hier als
 * `KAMPF_TEMPO = 2` und war eine Abschrift von `STANDARD_REGLER.zeitraffer`:
 * Wer ihn im Modul drehte, bekam weder einen Uebersetzungsfehler noch einen
 * roten Test, sondern Figuren, die zu langsam oder zu hektisch ausholen,
 * waehrend die Treffer weiter im richtigen Takt fallen (CLAUDE.md: was das
 * Modul weiss, schreibt der Client nicht ab).
 */
export interface Kampftakt {
  /**
   * Um wie viel schneller die Bildfolgen laufen als im Modell gemessen.
   *
   * ES IST DER ZEITRAFFER DES KAMPFES: Angriffstempo und Schrittweite laufen
   * um diesen Faktor schneller als die Werte im Katalog. Die Bildraten in
   * `figuren3d.ts` sind dagegen die des Modells, also fuer einfaches Tempo.
   * Wer sie unveraendert abspielt, bekommt Figuren, die zweimal je Sekunde
   * treffen und dabei in Zeitlupe ausholen.
   *
   * NACHGEMESSEN am aufgezeichneten Kampf der Probe (`proben/kampf/`, Runde
   * 10, 155 Treffer, Zeitraffer x2): Der kuerzeste Abstand zwischen zwei
   * Schlaegen DESSELBEN Angreifers ist 500 ms (44-mal), der Median 600 ms.
   * Die Schlagfolge hat sechs Bilder; bei der Modellrate 6 dauerte sie
   * 1000 ms und man saehe nie mehr als das Ausholen. Mit dem Faktor 2 sind es
   * 500 ms — die Folge laeuft also auch beim schnellsten Angreifer gerade
   * durch, bevor der naechste Schlag faellt. (Die Probe darauf steht in
   * bildfolge.test.ts und misst gegen den Raffer, den das Modul heute
   * liefert.)
   *
   * AUSGENOMMEN IST `stand`: Das Atmen im Stillstand haengt an keiner Zeit des
   * Protokolls. Verdoppelt saehe es nicht schneller aus, sondern nervoes.
   */
  readonly zeitraffer: number;
  /**
   * Wie lange eine Einheit im Modul von Feld zu Feld braucht, in
   * Millisekunden (`schrittdauer` in kampf.ts).
   *
   * Eigene Zahl und nicht `500 / zeitraffer`: Das Modul rundet auf ganze Takte
   * AUF (bei Zeitraffer 2 sind es 300 ms und nicht 250). Wer hier teilte, haette
   * wieder eine zweite Wahrheit — nur eine, die knapp danebenliegt statt weit.
   */
  readonly schrittMs: number;
}

/**
 * Was der Figur an Vorsprung bleibt: Sie soll ankommen, BEVOR der naechste
 * Schritt faellig ist.
 *
 * FRUEHER STANDEN HIER 380 MS FEST, und die Begruendung dafuer stimmte nicht
 * mehr: Sie waren an `SCHRITT_MS = 500` gemessen, dem Schritt bei EINFACHEM
 * Tempo. Mit dem Zeitraffer x2 dauert ein Schritt 300 ms — der Uebergang war
 * also laenger als der Schritt, und zwei Schritte hintereinander schoben sich
 * uebereinander. Im Kampf der Probe steht der Beleg: Die ersten beiden Zuege
 * derselben Figur liegen 300 ms auseinander.
 */
const GLEIT_PUFFER_MS = 20;

/**
 * Wie lange die Figur von Feld zu Feld gleitet, in Millisekunden.
 *
 * Der Weg selbst ist ein CSS-Uebergang (`.kampfFigur` in neu/neu.module.css);
 * die Lauffolge muss genau so lange laufen wie er, sonst rudert die Figur
 * noch, wenn sie laengst steht. Damit es dafuer nicht zwei Zahlen gibt, setzt
 * die Komponente den Uebergang aus DIESEM Wert (`--gleiten`).
 */
export function gleitenMs(takt: Kampftakt): number {
  return Math.max(0, takt.schrittMs - GLEIT_PUFFER_MS);
}

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
export function sackenMs(takt: Kampftakt): number {
  const tod = folgeVon('tod');
  return Math.round((tod.bilder / (tod.bildrate * takt.zeitraffer)) * 1000);
}

// ---------------------------------------------------------------------------
// Welche Bewegung, welches Bild
// ---------------------------------------------------------------------------

/**
 * Was einer Figur zuletzt widerfahren ist — Zeitstempel AUS DEM PROTOKOLL.
 *
 * Alle vier Werte sind woertlich das `zeitMs` des jeweiligen Ereignisses
 * (`wendeAn` in kampfbericht.ts schreibt sie ab). Hier wird daraus nichts
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
function bildNummer(bewegung: Bewegung3D, verstrichenMs: number, takt: Kampftakt): number {
  const folge = folgeVon(bewegung);
  // Nur das Atmen laeuft im Modelltempo — Begruendung an `Kampftakt`.
  const tempo = bewegung === 'stand' ? 1 : takt.zeitraffer;
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
function einmalBild(
  bewegung: Bewegung3D,
  ab: number | null,
  zeitMs: number,
  takt: Kampftakt,
): number | null {
  if (ab === null || zeitMs < ab) return null;
  const bild = bildNummer(bewegung, zeitMs - ab, takt);
  return bild < folgeVon(bewegung).bilder ? bild : null;
}

/** Das Bild einer Schleife, mit Versatz in ganzen Bildern. */
function schleifenBild(
  bewegung: Bewegung3D,
  verstrichenMs: number,
  takt: Kampftakt,
  versatz = 0,
): number {
  const folge = folgeVon(bewegung);
  const roh = bildNummer(bewegung, verstrichenMs, takt) + versatz;
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
 *  3. **lauf** vor **schlag**, solange die Figur gleitet (`gleitenMs`). Wer
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
export function bildstand(
  spur: Bewegungsspur,
  zeitMs: number,
  takt: Kampftakt,
  ruhig = false,
): Bildstand {
  const roh = laufender(spur, zeitMs, takt);
  if (!ruhig) return roh;
  const bild = roh.bewegung === 'tod' ? folgeVon('tod').bilder - 1 : 0;
  return { bewegung: roh.bewegung, bild };
}

function laufender(spur: Bewegungsspur, zeitMs: number, takt: Kampftakt): Bildstand {
  if (spur.totAb !== null && zeitMs >= spur.totAb) {
    const letztes = folgeVon('tod').bilder - 1;
    return {
      bewegung: 'tod',
      bild: Math.min(letztes, bildNummer('tod', zeitMs - spur.totAb, takt)),
    };
  }
  const getroffen = einmalBild('getroffen', spur.getroffenAb, zeitMs, takt);
  if (getroffen !== null) return { bewegung: 'getroffen', bild: getroffen };
  if (spur.zugAb !== null && zeitMs >= spur.zugAb && zeitMs - spur.zugAb < gleitenMs(takt)) {
    return { bewegung: 'lauf', bild: schleifenBild('lauf', zeitMs - spur.zugAb, takt) };
  }
  const schlag = einmalBild('schlag', spur.schlagAb, zeitMs, takt);
  if (schlag !== null) return { bewegung: 'schlag', bild: schlag };
  return { bewegung: 'stand', bild: schleifenBild('stand', zeitMs, takt, spur.id) };
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

/** Auf drei Stellen gerundet — ungerundet stuenden im DOM Zeichenketten wie `-16.666666666666664

/** Auf drei Stellen gerundet — ungerundet stuenden im DOM Zeichenketten wie -16.666666666666664 %. */
function runde(wert: number): number {
  return Math.round(wert * 1000) / 1000;
}
