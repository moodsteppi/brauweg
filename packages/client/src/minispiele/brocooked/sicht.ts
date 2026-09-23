/**
 * Die Modulsicht von BroCooked, ein zweites Mal beschrieben.
 *
 * Der Client importiert nichts aus dem Spielpaket (CLAUDE.md, „Wie der Code
 * gebaut ist"); er beschreibt die Sicht selbst. Dass beide Beschreibungen
 * zusammenpassen, hält `src/vertrag/brocooked.test.ts` fest — beim Übersetzen
 * und in einer wirklich gespielten Partie.
 *
 * Diese Datei liegt bewusst NICHT in der `.tsx`: Ein Vertrag, der aus einem
 * Bildschirm importiert, zieht React in den Test.
 */

export type BroCookedEingabe =
  | { readonly takt: number; readonly nr: number; readonly art: 'richtung'; readonly dx: number; readonly dy: number }
  | { readonly takt: number; readonly nr: number; readonly art: 'greifen' }
  | { readonly takt: number; readonly nr: number; readonly art: 'werken'; readonly an: boolean }
  | { readonly takt: number; readonly nr: number; readonly art: 'spurt' };

export interface BroCookedAusstieg {
  readonly sitz: number;
  readonly abEingabe: number;
}

export interface BroCookedMeldung {
  readonly punkte: number;
  readonly sterne: readonly number[];
  readonly pruef: string;
}

export interface BroCookedAusgang {
  readonly punkte: number;
  readonly sterne: readonly number[];
  readonly strittig: boolean;
}

export interface BroCookedSicht {
  readonly saat: number;
  readonly sitze: number;
  readonly runden: number;
  readonly kuechen: readonly string[];
  readonly rundeTakte: number;
  readonly botSitze: readonly number[];
  readonly botStufe: string;
  /** Nur der Zuwachs seit `abIndex` — die ganze Liste hält das Gerät selbst. */
  readonly eingaben: readonly (BroCookedEingabe & { readonly sitz: number })[];
  readonly abIndex: number;
  readonly ausstiege: readonly BroCookedAusstieg[];
  readonly meldungen: Readonly<Record<number, BroCookedMeldung>>;
  readonly ausgang: BroCookedAusgang | null;
  readonly taktMs: number;
  readonly vorlauf: number;
}

/** Was das Gerät an den Server schickt. */
export type BroCookedAktion =
  | { readonly art: 'eingabe'; readonly eingabe: BroCookedEingabe }
  | { readonly art: 'ergebnis'; readonly meldung: BroCookedMeldung }
  | { readonly art: 'nichts' };
