/**
 * Die Farben von BroCooked — an EINER Stelle, weil sie an mehreren gebraucht
 * werden: auf der Leinwand (`zeichnen.ts`), in den Tickets über der Küche und
 * später im Banner der Spielauswahl. Dieselbe Bauart wie
 * minispiele/filler/farben.ts und minispiele/eiland/farben.ts.
 *
 * **Warum hier nur Farben stehen und keine Formen.** Die Bilder sind bestellt,
 * aber nicht geliefert (docs/ASSETS-BROCOOKED.md). Bis dahin malt der Zeichner
 * Flächen, und diese Flächen sind das ganze Aussehen des Spiels: Wer eine
 * Zutat nicht an der Farbe erkennt, erkennt sie gar nicht. Deshalb sind die
 * Zutaten bewusst über den Farbkreis verteilt statt „alles Gemüse grünlich" —
 * Salat und Zwiebel nebeneinander auf einem Teller müssen sich auf einem
 * 24-Pixel-Ticket noch unterscheiden.
 */

import { dunkler, farbeAus, heller, mische } from '../golf/farben';
import type { StationsArt } from './kueche';
import type { Zustand, Zutat } from './rezepte';

/*
 * Die Sitzfarben kommen aus der Golf-Tabelle und werden hier NICHT neu
 * erfunden. Sie ist die einzige Sitzfarbtabelle, die der Client hat (sechzehn
 * Werte, `farbeAus`), und sie färbt dort schon Bälle, Chips und Lobby-Namen.
 * Zwei Tabellen hießen: Der Koch, der in der Lobby rot ist, wäre in der Küche
 * orange — und niemand fände den Grund, weil beide Dateien für sich stimmen.
 * BroCooked hat höchstens vier Sitze und braucht deshalb nur die ersten vier.
 */
export { dunkler, heller, mische };

/** Mehr Köche gibt es nicht (vier Startplätze `a`…`d` je Küche, siehe kuechen.ts). */
export const SITZE_MAX = 4;

/** Die vier Kochfarben, in Sitzreihenfolge — rot, blau, grün, gelb. */
export const SITZ_FARBEN: readonly string[] = [0, 1, 2, 3].map((sitz) => farbeAus(sitz));

/**
 * Farbe eines Kochs. Der Rest-Operator ist da, weil ein `undefined` im
 * `fillStyle` nicht abstürzt, sondern still schwarz malt — und ein schwarzer
 * Koch auf dunklem Boden ist einfach weg.
 */
export function sitzfarbe(sitz: number): string {
  const nr = Math.trunc(sitz);
  return SITZ_FARBEN[((nr % SITZE_MAX) + SITZE_MAX) % SITZE_MAX] ?? SITZ_FARBEN[0];
}

/* --------------------------------------------------------------------------
 * Der Raum: Boden, Theke, Wand
 * ----------------------------------------------------------------------- */

/**
 * Die Farben des Raums, einmal hell und einmal dunkel.
 *
 * Zwei Sätze statt eines mit Filter darüber: Ein pauschal abgedunkeltes Bild
 * verliert genau das, was in der Hektik zählt — der Unterschied zwischen
 * Boden (darf man betreten) und Theke (darf man nicht) muss in beiden
 * Stimmungen gleich deutlich sein, und ein Schleier drückt beide zusammen.
 */
export interface Raumfarben {
  /** Alles außerhalb der Küche — der Rand der Leinwand. */
  hintergrund: string;
  boden: string;
  /** Die zweite Bodenfarbe des Schachbretts; sie gibt dem Laufen ein Tempo. */
  bodenHell: string;
  bodenFuge: string;
  wand: string;
  wandKante: string;
  theke: string;
  thekeKante: string;
  /** Kürzel auf den Stationen. */
  schrift: string;
  umriss: string;
  schatten: string;
}

export const RAUM_HELL: Raumfarben = {
  hintergrund: '#1d232b',
  boden: '#d9cbb3',
  bodenHell: '#e6dac6',
  bodenFuge: 'rgba(90, 70, 45, 0.16)',
  wand: '#6f5b45',
  wandKante: '#8a7156',
  theke: '#b9a181',
  thekeKante: '#d2bda1',
  schrift: '#2b2118',
  umriss: 'rgba(40, 28, 16, 0.55)',
  schatten: 'rgba(30, 20, 10, 0.28)',
};

export const RAUM_DUNKEL: Raumfarben = {
  hintergrund: '#0d1116',
  boden: '#4a4436',
  bodenHell: '#565040',
  bodenFuge: 'rgba(0, 0, 0, 0.3)',
  wand: '#2e2823',
  wandKante: '#453c33',
  theke: '#5c4f3e',
  thekeKante: '#776650',
  schrift: '#f2e9dc',
  umriss: 'rgba(0, 0, 0, 0.6)',
  schatten: 'rgba(0, 0, 0, 0.42)',
};

export function raumfarben(dunkel: boolean): Raumfarben {
  return dunkel ? RAUM_DUNKEL : RAUM_HELL;
}

/* --------------------------------------------------------------------------
 * Stationen
 * ----------------------------------------------------------------------- */

/**
 * Je Stationsart eine Farbe.
 *
 * Die drei Garstationen (Topf, Pfanne, Fritteuse) sind absichtlich alle
 * metallisch-kühl und unterscheiden sich nur im Ton: Sie tun dasselbe, und ein
 * Rezept nennt genau eine von ihnen. Wären sie drei Buntfarben, suchte man in
 * der Hektik nach der Farbe statt nach dem Gerät.
 */
export const STATION_FARBEN: Readonly<Record<StationsArt, string>> = {
  ablage: '#b9a181',
  kiste: '#8a6a45',
  brett: '#cba468',
  topf: '#5c6b78',
  pfanne: '#3f4650',
  fritteuse: '#77683c',
  tellerstapel: '#e7e4dc',
  spuele: '#86a5b6',
  durchreiche: '#d8b25a',
  tonne: '#55594f',
};

export function stationFarbe(art: StationsArt): string {
  return STATION_FARBEN[art] ?? STATION_FARBEN.ablage;
}

/* --------------------------------------------------------------------------
 * Zutaten
 * ----------------------------------------------------------------------- */

/**
 * Je Zutat eine Farbe — weit auseinander im Farbkreis, siehe Dateikopf.
 *
 * Reis und Käse sind das engste Paar (beide hell); sie kommen in keinem
 * Rezept zusammen vor, also stehen sie nie nebeneinander auf einem Teller.
 */
export const ZUTAT_FARBEN: Readonly<Record<Zutat, string>> = {
  tomate: '#e0453a',
  zwiebel: '#c9a9d8',
  salat: '#5fb04a',
  fleisch: '#a2504a',
  fisch: '#7fb7d4',
  reis: '#f4f0e2',
  teig: '#d9a760',
  kaese: '#f2c14e',
  kartoffel: '#b98a4a',
};

export function zutatFarbe(zutat: Zutat): string {
  return ZUTAT_FARBEN[zutat] ?? '#cccccc';
}

/**
 * Die Farbe einer Zutat IM Zustand: roh blass, gegart satt, verkohlt dunkel.
 *
 * Gerechnet statt als zweite Tabelle gepflegt (36 Felder von Hand wären beim
 * ersten Farbwechsel auseinander), und bewusst nur über Helligkeit: Die Zutat
 * soll ihre Farbe behalten — ein Fleisch, das gar plötzlich braun wäre, sähe
 * aus wie eine andere Zutat.
 */
export function zustandFarbe(zutat: Zutat, zustand: Zustand): string {
  const grund = zutatFarbe(zutat);
  switch (zustand) {
    case 'roh':
      return mische(grund, '#ffffff', 0.42);
    case 'geschnitten':
      return grund;
    case 'gart':
      // Was gerade gart, zieht zum Feuer hin — der Blick von der anderen Seite
      // der Küche soll „da passiert etwas" sagen, ohne die Zutat zu verlieren.
      return mische(grund, FEUER, 0.22);
    case 'gar':
      return mische(grund, '#8a3a12', 0.28);
    case 'verkohlt':
      return '#2f2a26';
  }
}

/* --------------------------------------------------------------------------
 * Feuer, Fortschritt, Teller
 * ----------------------------------------------------------------------- */

export const FEUER = '#ff7a1a';
export const FEUER_KERN = '#ffe07a';
export const FEUER_SCHEIN = 'rgba(255, 122, 26, 0.35)';
export const RAUCH = 'rgba(60, 55, 50, 0.45)';

/** Der laufende Balken/Ring an einer Station und über einem werkenden Koch. */
export const FORTSCHRITT = '#4ad07a';
export const FORTSCHRITT_GRUND = 'rgba(0, 0, 0, 0.35)';
/** Löschen läuft gegen die Uhr und bekommt deshalb nicht dieselbe Farbe wie Kochen. */
export const FORTSCHRITT_LOESCHEN = '#63c6ff';

export const TELLER = '#f6f4ee';
export const TELLER_RAND = '#c9c4b6';
export const TELLER_SCHMUTZIG = '#a8a48d';
