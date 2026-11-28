/**
 * Die Grafik von Tafelrunde neu — WELCHE Dateien es gibt und wo sie liegen.
 *
 * Eine Liste und keine Vermutung: CLAUDE.md verbietet ein `<img>` auf eine
 * Datei, die es noch nicht gibt ("ein weisser Kasten sieht nach Fehler aus").
 * Die Grafik entsteht in einer eigenen Strecke (docs/ASSETS-TAFELRUNDE-NEU.md)
 * und kommt Stueck fuer Stueck; wer hier etwas eintraegt, hat die Datei vorher
 * unter `public/tafelrunde/neu/` abgelegt. Alles, was fehlt, zeichnet der
 * Bildschirm mit seinem Ersatz (Farbflaeche, Zeichen, altes Blatt).
 *
 * Gepflegt von der Grafikstrecke, gelesen vom Bildschirm. Der Bildschirm
 * aendert diese Datei nicht.
 */

/** Wurzel aller Dateien, relativ zur Seite. */
export const GRAFIK_NEU_WURZEL = '/tafelrunde/neu';

// ---------------------------------------------------------------------------
// Figuren: ein Blatt je Einheit (Kennung aus katalog.ts)
// ---------------------------------------------------------------------------

/**
 * Kantenlaenge einer Zelle im neuen Blatt. Das Raster (Zeilen, Bilder,
 * Breite der Todeszeile) ist dasselbe wie bei den alten Blaettern:
 * `FIGUREN3D_BEWEGUNGEN` in figuren3d.ts.
 */
export const FIGUREN_NEU_KANTE = 256;

/**
 * Wo die Fuesse in der Zelle stehen, als Anteil der Kante (x von links,
 * y von oben). EIN Wert fuer alle Blaetter: Sie sind mit einem gemeinsamen
 * Ausschnitt gerendert (bildfolgen-rendern.mjs, `--modelle`), damit alle
 * Figuren gleich gross erscheinen und auf einer Linie stehen.
 */
export const FIGUREN_NEU_FUSSPUNKT = { x: 0.5, y: 0.765 } as const;

/** Die Kennungen, deren Blatt schon unter `figuren/` liegt. */
export const FIGUREN_NEU_VORHANDEN: ReadonlySet<string> = new Set<string>([
  // 27.11.2026: alle 22, gemeinsamer Ausschnitt (halbe Hoehe 1,501, Mitte 0,829),
  // zusammen 3,0 MB. Geladen wird nach Bedarf, nicht vorab.
  'dorfwache',
  'schildknappe',
  'astschuetze',
  'steinschleuderer',
  'funkenlehrling',
  'irrlicht',
  'gassendieb',
  'moosheiler',
  'hainwaechterin',
  'grimmbart',
  'bogenmeisterin',
  'nachtpfeil',
  'frostweberin',
  'schattenklinge',
  'knochenspaeher',
  'runenpriester',
  'wurzelriese',
  'drachenkind',
  'sturmrufer',
  'grabfuerstin',
  'klingentaenzerin',
  'lichtwahrerin',
]);

/** Pfad zum Blatt einer Einheit, oder null, solange es keins gibt. */
export function figurNeuBlatt(kennung: string): string | null {
  return FIGUREN_NEU_VORHANDEN.has(kennung) ? `${GRAFIK_NEU_WURZEL}/figuren/${kennung}.webp` : null;
}

// ---------------------------------------------------------------------------
// Schauplaetze, Kartenrahmen, Zeichen, Effekte, Titel
// ---------------------------------------------------------------------------

/**
 * Die Schauplaetze. Seit dem 28.11.2026 sechs echte Arenen mit Rand,
 * Mittellinie und Boden mit Struktur (Robin: "Was ist aus unseren Arenen
 * geworden?"). Die erste Fassung waren ruhige, fast leere Flaechen mit Deko
 * nur in den Ecken — im Spiel sahen sie aus wie gar keine Arena. Bestellung
 * und Bildzeilen: docs/ASSETS-TAFELRUNDE-NEU.md, Abschnitt Arenen.
 */
export const SCHAUPLAETZE = ['burghof', 'dorfplatz', 'herbstwald', 'vulkan', 'hafen', 'kristall'] as const;
export type Schauplatz = (typeof SCHAUPLAETZE)[number];

/** Welcher Schauplatz in dieser Runde gilt (Runde ab 1). */
export function schauplatzFuerRunde(runde: number): Schauplatz {
  return SCHAUPLAETZE[(Math.max(1, runde) - 1) % SCHAUPLAETZE.length]!;
}

/**
 * Der Schauplatz einer ganzen Partie (Robin, 27.11.2026: "Map ist fuer das
 * Spiel festgelegt"). Aus der Tischkennung gerechnet und nicht gewuerfelt:
 * So sehen alle am Tisch denselben, auch nach einem Neuladen, ohne dass der
 * Server etwas davon wissen muss — es ist reine Optik und keine Regel.
 */
export function schauplatzFuerPartie(tischKennung: string): Schauplatz {
  let h = 0;
  for (let i = 0; i < tischKennung.length; i++) h = (h * 31 + tischKennung.charCodeAt(i)) >>> 0;
  return SCHAUPLAETZE[h % SCHAUPLAETZE.length]!;
}

/** Hochkant-Hintergrund des Feldes, oder null, solange es keinen gibt. */
export function feldBild(schauplatz: Schauplatz): string | null {
  return VORHANDEN.has(`feld/${schauplatz}`) ? `${GRAFIK_NEU_WURZEL}/feld/${schauplatz}.webp` : null;
}

/** Kartenrahmen je Kostenstufe (1, 2, 3), oder null. */
export function kartenRahmen(kosten: number): string | null {
  return VORHANDEN.has(`karten/rahmen-${kosten}`) ? `${GRAFIK_NEU_WURZEL}/karten/rahmen-${kosten}.webp` : null;
}

/**
 * Splash-Art einer Einheit fuer die Shop-Karte (Robin, 27.11.2026: statt des
 * Ausschnitts aus der Bildfolge). Hochformat 11:16 (352 x 512), freigestellt;
 * den Hintergrund in der Kostenfarbe legt der Bildschirm dahinter. Aus den
 * Konzeptbildern geschnitten (splash.mjs), je rund 30 kB.
 */
export function kartenBild(kennung: string): string | null {
  return FIGUREN_NEU_VORHANDEN.has(kennung) ? `${GRAFIK_NEU_WURZEL}/karten/bild/${kennung}.webp` : null;
}

/**
 * Ein Zeichen: `rolle-<rolle>`, `marke-<marke>`, `stern`, `gold`, `leben`.
 * Null, solange es keins gibt.
 */
export function zeichenBild(name: string): string | null {
  return VORHANDEN.has(`zeichen/${name}`) ? `${GRAFIK_NEU_WURZEL}/zeichen/${name}.webp` : null;
}

/**
 * Ein Effekt-Einzelbild, im Code animiert: `schild`, `heilung`, `funken`,
 * `feuer`, `blitz`, `frost`, `rauch`, `blaetter`, `geist`, `betaeubt`.
 */
export function effektBild(name: string): string | null {
  return VORHANDEN.has(`effekte/${name}`) ? `${GRAFIK_NEU_WURZEL}/effekte/effekt-${name}.webp` : null;
}

/**
 * Die Holz-und-Messing-Teile der Anzeigen (seit dem 28.11.2026, Robin nach dem
 * Test am iPhone: Bank, Uhr, Namen und Lebensanzeigen sahen „noch so
 * KI-generiert flau" aus). Freigestellt, ohne Text — Zahlen und Namen legt der
 * Bildschirm darueber:
 * `spielerschild` (Namensschild im Kopfband), `timer` (Medaille der Restzeit),
 * `bank` (Brett unter der Bank), `balken` (Rahmen der Lebensbalken, innen
 * leer), `plakette` (Gold und Feld ueber dem Laden), `knopf-rund` (Bereit),
 * `wimpel` und `wimpel-blau` (Seitennamen in der Arena: Gegner, eigen).
 * Null, solange es das Teil nicht gibt.
 */
export function uiBild(name: string): string | null {
  return VORHANDEN.has(`ui/${name}`) ? `${GRAFIK_NEU_WURZEL}/ui/${name}.webp` : null;
}

/** Das Titelbild des Einstiegs, oder null. */
export function titelBild(): string | null {
  return VORHANDEN.has('titel') ? `${GRAFIK_NEU_WURZEL}/titel.webp` : null;
}

/** Alles ausser den Figuren, was schon unter `public/tafelrunde/neu/` liegt. */
const VORHANDEN: ReadonlySet<string> = new Set<string>([
  // 27.11.2026: Rahmen, Zeichen, Effekte (wappen). Schauplaetze seit dem
  // 28.11.2026 als Arenen neu (szene).
  'feld/burghof',
  'feld/dorfplatz',
  'feld/herbstwald',
  'feld/vulkan',
  'feld/hafen',
  'feld/kristall',
  'karten/rahmen-1',
  'karten/rahmen-2',
  'karten/rahmen-3',
  ...['wache', 'schuetze', 'magier', 'meuchler', 'beistand'].map((r) => `zeichen/rolle-${r}`),
  ...['krieger', 'elementar', 'meuchler', 'waechter', 'naturwesen', 'untot', 'drache'].map(
    (m) => `zeichen/marke-${m}`,
  ),
  'titel',
  // 28.11.2026: Anzeigen im Holz-und-Messing-Stil der Startseite.
  ...['spielerschild', 'timer', 'bank', 'balken', 'plakette', 'knopf-rund', 'wimpel', 'wimpel-blau'].map(
    (n) => `ui/${n}`,
  ),
  'zeichen/stern',
  'zeichen/gold',
  'zeichen/leben',
  ...['schild', 'heilung', 'funken', 'feuer', 'blitz', 'frost', 'rauch', 'blaetter', 'geist', 'betaeubt'].map(
    (e) => `effekte/${e}`,
  ),
]);
