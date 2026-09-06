/**
 * Der Zufall dieses Spielmoduls — und die Saatzeichenketten, aus denen er
 * entsteht.
 *
 * Der Generator steht hier noch einmal, obwohl die anderen Spielmodule
 * denselben haben. Aus demselben Grund wie dort: Ein Spielmodul ist eine
 * eigenstaendige Bibliothek. Wanderte der Generator in ein gemeinsames Paket,
 * aenderte eine Verbesserung dort jeden Laden JEDER gespeicherten Partie.
 *
 * Warum er eine eigene Datei bekommen hat und nicht mehr in partie.ts steht:
 * Der Kampf braucht ihn auch (kampf.ts), und die Partie braucht den Kampf.
 * Stuende er weiter in partie.ts, zeigten die beiden Dateien im Kreis
 * aufeinander — ein Ringschluss, der in ESM zwar meist noch laeuft, aber beim
 * ersten Umbau der Ladereihenfolge still auf `undefined` faellt.
 */

/** Eine Saat kommt als Zahl oder als Hexkette herein; gerechnet wird auf Text. */
export type Saat = number | string;

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
 * Eine beliebige Zeichenkette zu 32 Hexstellen verruehren.
 *
 * Vier unabhaengige FNV-1a-Laeufe mit verschiedenen Startwerten. Vier und
 * nicht einer, weil sfc32 vier Woerter braucht und ein einzelner Hashwert,
 * viermal hintereinandergehaengt, einen Generator ergaebe, der bei aehnlichen
 * Eingaben aehnliche Folgen liefert — und die Eingaben hier sind aehnlich:
 * Sie unterscheiden sich oft nur in der Sitznummer.
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
  // Zwoelf Leerlaeufe, damit die ersten Zahlen nicht noch nach dem Startwert
  // aussehen. Ohne sie zeigen zwei benachbarte Saaten einen aehnlichen ersten
  // Laden — und der erste Laden ist der, den jeder sieht.
  for (let i = 0; i < 12; i++) zufall();
  return zufall;
}

/**
 * Der Zufallsstrom EINER Ladenfuellung.
 *
 * Er haengt nur an Saat, Sitz und laufender Nummer des Wurfs — nicht an einem
 * Generatorzustand, der im Snapshot mitreisen muesste. Das ist bei diesem
 * Spiel keine Bequemlichkeit: Alle Sitze handeln GLEICHZEITIG, und ein
 * gemeinsamer Strom haenge davon ab, in welcher Reihenfolge die Nachrichten
 * eintreffen. Zwei Server mit denselben Aktionen kaemen dann zu verschiedenen
 * Laeden.
 */
export function ladenSaat(saat: string, sitz: number, wurf: number): string {
  return `${saat}|laden|${sitz}|${wurf}`;
}

/**
 * Der Zufallsstrom, aus dem die PAARUNGEN einer Runde entstehen.
 *
 * Aus demselben Grund an Saat und Runde geknuepft und an nichts sonst: Wer
 * einen Snapshot der Runde 7 hat, muss dieselben Paarungen bekommen wie der
 * Server — auch dann, wenn die Runde inzwischen anders gelaufen ist.
 */
export function paarungsSaat(saat: string, runde: number): string {
  return `${saat}|paarung|${runde}`;
}

/**
 * Der Zufallsstrom EINES Kampfes.
 *
 * Die beiden Sitze stehen mit drin, damit die vier Kaempfe einer Runde nicht
 * denselben Erstzieher bekommen. Ohne sie zoege in jeder Runde entweder
 * ueberall die linke Seite zuerst oder ueberall die rechte — bei acht
 * Spielern ein sichtbares Muster und ein Vorteil, den niemand erspielt hat.
 */
export function kampfSaat(saat: string, runde: number, a: number, b: number): string {
  return `${saat}|kampf|${runde}|${a}|${b}`;
}
