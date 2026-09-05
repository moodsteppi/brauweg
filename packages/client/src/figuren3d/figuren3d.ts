/**
 * Die vorgerenderten Bildfolgen der Tafelrunde-Figuren — die EINE Stelle, an
 * der steht, was unter `public/tafelrunde/figuren3d/` liegt.
 *
 * Erzeugt hat sie `bildfolgen-rendern.mjs` (danebenliegend, laeuft einmal von
 * Hand, ist NICHT Teil des Builds). Wer die Bilder neu rendert und dabei an
 * Bildzahl, Rasterweite oder Ausschnitt dreht, aendert die Zahlen hier mit —
 * das Skript gibt sie am Ende seines Laufs aus.
 *
 * DIE KAMERA STEHT AUF 16 GRAD ueber der Waagerechten — entschieden von Robin
 * am 05.09.2026, belegt am Vergleichsbild `docs/bilder/tafelrunde-kamerawinkel.webp`.
 * Der erste Satz Blaetter war mit 38,6 Grad gerendert, der Kamera der 3D-Probe,
 * die auf ein BRETT schaut: Man sah den Scheitel und kein Gesicht. Wer den
 * Winkel wieder anfasst, aendert die Zahlen hier mit.
 *
 * WOZU DAS GANZE: Die Figuren sollen wie 3D aussehen, aber nicht live gerendert
 * werden. Die Probe mit Three.js (`proben/arena-3d/`) lief auf dem Handy mit 20
 * Bildern je Sekunde und lud 1,6 MB fuer fuenf Rollen. Vorgerendert sind es
 * 204 kB, und das Abspielen kostet so viel wie ein `background-position`.
 *
 * LIZENZ ALLER FUENF BLAETTER: KayKit "Character Pack : Adventurers" 1.0 von
 * Kay Lousberg (kaylousberg.com), CC0 1.0 Universal — freie Verwendung auch
 * kommerziell, Namensnennung nicht verlangt. Der Lizenztext des Pakets liegt
 * als `LIZENZ.txt` neben den Bildern.
 */

/** Die fuenf Rollen der Tafelrunde, fuer die es Figuren gibt. */
export type Rolle3D = 'wache' | 'meuchler' | 'schuetze' | 'magier' | 'beistand';

/** Was eine Figur tun kann. */
export type Bewegung3D = 'stand' | 'lauf' | 'schlag' | 'getroffen' | 'tod';

/** Ein Blatt je Rolle; jede Bewegung ist eine Zeile darin. */
export interface Blatt3D {
  readonly rolle: Rolle3D;
  /** Pfad unter `public/`, direkt als `src` oder `background-image` nutzbar. */
  readonly datei: string;
  /** Welche Figur des Pakets dahintersteckt — fuer die Lizenzauskunft. */
  readonly herkunft: string;
}

export interface Bewegungsfolge3D {
  readonly bewegung: Bewegung3D;
  /** Zeile im Blatt, von oben, ab 0. */
  readonly zeile: number;
  /** Wie viele Zellen dieser Zeile belegt sind, von links. */
  readonly bilder: number;
  /** Ob die Folge von vorn beginnt oder auf dem letzten Bild stehenbleibt. */
  readonly schleife: boolean;
  /**
   * Bilder je Sekunde, wie schnell die Bewegung im Modell wirklich ablief.
   * Wer schneller abspielt, bekommt keinen fluessigeren Ablauf, sondern eine
   * hektische Figur — die Zwischenbilder fehlen ja.
   */
  readonly bildrate: number;
}

/**
 * Raster eines Blattes: 6 Spalten mal 5 Zeilen zu je 128 Pixel (768 x 640).
 *
 * Zeilen mit weniger als sechs Bildern lassen ihre rechten Zellen leer. Das
 * kostet nichts — leere Zellen sind durchsichtig und wiegen im WebP fast
 * nichts — und haelt die Rechnung einfach: Zelle (zeile, bild) liegt immer bei
 * (bild * 128, zeile * 128).
 */
export const FIGUREN3D_KANTE = 128;
export const FIGUREN3D_SPALTEN = 6;
export const FIGUREN3D_ZEILEN = 5;

/**
 * Wo die Figur in ihrer Zelle auf dem Boden aufsetzt, als Anteil der Kante.
 *
 * NICHT die Zellmitte: Der Ausschnitt umfasst ALLE Bewegungen, auch den weit
 * ausgeholten Schlag und das Zusammensacken, und liegt deshalb hoeher als die
 * stehende Figur. Wer die Zelle mittig auf ein Feld setzt, stellt die Figur ein
 * Stueck zu hoch — bei 128 Pixeln sind das gut 30. Ausgerechnet aus der Kamera,
 * nicht im Bild gemessen.
 */
export const FIGUREN3D_FUSSPUNKT = { x: 0.5, y: 0.7394 } as const;

/**
 * Alle Figuren schauen nach RECHTS.
 *
 * Gerendert ist nur diese eine Blickrichtung (Dreiviertelansicht, 17 Grad zur
 * Kamera gedreht). Die andere Seite entsteht durch Spiegeln — `transform:
 * scaleX(-1)`. Deshalb darf in die Bilder nichts hinein, das seitenrichtig
 * sein muss: keine Schrift, keine Zahl, kein Wappen.
 *
 * WORAN MAN SIEHT, DASS ES STIMMT, ohne den Renderer zu befragen: Die Waffe
 * liegt RECHTS vor dem Koerper, der Umhang haengt LINKS dahinter, und beim
 * Meuchler steht das Auge auf der rechten Kopfhaelfte. Stimmt eines davon
 * nicht, liegt es am Vorzeichen im Renderskript und nicht an diesem Spiegeln —
 * dort steht, welcher der beiden moeglichen Fehler es ist.
 */
export const FIGUREN3D_BLICKT = 'rechts' as const;

export const FIGUREN3D_BEWEGUNGEN: readonly Bewegungsfolge3D[] = [
  { bewegung: 'stand', zeile: 0, bilder: 4, schleife: true, bildrate: 4 },
  { bewegung: 'lauf', zeile: 1, bilder: 6, schleife: true, bildrate: 6 },
  { bewegung: 'schlag', zeile: 2, bilder: 6, schleife: false, bildrate: 6 },
  { bewegung: 'getroffen', zeile: 3, bilder: 2, schleife: false, bildrate: 11 },
  // Die Todesfolge endet im Zusammensacken, NICHT im Liegen: Die liegende
  // Figur ist dreimal so breit wie die stehende hoch und haette den Ausschnitt
  // aller anderen Bilder mit aufgezogen (Begruendung steht in
  // bildfolgen-rendern.mjs). Nach dem letzten Bild blendet die Anzeige aus.
  { bewegung: 'tod', zeile: 4, bilder: 6, schleife: false, bildrate: 15 },
];

export const FIGUREN3D: readonly Blatt3D[] = [
  { rolle: 'wache', datei: '/tafelrunde/figuren3d/wache.webp', herkunft: 'KayKit Knight' },
  { rolle: 'meuchler', datei: '/tafelrunde/figuren3d/meuchler.webp', herkunft: 'KayKit Rogue' },
  {
    rolle: 'schuetze',
    datei: '/tafelrunde/figuren3d/schuetze.webp',
    herkunft: 'KayKit Rogue_Hooded',
  },
  { rolle: 'magier', datei: '/tafelrunde/figuren3d/magier.webp', herkunft: 'KayKit Mage' },
  // Der Beistand ist ein Heiler, das Paket hat keinen — er bekommt den Barbaren
  // mit Axt und Schild. Bewusst so, siehe bildfolgen-rendern.mjs.
  { rolle: 'beistand', datei: '/tafelrunde/figuren3d/beistand.webp', herkunft: 'KayKit Barbarian' },
];

/** Das Blatt einer Rolle, oder undefined, wenn es fuer sie keines gibt. */
export function blattVon(rolle: Rolle3D): Blatt3D | undefined {
  return FIGUREN3D.find((b) => b.rolle === rolle);
}

/** Die Folge einer Bewegung. Es gibt sie fuer jede Bewegung, deshalb kein undefined. */
export function folgeVon(bewegung: Bewegung3D): Bewegungsfolge3D {
  const folge = FIGUREN3D_BEWEGUNGEN.find((f) => f.bewegung === bewegung);
  if (!folge) throw new Error(`Bewegung ohne Bildfolge: ${bewegung}`);
  return folge;
}

/**
 * Der Versatz einer Zelle im Blatt, in Pixeln.
 *
 * Gedacht fuer `background-position`, das den Versatz NEGATIV erwartet:
 * `backgroundPosition = `-${x}px -${y}px``.
 */
export function zelleVon(bewegung: Bewegung3D, bild: number): { x: number; y: number } {
  const folge = folgeVon(bewegung);
  // Modulo statt Fehler: Ein Abspieler, der ueber das Ende hinauszaehlt, soll
  // von vorn anfangen und nicht abstuerzen. Bei einer Einmal-Bewegung bleibt
  // die Entscheidung, ob stehenbleiben oder ausblenden, beim Aufrufer.
  const spalte = ((bild % folge.bilder) + folge.bilder) % folge.bilder;
  return { x: spalte * FIGUREN3D_KANTE, y: folge.zeile * FIGUREN3D_KANTE };
}
