/**
 * Die Karte: Gelaende, Startecken, Nachbarschaft — und der Zufall, aus dem
 * beides entsteht.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1).
 *
 * Die eine Entscheidung, die alles andere traegt: Die Karte ist
 * PUNKTSYMMETRISCH. Platz p und Platz N-1-p tragen dasselbe Gelaende. Damit
 * hat kein Spieler die besseren Seen, die kuerzeren Wege oder die offenere
 * Ecke — und weil die beiden Startecken selbst aufeinander abgebildet werden
 * (unten links auf oben rechts), sieht die Karte fuer beide gleich aus, sobald
 * der Client sie fuer Sitz 1 um 180 Grad dreht. Bei einem Spiel, dessen
 * Ausgang an ein paar Feldern haengt, ist das der Unterschied zwischen
 * "verloren" und "unfair".
 */

import type { EilandRegeln } from './regeln.js';

// ---------------------------------------------------------------------------
// Zufall
// ---------------------------------------------------------------------------

/**
 * Der Zufallsgenerator steht hier noch einmal, obwohl die anderen Spielmodule
 * denselben haben. Aus demselben Grund wie dort: Ein Spielmodul ist eine
 * eigenstaendige Bibliothek. Wanderte der Generator in ein gemeinsames Paket,
 * aenderte eine Verbesserung dort die Karte JEDER gespeicherten Partie.
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
 * Wie bei Filler ist das kein Nebensatz, sondern Bedingung der Abwandlung: Wer
 * die Saat hat, rechnet sich die GANZE Karte aus — jeden See, jeden Berg, jedes
 * Ornament — und spielt im Nebel mit offenen Karten. 2^32 Moeglichkeiten
 * durchzuprobieren dauert Sekunden, und ob eine stimmt, sieht man an den paar
 * Feldern, die man ohnehin schon kennt. Im Betrieb kommt deshalb die Hexkette
 * vom Server.
 */
export function baueZufall(saat: Saat): () => number {
  if (typeof saat === 'number') return mulberry32(saat);
  const [a, b, c, d] = worte(saat);
  const zufall = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

// ---------------------------------------------------------------------------
// Gelaende
// ---------------------------------------------------------------------------

/** Einnehmbar. Alles andere ist Hindernis. */
export const GRAS = 0;
/** See. Kein Besitz, kein Durchkommen. */
export const WASSER = 1;
/** Berg. Wie Wasser — nur zum Ansehen anders. */
export const BERG = 2;

/** So viele Ornamentarten gibt es: Stadt und Brunnen. Reine Zeichnung. */
export const ORNAMENTARTEN = 2;

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
 * Die bis zu acht Felder rund um einen Platz — die Diagonalen eingeschlossen.
 *
 * Anders als `nachbarn`: Gezogen wird ueber Kanten, aber die STUFE eines
 * Feldes (siehe stufe in partie.ts) zaehlt sein ganzes Umfeld. Mit vier
 * Nachbarn laege jede Stufe zwischen 0 und 4, und die Spitze eines breiten
 * Vorstosses saehe genauso aus wie die Mitte einer schmalen Front — das
 * Umfeld unterscheidet die beiden, und genau darum geht es.
 */
export function umfeld(platz: number, spalten: number, zeilen: number): number[] {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const raus: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= spalten || ny >= zeilen) continue;
      raus.push(ny * spalten + nx);
    }
  }
  return raus;
}

/** Die hoechste Stufe: alle acht Felder im Umfeld in derselben Farbe. */
export const STUFEN_MAX = 8;

/** Schrittabstand ueber das Raster (Manhattan). Hindernisse zaehlen nicht mit. */
export function abstand(a: number, b: number, spalten: number): number {
  const ax = a % spalten;
  const ay = Math.floor(a / spalten);
  const bx = b % spalten;
  const by = Math.floor(b / spalten);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Die Startecke eines Sitzes: Sitz 0 unten links, Sitz 1 oben rechts.
 *
 * Dieselbe Wahl wie bei Filler, und aus demselben Grund diagonal gegenueber:
 * Sonst waere die erste Begegnung im zweiten Zug und die Partie eine Frage des
 * Anfangs. Hier kommt ein zweiter Grund dazu — die beiden Ecken sind
 * zueinander punktsymmetrisch (unten links ist N-1 minus oben rechts), womit
 * die gespiegelte Karte fuer beide dieselbe ist.
 */
export function startEcke(sitz: number, spalten: number, zeilen: number): number {
  const ecken = [
    (zeilen - 1) * spalten, // unten links
    spalten - 1, //            oben rechts
  ];
  return ecken[sitz % ecken.length] ?? 0;
}

/** Das punktsymmetrische Gegenstueck eines Platzes. */
export function spiegel(platz: number, felder: number): number {
  return felder - 1 - platz;
}

/**
 * Die Karte bauen.
 *
 * Gebaut wird nur die OBERE Haelfte (Plaetze mit Index < N/2), gespiegelt wird
 * jedes gesetzte Feld sofort. Ein See darf dabei ueber die Mitte wachsen; er
 * ueberlappt dann mit seinem eigenen Spiegelbild, was nichts kaputt macht —
 * die Symmetrie bleibt, der See wird nur groesser.
 */
export function baueKarte(regeln: EilandRegeln, zufall: () => number): number[] {
  const { spalten, zeilen } = regeln;
  const felder = spalten * zeilen;

  /*
   * Rund um beide Startecken bleibt alles Gras: Startfeld und seine direkten
   * Nachbarn. Ohne diesen Schutz kann eine Ecke mit drei Wasserfeldern
   * zugemauert sein — der Spieler haette in der ersten Runde keinen einzigen
   * Zug, und weil die Karte symmetrisch ist, ginge das Spiel fuer BEIDE nicht
   * los. Der Schutz gilt fuer die gespiegelten Plaetze gleich mit, weil jedes
   * Setzen unten seinen Spiegel oben prueft.
   */
  const geschuetzt = new Set<number>();
  for (const sitz of [0, 1]) {
    const ecke = startEcke(sitz, spalten, zeilen);
    geschuetzt.add(ecke);
    for (const n of nachbarn(ecke, spalten, zeilen)) geschuetzt.add(n);
  }

  const frei = (gelaende: number[], platz: number): boolean =>
    gelaende[platz] === GRAS &&
    !geschuetzt.has(platz) &&
    !geschuetzt.has(spiegel(platz, felder));

  const setze = (gelaende: number[], platz: number, art: number): void => {
    gelaende[platz] = art;
    gelaende[spiegel(platz, felder)] = art;
  };

  /**
   * Ein Versuch. Er kann misslingen — deshalb steht er in einer Schleife.
   *
   * Misslingen heisst hier: Die Hindernisse zerschneiden die Karte, und einer
   * der beiden koennte nur einen Zipfel erreichen. Das ist selten, aber nicht
   * ausgeschlossen, und ein zerschnittenes Eiland ist kein Spiel mehr,
   * sondern zweimal Malen nach Zahlen.
   */
  const versuch = (): number[] => {
    const gelaende: number[] = new Array(felder).fill(GRAS);
    const halb = Math.floor(felder / 2);

    for (let i = 0; i < regeln.seen; i++) {
      // Drei bis fuenf Felder je See. Groesser waere ein Meer, kleiner ein
      // Tuempel, den man nicht als Hindernis wahrnimmt.
      const groesse = 3 + Math.floor(zufall() * 3);
      const keim = Math.floor(zufall() * halb);
      if (!frei(gelaende, keim)) continue;
      const see = [keim];
      setze(gelaende, keim, WASSER);
      while (see.length < groesse) {
        const von = see[Math.floor(zufall() * see.length)]!;
        const kandidaten = nachbarn(von, spalten, zeilen).filter((n) => frei(gelaende, n));
        if (kandidaten.length === 0) break;
        const naechster = kandidaten[Math.floor(zufall() * kandidaten.length)]!;
        setze(gelaende, naechster, WASSER);
        see.push(naechster);
      }
    }

    for (let i = 0; i < regeln.berge; i++) {
      /*
       * Berge stehen einzeln und nicht am Wasser. Ein Berg direkt neben einem
       * See macht aus zwei Hindernissen eine Sperre, und Sperren sind es, die
       * die Karte zerschneiden. Zwanzig Anlaeufe je Berg: Findet sich kein
       * Platz, faellt der Berg einfach aus — eine Karte mit drei statt vier
       * Bergen ist immer noch eine Karte.
       */
      for (let anlauf = 0; anlauf < 20; anlauf++) {
        const platz = Math.floor(zufall() * halb);
        if (!frei(gelaende, platz)) continue;
        const amWasser = nachbarn(platz, spalten, zeilen).some((n) => gelaende[n] !== GRAS);
        if (amWasser) continue;
        setze(gelaende, platz, BERG);
        break;
      }
    }

    return gelaende;
  };

  for (let anlauf = 0; anlauf < 24; anlauf++) {
    const gelaende = versuch();
    if (istBespielbar(gelaende, regeln)) return gelaende;
  }
  /*
   * Nach 24 Anlaeufen: die blanke Wiese. Sie ist langweilig, aber spielbar —
   * und ein Tisch, der beim Erstellen wirft, waere schlimmer als eine Karte
   * ohne Seen. Erreicht wird dieser Zweig nur mit einem Regelsatz, den
   * pruefeRegeln durchgelassen hat und der trotzdem zu eng ist.
   */
  return new Array(felder).fill(GRAS);
}

/**
 * Ist die Karte bespielbar?
 *
 * Geprueft wird von der Startecke von Sitz 0 aus: Mindestens drei Viertel
 * aller Grasfelder muessen ueber Gras erreichbar sein. Fuer Sitz 1 muss man
 * nicht nachrechnen — die Karte ist punktsymmetrisch, sein Ergebnis ist
 * dasselbe.
 */
export function istBespielbar(gelaende: readonly number[], regeln: EilandRegeln): boolean {
  const { spalten, zeilen } = regeln;
  const start = startEcke(0, spalten, zeilen);
  if (gelaende[start] !== GRAS) return false;

  const gesehen = new Set<number>([start]);
  const rand = [start];
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of nachbarn(platz, spalten, zeilen)) {
      if (gesehen.has(n) || gelaende[n] !== GRAS) continue;
      gesehen.add(n);
      rand.push(n);
    }
  }

  const gras = gelaende.filter((g) => g === GRAS).length;
  return gesehen.size * 4 >= gras * 3;
}

/**
 * Eine gemischte Reihenfolge aller Plaetze.
 *
 * Daraus werden die Ornamente gezogen — die vier zu Beginn und jedes, das
 * spaeter nachrueckt. Vorab gemischt und im Zustand abgelegt, damit das
 * Nachruecken keinen laufenden Zufallsgenerator braucht: Ein Generator im
 * Snapshot muesste seinen inneren Stand mitfuehren, und der laesst sich, anders
 * als eine Liste von Plaetzen, nicht ansehen und nicht pruefen.
 */
export function mischeplaetze(felder: number, zufall: () => number): number[] {
  const liste = Array.from({ length: felder }, (_, i) => i);
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    const merke = liste[i]!;
    liste[i] = liste[j]!;
    liste[j] = merke;
  }
  return liste;
}
