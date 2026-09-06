/**
 * Die Gesten auf der Eiland-Karte — reine Rechnung, ohne DOM und ohne React.
 *
 * Hier steht, was der Bildschirm an Regeln nachbaut (welches Feld anwaehlbar
 * ist, was beim Abwaehlen mitfaellt) und was er an Bedienung dazuerfindet
 * (welches Feld ein Tipp meint, wie ein Wischen ueber die Karte laeuft).
 * Ausgelagert, weil genau das die Stellen sind, die niemand abfaengt, wenn
 * sie falsch sind: Der Server weist einen falschen Zettel zwar ab, aber ein
 * Tipp, der das Nachbarfeld trifft, kommt nie beim Server an — er kommt beim
 * Spieler an, als „das Spiel spinnt".
 *
 * Alle Lagen sind RASTERKOORDINATEN: 1 = eine Feldbreite, Ursprung oben
 * links der Karte. Zellen sind ANZEIGEINDIZES (Zeile mal Spalten plus Spalte,
 * so wie gezeichnet); ein `platzVon` uebersetzt sie in Plaetze des Moduls,
 * weil die Karte fuer Sitz 1 gedreht ist (siehe Karte in Eiland.tsx).
 */

const GRAS = 0;

/** Der Ausschnitt der Sicht, den die Gesten brauchen. */
export interface Gestenkarte {
  readonly spalten: number;
  readonly zeilen: number;
  readonly gelaende: readonly (number | null)[];
  readonly besitzer: readonly (number | null)[];
  /** Der Rand des eigenen Gebiets, fertig vom Server. */
  readonly waehlbar: readonly number[];
  /**
   * Fremde Felder, die sich angreifen lassen — ebenfalls fertig vom Server.
   * Sie haengen am Stand der Karte, nicht am Zettel, und aendern sich
   * deshalb waehrend des Waehlens nicht.
   */
  readonly angreifbar: readonly number[];
}

/** Eine Lage auf dem Raster. */
export interface Punkt {
  readonly u: number;
  readonly v: number;
}

/**
 * Was ein Wischen tut. Steht beim ersten Feld fest und gilt bis zum
 * Loslassen: Wer auf einem gewaehlten Feld beginnt, waehlt ab, sonst an — so
 * lassen sich gezielt mehrere Felder nehmen ODER mehrere zurueckgeben, ohne
 * dass die Geste unterwegs die Richtung wechselt.
 */
export type Modus = 'nehmen' | 'lassen';

/**
 * Was ein Feld bei der Trefferentscheidung wiegt — die „virtuelle Tastatur".
 *
 * Ein Tipp trifft nicht das Feld, unter dem der Finger liegt, sondern das
 * Feld, das er am wahrscheinlichsten MEINT. Jeder Kandidat (das getippte Feld
 * und seine vier Nachbarn) bekommt seinen Abstand zum Finger durch sein
 * Gewicht geteilt, das kleinste Mass gewinnt. So wie die Handytastatur die
 * Taste vergroessert, die als naechstes wahrscheinlich ist — nur dass hier
 * die Wahrscheinlichkeit am Brett steht: Ein waehlbares Feld ist das, was man
 * beim Ausbreiten will; ein schon gewaehltes will man selten gleich wieder
 * los; ein totes Feld (Wasser, Berg, Nebel, fremdes oder eigenes Land) will
 * man nie.
 *
 * Die Zahlen sind Grenzen, keine Gefuehle: Bei 1 gegen 0,5 reicht ein
 * waehlbares Feld ein Sechstel weit in ein gewaehltes hinein, bei 1 gegen 0,4
 * ein Fuenftel weit in ein totes. Das gewaehlte Feld behaelt also seine
 * inneren zwei Drittel — genug, um es mit einem Tipp in die Mitte wieder
 * loszuwerden, und wenig genug, dass der Daumen beim Weitertippen nicht
 * staendig das letzte Feld wieder abwaehlt. Genau das war die Beschwerde:
 * „die ganze Zeit aus Versehen an- und abwaehlen".
 */
export const GEWICHT_WAEHLBAR = 1;
export const GEWICHT_GEWAEHLT = 0.5;
export const GEWICHT_TOT = 0.4;

/**
 * Naeher als so viel Feldbreite am vorigen Tipp heisst: „dasselbe noch mal".
 *
 * Die zweite Regel neben den Gewichten, und sie geht vor. Wer ein Feld
 * gerade gewaehlt hat und an derselben Stelle noch einmal tippt, will es
 * zuruecknehmen — auch wenn der Finger am Rand des Feldes liegt, wo die
 * Gewichte laengst dem Nachbarn den Vorzug gaeben. Kaum bewegt heisst
 * abwaehlen; merklich in eine Richtung bewegt heisst anwaehlen.
 */
export const SELBER_FLECK = 0.3;

/**
 * Die vier orthogonalen Nachbarn — dieselbe Rechnung wie im Modul.
 * Diagonalen zaehlen nicht.
 */
export function nachbarnVon(platz: number, spalten: number, zeilen: number): number[] {
  const x = platz % spalten;
  const y = Math.floor(platz / spalten);
  const raus: number[] = [];
  if (x > 0) raus.push(platz - 1);
  if (x < spalten - 1) raus.push(platz + 1);
  if (y > 0) raus.push(platz - spalten);
  if (y < zeilen - 1) raus.push(platz + spalten);
  return raus;
}

/** Frei, Wiese, kein Nebel — die Bedingung, die ein Feld ueberhaupt zulaesst. */
export function nehmbar(karte: Gestenkarte, platz: number): boolean {
  return karte.gelaende[platz] === GRAS && karte.besitzer[platz] === null;
}

/**
 * Was nach einer gegebenen Auswahl anwaehlbar ist: der Rand des eigenen
 * Gebiets und die Angriffsziele (beides kommt fertig vom Server) plus der
 * Rand dessen, was schon auf dem Zettel steht — und nichts, was selbst schon
 * darauf steht.
 *
 * Das ist die EINE Regel, die der Bildschirm kennen muss; der Server prueft
 * den fertigen Zettel ohnehin noch einmal. Ein angegriffenes Feld auf dem
 * Zettel verlaengert den Rand NICHT: Ein Angriff ist ein Ziel, kein Weg —
 * dieselbe Regel wie in pruefeWahl im Modul.
 */
export function waehlbarMit(karte: Gestenkarte, auswahl: readonly number[]): Set<number> {
  const raus = new Set<number>([...karte.waehlbar, ...karte.angreifbar]);
  for (const platz of auswahl) {
    if (karte.besitzer[platz] !== null) continue;
    for (const n of nachbarnVon(platz, karte.spalten, karte.zeilen)) {
      if (nehmbar(karte, n)) raus.add(n);
    }
  }
  for (const platz of auswahl) raus.delete(platz);
  return raus;
}

/**
 * Von den eigenen Feldern aus durch die Auswahl laufen; der Rest faellt weg.
 *
 * Beim Abwaehlen faellt alles mit, was nur ueber dieses Feld erreichbar war:
 * Ein Vorstoss haengt an seinem ersten Feld, und eine Insel mitten im Freien
 * wuerde der Server ohnehin abweisen. Wer es sieht, versteht es sofort — wer
 * es nicht saehe, wuerde am Ende einen Zettel abschicken, der zurueckkommt.
 *
 * Angegriffene Felder bleiben immer: Sie grenzen nach der Regel an eigenes
 * Land, haengen also an nichts, was wegfallen koennte — und sie tragen
 * selbst nichts, weil ein Angriff kein Weg ist.
 */
export function haengtZusammen(
  karte: Gestenkarte,
  eigenerSitz: number,
  auswahl: readonly number[],
): number[] {
  const offenListe = new Set(auswahl);
  const erreicht = new Set<number>();
  const rand: number[] = [];
  for (let platz = 0; platz < karte.besitzer.length; platz++) {
    if (karte.besitzer[platz] === eigenerSitz) rand.push(platz);
  }
  while (rand.length > 0) {
    const platz = rand.pop()!;
    for (const n of nachbarnVon(platz, karte.spalten, karte.zeilen)) {
      if (!offenListe.has(n) || erreicht.has(n)) continue;
      erreicht.add(n);
      if (karte.besitzer[n] === null) rand.push(n);
    }
  }
  // Die urspruengliche Reihenfolge bleibt: Sie ist die des Tippens.
  return auswahl.filter((p) => erreicht.has(p) || karte.besitzer[p] !== null);
}

/** Anzeigeindex der Zelle unter dem Punkt, null ausserhalb der Karte. */
export function zelleVon(karte: Gestenkarte, p: Punkt): number | null {
  const x = Math.floor(p.u);
  const y = Math.floor(p.v);
  if (x < 0 || y < 0 || x >= karte.spalten || y >= karte.zeilen) return null;
  return y * karte.spalten + x;
}

/** Liegen zwei Tipps auf demselben Fleck (siehe SELBER_FLECK)? */
export function selberFleck(a: Punkt, b: Punkt): boolean {
  return Math.hypot(a.u - b.u, a.v - b.v) < SELBER_FLECK;
}

/**
 * Welche Zelle ein Tipp meint (siehe GEWICHT_*). Liefert einen Anzeigeindex.
 *
 * `zelle` ist die Zelle unter dem Finger; `platzVon` uebersetzt Anzeigeindizes
 * in Plaetze, weil Auswahl und Rand in Plaetzen gefuehrt werden.
 */
export function treffer(
  karte: Gestenkarte,
  auswahl: readonly number[],
  kontingent: number,
  platzVon: (zelle: number) => number,
  p: Punkt,
  zelle: number,
): number {
  const x = zelle % karte.spalten;
  const y = Math.floor(zelle / karte.spalten);
  const offenListe = waehlbarMit(karte, auswahl);
  const vollzaehlig = auswahl.length >= kontingent;
  let bester = zelle;
  let bestesMass = Infinity;
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const kx = x + dx;
    const ky = y + dy;
    if (kx < 0 || ky < 0 || kx >= karte.spalten || ky >= karte.zeilen) continue;
    const kandidat = ky * karte.spalten + kx;
    const platz = platzVon(kandidat);
    const gewicht = auswahl.includes(platz)
      ? GEWICHT_GEWAEHLT
      : !vollzaehlig && offenListe.has(platz)
        ? GEWICHT_WAEHLBAR
        : GEWICHT_TOT;
    const mass = Math.hypot(kx + 0.5 - p.u, ky + 0.5 - p.v) / gewicht;
    if (mass < bestesMass) {
      bestesMass = mass;
      bester = kandidat;
    }
  }
  return bester;
}

/**
 * Von Zelle zu Zelle in orthogonalen Schritten laufen und `schritt` fuer
 * jede betretene Zelle rufen (die Startzelle nicht, die Zielzelle ja).
 *
 * Ein Finger kommt selten schraeg ueber eine Ecke — die Ereignisse kommen
 * dicht genug, dass er erst die eine, dann die andere Kante ueberschreitet.
 * Aber bei einem schnellen Wisch kann ein Ereignis zwei Felder weiter liegen,
 * und dann darf kein Loch entstehen: Felder auf dem Zettel muessen
 * zusammenhaengen, ein uebersprungenes Feld liesse alles dahinter
 * durchfallen. Genau ueber eine Ecke entscheidet `taugt`, welches der beiden
 * gleich langen Zwischenfelder die Geste brauchen kann — es wird je Schritt
 * gefragt, damit es die Auswahl sieht, die die vorigen Schritte gemacht haben.
 */
export function laufe(
  von: number,
  nach: number,
  spalten: number,
  taugt: (zelle: number) => boolean,
  schritt: (zelle: number) => void,
): void {
  let x = von % spalten;
  let y = Math.floor(von / spalten);
  const zx = nach % spalten;
  const zy = Math.floor(nach / spalten);
  // Mehr Schritte als der Manhattan-Abstand kann kein Weg haben — Schleifenschutz.
  const hoechstens = Math.abs(zx - x) + Math.abs(zy - y);
  for (let schritte = 0; (x !== zx || y !== zy) && schritte < hoechstens; schritte++) {
    const dx = Math.sign(zx - x);
    const dy = Math.sign(zy - y);
    let waagerecht: boolean;
    if (dx === 0) waagerecht = false;
    else if (dy === 0) waagerecht = true;
    else {
      const rx = Math.abs(zx - x);
      const ry = Math.abs(zy - y);
      if (rx !== ry) waagerecht = rx > ry;
      else waagerecht = taugt(y * spalten + x + dx) || !taugt((y + dy) * spalten + x);
    }
    if (waagerecht) x += dx;
    else y += dy;
    schritt(y * spalten + x);
  }
}
