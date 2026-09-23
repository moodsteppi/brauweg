/**
 * Regelsatz und Eingabeform von BroCooked.
 *
 * Hier steht nur, was ALLE Geraete gleich brauchen: die Kuechen einer Partie,
 * das Taktmass und die Form einer Eingabe. Was eine Eingabe in der Kueche
 * bewirkt, weiss dieses Paket ausdruecklich nicht — das rechnet das Geraet
 * (`packages/client/src/minispiele/brocooked/kueche.ts`), genau wie bei Golf
 * die Ballphysik. Der Grund steht in docs/SPEZIFIKATION-BROCOOKED.md,
 * Abschnitt 3: Zustandsfunk waere eine zweite Wahrheit ueber dieselbe Partie.
 */

/** Millisekunden je Takt. 20 Takte je Sekunde reichen fuer Laufwege und Timer. */
export const TAKT_MS = 50;

/**
 * So viele Takte laufen vor dem Anpfiff leer durch ("3 - 2 - 1 - los").
 *
 * Sie sind kein Schmuck: Ein Geraet, das der Tischrunde zwei Takte voraus
 * ist, wuerde sonst mit einer halben Sekunde Kuechenarbeit starten, die
 * niemand gesehen hat.
 */
export const VORLAUF_TAKTE = 60;

/** Wie lange eine Runde dauert (Takte). 2400 Takte sind zwei Minuten. */
export const RUNDE_TAKTE = 2400;

/**
 * Stillstandsgrenze der Plattform. Ohne Zugfolge kennt sie sonst keinen
 * Grund, einen Tisch je abzuschliessen — dieselbe Rolle wie bei Golf.
 */
export const STILLSTAND_MS = 4 * 60_000;

export const SITZE: readonly number[] = [1, 2, 3, 4];

export const RUNDEN_MIN = 1;
export const RUNDEN_MAX = 6;

/**
 * Die Kuechen, die es gibt. Die Kennung ist der Vertrag zwischen Modul und
 * Geraet: Das Modul haelt sie nur fest, gebaut wird die Kueche aus der
 * gleichnamigen Datei unter `minispiele/brocooked/kuechen.ts`.
 */
export const KUECHEN: readonly string[] = ['wiese', 'kantine', 'insel', 'brandwache'];

export interface BroCookedRegeln {
  /**
   * Kuechen der Partie, in dieser Reihenfolge gespielt. Kuerzer als die
   * Rundenzahl ist erlaubt — dann geht es von vorn los.
   */
  readonly kuechen: readonly string[];
  /** Takte je Runde. */
  readonly rundeTakte: number;
}

export const DEFAULT_REGELN: BroCookedRegeln = {
  kuechen: KUECHEN,
  rundeTakte: RUNDE_TAKTE,
};

/**
 * Eine Eingabe eines Sitzes, mit dem Takt, zu dem sie gilt.
 *
 * `richtung` ist ein auf vier Nachkommastellen gerundeter Einheitsvektor oder
 * (0,0) fuer Stillstand — Winkel waeren hier ein Determinismus-Leck, weil
 * `Math.atan2` zwischen Safari und V8 in der letzten Stelle abweichen kann.
 * `werken` traegt Anfang und Ende (`an`), damit aus zwei Eingaben eine
 * gehaltene Taste wird; `greifen` und `spurt` sind Augenblicke.
 */
export type Eingabe =
  | { readonly takt: number; readonly nr: number; readonly art: 'richtung'; readonly dx: number; readonly dy: number }
  | { readonly takt: number; readonly nr: number; readonly art: 'greifen' }
  | { readonly takt: number; readonly nr: number; readonly art: 'werken'; readonly an: boolean }
  | { readonly takt: number; readonly nr: number; readonly art: 'spurt' };

/** Was ein Sitz am Ende einer Partie meldet. */
export interface ErgebnisMeldung {
  /** Punkte der ganzen Kueche — BroCooked ist ein Miteinander, kein Gegeneinander. */
  readonly punkte: number;
  /** Sterne je Runde, in Rundenreihenfolge. */
  readonly sterne: readonly number[];
  /** Pruefsumme der Partie; unterschiedliche Summen heissen: Geraete liefen auseinander. */
  readonly pruef: string;
}

export type BroCookedAktion =
  | { readonly art: 'eingabe'; readonly eingabe: Eingabe }
  | { readonly art: 'ergebnis'; readonly meldung: ErgebnisMeldung }
  | { readonly art: 'nichts' };

/** Geberrotation gibt es nicht: In jeder Runde kochen alle gleichzeitig. */
export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): number[] {
  return Array.from({ length: RUNDEN_MAX - RUNDEN_MIN + 1 }, (_, i) => RUNDEN_MIN + i);
}

/**
 * Formpruefung des Regelsatzes. Sie sagt NICHT, ob eine Kueche spielbar ist —
 * das weiss nur das Geraet. Eine unbekannte Kennung faellt dort auf die erste
 * Kueche zurueck, statt den Tisch unspielbar zu machen.
 */
export function pruefeRegeln(regeln: BroCookedRegeln): string[] {
  const fehler: string[] = [];
  if (!Array.isArray(regeln.kuechen) || regeln.kuechen.length === 0) {
    fehler.push('kuechenLeer');
  } else if (regeln.kuechen.some((k) => typeof k !== 'string' || k.length === 0)) {
    fehler.push('kuecheUngueltig');
  }
  if (!Number.isInteger(regeln.rundeTakte) || regeln.rundeTakte < 200 || regeln.rundeTakte > 12_000) {
    fehler.push('rundeTakteUngueltig');
  }
  return fehler;
}

/** Welche Kueche in Runde `runde` (0-basiert) gespielt wird. */
export function kuecheFuerRunde(regeln: BroCookedRegeln, runde: number): string {
  const liste = regeln.kuechen.length > 0 ? regeln.kuechen : KUECHEN;
  return liste[runde % liste.length];
}
