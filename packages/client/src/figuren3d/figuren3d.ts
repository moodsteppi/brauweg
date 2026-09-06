/**
 * Die vorgerenderten Bildfolgen der Tafelrunde-Figuren — die EINE Stelle, an
 * der steht, was unter `public/tafelrunde/figuren3d/` liegt.
 *
 * ABGESPIELT WERDEN SIE VON `minispiele/tafelrunde/bildfolge.ts`: Dort steht,
 * welches Ereignis welche Folge ausloest und welches Bild wann dran ist. Diese
 * Datei beschreibt nur, WAS da liegt — sie kennt weder Kampf noch Uhr.
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
 * werden. Die Probe mit Three.js lief auf dem Handy mit 20 Bildern je Sekunde
 * und lud 1,6 MB fuer fuenf Rollen. Vorgerendert sind es 284 kB, und das
 * Abspielen kostet so viel wie ein `background-position`. Genau deshalb ist
 * die Probe selbst am 06.09.2026 geloescht worden — die Entscheidung gegen sie
 * war gefallen, und ein zweiter Weg auf den Bildschirm haette nur Pflege
 * gekostet. Sie lag unter `packages/client/src/proben/arena-3d/`; wer sie
 * sehen will, findet sie in der Historie vor diesem Datum.
 *
 * LIZENZ ALLER FUENF BLAETTER: Kay Lousberg (kaylousberg.com), CC0 1.0
 * Universal — freie Verwendung auch kommerziell, Namensnennung nicht verlangt.
 * Vier Blaetter stammen aus "Character Pack : Adventurers" 1.0, der Beistand
 * seit dem 06.09.2026 aus "Adventurers 2.0" und "Character Animations 1.1"
 * derselben Hand. Beide Lizenztexte liegen als `LIZENZ.txt` neben den Bildern.
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
 * Wo die Figur in ihrer Zelle auf dem Boden aufsetzt, als Anteil der Kante.
 *
 * NICHT die Zellmitte: Der Ausschnitt umfasst ALLE Bewegungen, auch den weit
 * ausgeholten Schlag, und liegt deshalb hoeher als die stehende Figur. Wer die
 * Zelle mittig auf ein Feld setzt, stellt die Figur ein Stueck zu hoch — bei
 * 128 Pixeln sind das gut 38. Ausgerechnet aus der Kamera, nicht im Bild
 * gemessen.
 *
 * ER GILT FUER ALLE FUENF BLAETTER UND FUER JEDE ZELLE, auch die breite der
 * Todeszeile: Die ist nur zur Seite aufgezogen, nicht verschoben, und ihre
 * Mitte ist dieselbe. Er aendert sich, sobald EINE Figur weiter ausgreift als
 * bisher — der Ausschnitt ist einer fuer alle. Zwei Male hat es das schon
 * verschoben: als der Beistand vom Barbaren auf den Druiden wechselte (der
 * erhobene Stab hob ihn von 0,7394 auf 0,77) und als die Todeszeile ihre
 * eigene Zelle bekam (0,77 auf 0,80 — ohne die liegende Figur wird der
 * gemeinsame Ausschnitt enger, die Figuren also groesser). Wer nur die
 * Blaetter tauscht und die Zahl hier vergisst, stellt das ganze Feld daneben.
 */
export const FIGUREN3D_FUSSPUNKT = { x: 0.5, y: 0.8 } as const;

/**
 * Wie viele Weltmeter die HOEHE einer Zelle abdeckt.
 *
 * Das ist die Zahl, ohne die niemand sagen kann, wie gross eine Figur am
 * Bildschirm wird: Eine Zelle ist immer 128 Pixel hoch, aber wie viel Welt in
 * diesen 128 Pixeln steckt, entscheidet der gemessene Ausschnitt — und der
 * aendert sich, sobald eine Figur weiter ausgreift als bisher.
 *
 * WOZU SIE GEBRAUCHT WIRD: Wer den Ausschnitt in Prozent der Karte setzt und
 * diese Zahl nicht kennt, aendert bei jedem neuen Satz Blaetter unbemerkt die
 * Groesse aller Figuren. Genau das waere am 06.09.2026 passiert: Als die
 * Todeszeile ihre eigene Zelle bekam, wurde der gemeinsame Ausschnitt von 4,29
 * auf 3,76 Meter enger, und dieselbe Kastenhoehe haette alle Figuren um 14 %
 * wachsen lassen. `FIGURENKASTEN` in `minispiele/tafelrunde/bildfolge.ts`
 * rechnet mit ihr dagegen.
 *
 * Das Skript gibt sie als "halbe Hoehe" aus — hier steht das Doppelte.
 */
export const FIGUREN3D_ZELLHOEHE_METER = 3.756;

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
  // Wer sie aendert, sieht in KampfAnzeige.tsx nach: Das Nachspiel des Taktes
  // und das Ausblenden der Figur haengen an dieser Dauer.
  { bewegung: 'tod', zeile: 4, bilder: 8, schleife: false, bildrate: 10, weite: 1.5, proZeile: 4 },
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
  // Der Beistand ist ein Heiler (Moosheiler, Runenpriester, Lichtwahrerin) und
  // trug bis zum 06.09.2026 den Barbaren mit Axt und Schild — "Adventurers 1.0"
  // hat keinen Heiler. Der Druide aus 2.0 ist einer: gruene Kapuze, Geweih,
  // Aststab. Er kommt aus einem anderen Paket als die vier ueber ihm, deshalb
  // steht das Paket in der Herkunft mit.
  {
    rolle: 'beistand',
    datei: '/tafelrunde/figuren3d/beistand.webp',
    herkunft: 'KayKit Druid (Adventurers 2.0)',
  },
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
