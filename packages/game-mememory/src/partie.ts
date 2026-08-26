/**
 * Spielzustand und Regeln von Mememory.
 *
 * Reine Logik: kein Netz, keine Datenbank, keine Uhr, kein Zufall ausser dem
 * uebergebenen Seed (game-api, Grundsatz 1). Auch das Zurueckdrehen zweier
 * ungleicher Karten misst dieses Modul NICHT selbst — es meldet nur, dass eine
 * Schaupause laeuft, und die Plattform ruft nach Ablauf `beendePause`.
 */

import { MOTIVE } from './motive.js';
import type { MememoryRegeln } from './regeln.js';

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
 * Wer sein Brett sieht, koennte 2^32 Seeds durchprobieren und danach jede
 * verdeckte Karte kennen. Im Betrieb kommt deshalb die Hexkette vom Server.
 */
export function baueZufall(saat: Saat): () => number {
  if (typeof saat === 'number') return mulberry32(saat);
  const [a, b, c, d] = worte(saat);
  const zufall = sfc32(a, b, c, d);
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

/**
 * Fisher-Yates, von hinten nach vorne.
 *
 * Ausgeschrieben und nicht ueber `sort(() => zufall() - 0.5)`: Ein
 * Vergleichszufall mischt nicht gleichverteilt, und das Ergebnis haengt an der
 * Sortierung der Laufzeitumgebung. Genau daran ist im Feldherr ein iPhone
 * gegen einen Schreibtisch auseinandergelaufen.
 */
function mische<T>(liste: T[], zufall: () => number): T[] {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    const merk = kopie[i]!;
    kopie[i] = kopie[j]!;
    kopie[j] = merk;
  }
  return kopie;
}

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/** Anlass der laufenden Schaupause. */
export type Pause = 'treffer' | 'daneben';

export interface MememoryPartie {
  readonly regeln: MememoryRegeln;
  /** Die gezogenen Motivkennungen dieser Partie, sortiert. Index = Motivnummer. */
  readonly motive: readonly string[];
  /** Je Platz die Motivnummer. Verlaesst diese Datei NIE ungefiltert. */
  readonly feld: readonly number[];
  /** Wem ein Platz gehoert, sonst null. */
  readonly besitzer: readonly (number | null)[];
  /** Gerade aufgedeckte Plaetze, hoechstens zwei. */
  readonly offen: readonly number[];
  readonly punkte: Readonly<Record<number, number>>;
  /** Wie viele Karten ein Sitz insgesamt aufgedeckt hat (Grundlage der XP). */
  readonly aufgedeckt: Readonly<Record<number, number>>;
  readonly dran: number;
  /** Selbstgewaehlter Anzeigename je Sitz, leer solange keiner gesetzt ist. */
  readonly namen: Readonly<Record<number, string>>;
  readonly pause: Pause | null;
  readonly leftSeats: readonly number[];
  readonly fertig: boolean;
}

export type MememoryAktion =
  | { readonly typ: 'aufdecken'; readonly platz: number }
  /**
   * Anzeigename fuer dieses Spiel. Kein Spielzug: er steht nicht in
   * `legalActions`, aendert weder Zugrecht noch Punkte und ist deshalb auch
   * waehrend einer Schaupause erlaubt. Der Client setzt ihn einmal, sobald die
   * Partie steht.
   */
  | { readonly typ: 'name'; readonly name: string };

export const NAME_MAX = 16;

/**
 * Saeubert einen selbstgewaehlten Namen.
 *
 * Er wird dem Gegner angezeigt, kommt also aus einem fremden Browser. Steuer-
 * zeichen und Laenge werden hier begrenzt und nicht erst im Client: Ein
 * zweiter Client (oder ein Skript) haelt sich nicht an die Feldlaenge.
 */
export function saeubereName(roh: string): string {
  const sichtbar = [...roh].filter((zeichen) => {
    const code = zeichen.codePointAt(0) ?? 0;
    // Ausgeschriebene Bereiche statt einer Zeichenklasse: Steuerzeichen in
    // einem Quelltext zu SCHREIBEN ist genau der Fehler, den diese Funktion
    // verhindern soll — und die Datei wurde dabei schon einmal unlesbar.
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
    // Nullbreiten- und Richtungszeichen: ein Name aus lauter davon sieht aus
    // wie ein leerer Platz, und ein Umbruch zerlegt die Anzeige.
    if (code >= 0x200b && code <= 0x200f) return false;
    if (code >= 0x2028 && code <= 0x202e) return false;
    return code !== 0xfeff;
  });
  // Ueber Codepunkte schneiden, nicht ueber UTF-16-Einheiten: Ein halbiertes
  // Emoji ist ein kaputtes Zeichen.
  return sichtbar.slice(0, NAME_MAX).join("").trim();
}


// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

export function erstellePartie(
  regeln: MememoryRegeln,
  sitze: readonly number[],
  saat: Saat,
): MememoryPartie {
  const plaetze = regeln.spalten * regeln.zeilen;
  const paare = plaetze / 2;
  // Fester Katalog plus die Zusatzmotive des Tisches. Doppelte Kennungen
  // fliegen raus — zweimal dasselbe Motiv waeren zwei Paare, die sich nicht
  // unterscheiden lassen, und das Brett liesse sich nicht raeumen.
  const topf = [...new Set([...MOTIVE, ...(regeln.zusatz ?? [])])];
  if (paare > topf.length) {
    throw new Error(`Brett braucht ${paare} Motive, der Katalog hat ${topf.length}`);
  }

  const zufall = baueZufall(saat);
  // Erst ziehen, dann sortieren: Die Sicht schickt die Liste an beide Geraete,
  // und die Reihenfolge darf nichts ueber die Lage auf dem Brett verraten.
  const gezogen = mische(topf, zufall).slice(0, paare).sort();

  const paarliste: number[] = [];
  for (let i = 0; i < paare; i++) paarliste.push(i, i);
  const feld = mische(paarliste, zufall);

  return {
    regeln,
    motive: gezogen,
    feld,
    besitzer: Array.from({ length: plaetze }, () => null),
    offen: [],
    punkte: Object.fromEntries(sitze.map((s) => [s, 0])),
    aufgedeckt: Object.fromEntries(sitze.map((s) => [s, 0])),
    // Wer anfaengt, entscheidet der Seed und nicht die Sitzreihenfolge —
    // sonst haette der Gastgeber in jeder Partie den ersten Zug.
    dran: sitze[Math.floor(zufall() * sitze.length)] ?? 0,
    namen: Object.fromEntries(sitze.map((s) => [s, ''])),
    pause: null,
    leftSeats: [],
    fertig: false,
  };
}

// ---------------------------------------------------------------------------
// Zuege
// ---------------------------------------------------------------------------

/**
 * Wer am Zug ist, oder null.
 *
 * Waehrend einer Schaupause ist NIEMAND am Zug. Daran haengt die ganze
 * Mechanik: Die Plattform plant die Pause genau dann, wenn `currentActor`
 * null meldet (siehe runtime/party.ts, scheduleInterlude).
 */
export function amZug(partie: MememoryPartie): number | null {
  if (partie.fertig || partie.pause !== null) return null;
  return partie.dran;
}

export function erlaubteZuege(partie: MememoryPartie, sitz: number): MememoryAktion[] {
  if (amZug(partie) !== sitz) return [];
  return partie.feld
    .map((_, platz) => platz)
    .filter((platz) => istAufdeckbar(partie, platz))
    .map((platz) => ({ typ: 'aufdecken', platz }) as const);
}

function istAufdeckbar(partie: MememoryPartie, platz: number): boolean {
  if (platz < 0 || platz >= partie.feld.length) return false;
  if (partie.besitzer[platz] !== null) return false;
  if (partie.offen.includes(platz)) return false;
  return partie.offen.length < 2;
}

export function fuehreAus(
  partie: MememoryPartie,
  sitz: number,
  aktion: MememoryAktion,
): MememoryPartie {
  if (aktion.typ === 'name') {
    return { ...partie, namen: { ...partie.namen, [sitz]: saeubereName(aktion.name) } };
  }

  if (partie.fertig) throw new Error('Partie ist zu Ende');
  if (partie.pause !== null) throw new Error('Schaupause laeuft');
  if (partie.dran !== sitz) throw new Error('Nicht am Zug');
  if (!istAufdeckbar(partie, aktion.platz)) throw new Error('Platz nicht aufdeckbar');

  const offen = [...partie.offen, aktion.platz];
  const aufgedeckt = { ...partie.aufgedeckt, [sitz]: (partie.aufgedeckt[sitz] ?? 0) + 1 };

  if (offen.length < 2) return { ...partie, offen, aufgedeckt };

  const [a, b] = offen as [number, number];
  const treffer = partie.feld[a] === partie.feld[b];

  if (!treffer) return { ...partie, offen, aufgedeckt, pause: 'daneben' };

  // Treffer: Die beiden Plaetze gehoeren sofort dem Spieler. Sie bleiben damit
  // auch fuer den Gegner sichtbar — die Sicht zeigt jeden besessenen Platz.
  const besitzer = [...partie.besitzer];
  besitzer[a] = sitz;
  besitzer[b] = sitz;
  return {
    ...partie,
    offen,
    aufgedeckt,
    besitzer,
    punkte: { ...partie.punkte, [sitz]: (partie.punkte[sitz] ?? 0) + 1 },
    pause: 'treffer',
  };
}

/**
 * Dauer der Schaupause, oder null wenn keine laeuft.
 *
 * Zwei verschiedene Laengen, und der Unterschied ist keine Kosmetik: Nach
 * einem Treffer liegt nichts mehr im Weg, es geht sofort weiter; nach einem
 * Fehlgriff muss der Gegner Zeit haben, sich die beiden Karten zu merken.
 */
export function pauseDauerMs(partie: MememoryPartie): number | null {
  if (partie.pause === 'treffer') return 650;
  if (partie.pause === 'daneben') return partie.regeln.merkzeitMs;
  return null;
}

/** Ende der Schaupause: Karten wegraeumen bzw. zurueckdrehen, dann weiter. */
export function beendePause(partie: MememoryPartie): MememoryPartie {
  if (partie.pause === null) return partie;
  const fertig = partie.besitzer.every((wer) => wer !== null);
  return {
    ...partie,
    offen: [],
    // Ein Treffer behaelt das Zugrecht, ein Fehlgriff gibt es ab.
    dran: partie.pause === 'treffer' ? partie.dran : gegner(partie, partie.dran),
    pause: null,
    fertig,
  };
}

function gegner(partie: MememoryPartie, sitz: number): number {
  const sitze = Object.keys(partie.punkte).map(Number).sort((x, y) => x - y);
  const anderer = sitze.find((s) => s !== sitz);
  return anderer ?? sitz;
}

export function markiereVerlassen(partie: MememoryPartie, sitz: number): MememoryPartie {
  if (partie.leftSeats.includes(sitz)) return partie;
  return { ...partie, leftSeats: [...partie.leftSeats, sitz] };
}

/**
 * Platzierungen.
 *
 * Gleichstand ergibt zweimal Platz 1 — im Memory ist das ein echtes
 * Unentschieden und keine Verlegenheitsloesung: Bei 20 Paaren kann jeder zehn
 * haben.
 */
export function platzierungen(
  partie: MememoryPartie,
): { seat: number; points: number; place: number; left: boolean }[] {
  const sitze = Object.keys(partie.punkte).map(Number).sort((a, b) => a - b);
  const reihe = sitze
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
export function sieger(partie: MememoryPartie): number | null {
  if (!partie.fertig) return null;
  const [erster, zweiter] = platzierungen(partie);
  if (!erster || !zweiter) return null;
  return erster.points === zweiter.points ? null : erster.seat;
}
