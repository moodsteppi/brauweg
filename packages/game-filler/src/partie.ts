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

import { type FillerRegeln, istVariante } from './regeln.js';

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
}

export type FillerAktion = { readonly typ: 'faerben'; readonly farbe: number };

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
  const { spalten, zeilen, farben } = regeln;
  const feld = baueBrett(regeln, zufall);

  /*
   * Die Grautoene NACH dem Brett und aus demselben Generator, aber als eigene
   * Zuege: Es sind unabhaengige Ziehungen, aus einem Grauton laesst sich also
   * keine Farbe herleiten. Wer sie stattdessen aus der Farbe ableitete
   * (`farbe % GRAUTOENE`), haette den ganzen Nebel in einer Zeile verschenkt.
   */
  const grau = feld.map(() => Math.floor(zufall() * GRAUTOENE));

  const besitzer: (number | null)[] = new Array(feld.length).fill(null);
  const farbe: Record<number, number> = {};
  const punkte: Record<number, number> = {};
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
    regeln: istVariante(regeln.variante) ? regeln : { ...regeln, variante: 'nebel' },
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
  };
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
  return zuege;
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
): { besitzer: (number | null)[]; feld: number[]; gewonnen: number } {
  const { spalten, zeilen } = partie.regeln;
  const besitzer = [...partie.besitzer];
  const feld = [...partie.feld];

  const rand: number[] = [];
  for (let platz = 0; platz < besitzer.length; platz++) {
    if (besitzer[platz] === sitz) rand.push(platz);
  }
  const eigen = [...rand];

  let gewonnen = 0;
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (besitzer[n] !== null) continue;
      if (feld[n] !== neueFarbe) continue;
      besitzer[n] = sitz;
      eigen.push(n);
      rand.push(n);
      gewonnen++;
    }
  }

  // Erst danach umfaerben: Waehrend des Schluckens muss `feld` noch die ALTEN
  // Farben tragen, sonst faende der Vergleich oben auch das eigene Gebiet.
  for (const platz of eigen) feld[platz] = neueFarbe;

  return { besitzer, feld, gewonnen };
}

export function fuehreAus(
  partie: FillerPartie,
  sitz: number,
  aktion: FillerAktion,
): FillerPartie {
  if (partie.fertig) throw new Error('Partie ist zu Ende');
  if (partie.dran !== sitz) throw new Error('Nicht am Zug');
  if (aktion.typ !== 'faerben') throw new Error('Unbekannte Aktion');
  const { farbe } = aktion;
  if (!Number.isInteger(farbe) || farbe < 0 || farbe >= partie.regeln.farben) {
    throw new Error('Farbe gibt es nicht');
  }
  if (gesperrteFarben(partie).includes(farbe)) throw new Error('Farbe ist gesperrt');

  const { besitzer, feld, gewonnen } = schlucke(partie, sitz, farbe);

  const punkte = { ...partie.punkte, [sitz]: (partie.punkte[sitz] ?? 0) + gewonnen };
  const frei = besitzer.some((b) => b === null);
  const leerzuege = gewonnen > 0 ? 0 : partie.leerzuege + 1;

  const sitze = sitzeVon(partie);
  const naechster = sitze[(sitze.indexOf(sitz) + 1) % sitze.length] ?? sitz;

  return {
    ...partie,
    feld,
    besitzer,
    farbe: { ...partie.farbe, [sitz]: farbe },
    punkte,
    dran: naechster,
    zug: partie.zug + 1,
    leerzuege,
    fertig: !frei || leerzuege >= LEERZUEGE_MAX,
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
 * das nicht vorkommen — 56 ist gerade, 28 zu 28 ist also moeglich —, und dann
 * ist es ein echtes Unentschieden und keine Verlegenheitsloesung.
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
