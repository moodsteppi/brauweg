/**
 * Die Küchen als Daten — Gitter, erlaubte Rezepte, Sternschwellen.
 *
 * Eine Küche ist ein Textgitter, kein Code: Eine neue Küche ist ein Eintrag
 * in dieser Datei und ändert an der Rechnung (`kueche.ts`) nichts. Der Preis
 * dafür ist die Zeichentabelle — sie steht einmal hier und nirgends sonst.
 *
 * ```
 * .   Boden (begehbar)        #   Wand
 * =   Theke (Ablage)          T   Tellerstapel
 * S   Spüle                   D   Durchreiche
 * B   Schneidebrett           P   Topf
 * F   Pfanne                  G   Fritteuse
 * X   Tonne
 * 1…9 Kiste mit der Zutat aus `kisten`
 * a…d Startplatz Koch 1…4 (zählt als Boden)
 * ```
 *
 * Alles, was kein Boden und kein Startplatz ist, blockiert — Theken sind
 * Wände, über die man reicht. Jede Station muss von einem Bodenfeld aus
 * erreichbar sein, und der Rand muss geschlossen sein; beides prüft
 * `kuechen.test.ts` für jede Küche. Ein Koch, der aus dem Bild läuft, ist
 * genau der Fehler, den ein hübsch aussehendes Gitter sonst versteckt.
 *
 * Schmutziges Geschirr geht nicht über eine eigene Rückgabe: Ein servierter
 * Teller landet unmittelbar in der Spüle. Eine Station weniger, ein Weg
 * weniger — und die Spüle ist der Engpass, der das Spiel spannend macht.
 */

import type { Zutat } from './rezepte';

export interface Kuechenplan {
  readonly id: string;
  readonly name: string;
  /** Zeilen gleicher Länge. */
  readonly gitter: readonly string[];
  /** Zeichen `1`…`9` → Zutat der Kiste. */
  readonly kisten: Readonly<Record<string, Zutat>>;
  readonly rezepte: readonly string[];
  /** Punkte für einen, zwei, drei Sterne. */
  readonly schwellen: readonly [number, number, number];
  /** Saubere Teller zu Beginn. */
  readonly teller: number;
}

export const KUECHEN: readonly Kuechenplan[] = [
  {
    id: 'wiese',
    name: 'Gartenküche',
    gitter: [
      '###############',
      '#T===B===B===D#',
      '#.a...........#',
      '#.............#',
      '#..b.......c..#',
      '#.............#',
      '#1===2===3===S#',
      '###############',
    ],
    kisten: { '1': 'salat', '2': 'tomate', '3': 'zwiebel' },
    rezepte: ['salat', 'salat-gross'],
    schwellen: [60, 120, 180],
    teller: 4,
  },
  {
    id: 'kantine',
    name: 'Werkskantine',
    gitter: [
      '#################',
      '#T==B==P==P==B=D#',
      '#...............#',
      '#.a...........b.#',
      '#...............#',
      '#..c.........d..#',
      '#1==2==4==5==X=S#',
      '#################',
    ],
    kisten: { '1': 'zwiebel', '2': 'kartoffel', '4': 'reis', '5': 'fisch' },
    rezepte: ['suppe', 'sushi'],
    schwellen: [80, 150, 220],
    teller: 4,
  },
  {
    id: 'insel',
    name: 'Inselküche',
    gitter: [
      '#################',
      '#T==B==D==B==X=S#',
      '#...............#',
      '#.a...........b.#',
      '#....=F=P=P=....#',
      '#..c.........d..#',
      '#1==2==6==7==3=B#',
      '#################',
    ],
    kisten: { '1': 'salat', '2': 'tomate', '3': 'zwiebel', '6': 'teig', '7': 'fleisch' },
    rezepte: ['burger', 'salat-gross'],
    schwellen: [90, 170, 250],
    teller: 3,
  },
  {
    id: 'brandwache',
    name: 'Brandwache',
    gitter: [
      '#################',
      '#T==G==F==B==B=D#',
      '#...............#',
      '#.a...........b.#',
      '#......=X=......#',
      '#..c.........d..#',
      '#2==8==6==7==9=S#',
      '#################',
    ],
    kisten: { '2': 'kartoffel', '6': 'teig', '7': 'fleisch', '8': 'kaese', '9': 'salat' },
    rezepte: ['pommes', 'burger'],
    schwellen: [90, 160, 240],
    teller: 3,
  },
];

export function kuechenplan(id: string): Kuechenplan {
  // Eine unbekannte Kennung ist kein Grund, den Tisch unspielbar zu machen
  // (siehe Modulkopf `regeln.ts`): Dann eben die erste Küche.
  return KUECHEN.find((k) => k.id === id) ?? KUECHEN[0];
}
