/**
 * Das Blatt von DreckBro und der Zufall, mit dem es gemischt wird.
 *
 * Ein eigenes Spiel, keine Abschrift: Pinguine statt Schweine war der
 * Auftrag, und die Karten sind dafuer neu gedacht. Der Kern ist die
 * zweistufige Verschmutzung (sauber → fleckig → DreckBro) — eine Pfuetze
 * macht nie fertig, sie macht nur dreckiger, und ein Schneeball nimmt auch
 * nur eine Stufe. Dazu zwei Karten, die es so nirgends gibt: die
 * Schlammrutsche (alle eigenen sauberen Pinguine auf einmal) und der
 * Robbenklau (Pinguine tauschen).
 */

export const KARTEN_ARTEN = [
  'pfuetze',
  'schlammrutsche',
  'schneeball',
  'eisregen',
  'iglu',
  'tauwetter',
  'robbenklau',
] as const;

export type KartenArt = (typeof KARTEN_ARTEN)[number];

export interface Karte {
  /** Fortlaufend im Blatt; daran erkennt der Bildschirm eine Handkarte wieder. */
  readonly id: number;
  readonly art: KartenArt;
}

/**
 * Wie oft jede Karte im Blatt steckt (54 zusammen).
 *
 * Die Pfuetze ist mit Abstand die haeufigste: Drei Pinguine zu je zwei
 * Stufen sind sechs Pfuetzen, und wer keine zieht, kommt nicht voran.
 * Angriffe (Schneeball, Eisregen) halten sich ungefaehr die Waage mit dem
 * Schutz (Iglu), damit eine Partie mit fuenf Spielern nicht endlos wird.
 */
export const ANZAHL: Readonly<Record<KartenArt, number>> = {
  pfuetze: 24,
  schlammrutsche: 4,
  schneeball: 10,
  eisregen: 3,
  iglu: 7,
  tauwetter: 3,
  robbenklau: 3,
};

export function erstelleBlatt(): Karte[] {
  const blatt: Karte[] = [];
  for (const art of KARTEN_ARTEN) {
    for (let i = 0; i < ANZAHL[art]; i++) blatt.push({ id: blatt.length, art });
  }
  return blatt;
}

/**
 * cyrb128: macht aus einem beliebigen Text vier 32-Bit-Woerter.
 *
 * Der Zufall wird nicht im Zustand mitgefuehrt, sondern bei jedem Mischen
 * aus Saat und Mischnummer neu abgeleitet — so bleibt die Partie reines
 * JSON, und dasselbe Saatkorn mischt den Ablagestapel beim dritten Mal
 * anders als beim ersten.
 */
function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** sfc32: 128 Bit Zustand, damit ein Geben nicht durchprobierbar ist. */
function sfc32([a, b, c, d]: [number, number, number, number]): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function zufall(saat: string, nummer: number): () => number {
  return sfc32(cyrb128(`${saat}:${nummer}`));
}

export function mische<T>(liste: readonly T[], rng: () => number): T[] {
  const aus = [...liste];
  for (let i = aus.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [aus[i], aus[j]] = [aus[j]!, aus[i]!];
  }
  return aus;
}
