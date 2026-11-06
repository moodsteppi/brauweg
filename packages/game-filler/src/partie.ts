/**
 * Spielzustand und Regeln von Filler.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1).
 *
 * Das Spiel: Jeder startet auf einer Ecke. Wer am Zug ist, waehlt eine Farbe;
 * sein ganzes Gebiet nimmt sie an und schluckt dabei jedes angrenzende freie
 * Feld dieser Farbe — und deren Nachbarn gleicher Farbe gleich mit. Die eigene
 * Farbe und die des Gegners sind gesperrt. Zu Ende ist es, wenn kein freies
 * Feld mehr uebrig ist; es gewinnt, wer mehr Felder haelt.
 *
 * Die Abwandlung gegenueber dem Vorbild steht NICHT hier, sondern in
 * `sicht.ts`: Der Zustand kennt das ganze Brett, hinaus geht nur, was an das
 * eigene Gebiet grenzt. Genau so verlangt es Grundsatz 2 — Sichtbarkeit
 * entsteht ausschliesslich in viewFor, der Client blendet nichts selbst aus.
 */

import {
  type FillerRegeln,
  type FillerRegelnFest,
  aufbauFuer,
  ausgleichFuer,
  barrierenZuschlagSitz1,
  farbzahl,
  istVariante,
  mitBarrieren,
  mitSternen,
  mauernJeZug,
  punkteZuschlagSitz1,
} from './regeln.js';

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------

/**
 * Der Zufallsgenerator steht hier noch einmal, obwohl die anderen Spielmodule
 * denselben haben. Aus demselben Grund wie dort: Ein Spielmodul ist eine
 * eigenstaendige Bibliothek. Wanderte der Generator in ein gemeinsames Paket,
 * aenderte eine Verbesserung dort das Brett JEDER gespeicherten Partie.
 */
export type Saat = number | string;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function worte(hex: string): [number, number, number, number] {
  const sauber = hex.replace(/[^0-9a-f]/gi, '').padEnd(32, '0').slice(0, 32);
  return [
    Number.parseInt(sauber.slice(0, 8), 16) >>> 0,
    Number.parseInt(sauber.slice(8, 16), 16) >>> 0,
    Number.parseInt(sauber.slice(16, 24), 16) >>> 0,
    Number.parseInt(sauber.slice(24, 32), 16) >>> 0,
  ];
}

/**
 * Eine Zahl ist ein 32-Bit-Seed: gut fuer Tests, zu klein fuer den Ernstfall.
 *
 * Bei Filler ist das kein Nebensatz, sondern der Kern der Abwandlung: Wer die
 * Saat hat, rechnet sich das GANZE Brett aus und spielt im Nebel mit offenen
 * Karten. 2^32 Moeglichkeiten durchzuprobieren dauert Sekunden, und ob eine
 * stimmt, sieht man an den paar Feldern, die man ohnehin schon kennt. Im
 * Betrieb kommt deshalb die Hexkette vom Server.
 */
export function baueZufall(saat: Saat): () => number {
  if (typeof saat === 'number') return mulberry32(saat);
  const [a, b, c, d] = worte(saat);
  const zufall = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/**
 * So viele Graustufen gibt es fuer verdeckte Felder.
 *
 * Sie sind reine Zeichnung: Ohne sie waere der Nebel eine einzige graue
 * Flaeche, und man saehe nicht mehr, dass darunter EINZELNE Felder liegen.
 * Fuenf reichen dafuer und bleiben weit genug voneinander entfernt, dass der
 * Unterschied auf einem Handydisplay noch sichtbar ist.
 *
 * Die Zahl ist bewusst NICHT die Farbzahl. Waeren es sechs, laege der
 * Verdacht nahe, Grauton n stehe fuer Farbe n — und ein Mitspieler, der das
 * an ein paar aufgedeckten Feldern nachprueft, haette das ganze Brett.
 */
export const GRAUTOENE = 5;

/**
 * Nach so vielen Zuegen in Folge ohne ein einziges erobertes Feld ist Schluss.
 *
 * Der Normalfall ist das nicht: Solange irgendwo ein freies Feld an ein Gebiet
 * grenzt, bringt mindestens eine Farbe etwas ein. Denkbar ist aber ein Brett,
 * auf dem jedes Grenzfeld ausgerechnet die Farbe des Gegners traegt — dann
 * zoegen beide ewig ins Leere. Ohne diesen Deckel liefe so ein Tisch bis zum
 * Verfall weiter, und niemand koennte etwas dagegen tun.
 */
export const LEERZUEGE_MAX = 6;

/**
 * So viele Zuege zu Beginn sind mauerfrei — ueber beide Sitze gezaehlt.
 *
 * Drei: der erste Zug beider und der zweite des Anfaengers. Erst der zweite
 * Zug des zweiten Spielers darf eine Wand setzen. Bis dahin haben beide je
 * einmal gefaerbt und der Anfaenger seinen Vorsprung ausgespielt, ohne dass
 * schon eine Wand steht — sonst haette er den Vorteil des ersten Zugs UND
 * den der ersten Wand.
 */
export const MAUERFREIE_ZUEGE = 3;

/**
 * Wie viele Zuege noch mauerfrei sind. 0, sobald gebaut werden darf.
 *
 * Die Zahl kommt aus dem Regelsatz des TISCHES (`mauerfreieZuege`, in
 * Extreme seit dem 06.11.2026 sechs), sonst MAUERFREIE_ZUEGE. Nicht aus der
 * Vorgabe: Ein Tisch, der mit drei angefangen hat, behaelt drei.
 */
export function mauerSperre(partie: FillerPartie): number {
  const frei = partie.regeln.mauerfreieZuege ?? MAUERFREIE_ZUEGE;
  return Math.max(0, frei - partie.zug);
}

/**
 * Sternfelder der Spielart `extreme`: wie viele, was sie bringen.
 *
 * Drei auf 56 Feldern: genug, dass sich ein Umweg lohnt, zu wenige, um das
 * Spiel zu einer Sternjagd zu machen. Ein Stern ist ZWEI Punkte wert (das
 * Feld selbst plus STERN_BONUS) und bringt STERN_MAUERN Mauern in den Vorrat.
 *
 * Seit dem 05.11.2026 gilt die Drei nur noch fuer Tische, die ohne
 * `aufbauJeSpielart` aufgemacht wurden. Neue Extreme-Tische legen auf 12 x 11
 * acht Sterne als vier Spiegelpaare (`sternPaare`, siehe zieheSternPaare).
 */
export const STERNE_ANZAHL = 3;
export const STERN_BONUS = 1;
export const STERN_MAUERN = 1;

export interface FillerPartie {
  readonly regeln: FillerRegelnFest;
  /**
   * Farbnummer je Platz, 0 bis regeln.farben-1.
   *
   * Verlaesst diese Datei NIE ungefiltert — das ist bei Filler das ganze
   * Geheimnis (siehe sicht.ts).
   */
  readonly feld: readonly number[];
  /**
   * Grauton je Platz, 0 bis GRAUTOENE-1. Reine Zeichnung fuer verdeckte
   * Felder, unabhaengig aus der Saat gezogen und deshalb ungefaehrlich: Sie
   * darf in jeder Sicht stehen.
   */
  readonly grau: readonly number[];
  /** Wem ein Platz gehoert, sonst null. */
  readonly besitzer: readonly (number | null)[];
  /** Aktuelle Gebietsfarbe je Sitz. Sie ist fuer alle gesperrt. */
  readonly farbe: Readonly<Record<number, number>>;
  /** Gehaltene Felder je Sitz. Zugleich die Punktzahl. */
  readonly punkte: Readonly<Record<number, number>>;
  readonly dran: number;
  /** Fortlaufende Zugnummer, ueber alle Sitze hinweg. */
  readonly zug: number;
  /** Zuege in Folge, die kein Feld eingebracht haben. Siehe LEERZUEGE_MAX. */
  readonly leerzuege: number;
  readonly leftSeats: readonly number[];
  readonly fertig: boolean;
  /**
   * Gesetzte Barrieren als Kantenschluessel (`"a:b"`, kleinerer Platz zuerst).
   *
   * Eine Barriere liegt ZWISCHEN zwei Feldern, nicht auf einem — sie ist eine
   * Kante des Gitters, kein Feld. Deshalb ein Schluessel aus beiden Plaetzen
   * und keine Liste je Feld: Eine Wand gehoert beiden Seiten gleichermassen,
   * und zwei halbe Eintraege koennten auseinanderlaufen.
   *
   * **Sie sperrt fuer BEIDE Seiten.** Eine Wand, die nur den Gegner aufhaelt,
   * waere kein Bauwerk, sondern ein Zauber: Man mauerte die Flaeche zu, die
   * man haben will, und holte sie danach in Ruhe. Symmetrisch ist sie ein
   * echter Handel — man gibt denselben Weg auf, den man dem anderen nimmt.
   *
   * Leer in jeder Spielart ausser `build`.
   */
  readonly barrieren: readonly string[];
  /** Wie viele Barrieren einem Sitz noch bleiben. */
  readonly barrierenUebrig: Readonly<Record<number, number>>;
  /**
   * Wie viele Mauern der Sitz, der gerade am Zug ist, in DIESEM Zug schon
   * gesetzt hat.
   *
   * Eine Mauer beendet den Zug nicht — man baut und faerbt danach trotzdem.
   * Ohne diesen Zaehler liesse sich in einem einzigen Zug der ganze Vorrat
   * verbauen, und die Spielart waere nach dem ersten Zug entschieden. Wie
   * viele erlaubt sind, sagt `mauernJeZug` im Regelsatz (eine; in Extreme
   * seit dem 05.11.2026 zwei).
   *
   * Er gehoert an den ZUG und nicht an den Sitz: Mit dem Faerben geht der Zug
   * weiter, und der Zaehler faellt dabei auf null. Ein Verzeichnis je Sitz
   * muesste an derselben Stelle geleert werden und koennte dabei
   * auseinanderlaufen.
   *
   * Bis Snapshot-Fassung 5 hiess das Feld `mauerDiesenZug` und war ein
   * Ja/Nein — bei hoechstens einer Mauer je Zug dasselbe (siehe adapter.ts).
   */
  readonly mauernDiesenZug: number;
  /**
   * Sitze, die in ihrem naechsten (bzw. gerade laufenden) Zug KEINE Mauer
   * setzen duerfen, weil sie im Zug davor die volle Zahl `mauernJeZug`
   * gebaut haben — nur dort, wo die ueber eins liegt.
   *
   * Ohne die Pause waeren zwei Mauern je Zug schlicht doppelt so viele: Wer
   * jeden Zug zwei setzt, riegelt ein 12er-Brett in sechs Zuegen ab. Mit ihr
   * ist die zweite Mauer ein Vorgriff auf den naechsten Zug — man darf die
   * Wand schneller hochziehen, aber nicht oefter.
   *
   * An den SITZ und nicht an den Zug, anders als `mauernDiesenZug`: Die
   * Pause ueberdauert den Zug des Gegners. Sie faellt, sobald der Sitz seinen
   * naechsten Zug mit dem Faerben beendet.
   */
  readonly mauerPause: readonly number[];
  /**
   * Plaetze der Sternfelder. Leer in jeder Spielart ausser `extreme`.
   *
   * Der Stern bleibt am Platz, auch nachdem er geschluckt wurde: Er ist eine
   * Eigenschaft des Feldes, kein Gegenstand, den man aufhebt. Wer ihn hat,
   * sieht das an seinem Gebiet — und die Punkte dafuer sind laengst verbucht.
   */
  readonly sterne: readonly number[];
  /**
   * Der Sitz, der aufgegeben hat — oder null.
   *
   * Steht im Zustand und wird nicht aus den Punkten erschlossen, weil die
   * Aufgabe die Rangfolge UMDREHT: Wer aufgibt, verliert, auch wenn er
   * vorne lag. `platzierungen` und `sieger` lesen deshalb dieses Feld
   * zuerst. Fehlt es in einem aelteren Snapshot, hat niemand aufgegeben
   * (adapter.ts).
   */
  readonly aufgegeben: number | null;
}

export type FillerAktion =
  | { readonly typ: 'faerben'; readonly farbe: number }
  /**
   * Eine Barriere setzen — ein ganzer Zug, keine Zugabe.
   *
   * Das ist die Entscheidung, an der die Spielart haengt: Wer mauert, faerbt
   * in dieser Runde nicht und verschenkt die Felder, die er haette holen
   * koennen. Waere die Wand gratis, setzte man alle fuenf sofort.
   */
  | { readonly typ: 'barriere'; readonly von: number; readonly nach: number }
  /**
   * Aufgeben (seit dem 06.11.2026, wie bei BroChess). Jederzeit durch den
   * Sitz selbst, auch wenn der Gegner am Zug ist — wer aussteigen will, soll
   * nicht erst auf seinen Zug warten muessen. Die Partie ist danach zu Ende,
   * der Gegner hat gewonnen, unabhaengig vom Punktestand.
   *
   * Steht bewusst NICHT in `erlaubteZuege`: Daraus waehlt der Bot, und der
   * gibt nie auf. Der Bildschirm bietet die Aktion von sich aus an — eine
   * Regel bildet er damit nicht nach, erlaubt ist sie immer, solange die
   * Partie laeuft.
   */
  | { readonly typ: 'aufgeben' };

// ---------------------------------------------------------------------------
// Brett
// ---------------------------------------------------------------------------

/** Die vier orthogonalen Nachbarn eines Platzes. Diagonalen zaehlen nicht. */
export function nachbarn(platz: number, spalten: number, zeilen: number): number[] {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const raus: number[] = [];
  if (x > 0) raus.push(platz - 1);
  if (x < spalten - 1) raus.push(platz + 1);
  if (y > 0) raus.push(platz - spalten);
  if (y < zeilen - 1) raus.push(platz + spalten);
  return raus;
}

/**
 * Schluessel einer Gitterkante. Kleinerer Platz zuerst, damit dieselbe Wand
 * von beiden Seiten aus denselben Namen hat.
 */
export function kante(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Nachbarn, die nicht durch eine Barriere abgetrennt sind. */
export function offeneNachbarn(
  platz: number,
  spalten: number,
  zeilen: number,
  sperren: ReadonlySet<string>,
): number[] {
  const alle = nachbarn(platz, spalten, zeilen);
  if (sperren.size === 0) return alle;
  return alle.filter((n) => !sperren.has(kante(platz, n)));
}

/**
 * Die Startecke eines Sitzes: Sitz 0 unten links, Sitz 1 oben rechts.
 *
 * Diagonal gegenueber und nicht nebeneinander — sonst waere die erste
 * Begegnung im zweiten Zug und die Partie eine Frage des Anfangs. Die
 * Reihenfolge (0 unten) ist zugleich die des Bildschirms: Wer spielt, sitzt
 * unten, so wie an jedem anderen Tisch der Plattform auch.
 */
export function startEcke(sitz: number, spalten: number, zeilen: number): number {
  const ecken = [
    (zeilen - 1) * spalten, // unten links
    spalten - 1, //            oben rechts
    0, //                      oben links
    zeilen * spalten - 1, //   unten rechts
  ];
  return ecken[sitz % ecken.length] ?? 0;
}

/**
 * Ein Brett, auf dem KEINE zwei benachbarten Felder dieselbe Farbe tragen.
 *
 * Das ist keine Schoenheit, sondern die Voraussetzung des Spiels: Traegt ein
 * Nachbar der Startecke zufaellig deren Farbe, gehoerte er von Anfang an mit
 * dazu — der eine Spieler faenge mit drei Feldern an, der andere mit einem.
 * Genau deshalb wird beim Ziehen die Farbe des linken und des oberen Nachbarn
 * ausgeschlossen; alle anderen Nachbarn kommen erst spaeter dran und sehen
 * ihrerseits nach oben und nach links.
 */
function baueBrett(regeln: FillerRegelnFest, zufall: () => number): number[] {
  const { spalten, zeilen, farben } = regeln;
  const feld: number[] = new Array(spalten * zeilen).fill(0);
  for (let platz = 0; platz < feld.length; platz++) {
    const x = platz % spalten;
    const verboten = new Set<number>();
    if (x > 0) verboten.add(feld[platz - 1]!);
    if (platz >= spalten) verboten.add(feld[platz - spalten]!);
    const moeglich: number[] = [];
    for (let f = 0; f < farben; f++) if (!verboten.has(f)) moeglich.push(f);
    feld[platz] = moeglich[Math.floor(zufall() * moeglich.length)] ?? 0;
  }
  return feld;
}

/**
 * Faire Startecken: Die zwei Nachbarn jeder Startecke tragen VERSCHIEDENE
 * Farben (seit dem 06.11.2026, Regelsatz `faireEcken`, nur Extreme).
 *
 * Der Fehler, den das verhindert: Tragen beide Nachbarn einer Ecke dieselbe
 * Farbe X, waehlt der Gegner, der vorher zieht, einfach X — X ist dann
 * gesperrt, und der Sitz hat im naechsten Zug keine einzige Farbe, die ihm
 * ein Feld bringt. Schlimmer noch, wenn die Ecke des Gegners selbst X traegt:
 * Dann ist X von Anfang an gesperrt, und der Sitz verliert seinen ersten Zug
 * ganz ohne Zutun des Gegners (Messung f1: in Extreme bei rund jedem fuenften
 * Brett moeglich, 4,3 % der Partien ohne nutzbare Farbe nach Zug 1).
 *
 * Warum "verschieden" genuegt: Gesperrt sind fuer einen Sitz genau zwei
 * Farben, die eigene und die des Gegners. Kein Nachbar traegt die eigene
 * (siehe baueBrett), also muesste der Gegner mit EINER Farbe beide Nachbarn
 * treffen — das geht nur, wenn sie gleich sind. Gilt fuer den Nachzieher nach
 * Zug 1 wie fuer den Anfaenger in Zug 1 (gesperrt: die Ecke des Gegners).
 *
 * Umgefaerbt wird der SENKRECHTE Nachbar, auf eine Farbe, die keiner seiner
 * eigenen Nachbarn traegt und die der waagrechte nicht hat — so bleibt das
 * Brett frei von gleichfarbigen Nachbarn. Bei sieben Farben und hoechstens
 * vier Nachbarn bleiben immer mindestens zwei zur Wahl, gezogen wird aus der
 * Saat. Die Ecke selbst bleibt, wie sie ist; ob zwei Ecken dieselbe Farbe
 * tragen, regelt erstellePartie danach wie bisher (und faerbt dabei nur die
 * Ecke, nie einen Nachbarn — das hier bleibt also gueltig).
 */
function entzerreEcken(
  feld: number[],
  spalten: number,
  zeilen: number,
  farben: number,
  sitze: readonly number[],
  zufall: () => number,
): void {
  for (const sitz of sitze) {
    const ecke = startEcke(sitz, spalten, zeilen);
    const um = nachbarn(ecke, spalten, zeilen);
    const waagrecht = um.find((n) => Math.floor(n / spalten) === Math.floor(ecke / spalten));
    const senkrecht = um.find((n) => n % spalten === ecke % spalten);
    if (waagrecht === undefined || senkrecht === undefined) continue;
    if (feld[waagrecht] !== feld[senkrecht]) continue;
    const verboten = new Set<number>([feld[waagrecht]!]);
    for (const n of nachbarn(senkrecht, spalten, zeilen)) verboten.add(feld[n]!);
    const moeglich: number[] = [];
    for (let f = 0; f < farben; f++) if (!verboten.has(f)) moeglich.push(f);
    const neu = moeglich[Math.floor(zufall() * moeglich.length)];
    if (neu !== undefined) feld[senkrecht] = neu;
  }
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

export function erstellePartie(
  regeln: FillerRegeln,
  sitze: readonly number[],
  saat: Saat,
): FillerPartie {
  const zufall = baueZufall(saat);
  /*
   * Fehlende Felder EINMAL hier ergaenzen und nicht an jeder Lesestelle.
   * Ein Tisch von vor dem 31. August hat keine Spielart, einer von vor dem
   * 1. September keine Barrierenzahl — stuende beides als `undefined` im
   * Snapshot, muesste jede spaetere Stelle raten, was es bedeutet.
   */
  /*
   * Erst den Aufbau der Spielart einsetzen (Extreme: 12 x 11, zwanzig Mauern,
   * zwei je Zug, gespiegelte Sterne), dann die Tabellen weglassen. Ohne
   * Eintrag fuer die Spielart aendert sich hier nichts — auch kein neuer
   * Schluessel im Snapshot.
   */
  /*
   * Ebenso den Ausgleich fuer den Nachziehenden (seit dem 07.11.2026): Ab
   * hier stehen nur noch die beiden Felder im Snapshot, und nur in den
   * Spielarten, die einen haben — eine Nebel-Partie sieht aus wie vorher.
   */
  const {
    farbenJeSpielart: _jeSpielart,
    aufbauJeSpielart: _aufbau,
    ausgleichJeSpielart: _ausgleich,
    ...ohneTabelle
  } = ausgleichFuer(aufbauFuer(regeln));
  const gueltigeRegeln: FillerRegelnFest = {
    ...ohneTabelle,
    /*
     * Die Farbzahl steht ab hier fest in der Partie, die Tabelle je Spielart
     * nicht: Sie beschreibt nur, womit ein Tisch AUFGEMACHT wird, und stuende
     * sonst in jedem Snapshot als zweite, ungenutzte Wahrheit.
     */
    farben: farbzahl(regeln),
    variante: istVariante(regeln.variante) ? regeln.variante : 'nebel',
    // Aus dem Aufbau, nicht aus `regeln`: Extreme ueberstimmt die Zehn mit zwanzig.
    barrieren: typeof ohneTabelle.barrieren === 'number' ? ohneTabelle.barrieren : 0,
  };
  const { spalten, zeilen, farben } = gueltigeRegeln;
  const feld = baueBrett(gueltigeRegeln, zufall);
  /*
   * Faire Startecken (nur wo der Regelsatz es sagt, also Extreme ab dem
   * 06.11.2026). VOR den Grautoenen, weil auch das Entzerren aus dem
   * Generator zieht — fuer alle anderen Spielarten wird hier nichts gezogen,
   * ihr Brett bleibt Saat fuer Saat dasselbe.
   */
  if (gueltigeRegeln.faireEcken === true) entzerreEcken(feld, spalten, zeilen, farben, sitze, zufall);

  /*
   * Die Grautoene NACH dem Brett und aus demselben Generator, aber als eigene
   * Zuege: Es sind unabhaengige Ziehungen, aus einem Grauton laesst sich also
   * keine Farbe herleiten. Wer sie stattdessen aus der Farbe ableitete
   * (`farbe % GRAUTOENE`), haette den ganzen Nebel in einer Zeile verschenkt.
   */
  const grau = feld.map(() => Math.floor(zufall() * GRAUTOENE));

  /*
   * Die Sterne NACH den Grautoenen ziehen, damit die anderen Spielarten
   * denselben Generatorstand behalten wie vorher: Ohne Sterne wird hier
   * nichts gezogen, und jede gespeicherte Partie sieht nach dem Deploy aus
   * wie davor.
   */
  const paare = gueltigeRegeln.sternPaare ?? 0;
  const sterne = !mitSternen(gueltigeRegeln.variante)
    ? []
    : paare > 0
      ? zieheSternPaare(spalten, zeilen, sitze, paare, zufall)
      : zieheSterne(spalten, zeilen, sitze, zufall);

  const besitzer: (number | null)[] = new Array(feld.length).fill(null);
  const farbe: Record<number, number> = {};
  const punkte: Record<number, number> = {};
  const barrierenUebrig: Record<number, number> = {};
  const belegt = new Set<number>();

  for (const sitz of sitze) {
    const ecke = startEcke(sitz, spalten, zeilen);
    /*
     * Zwei Sitze duerfen nicht mit derselben Farbe anfangen: Dann waere nur
     * EINE Farbe gesperrt statt zweien, und der erste Zug haette eine
     * Auswahl mehr als jeder folgende. Die Ecken liegen weit auseinander, das
     * Brett verbietet also nichts — hier wird eine Farbe gesucht, die weder
     * ein Nachbar noch eine andere Ecke schon traegt. Bei sechs Farben und
     * hoechstens fuenf Sperren gibt es die immer.
     */
    if (belegt.has(feld[ecke]!)) {
      const verboten = new Set<number>(belegt);
      for (const n of nachbarn(ecke, spalten, zeilen)) verboten.add(feld[n]!);
      for (let f = 0; f < farben; f++) {
        if (!verboten.has(f)) {
          feld[ecke] = f;
          break;
        }
      }
    }
    belegt.add(feld[ecke]!);
    besitzer[ecke] = sitz;
    farbe[sitz] = feld[ecke]!;
    punkte[sitz] = 1;
    /*
     * Der Nachziehende (`sitze[1]`, am Tisch Sitz 1) bekommt den Zuschlag:
     * Der Anfaenger hat meist auch den letzten Farbzug, und der entscheidet
     * mit Mauern fast jede Partie (MESSUNG-2026-11-07-anzug.md). Ohne
     * Mauern gibt es keinen Vorrat, also auch keinen Zuschlag.
     */
    barrierenUebrig[sitz] = mitBarrieren(gueltigeRegeln.variante)
      ? (gueltigeRegeln.barrieren ?? 0) +
        (sitz === sitze[1] ? barrierenZuschlagSitz1(gueltigeRegeln) : 0)
      : 0;
  }

  return {
    /*
     * Die Spielart wird HIER festgeschrieben und nicht erst beim Lesen der
     * Sicht ergaenzt. Ein Tisch von vor dem 31. August hat sie nicht in der
     * `config`; ohne diese Zeile stuende im Snapshot ein `undefined`, und
     * jede spaetere Stelle muesste raten, was es bedeutet. So steht ab dem
     * ersten Zug eine der beiden Spielarten im Zustand — und zwar die, die
     * damals gespielt wurde.
     */
    regeln: gueltigeRegeln,
    feld,
    grau,
    besitzer,
    farbe,
    punkte,
    dran: sitze[0] ?? 0,
    zug: 0,
    leerzuege: 0,
    leftSeats: [],
    fertig: false,
    barrieren: [],
    barrierenUebrig,
    mauernDiesenZug: 0,
    mauerPause: [],
    sterne,
    aufgegeben: null,
  };
}

/**
 * Drei Sternfelder aus der Saat ziehen.
 *
 * Nicht auf einer Startecke und nicht daneben: Ein Stern am eigenen Anfang
 * waere ein Geschenk an den, der zufaellig dort sitzt. Und nicht auf einem
 * Haufen: Zwei Sterne mit Abstand unter drei Schritten holte man mit einem
 * einzigen Zug. Gezogen wird aus dem, was bleibt — bei 8 x 7 sind das ueber
 * vierzig Plaetze, die Suche bricht also nie ab.
 */
function zieheSterne(
  spalten: number,
  zeilen: number,
  sitze: readonly number[],
  zufall: () => number,
): number[] {
  const verboten = eckenUndNachbarn(spalten, zeilen, sitze);
  const abstand = (a: number, b: number): number => schritte(a, b, spalten);

  const sterne: number[] = [];
  let kandidaten = Array.from({ length: spalten * zeilen }, (_, p) => p).filter(
    (p) => !verboten.has(p),
  );
  while (sterne.length < STERNE_ANZAHL && kandidaten.length > 0) {
    const stern = kandidaten[Math.floor(zufall() * kandidaten.length)]!;
    sterne.push(stern);
    kandidaten = kandidaten.filter((p) => abstand(p, stern) >= 3);
  }
  return sterne.sort((a, b) => a - b);
}

/** Startecken der Sitze und ihre Nachbarn — dort liegt kein Stern. */
function eckenUndNachbarn(spalten: number, zeilen: number, sitze: readonly number[]): Set<number> {
  const verboten = new Set<number>();
  for (const sitz of sitze) {
    const ecke = startEcke(sitz, spalten, zeilen);
    verboten.add(ecke);
    for (const n of nachbarn(ecke, spalten, zeilen)) verboten.add(n);
  }
  return verboten;
}

/** Schritte zwischen zwei Plaetzen, nur waagrecht und senkrecht. */
function schritte(a: number, b: number, spalten: number): number {
  return (
    Math.abs((a % spalten) - (b % spalten)) +
    Math.abs(Math.floor(a / spalten) - Math.floor(b / spalten))
  );
}

/** Der an der Brettmitte punktgespiegelte Platz. */
export function spiegelPlatz(platz: number, spalten: number, zeilen: number): number {
  return spalten * zeilen - 1 - platz;
}

/**
 * Sterne als punktgespiegelte Paare: zu jedem Platz p auch
 * spalten*zeilen-1-p (seit dem 05.11.2026 in Extreme).
 *
 * Gespiegelt, weil die Startecken es auch sind — unten links und oben rechts
 * gehen durch dieselbe Spiegelung ineinander ueber. Damit hat jeder Sitz zu
 * jedem Stern genau den Weg, den der andere zu dessen Gegenstueck hat. Bei
 * freien Sternen konnte einer drei Schritte vor der eigenen Ecke liegen und
 * alle anderen am fremden Rand.
 *
 * Die alten Bedingungen bleiben und gelten fuer BEIDE Haelften eines Paares:
 * nicht auf oder neben einer Startecke, Abstand mindestens drei — auch
 * zwischen den zwei Sternen eines Paares. Das geht auf, weil beides selbst
 * spiegelgleich ist: Die verbotenen Eckfelder sind es (Ecke geht auf Ecke),
 * und der Abstand zwischen p und q ist derselbe wie zwischen ihren
 * Spiegelbildern. Wer p gegen alle bisherigen Sterne prueft, hat damit auch
 * das Gegenstueck geprueft. Nur das Paar selbst braucht eine eigene
 * Pruefung: Felder nahe der Mitte liegen naeher als drei an ihrem
 * Spiegelbild und fallen deshalb von vornherein weg (auf 12 x 11 genau
 * sechs). Danach bleiben weit ueber hundert Plaetze, und ein Paar nimmt
 * hoechstens zweimal 13 weg (die Raute mit Radius zwei) — vier Paare passen
 * immer.
 */
function zieheSternPaare(
  spalten: number,
  zeilen: number,
  sitze: readonly number[],
  paare: number,
  zufall: () => number,
): number[] {
  const verboten = eckenUndNachbarn(spalten, zeilen, sitze);
  const spiegel = (p: number): number => spiegelPlatz(p, spalten, zeilen);
  const sterne: number[] = [];
  let kandidaten = Array.from({ length: spalten * zeilen }, (_, p) => p).filter(
    (p) => !verboten.has(p) && !verboten.has(spiegel(p)) && schritte(p, spiegel(p), spalten) >= 3,
  );
  while (sterne.length < paare * 2 && kandidaten.length > 0) {
    const stern = kandidaten[Math.floor(zufall() * kandidaten.length)]!;
    const gegenstueck = spiegel(stern);
    sterne.push(stern, gegenstueck);
    kandidaten = kandidaten.filter(
      (p) => schritte(p, stern, spalten) >= 3 && schritte(p, gegenstueck, spalten) >= 3,
    );
  }
  return sterne.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Ablauf
// ---------------------------------------------------------------------------

export function amZug(partie: FillerPartie): number | null {
  return partie.fertig ? null : partie.dran;
}

/** Die Sitze dieser Partie, aufsteigend. */
export function sitzeVon(partie: FillerPartie): number[] {
  return Object.keys(partie.punkte)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Gesperrte Farben: die Gebietsfarbe JEDES Sitzes.
 *
 * Auch die eines ausgestiegenen Sitzes — sein Gebiet liegt weiter auf dem
 * Brett, und wer seine Farbe waehlen duerfte, schluckte es in einem Zug.
 */
export function gesperrteFarben(partie: FillerPartie): number[] {
  return sitzeVon(partie)
    .map((sitz) => partie.farbe[sitz])
    .filter((f): f is number => f !== undefined);
}

export function erlaubteZuege(partie: FillerPartie, sitz: number): FillerAktion[] {
  if (amZug(partie) !== sitz) return [];
  const gesperrt = new Set(gesperrteFarben(partie));
  const zuege: FillerAktion[] = [];
  for (let f = 0; f < partie.regeln.farben; f++) {
    if (!gesperrt.has(f)) zuege.push({ typ: 'faerben', farbe: f });
  }
  for (const [von, nach] of moeglicheBarrieren(partie, sitz)) {
    zuege.push({ typ: 'barriere', von, nach });
  }
  return zuege;
}

/**
 * Freie Felder, die ein Sitz ueberhaupt noch erreichen kann.
 *
 * Gelaufen wird von seinem Gebiet aus ueber FREIE Felder — durch fremdes
 * Gebiet kommt niemand, das ist die Grundregel des Spiels — und nicht durch
 * Barrieren. Was dabei herauskommt, ist die Antwort auf "hat der noch etwas
 * zu holen?".
 */
export function erreichbareFreie(
  partie: FillerPartie,
  sitz: number,
  sperren: ReadonlySet<string>,
): number {
  const { spalten, zeilen } = partie.regeln;
  const gesehen = new Set<number>();
  const rand: number[] = [];
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] === sitz) rand.push(platz);
  }
  let zahl = 0;
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of offeneNachbarn(platz, spalten, zeilen, sperren)) {
      if (gesehen.has(n)) continue;
      if (partie.besitzer[n] !== null) continue;
      gesehen.add(n);
      zahl++;
      rand.push(n);
    }
  }
  return zahl;
}

/**
 * Freie Felder, die IRGENDEIN Sitz noch erreichen kann.
 *
 * Gelaufen wird von allen Gebieten zugleich ueber freie Felder, nicht durch
 * Barrieren. Was dabei nicht erreicht wird, ist eingemauert: Ein Feld, das
 * niemand mehr holen kann und das die Partie bis zum Ende als Loch traegt.
 */
export function vonIrgendwemErreichbareFreie(
  partie: FillerPartie,
  sperren: ReadonlySet<string>,
): number {
  const { spalten, zeilen } = partie.regeln;
  const gesehen = new Set<number>();
  const rand: number[] = [];
  for (let platz = 0; platz < partie.besitzer.length; platz++) {
    if (partie.besitzer[platz] !== null) rand.push(platz);
  }
  let zahl = 0;
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of offeneNachbarn(platz, spalten, zeilen, sperren)) {
      if (gesehen.has(n)) continue;
      if (partie.besitzer[n] !== null) continue;
      gesehen.add(n);
      zahl++;
      rand.push(n);
    }
  }
  return zahl;
}

/**
 * Hat ein Feld noch Platz fuer eine Mauer? (Regelsatz `mauernJeFeld`, nur
 * Extreme seit dem 06.11.2026, Regel Niklas 05.11.2026.)
 *
 * Gezaehlt werden die Mauern an den vier Kanten des Feldes, und der
 * Spielfeldrand zaehlt als Mauer: Ein Eckfeld hat damit schon zwei und kann
 * keine mehr bekommen, ein Randfeld hoechstens eine, ein inneres zwei. Eine
 * Mauer belegt bei BEIDEN Feldern, zwischen denen sie liegt, einen Platz.
 *
 * Der Sinn ist ein Abwaegen: Jede Mauer, die dem Gegner den Weg versperrt,
 * nimmt auch Plaetze, an denen er MICH spaeter versperren koennte — und
 * umgekehrt. Ohne Grenze liess sich ein Gang mit drei Mauern um ein einziges
 * Feld zur Sackgasse machen.
 */
export function mauernAmFeld(
  platz: number,
  spalten: number,
  zeilen: number,
  sperren: ReadonlySet<string>,
): number {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const rand = Number(x === 0) + Number(x === spalten - 1) + Number(y === 0) + Number(y === zeilen - 1);
  let gesetzt = 0;
  for (const n of nachbarn(platz, spalten, zeilen)) if (sperren.has(kante(platz, n))) gesetzt++;
  return rand + gesetzt;
}

/**
 * Die Barrieren, die dieser Sitz gerade setzen darf.
 *
 * Drei Regeln an der Kante; die ersten beiden gelten in Build und Extreme,
 * die dritte nur an Tischen, deren Regelsatz sie traegt (Extreme ab dem
 * 06.11.2026):
 *
 * **1. Nur an einer Kante, die an ein freies Feld grenzt (seit dem
 * 06.11.2026).** Zwischen zwei Feldern, die schon jemandem gehoeren, sperrt
 * eine Mauer nichts mehr — durch fremdes Gebiet laeuft ohnehin niemand, und
 * im eigenen Gebiet gibt es nichts zu holen. Sie kostete nur einen Stein aus
 * dem Vorrat und stuende als Schmuck auf dem Brett (IMG_1498).
 *
 * **2. Eine Mauer schliesst nie den letzten Weg (seit dem 06.11.2026, Niklas
 * 05.11.2026, IMG_1497/1500/1502/1503).** Verboten ist jede Mauer, nach der
 * IRGENDEIN Sitz ein freies Feld nicht mehr erreicht, das er vorher noch
 * erreichte — "erreichen" heisst: von seinem Gebiet aus ueber freie Felder,
 * nicht durch fremdes Gebiet und nicht durch Mauern. Genau dann trennt diese
 * eine Mauer etwas ab: ein Gebiet vom Rest des Bretts, einen Sitz von den
 * Feldern, um die beide noch spielten. Es zaehlt dabei nicht, woraus der Rest
 * der Umrandung besteht — sind es schon lauter Felder (Koerper), ist die
 * Mauer trotzdem diejenige, die zumacht, und verboten (IMG_1500: Gruen macht
 * mit zwei Feldern zu und schliesst den letzten Durchgang mit einer Mauer).
 * Den letzten Weg mit dem eigenen KOERPER zu schliessen bleibt erlaubt, auch
 * im selben Zug direkt nach einer Mauer (IMG_1502 -> 1503): Geprueft wird nur
 * die Mauer, im Moment, in dem sie gesetzt wird. Eine Mauer darf also einen
 * Weg verlaengern oder verengen, aber nicht kappen.
 *
 * Sie enthaelt die beiden aelteren Regeln, die bis dahin einzeln standen:
 * die Einmauer-Regel (06.09.2026: kein freies Feld darf fuer NIEMANDEN mehr
 * erreichbar sein — dann hat es ja jemand verloren) und die Einsperr-Regel
 * (kein Sitz darf auf null erreichbare Felder fallen). Beide liessen eine
 * Mauer durch, die einen Sitz in zwei Spalten am Rand einschloss, solange
 * dort noch ein freies Feld lag (IMG_1497) — das schliesst erst diese Regel.
 *
 * Geprueft wird fuer JEDEN Sitz, auch den eigenen, und gegen den Stand
 * VORHER: Wer schon eingeschlossen ist — das geht im Grundspiel auch ohne
 * Waende —, hat nichts mehr zu verlieren und blockiert deshalb keine Mauer
 * anderswo auf dem Brett.
 *
 * **3. Hoechstens `mauernJeFeld` Mauern je Feld, der Rand zaehlt mit** —
 * siehe `mauernAmFeld`. Nur, wo der Regelsatz die Zahl traegt.
 *
 * Dazu die Mengenregeln ganz oben: Vorrat, Mauern je Zug, Pause, Eroeffnung.
 */
export function moeglicheBarrieren(
  partie: FillerPartie,
  sitz: number,
): [number, number][] {
  if (!mitBarrieren(partie.regeln.variante)) return [];
  if ((partie.barrierenUebrig[sitz] ?? 0) <= 0) return [];
  // Hoechstens `mauernJeZug` je Zug. Wer sie gesetzt hat, faerbt jetzt —
  // mehr ist dieser Zug nicht mehr.
  if (partie.dran === sitz && partie.mauernDiesenZug >= mauernJeZug(partie.regeln)) return [];
  // Wer im letzten eigenen Zug die volle Zahl gebaut hat, setzt diesmal aus.
  if (partie.mauerPause.includes(sitz)) return [];
  // Die Eroeffnung ist mauerfrei, siehe MAUERFREIE_ZUEGE.
  if (mauerSperre(partie) > 0) return [];

  const { spalten, zeilen } = partie.regeln;
  const gesetzt = new Set(partie.barrieren);
  const sitze = sitzeVon(partie);
  const vorher = new Map(sitze.map((s) => [s, erreichbareFreie(partie, s, gesetzt)]));
  // 0 oder fehlend: keine Grenze je Feld (Build, aeltere Extreme-Tische).
  const jeFeld = partie.regeln.mauernJeFeld ?? 0;
  const platzFrei = (p: number): boolean =>
    jeFeld <= 0 || mauernAmFeld(p, spalten, zeilen, gesetzt) < jeFeld;

  const aus: [number, number][] = [];
  // EIN Probesatz, in den jede Kante kurz hinein- und wieder hinausgeht: Der
  // Bot bewertet jede angebotene Kante, und eine Kopie je Kante kostete auf
  // 12 x 11 gut 250 Mengen je Abfrage.
  const probe = new Set(gesetzt);
  for (let platz = 0; platz < partie.feld.length; platz++) {
    // Nur nach rechts und nach unten, sonst stuende jede Kante zweimal da.
    for (const n of [platz + 1, platz + spalten]) {
      if (n >= partie.feld.length) continue;
      if (n === platz + 1 && platz % spalten === spalten - 1) continue;
      const schluessel = kante(platz, n);
      if (gesetzt.has(schluessel)) continue;
      // Regel 1: Mindestens eine Seite muss noch frei sein.
      if (partie.besitzer[platz] !== null && partie.besitzer[n] !== null) continue;
      // Regel 3: Beide Felder brauchen noch einen Platz.
      if (!platzFrei(platz) || !platzFrei(n)) continue;
      // Regel 2: Niemand verliert ein Feld, das er vorher erreichte. Weil
      // eine Mauer nur Wege wegnimmt, nie welche schafft, ist "gleich viele"
      // dasselbe wie "dieselben".
      probe.add(schluessel);
      const trenntAb = sitze.some((s) => erreichbareFreie(partie, s, probe) < (vorher.get(s) ?? 0));
      probe.delete(schluessel);
      if (!trenntAb) aus.push([platz, n]);
    }
  }
  return aus;
}

/**
 * Das Gebiet eines Sitzes auf eine Farbe umstellen und dabei alles
 * angrenzende Freie dieser Farbe schlucken.
 *
 * Der Kranz waechst mit: Ein frisch geschlucktes Feld bringt seine eigenen
 * Nachbarn ein, und auch die fallen, wenn sie die Farbe tragen. Ohne diese
 * Schleife bliebe eine zusammenhaengende Flaeche nach dem ersten Ring liegen —
 * genau das macht im Vorbild den grossen Zug aus.
 */
function schlucke(
  partie: FillerPartie,
  sitz: number,
  neueFarbe: number,
): { besitzer: (number | null)[]; feld: number[]; gewonnen: number; geschluckt: number[] } {
  const { spalten, zeilen } = partie.regeln;
  const sperren = new Set(partie.barrieren);
  const besitzer = [...partie.besitzer];
  const feld = [...partie.feld];

  const rand: number[] = [];
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] === sitz) rand.push(platz);
  }
  const eigen = [...rand];

  const geschluckt: number[] = [];
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of offeneNachbarn(platz, spalten, zeilen, sperren)) {
      if (besitzer[n] !== null) continue;
      if (feld[n] !== neueFarbe) continue;
      besitzer[n] = sitz;
      eigen.push(n);
      rand.push(n);
      geschluckt.push(n);
    }
  }

  // Erst danach umfaerben: Waehrend des Schluckens muss `feld` noch die ALTEN
  // Farben tragen, sonst faende der Vergleich oben auch das eigene Gebiet.
  for (const platz of eigen) feld[platz] = neueFarbe;

  return { besitzer, feld, gewonnen: geschluckt.length, geschluckt };
}

export function fuehreAus(
  partie: FillerPartie,
  sitz: number,
  aktion: FillerAktion,
): FillerPartie {
  if (partie.fertig) throw new Error('Partie ist zu Ende');
  /*
   * Aufgeben VOR der Zugpruefung: Es geht auch, wenn der Gegner dran ist.
   * Der Server prueft `currentActor` beim Handeln nicht (CLAUDE.md, Eiland),
   * die Aktion kommt also an — hier entscheidet nur, ob der Sitz mitspielt.
   */
  if (aktion.typ === 'aufgeben') {
    if (!(sitz in partie.punkte)) throw new Error('Sitz spielt nicht mit');
    return { ...partie, fertig: true, aufgegeben: sitz, mauernDiesenZug: 0 };
  }
  if (partie.dran !== sitz) throw new Error('Nicht am Zug');

  const sitze = sitzeVon(partie);
  const naechster = sitze[(sitze.indexOf(sitz) + 1) % sitze.length] ?? sitz;

  if (aktion.typ === 'barriere') {
    const erlaubt = moeglicheBarrieren(partie, sitz).some(
      ([a, b]) => kante(a, b) === kante(aktion.von, aktion.nach),
    );
    if (!erlaubt) throw new Error('Barriere hier nicht erlaubt');
    /*
     * Der Zug geht WEITER: `dran` bleibt stehen, `zug` zaehlt nicht hoch.
     *
     * Eine Mauer ist keine Alternative zum Faerben, sondern etwas, das man
     * davor tun darf — `mauernJeZug`-mal je Zug. Wer baut, faerbt danach
     * trotzdem; erst das Faerben gibt ab. Genau deshalb braucht es
     * `mauernDiesenZug`: Sonst liesse sich der ganze Vorrat in einem
     * einzigen Zug verbauen. Einmauer- und Einsperr-Regel prueft
     * `moeglicheBarrieren` fuer jede Mauer einzeln, gegen den Stand mit
     * allen schon gesetzten.
     *
     * `leerzuege` bleibt ebenfalls, wie es ist. Ob der Zug etwas eingebracht
     * hat, entscheidet sich beim Faerben gleich danach.
     */
    return {
      ...partie,
      barrieren: [...partie.barrieren, kante(aktion.von, aktion.nach)],
      barrierenUebrig: {
        ...partie.barrierenUebrig,
        [sitz]: (partie.barrierenUebrig[sitz] ?? 0) - 1,
      },
      mauernDiesenZug: partie.mauernDiesenZug + 1,
    };
  }

  if (aktion.typ !== 'faerben') throw new Error('Unbekannte Aktion');
  const { farbe } = aktion;
  if (!Number.isInteger(farbe) || farbe < 0 || farbe >= partie.regeln.farben) {
    throw new Error('Farbe gibt es nicht');
  }
  if (gesperrteFarben(partie).includes(farbe)) throw new Error('Farbe ist gesperrt');

  const { besitzer, feld, gewonnen, geschluckt } = schlucke(partie, sitz, farbe);

  /*
   * Sterne, die in diesem Zug gefallen sind. Ein Stern ist ein Feld wie jedes
   * andere (es zaehlt in `gewonnen` schon mit) und bringt OBENDREIN seinen
   * Bonus und eine Mauer. Punkte und Vorrat aendern sich hier und nirgends
   * sonst — der Stern selbst bleibt liegen, siehe `sterne` im Zustand.
   */
  const sterne = new Set(partie.sterne);
  const sterneGetroffen = geschluckt.filter((p) => sterne.has(p)).length;

  const punkte = {
    ...partie.punkte,
    [sitz]: (partie.punkte[sitz] ?? 0) + gewonnen + sterneGetroffen * STERN_BONUS,
  };
  const barrierenUebrig =
    sterneGetroffen > 0
      ? {
          ...partie.barrierenUebrig,
          [sitz]: (partie.barrierenUebrig[sitz] ?? 0) + sterneGetroffen * STERN_MAUERN,
        }
      : partie.barrierenUebrig;
  const frei = besitzer.some((b) => b === null);
  /*
   * Die Pause fuer den naechsten eigenen Zug. Sie faellt fuer diesen Sitz
   * erst einmal weg (wer pausiert hat, hat damit abgesessen) und kommt nur
   * zurueck, wenn er in diesem Zug die volle Zahl gebaut hat — und nur, wo
   * mehr als eine erlaubt ist: Bei einer Mauer je Zug gab es nie eine Pause,
   * und Build soll bleiben, wie es ist.
   */
  const jeZug = mauernJeZug(partie.regeln);
  const ohneMich = partie.mauerPause.filter((s) => s !== sitz);
  const mauerPause =
    jeZug > 1 && partie.mauernDiesenZug >= jeZug ? [...ohneMich, sitz] : ohneMich;
  const leerzuege = gewonnen > 0 ? 0 : partie.leerzuege + 1;

  return {
    ...partie,
    feld,
    besitzer,
    farbe: { ...partie.farbe, [sitz]: farbe },
    punkte,
    barrierenUebrig,
    dran: naechster,
    zug: partie.zug + 1,
    leerzuege,
    fertig: !frei || leerzuege >= LEERZUEGE_MAX,
    // Der Zug ist vorbei, der naechste faengt wieder bei null an.
    mauernDiesenZug: 0,
    mauerPause,
  };
}

export function markiereVerlassen(partie: FillerPartie, sitz: number): FillerPartie {
  if (partie.leftSeats.includes(sitz)) return partie;
  return { ...partie, leftSeats: [...partie.leftSeats, sitz] };
}

/**
 * Platzierungen.
 *
 * Gleichstand ergibt zweimal Platz 1. Bei 56 Feldern und zwei Spielern kann
 * das vorkommen — 56 ist gerade, 28 zu 28 ist also moeglich —, und dann ist
 * es ein echtes Unentschieden und keine Verlegenheitsloesung. Seit dem
 * 07.11.2026 zaehlt dabei der Punktzuschlag fuer Sitz 1 mit
 * (`punkteZuschlagSitz1`, Klar): `points` ist die Wertung, nicht das Brett,
 * und ein Gleichstand NACH dem Zuschlag bleibt ein Unentschieden.
 * In `extreme` zaehlen die Sternboni mit: Dort gewinnt, wer mehr PUNKTE hat,
 * nicht Felder.
 */
export function platzierungen(
  partie: FillerPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const sitze = sitzeVon(partie);
  /*
   * Der Zuschlag geht an den zweiten Sitz der Partie (`sitze[1]`):
   * `createParty` vergibt 0 und 1, und Sitz 0 zieht zuerst. Fehlt er im
   * Regelsatz (jeder Tisch vor dem 07.11.2026), ist er 0.
   */
  const zuschlag = punkteZuschlagSitz1(partie.regeln);
  const reihe = sitze
    .map((seat) => ({
      seat,
      points: (partie.punkte[seat] ?? 0) + (seat === sitze[1] ? zuschlag : 0),
      left: partie.leftSeats.includes(seat),
    }))
    /*
     * Wer aufgegeben hat, steht hinten — vor den Punkten sortiert, nicht
     * danach: Die Aufgabe entscheidet die Partie, der Stand zum Zeitpunkt
     * der Aufgabe nicht. Sonst gewaenne, wer bei Vorsprung aufgibt.
     */
    .sort(
      (a, b) =>
        Number(a.seat === partie.aufgegeben) - Number(b.seat === partie.aufgegeben) ||
        b.points - a.points,
    );

  let platz = 0;
  let letzter: { points: number; aufgegeben: boolean } | null = null;
  return reihe.map((eintrag, index) => {
    const aufgegeben = eintrag.seat === partie.aufgegeben;
    const neuerPlatz =
      letzter === null || eintrag.points !== letzter.points || aufgegeben !== letzter.aufgegeben;
    if (neuerPlatz) {
      platz = index + 1;
      letzter = { points: eintrag.points, aufgegeben };
    }
    return { ...eintrag, place: platz };
  });
}

/** Sieger, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: FillerPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  // Nach dem Platz, nicht nach den Punkten — sonst zaehlte die Aufgabe nicht.
  return erster.place === zweiter.place ? null : erster.seat;
}
