/**
 * QR-Code im Browser erzeugen — ein eigener, knapper Kodierer.
 *
 * Seit dem 22.09.2026 (Einladungslink am Partykiste-Tisch). Robin hat
 * entschieden, dass der QR-Code im Browser entsteht und im nachgeladenen
 * Partykiste-Stueck liegt — ein von aussen geholtes Bild liesse die
 * Inhaltsrichtlinie (`imgSrc` in server/src/http/app.ts) ohnehin nicht zu.
 *
 * Warum dann nicht `qrcode` (npm): Es zieht dijkstrajs, pngjs und yargs mit,
 * und selbst nur der Browser-Teil wiegt gebuendelt und verkleinert 24,8 kB
 * (9,6 kB gzip). Der Einladungsschirm braucht davon genau eine Sache, die
 * Matrix fuer EINE kurze Adresse; das hier sind 4,8 kB (2,2 kB gzip) ohne
 * Abhaengigkeit. Gemessen am 22.09.2026 mit esbuild.
 *
 * Tragen kann das nur, wenn es Feld fuer Feld dasselbe liefert wie eine
 * erprobte Quelle. Am 22.09.2026 gegen `qrcode@1.5.4` gehalten: jede
 * Bytelaenge von 1 bis 271 (Stufe L) bzw. 213 (Stufe M), je vier Texte mit
 * Umlauten, also alle Versionen 1–10 und alle acht Masken — 1936 von 1936
 * Matrizen gleich; ein Viertel davon zusaetzlich mit `jsqr` zurueckgelesen,
 * 484 von 484 ergaben den Text. Die Waechter dafuer stehen in `qr.test.ts`.
 *
 * Absichtlich klein gehalten: nur Byte-Modus (die Adresse ist ASCII, ein
 * Alphanumerik-Modus spart bei einer URL mit Kleinbuchstaben ohnehin nichts),
 * nur Versionen 1 bis 10 (bis 271 Bytes bei Stufe L — der Link hat rund 35
 * bis 60), nur Fehlerkorrektur M mit Rueckfall auf L. Wer Kanji oder Version
 * 40 braucht, holt sich ein Paket; das hier ist fuer den Tisch.
 *
 * Fehlerkorrektur M und nicht L als Vorgabe, weil der Code am Handy eines
 * anderen gescannt wird — schraeg, im Halbdunkel, mit Fingerabdruck auf dem
 * Glas. M verkraftet 15 % beschaedigte Codewoerter, L nur 7 %.
 */

export type Stufe = 'L' | 'M';

/** Die fertige Matrix: `true` ist ein dunkles Feld. Quadratisch, ohne Ruhezone. */
export type QrMatrix = boolean[][];

/*
 * Kapazitaeten je Version (Index 1..10): Codewoerter insgesamt, dann je
 * Stufe die Zahl der DATEN-Codewoerter und die Zahl der Bloecke. Die
 * Fehlerkorrektur-Codewoerter je Block ergeben sich daraus
 * ((gesamt − daten) / bloecke) — die Norm listet sie einzeln, die Rechnung
 * ist fuer alle Versionen bis 10 exakt.
 */
const GESAMT = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const DATEN: Record<Stufe, number[]> = {
  L: [0, 19, 34, 55, 80, 108, 136, 156, 194, 232, 274],
  M: [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216],
};
const BLOECKE: Record<Stufe, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
};
/** Mittelpunkte der Ausrichtungsmuster je Version; Version 1 hat keins. */
const AUSRICHTUNG = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];
/** Die zwei Bits der Fehlerkorrekturstufe in der Formatinformation. */
const STUFENBITS: Record<Stufe, number> = { L: 1, M: 0 };

/* ------------------------------------------------------------------------ */
/* Galois-Koerper GF(256) fuer Reed-Solomon                                 */
/* ------------------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // Primpolynom des QR-Standards: x^8 + x^4 + x^3 + x^2 + 1.
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

const mal = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!;

/** Generatorpolynom vom Grad `grad`: Produkt aller (x − α^i) fuer i < grad. */
function generator(grad: number): number[] {
  let g = [1];
  for (let i = 0; i < grad; i++) {
    const naechstes = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      naechstes[j] ^= g[j]!;
      naechstes[j + 1] ^= mal(g[j]!, EXP[i]!);
    }
    g = naechstes;
  }
  return g;
}

/** Die `grad` Fehlerkorrektur-Codewoerter zu einem Datenblock. */
function reedSolomon(daten: number[], grad: number): number[] {
  const g = generator(grad);
  const rest = new Array<number>(grad).fill(0);
  for (const byte of daten) {
    const faktor = byte ^ rest.shift()!;
    rest.push(0);
    if (faktor === 0) continue;
    for (let j = 0; j < grad; j++) rest[j] ^= mal(g[j + 1]!, faktor);
  }
  return rest;
}

/* ------------------------------------------------------------------------ */
/* Bitstrom und Codewoerter                                                 */
/* ------------------------------------------------------------------------ */

class Bits {
  readonly bits: number[] = [];
  schreibe(wert: number, laenge: number): void {
    for (let i = laenge - 1; i >= 0; i--) this.bits.push((wert >>> i) & 1);
  }
}

/** Die kleinste Version, in die die Bytes bei dieser Stufe passen, oder 0. */
function passendeVersion(bytes: number, stufe: Stufe): number {
  for (let v = 1; v <= 10; v++) {
    // Byte-Modus: 4 Bit Kennung, 8 Bit Laenge (ab Version 10: 16), dann die Daten.
    const kopf = 4 + (v < 10 ? 8 : 16);
    if (kopf + bytes * 8 <= DATEN[stufe][v]! * 8) return v;
  }
  return 0;
}

/** Datenbits (Kopf, Daten, Abschluss, Fuellbytes) als Codewoerter. */
function datenCodewoerter(bytes: Uint8Array, version: number, stufe: Stufe): number[] {
  const b = new Bits();
  b.schreibe(0b0100, 4);
  b.schreibe(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) b.schreibe(byte, 8);
  const kapazitaet = DATEN[stufe][version]! * 8;
  b.schreibe(0, Math.min(4, kapazitaet - b.bits.length));
  while (b.bits.length % 8 !== 0) b.bits.push(0);
  const woerter: number[] = [];
  for (let i = 0; i < b.bits.length; i += 8) {
    let w = 0;
    for (let j = 0; j < 8; j++) w = (w << 1) | b.bits[i + j]!;
    woerter.push(w);
  }
  // Die Fuellbytes der Norm, abwechselnd.
  for (let i = 0; woerter.length < DATEN[stufe][version]!; i++) woerter.push(i % 2 ? 0x11 : 0xec);
  return woerter;
}

/** Bloecke bilden, Fehlerkorrektur anhaengen, verschraenken. */
function verschraenkt(daten: number[], version: number, stufe: Stufe): number[] {
  const bloecke = BLOECKE[stufe][version]!;
  const ecJeBlock = (GESAMT[version]! - DATEN[stufe][version]!) / bloecke;
  const kurz = Math.floor(daten.length / bloecke);
  const lange = daten.length % bloecke;
  const datenBloecke: number[][] = [];
  const ecBloecke: number[][] = [];
  let ab = 0;
  for (let i = 0; i < bloecke; i++) {
    const laenge = kurz + (i >= bloecke - lange ? 1 : 0);
    const block = daten.slice(ab, ab + laenge);
    ab += laenge;
    datenBloecke.push(block);
    ecBloecke.push(reedSolomon(block, ecJeBlock));
  }
  const heraus: number[] = [];
  for (let i = 0; i <= kurz; i++) {
    for (const block of datenBloecke) if (i < block.length) heraus.push(block[i]!);
  }
  for (let i = 0; i < ecJeBlock; i++) for (const block of ecBloecke) heraus.push(block[i]!);
  return heraus;
}

/* ------------------------------------------------------------------------ */
/* Matrix                                                                   */
/* ------------------------------------------------------------------------ */

interface Raster {
  groesse: number;
  /** Dunkel/hell je Feld. */
  felder: boolean[][];
  /** Was Funktionsmuster ist und von der Maske verschont bleibt. */
  fest: boolean[][];
}

function neuesRaster(version: number): Raster {
  const groesse = version * 4 + 17;
  const zeile = (): boolean[] => new Array<boolean>(groesse).fill(false);
  return {
    groesse,
    felder: Array.from({ length: groesse }, zeile),
    fest: Array.from({ length: groesse }, zeile),
  };
}

function setze(r: Raster, x: number, y: number, dunkel: boolean): void {
  r.felder[y]![x] = dunkel;
  r.fest[y]![x] = true;
}

/** Suchmuster mit Trennzone: 7×7 plus ein heller Rand, soweit er im Raster liegt. */
function suchmuster(r: Raster, x0: number, y0: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 0 || y < 0 || x >= r.groesse || y >= r.groesse) continue;
      const rand = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      setze(r, x, y, rand <= 3 && rand !== 2);
    }
  }
}

function ausrichtungsmuster(r: Raster, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const rand = Math.max(Math.abs(dx), Math.abs(dy));
      setze(r, cx + dx, cy + dy, rand !== 1);
    }
  }
}

function funktionsmuster(r: Raster, version: number): void {
  const g = r.groesse;
  suchmuster(r, 0, 0);
  suchmuster(r, g - 7, 0);
  suchmuster(r, 0, g - 7);
  // Taktspuren zwischen den Suchmustern.
  for (let i = 8; i < g - 8; i++) {
    setze(r, i, 6, i % 2 === 0);
    setze(r, 6, i, i % 2 === 0);
  }
  // Ausrichtungsmuster — nicht dort, wo schon ein Suchmuster sitzt.
  const mitten = AUSRICHTUNG[version]!;
  for (const cx of mitten) {
    for (const cy of mitten) {
      const ecke =
        (cx === 6 && cy === 6) || (cx === 6 && cy === g - 7) || (cx === g - 7 && cy === 6);
      if (!ecke) ausrichtungsmuster(r, cx, cy);
    }
  }
  // Platz fuer die Formatinformation freihalten (wird nach der Maske
  // geschrieben). Index 6 gehoert der Taktspur, die eben gelegt wurde —
  // ohne die Ausnahme ueberschrieb das Freihalten dort zwei Taktfelder.
  for (let i = 0; i < 8; i++) {
    if (i !== 6) {
      setze(r, 8, i, false);
      setze(r, i, 8, false);
    }
    setze(r, g - 1 - i, 8, false);
    setze(r, 8, g - 1 - i, false);
  }
  setze(r, 8, 8, false);
  // Das immer dunkle Feld.
  setze(r, 8, g - 8, true);
  // Versionsinformation ab Version 7: 18 Bit, BCH(18,6) mit Generator 0x1F25.
  if (version >= 7) {
    let rest = version;
    for (let i = 0; i < 12; i++) rest = (rest << 1) ^ (rest >>> 11 ? 0x1f25 : 0);
    const info = (version << 12) | rest;
    for (let i = 0; i < 18; i++) {
      const bit = ((info >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + g - 11;
      setze(r, a, b, bit);
      setze(r, b, a, bit);
    }
  }
}

/** Formatinformation: Stufe und Maske, BCH(15,5) mit Generator 0x537, dann XOR 0x5412. */
function formatinformation(r: Raster, stufe: Stufe, maske: number): void {
  const daten = (STUFENBITS[stufe] << 3) | maske;
  let rest = daten;
  for (let i = 0; i < 10; i++) rest = (rest << 1) ^ (rest >>> 9 ? 0x537 : 0);
  const info = ((daten << 10) | rest) ^ 0x5412;
  const g = r.groesse;
  for (let i = 0; i < 15; i++) {
    const bit = ((info >>> i) & 1) === 1;
    // Erste Kopie: um das Suchmuster oben links herum — Bit 6 und 7 springen
    // ueber die Taktzeile (y = 6), Bit 8 ueber die Taktspalte (x = 6).
    if (i < 6) setze(r, 8, i, bit);
    else if (i < 8) setze(r, 8, i + 1, bit);
    else if (i === 8) setze(r, 7, 8, bit);
    else setze(r, 14 - i, 8, bit);
    // Zweite Kopie: unten links und oben rechts.
    if (i < 8) setze(r, g - 1 - i, 8, bit);
    else setze(r, 8, g - 15 + i, bit);
  }
}

/** Die Codewoerter im Zickzack von rechts unten einlegen, Spalte 6 wird uebersprungen. */
function datenEinlegen(r: Raster, codewoerter: number[]): void {
  const g = r.groesse;
  let bit = 0;
  const gesamtBits = codewoerter.length * 8;
  let aufwaerts = true;
  for (let rechts = g - 1; rechts >= 1; rechts -= 2) {
    if (rechts === 6) rechts = 5;
    for (let schritt = 0; schritt < g; schritt++) {
      const y = aufwaerts ? g - 1 - schritt : schritt;
      for (const x of [rechts, rechts - 1]) {
        if (r.fest[y]![x]) continue;
        // Nach dem letzten Codewort bleiben die Restbits hell.
        const dunkel = bit < gesamtBits && ((codewoerter[bit >>> 3]! >>> (7 - (bit & 7))) & 1) === 1;
        r.felder[y]![x] = dunkel;
        bit++;
      }
    }
    aufwaerts = !aufwaerts;
  }
}

const MASKEN: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function maskieren(r: Raster, maske: number): void {
  const m = MASKEN[maske]!;
  for (let y = 0; y < r.groesse; y++) {
    for (let x = 0; x < r.groesse; x++) {
      if (!r.fest[y]![x] && m(x, y)) r.felder[y]![x] = !r.felder[y]![x];
    }
  }
}

/**
 * Strafpunkte der Norm: gleichfarbige Laeufe, 2×2-Bloecke, Suchmuster-aehnliche
 * Folgen und ein Ungleichgewicht zwischen dunkel und hell. Die Maske mit den
 * wenigsten Punkten gewinnt — ein Leser kaeme mit jeder zurecht, aber die
 * Norm verlangt die Wahl, und die Referenz trifft dieselbe.
 */
function strafe(r: Raster): number {
  const g = r.groesse;
  const f = r.felder;
  let punkte = 0;
  const laeufe = (lies: (i: number, j: number) => boolean): void => {
    for (let i = 0; i < g; i++) {
      let lauf = 1;
      for (let j = 1; j <= g; j++) {
        if (j < g && lies(i, j) === lies(i, j - 1)) {
          lauf++;
          continue;
        }
        if (lauf >= 5) punkte += 3 + (lauf - 5);
        lauf = 1;
      }
    }
  };
  laeufe((y, x) => f[y]![x]!);
  laeufe((x, y) => f[y]![x]!);
  for (let y = 0; y < g - 1; y++) {
    for (let x = 0; x < g - 1; x++) {
      const a = f[y]![x]!;
      if (a === f[y]![x + 1] && a === f[y + 1]![x] && a === f[y + 1]![x + 1]) punkte += 3;
    }
  }
  // 1:1:3:1:1 dunkel-hell-Folge mit vier hellen Feldern davor oder dahinter.
  const muster = (lies: (i: number, j: number) => boolean): void => {
    for (let i = 0; i < g; i++) {
      for (let j = 0; j <= g - 11; j++) {
        const folge = Array.from({ length: 11 }, (_, k) => lies(i, j + k));
        const kern = (ab: number): boolean =>
          folge[ab]! &&
          !folge[ab + 1]! &&
          folge[ab + 2]! &&
          folge[ab + 3]! &&
          folge[ab + 4]! &&
          !folge[ab + 5]! &&
          folge[ab + 6]!;
        const hell = (ab: number): boolean => !folge.slice(ab, ab + 4).some(Boolean);
        if ((hell(0) && kern(4)) || (kern(0) && hell(7))) punkte += 40;
      }
    }
  };
  muster((y, x) => f[y]![x]!);
  muster((x, y) => f[y]![x]!);
  let dunkel = 0;
  for (const zeile of f) for (const feld of zeile) if (feld) dunkel++;
  // Dieselbe Rundung wie die Referenz (`qrcode`): aufgerundete 5-%-Stufe,
  // Abstand zur Mitte. Die Norm laesst hier Spielraum, ein Leser kaeme mit
  // jeder Maske klar — aber nur so sind die Matrizen Feld fuer Feld gleich.
  const stufe5 = Math.ceil((dunkel * 100) / (g * g) / 5);
  punkte += Math.abs(stufe5 - 10) * 10;
  return punkte;
}

/* ------------------------------------------------------------------------ */
/* Aussen                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Text als QR-Matrix. Stufe M, wenn der Text bis Version 10 hineinpasst,
 * sonst L; passt er auch dort nicht, wirft die Funktion — der Aufrufer
 * zeigt dann den Link als Text, ein halber QR-Code waere schlimmer.
 */
export function qrMatrix(text: string, gewuenschteStufe?: Stufe): QrMatrix {
  const bytes = new TextEncoder().encode(text);
  const stufen: Stufe[] = gewuenschteStufe ? [gewuenschteStufe] : ['M', 'L'];
  for (const stufe of stufen) {
    const version = passendeVersion(bytes.length, stufe);
    if (version === 0) continue;
    const r = neuesRaster(version);
    funktionsmuster(r, version);
    datenEinlegen(r, verschraenkt(datenCodewoerter(bytes, version, stufe), version, stufe));
    let beste = 0;
    let wenigste = Infinity;
    for (let maske = 0; maske < 8; maske++) {
      maskieren(r, maske);
      formatinformation(r, stufe, maske);
      const p = strafe(r);
      if (p < wenigste) {
        wenigste = p;
        beste = maske;
      }
      maskieren(r, maske);
    }
    maskieren(r, beste);
    formatinformation(r, stufe, beste);
    return r.felder;
  }
  throw new Error(`Text zu lang fuer einen QR-Code bis Version 10: ${bytes.length} Bytes`);
}

/**
 * Die Matrix als SVG-Pfad: ein `M x y h1 v1 h-1 z` je dunklem Feld, in
 * Feldkoordinaten. Der Aufrufer legt die viewBox mit Ruhezone darum — vier
 * helle Felder ringsum verlangt die Norm, sonst findet der Leser die Ecken
 * nicht, wenn der Code auf dunklem Grund steht.
 */
export function qrPfad(matrix: QrMatrix): string {
  const teile: string[] = [];
  matrix.forEach((zeile, y) =>
    zeile.forEach((dunkel, x) => {
      if (dunkel) teile.push(`M${x} ${y}h1v1h-1z`);
    }),
  );
  return teile.join('');
}
