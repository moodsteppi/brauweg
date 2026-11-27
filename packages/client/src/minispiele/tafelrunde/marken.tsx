/**
 * Die Marken von Tafelrunde im Client: die Formen aus synergien.ts, Farbe und
 * Zeichen je Marke und die beiden Vergleiche, die der Bildschirm braucht.
 *
 * Herausgeloest aus Synergien.tsx (alte Oberflaeche, am 28.11.2026 mit dem
 * alten Tafelrunde entfernt). Was eine Marke TUT, rechnet allein das Modul;
 * hier stehen nur Formen, Zeichnung und zwei Vergleiche zweier Zahlen aus der
 * Sicht (`trifftSchwelle`). Die Schwellen kommen aus der Tabelle der Sicht —
 * sie sind je Marke verschieden, eine feste Zahl gibt es hier nicht.
 */

import { tz } from './text';

// ---------------------------------------------------------------------------
// Was das Modul liefert — Abschrift von synergien.ts
// ---------------------------------------------------------------------------

/*
 * Der Client kennt die Spielmodule nicht (siehe Kopf von
 * CLAUDE.md), deshalb stehen die Formen hier noch einmal. Die
 * Marke ist bewusst `string` und kein Vereinigungstyp: Eine achte Marke im
 * Katalog soll eine unbekannte Farbe bekommen und keinen Uebersetzungsfehler
 * an einer Stelle, die das Spiel gar nicht kennt — die Namen kommen ohnehin
 * aus der Sicht.
 */

export interface Wertebonus {
  lebenProzent: number;
  angriffProzent: number;
  tempoProzent: number;
  ruestung: number;
}

/**
 * Der sichtbare Effekt einer Markenstufe (synergien.ts, seit dem 27.11.2026).
 *
 * Gelesen wird davon am Bildschirm nur `art` — als Schluessel fuer Farbe und
 * Effektbild. Die Zahlen darin stehen im Satz `text` schon ausformuliert, und
 * nur der wird gezeigt; nachgerechnet wird aus ihnen nichts.
 */
export interface Markeneffekt {
  art: string;
}

export interface Synergiestufe {
  schwelle: number;
  bonus: Wertebonus;
  /*
   * Die beiden folgenden Felder sind wahlfrei, obwohl das Modul sie seit dem
   * 27.11.2026 immer schickt: Die aufgezeichneten Szenen der Proben
   * (`ruestkammer-szene.json`) und die Testfaelle stammen aus der Zeit davor.
   * Fehlt der Satz, zeigt der Bildschirm wie bisher den Bonus (`bonusSatz`).
   */
  /** Der sichtbare Effekt dieser Stufe. */
  effekt?: Markeneffekt;
  /** Was diese Stufe tut, als ein Satz fuer das Pop-up der Marke (deutsch). */
  text?: string;
}

/** Eine ganze Marke mit allen Stufen — kommt einmalig als `synergieTabelle`. */
export interface Synergie {
  marke: string;
  name: string;
  /**
   * Der Satz, was die Marke bewirkt. Er kommt aus dem Modul (`Synergie.wirkung`
   * in synergien.ts) und steht ausdruecklich NICHT hier als Textliste: Wer die
   * Boni dort umstellt, aendert den Satz im selben Zug mit.
   */
  wirkung: string;
  stufen: Synergiestufe[];
}

/**
 * So viel von einer Katalog-Einheit, wie das Blatt braucht.
 *
 * Strukturell und nicht als Import von `./sicht` — der beschreibt die Sicht
 * mit HILFE dieser Datei, ein Import zurueck waere ein Kreis. Der Bildschirm
 * reicht seinen Katalog aus der Sicht herein; er passt darauf.
 */
export interface Markentraeger {
  id: string;
  name: string;
  kosten: number;
  marken: string[];
}

/** Der Katalog, wie der Bildschirm ihn haelt: je Kennung eine Einheit. */
export type Markenkatalog = Record<string, Markentraeger>;


/**
 * Alle Einheiten des Katalogs, die diese Marke tragen — die Guenstigsten
 * zuerst.
 *
 * ALLE und nicht nur die eigenen: Das Blatt beantwortet die Frage, was man
 * noch kaufen muesste. Die Zugehoerigkeit ist keine Rechnung, sondern steht
 * an jeder Einheit der Sicht (`marken`); sortiert wird nach `kosten` und
 * sonst nach Katalogreihenfolge, damit die Reihe wie der Laden liest.
 */
export function traegerVon(katalog: Markenkatalog, marke: string): Markentraeger[] {
  return Object.values(katalog)
    .filter((e) => e.marken.includes(marke))
    .sort((a, b) => a.kosten - b.kosten);
}

/** Der Stand einer Marke auf einem Brett — kommt in jeder Sicht. */
export interface Synergiestand {
  marke: string;
  name: string;
  anzahl: number;
  /** Die erreichte Schwelle, null unterhalb der ersten. */
  schwelle: number | null;
  /** Die naechste Schwelle, null ab der hoechsten. */
  naechsteSchwelle: number | null;
  /** Der geltende Bonus, null unterhalb der ersten Schwelle. */
  bonus: Wertebonus | null;
  /*
   * Seit dem 27.11.2026, wahlfrei aus demselben Grund wie an `Synergiestufe`:
   * aufgezeichnete Szenen und Testfaelle aus der Zeit davor.
   */
  /** Der geltende Effekt, null unterhalb der ersten Schwelle. */
  effekt?: Markeneffekt | null;
  /** Was die geltende Stufe tut, als Satz; null unterhalb der ersten Schwelle. */
  text?: string | null;
  /**
   * Die GEZAEHLTEN Einheiten dieser Marke auf dem Brett, je Kennung einmal
   * (synergien.ts, seit dem 27.11.2026 nachts: Robin, „zwei Pinguinwachen
   * sind ein Krieger"). `anzahl` ist ihre Zahl. Wahlfrei wie `text`:
   * aufgezeichnete Szenen und Testfaelle aus der Zeit davor.
   */
  traeger?: string[];
}


// ---------------------------------------------------------------------------
// Farbe und Zeichen je Marke
// ---------------------------------------------------------------------------

/**
 * Die Farbe einer Marke. Reine Zeichnung und kein Bedeutungstraeger der
 * Plattform — deshalb hier und nicht als CSS-Variable in styles.css, genau
 * wie die Kostenfarben der Karten (DESIGN.md: die Variablen sind fuer
 * Gruen/Gold/Lila/Rot reserviert, und eine Klassen-Marke ist keins davon).
 *
 * Die Farbe steht NIE allein: Jede Marke hat zusaetzlich ihr eigenes
 * Zeichen. Sieben Farben, die sich auf einem 8-mm-Punkt unterscheiden
 * lassen, gibt es nicht — und schon gar nicht fuer jemanden mit einer
 * Farbsehschwaeche.
 */
export const MARKEN_FARBE: Record<string, string> = {
  krieger: '#d8724f',
  elementar: '#57b0f2',
  meuchler: '#b085ee',
  waechter: '#63c2b4',
  naturwesen: '#6cc06a',
  untot: '#9fb0bd',
  drache: '#f0a03c',
};

/** Fuer eine Marke, die dieser Client noch nicht kennt. */
const ERSATZFARBE = '#8fa3ad';

/**
 * Das Zeichen einer Marke — gezeichnet, nicht geladen.
 *
 * Dieselbe Bauart wie `RollenZeichen` in neu/grafik.tsx: Striche auf 24 x 24,
 * `currentColor`. Ein `<img>` auf eine Datei, die es nicht gibt, waere ein
 * weisser Kasten (CLAUDE.md), und sieben winzige Bilder je Einheit auf
 * neunzehn Feldern waeren ausserdem neunzehn Ladevorgaenge fuer nichts.
 */
const MARKEN_ZEICHEN: Record<string, React.JSX.Element> = {
  // Gekreuzte Klingen.
  krieger: <path d="M4 20 20 4M16 4h4v4M20 20 4 4M8 4H4v4" />,
  // Flamme.
  elementar: <path d="M12 21c3.1 0 5.5-2.2 5.5-5.2 0-3.8-4-5.4-4-9.8-2.6 1.4-4 3.7-4 5.8 0 1.6-1.2 1.9-1.7 1-1 1.4-1.3 2.4-1.3 3.5C6.5 18.8 8.9 21 12 21Z" />,
  // Dolch.
  meuchler: <path d="M12 3 14 9v2h-4V9l2-6ZM8.5 11h7M12 11v10" />,
  // Schild mit Band.
  waechter: <path d="M12 3 5 6v6c0 4.6 3 7.7 7 8.8 4-1.1 7-4.2 7-8.8V6l-7-3ZM8.5 12h7" />,
  // Blatt.
  naturwesen: <path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14ZM8 16c2-4 4.5-6.5 8.5-8.5" />,
  // Schaedel.
  untot: <path d="M12 3a7 7 0 0 0-7 7v3l2 2v3h10v-3l2-2v-3a7 7 0 0 0-7-7ZM9.3 10.5h.01M14.7 10.5h.01" />,
  // Krallenspur.
  drache: <path d="M6 4c1 6 3 10.5 6 14M11.5 3c0 6 .8 11.5 2.5 15M17 4c-1 6-1 11.5 0 15" />,
};

/**
 * Das gezeichnete Zeichen einer Marke allein, ohne Reihe und Groesse — fuer
 * TafelrundeNeu (minispiele/tafelrunde/neu/grafik.tsx), solange dort kein
 * gemaltes Zeichen liegt. Herausgereicht statt abgeschrieben, damit eine Marke
 * in beiden Oberflaechen dasselbe Zeichen traegt.
 */
export function markenGlyphe(marke: string): React.JSX.Element {
  return MARKEN_ZEICHEN[marke] ?? <circle cx="12" cy="12" r="7" />;
}

/** Die Farbe einer Marke mit Rueckfall fuer eine, die dieser Client nicht kennt. */
export function markenFarbe(marke: string): string {
  return MARKEN_FARBE[marke] ?? ERSATZFARBE;
}

/**
 * Die Anzeigenamen aus der Tabelle der Sicht, als Nachschlagewerk.
 *
 * Der Name gehoert dem Modul und nicht dem Client (siehe `Synergie.name` in
 * synergien.ts) — hier wird er nur umsortiert, damit ein Zeichen an einer
 * Einheit ihn ohne die ganze Tabelle findet.
 */
export function markennamen(tabelle: readonly Synergie[]): Record<string, string> {
  return Object.fromEntries(tabelle.map((s) => [s.marke, s.name]));
}

// ---------------------------------------------------------------------------
// Die Rechnungen — beides Vergleiche zweier Zahlen aus der Sicht
// ---------------------------------------------------------------------------

/**
 * Der Bonus als Satz: "+15 % Leben · +10 Rüstung".
 *
 * Die Zahlen kommen aus der Sicht, die Reihenfolge ist fest (Leben, Angriff,
 * Tempo, Rüstung), und was null ist, faellt weg — sonst stuende an jeder
 * Marke dreimal "+0 %". Prozent bei den ersten dreien und feste Punkte bei
 * der Rüstung, weil das Modul es so meint (Wertebonus in katalog.ts).
 */
export function bonusSatz(bonus: Wertebonus | null): string {
  if (!bonus) return '';
  const teile: string[] = [];
  if (bonus.lebenProzent > 0) teile.push(tz('bonus.leben', { n: bonus.lebenProzent }));
  if (bonus.angriffProzent > 0) teile.push(tz('bonus.angriff', { n: bonus.angriffProzent }));
  if (bonus.tempoProzent > 0) teile.push(tz('bonus.tempo', { n: bonus.tempoProzent }));
  if (bonus.ruestung > 0) teile.push(tz('bonus.ruestung', { n: bonus.ruestung }));
  return teile.join(' · ');
}

/**
 * Wuerde diese Einheit die Marke ueber eine Schwelle heben?
 *
 * Die Rechnung aus der Aufgabe: `anzahl + 1 >= naechsteSchwelle`. Beide
 * Zahlen stehen in der Sicht. Steht die Marke noch gar nicht auf dem Brett,
 * fehlt sie in `synergien` (das Modul schickt nur Marken mit mindestens einem
 * Traeger) — dann liefert die Tabelle die erste Stufe. Auch sie ist Sicht und
 * keine 2 im Client: Die Schwellen sind seit dem 27.11.2026 je Marke
 * verschieden (Waechter 2/4/6, Drache nur 2), und wer hier eine feste Zahl
 * annaehme, liesse fuer einen Bonus leuchten, den es nicht gibt.
 *
 * SEIT DEM 27.11.2026 NACHTS zaehlt jede Einheit fuer eine Marke nur einmal
 * (Robin). Steht die Kennung schon unter den gezaehlten Traegern
 * (`traeger`), bringt eine weitere Kopie die Marke nicht voran — dann kein
 * Leuchten. Gezaehlt wird dafuer nichts: Die Liste kommt fertig aus der Sicht.
 */
export function trifftSchwelle(
  marke: string,
  staende: readonly Synergiestand[],
  tabelle: readonly Synergie[],
  einheitId?: string,
): boolean {
  const stand = staende.find((s) => s.marke === marke);
  if (einheitId !== undefined && stand?.traeger?.includes(einheitId)) return false;
  const naechste = stand
    ? stand.naechsteSchwelle
    : (tabelle.find((s) => s.marke === marke)?.stufen[0]?.schwelle ?? null);
  if (naechste === null) return false;
  return (stand?.anzahl ?? 0) + 1 >= naechste;
}

/**
 * Den Pruefer einmal binden — fuer Rahmen und Zeichen einer Karte. Die
 * Kennung der Einheit gehoert dazu (siehe `trifftSchwelle`); ohne sie bleibt
 * es die Frage „irgendein neuer Traeger".
 */
export function schwellenPruefer(
  staende: readonly Synergiestand[],
  tabelle: readonly Synergie[],
): (marke: string, einheitId?: string) => boolean {
  return (marke, einheitId) => trifftSchwelle(marke, staende, tabelle, einheitId);
}

