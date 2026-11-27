/**
 * Das Raster der Figurenblaetter von Tafelrunde — Zeilen, Bildzahl, Bildrate,
 * Schleife und Zellweite jeder Bewegung.
 *
 * Die Blaetter selbst (je Einheit eins, 256 px) nennt `grafik-neu.ts`; sie
 * haben genau dieses Raster. ABGESPIELT werden sie von
 * `minispiele/tafelrunde/bildfolge.ts`: Dort steht, welches Ereignis welche
 * Folge ausloest und welches Bild wann dran ist.
 *
 * Erzeugt hat das Raster `bildfolgen-rendern.mjs` (danebenliegend, laeuft von
 * Hand, NICHT Teil des Builds). Wer die Bilder neu rendert und dabei an
 * Bildzahl, Rasterweite oder Ausschnitt dreht, aendert die Zahlen hier mit.
 *
 * Bis zum 28.11.2026 stand hier ausserdem die Liste der alten KayKit-Blaetter
 * je Rolle (`FIGUREN3D`, `blattVon`) samt ihrem gemessenen Ausschnitt. Sie
 * ging mit dem alten Tafelrunde; die Zellkante 128 unten ist seither nur noch
 * die Masseinheit, in der `zelleVon` rechnet — `blattVersatz` teilt sie wieder
 * heraus, die Rechnung gilt deshalb fuer 256er Blaetter genauso.
 */

/** Was eine Figur tun kann. */
export type Bewegung3D = 'stand' | 'lauf' | 'schlag' | 'getroffen' | 'tod';

export interface Bewegungsfolge3D {
  readonly bewegung: Bewegung3D;
  /** ERSTE Zeile im Blatt, von oben, ab 0. Lange Folgen belegen mehrere. */
  readonly zeile: number;
  /** Wie viele Bilder die Folge hat. */
  readonly bilder: number;
  /** Ob die Folge von vorn beginnt oder auf dem letzten Bild stehenbleibt. */
  readonly schleife: boolean;
  /**
   * Breite einer Zelle als Vielfaches ihrer Hoehe. 1 heisst quadratisch.
   *
   * NUR DIE TODESZEILE IST BREITER. Eine liegende Figur greift viel weiter zur
   * Seite als eine stehende hoch ist; solange alle Zellen gleich breit waren,
   * zog sie den Ausschnitt ALLER Bilder mit auf, und deshalb endete die
   * Todesfolge bis zum 06.09.2026 im Zusammensacken statt im Liegen.
   *
   * Der Ausschnitt ist nur ZUR SEITE aufgezogen, nicht insgesamt groesser: Ein
   * Weltmeter ist in der breiten Zelle so viele Pixel wie in jeder anderen, die
   * Figur ist also gleich gross. Wer die Zelle anzeigt, macht deshalb den
   * KASTEN breiter und skaliert nichts.
   */
  readonly weite: number;
  /**
   * Wie viele Bilder dieser Folge in EINER Blattzeile stehen; der Rest bricht
   * in die naechste um.
   *
   * Damit bleibt das Blatt 768 px breit. Ohne den Umbruch waere es so breit wie
   * die laengste Zeile mal ihrer Weite (8 * 1,5 = 12 Zellen = 1536 px), und die
   * vier oberen Zeilen liessen die Haelfte davon leer — auf dem Handy sind das
   * mehrere Megabyte entpackter Bildspeicher je Blatt, fuer nichts.
   */
  readonly proZeile: number;
  /**
   * Bilder je Sekunde, wie schnell die Bewegung im Modell wirklich ablief.
   * Wer schneller abspielt, bekommt keinen fluessigeren Ablauf, sondern eine
   * hektische Figur — die Zwischenbilder fehlen ja.
   *
   * EINE ZAHL JE BEWEGUNG, NICHT JE ROLLE — und bei `schlag` passt sie
   * deshalb nicht ueberall gleich gut. Die vier Angriffe aus Adventurers 1.0
   * dauern im Modell 0,93 bis 1,17 Sekunden, das Segnen des Beistands
   * (`Ranged_Magic_Raise`) 2,10. Abgespielt wird trotzdem eine Folge in 500 ms,
   * denn danach faellt der naechste Schlag (die Rechnung steht bei
   * `KAMPF_TEMPO` in bildfolge.ts). Der Druide hebt den Stab also zuegiger als
   * im Modell. Das ist Absicht: Eine Geste, die nie durchlaeuft, sieht kaputter
   * aus als eine schnelle.
   */
  readonly bildrate: number;
}

/**
 * Raster eines Blattes: 6 Spalten mal 6 Zeilen zu je 128 Pixel (768 x 768).
 *
 * Die Kante ist die HOEHE einer Zelle und die Breite einer quadratischen. Wie
 * breit eine Zelle wirklich ist, sagt `weite` ihrer Bewegung — die Todeszeile
 * hat 1,5 Kanten (192 px) und passt mit vier Bildern je Zeile genau in die
 * sechs Spalten der anderen.
 *
 * Zeilen mit weniger Bildern lassen ihre rechten Zellen leer. Das kostet
 * nichts: Leere Zellen sind durchsichtig und wiegen im WebP fast nichts.
 */
export const FIGUREN3D_KANTE = 128;
export const FIGUREN3D_SPALTEN = 6;
export const FIGUREN3D_ZEILEN = 6;

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
  { bewegung: 'stand', zeile: 0, bilder: 4, schleife: true, bildrate: 4, weite: 1, proZeile: 4 },
  { bewegung: 'lauf', zeile: 1, bilder: 6, schleife: true, bildrate: 6, weite: 1, proZeile: 6 },
  { bewegung: 'schlag', zeile: 2, bilder: 6, schleife: false, bildrate: 6, weite: 1, proZeile: 6 },
  {
    bewegung: 'getroffen',
    zeile: 3,
    bilder: 2,
    schleife: false,
    bildrate: 11,
    weite: 1,
    proZeile: 2,
  },
  // Die Todesfolge laeuft seit dem 06.09.2026 bis zum Liegen durch und belegt
  // dafuer die Zeilen 4 UND 5, mit vier breiten Zellen je Zeile. Vorher zeigte
  // sie nur die erste Haelfte der Animation — das Zusammensacken —, weil die
  // liegende Figur den gemeinsamen Ausschnitt aller Bilder aufgezogen haette.
  // Die Begruendung der Zahlen steht bei `weite`.
  //
  // BILDRATE 10 IST DIE DES MODELLS: `Death_A` dauert 0,80 s, acht Bilder mit
  // sieben Abstaenden also 8,75 — aufgerundet auf 10, damit die Folge im
  // Zeitraffer x2 in 400 ms durchlaeuft und nicht in 457. Vorher stand hier 15,
  // was mit sechs Bildern auf dieselben 200 ms fuer die halbe Animation kam.
  // Wer sie aendert, sieht in neu/Kampf.tsx nach: Das Nachspiel des Taktes
  // und das Ausblenden der Figur haengen an dieser Dauer.
  { bewegung: 'tod', zeile: 4, bilder: 8, schleife: false, bildrate: 10, weite: 1.5, proZeile: 4 },
];

/** Die Folge einer Bewegung. Es gibt sie fuer jede Bewegung, deshalb kein undefined. */
export function folgeVon(bewegung: Bewegung3D): Bewegungsfolge3D {
  const folge = FIGUREN3D_BEWEGUNGEN.find((f) => f.bewegung === bewegung);
  if (!folge) throw new Error(`Bewegung ohne Bildfolge: ${bewegung}`);
  return folge;
}

/**
 * Der Versatz einer Zelle im Blatt und ihre Breite, in Pixeln.
 *
 * `breite` steht mit dabei, weil sie nicht mehr immer `FIGUREN3D_KANTE` ist:
 * Die Todeszeile hat 192 statt 128. Wer nur den Versatz nimmt und die Breite
 * annimmt, zeigt von der liegenden Figur zwei Drittel und schneidet den Rest
 * ab — und zwar ohne dass irgendwo ein Fehler entsteht.
 */
export function zelleVon(
  bewegung: Bewegung3D,
  bild: number,
): { x: number; y: number; breite: number } {
  const folge = folgeVon(bewegung);
  // Modulo statt Fehler: Ein Abspieler, der ueber das Ende hinauszaehlt, soll
  // von vorn anfangen und nicht abstuerzen. Bei einer Einmal-Bewegung bleibt
  // die Entscheidung, ob stehenbleiben oder ausblenden, beim Aufrufer.
  const nummer = ((bild % folge.bilder) + folge.bilder) % folge.bilder;
  const breite = FIGUREN3D_KANTE * folge.weite;
  return {
    x: (nummer % folge.proZeile) * breite,
    y: (folge.zeile + Math.floor(nummer / folge.proZeile)) * FIGUREN3D_KANTE,
    breite,
  };
}
