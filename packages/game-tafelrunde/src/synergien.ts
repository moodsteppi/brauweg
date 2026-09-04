/**
 * Synergien — die Marken-Boni von Tafelrunde (Phase 3 des Konzepts).
 *
 * Jede Einheit traegt ein bis zwei Marken (katalog.ts). Je mehr Einheiten
 * einer Marke auf dem eigenen BRETT stehen, desto staerker der Bonus, mit
 * Schwellen bei 2, 4 und 6. Die Bank zaehlt nicht: Was dort liegt, kaempft
 * nicht, und ein Bonus fuer Einheiten, die zusehen, waere ein Anreiz, die
 * Bank vollzustopfen statt aufzustellen.
 *
 * Was jede Marke bekommt, steht als DATEN in `SYNERGIEN` und nicht in
 * Bedingungen: Wer balanciert, aendert eine Zahl in der Tabelle und keine
 * Verzweigung. Der Bildschirm bekommt dieselbe Tabelle einmal mit der Sicht
 * (sicht.ts), damit er "bei 4: +30 % Angriff" anzeigen kann, ohne die Zahlen
 * selbst zu kennen — sonst gaebe es zwei Wahrheiten ueber jeden Bonus.
 *
 * Der Bonus gilt nur fuer die TRAEGER der Marke, nicht fuer das ganze Brett:
 * Vier Krieger machen die Krieger haerter, nicht den Magier daneben. Eine
 * Einheit mit zwei Marken zaehlt fuer beide und bekommt auch beide Boni —
 * das ist ihr Vorzug gegenueber einer Einheit mit nur einer Marke bei sonst
 * gleichen Werten.
 *
 * Gezaehlt werden EINHEITEN, nicht verschiedene Einheiten: Zwei Dorfwachen
 * sind zwei Krieger. Andere Spiele zaehlen nur Verschiedene; hier ginge das
 * nicht auf, weil der Katalog fuer Untot nur zwei und fuer Drache nur eine
 * Einheit kennt — die Schwellen 4 und 6 waeren dort unerreichbar, die Marke
 * tot. Kopien zaehlen zu lassen hat ausserdem einen Preis, den der Spieler
 * abwaegen muss: Drei Kopien verschmelzen zu einer, und die zaehlt einfach.
 *
 * Reine Funktionen, kein Zustand, nichts wird veraendert.
 */

import {
  type EinheitId,
  type Marke,
  type Wertebonus,
  KEIN_BONUS,
  MARKEN,
  einheit,
} from './katalog.js';

/** Die drei Schwellen aus dem Konzept. */
export type Schwelle = 2 | 4 | 6;

export const SCHWELLEN: readonly Schwelle[] = [2, 4, 6];

/** Eine Stufe einer Synergie: ab wie vielen Traegern welcher Bonus gilt. */
export interface Synergiestufe {
  readonly schwelle: Schwelle;
  readonly bonus: Wertebonus;
}

export interface Synergie {
  readonly marke: Marke;
  /**
   * Deutscher Anzeigename. Wie die Einheitennamen Inhalt des Spiels und
   * deshalb hier und nicht in der i18n des Clients (siehe katalog.ts).
   */
  readonly name: string;
  /** Aufsteigend nach Schwelle, genau eine je Schwelle aus `SCHWELLEN`. */
  readonly stufen: readonly Synergiestufe[];
}

function bonus(teil: Partial<Wertebonus>): Wertebonus {
  return { ...KEIN_BONUS, ...teil };
}

/**
 * Die Tabelle. Jede Marke hat ihre eigene Art von Bonus, damit sich zwei
 * Aufstellungen verschieden ANFUEHLEN und nicht nur verschieden rechnen:
 *
 *   Krieger    — Ruestung: die Linie haelt.
 *   Elementar  — Angriff: Magie trifft haerter.
 *   Meuchler   — Tempo: schneller als der Gegner reagieren kann.
 *   Waechter   — Leben und etwas Ruestung: die Mauer.
 *   Naturwesen — Leben: der Wald waechst nach.
 *   Untot      — Angriff und Leben, beides massvoll: zaeh und unerbittlich.
 *   Drache     — Angriff und Tempo, kraeftig: selten und deshalb teuer erkauft
 *                (im Katalog traegt nur das Drachenkind die Marke, zwei davon
 *                sind schon die erste Schwelle).
 *
 * Die Zahlen sind ein erster Wurf und zum Nachjustieren gedacht, wie die
 * Grundwerte im Katalog. Prozent bei Leben, Angriff und Tempo, feste Punkte
 * bei Ruestung — warum, steht bei `Wertebonus` in katalog.ts.
 */
export const SYNERGIEN: readonly Synergie[] = [
  {
    marke: 'krieger',
    name: 'Krieger',
    stufen: [
      { schwelle: 2, bonus: bonus({ ruestung: 10 }) },
      { schwelle: 4, bonus: bonus({ ruestung: 20 }) },
      { schwelle: 6, bonus: bonus({ ruestung: 30 }) },
    ],
  },
  {
    marke: 'elementar',
    name: 'Elementar',
    stufen: [
      { schwelle: 2, bonus: bonus({ angriffProzent: 15 }) },
      { schwelle: 4, bonus: bonus({ angriffProzent: 30 }) },
      { schwelle: 6, bonus: bonus({ angriffProzent: 50 }) },
    ],
  },
  {
    marke: 'meuchler',
    name: 'Meuchler',
    stufen: [
      { schwelle: 2, bonus: bonus({ tempoProzent: 15 }) },
      { schwelle: 4, bonus: bonus({ tempoProzent: 30 }) },
      { schwelle: 6, bonus: bonus({ tempoProzent: 50 }) },
    ],
  },
  {
    marke: 'waechter',
    name: 'Wächter',
    stufen: [
      { schwelle: 2, bonus: bonus({ lebenProzent: 10, ruestung: 5 }) },
      { schwelle: 4, bonus: bonus({ lebenProzent: 20, ruestung: 10 }) },
      { schwelle: 6, bonus: bonus({ lebenProzent: 30, ruestung: 20 }) },
    ],
  },
  {
    marke: 'naturwesen',
    name: 'Naturwesen',
    stufen: [
      { schwelle: 2, bonus: bonus({ lebenProzent: 15 }) },
      { schwelle: 4, bonus: bonus({ lebenProzent: 30 }) },
      { schwelle: 6, bonus: bonus({ lebenProzent: 50 }) },
    ],
  },
  {
    marke: 'untot',
    name: 'Untot',
    stufen: [
      { schwelle: 2, bonus: bonus({ angriffProzent: 10, lebenProzent: 10 }) },
      { schwelle: 4, bonus: bonus({ angriffProzent: 20, lebenProzent: 20 }) },
      { schwelle: 6, bonus: bonus({ angriffProzent: 35, lebenProzent: 35 }) },
    ],
  },
  {
    marke: 'drache',
    name: 'Drache',
    stufen: [
      { schwelle: 2, bonus: bonus({ angriffProzent: 25, tempoProzent: 10 }) },
      { schwelle: 4, bonus: bonus({ angriffProzent: 50, tempoProzent: 20 }) },
      { schwelle: 6, bonus: bonus({ angriffProzent: 80, tempoProzent: 30 }) },
    ],
  },
];

const NACH_MARKE = new Map<Marke, Synergie>(SYNERGIEN.map((s) => [s.marke, s]));

/** Wirft bei unbekannter Marke — das waere ein Loch in der Tabelle, kein Spielfall. */
export function synergie(marke: Marke): Synergie {
  const gefunden = NACH_MARKE.get(marke);
  if (!gefunden) throw new Error(`Fuer die Marke ${marke} gibt es keine Synergie`);
  return gefunden;
}

/**
 * Eine Bretthaelfte, so weit diese Datei sie braucht: je Platz eine Kennung
 * oder nichts. Strukturell, damit sowohl `Kaempfer` (partie.ts) als auch
 * `Aufgestellt` (kampf.ts) hineinpassen, ohne dass diese Datei eine von
 * beiden kennen muss — kampf.ts importiert hierher, nicht umgekehrt.
 */
export type Aufgestellte = readonly ({ readonly id: EinheitId } | null)[];

export type Markenzaehlung = Readonly<Record<Marke, number>>;

/** Wie viele Traeger jeder Marke auf dieser Bretthaelfte stehen. */
export function zaehleMarken(brett: Aufgestellte): Markenzaehlung {
  const zaehlung: Record<Marke, number> = Object.fromEntries(
    MARKEN.map((m) => [m, 0]),
  ) as Record<Marke, number>;
  for (const platz of brett) {
    if (!platz) continue;
    for (const marke of einheit(platz.id).marken) zaehlung[marke] += 1;
  }
  return zaehlung;
}

/** Die hoechste erreichte Schwelle, oder null unter der ersten. */
export function aktiveSchwelle(anzahl: number): Schwelle | null {
  let aktiv: Schwelle | null = null;
  for (const s of SCHWELLEN) if (anzahl >= s) aktiv = s;
  return aktiv;
}

/** Die naechste noch nicht erreichte Schwelle, oder null ab der hoechsten. */
export function naechsteSchwelle(anzahl: number): Schwelle | null {
  return SCHWELLEN.find((s) => anzahl < s) ?? null;
}

/** Der Bonus, den eine Marke bei so vielen Traegern gibt — null unter der ersten Schwelle. */
export function bonusDerMarke(marke: Marke, anzahl: number): Wertebonus | null {
  const schwelle = aktiveSchwelle(anzahl);
  if (schwelle === null) return null;
  const stufe = synergie(marke).stufen.find((s) => s.schwelle === schwelle);
  if (!stufe) throw new Error(`Synergie ${marke} hat keine Stufe fuer Schwelle ${schwelle}`);
  return stufe.bonus;
}

/**
 * Der gesamte Bonus einer Einheit aus allen ihren Marken, bei dieser Zaehlung.
 *
 * Die Boni der Marken werden ADDIERT, nicht multipliziert: +10 % und +15 %
 * Leben sind +25 %. Multiplizieren gaebe 26,5 % und eine Zahl, die sich in
 * der Anzeige nicht mehr aus den zwei Zeilen der Tabelle erklaeren liesse.
 */
export function bonusFuerEinheit(id: EinheitId, zaehlung: Markenzaehlung): Wertebonus {
  let summe = KEIN_BONUS;
  for (const marke of einheit(id).marken) {
    const b = bonusDerMarke(marke, zaehlung[marke]);
    if (!b) continue;
    summe = {
      lebenProzent: summe.lebenProzent + b.lebenProzent,
      angriffProzent: summe.angriffProzent + b.angriffProzent,
      tempoProzent: summe.tempoProzent + b.tempoProzent,
      ruestung: summe.ruestung + b.ruestung,
    };
  }
  return summe;
}

/**
 * Was der Bildschirm ueber eine Marke wissen muss: wie viele stehen, welche
 * Schwelle gilt, welche kommt als naechste — und was der Bonus gerade ist.
 */
export interface Synergiestand {
  readonly marke: Marke;
  readonly name: string;
  readonly anzahl: number;
  /** Die erreichte Schwelle, null unter der ersten. */
  readonly schwelle: Schwelle | null;
  /** Die naechste Schwelle, null ab der hoechsten. */
  readonly naechsteSchwelle: Schwelle | null;
  /** Der geltende Bonus, null unter der ersten Schwelle. */
  readonly bonus: Wertebonus | null;
}

/**
 * Die Synergien einer Bretthaelfte fuer die Sicht — nur Marken mit
 * mindestens einem Traeger, in Katalogreihenfolge der Marken.
 *
 * Die Marken ohne Traeger fehlen mit Absicht: Sieben Zeilen je Sitz mal acht
 * Sitze in jedem Rundruf, davon die meisten "0 von 2", waeren Ballast fuer
 * eine Anzeige, die sie ohnehin ausblenden wuerde.
 */
export function synergienVon(brett: Aufgestellte): readonly Synergiestand[] {
  const zaehlung = zaehleMarken(brett);
  return MARKEN.filter((marke) => zaehlung[marke] > 0).map((marke) => {
    const anzahl = zaehlung[marke];
    return {
      marke,
      name: synergie(marke).name,
      anzahl,
      schwelle: aktiveSchwelle(anzahl),
      naechsteSchwelle: naechsteSchwelle(anzahl),
      bonus: bonusDerMarke(marke, anzahl),
    };
  });
}
