/**
 * Brett und Bank — der Aufstellungszustand, ohne jede Anzeige.
 *
 * Hier steht, WO etwas liegt, nicht wie es aussieht: Felder sind Zahlenpaare,
 * keine Pixel. Die Oberflaeche rechnet daraus ihre Sechsecke selbst; dieses
 * Modul weiss nichts von Breiten, Hoehen oder Ziehen und Ablegen.
 *
 * Reine Funktionen: kein Netz, keine Datenbank, keine Uhr, kein Zufall. Die
 * uebergebene Aufstellung wird nie veraendert, es kommt immer eine neue
 * zurueck — begruendet im Kopf von verschmelzen.ts.
 */

import { type EinheitId } from './einheiten.js';
import { type Level, HOECHSTES_LEVEL } from './gold.js';
import {
  HOECHSTE_STUFE,
  JE_VERSCHMELZUNG,
  type Exemplar,
  type Stufe,
  type Verschmelzung,
} from './verschmelzen.js';

// ---------------------------------------------------------------------------
// Felder
// ---------------------------------------------------------------------------

/**
 * Ein Feld in Achsen-Koordinaten (q, r).
 *
 * Achsen und nicht Zeile/Spalte, obwohl das Brett rechteckig aussieht: Nur so
 * ist der Abstand zwischen zwei Sechsecken eine kurze Formel (`abstand()`).
 * Mit versetzten Zeilen-Spalten-Nummern haengt jeder Nachbar davon ab, ob die
 * Zeile gerade oder ungerade ist — und genau daran ist in der Kampfphase
 * spaeter jede Reichweitenpruefung zum Scherbenhaufen geworden.
 *
 * Der Preis dafuer: q wird in tieferen Zeilen negativ. Das ist richtig so.
 */
export interface Feld {
  readonly q: number;
  readonly r: number;
}

/** Vier Reihen zu fuenf Spalten — die eigene Haelfte aus dem Konzept. */
export const BRETT_REIHEN = 4;
export const BRETT_SPALTEN = 5;

/** Feste Groesse der Reservebank. Neun, wie im Konzept die obere Grenze. */
export const BANK_PLAETZE = 9;

/**
 * Alle Felder des Bretts, sortiert von oben links nach unten rechts.
 *
 * Die Reihenfolge ist Teil der Zusicherung: Nach ihr laeuft das Verschmelzen
 * auf dem Brett (siehe `verschmelzeAufstellung`), und eine andere Sortierung
 * legte die entstandene Einheit auf ein anderes Feld.
 */
export const BRETT_FELDER: readonly Feld[] = (() => {
  const felder: Feld[] = [];
  for (let r = 0; r < BRETT_REIHEN; r++) {
    // Der Versatz macht aus dem Achsen-Rhombus wieder ein Rechteck: Ohne ihn
    // haengt die unterste Zeile zwei Felder nach rechts heraus.
    const versatz = Math.floor(r / 2);
    for (let s = 0; s < BRETT_SPALTEN; s++) felder.push({ q: s - versatz, r });
  }
  return felder;
})();

/** Zwei Felder sind dasselbe Feld. */
export function gleichesFeld(a: Feld, b: Feld): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Liegt das Feld ueberhaupt auf dem Brett? */
export function istAufBrett(feld: Feld): boolean {
  return BRETT_FELDER.some((f) => gleichesFeld(f, feld));
}

/**
 * Abstand zweier Felder in Feldern.
 *
 * Die Kubus-Formel ueber die dritte Achse (s = -q - r). Gebraucht wird sie
 * von der Reichweite im Kampf; sie steht schon hier, weil sie zur Geometrie
 * gehoert und nicht zur Kampfschleife.
 */
export function abstand(a: Feld, b: Feld): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Die sechs Richtungen, in Achsen-Koordinaten. */
const RICHTUNGEN: readonly Feld[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Die Nachbarn eines Feldes, die noch auf dem Brett liegen. */
export function nachbarn(feld: Feld): Feld[] {
  return RICHTUNGEN.map((richtung) => ({ q: feld.q + richtung.q, r: feld.r + richtung.r })).filter(
    istAufBrett,
  );
}

/**
 * Wie viele Einheiten auf dem Brett stehen duerfen: so viele wie das Level.
 *
 * Damit ist Level-Auf die einzige Art, mehr Einheiten aufzustellen — und
 * genau das ist die Entscheidung, gegen die das Wuerfeln nach starken
 * Einheiten steht. Der Deckel liegt beim hoechsten Level und damit weit unter
 * den 20 Feldern; die freien Felder sind Stellung, nicht Platz.
 */
export function plaetzeFuerLevel(level: Level): number {
  return Math.min(level, HOECHSTES_LEVEL);
}

// ---------------------------------------------------------------------------
// Die Aufstellung
// ---------------------------------------------------------------------------

/** Eine Einheit auf einem Feld. */
export interface Feldbesetzung {
  readonly feld: Feld;
  readonly exemplar: Exemplar;
}

/**
 * Brett und Bank eines Spielers.
 *
 * Das Brett ist eine Liste (nur belegte Felder), die Bank ein Feld fester
 * Laenge mit Luecken. Der Unterschied ist gewollt: Auf dem Brett zaehlt die
 * Stellung, und leere Felder gibt es 20 — die alle als `null` mitzufuehren
 * waere Ballast in jedem Sichtenpaket. Auf der Bank zaehlt dagegen der Platz
 * selbst, weil der Spieler die Reihenfolge sieht und eine Einheit sonst beim
 * Verkaufen der Nachbarin springen wuerde.
 */
export interface Aufstellung {
  readonly brett: readonly Feldbesetzung[];
  readonly bank: readonly (Exemplar | null)[];
}

/** Leere Aufstellung: kein Feld belegt, alle Bankplaetze frei. */
export function leereAufstellung(): Aufstellung {
  return { brett: [], bank: Array.from({ length: BANK_PLAETZE }, () => null) };
}

/** Wie viele Einheiten auf dem Brett stehen. */
export function anzahlAufBrett(auf: Aufstellung): number {
  return auf.brett.length;
}

/** Wie viele Einheiten auf der Bank liegen. */
export function anzahlAufBank(auf: Aufstellung): number {
  return auf.bank.filter((e) => e !== null).length;
}

/** Der erste freie Bankplatz, oder -1. */
export function ersterFreierBankplatz(auf: Aufstellung): number {
  return auf.bank.findIndex((e) => e === null);
}

/** Was auf diesem Feld steht, oder null. */
export function aufFeld(auf: Aufstellung, feld: Feld): Exemplar | null {
  return auf.brett.find((b) => gleichesFeld(b.feld, feld))?.exemplar ?? null;
}

/** Alles, was der Spieler besitzt — Brett und Bank zusammen. */
export function alleExemplare(auf: Aufstellung): Exemplar[] {
  return [...auf.brett.map((b) => b.exemplar), ...auf.bank.filter((e): e is Exemplar => e !== null)];
}

/**
 * Brettliste sortieren: erst Reihe, dann Spalte.
 *
 * Jede Aenderung laeuft hierdurch, damit die Liste nie von der Reihenfolge
 * der Zuege abhaengt. Sonst haetten zwei Spieler mit derselben Aufstellung
 * verschiedene Zustaende — und die Kampfsimulation waere trotz gleicher Saat
 * nicht nachvollziehbar.
 */
function sortiert(brett: readonly Feldbesetzung[]): Feldbesetzung[] {
  return [...brett].sort((a, b) => (a.feld.r === b.feld.r ? a.feld.q - b.feld.q : a.feld.r - b.feld.r));
}

function mitBank(auf: Aufstellung, platz: number, exemplar: Exemplar | null): Aufstellung {
  const bank = [...auf.bank];
  bank[platz] = exemplar;
  return { brett: auf.brett, bank };
}

function pruefeBankplatz(auf: Aufstellung, platz: number): void {
  if (!Number.isInteger(platz) || platz < 0 || platz >= auf.bank.length) {
    throw new Error(`Bankplatz gibt es nicht: ${platz}`);
  }
}

function pruefeFeld(feld: Feld): void {
  if (!istAufBrett(feld)) throw new Error(`Feld gibt es nicht: ${feld.q},${feld.r}`);
}

// ---------------------------------------------------------------------------
// Bewegen
// ---------------------------------------------------------------------------

/**
 * Legt eine gekaufte Einheit auf die Bank und verschmilzt anschliessend.
 *
 * Verschmolzen wird hier und nicht beim Setzen, weil nur ein Zugang ein
 * Dreiergespann vollstaendig machen kann. Wer zwei Exemplare bereits stehen
 * hat und das dritte kauft, soll die Stufe 2 sofort sehen — und zwar dort,
 * wo die erste stand (siehe `verschmelzeAufstellung`).
 */
export function aufBank(auf: Aufstellung, exemplar: Exemplar): {
  aufstellung: Aufstellung;
  verschmelzungen: readonly Verschmelzung[];
} {
  const platz = ersterFreierBankplatz(auf);
  if (platz < 0) throw new Error('Bank ist voll');
  return verschmelzeAufstellung(mitBank(auf, platz, exemplar));
}

/** Nimmt eine Einheit von der Bank herunter — beim Verkaufen. */
export function vonBank(auf: Aufstellung, platz: number): { aufstellung: Aufstellung; exemplar: Exemplar } {
  pruefeBankplatz(auf, platz);
  const exemplar = auf.bank[platz];
  if (!exemplar) throw new Error(`Bankplatz ist leer: ${platz}`);
  return { aufstellung: mitBank(auf, platz, null), exemplar };
}

/** Nimmt eine Einheit vom Brett herunter — beim Verkaufen. */
export function vomBrett(auf: Aufstellung, feld: Feld): { aufstellung: Aufstellung; exemplar: Exemplar } {
  pruefeFeld(feld);
  const exemplar = aufFeld(auf, feld);
  if (!exemplar) throw new Error(`Feld ist leer: ${feld.q},${feld.r}`);
  return {
    aufstellung: { brett: auf.brett.filter((b) => !gleichesFeld(b.feld, feld)), bank: auf.bank },
    exemplar,
  };
}

/**
 * Setzt eine Einheit von der Bank auf ein Feld.
 *
 * Ist das Feld belegt, tauschen die beiden — das ist beim Ziehen und Ablegen
 * die einzige Bedeutung, die nicht ueberrascht: Man legt eine Einheit auf
 * eine andere, weil man sie dort haben will, nicht weil man sie loeschen
 * will. Die Platzgrenze greift dann bewusst NICHT, weil sich die Zahl der
 * Einheiten auf dem Brett gar nicht aendert.
 */
export function setzen(auf: Aufstellung, bankPlatz: number, feld: Feld, level: Level): Aufstellung {
  pruefeBankplatz(auf, bankPlatz);
  pruefeFeld(feld);
  const exemplar = auf.bank[bankPlatz];
  if (!exemplar) throw new Error(`Bankplatz ist leer: ${bankPlatz}`);

  const stehendes = aufFeld(auf, feld);
  if (!stehendes && anzahlAufBrett(auf) >= plaetzeFuerLevel(level)) {
    throw new Error(`Kein Platz auf dem Brett: Level ${level} erlaubt ${plaetzeFuerLevel(level)}`);
  }

  const brett = sortiert([
    ...auf.brett.filter((b) => !gleichesFeld(b.feld, feld)),
    { feld, exemplar },
  ]);
  return { brett, bank: mitBank(auf, bankPlatz, stehendes).bank };
}

/**
 * Nimmt eine Einheit vom Brett auf die Bank zurueck.
 *
 * Ohne Angabe geht sie auf den ersten freien Platz. Eine volle Bank ist ein
 * Fehler und kein stiller Verlust: Die Einheit einfach verschwinden zu
 * lassen, waere der teuerste Bedienfehler des Spiels.
 */
export function zuruecknehmen(auf: Aufstellung, feld: Feld, bankPlatz?: number): Aufstellung {
  const { aufstellung, exemplar } = vomBrett(auf, feld);
  const platz = bankPlatz ?? ersterFreierBankplatz(aufstellung);
  if (platz < 0) throw new Error('Bank ist voll');
  pruefeBankplatz(aufstellung, platz);
  if (aufstellung.bank[platz]) throw new Error(`Bankplatz ist belegt: ${platz}`);
  return mitBank(aufstellung, platz, exemplar);
}

/** Ein Ort, an dem eine Einheit stehen kann — auf dem Brett oder auf der Bank. */
export type Ort = { readonly typ: 'brett'; readonly feld: Feld } | { readonly typ: 'bank'; readonly platz: number };

function holen(auf: Aufstellung, ort: Ort): Exemplar | null {
  if (ort.typ === 'bank') {
    pruefeBankplatz(auf, ort.platz);
    return auf.bank[ort.platz];
  }
  pruefeFeld(ort.feld);
  return aufFeld(auf, ort.feld);
}

function legen(auf: Aufstellung, ort: Ort, exemplar: Exemplar | null): Aufstellung {
  if (ort.typ === 'bank') return mitBank(auf, ort.platz, exemplar);
  const ohne = auf.brett.filter((b) => !gleichesFeld(b.feld, ort.feld));
  return {
    brett: exemplar ? sortiert([...ohne, { feld: ort.feld, exemplar }]) : sortiert(ohne),
    bank: auf.bank,
  };
}

/**
 * Tauscht zwei Orte — Brett gegen Brett, Bank gegen Bank oder ueber Kreuz.
 *
 * Der allgemeine Fall hinter `setzen` und `zuruecknehmen`: Die Oberflaeche
 * zieht eine Einheit irgendwohin, und hier steht die eine Regel dafuer. Ist
 * einer der Orte leer, ist es ein Umzug; sind beide leer, passiert nichts.
 *
 * Die Platzgrenze wird nur geprueft, wenn die Zahl der Einheiten auf dem
 * Brett dabei WAECHST. Sonst liesse sich eine Aufstellung nach einem
 * Level-Verlust nicht mehr sortieren — den es zwar nicht gibt, aber die
 * Regel soll nicht davon abhaengen.
 */
export function tauschen(auf: Aufstellung, a: Ort, b: Ort, level: Level): Aufstellung {
  const eins = holen(auf, a);
  const zwei = holen(auf, b);
  if (!eins && !zwei) return auf;
  if (a.typ === 'brett' && b.typ === 'brett' && gleichesFeld(a.feld, b.feld)) return auf;
  if (a.typ === 'bank' && b.typ === 'bank' && a.platz === b.platz) return auf;

  // Wie viele Einheiten auf dem Brett dazukommen: An jedem Brett-Ort geht das
  // weg, was dort stand, und es kommt das her, was am anderen Ort stand.
  let wachstum = 0;
  if (a.typ === 'brett') wachstum += (zwei ? 1 : 0) - (eins ? 1 : 0);
  if (b.typ === 'brett') wachstum += (eins ? 1 : 0) - (zwei ? 1 : 0);
  if (wachstum > 0 && anzahlAufBrett(auf) + wachstum > plaetzeFuerLevel(level)) {
    throw new Error(`Kein Platz auf dem Brett: Level ${level} erlaubt ${plaetzeFuerLevel(level)}`);
  }

  return legen(legen(auf, a, zwei), b, eins);
}

// ---------------------------------------------------------------------------
// Verschmelzen ueber Bank UND Brett
// ---------------------------------------------------------------------------

/**
 * Verschmilzt alles, was zusammenpasst — egal, ob es auf der Bank liegt oder
 * auf dem Brett steht.
 *
 * Dass die Grenze zwischen Bank und Brett dabei nicht zaehlt, ist die Regel
 * aus dem Konzept: Zwei Nebelschleicher stehen im Kampf, der dritte kommt auf
 * die Bank — und sie werden trotzdem eine Stufe 2. Alles andere waere eine
 * Falle fuer den Spieler, der seine Einheiten schon aufgestellt hat.
 *
 * Hier steht eine eigene Schleife statt eines Aufrufs von `verschmelze()` aus
 * verschmelzen.ts, und das ist Absicht: Jene Funktion arbeitet auf einer
 * dichten Liste und schiebt beim Zusammenlegen alles Nachfolgende nach vorn.
 * Auf Plaetze angewandt wuerde sie die halbe Aufstellung verruecken. Die
 * Reihenfolge ist dieselbe (Brett vor Bank, jeweils in ihrer Ordnung), und
 * eine Probe vergleicht beide Wege ueber die Zaehlung.
 *
 * Brett VOR Bank, weil die entstandene Einheit an die Stelle der ersten der
 * drei tritt: So bleibt sie im Kampf stehen, statt auf die Bank zu wandern.
 */
export function verschmelzeAufstellung(auf: Aufstellung): {
  aufstellung: Aufstellung;
  verschmelzungen: readonly Verschmelzung[];
} {
  // Ein gemeinsames Feld ueber alle Plaetze: erst die belegten Brettfelder in
  // ihrer Ordnung, dann die Bank mit ihren Luecken.
  const brett = sortiert(auf.brett);
  const plaetze: (Exemplar | null)[] = [...brett.map((b) => b.exemplar), ...auf.bank];
  const verschmelzungen: Verschmelzung[] = [];

  let nochmal = true;
  while (nochmal) {
    nochmal = false;
    for (let stufe: Stufe = 1; stufe < HOECHSTE_STUFE; stufe = (stufe + 1) as Stufe) {
      const treffer = ersteDreier(plaetze, stufe);
      if (!treffer) continue;

      const [erstes, zweites, drittes] = treffer;
      const einheitId = (plaetze[erstes] as Exemplar).einheitId;
      const ziel = (stufe + 1) as Stufe;

      plaetze[erstes] = { einheitId, stufe: ziel };
      plaetze[zweites] = null;
      plaetze[drittes] = null;

      verschmelzungen.push({ einheitId, vonStufe: stufe, nachStufe: ziel });
      nochmal = true;
      break; // Neu suchen: Der Schritt kann die naechste Stufe voll gemacht haben.
    }
  }

  const neuesBrett: Feldbesetzung[] = [];
  for (let i = 0; i < brett.length; i++) {
    const exemplar = plaetze[i];
    if (exemplar) neuesBrett.push({ feld: brett[i].feld, exemplar });
  }
  const neueBank = plaetze.slice(brett.length);

  return { aufstellung: { brett: neuesBrett, bank: neueBank }, verschmelzungen };
}

/**
 * Die Plaetze der ersten drei gleichen Exemplare dieser Stufe, oder null.
 *
 * Gemeint ist die Einheit, deren drittes Exemplar am fruehesten steht — wie
 * in verschmelzen.ts, damit beide Wege dieselbe Reihenfolge haben.
 */
function ersteDreier(
  plaetze: readonly (Exemplar | null)[],
  stufe: Stufe,
): [number, number, number] | null {
  const gesehen = new Map<EinheitId, number[]>();
  for (let i = 0; i < plaetze.length; i++) {
    const e = plaetze[i];
    if (!e || e.stufe !== stufe) continue;
    const stellen = gesehen.get(e.einheitId) ?? [];
    stellen.push(i);
    if (stellen.length === JE_VERSCHMELZUNG) return [stellen[0], stellen[1], stellen[2]];
    gesehen.set(e.einheitId, stellen);
  }
  return null;
}
