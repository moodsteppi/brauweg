/**
 * Zutaten, Zustände und Rezepte von BroCooked.
 *
 * Daten, keine Rechnung: Was eine Zutat durchmacht, steht in `kueche.ts`.
 * Alle Zeiten sind **Takte**, nie Sekunden — eine Sekunde ist eine Wanduhr,
 * und die geht auf zwei Geräten verschieden (docs/SPEZIFIKATION-BROCOOKED.md,
 * Abschnitt 6).
 */

export type Zutat =
  | 'tomate'
  | 'zwiebel'
  | 'salat'
  | 'fleisch'
  | 'fisch'
  | 'reis'
  | 'teig'
  | 'kaese'
  | 'kartoffel';

export type Zustand = 'roh' | 'geschnitten' | 'gart' | 'gar' | 'verkohlt';

/** Stationen, an denen gegart wird — ein Rezept nennt eine davon oder keine. */
export type Garstation = 'topf' | 'pfanne' | 'fritteuse';

export interface Rezept {
  readonly id: string;
  /** Was auf dem Teller liegen muss. Reihenfolge egal, Menge nicht. */
  readonly braucht: readonly Zutat[];
  /** Was davon gegart wird; der Rest kommt geschnitten auf den Teller. */
  readonly garen: readonly Zutat[];
  readonly station: Garstation | null;
  readonly punkte: number;
  /** Lebensdauer des Tickets in Takten. 900 Takte sind 45 Sekunden. */
  readonly frist: number;
}

export const REZEPTE: readonly Rezept[] = [
  {
    id: 'salat',
    braucht: ['salat', 'tomate'],
    garen: [],
    station: null,
    punkte: 20,
    frist: 900,
  },
  {
    id: 'salat-gross',
    braucht: ['salat', 'tomate', 'zwiebel'],
    garen: [],
    station: null,
    punkte: 28,
    frist: 1000,
  },
  {
    id: 'suppe',
    braucht: ['zwiebel', 'kartoffel'],
    garen: ['zwiebel', 'kartoffel'],
    station: 'topf',
    punkte: 30,
    frist: 1100,
  },
  {
    id: 'burger',
    braucht: ['teig', 'fleisch', 'salat'],
    garen: ['fleisch'],
    station: 'pfanne',
    punkte: 34,
    frist: 1200,
  },
  {
    id: 'sushi',
    braucht: ['reis', 'fisch'],
    garen: ['reis'],
    station: 'topf',
    punkte: 32,
    frist: 1100,
  },
  {
    id: 'pommes',
    braucht: ['kartoffel', 'kaese'],
    garen: ['kartoffel'],
    station: 'fritteuse',
    punkte: 26,
    frist: 1000,
  },
];

/*
 * Namen stehen hier keine: Gerichte, Zutaten, Zustände und das „im Topf"
 * kommen aus dem Wörterbuch (`text.ts`, Bereich `brocooked`). Die Kennungen
 * bleiben klein und ohne Umlaut, weil sie auch in Gittern und Schlüsseln
 * stehen.
 */

export function rezept(id: string): Rezept {
  const r = REZEPTE.find((x) => x.id === id);
  if (!r) throw new Error(`Unbekanntes Rezept: ${id}`);
  return r;
}

/**
 * Wie eine Zutat für dieses Rezept auf den Teller gehört: gegart oder
 * geschnitten. Nichts kommt roh auf einen Teller — das ist die eine Regel,
 * die die ganze Küchenarbeit erzeugt.
 */
export function sollZustand(r: Rezept, zutat: Zutat): Zustand {
  return r.garen.includes(zutat) ? 'gar' : 'geschnitten';
}

/**
 * Was ein Rezept verlangt, Stück für Stück — in der Reihenfolge, in der es
 * im Rezept steht.
 *
 * Genau diese Liste steht auf dem Ticket. Vorher stand dort nur der Name:
 * „Burger" sagt niemandem, dass er Teig, gebratenes Fleisch und Salat
 * braucht, und wer das Spiel zum ersten Mal öffnet, läuft raten.
 */
export function stuecke(r: Rezept): TellerStueck[] {
  return r.braucht.map((zutat) => ({ zutat, zustand: sollZustand(r, zutat) }));
}

/** Ein Stück auf dem Teller: die Zutat UND wie sie zubereitet ist. */
export interface TellerStueck {
  readonly zutat: Zutat;
  readonly zustand: Zustand;
}

/**
 * Passt der Tellerinhalt zu diesem Rezept? Verglichen wird als MENGE mit
 * Vielfachheit, nicht als Liste: Die Reihenfolge, in der jemand anrichtet,
 * ist seine Sache.
 *
 * Der Zustand zählt mit. Ohne ihn ginge ein Teller mit rohem Fleisch als
 * Burger durch — und das Schneiden und Braten, also das ganze Spiel, wäre
 * eine Zierde.
 */
export function passt(r: Rezept, inhalt: readonly TellerStueck[]): boolean {
  if (inhalt.length !== r.braucht.length) return false;
  const rest = [...r.braucht];
  for (const stueck of inhalt) {
    const i = rest.findIndex((z) => z === stueck.zutat && sollZustand(r, z) === stueck.zustand);
    if (i < 0) return false;
    rest.splice(i, 1);
  }
  return rest.length === 0;
}
