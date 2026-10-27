/**
 * Die Sicht der drei Minispiele ohne Uhr (Kategorien-Battle, Mehrheitsraten,
 * Regel-Karte), wie der Client sie liest — seit dem 22.09.2026.
 *
 * Spiegelbild von packages/game-partykiste/src/sicht.ts; der Vertrag unter
 * `src/vertrag/partykiste.test.ts` haelt beide deckungsgleich. Eigene Datei,
 * damit `sicht.ts` nur die Einhaengezeilen bekommt — sie wird gleichzeitig
 * von anderen Aenderungen angefasst.
 */

export interface KategorienSicht {
  art: 'kategorien';
  kategorie: string;
  amZug: number;
  nennungen: number;
  /** Ab so vielen Nennungen ist die Kategorie leergespielt. */
  grenze: number;
  /** Wer zuletzt genannt hat — gegen ihn geht noch Einspruch. -1 = noch keiner. */
  letzter: number;
  /** Je Sitz: gegen wen er Einspruch erhebt, -1 = niemanden. */
  einspruch: number[];
  /** Je Sitz: wie viele Einsprueche es braucht (0 = geht nicht). */
  noetig: number[];
  verlierer: number;
  wie: 'selbst' | 'mehrheit' | null;
}

export interface MehrheitSicht {
  art: 'mehrheit';
  frage: string;
  a: string;
  b: string;
  meine: number;
  meinTipp: number;
  gewaehlt: number[];
  /** Erst im Ergebnis. */
  eigene: number[] | null;
  tipp: number[] | null;
  /** Erst im Ergebnis: 0 A, 1 B, -1 Gleichstand. */
  mehrheit: number | null;
}

export interface RegelkartenSicht {
  art: 'regelkarte';
  text: string;
  /** Bis zum Ende welcher Runde (0-basiert) die Regel gelten wird. */
  bis: number;
}

/** Die geltende Regel-Karte — in jeder Sicht, auch waehrend anderer Minispiele. */
export interface RegelKarteSicht {
  text: string;
  ab: number;
  bis: number;
  verstoesse: number[];
  /** Je Sitz: wen er gerade anklagt, -1 = niemanden. */
  anklage: number[];
  /** Je Sitz: wie viele Anklagen es braucht (0 = geht nicht). */
  noetig: number[];
  meldenMoeglich: boolean;
}

/** Die Aktionen der drei. `verstoss` geht in jeder Runde, solange eine Regel gilt. */
export type OhneUhrAktion =
  | { art: 'genannt' }
  | { art: 'gestockt' }
  | { art: 'einspruch'; ziel: number }
  | { art: 'mehrheitstipp'; eigene: number; tipp: number }
  | { art: 'verstoss'; ziel: number };
