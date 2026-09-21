/**
 * Der Zufall dieses Moduls.
 *
 * Derselbe Generator wie in den anderen Spielpaketen, und aus demselben Grund
 * noch einmal hier: Ein Spielmodul ist eine eigenstaendige Bibliothek. Laege
 * er gemeinsam, aenderte eine Verbesserung dort jede gespeicherte Partie
 * jedes Spiels.
 *
 * Wichtiger als der Generator ist die REGEL, wie er benutzt wird: Jede
 * Zufallsentscheidung haengt an einer Saatzeichenkette aus Saatkorn, Runde und
 * Zweck — nie an einem Generatorzustand, der im Snapshot mitreisen muesste.
 * Wer einen Snapshot der Runde 4 hat, zieht dieselbe Frage wie der Server,
 * auch wenn die Partie inzwischen anders gelaufen ist.
 */

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
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

/**
 * Eine beliebige Zeichenkette zu 32 Hexstellen verruehren — vier unabhaengige
 * FNV-1a-Laeufe. Vier und nicht einer: sfc32 braucht vier Woerter, und ein
 * einzelner Hashwert, viermal gehaengt, ergaebe bei aehnlichen Eingaben
 * aehnliche Folgen. Die Eingaben hier sind aehnlich — sie unterscheiden sich
 * oft nur in der Rundennummer.
 */
function mische(text: string): string {
  const basen = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  return basen
    .map((basis) => {
      let h = basis >>> 0;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h.toString(16).padStart(8, '0');
    })
    .join('');
}

function worte(hex: string): [number, number, number, number] {
  const sauber = hex.replace(/[^0-9a-f]/gi, '').padEnd(32, '0').slice(0, 32);
  return [
    Number.parseInt(sauber.slice(0, 8), 16) >>> 0,
    Number.parseInt(sauber.slice(8, 16), 16) >>> 0,
    Number.parseInt(sauber.slice(16, 24), 16) >>> 0,
    Number.parseInt(sauber.slice(24, 32), 16) >>> 0,
  ];
}

export function baueZufall(saat: string): () => number {
  const [a, b, c, d] = worte(mische(saat));
  const zufall = sfc32(a, b, c, d);
  /* Zwoelf Leerlaeufe, damit die erste Zahl nicht noch nach dem Startwert
     aussieht — und die erste Zahl zieht hier die Frage, die jeder sieht. */
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

/** Ganze Zahl aus [0, grenze). */
export function ganzzahl(zufall: () => number, grenze: number): number {
  return Math.min(grenze - 1, Math.floor(zufall() * grenze));
}

/**
 * Mischt eine Kopie — die Vorlage bleibt unberuehrt (Fisher-Yates).
 *
 * Die Kataloge sind `readonly` und werden von allen Partien geteilt; wer an
 * Ort und Stelle mischte, veraenderte die Fragenliste fuer jeden anderen Tisch
 * im selben Serverprozess.
 */
export function gemischt<T>(liste: readonly T[], zufall: () => number): T[] {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = ganzzahl(zufall, i + 1);
    [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
  }
  return kopie;
}

/** Saatkette einer Runde. Zweck getrennt, damit zwei Zuege nie dasselbe ziehen. */
export function rundenSaat(saat: string, runde: number, zweck: string): string {
  return `${saat}|${runde}|${zweck}`;
}
