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

import { type FillerRegeln, istVariante, mitBarrieren, mitSternen } from './regeln.js';

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
 * Sternfelder der Spielart `extreme`: wie viele, was sie bringen.
 *
 * Drei auf 56 Feldern: genug, dass sich ein Umweg lohnt, zu wenige, um das
 * Spiel zu einer Sternjagd zu machen. Ein Stern ist ZWEI Punkte wert (das
 * Feld selbst plus STERN_BONUS) und bringt STERN_MAUERN Mauern in den Vorrat.
 */
export const STERNE_ANZAHL = 3;
export const STERN_BONUS = 1;
export const STERN_MAUERN = 1;

export interface FillerPartie {
  readonly regeln: FillerRegeln;
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
   * Hat der Sitz, der gerade am Zug ist, in DIESEM Zug schon gemauert?
   *
   * Eine Mauer beendet den Zug nicht — man baut und faerbt danach trotzdem.
   * Ohne diesen Merker liesse sich in einem einzigen Zug der ganze Vorrat
   * verbauen, und die Spielart waere nach dem ersten Zug entschieden.
   *
   * Er gehoert an den ZUG und nicht an den Sitz: Mit dem Faerben geht der Zug
   * weiter, und der Merker faellt dabei zurueck. Ein Verzeichnis je Sitz
   * muesste an derselben Stelle geleert werden und koennte dabei
   * auseinanderlaufen.
   */
  readonly mauerDiesenZug: boolean;
  /**
   * Plaetze der Sternfelder. Leer in jeder Spielart ausser `extreme`.
   *
   * Der Stern bleibt am Platz, auch nachdem er geschluckt wurde: Er ist eine
   * Eigenschaft des Feldes, kein Gegenstand, den man aufhebt. Wer ihn hat,
   * sieht das an seinem Gebiet — und die Punkte dafuer sind laengst verbucht.
   */
  readonly sterne: readonly number[];
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
  | { readonly typ: 'barriere'; readonly von: number; readonly nach: number };

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
function baueBrett(regeln: FillerRegeln, zufall: () => number): number[] {
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
  const gueltigeRegeln: FillerRegeln = {
    ...regeln,
    variante: istVariante(regeln.variante) ? regeln.variante : 'nebel',
    barrieren: typeof regeln.barrieren === 'number' ? regeln.barrieren : 0,
  };
  const { spalten, zeilen, farben } = regeln;
  const feld = baueBrett(regeln, zufall);

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
  const sterne = mitSternen(gueltigeRegeln.variante)
    ? zieheSterne(spalten, zeilen, sitze, zufall)
    : [];

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
    barrierenUebrig[sitz] = mitBarrieren(gueltigeRegeln.variante)
      ? (gueltigeRegeln.barrieren ?? 0)
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
    mauerDiesenZug: false,
    sterne,
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
  const verboten = new Set<number>();
  for (const sitz of sitze) {
    const ecke = startEcke(sitz, spalten, zeilen);
    verboten.add(ecke);
    for (const n of nachbarn(ecke, spalten, zeilen)) verboten.add(n);
  }
  const abstand = (a: number, b: number): number =>
    Math.abs((a % spalten) - (b % spalten)) +
    Math.abs(Math.floor(a / spalten) - Math.floor(b / spalten));

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
 * Die Barrieren, die dieser Sitz gerade setzen darf.
 *
 * **Die Einsperr-Regel.** Eine Wand ist verboten, wenn danach ein Sitz kein
 * einziges freies Feld mehr erreichen kann, der vorher noch eines erreichte.
 * Ohne sie waere die Spielart in zwei Zuegen entschieden: Wer den Gegner auf
 * seiner Ecke zumauert, gewinnt mit 55 zu 1.
 *
 * Geprueft wird fuer JEDEN Sitz, auch den eigenen — nicht aus Fuersorge,
 * sondern weil ein Brett, auf dem niemand mehr etwas holen kann, nur noch
 * ueber LEERZUEGE_MAX endet und bis dahin wie eingefroren aussieht.
 *
 * Und geprueft wird gegen den Stand VORHER: Wer schon eingeschlossen ist —
 * das kann im Grundspiel ganz ohne Waende passieren —, blockiert sonst jede
 * weitere Barriere auf dem ganzen Brett.
 */
export function moeglicheBarrieren(
  partie: FillerPartie,
  sitz: number,
): [number, number][] {
  if (!mitBarrieren(partie.regeln.variante)) return [];
  if ((partie.barrierenUebrig[sitz] ?? 0) <= 0) return [];
  // Eine je Zug. Wer schon gemauert hat, faerbt jetzt — mehr ist dieser Zug
  // nicht mehr.
  if (partie.mauerDiesenZug && partie.dran === sitz) return [];
  /*
   * Der allererste Zug der Partie ist mauerfrei. Wer anfaengt, faerbt nur;
   * der zweite darf in seinem ersten Zug schon bauen. Sonst stuende die
   * erste Wand, bevor der Gegner ueberhaupt eine Farbe gewaehlt hat — der
   * Anfaenger haette den Vorteil des ersten Zugs UND den der ersten Wand.
   */
  if (partie.zug === 0) return [];

  const { spalten, zeilen } = partie.regeln;
  const gesetzt = new Set(partie.barrieren);
  const sitze = sitzeVon(partie);
  const vorher = new Map(sitze.map((s) => [s, erreichbareFreie(partie, s, gesetzt)]));

  const aus: [number, number][] = [];
  for (let platz = 0; platz < partie.feld.length; platz++) {
    // Nur nach rechts und nach unten, sonst stuende jede Kante zweimal da.
    for (const n of [platz + 1, platz + spalten]) {
      if (n >= partie.feld.length) continue;
      if (n === platz + 1 && platz % spalten === spalten - 1) continue;
      const schluessel = kante(platz, n);
      if (gesetzt.has(schluessel)) continue;
      const probe = new Set(gesetzt);
      probe.add(schluessel);
      const sperrtJemanden = sitze.some(
        (s) => (vorher.get(s) ?? 0) > 0 && erreichbareFreie(partie, s, probe) === 0,
      );
      if (!sperrtJemanden) aus.push([platz, n]);
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
     * davor tun darf — einmal je Zug. Wer baut, faerbt danach trotzdem; erst
     * das Faerben gibt ab. Genau deshalb braucht es `mauerDiesenZug`: Sonst
     * liesse sich der ganze Vorrat in einem einzigen Zug verbauen.
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
      mauerDiesenZug: true,
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
    // Der Zug ist vorbei, der naechste darf wieder einmal mauern.
    mauerDiesenZug: false,
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
 * es ein echtes Unentschieden und keine Verlegenheitsloesung. In `extreme`
 * zaehlen die Sternboni mit: Dort gewinnt, wer mehr PUNKTE hat, nicht Felder.
 */
export function platzierungen(
  partie: FillerPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const reihe = sitzeVon(partie)
    .map((seat) => ({
      seat,
      points: partie.punkte[seat] ?? 0,
      left: partie.leftSeats.includes(seat),
    }))
    .sort((a, b) => b.points - a.points);

  let platz = 0;
  let letztePunkte: number | null = null;
  return reihe.map((eintrag, index) => {
    if (letztePunkte === null || eintrag.points !== letztePunkte) {
      platz = index + 1;
      letztePunkte = eintrag.points;
    }
    return { ...eintrag, place: platz };
  });
}

/** Sieger, oder null bei Gleichstand bzw. laufender Partie. */
export function sieger(partie: FillerPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  return erster.points === zweiter.points ? null : erster.seat;
}
