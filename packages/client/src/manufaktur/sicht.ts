/**
 * Die Kartenmanufaktur, wie der Client sie vom Server bekommt
 * (packages/server/src/manufaktur/regeln.ts, `ansicht`). Zweitbeschreibung
 * wie bei den Spielsichten: Der Client importiert nichts aus dem Server und
 * rechnet keine Regel nach — Raten und Kosten kommen fertig.
 */

export interface StationAnsicht {
  stufe: number;
  maxStufe: number;
  meister: boolean;
  aktiv: boolean;
  /** Ende der laufenden Schicht (ms), ohne Meister. */
  schichtBis: number | null;
  rate: number;
  rateNaechste: number;
  ausbauKosten: number | null;
  meisterKosten: number | null;
}

export interface ManufakturAnsicht {
  manufaktur: number;
  maxManufaktur: number;
  taler: number;
  verdient: number;
  lager: number;
  pressen: (StationAnsicht & { ablage: number })[];
  laufband: StationAnsicht;
  versand: StationAnsicht;
  freischaltKosten: number | null;
  umzugAb: number;
  kannUmziehen: boolean;
  proSekunde: { taler: number; lager: number; ablagen: number[] };
  engpass: 'pressen' | 'laufband' | 'versand' | null;
  /** Server-Zeit (ms), zu der die Zahlen gelten. */
  zeit: number;
}

export interface ManufakturAntwort {
  ansicht: ManufakturAnsicht;
  offline: { sekunden: number; taler: number } | null;
  muenzen: number;
}

export type Ziel = { art: 'presse'; index: number } | { art: 'laufband' } | { art: 'versand' };

export type ManufakturAktion =
  | { typ: 'ausbauen'; ziel: Ziel }
  | { typ: 'meister'; ziel: Ziel }
  | { typ: 'schicht'; ziel: Ziel }
  | { typ: 'freischalten' }
  | { typ: 'umziehen' };
