/**
 * Nebelschach (Modus 'nebel', seit dem 17.11.2026 — Projekt „BroChess
 * Spezial-Modi", Tom; wie „Fog of War" / Dark Chess bei Lichess).
 *
 * Jeder sieht nur Felder mit eigenen Figuren und Felder, auf die eine eigene
 * Figur ziehen oder schlagen koennte. Alles andere ist Nebel. Es gibt kein
 * Schach: Man darf den König im Schach lassen oder hineinziehen, und gewonnen
 * hat, wer den König SCHLAEGT. En passant und Umwandlung wie normal; die
 * Rochade geht auch aus dem Schach heraus und durch angegriffene Felder.
 *
 * Dieses Modul ist reine Rechnung: welche Felder jemand sieht, wie ein Zug
 * hier geschrieben wird, und was die Partie ueber die Zuege weiss. Die
 * Zugerzeugung ist die des Kerns (`pseudoZuege` mit `ohneSchachRegel`).
 *
 * Wichtigste Eigenschaft: **Die Zuege des Betrachters lassen sich aus seiner
 * Sicht allein berechnen.** Jedes Ziel eines eigenen Zuges liegt auf einem
 * sichtbaren Feld, und jeder Blocker, vor dem eine Figur stehen bleibt, auch.
 * Darum bekommt der Bot nur das verdeckte Brett (sicht.ts) und rechnet seine
 * Zuege selbst, ohne dass ein Feld der Sicht mehr verraten muss.
 */

import {
  type Farbe,
  type Stellung,
  type Zug,
  farbeVon,
  feldName,
  linieVon,
  pseudoZuege,
  reiheVon,
  zuFen,
} from './brett.js';

/** Was die Partie je Halbzug festhaelt, damit jede Sicht ihren Teil zeigen kann. */
export interface NebelZug {
  readonly farbe: Farbe;
  readonly von: string;
  readonly nach: string;
  /** Kurzschrift OHNE Schachzeichen und ohne Mehrdeutigkeitszusatz (siehe `notationNebel`). */
  readonly san: string;
  /**
   * Konnte die Farbe das Zielfeld nach dem Zug sehen? Beim ziehenden Sitz
   * immer. Beim Gegner entscheidet es, ob der Zug in seiner Zugliste steht
   * (und als „zuletzt gezogen" markiert wird); gespeichert statt spaeter
   * nachgerechnet, weil die Sicht von damals nur mit der Stellung von damals
   * bekannt ist.
   */
  /** Dieselbe Kurzschrift ohne Startfeld-Hinweise, fuer Betrachter, die `von` nicht sahen. */
  readonly sanOhneStart: string;
  readonly gesehen: { readonly w: boolean; readonly b: boolean };
  /**
   * Dasselbe fuer das STARTFELD. Das Ziel entscheidet, ob der Zug in der
   * Zugliste steht; das Startfeld, ob „zuletzt gezogen" auch den Ausgangspunkt
   * zeigt — sonst verriete der Pfeil, von wo eine Figur aus dem Nebel kam.
   */
  readonly vonGesehen: { readonly w: boolean; readonly b: boolean };
}

export interface NebelStand {
  readonly zuege: readonly NebelZug[];
  /**
   * Genommene Figuren je Farbe (Kleinbuchstaben, in Zugfolge). Oeffentlich:
   * Wer schlaegt, weiss, was; wer geschlagen wird, ebenso. Eigene Liste, weil
   * `materialStand` das Brett zaehlt — und das Brett kennt verdeckte Figuren.
   */
  readonly genommen: { readonly w: readonly string[]; readonly b: readonly string[] };
}

export function neuerNebelStand(): NebelStand {
  return { zuege: [], genommen: { w: [], b: [] } };
}

/** Alle Zuege der Seite am Zug: Gangart, kein Schach (siehe Kopf). */
export function nebelZuege(stellung: Stellung): Zug[] {
  return pseudoZuege(stellung, true);
}

/** Schlaegt dieser Zug einen König? Dann ist die Partie aus. */
export function schlaegtKoenigNebel(stellung: Stellung, zug: Zug): boolean {
  const opfer = stellung.brett[zug.nach]!;
  return opfer !== '' && opfer.toLowerCase() === 'k' && farbeVon(opfer) !== stellung.amZug;
}

const SPRINGER: readonly (readonly [number, number])[] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KOENIG: readonly (readonly [number, number])[] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const GERADE: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SCHRAEG: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function feldBei(linie: number, reihe: number): number {
  if (linie < 0 || linie > 7 || reihe < 0 || reihe > 7) return -1;
  return reihe * 8 + linie;
}

/**
 * Die Felder, die `farbe` sieht: die eigenen Figuren und alles, wohin eine
 * eigene Figur ziehen oder schlagen koennte.
 *
 * - Laeufer, Turm, Dame: jedes Feld der Linie bis zum ersten Blocker, den
 *   Blocker eingeschlossen (auch eine eigene Figur — die sieht man ohnehin).
 * - Springer und König: ihre Zielfelder.
 * - Bauer: das Feld davor — auch wenn ein Gegner darauf steht, denn dann
 *   erfaehrt man, was den Bauern aufhaelt —, die beiden Schlagfelder (auch
 *   leer: dorthin droht der Bauer) und, wenn er noch auf der Grundreihe steht
 *   und das Feld davor frei ist, das Doppelschrittfeld.
 *
 * Eine Rochade braucht keinen eigenen Eintrag: Die leeren Zwischenfelder
 * liegen im Strahl des Turms.
 */
export function sichtbareFelder(brett: readonly string[], farbe: Farbe): ReadonlySet<number> {
  const sicht = new Set<number>();
  for (let von = 0; von < 64; von += 1) {
    const figur = brett[von]!;
    if (figur === '' || farbeVon(figur) !== farbe) continue;
    sicht.add(von);
    const l = linieVon(von);
    const r = reiheVon(von);
    const art = figur.toLowerCase();
    const punkt = (dl: number, dr: number): void => {
      const f = feldBei(l + dl, r + dr);
      if (f >= 0) sicht.add(f);
    };
    const strahl = (richtungen: readonly (readonly [number, number])[]): void => {
      for (const [dl, dr] of richtungen) {
        for (let schritt = 1; schritt < 8; schritt += 1) {
          const f = feldBei(l + dl * schritt, r + dr * schritt);
          if (f < 0) break;
          sicht.add(f);
          if (brett[f] !== '') break;
        }
      }
    };
    if (art === 'p') {
      const vor = farbe === 'w' ? 1 : -1;
      punkt(-1, vor);
      punkt(1, vor);
      punkt(0, vor);
      const eins = feldBei(l, r + vor);
      if (r === (farbe === 'w' ? 1 : 6) && eins >= 0 && brett[eins] === '') punkt(0, 2 * vor);
    } else if (art === 'n') for (const [dl, dr] of SPRINGER) punkt(dl, dr);
    else if (art === 'k') for (const [dl, dr] of KOENIG) punkt(dl, dr);
    else if (art === 'b') strahl(SCHRAEG);
    else if (art === 'r') strahl(GERADE);
    else if (art === 'q') strahl([...GERADE, ...SCHRAEG]);
  }
  return sicht;
}

/**
 * Das Brett, wie es `farbe` sieht: verdeckte Felder sind leer. Ob ein leeres
 * Feld leer oder im Nebel ist, sagt `sichtbareFelder`.
 */
export function verdecktesBrett(brett: readonly string[], sichtbar: ReadonlySet<number>): string[] {
  return brett.map((figur, feld) => (sichtbar.has(feld) ? figur : ''));
}

/** Felder, die BEIDE Seiten sehen — was ein Zuschauer waehrend der Partie sehen darf. */
export function gemeinsameFelder(brett: readonly string[]): ReadonlySet<number> {
  const w = sichtbareFelder(brett, 'w');
  const b = sichtbareFelder(brett, 'b');
  return new Set([...w].filter((f) => b.has(f)));
}

const BUCHSTABE: Readonly<Record<string, string>> = { n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

/**
 * Der Zug in Kurzschrift, fuer die Zugliste. Anders als `sanVon` ohne
 * Schachzeichen (es gibt kein Schach) und ohne Zusatz bei Mehrdeutigkeit: Der
 * Zusatz verriete dem Gegner, dass eine zweite gleiche Figur dasselbe Feld
 * erreicht haette — und die kennt er womoeglich nicht.
 */
export function notationNebel(stellung: Stellung, zug: Zug, ohneStart = false): string {
  const { brett } = stellung;
  const figur = brett[zug.von]!;
  const art = figur.toLowerCase();
  const rochade = art === 'k' && Math.abs(zug.nach - zug.von) === 2 && reiheVon(zug.nach) === reiheVon(zug.von);
  if (rochade && !ohneStart) return zug.nach > zug.von ? 'O-O' : 'O-O-O';
  // Ohne Startfeld (der Betrachter sah es nicht): weder Linie des Bauern noch Rochade —
  // beides verriete, woher die Figur kam bzw. dass sich ein Turm im Nebel bewegt hat.
  if (rochade) return `K${feldName(zug.nach)}`;
  const schlag = brett[zug.nach] !== '' || (art === 'p' && zug.nach === stellung.epFeld);
  const ziel = feldName(zug.nach);
  if (art === 'p') {
    const linie = ohneStart ? '' : feldName(zug.von)[0]!;
    return `${schlag ? `${linie}x` : ''}${ziel}${zug.umwandlung ? `=${zug.umwandlung.toUpperCase()}` : ''}`;
  }
  return `${BUCHSTABE[art]}${schlag ? 'x' : ''}${ziel}`;
}

/**
 * Welche Figur nimmt dieser Zug vom Brett (Kleinbuchstabe), oder null?
 * En passant nimmt den Bauern neben dem Ziel.
 */
export function genommeneFigur(stellung: Stellung, zug: Zug): string | null {
  const ziel = stellung.brett[zug.nach]!;
  if (ziel !== '') return ziel.toLowerCase();
  const art = stellung.brett[zug.von]!.toLowerCase();
  return art === 'p' && zug.nach === stellung.epFeld ? 'p' : null;
}

/** Stand nach einem Zug. `stellungDanach` ist die Stellung nach `wendeAn`. */
export function standNachZugNebel(
  stand: NebelStand,
  davor: Stellung,
  zug: Zug,
  stellungDanach: Stellung,
): NebelStand {
  const farbe = davor.amZug;
  const genommen = genommeneFigur(davor, zug);
  const sichtGegner = sichtbareFelder(stellungDanach.brett, farbe === 'w' ? 'b' : 'w');
  const gegnerSieht = sichtGegner.has(zug.nach);
  // Bei der Rochade zaehlen auch die Turmfelder: Wer nur das Ziel des Koenigs sieht, soll
  // nicht erfahren, dass ein Turm gezogen wurde.
  const rochade = davor.brett[zug.von]!.toLowerCase() === 'k' && Math.abs(zug.nach - zug.von) === 2;
  const turmFelder = rochade ? (zug.nach > zug.von ? [zug.von + 3, zug.von + 1] : [zug.von - 4, zug.von - 1]) : [];
  const gegnerSiehtVon = sichtGegner.has(zug.von) && turmFelder.every((f) => sichtGegner.has(f));
  const eintrag: NebelZug = {
    farbe,
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    san: notationNebel(davor, zug),
    sanOhneStart: notationNebel(davor, zug, true),
    gesehen: { w: farbe === 'w' ? true : gegnerSieht, b: farbe === 'b' ? true : gegnerSieht },
    vonGesehen: { w: farbe === 'w' ? true : gegnerSiehtVon, b: farbe === 'b' ? true : gegnerSiehtVon },
  };
  const opfer: Farbe = farbe === 'w' ? 'b' : 'w';
  return {
    zuege: [...stand.zuege, eintrag],
    genommen:
      genommen === null
        ? stand.genommen
        : { ...stand.genommen, [opfer]: [...stand.genommen[opfer], genommen] },
  };
}

/**
 * Schluessel fuer die Stellungswiederholung im Nebel: wie `stellungsSchluessel`,
 * nur zaehlt das En-passant-Feld, wenn der Schlag nach den Nebelregeln
 * moeglich ist (ohne Schachpruefung).
 */
export function schluesselNebel(stellung: Stellung): string {
  const ep =
    stellung.epFeld !== null &&
    nebelZuege(stellung).some(
      (z) => z.nach === stellung.epFeld && stellung.brett[z.von]!.toLowerCase() === 'p',
    )
      ? feldName(stellung.epFeld)
      : '-';
  return zuFen({ ...stellung, epFeld: null, halbzugUhr: 0, zugNummer: 1 })
    .split(' ')
    .slice(0, 3)
    .concat(ep)
    .join(' ');
}

const WERT: Readonly<Record<string, number>> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
const REIHENFOLGE = 'qrbnp';

/** Genommene Figuren, staerkste zuerst, und der Materialvorsprung von Weiss (nur aus Genommenem). */
export function materialNebel(stand: NebelStand): {
  readonly geschlagen: { readonly w: readonly string[]; readonly b: readonly string[] };
  readonly vorsprung: number;
} {
  const ordne = (liste: readonly string[]): string[] =>
    [...liste].filter((a) => a !== 'k').sort((a, b) => REIHENFOLGE.indexOf(a) - REIHENFOLGE.indexOf(b));
  const wert = (liste: readonly string[]): number => liste.reduce((s, a) => s + (WERT[a] ?? 0), 0);
  return {
    geschlagen: { w: ordne(stand.genommen.w), b: ordne(stand.genommen.b) },
    // Weiss liegt vorn um den Wert dessen, was Schwarz verloren hat, abzueglich dem eigenen Verlust.
    vorsprung: wert(stand.genommen.b) - wert(stand.genommen.w),
  };
}
