import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Sky, useGLTF } from '@react-three/drei';
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  DoubleSide,
  Group,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
  type AnimationAction,
  type Mesh as MeshType,
  type Object3D,
} from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

import { api } from '../api';
import { spiele } from '../klang';

/**
 * Pro-Subway — der Endlos-Lauf (`/?dev=runner` und Spielauswahl → Alleine).
 *
 * Der Kerntrick bleibt: Der Pinguin läuft per Animation auf der Stelle, die
 * **Welt** rollt auf ihn zu. Alles Schnelle lebt in Refs und wird in
 * `useFrame` bewegt — React rendert nur Menüs und die Anzeige, nie den Lauf.
 *
 * Umbau vom 5. August (die Punkte aus docs/PRO-SUBWAY.md, Abschnitt 2):
 *
 * - **Hitboxen je Prop statt einer für alle.** Vorher galten 0,95 × 1,1 für
 *   Kegel wie für Bänke — man starb neben dem Kegel und rannte durch die
 *   Bank. Jetzt steht je Prop ein Halbmaß in einer Tabelle, und `?hitbox=1`
 *   zeichnet die Kästen zum Nachmessen.
 * - **Faire Muster statt Würfelei.** Es gibt immer einen begehbaren Weg:
 *   Die freie Spur wandert von Platz zu Platz um höchstens eine Spur weiter.
 *   Vorher konnten zwei Plätze im Abstand von 0,18 s Gegensätzliches
 *   verlangen — das war kein Schwierigkeitsgrad, das war Lotterie.
 * - **Meter sind Meter.** Vorher zählte ein Zeitgeber +1 je 200 ms, egal wie
 *   schnell die Welt war. Jetzt wird das Tempo aufintegriert.
 * - **Punkte ohne Umrechnungsrätsel.** Münzen zählen als Münzen (vorher
 *   intern ×10 und in der Anzeige wieder /10). Punkte = Meter + 10 je Münze,
 *   und die Rechnung steht offen auf dem Endblatt.
 * - **Rekord am Gerät** (localStorage). Kein Konto nötig; der Hub-Modus
 *   schreibt Münzen ohnehin ans Konto.
 * - **Pause**, Countdown statt der 5-Sekunden-Geisterlobby (Hindernisse, durch
 *   die man durchlaufen kann, lehren genau das Falsche), Treffer-Blitz,
 *   Kamera-Wackler, Münzton, Sterbe-Umfaller.
 * - Die Menüs sind **Holztafeln** — dieselben Klassen wie im Hub, damit der
 *   Lauf zum Rest des Hauses gehört.
 */

const ANIM = '/3d/subway/penguin_anim.glb';
/**
 * Sprung und Hechtsprung — zweites Modell, gleiches Skelett.
 *
 * Die Clips liegen in einer eigenen Datei (`jump+and+dive` aus dem
 * Archivrepo), nicht im Laufmodell. Geladen werden deshalb zwei GLBs, aber
 * bespielt wird nur EIN Netz: Der Mixer haengt am Laufmodell, die beiden
 * neuen Clips werden ihm untergeschoben. Das geht, weil beide Dateien
 * dieselben 43 Knochen mit denselben Namen haben — sonst liefen die Spuren
 * ins Leere und die Figur bliebe stehen.
 */
const ANIM_SPRUNG = '/3d/subway/penguin_sprung_hecht.glb';
/** Die beiden Kraftzeichen an der Figur. */
const KRAFT_SCHILD_GLB = '/3d/subway/kraft_schild.glb';
const KRAFT_MAGNET_GLB = '/3d/subway/kraft_magnet.glb';
const PROP = '/3d/subway';

const SPUR_BREITE = 2.5;
const CHUNK_LAENGE = 28;
const ANZAHL_CHUNKS = 6;

/** Tempo in m/s. Start gemütlich, Steigerung an die Strecke gebunden. */
const TEMPO_BASIS = 15;
const TEMPO_MAX = 30;
/** +1 m/s je 35 m — nach ~525 m ist das Maximum erreicht. */
const TEMPO_JE_METER = 1 / 35;

/** Sprung: Scheitel ≈ v²/(2g) ≈ 1,55 m — klar über jedem Sprung-Prop. */
const SPRUNGKRAFT = 9;
const SCHWERKRAFT = -26;
/** Rutschdauer — lang genug für ein Tor, kurz genug zum Verpassen. */
const RUTSCH_MS = 780;
/**
 * Wie schnell der abgebrochene Sprung zu Boden geht.
 *
 * Deutlich mehr als die freie Fallgeschwindigkeit: Der Abbruch soll sich
 * anfuehlen wie ein Hechtsprung nach unten, nicht wie Loslassen. Aus dem
 * Scheitel (1,56 m) dauert es damit rund 0,09 s statt 0,35 s.
 */
const SCHNELLFALL = -18;
/** Stehende Figur (Füße = Ursprung nach dem Erden). */
const PINGUIN_HOEHE = 1.15;
const RUTSCH_SKALA_Y = 0.48;
const RUTSCH_KOPF_Y = PINGUIN_HOEHE * RUTSCH_SKALA_Y;
const SPIELER_Z = 2.4;
const BODEN_Y = 0;
/** Halbe Breite des Pinguins für die Kollision. */
const SPIELER_BREIT = 0.34;
/**
 * Nachsicht: Die Kollisionskästen werden etwas kleiner gerechnet, als die
 * Modelle aussehen. Ein Streifschuss, der optisch "gerade so vorbei" war,
 * soll kein Tod sein — in schnellen Läufern ist die gefühlte Gerechtigkeit
 * wichtiger als die geometrische.
 */
const NACHSICHT = 0.9;

/**
 * Luft, die die Fuesse ueber der Prop-Oberkante haben muessen.
 *
 * Frueher stand hier eine Pauschale von 0,7 fuer alles — richtig, solange
 * jedes Sprung-Prop unter 0,62 lag. Fahrrad und Wagen sind jetzt doppelt
 * so hoch; mit der Pauschale waere man ueber sie hinweg "gesprungen",
 * waehrend die Figur sichtbar mittendurch geht. Die Kante kommt deshalb
 * aus der Hoehe des Stuecks (`sprungFrei()`).
 *
 * Der Sprungscheitel liegt bei v²/(2g) = 1,56 — ueber 1,32 (Fahrrad plus
 * Luft) ist man rund 0,27 s, das reicht bequem.
 */
const SPRUNG_LUFT = 0.08;
/** Feste Z-Plätze im Chunk — die Hindernisse selbst stehen still. */
const PLATZ_Z = [-10, -5, 0, 5, 10] as const;
/** Erst nach so vielen Metern Anlauf kommt das erste Hindernis an. */
const ANLAUF_M = 34;
/** Punkte je Münze — die eine Zahl, die die Rechnung erklärt. */
const PUNKTE_JE_MUENZE = 10;
/** Schlüssel für den Geräterekord. */
const REKORD_SCHLUESSEL = 'brauweg.prosubway.rekord';

/**
 * Die Biome der Strecke — dieselbe Reihe wie auf dem Trophäenpfad.
 *
 * Alle 220 m wechselt die Welt die Farbe: Boden, Randmauern, Spurlinien und
 * Himmel/Nebel. Nach dem Sternenhafen beginnt die Reihe von vorn — die
 * Strecke ist endlos, die Welt auch. Kein neues Bildmaterial: Es sind
 * dieselben Flächen wie vorher, nur trägt jede Zone ihre eigenen Töne.
 *
 * Der Wechsel passiert je Chunk beim Recyceln. Ein Chunk ist 28 m lang —
 * die Naht zwischen zwei Zonen ist damit eine Kachelkante weit hinten im
 * Nebel, kein Umschlag mitten im Bild. Himmel und Nebel gleiten weich
 * (`BiomStimmung`), sonst blitzte der Himmel beim Zonenwechsel.
 */
interface BiomLook {
  readonly name: string;
  readonly grasA: string;
  readonly grasB: string;
  readonly rand: string;
  readonly linie: string;
  readonly himmel: string;
  /** Bordstein-Bloecke am Streckenrand, im Wechsel. */
  readonly kanteA: string;
  readonly kanteB: string;
  /** Flecken auf dem Boden — Erde, Sand, Glut, Eis, je nach Zone. */
  readonly fleck: string;
  /** Dateiname der gemalten Kacheln (docs/ASSETS-RUNNER-BODEN.md). */
  readonly datei: string;
}

const BIOME_LOOK: readonly BiomLook[] = [
  { name: 'Heimat', grasA: '#4a7c3f', grasB: '#3d6b35', rand: '#5c4030', linie: '#c9b896', himmel: '#87b8d8', kanteA: '#c9b896', kanteB: '#8a6f4a', fleck: '#365a2c', datei: 'heimat' },
  { name: 'Wiesen', grasA: '#58a06a', grasB: '#4a8f5c', rand: '#4a5c30', linie: '#d8cfa8', himmel: '#8fd0e8', kanteA: '#d8cfa8', kanteB: '#7a9a5a', fleck: '#3f7a4d', datei: 'wiesen' },
  { name: 'Strand', grasA: '#d8c48a', grasB: '#cbb578', rand: '#8a6f4a', linie: '#a8dce4', himmel: '#9adcf0', kanteA: '#e8dcb0', kanteB: '#b09468', fleck: '#c0a86a', datei: 'strand' },
  { name: 'Feuerberg', grasA: '#6d4a3a', grasB: '#5c3a2c', rand: '#3a2620', linie: '#e8a05a', himmel: '#d8906a', kanteA: '#8a5a3a', kanteB: '#4a2c20', fleck: '#e86a3a', datei: 'feuerberg' },
  { name: 'Schneefeld', grasA: '#e4ecf2', grasB: '#d4e0ea', rand: '#7a8ca0', linie: '#b0c4d4', himmel: '#c8dcec', kanteA: '#ffffff', kanteB: '#a0b4c8', fleck: '#b8d0e4', datei: 'schneefeld' },
  { name: 'Sternenhafen', grasA: '#3a3a5c', grasB: '#30304c', rand: '#26263a', linie: '#e2b64f', himmel: '#2e2e50', kanteA: '#e2b64f', kanteB: '#3a3a6c', fleck: '#4a4a7c', datei: 'sternenhafen' },
];

const BIOM_LAENGE = 220;

/**
 * Die gemalten Kacheln (docs/ASSETS-RUNNER-BODEN.md).
 *
 * Alle zwoelf werden gemeinsam geladen (`useKacheln`) — sechs Chunks
 * teilen sich dieselben Bilder, geladen wird jedes genau einmal. Nur die
 * Kachel der sichtbaren Zone zu laden waere sparsamer, aber der Wechsel
 * kaeme dann als Ruckler mitten im Lauf.
 */
const BODEN_URLS = BIOME_LOOK.map((b) => `/runner/runner-boden-${b.datei}.webp`);
const RAND_URLS = BIOME_LOOK.map((b) => `/runner/runner-rand-${b.datei}.webp`);

/**
 * Wie oft sich die Bodenkachel je Chunk wiederholt.
 *
 * Ein Chunk ist 28 m lang, eine Kachel stellt rund 4 m dar — sieben
 * Wiederholungen. Quer nur einmal ueber die drei Spuren: Die Bahn ist
 * 9,5 m breit, und ein quer gestauchtes Muster faellt weniger auf als eine
 * zweite senkrechte Naht mitten auf der Fahrbahn.
 */
const BODEN_WIEDERHOLUNG = 7;
/** Die Randleiste ist laenglich; vierzehn Wiederholungen je Chunk. */
const RAND_WIEDERHOLUNG = 14;

function biomIdxFuer(distanz: number): number {
  return Math.floor(Math.max(0, distanz) / BIOM_LAENGE) % BIOME_LOOK.length;
}

/**
 * Kräfte am Wegesrand.
 *
 * Drei, und jede ändert die Rechnung, nicht die Regeln: Der Magnet holt die
 * Münzen, der Schild verzeiht einen Treffer, Doppel zählt jede Münze
 * doppelt. Kein Turbo — mehr Tempo wäre in dieser Wertung einfach mehr
 * Punkte fürs Nichtstun und obendrein schwerer zu überleben.
 */
type KraftArt = 'magnet' | 'schild' | 'doppel';
const KRAFT_DAUER_MS = 12_000;
/** Wie oft ein Chunk eine Kraft trägt. Selten — sie sollen ein Fund sein. */
const KRAFT_CHANCE = 0.16;

interface KraftPlatz {
  art: KraftArt;
  spur: -1 | 0 | 1;
  z: number;
  aktiv: boolean;
}

type Phase = 'menu' | 'flee' | 'run' | 'pause' | 'dead';
type Pose = 'flee' | 'run' | 'idle';
type FahrzeugArt = 'scooter' | 'silver' | 'bmw';
/** jump/bush = drüber, slide = drunter, vehicle = kommt entgegen. */
type Rolle = 'jump' | 'bush' | 'slide' | 'vehicle';
type SprungProp =
  | 'crate'
  | 'suitcase'
  | 'trashbags'
  | 'cone'
  | 'barrel'
  | 'boxes'
  | 'bench'
  | 'planter'
  | 'keg'
  | 'bike'
  | 'barrier'
  | 'cart';
type BuschProp = 'bush' | 'planter';
type RutschProp = 'banner' | 'scaffold' | 'garland';

const FAHRZEUG_URL: Record<FahrzeugArt, string> = {
  scooter: `${PROP}/obstacle_scooter.glb`,
  silver: `${PROP}/obstacle_silver.glb`,
  bmw: `${PROP}/obstacle_bmw.glb`,
};

const SPRUNG_PROPS: SprungProp[] = [
  'crate',
  'suitcase',
  'trashbags',
  'cone',
  'barrel',
  'boxes',
  'bench',
  'planter',
  'keg',
  'bike',
  'barrier',
  'cart',
];
const BUSCH_PROPS: BuschProp[] = ['bush', 'planter'];
const RUTSCH_PROPS: RutschProp[] = ['banner', 'scaffold', 'garland'];

/** Sichthöhe je Prop (Skalierung des Modells). Die Sprungkante folgt daraus. */
const SPRUNG_H: Record<SprungProp, number> = {
  crate: 0.58,
  suitcase: 0.48,
  trashbags: 0.55,
  cone: 0.58,
  barrel: 0.62,
  boxes: 0.6,
  bench: 0.5,
  planter: 0.58,
  keg: 0.62,
  // Fahrrad und Einkaufswagen doppelt: Bei 0,62 lagen sie da wie
  // Spielzeug. Jetzt stehen sie — und man springt ueber etwas, das so
  // gross ist wie man selbst.
  bike: 1.24,
  barrier: 0.5,
  cart: 1.24,
};
const BUSCH_H: Record<BuschProp, number> = { bush: 0.6, planter: 0.58 };
/** Tore: Gesamthöhe des Modells; der Durchlass steht in TOR_LUECKE. */
const RUTSCH_H: Record<RutschProp, number> = { banner: 2.15, scaffold: 2.2, garland: 2.1 };
/**
 * Fahrzeuge: das Dreifache der ersten Fassung.
 *
 * Bei 0,64 bis 0,72 waren es Spielzeugautos, ueber die der Sprung
 * (Scheitel 1,55 m) locker trug — und genau das sollen Fahrzeuge nicht
 * sein. Jetzt ueberragen alle drei den Scheitel: Ein Auto weicht man aus,
 * man springt nicht drueber.
 */
const FAHRZEUG_H: Record<FahrzeugArt, number> = { scooter: 2.16, silver: 2.04, bmw: 1.92 };

/**
 * Die Kollisionskästen — **das** Stück, das den Lauf gerecht macht.
 *
 * Halbmaße in Metern: `x` quer zur Laufrichtung, `z` in Laufrichtung.
 * Ein Kegel ist schmal, eine Bank breit und flach, eine Absperrung breit und
 * dünn. Vorher galt für alle dasselbe Paar (0,95/1,1) — gefühlt starb man
 * "neben" dem Kegel und lief "durch" die Bank.
 *
 * Die Werte sind nach Augenmaß auf die skalierten Modelle gestimmt;
 * nachgemessen wird mit `?dev=runner&hitbox=1`, das die Kästen als
 * Drahtgitter zeichnet.
 */
const KASTEN: Record<SprungProp | BuschProp | RutschProp, { x: number; z: number }> = {
  crate: { x: 0.42, z: 0.42 },
  suitcase: { x: 0.4, z: 0.28 },
  trashbags: { x: 0.5, z: 0.4 },
  cone: { x: 0.26, z: 0.26 },
  barrel: { x: 0.36, z: 0.36 },
  boxes: { x: 0.5, z: 0.45 },
  bench: { x: 0.85, z: 0.3 },
  planter: { x: 0.5, z: 0.35 },
  keg: { x: 0.38, z: 0.38 },
  // Aus den Modellen gerechnet (getBounds, je Einheit Hoehe): Fahrrad
  // B/H 1,42 L/H 1,10, Wagen 0,98/0,63 — mal 1,24, halbiert.
  bike: { x: 0.88, z: 0.68 },
  barrier: { x: 0.8, z: 0.18 },
  cart: { x: 0.61, z: 0.39 },
  bush: { x: 0.5, z: 0.45 },
  // Tore spannen die ganze Spur.
  banner: { x: 1.15, z: 0.22 },
  scaffold: { x: 1.15, z: 0.26 },
  garland: { x: 1.15, z: 0.22 },
};

/**
 * Durchlass-Unterkante je Tor. Stehend (Kopf 1,15) trifft man, geduckt
 * (Kopf 0,55) passt man durch — mit je Tor eigener Luft, weil die gemalten
 * Lücken verschieden hoch sitzen.
 */
const TOR_LUECKE: Record<RutschProp, number> = {
  banner: 0.78,
  scaffold: 0.84,
  garland: 0.72,
};

/**
 * Fahrzeuge: Kasten, Sprungkante und wie schnell sie einem entgegenkommen.
 *
 * Die Kaesten sind aus den MODELLEN gerechnet, nicht geschaetzt (gemessen
 * mit getBounds, je Einheit Hoehe): Scooter B/H 0,64 · L/H 1,24, Silber
 * 0,89/1,94, BMW 1,44/2,99. Mal Zielhoehe, halbiert:
 *
 *   Scooter 0,69/1,34 · Silber 0,91/1,98 · BMW 1,38/2,87
 *
 * Zwei Deckel darauf, beide mit Absicht:
 * - quer hoechstens 1,25 (halbe Spurbreite): Der BMW ist breiter als seine
 *   Spur und ragt sichtbar hinueber — toedlich ist aber nur, was in DEINER
 *   Spur steht. Der Ueberhang ist Schauwert, keine Falle.
 * - laengs hoechstens 2,2: Der BMW ist laenger als der halbe Platzabstand.
 *   Ohne Deckel koennte der freie Pfad in eine Spur fuehren, in der das
 *   Heck rechnerisch noch steht — man stuerbe an einem Kofferraum, den man
 *   laengst passiert glaubt.
 *
 * `frei` liegt ueber dem Sprungscheitel (1,55): Fahrzeuge sind bewusst
 * nicht ueberspringbar.
 */
const FAHRZEUG: Record<FahrzeugArt, { x: number; z: number; frei: number; tempo: number }> = {
  scooter: { x: 0.69, z: 1.34, frei: 1.7, tempo: 7 },
  silver: { x: 0.91, z: 1.98, frei: 1.7, tempo: 5.5 },
  bmw: { x: 1.25, z: 2.2, frei: 1.7, tempo: 5.5 },
};

function propGlb(name: string): string {
  return `${PROP}/prop_${name}.glb`;
}

/** Ab welcher Fusshoehe man ueber dieses Stueck hinweg ist. */
function sprungFrei(h: Hindernis): number {
  if (h.rolle === 'jump') return SPRUNG_H[h.sprungProp] + SPRUNG_LUFT;
  if (h.rolle === 'bush') return BUSCH_H[h.buschProp] + SPRUNG_LUFT;
  return FAHRZEUG[h.fahrzeug].frei;
}

/**
 * Vorladen in zwei Wellen: Pinguin und Fahrzeuge sofort (die braucht der
 * erste Bildschirm), die sechzehn Props gestaffelt im Leerlauf. Alles auf
 * einmal hielt auf schwachem Netz den Start sekundenlang schwarz — und der
 * Browser lädt ohnehin nach, was bis dahin fehlt.
 */
function ladeRunnerModelle(): void {
  useGLTF.preload(ANIM);
  useGLTF.preload(ANIM_SPRUNG);
  useGLTF.preload(KRAFT_SCHILD_GLB);
  useGLTF.preload(KRAFT_MAGNET_GLB);
  for (const art of Object.keys(FAHRZEUG_URL) as FahrzeugArt[]) {
    useGLTF.preload(FAHRZEUG_URL[art]);
  }
  const rest = [
    ...SPRUNG_PROPS.map(propGlb),
    ...BUSCH_PROPS.map(propGlb),
    ...RUTSCH_PROPS.map(propGlb),
  ];
  const leerlauf: (cb: () => void) => void =
    'requestIdleCallback' in window
      ? (cb) => window.requestIdleCallback(cb)
      : (cb) => window.setTimeout(cb, 250);
  const naechste = (): void => {
    const url = rest.shift();
    if (!url) return;
    useGLTF.preload(url);
    leerlauf(naechste);
  };
  leerlauf(naechste);
}

/** Drahtgitter an? Einmal beim Laden gelesen — `?dev=runner&hitbox=1`. */
const ZEIGE_KAESTEN = /(\?|&|%3F|%26)hitbox=1/.test(window.location.search);

function zufall<T>(liste: readonly T[]): T {
  return liste[Math.floor(Math.random() * liste.length)]!;
}

// ---------------------------------------------------------------------------
// Musterbau — die freie Spur wandert, statt zu springen
// ---------------------------------------------------------------------------

/**
 * Der begehbare Pfad durch die Hindernisse.
 *
 * Je belegtem Platz gibt es genau eine garantiert freie Spur, und die darf
 * sich von Platz zu Platz um höchstens eine Spur verschieben. Bei fünf
 * Metern Platzabstand und Höchsttempo bleiben ~170 ms je Wechsel — ein
 * Wechsel ist machbar, zwei sind es nicht. Vorher wurde jede Spur einzeln
 * gewürfelt, und ab und zu entstand eine Wand, an der niemand vorbeikam.
 *
 * Auf Modulebene, weil die Chunks sich nacheinander recyceln und der Pfad
 * über Chunk-Grenzen hinweg zusammenhängen muss.
 */
let pfadSpur: -1 | 0 | 1 = 0;

function rueckePfad(): -1 | 0 | 1 {
  const schritt = Math.floor(Math.random() * 3) - 1;
  const naechste = Math.max(-1, Math.min(1, pfadSpur + schritt));
  pfadSpur = naechste as -1 | 0 | 1;
  return pfadSpur;
}

/** Ein Hindernis auf einem Platz. Ein Platz kann zwei davon tragen. */
interface Hindernis {
  rolle: Rolle;
  fahrzeug: FahrzeugArt;
  sprungProp: SprungProp;
  buschProp: BuschProp;
  rutschProp: RutschProp;
  spur: -1 | 0 | 1;
  aktiv: boolean;
  /** Nur Fahrzeuge: wie weit sie schon auf den Spieler zugefahren sind. */
  fahrt: number;
  /**
   * Zeitpunkt, zu dem ein Fahrzeug dieses Stueck ueberrollt hat.
   * 0 = steht. Alles darueber laesst es in Trueemmer fallen.
   */
  zerlegtUm: number;
}

interface Platz {
  z: number;
  hindernisse: [Hindernis, Hindernis];
}

/**
 * Ist die Stelle (Spur, z) schon belegt?
 *
 * Muenzen und Kraefte fragen hier nach, bevor sie sich hinlegen. Vorher
 * konnte eine Muenzreihe mitten durch eine Kiste laufen oder ein Magnet in
 * einem Tor stecken — man sah zwei Dinge ineinander und wusste nicht, was
 * gilt.
 *
 * Der Abstand ist grosszuegiger als die Kollision: Ein Gegenstand, der eine
 * Kiste nur STREIFT, sieht schon falsch aus, auch wenn er sie rechnerisch
 * nicht beruehrt.
 */
function belegt(plaetze: readonly Platz[], spur: number, z: number, luft = 2.2): boolean {
  for (const platz of plaetze) {
    for (const h of platz.hindernisse) {
      if (!h.aktiv) continue;
      if (h.spur !== spur) continue;
      // Tore spannen die ganze Spur und sind besonders unvertraeglich.
      const tiefe = h.rolle === 'slide' ? luft + 1 : luft;
      if (Math.abs(platz.z - z) < tiefe) return true;
    }
  }
  return false;
}

/** Sucht in einem Bereich eine freie Stelle. Gibt null, wenn alles voll ist. */
function freieStelle(
  plaetze: readonly Platz[],
  spur: number,
  von: number,
  bis: number,
  versuche = 8,
): number | null {
  for (let i = 0; i < versuche; i++) {
    const z = von + Math.random() * (bis - von);
    if (!belegt(plaetze, spur, z)) return z;
  }
  return null;
}

function leeresHindernis(): Hindernis {
  return {
    rolle: 'jump',
    fahrzeug: zufall(['scooter', 'silver', 'bmw'] as const),
    sprungProp: zufall(SPRUNG_PROPS),
    buschProp: zufall(BUSCH_PROPS),
    rutschProp: zufall(RUTSCH_PROPS),
    spur: 0,
    aktiv: false,
    fahrt: 0,
    zerlegtUm: 0,
  };
}

function wuerfleRolle(distanz: number): Rolle {
  const r = Math.random();
  // Fahrzeuge erst ab 120 m — sie kommen entgegen und sind der härteste Typ.
  const fahrzeugAnteil = distanz < 120 ? 0 : Math.min(0.16, 0.08 + distanz / 4000);
  if (r < fahrzeugAnteil) return 'vehicle';
  if (r < fahrzeugAnteil + 0.42) return 'jump';
  if (r < fahrzeugAnteil + 0.64) return 'bush';
  return 'slide';
}

/**
 * Ein Chunk-Layout. `chunkZ` ist die Weltposition, `distanz` die gelaufene
 * Strecke — daraus kommt die Schwierigkeit: Dichte steigt, ab 240 m dürfen
 * Plätze zwei Spuren belegen (die freie bleibt frei), Fahrzeuge werden
 * häufiger.
 */
function baueChunk(chunkZ: number, distanz: number): Platz[] {
  const dichte = Math.min(0.85, 0.55 + (distanz / 1000) * 0.4);
  const doppelChance = distanz < 240 ? 0 : Math.min(0.3, (distanz - 240) / 900);

  return PLATZ_Z.map((z) => {
    const weltZ = chunkZ + z;
    const nochHin = SPIELER_Z - weltZ;
    // Anlauf: Was den Spieler vor ANLAUF_M erreichen würde, bleibt leer.
    const erreichbar = nochHin >= ANLAUF_M;
    const belegt = erreichbar && Math.random() < dichte;

    const eins = leeresHindernis();
    const zwei = leeresHindernis();

    if (belegt) {
      const frei = rueckePfad();
      const andere = ([-1, 0, 1] as const).filter((s) => s !== frei);
      eins.rolle = wuerfleRolle(distanz);
      eins.spur = zufall(andere);
      eins.aktiv = true;
      if (Math.random() < doppelChance) {
        const rest = andere.filter((s) => s !== eins.spur);
        // `andere` hat zwei Spuren, `eins` belegt eine — es bleibt genau
        // eine uebrig. Zwei Hindernisse koennen sich hier bauartbedingt
        // nicht dieselbe Spur teilen.
        if (rest.length > 0) {
          // Der zweite Platz ist immer etwas zum Drüberspringen — zwei Tore
          // nebeneinander sähen aus wie ein Fehler im Musterbau.
          zwei.rolle = Math.random() < 0.5 ? 'jump' : 'bush';
          zwei.spur = rest[0]!;
          zwei.aktiv = true;
        }
      }
    }

    return { z, hindernisse: [eins, zwei] as [Hindernis, Hindernis] };
  });
}

// ---------------------------------------------------------------------------
// Spielzustand
// ---------------------------------------------------------------------------

interface Spielstand {
  spur: -1 | 0 | 1;
  /**
   * Der Spurwechsel ist eine feste, kurze Kurve statt einer Exponentialjagd.
   *
   * `lerp(x, ziel, 12·dt)` startet schnell und kriecht am Ende — die Figur
   * "kommt nie an", und weil die Kollision an der echten X-Position rechnet,
   * hängt man länger zwischen den Spuren als nötig. Jetzt: 170 ms
   * Ease-Out-Kurve von `spurVonX` zum Ziel. Kommt mitten im Wechsel die
   * nächste Eingabe, startet die Kurve an der aktuellen Position neu —
   * Doppelwechsel fühlen sich an wie einer in lang, nicht wie zwei Rucke.
   */
  spurVonX: number;
  spurWechselUm: number;
  springt: boolean;
  rutscht: boolean;
  rutschtBis: number;
  sprungV: number;
  /** Sprungwunsch kurz vor der Landung — wird beim Aufsetzen eingelöst. */
  sprungPuffer: number;
  /**
   * Rutschwunsch aus der Luft: bricht den Sprung ab.
   *
   * Wer im Flug nach unten wischt, will nicht warten, bis die Schwerkraft
   * fertig ist. Der Wunsch schaltet auf Schnellfall und wird beim Aufsetzen
   * eingeloest — daher ein Zeitstempel und kein Schalter: Ein Schalter, der
   * beim Landen noch stuende, loeste auch eine halbe Sekunde spaeter noch
   * eine Rutschpartie aus, die niemand mehr wollte.
   */
  rutschPuffer: number;
  tempo: number;
  distanz: number;
  phase: Phase;
  /** Füße in Weltkoordinaten. */
  pos: Vector3;
  /** Kopfhöhe für die Tor-Kollision (steht / rutscht). */
  kopfY: number;
  /** Zeitpunkt des Aufpralls — für Wackler und Umfaller. */
  umgeranntUm: number;
  /** Zeitpunkt der letzten Landung — für den Stauch-Effekt. */
  gelandetUm: number;
  /** Kräfte: Magnet und Doppel als Ablaufzeit, Schild als Vorrat. */
  magnetBis: number;
  doppelBis: number;
  schild: boolean;
}

function frischerStand(phase: Phase): Spielstand {
  return {
    spur: 0,
    spurVonX: 0,
    spurWechselUm: 0,
    springt: false,
    rutscht: false,
    rutschtBis: 0,
    sprungV: 0,
    sprungPuffer: 0,
    rutschPuffer: 0,
    tempo: TEMPO_BASIS,
    distanz: 0,
    phase,
    pos: new Vector3(0, BODEN_Y, SPIELER_Z),
    kopfY: PINGUIN_HOEHE,
    umgeranntUm: 0,
    gelandetUm: 0,
    magnetBis: 0,
    doppelBis: 0,
    schild: false,
  };
}

/** Geräterekord — lesen und schreiben mit Netz: localStorage darf fehlen. */
interface Rekord {
  punkte: number;
  meter: number;
  muenzen: number;
}

function liesRekord(): Rekord | null {
  try {
    const roh = window.localStorage.getItem(REKORD_SCHLUESSEL);
    if (!roh) return null;
    const r = JSON.parse(roh) as Rekord;
    return typeof r.punkte === 'number' ? r : null;
  } catch {
    return null;
  }
}

function schreibRekord(r: Rekord): void {
  try {
    window.localStorage.setItem(REKORD_SCHLUESSEL, JSON.stringify(r));
  } catch {
    // Privater Modus o. Ä. — dann gibt es eben keinen Gerä­terekord.
  }
}

// ---------------------------------------------------------------------------
// Modelle
// ---------------------------------------------------------------------------

function passeHoehe(wurzel: Object3D, zielH: number): void {
  wurzel.updateMatrixWorld(true);
  const kasten = new Box3().setFromObject(wurzel);
  const groesse = kasten.getSize(new Vector3());
  if (groesse.y < 0.001) return;
  wurzel.scale.setScalar(zielH / groesse.y);
}

function erdeFuesse(wurzel: Object3D): void {
  wurzel.updateMatrixWorld(true);
  const kasten = new Box3().setFromObject(wurzel);
  wurzel.position.y -= kasten.min.y;
}

function baueStatisch(quelle: Object3D, zielH: number): Group {
  const wurzel = new Group();
  const kopie = quelle.clone(true);
  kopie.traverse((o) => {
    const mesh = o as MeshType;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  wurzel.add(kopie);
  passeHoehe(wurzel, zielH);
  erdeFuesse(wurzel);
  return wurzel;
}

interface PinguinBausatz {
  wurzel: Group;
  mixer: AnimationMixer;
  flee: AnimationAction;
  run: AnimationAction;
  /** Einmalige Clips aus dem zweiten Modell. Null, wenn es fehlt. */
  sprung: AnimationAction | null;
  hecht: AnimationAction | null;
  hip: Object3D | null;
  hipRuhe: Vector3;
  /** Lokale Y nach einmaligem Erden — nie per Welt-BBox nachjustieren. */
  bodenY: number;
}

function ohneWurzelbewegung(clip: AnimationClip): AnimationClip {
  const spuren = clip.tracks.filter((t) => {
    const n = t.name;
    return !(
      n === 'Root.position' ||
      n === 'Hip.position' ||
      n.endsWith('/Root.position') ||
      n.endsWith('/Hip.position')
    );
  });
  return new AnimationClip(clip.name, clip.duration, spuren);
}

function bauePinguin(
  quelle: Object3D,
  clips: AnimationClip[],
  extraClips: AnimationClip[] = [],
): PinguinBausatz {
  const wurzel = new Group();
  const richt = new Group();
  richt.rotation.x = Math.PI / 2 - Math.PI / 4;
  richt.rotation.y = Math.PI;

  const modell = cloneSkinned(quelle);
  let hipKnochen: Object3D | undefined;
  modell.traverse((o) => {
    if (o.name === 'Hip') hipKnochen = o;
    const mesh = o as MeshType;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  richt.add(modell);
  wurzel.add(richt);

  const hip = hipKnochen ?? null;
  const hipRuhe = hip ? hip.position.clone() : new Vector3();
  const mixer = new AnimationMixer(modell);
  if (!clips[0]) {
    passeHoehe(wurzel, PINGUIN_HOEHE);
    erdeFuesse(wurzel);
    const leer = mixer.clipAction(new AnimationClip('leer', 0, []));
    return {
      wurzel,
      mixer,
      flee: leer,
      run: leer,
      sprung: null,
      hecht: null,
      hip,
      hipRuhe,
      bodenY: wurzel.position.y,
    };
  }
  const flee = mixer.clipAction(ohneWurzelbewegung(clips[0]));
  flee.setLoop(LoopOnce, 1);
  flee.clampWhenFinished = true;
  const run = mixer.clipAction(ohneWurzelbewegung(clips[1] ?? clips[0]));
  run.setLoop(LoopRepeat, Infinity);

  flee.reset().play();
  mixer.setTime(0);
  if (hip) hip.position.copy(hipRuhe);
  passeHoehe(wurzel, PINGUIN_HOEHE);
  erdeFuesse(wurzel);
  flee.stop();

  /**
   * Die beiden einmaligen Clips. Beide `LoopOnce` mit `clampWhenFinished`:
   * Ein Sprung, der sich wiederholt, sieht aus wie ein Fehler, und ohne
   * Klemmen schnappt die Figur im letzten Bild in die Ruhelage zurueck.
   *
   * `zeitSkala` streckt sie auf die Dauer, die das SPIEL vorgibt — der
   * Hechtsprung dauert im Modell 3,5 s, das Rutschen aber 0,78 s. Ohne
   * Streckung waere die Figur beim Wiederaufstehen noch mitten im Sprung.
   */
  const macheEinmal = (clip: AnimationClip | undefined): AnimationAction | null => {
    if (!clip) return null;
    const aktion = mixer.clipAction(ohneWurzelbewegung(clip));
    aktion.setLoop(LoopOnce, 1);
    aktion.clampWhenFinished = true;
    return aktion;
  };

  return {
    wurzel,
    mixer,
    flee,
    run,
    sprung: macheEinmal(extraClips[0]),
    hecht: macheEinmal(extraClips[1]),
    hip,
    hipRuhe,
    bodenY: wurzel.position.y,
  };
}

function AnimierterPinguin({
  pose,
  spielstand,
  onFleeFertig,
}: {
  pose: Pose;
  spielstand: React.MutableRefObject<Spielstand>;
  onFleeFertig: () => void;
}): React.JSX.Element {
  const gltf = useGLTF(ANIM);
  const extra = useGLTF(ANIM_SPRUNG);
  const bausatz = useMemo(
    () => bauePinguin(gltf.scene, gltf.animations, extra.animations),
    [gltf.scene, gltf.animations, extra.animations],
  );
  const fleeFertig = useRef(false);

  /**
   * Sprung und Hechtsprung anstossen, sobald der Zustand es sagt.
   *
   * Angestossen wird an der FLANKE, nicht am Zustand: Wir merken uns, was
   * beim letzten Bild galt, und starten den Clip nur beim Wechsel von
   * "nicht" auf "doch". Ohne das setzte `reset()` den Clip in jedem Bild
   * neu an, und die Figur zuckte im ersten Einzelbild fest.
   *
   * Der Lauf laeuft darunter weiter und wird nur ueberblendet — beim Landen
   * ist er dann sofort wieder da, ohne Anlaufzeit.
   */
  const warSprung = useRef(false);
  const warHecht = useRef(false);

  useEffect(() => {
    fleeFertig.current = false;
    const { flee, run, mixer } = bausatz;

    if (pose === 'flee') {
      run.fadeOut(0.15);
      flee.reset().fadeIn(0.05).play();
      const beiEnde = (e: { action: AnimationAction }): void => {
        if (e.action !== flee || fleeFertig.current) return;
        fleeFertig.current = true;
        onFleeFertig();
      };
      mixer.addEventListener('finished', beiEnde);
      return () => mixer.removeEventListener('finished', beiEnde);
    }

    if (pose === 'run') {
      flee.fadeOut(0.2);
      run.reset().fadeIn(0.2).play();
      return;
    }

    flee.stop();
    run.reset().play();
    bausatz.mixer.setTime(0);
    run.paused = true;
    return () => {
      run.paused = false;
    };
  }, [pose, bausatz, onFleeFertig]);

  useFrame((_, dt) => {
    // In der Pause friert auch die Lauf-Animation ein — eine strampelnde
    // Figur unter einem Pause-Blatt sieht aus, als liefe das Spiel weiter.
    if (spielstand.current.phase === 'pause') return;

    const gs = spielstand.current;
    const { sprung, hecht, run } = bausatz;

    if (gs.springt !== warSprung.current) {
      warSprung.current = gs.springt;
      if (gs.springt && sprung) {
        // Auf die Flugdauer strecken: hoch und runter dauern bei
        // v = 9 und g = 26 zusammen 2v/g ≈ 0,69 s.
        const flug = (2 * SPRUNGKRAFT) / -SCHWERKRAFT;
        sprung.reset();
        sprung.timeScale = sprung.getClip().duration / flug;
        sprung.fadeIn(0.06).play();
        run.fadeOut(0.06);
      } else if (!gs.springt && sprung) {
        sprung.fadeOut(0.12);
        run.reset().fadeIn(0.12).play();
      }
    }

    if (gs.rutscht !== warHecht.current) {
      warHecht.current = gs.rutscht;
      if (gs.rutscht && hecht) {
        hecht.reset();
        hecht.timeScale = hecht.getClip().duration / (RUTSCH_MS / 1000);
        hecht.fadeIn(0.05).play();
        run.fadeOut(0.05);
      } else if (!gs.rutscht && hecht) {
        hecht.fadeOut(0.12);
        run.reset().fadeIn(0.12).play();
      }
    }

    bausatz.mixer.update(dt);
    if (bausatz.hip) bausatz.hip.position.copy(bausatz.hipRuhe);
    bausatz.wurzel.position.y = bausatz.bodenY;
  });

  return <primitive object={bausatz.wurzel} />;
}

function FahrzeugModell({ art }: { art: FahrzeugArt }): React.JSX.Element {
  const gltf = useGLTF(FAHRZEUG_URL[art]);
  const modell = useMemo(
    () => baueStatisch(gltf.scene, FAHRZEUG_H[art]),
    [gltf.scene, art],
  );
  return <primitive object={modell} />;
}

function PropModell({ url, hoehe }: { url: string; hoehe: number }): React.JSX.Element {
  const gltf = useGLTF(url);
  const modell = useMemo(() => baueStatisch(gltf.scene, hoehe), [gltf.scene, hoehe]);
  return <primitive object={modell} />;
}

/**
 * Die Randdeko — Leben neben der Bahn, je Biom eigenes.
 *
 * Alles einfache Geometrie: kein Ladegewicht, keine Bestellung, und auf
 * Lauftempo zaehlt die Silhouette, nicht das Detail. Ohne Schlagschatten —
 * zweihundert Schattenwerfer ausserhalb der Spielflaeche kosten Bildrate
 * und erzaehlen nichts.
 */
function DekoBusch({ farbe = '#2f6b2f' }: { farbe?: string }): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]}>
        <sphereGeometry args={[0.55, 10, 8]} />
        <meshStandardMaterial color={farbe} />
      </mesh>
      <mesh position={[-0.35, 0.22, 0.15]}>
        <sphereGeometry args={[0.38, 8, 7]} />
        <meshStandardMaterial color={farbe} />
      </mesh>
      <mesh position={[0.32, 0.2, -0.1]}>
        <sphereGeometry args={[0.34, 8, 7]} />
        <meshStandardMaterial color="#275c28" />
      </mesh>
    </group>
  );
}

/** Laubbaum: Stamm und zwei Kronenkugeln. */
function DekoBaum({ krone, stamm = '#5c4030' }: { krone: string; stamm?: string }): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.1, 0.15, 1.4, 7]} />
        <meshStandardMaterial color={stamm} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.72, 10, 8]} />
        <meshStandardMaterial color={krone} />
      </mesh>
      <mesh position={[0.42, 1.25, 0.18]}>
        <sphereGeometry args={[0.45, 8, 7]} />
        <meshStandardMaterial color={krone} />
      </mesh>
    </group>
  );
}

/** Tanne: drei Kegel uebereinander, oben heller (Schnee im Schneefeld). */
function DekoTanne({ unten, oben }: { unten: string; oben: string }): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.08, 0.11, 0.5, 6]} />
        <meshStandardMaterial color="#4a3626" />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <coneGeometry args={[0.62, 1.0, 8]} />
        <meshStandardMaterial color={unten} />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <coneGeometry args={[0.46, 0.85, 8]} />
        <meshStandardMaterial color={unten} />
      </mesh>
      <mesh position={[0, 2.05, 0]}>
        <coneGeometry args={[0.3, 0.7, 8]} />
        <meshStandardMaterial color={oben} />
      </mesh>
    </group>
  );
}

/** Palme: geneigter Stamm, Wedel als flache Kegel rundum. */
function DekoPalme(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0.12, 0.9, 0]} rotation={[0, 0, -0.16]}>
        <cylinderGeometry args={[0.09, 0.14, 1.8, 7]} />
        <meshStandardMaterial color="#8a6f4a" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const winkel = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[0.24 + Math.cos(winkel) * 0.34, 1.82, Math.sin(winkel) * 0.34]}
            rotation={[Math.sin(winkel) * 0.9, 0, -0.5 - Math.cos(winkel) * 0.9]}
          >
            <coneGeometry args={[0.13, 0.95, 4]} />
            <meshStandardMaterial color="#3f8a4d" />
          </mesh>
        );
      })}
    </group>
  );
}

/** Kaktus: Saeule mit zwei Armen. */
function DekoKaktus(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 1.5, 8]} />
        <meshStandardMaterial color="#4a8a4d" />
      </mesh>
      <mesh position={[-0.34, 0.95, 0]} rotation={[0, 0, 0.9]}>
        <cylinderGeometry args={[0.11, 0.12, 0.55, 7]} />
        <meshStandardMaterial color="#4a8a4d" />
      </mesh>
      <mesh position={[-0.48, 1.25, 0]}>
        <cylinderGeometry args={[0.1, 0.11, 0.5, 7]} />
        <meshStandardMaterial color="#549457" />
      </mesh>
      <mesh position={[0.32, 0.7, 0]} rotation={[0, 0, -0.9]}>
        <cylinderGeometry args={[0.1, 0.11, 0.5, 7]} />
        <meshStandardMaterial color="#549457" />
      </mesh>
    </group>
  );
}

/** Fels: gedrungenes Zwoelfflach, wahlweise mit Glut- oder Goldsprenkeln. */
function DekoFels({
  farbe,
  sprenkel,
}: {
  farbe: string;
  sprenkel?: string;
}): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.32, 0]} scale={[1, 0.68, 1]} rotation={[0.2, 0.7, 0]}>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={farbe} />
      </mesh>
      {sprenkel && (
        <mesh position={[0.22, 0.5, 0.2]}>
          <sphereGeometry args={[0.09, 6, 5]} />
          <meshStandardMaterial color={sprenkel} emissive={sprenkel} emissiveIntensity={0.9} />
        </mesh>
      )}
    </group>
  );
}

/** Toter Baum: kahler Stamm mit zwei Aststummeln (Feuerberg). */
function DekoDuerrbaum(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} rotation={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.07, 0.13, 1.6, 6]} />
        <meshStandardMaterial color="#3a2620" />
      </mesh>
      <mesh position={[-0.25, 1.25, 0]} rotation={[0, 0, 1.0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.6, 5]} />
        <meshStandardMaterial color="#3a2620" />
      </mesh>
      <mesh position={[0.22, 0.95, 0.08]} rotation={[0.2, 0, -1.1]}>
        <cylinderGeometry args={[0.035, 0.05, 0.5, 5]} />
        <meshStandardMaterial color="#31201a" />
      </mesh>
    </group>
  );
}

/** Blumenbusch: Gruen mit drei Farbtupfern (Wiesen). */
function DekoBlumen(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.22, 0]}>
        <sphereGeometry args={[0.4, 8, 7]} />
        <meshStandardMaterial color="#4a8f5c" />
      </mesh>
      {[
        ['#e86a8a', -0.18, 0.44, 0.1],
        ['#f0d05a', 0.16, 0.5, -0.08],
        ['#ffffff', 0.02, 0.38, 0.24],
      ].map(([farbe, x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <sphereGeometry args={[0.09, 6, 5]} />
          <meshStandardMaterial color={farbe as string} />
        </mesh>
      ))}
    </group>
  );
}

/** Laterne: dunkler Pfosten, goldenes Licht (Sternenhafen). */
function DekoLaterne(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.6, 6]} />
        <meshStandardMaterial color="#26263a" />
      </mesh>
      <mesh position={[0, 1.68, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#ffd873" emissive="#e2b64f" emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

/**
 * Welche Deko in welcher Zone waechst.
 *
 * Drei Varianten je Biom, gewuerfelt je Platz: Heimat traegt Laubbaeume,
 * die Wiesen Blumen, der Strand Palmen und Kakteen, der Feuerberg
 * Glutfelsen und Duerrbaeume, das Schneefeld Tannen, der Sternenhafen
 * Laternen. Die Strecke erzaehlt damit dieselbe Reise wie der
 * Trophaeenpfad — nur im Vorbeirennen.
 */
function RandDeko({ biom, variante }: { biom: number; variante: number }): React.JSX.Element {
  if (biom === 0) {
    return variante === 0 ? (
      <DekoBaum krone="#3d6b35" />
    ) : variante === 1 ? (
      <DekoBusch />
    ) : (
      <DekoBaum krone="#4a7c3f" />
    );
  }
  if (biom === 1) {
    return variante === 0 ? (
      <DekoBaum krone="#58a06a" stamm="#8a7a5a" />
    ) : variante === 1 ? (
      <DekoBlumen />
    ) : (
      <DekoBusch farbe="#4a8f5c" />
    );
  }
  if (biom === 2) {
    return variante === 0 ? (
      <DekoPalme />
    ) : variante === 1 ? (
      <DekoKaktus />
    ) : (
      <DekoFels farbe="#b09468" />
    );
  }
  if (biom === 3) {
    return variante === 0 ? (
      <DekoFels farbe="#4a2c20" sprenkel="#e86a3a" />
    ) : variante === 1 ? (
      <DekoDuerrbaum />
    ) : (
      <DekoFels farbe="#5c3a2c" />
    );
  }
  if (biom === 4) {
    return variante === 0 ? (
      <DekoTanne unten="#3f6b52" oben="#e8f0f4" />
    ) : variante === 1 ? (
      <DekoFels farbe="#c8dcec" />
    ) : (
      <DekoTanne unten="#35594a" oben="#d4e0ea" />
    );
  }
  return variante === 0 ? (
    <DekoLaterne />
  ) : variante === 1 ? (
    <DekoFels farbe="#30304c" sprenkel="#e2b64f" />
  ) : (
    <DekoLaterne />
  );
}

/** Halbmaße eines Hindernisses — eine Stelle, Kollision und Drahtgitter. */
function kastenFuer(h: Hindernis): { x: number; z: number } {
  if (h.rolle === 'vehicle') return FAHRZEUG[h.fahrzeug];
  if (h.rolle === 'jump') return KASTEN[h.sprungProp];
  if (h.rolle === 'bush') return KASTEN[h.buschProp];
  return KASTEN[h.rutschProp];
}

function HindernisBild({ h }: { h: Hindernis }): React.JSX.Element {
  const kasten = kastenFuer(h);
  const hoehe =
    h.rolle === 'vehicle'
      ? FAHRZEUG_H[h.fahrzeug]
      : h.rolle === 'jump'
        ? SPRUNG_H[h.sprungProp]
        : h.rolle === 'bush'
          ? BUSCH_H[h.buschProp]
          : RUTSCH_H[h.rutschProp];
  return (
    <>
      <Suspense fallback={null}>
        {h.rolle === 'vehicle' ? (
          <FahrzeugModell art={h.fahrzeug} />
        ) : h.rolle === 'jump' ? (
          <PropModell url={propGlb(h.sprungProp)} hoehe={SPRUNG_H[h.sprungProp]} />
        ) : h.rolle === 'bush' ? (
          <PropModell url={propGlb(h.buschProp)} hoehe={BUSCH_H[h.buschProp]} />
        ) : (
          <PropModell url={propGlb(h.rutschProp)} hoehe={RUTSCH_H[h.rutschProp]} />
        )}
      </Suspense>
      {ZEIGE_KAESTEN && (
        <mesh position={[0, hoehe / 2, 0]}>
          <boxGeometry args={[kasten.x * 2, hoehe, kasten.z * 2]} />
          <meshBasicMaterial color="#ff4444" wireframe />
        </mesh>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Kamera, Uhr, Spieler
// ---------------------------------------------------------------------------

const KAMERA = { x: 0, y: 3.4, z: 5.8 } as const;
const BLICK = { y: 0.7, z: -4.0 } as const;

function KameraFuehrung({
  spielstand,
}: {
  spielstand: React.MutableRefObject<Spielstand>;
}): null {
  useFrame(({ camera }, delta) => {
    const gs = spielstand.current;
    const pos = gs.pos;
    const camY = KAMERA.y + Math.max(0, pos.y) * 0.35;
    /**
     * `delta` MUSS gekappt werden, bevor es in einen Lerp-Faktor geht.
     *
     * Im Hintergrund drosselt der Browser auf ~1 Bild je Sekunde; `delta`
     * wird sekundengroß, `8 × delta` liegt weit über 1, und der Lerp schießt
     * über das Ziel hinaus statt sich ihm zu nähern — die Kamera explodiert
     * ins Nichts, und nach dem Tab-Wechsel schaut man in den Himmel. Genau
     * so gefunden.
     */
    const dt = Math.min(delta, 0.05);

    // Kurzer Wackler nach dem Aufprall — abklingend, nicht schwindelig.
    const seitAufprall = performance.now() - gs.umgeranntUm;
    let wackelX = 0;
    let wackelY = 0;
    if (gs.umgeranntUm > 0 && seitAufprall < 320) {
      const staerke = 0.22 * (1 - seitAufprall / 320);
      wackelX = (Math.random() - 0.5) * staerke;
      wackelY = (Math.random() - 0.5) * staerke;
    }

    camera.position.x = MathUtils.lerp(camera.position.x, pos.x + KAMERA.x, 8 * dt) + wackelX;
    camera.position.y = MathUtils.lerp(camera.position.y, camY, 6 * dt) + wackelY;
    camera.position.z = SPIELER_Z + KAMERA.z;
    camera.lookAt(pos.x, BLICK.y + pos.y * 0.25, SPIELER_Z + BLICK.z);
  });
  return null;
}

/**
 * Die Uhr des Laufs — Strecke und Tempo, im Takt der Bilder.
 *
 * Vorher zählte ein `setInterval` +1 je 200 ms; "Meter" waren also Sekunden
 * mal fünf, egal wie schnell die Welt rollte. Jetzt wird das Tempo
 * aufintegriert: Die Meterzahl ist die Strecke, die die Welt wirklich
 * zurückgelegt hat, und das Tempo hängt an der Strecke statt an der Uhrzeit.
 */
function Laufuhr({ spielstand }: { spielstand: React.MutableRefObject<Spielstand> }): null {
  useFrame((_, delta) => {
    const gs = spielstand.current;
    if (gs.phase !== 'run') return;
    const dt = Math.min(delta, 0.05);
    gs.distanz += gs.tempo * dt;
    gs.tempo = Math.min(TEMPO_MAX, TEMPO_BASIS + gs.distanz * TEMPO_JE_METER);
  });
  return null;
}

/**
 * Himmel und Nebel gleiten dem Biom hinterher.
 *
 * `<color>` und `<fog>` sind einmal gesetzt; hier werden ihre Farben je Bild
 * ein Stück Richtung Zielton gezogen. Gleiten statt Springen, weil der
 * Zonenwechsel sonst als Farbblitz über den ganzen Bildschirm ginge.
 */
function BiomStimmung({
  spielstand,
}: {
  spielstand: React.MutableRefObject<Spielstand>;
}): null {
  const ziele = useMemo(() => BIOME_LOOK.map((b) => new Color(b.himmel)), []);
  useFrame(({ scene }, delta) => {
    const dt = Math.min(delta, 0.05);
    const ziel = ziele[biomIdxFuer(spielstand.current.distanz)]!;
    const takt = Math.min(1, 1.2 * dt);
    if (scene.fog) scene.fog.color.lerp(ziel, takt);
    if (scene.background instanceof Color) scene.background.lerp(ziel, takt);
  });
  return null;
}

/**
 * Was man an der Figur sieht, wenn eine Kraft laeuft.
 *
 * **An der Figur, nicht im HUD.** Die Chips oben sagen, wie lange noch; sie
 * sagen nicht, dass gerade etwas mit DIR passiert. Wer rennt, schaut auf
 * die Figur — dort gehoert das Zeichen hin.
 *
 * Geschaltet wird in `useFrame` und nicht ueber React: Die Kraefte leben im
 * Spielstand-Ref und aendern sich mitten im Lauf; ein setState je Aufnahme
 * waere ein Rendern des ganzen Menuebaums fuer eine Kugel.
 */
function Kraftzeichen({
  spielstand,
}: {
  spielstand: React.MutableRefObject<Spielstand>;
}): React.JSX.Element {
  const schildGltf = useGLTF(KRAFT_SCHILD_GLB);
  const magnetGltf = useGLTF(KRAFT_MAGNET_GLB);

  /**
   * Die Kugel wird durchsichtig gemacht — im Modell ist sie es nicht.
   *
   * Geliefert wurde sie mit `alphaMode: OPAQUE`; die Durchsichtigkeit steht
   * deshalb hier und nicht in der Datei. Das ist auch die bessere Stelle:
   * `depthWrite = false` gehoert zwingend dazu, sonst verdeckt die
   * Vorderseite der Kugel die Figur darin, und man rennt in einer
   * milchigen Murmel. `side = DoubleSide`, damit auch die Rueckwand steht.
   */
  const schildSzene = useMemo(() => {
    const kopie = schildGltf.scene.clone(true);
    kopie.traverse((o: Object3D) => {
      const mesh = o as MeshType;
      if (!mesh.isMesh) return;
      const m = (mesh.material as MeshStandardMaterial).clone();
      m.transparent = true;
      m.opacity = 0.5;
      m.depthWrite = false;
      m.side = DoubleSide;
      mesh.material = m;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
    });
    passeHoehe(kopie, 1.55);
    return kopie;
  }, [schildGltf.scene]);

  const magnetSzene = useMemo(() => {
    const kopie = magnetGltf.scene.clone(true);
    kopie.traverse((o: Object3D) => {
      const mesh = o as MeshType;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.frustumCulled = false;
    });
    // Das Modell liegt flach (Hoehe 0,15 bei Breite 1,0) — aufrichten,
    // sonst schwebt eine Scheibe neben der Flosse.
    kopie.rotation.x = -Math.PI / 2;
    passeHoehe(kopie, 0.34);
    return kopie;
  }, [magnetGltf.scene]);

  const schild = useRef<Group>(null);
  const magnet = useRef<Group>(null);
  const zeit = useRef(0);

  useFrame((_, delta) => {
    const gs = spielstand.current;
    if (gs.phase === 'pause') return;
    zeit.current += delta;
    const jetzt = performance.now();

    const s = schild.current;
    if (s) {
      s.visible = gs.schild;
      if (gs.schild) {
        // Atmen statt Blinken: Eine Kugel, die pulsiert, liest sich als
        // Schutz; eine, die blinkt, als Warnung.
        s.scale.setScalar(1 + Math.sin(zeit.current * 2.6) * 0.045);
        s.rotation.y += delta * 0.6;
      }
    }

    const m = magnet.current;
    if (m) {
      const an = jetzt < gs.magnetBis;
      m.visible = an;
      if (an) {
        // An der Flosse, leicht schwebend und mitwippend — so sieht man,
        // dass die Figur ihn traegt, statt dass er im Raum klebt.
        m.position.y = 0.6 + Math.sin(zeit.current * 4) * 0.04;
        m.rotation.z = Math.sin(zeit.current * 2) * 0.22;
      }
    }
  });

  return (
    <group>
      <group ref={schild} visible={false} position={[0, 0.58, 0]}>
        <primitive object={schildSzene} />
      </group>
      <group ref={magnet} visible={false} position={[0.46, 0.6, 0.05]}>
        <primitive object={magnetSzene} />
      </group>
    </group>
  );
}

function Spieler({
  spielstand,
  pose,
  onFleeFertig,
}: {
  spielstand: React.MutableRefObject<Spielstand>;
  pose: Pose;
  onFleeFertig: () => void;
}): React.JSX.Element {
  const laufRef = useRef<Group>(null);
  const koerperRef = useRef<Group>(null);

  useFrame((_, delta) => {
    const gs = spielstand.current;
    const lauf = laufRef.current;
    const koerper = koerperRef.current;
    if (!lauf) return;
    if (gs.phase === 'pause') return;
    const dt = Math.min(delta, 0.05);

    /**
     * Nach dem Aufprall fällt die Figur nach vorn um, statt zu erstarren.
     * Kein Clip nötig: Der Körper kippt um die Fußkante, ein paar Grad je
     * Bild, und bleibt liegen. Danach passiert hier nichts mehr.
     */
    if (gs.phase === 'dead') {
      if (koerper) {
        koerper.rotation.x = MathUtils.lerp(koerper.rotation.x, -1.35, 7 * dt);
        koerper.scale.y = MathUtils.lerp(koerper.scale.y, 1, 10 * dt);
      }
      return;
    }

    const zielX = gs.spur * SPUR_BREITE;
    const wechselDauer = 170;
    const fortschritt = Math.min(1, (performance.now() - gs.spurWechselUm) / wechselDauer);
    const kurve = 1 - Math.pow(1 - fortschritt, 3);
    lauf.position.x = gs.spurVonX + (zielX - gs.spurVonX) * kurve;

    if (gs.rutscht && performance.now() >= gs.rutschtBis) {
      gs.rutscht = false;
    }

    if (gs.springt) {
      gs.sprungV += SCHWERKRAFT * dt;
      lauf.position.y += gs.sprungV * dt;
      if (lauf.position.y <= BODEN_Y) {
        lauf.position.y = BODEN_Y;
        gs.springt = false;
        gs.sprungV = 0;
        gs.gelandetUm = performance.now();
        const jetzt = performance.now();
        /**
         * Beim Aufsetzen zuerst der Rutschwunsch, dann der Sprungwunsch.
         *
         * Die Reihenfolge ist Absicht: Wer im Flug nach unten gewischt hat,
         * meinte diesen Boden hier — ein gleichzeitig gepufferter Sprung
         * waere ein aelterer Wunsch und wuerde den Abbruch aufheben.
         */
        if (jetzt - gs.rutschPuffer < 400) {
          gs.rutschPuffer = 0;
          gs.sprungPuffer = 0;
          gs.rutscht = true;
          gs.rutschtBis = jetzt + RUTSCH_MS;
        } else if (jetzt - gs.sprungPuffer < 140) {
          gs.sprungPuffer = 0;
          gs.springt = true;
          gs.sprungV = SPRUNGKRAFT;
        }
      }
    } else {
      lauf.position.y = BODEN_Y;
    }

    if (koerper) {
      /**
       * Der Körper erzählt, was passiert — ohne eigene Clips:
       * - Rutschen: zusammenducken (Skala Y), Füße bleiben am Boden.
       * - Sprung: leicht strecken; Landung: 120 ms stauchen. Das Strecken
       *   und Stauchen ist der halbe Sprung — ohne fühlt er sich an, als
       *   würde die Figur nur verschoben.
       * - Spurwechsel: in die Kurve legen (Rollwinkel aus dem Restweg).
       */
      const jetzt = performance.now();
      const staucht = jetzt - gs.gelandetUm < 120;
      const duck = gs.rutscht ? RUTSCH_SKALA_Y : staucht ? 0.86 : gs.springt ? 1.08 : 1;
      const breit = gs.rutscht ? 1.06 : staucht ? 1.1 : gs.springt ? 0.96 : 1;
      const nick = gs.rutscht ? 0.5 : gs.springt ? -0.2 : 0;
      const roll = MathUtils.clamp((lauf.position.x - zielX) * 0.28, -0.32, 0.32);

      koerper.scale.y = MathUtils.lerp(koerper.scale.y, duck, 16 * dt);
      koerper.scale.x = MathUtils.lerp(koerper.scale.x, breit, 16 * dt);
      koerper.scale.z = MathUtils.lerp(koerper.scale.z, 1, 16 * dt);
      koerper.rotation.x = MathUtils.lerp(koerper.rotation.x, nick, 14 * dt);
      koerper.rotation.z = MathUtils.lerp(koerper.rotation.z, roll, 12 * dt);
    }

    gs.pos.copy(lauf.position);
    gs.kopfY = gs.pos.y + (gs.rutscht ? RUTSCH_KOPF_Y : PINGUIN_HOEHE);
  });

  return (
    <group ref={laufRef} position={[0, BODEN_Y, SPIELER_Z]}>
      <group ref={koerperRef}>
        <Suspense fallback={null}>
          <AnimierterPinguin pose={pose} spielstand={spielstand} onFleeFertig={onFleeFertig} />
        </Suspense>
      </group>
      {/* Ausserhalb von `koerperRef`: Die Kugel soll nicht mitducken, wenn
          die Figur rutscht, und beim Umfallen nicht mitkippen. Eigene
          Suspense-Grenze, weil `useGLTF` anhaelt — ohne sie haengt der
          ganze Spieler am Laden zweier Zierteile. */}
      <Suspense fallback={null}>
        <Kraftzeichen spielstand={spielstand} />
      </Suspense>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={2.6} blur={2.2} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Weltstücke
// ---------------------------------------------------------------------------

interface Kacheln {
  readonly boden: readonly Texture[];
  readonly rand: readonly Texture[];
}

/**
 * Laedt die gemalten Kacheln — **ohne Suspense**, mit einem Effekt.
 *
 * Der Weg ueber `useTexture` (drei) hielt die Leinwand an und kam nicht
 * wieder heraus: Alle zwoelf Dateien wurden mit 200 ausgeliefert, die
 * Suspense loeste trotzdem nie auf, und man stand dauerhaft im Ladetext.
 * Mit `TextureLoader` von Hand gibt es nichts anzuhalten — die Bahn steht
 * sofort in ihrer Biomfarbe da und bekommt ihr Bild, sobald es geladen
 * ist. Das ist hier ohnehin das bessere Verhalten: Der Boden ist Kulisse,
 * kein Spielobjekt, und niemand soll auf ihn warten muessen.
 *
 * Geladen wird einmal fuer alle sechs Chunks; eingestellt ebenfalls einmal
 * je Datei. Kein `clone()` je Chunk — alle brauchen dieselbe Wiederholung,
 * und zwoelf zusaetzliche 1024er-Texturen kosteten den WebGL-Kontext.
 */
function useKacheln(): Kacheln | null {
  const [kacheln, setKacheln] = useState<Kacheln | null>(null);

  useEffect(() => {
    let lebt = true;
    const lader = new TextureLoader();
    const hole = (url: string, wieder: [number, number]): Promise<Texture> =>
      new Promise((fertig, daneben) => {
        lader.load(
          url,
          (tex) => {
            tex.wrapS = RepeatWrapping;
            tex.wrapT = RepeatWrapping;
            tex.colorSpace = SRGBColorSpace;
            tex.repeat.set(wieder[0], wieder[1]);
            tex.needsUpdate = true;
            fertig(tex);
          },
          undefined,
          daneben,
        );
      });

    void Promise.all([
      Promise.all(BODEN_URLS.map((u) => hole(u, [1, BODEN_WIEDERHOLUNG]))),
      Promise.all(RAND_URLS.map((u) => hole(u, [RAND_WIEDERHOLUNG, 1]))),
    ])
      .then(([boden, rand]) => {
        if (!lebt) {
          for (const tex of [...boden, ...rand]) tex.dispose();
          return;
        }
        setKacheln({ boden, rand });
      })
      // Fehlt eine Datei, bleibt es bei den Biomfarben — kein weisser
      // Boden, kein Absturz.
      .catch(() => undefined);

    return () => {
      lebt = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (!kacheln) return;
      for (const tex of [...kacheln.boden, ...kacheln.rand]) tex.dispose();
    },
    [kacheln],
  );

  return kacheln;
}

function WeltChunk({
  index,
  spielstand,
  onMuenze,
  onTreffer,
  onKraft,
  neustartMarke,
  kacheln,
}: {
  index: number;
  spielstand: React.MutableRefObject<Spielstand>;
  onMuenze: () => void;
  onTreffer: () => void;
  onKraft: (art: KraftArt) => void;
  neustartMarke: number;
  /** Die gemalten Kacheln, einmal geladen (siehe `Welt`). */
  kacheln: Kacheln | null;
}): React.JSX.Element {
  const gruppeRef = useRef<Group>(null);
  const plaetzeRef = useRef<Platz[]>(baueChunk(index * -CHUNK_LAENGE, 0));
  const hindernisGruppen = useRef<(Group | null)[]>([]);
  const muenzenRef = useRef<(MeshType | null)[]>([]);
  const kraftRef = useRef<KraftPlatz>({ art: 'magnet', spur: 0, z: 0, aktiv: false });
  const kraftGruppe = useRef<Group>(null);
  const trefferSperre = useRef(false);
  const neuaufbauLaeuft = useRef(false);
  const [layoutMarke, setLayoutMarke] = useState(0);
  const [biom, setBiom] = useState(0);

  /** Würfelt die Kraft dieses Chunks — auf der freien Spur, nie im Hindernis. */
  const legeKraft = useCallback((chunkZ: number) => {
    const arten: readonly KraftArt[] = ['magnet', 'schild', 'doppel'];
    const plaetze = plaetzeRef.current;
    const spur = pfadSpur;
    // Auch der Kraft-Token sucht sich seine Stelle — und muss zusaetzlich
    // Abstand zu den Muenzreihen halten, sonst steckt er in einer Muenze.
    const z = freieStelle(plaetze, spur, -CHUNK_LAENGE / 2 + 4, CHUNK_LAENGE / 2 - 4);
    const nochHin = z === null ? 0 : SPIELER_Z - (chunkZ + z);
    kraftRef.current = {
      art: zufall(arten),
      spur,
      z: z ?? 0,
      aktiv: z !== null && Math.random() < KRAFT_CHANCE && nochHin >= ANLAUF_M,
    };
  }, []);

  /**
   * Münzen liegen als Dreierreihe auf dem begehbaren Pfad — nie in einem
   * Hindernis. Vorher schwebten sie einzeln auf zufälligen Spuren in
   * zufälliger Höhe; die Hälfte war unerreichbar oder saß in einer Kiste.
   */
  const legeMuenzen = useCallback((chunkZ: number) => {
    const plaetze = plaetzeRef.current;
    const reihen = [0, 1] as const;
    for (const reihe of reihen) {
      const spur = pfadSpur;
      /**
       * Der Anfang der Dreierreihe wird gesucht, nicht gesetzt.
       *
       * Gepruft wird die GANZE Reihe: Eine Stelle, an der nur die erste
       * Muenze frei liegt, hilft nichts — die dritte staeke dann in der
       * Kiste. Findet sich nichts, bleibt die Reihe aus; lieber keine
       * Muenzen als Muenzen im Hindernis.
       */
      const von = -CHUNK_LAENGE / 2 + 4 + reihe * (CHUNK_LAENGE / 2 - 2);
      const bis = von + 3;
      let startZ: number | null = null;
      for (let versuch = 0; versuch < 8; versuch++) {
        const kandidat = von + Math.random() * (bis - von);
        if (![0, 1, 2].some((i) => belegt(plaetze, spur, kandidat + i * 1.7))) {
          startZ = kandidat;
          break;
        }
      }
      for (let i = 0; i < 3; i++) {
        const muenze = muenzenRef.current[reihe * 3 + i];
        if (!muenze) continue;
        if (startZ === null) {
          muenze.userData.lebt = false;
          muenze.visible = false;
          continue;
        }
        const lokalZ = startZ + i * 1.7;
        muenze.position.set(spur * SPUR_BREITE, 0.55, lokalZ);
        const nochHin = SPIELER_Z - (chunkZ + lokalZ);
        muenze.userData.lebt = Math.random() > 0.25 && nochHin >= ANLAUF_M * 0.5;
        muenze.visible = false;
      }
    }
  }, []);

  /** Neues Layout — setState nie synchron in useFrame. */
  const recycle = useCallback(() => {
    trefferSperre.current = false;
    const z = gruppeRef.current?.position.z ?? index * -CHUNK_LAENGE;
    const distanz = spielstand.current.distanz;
    plaetzeRef.current = baueChunk(z, distanz);
    legeMuenzen(z);
    legeKraft(z);
    const neuesBiom = biomIdxFuer(distanz);
    if (neuaufbauLaeuft.current) return;
    neuaufbauLaeuft.current = true;
    queueMicrotask(() => {
      neuaufbauLaeuft.current = false;
      setBiom(neuesBiom);
      setLayoutMarke((k) => k + 1);
    });
  }, [index, legeMuenzen, legeKraft, spielstand]);

  useEffect(() => {
    const z = index * -CHUNK_LAENGE;
    if (gruppeRef.current) gruppeRef.current.position.z = z;
    trefferSperre.current = false;
    plaetzeRef.current = baueChunk(z, 0);
    legeMuenzen(z);
    legeKraft(z);
    setBiom(0);
    setLayoutMarke((k) => k + 1);
  }, [index, neustartMarke, legeMuenzen, legeKraft]);

  useFrame((_, delta) => {
    const gs = spielstand.current;
    const gruppe = gruppeRef.current;
    if (!gruppe) return;

    const rollt = gs.phase === 'run';
    const sichtbar = gs.phase === 'run' || gs.phase === 'pause' || gs.phase === 'dead';
    const plaetze = plaetzeRef.current;
    const dt = Math.min(delta, 0.05);

    const jetzt = performance.now();

    for (let p = 0; p < plaetze.length; p++) {
      const platz = plaetze[p]!;
      for (let h = 0; h < 2; h++) {
        const hindernis = platz.hindernisse[h]!;
        const g = hindernisGruppen.current[p * 2 + h];
        if (!g) continue;
        g.visible = sichtbar && hindernis.aktiv;
        // Fahrzeuge kommen einem entgegen: eigener Vortrieb auf die Kamera zu.
        if (rollt && hindernis.aktiv && hindernis.rolle === 'vehicle') {
          hindernis.fahrt += FAHRZEUG[hindernis.fahrzeug].tempo * dt;
        }
        g.position.set(hindernis.spur * SPUR_BREITE, 0, platz.z + hindernis.fahrt);

        /**
         * Ueberrollt: kippt zur Seite, sackt in den Boden, dreht sich weg.
         *
         * Kein Truemmerteilchen-System — eine halbe Sekunde Kippen und
         * Versinken erzaehlt "das hat das Auto erwischt" genauso gut und
         * kostet nichts. Danach ist das Stueck weg.
         */
        if (hindernis.zerlegtUm > 0) {
          const seit = (jetzt - hindernis.zerlegtUm) / 550;
          if (seit >= 1) {
            hindernis.aktiv = false;
            hindernis.zerlegtUm = 0;
            g.visible = false;
          } else {
            g.rotation.z = seit * 1.5;
            g.rotation.y = seit * 2.2;
            g.position.y = -seit * 0.55;
            const schrumpf = 1 - seit * 0.35;
            g.scale.set(schrumpf, schrumpf, schrumpf);
          }
        } else {
          g.rotation.set(0, 0, 0);
          g.scale.set(1, 1, 1);
        }
      }
    }

    // Die Kraft dreht und schwebt — auch in der Pause sichtbar, nur eingefroren.
    const kraft = kraftRef.current;
    const kg = kraftGruppe.current;
    if (kg) {
      kg.visible = sichtbar && kraft.aktiv;
      if (rollt) {
        kg.rotation.y += 2.2 * dt;
        kg.userData.t = ((kg.userData.t as number) ?? 0) + dt;
        kg.position.y = 0.62 + Math.sin((kg.userData.t as number) * 3) * 0.07;
      }
    }

    if (!rollt) return;

    gruppe.position.z += gs.tempo * dt;

    if (gruppe.position.z > CHUNK_LAENGE) {
      gruppe.position.z -= ANZAHL_CHUNKS * CHUNK_LAENGE;
      recycle();
    }

    const pos = gs.pos;

    /**
     * Die Sonderregel: Ein Fahrzeug walzt nieder, was auf seiner Spur steht.
     *
     * Es faehrt einem entgegen und trifft dabei zwangslaeufig Kisten, Tore
     * und Muenzen — die stehen zu lassen sah aus, als fuehre das Auto durch
     * sie hindurch. Jetzt raeumt es sie weg: Hindernisse kippen und
     * versinken, Muenzen und Kraefte verschwinden schlicht (sie sind
     * eingesammelt worden — vom Auto).
     *
     * Nur ueberrollte Sachen, nie der Spieler: Der steht bei SPIELER_Z,
     * geraeumt wird ausschliesslich vor dem Auto.
     */
    for (let p = 0; p < plaetze.length; p++) {
      const platz = plaetze[p]!;
      for (let h = 0; h < 2; h++) {
        const auto = platz.hindernisse[h]!;
        if (!auto.aktiv || auto.rolle !== 'vehicle') continue;
        const autoZ = platz.z + auto.fahrt;
        const reichweite = FAHRZEUG[auto.fahrzeug].z;

        for (let q = 0; q < plaetze.length; q++) {
          const anderer = plaetze[q]!;
          for (let k = 0; k < 2; k++) {
            const opfer = anderer.hindernisse[k]!;
            if (opfer === auto || !opfer.aktiv || opfer.zerlegtUm > 0) continue;
            if (opfer.rolle === 'vehicle' || opfer.spur !== auto.spur) continue;
            const opferZ = anderer.z + opfer.fahrt;
            if (Math.abs(opferZ - autoZ) < reichweite + 0.6) {
              opfer.zerlegtUm = jetzt;
              spiele('fehler', 0.3);
            }
          }
        }

        for (const muenze of muenzenRef.current) {
          if (!muenze || muenze.userData.lebt === false) continue;
          if (Math.abs(muenze.position.x - auto.spur * SPUR_BREITE) > 0.6) continue;
          if (Math.abs(muenze.position.z - autoZ) < reichweite + 0.4) {
            muenze.userData.lebt = false;
            muenze.visible = false;
          }
        }

        if (kraft.aktiv && kraft.spur === auto.spur && Math.abs(kraft.z - autoZ) < reichweite + 0.4) {
          kraft.aktiv = false;
          if (kg) kg.visible = false;
        }
      }
    }

    if (kraft.aktiv && kg) {
      const kraftWeltZ = gruppe.position.z + kraft.z;
      if (Math.abs(pos.x - kraft.spur * SPUR_BREITE) < 0.9 && Math.abs(pos.z - kraftWeltZ) < 1.1) {
        kraft.aktiv = false;
        kg.visible = false;
        onKraft(kraft.art);
      }
    }

    for (let p = 0; p < plaetze.length; p++) {
      const platz = plaetze[p]!;
      for (let h = 0; h < 2; h++) {
        const hindernis = platz.hindernisse[h]!;
        // Was gerade zerlegt wird, ist kein Hindernis mehr — sonst stirbt
        // man an einer Kiste, die sichtbar schon zur Seite kippt.
        if (!hindernis.aktiv || hindernis.zerlegtUm > 0) continue;

        const kasten = kastenFuer(hindernis);
        const weltZ = gruppe.position.z + platz.z + hindernis.fahrt;
        const dx = Math.abs(pos.x - hindernis.spur * SPUR_BREITE);
        const dz = Math.abs(pos.z - weltZ);
        if (dx >= (kasten.x + SPIELER_BREIT) * NACHSICHT) continue;
        if (dz >= (kasten.z + SPIELER_BREIT) * NACHSICHT) continue;

        let getroffen = false;
        if (hindernis.rolle === 'jump' || hindernis.rolle === 'bush') {
          getroffen = pos.y < sprungFrei(hindernis);
        } else if (hindernis.rolle === 'slide') {
          getroffen = gs.kopfY > TOR_LUECKE[hindernis.rutschProp];
        } else {
          getroffen = pos.y < FAHRZEUG[hindernis.fahrzeug].frei;
        }

        if (getroffen && !trefferSperre.current) {
          if (gs.schild) {
            /**
             * Der Schild nimmt den Treffer: Hindernis verschwindet, der Lauf
             * geht weiter. Verschwinden statt Durchlaufen, weil ein Hindernis,
             * in dem man drinsteht, sonst im nächsten Bild gleich nochmal
             * trifft.
             */
            gs.schild = false;
            hindernis.aktiv = false;
            const g = hindernisGruppen.current[p * 2 + h];
            if (g) g.visible = false;
            spiele('schalter');
            continue;
          }
          trefferSperre.current = true;
          onTreffer();
        }
      }
    }

    const magnetAn = performance.now() < gs.magnetBis;
    for (const muenze of muenzenRef.current) {
      if (!muenze) continue;
      const lebt = muenze.userData.lebt !== false;
      muenze.visible = sichtbar && lebt;
      if (!lebt) continue;
      muenze.rotation.y += 3 * dt;
      const weltZ = gruppe.position.z + muenze.position.z;
      /**
       * Magnet: Münzen im Umkreis fliegen dem Spieler entgegen. Lokal
       * verschoben — die Chunk-Gruppe steht im Bild fest, also ist ein
       * lokales Delta dasselbe wie ein Welt-Delta.
       */
      if (magnetAn) {
        const zugX = pos.x - muenze.position.x;
        const zugZ = pos.z - weltZ;
        if (Math.hypot(zugX, zugZ) < 7) {
          const takt = Math.min(1, 9 * dt);
          muenze.position.x += zugX * takt;
          muenze.position.z += zugZ * takt;
        }
      }
      const dx = Math.abs(pos.x - muenze.position.x);
      const dz = Math.abs(pos.z - (gruppe.position.z + muenze.position.z));
      const dy = Math.abs(pos.y + 0.55 - muenze.position.y);
      if (dx < 0.9 && dz < 1.0 && dy < 0.95) {
        muenze.userData.lebt = false;
        muenze.visible = false;
        onMuenze();
      }
    }
  });

  const look = BIOME_LOOK[biom]!;
  const gras = index % 2 === 0 ? look.grasA : look.grasB;

  const bodenTex = kacheln?.boden[biom] ?? null;
  const randTex = kacheln?.rand[biom] ?? null;
  const kraft = kraftRef.current;
  const plaetze = plaetzeRef.current;

  /**
   * Bodenflecken — je Recycle neu gewuerfelt, damit die Strecke nicht als
   * Muster auffliegt. Am Rand der Fahrbahn, nie mittig unter der Figur:
   * Dort wuerden sie wie ein Hindernis lesen, das keines ist.
   */
  const flecken = useMemo(() => {
    void layoutMarke;
    return Array.from({ length: 5 }, () => ({
      x: (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random() * 2.2),
      z: (Math.random() - 0.5) * (CHUNK_LAENGE - 3),
      r: 0.35 + Math.random() * 0.55,
      dreh: Math.random() * Math.PI,
    }));
  }, [layoutMarke]);

  /** Bordstein-Bloecke: 2 m Raster, Farben im Wechsel — das Lauftempo
      liest man an ihnen ab, nicht an der leeren Flaeche. */
  const kanten = Array.from({ length: Math.floor(CHUNK_LAENGE / 2) }, (_, i) => i);

  /**
   * Randdeko: je Seite vier Plaetze mit Wuerfel-Zutat — Stelle, Abstand,
   * Sorte, Groesse, Drehung. Je Recycle neu, damit kein Muster entsteht;
   * der Abstand haelt alles klar hinter Bordstein und Hecke.
   */
  const deko = useMemo(() => {
    void layoutMarke;
    const plaetze: {
      seite: -1 | 1;
      z: number;
      abstand: number;
      variante: number;
      gr: number;
      dreh: number;
    }[] = [];
    for (const seite of [-1, 1] as const) {
      for (let i = 0; i < 4; i++) {
        plaetze.push({
          seite,
          z: -CHUNK_LAENGE / 2 + 2.5 + i * 6.5 + (Math.random() - 0.5) * 3.5,
          abstand: Math.random() * 1.9,
          variante: Math.floor(Math.random() * 3),
          gr: 0.8 + Math.random() * 0.55,
          dreh: Math.random() * Math.PI * 2,
        });
      }
    }
    return plaetze;
  }, [layoutMarke]);

  return (
    <group ref={gruppeRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SPUR_BREITE * 3 + 2, CHUNK_LAENGE]} />
        {/* Die gemalte Kachel; `color` bleibt als Rueckfall stehen, falls
            eine Datei fehlt — dann ist die Bahn einfarbig statt weiss. */}
        <meshStandardMaterial map={bodenTex} color={bodenTex ? '#ffffff' : gras} />
      </mesh>

      {/* Flecken knapp ueber dem Boden gegen Z-Flimmern. */}
      {flecken.map((f, i) => (
        <mesh
          key={`fleck-${layoutMarke}-${i}`}
          rotation={[-Math.PI / 2, 0, f.dreh]}
          position={[f.x, 0.012, f.z]}
        >
          <circleGeometry args={[f.r, 7]} />
          <meshStandardMaterial color={look.fleck} transparent opacity={0.5} />
        </mesh>
      ))}

      {/*
        Gestrichelte Trennlinien ZWISCHEN den Spuren statt durchgezogener
        Linien AUF den Spuren. Zweierlei gewonnen: Die Spurmitte gehoert
        wieder der Figur und den Muenzen, und die vorbeiziehenden Striche
        machen das Tempo sichtbar — eine durchgezogene Linie bewegt sich
        fuers Auge nicht.
      */}
      {([-0.5, 0.5] as const).map((seite) =>
        Array.from({ length: Math.floor(CHUNK_LAENGE / 2.4) }, (_, i) => (
          <mesh
            key={`strich-${seite}-${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[seite * SPUR_BREITE, 0.02, -CHUNK_LAENGE / 2 + 1 + i * 2.4]}
            receiveShadow
          >
            <planeGeometry args={[0.14, 1.3]} />
            <meshStandardMaterial color={look.linie} />
          </mesh>
        )),
      )}

      {/* Bordsteine, dann eine niedrigere Hecke dahinter: Zwei Kanten mit
          Versatz lesen sich als Strassenrand, ein hoher brauner Block las
          sich als Betonwand. */}
      {[-1, 1].map((seite) =>
        kanten.map((i) => (
          <mesh
            key={`kante-${seite}-${i}`}
            position={[seite * (SPUR_BREITE * 1.5 + 0.42), 0.09, -CHUNK_LAENGE / 2 + 1 + i * 2]}
            castShadow
          >
            <boxGeometry args={[0.34, 0.18, 1.9]} />
            <meshStandardMaterial color={i % 2 === 0 ? look.kanteA : look.kanteB} />
          </mesh>
        )),
      )}
      {/* Die Randleiste als senkrechte Flaeche zu beiden Seiten statt eines
          Quaders: Ein Quader zeigt die Leiste auf allen sechs Flanken, und
          die Oberseite laege quer zur Kachelrichtung. */}
      {[-1, 1].map((seite) => (
        <mesh
          key={`rand-${seite}`}
          position={[seite * (SPUR_BREITE * 1.5 + 0.85), 0.45, 0]}
          rotation={[0, seite > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <planeGeometry args={[CHUNK_LAENGE, 0.9]} />
          <meshStandardMaterial map={randTex} color={randTex ? '#ffffff' : look.rand} />
        </mesh>
      ))}

      {deko.map((d, i) => (
        <group
          key={`deko-${layoutMarke}-${i}`}
          position={[d.seite * (SPUR_BREITE * 1.5 + 1.35 + d.abstand), 0, d.z]}
          rotation={[0, d.dreh, 0]}
          scale={[d.gr, d.gr, d.gr]}
        >
          <RandDeko biom={biom} variante={d.variante} />
        </group>
      ))}

      {plaetze.map((platz, p) =>
        platz.hindernisse.map((hindernis, h) => (
          <group
            key={`${layoutMarke}-${p}-${h}`}
            ref={(el) => {
              hindernisGruppen.current[p * 2 + h] = el;
            }}
            position={[hindernis.spur * SPUR_BREITE, 0, platz.z]}
            visible={false}
          >
            {hindernis.aktiv && <HindernisBild h={hindernis} />}
          </group>
        )),
      )}

      {/*
        Der Kraft-Token: einfache Geometrie mit klarer Farbsprache statt
        eines Modells, das es nicht gibt. Rot-Ring = Magnet, blaues Achteck
        = Schild, zwei Goldscheiben = Doppel. Leichtes Eigenleuchten, damit
        er auch im Sternenhafen-Dunkel lesbar bleibt.
      */}
      <group
        key={`kraft-${layoutMarke}`}
        ref={kraftGruppe}
        position={[kraft.spur * SPUR_BREITE, 0.62, kraft.z]}
        visible={false}
      >
        {kraft.art === 'magnet' && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32, 0.11, 10, 20]} />
            <meshStandardMaterial color="#e8433a" emissive="#8a1f18" emissiveIntensity={0.5} />
          </mesh>
        )}
        {kraft.art === 'schild' && (
          <mesh>
            <octahedronGeometry args={[0.36, 0]} />
            <meshStandardMaterial color="#5ea0f0" emissive="#1f4a8a" emissiveIntensity={0.55} />
          </mesh>
        )}
        {kraft.art === 'doppel' && (
          <group>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[-0.12, 0, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.07, 16]} />
              <meshStandardMaterial color="#e8b84a" emissive="#9a6b10" emissiveIntensity={0.4} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.14, 0.1, 0]}>
              <cylinderGeometry args={[0.28, 0.28, 0.07, 16]} />
              <meshStandardMaterial color="#ffd873" emissive="#9a6b10" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )}
      </group>

      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={`muenze-${i}`}
          ref={(el) => {
            muenzenRef.current[i] = el;
          }}
          position={[0, 0.55, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          visible={false}
        >
          <cylinderGeometry args={[0.35, 0.35, 0.08, 16]} />
          <meshStandardMaterial
            color="#e8b84a"
            metalness={0.55}
            roughness={0.3}
            emissive="#9a6b10"
            emissiveIntensity={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Der Bildschirm
// ---------------------------------------------------------------------------

export function Runner({
  hubMode = false,
  onBack,
}: {
  /** Aus der Spielauswahl: Münzen gehen ins Hub-Konto. */
  hubMode?: boolean;
  onBack?: () => void;
} = {}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('menu');
  const [anzeige, setAnzeige] = useState({
    meter: 0,
    muenzen: 0,
    /** Was das letzte "+x" wert war — 2 bei aktivem Doppel. */
    plus: 1,
    magnetS: 0,
    doppelS: 0,
    schild: false,
  });
  const [rangHeuteLauf, setRangHeuteLauf] = useState(0);
  const [ranglisteOffen, setRanglisteOffen] = useState(false);
  const [rangliste, setRangliste] = useState<Awaited<
    ReturnType<typeof api.runnerRangliste>
  > | null>(null);
  const [neustartMarke, setNeustartMarke] = useState(0);
  const [rekord, setRekord] = useState<Rekord | null>(() => liesRekord());
  const [neuerRekord, setNeuerRekord] = useState(false);
  const [hubMuenzen, setHubMuenzen] = useState<number | null>(null);
  const [restHeute, setRestHeute] = useState<number | null>(null);
  const [gutschriftLaeuft, setGutschriftLaeuft] = useState(false);
  const abgerechnet = useRef(false);
  const muenzenRef = useRef(0);
  const beruehrX = useRef<number | null>(null);
  const beruehrY = useRef<number | null>(null);
  /**
   * Eine Geste, eine Aktion.
   *
   * Der erste Wurf setzte nach jedem Auslöser den Startpunkt auf die
   * aktuelle Fingerposition — gedacht als "durchziehen wechselt weiter".
   * In der Hand war das ein Doppelsprung: Ein normaler Wisch ist 100 bis
   * 200 Pixel lang und reißt die zweite 24-Pixel-Schwelle gleich mit, von
   * ganz links landete man ganz rechts. Jetzt verbraucht die erste Aktion
   * die Geste; die nächste beginnt erst, wenn der Finger abhebt.
   */
  const beruehrVerbraucht = useRef(false);

  const spielstand = useRef<Spielstand>(frischerStand('menu'));
  const kacheln = useKacheln();

  useEffect(() => {
    ladeRunnerModelle();
  }, []);

  useEffect(() => {
    spielstand.current.phase = phase;
  }, [phase]);

  useEffect(() => {
    if (!hubMode) return;
    void api
      .runnerToday()
      .then((t) => setRestHeute(t.restHeute))
      .catch(() => setRestHeute(null));
  }, [hubMode]);

  /**
   * Die Anzeige läuft hinter dem Spielstand her, nicht mit ihm.
   *
   * Meter und Tempo leben in einem Ref und ändern sich mit jedem Bild; ein
   * setState je Bild würde 60-mal die Sekunde das Menü-DOM rendern. Alle
   * 150 ms genügt fürs Auge — die Kollision rechnet ohnehin am Ref.
   */
  useEffect(() => {
    if (phase !== 'run') return;
    const id = window.setInterval(() => {
      const gs = spielstand.current;
      const jetzt = performance.now();
      setAnzeige((a) => ({
        ...a,
        meter: Math.floor(gs.distanz),
        muenzen: muenzenRef.current,
        magnetS: Math.max(0, Math.ceil((gs.magnetBis - jetzt) / 1000)),
        doppelS: Math.max(0, Math.ceil((gs.doppelBis - jetzt) / 1000)),
        schild: gs.schild,
      }));
    }, 150);
    return () => window.clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    spiele('tipp');
    muenzenRef.current = 0;
    setAnzeige({ meter: 0, muenzen: 0, plus: 1, magnetS: 0, doppelS: 0, schild: false });
    setRangHeuteLauf(0);
    setRanglisteOffen(false);
    setHubMuenzen(null);
    setNeuerRekord(false);
    abgerechnet.current = false;
    pfadSpur = 0;
    setNeustartMarke((n) => n + 1);
    spielstand.current = frischerStand('flee');
    setPhase('flee');
  }, []);

  const beiFleeFertig = useCallback(() => {
    setPhase((p) => (p === 'flee' ? 'run' : p));
  }, []);

  // Falls das Animationsende nie feuert (leerer Clip): nach 2,9 s los.
  useEffect(() => {
    if (phase !== 'flee') return;
    const t = window.setTimeout(() => setPhase((p) => (p === 'flee' ? 'run' : p)), 2900);
    return () => window.clearTimeout(t);
  }, [phase]);

  const springe = useCallback(() => {
    const gs = spielstand.current;
    if (gs.phase !== 'run') return;
    if (gs.springt) {
      // Kurz vor der Landung gedrückt? Merken und beim Aufsetzen einlösen —
      // ohne Puffer fühlen sich enge Doppelsprünge an, als schlucke das
      // Spiel Eingaben.
      gs.sprungPuffer = performance.now();
      return;
    }
    gs.rutscht = false;
    gs.springt = true;
    gs.sprungV = SPRUNGKRAFT;
  }, []);

  const rutsche = useCallback(() => {
    const gs = spielstand.current;
    if (gs.phase !== 'run') return;
    if (gs.springt) {
      /**
       * Sprungabbruch: runterwischen im Flug zieht die Figur zu Boden und
       * geht dort sofort in die Rolle ueber.
       *
       * Vorher wurde das Wischen im Sprung schlicht verworfen — man sah
       * einen Fehlgriff und musste die ganze Flugkurve abwarten, obwohl
       * schon das naechste Tor kam. Der Abbruch ist keine Abkuerzung: Man
       * verliert die Hoehe und braucht die Rolle dann auch.
       */
      gs.sprungV = Math.min(gs.sprungV, SCHNELLFALL);
      gs.rutschPuffer = performance.now();
      return;
    }
    gs.rutscht = true;
    gs.rutschtBis = performance.now() + RUTSCH_MS;
  }, []);

  const wechsleSpur = useCallback((richtung: -1 | 1) => {
    const gs = spielstand.current;
    if (gs.phase !== 'run') return;
    const naechste = gs.spur + richtung;
    if (naechste < -1 || naechste > 1) return;
    // Kurve an der AKTUELLEN Position neu starten — gs.pos hält das echte X
    // aus dem letzten Bild. So kettet sich ein Doppelwechsel weich.
    gs.spurVonX = gs.pos.x;
    gs.spurWechselUm = performance.now();
    gs.spur = naechste as -1 | 0 | 1;
  }, []);

  const beiTreffer = useCallback(() => {
    const gs = spielstand.current;
    if (gs.phase !== 'run') return;
    gs.phase = 'dead';
    gs.umgeranntUm = performance.now();
    spiele('fehler');
    setPhase('dead');
  }, []);

  const beiMuenze = useCallback(() => {
    const doppelt = performance.now() < spielstand.current.doppelBis;
    const wert = doppelt ? 2 : 1;
    muenzenRef.current += wert;
    spiele('kauf', 0.45);
    // Anzeige sofort — auf die 150-ms-Uhr zu warten, ließe das "+1" hinken.
    setAnzeige((a) => ({ ...a, muenzen: muenzenRef.current, plus: wert }));
  }, []);

  const beiKraft = useCallback((art: KraftArt) => {
    const gs = spielstand.current;
    const jetzt = performance.now();
    if (art === 'magnet') gs.magnetBis = jetzt + KRAFT_DAUER_MS;
    else if (art === 'doppel') gs.doppelBis = jetzt + KRAFT_DAUER_MS;
    else gs.schild = true;
    spiele('stufe');
    setAnzeige((a) => ({
      ...a,
      magnetS: art === 'magnet' ? Math.ceil(KRAFT_DAUER_MS / 1000) : a.magnetS,
      doppelS: art === 'doppel' ? Math.ceil(KRAFT_DAUER_MS / 1000) : a.doppelS,
      schild: art === 'schild' ? true : a.schild,
    }));
  }, []);

  const pausiere = useCallback(() => {
    if (spielstand.current.phase !== 'run') return;
    spiele('blatt-auf');
    setPhase('pause');
  }, []);

  /**
   * Wer den Tab oder die App verlässt, pausiert automatisch.
   *
   * Ohne das läuft der Lauf gedrosselt im Hintergrund weiter, und man kommt
   * zurück zu einem toten Pinguin, den man nie hat sterben sehen — am Handy
   * reicht dafür eine Benachrichtigung, die man kurz antippt.
   */
  useEffect(() => {
    const beiWechsel = (): void => {
      if (document.visibilityState === 'hidden') pausiere();
    };
    document.addEventListener('visibilitychange', beiWechsel);
    return () => document.removeEventListener('visibilitychange', beiWechsel);
  }, [pausiere]);

  const weiter = useCallback(() => {
    if (spielstand.current.phase !== 'pause') return;
    spiele('blatt-zu');
    spielstand.current.phase = 'run';
    setPhase('run');
  }, []);

  /** Endstand + Rekordvergleich, einmal je Lauf. */
  useEffect(() => {
    if (phase !== 'dead') return;
    const meter = Math.floor(spielstand.current.distanz);
    const muenzen = muenzenRef.current;
    setAnzeige((a) => ({ ...a, meter, muenzen }));
    const punkte = meter + muenzen * PUNKTE_JE_MUENZE;
    if (punkte > (rekord?.punkte ?? 0)) {
      const neu = { punkte, meter, muenzen };
      schreibRekord(neu);
      setRekord(neu);
      setNeuerRekord(true);
      spiele('sieg');
    }
    // `rekord` fehlt absichtlich: Der Vergleich soll gegen den Stand beim
    // Aufprall laufen, nicht erneut feuern, wenn setRekord ihn gerade hebt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /**
   * Nach dem Lauf: EIN Aufruf meldet alles — Münzen (Server kappt),
   * Tagesaufgaben, Tagesbestwert, Platz in der Tagesliste.
   *
   * Auch bei 0 Münzen: Die Aufgabe "lauf eine Runde Pro-Subway" zählt das
   * Laufen, nicht das Sammeln.
   */
  useEffect(() => {
    if (phase !== 'dead' || !hubMode || abgerechnet.current) return;
    abgerechnet.current = true;
    const meter = Math.floor(spielstand.current.distanz);
    const muenzen = muenzenRef.current;
    const punkte = meter + muenzen * PUNKTE_JE_MUENZE;
    setGutschriftLaeuft(true);
    void api
      .runnerLauf({ muenzen, punkte, meter })
      .then((r) => {
        setHubMuenzen(r.gutgeschrieben);
        setRestHeute(r.restHeute);
        setRangHeuteLauf(r.rangHeute);
      })
      .catch(() => setHubMuenzen(0))
      .finally(() => setGutschriftLaeuft(false));
  }, [phase, hubMode]);

  const oeffneRangliste = useCallback(() => {
    spiele('blatt-auf');
    setRanglisteOffen(true);
    setRangliste(null);
    void api
      .runnerRangliste()
      .then(setRangliste)
      .catch(() => setRangliste(null));
  }, []);

  useEffect(() => {
    const beiTaste = (e: KeyboardEvent): void => {
      if (phase === 'menu' || phase === 'dead') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
        return;
      }
      if (phase === 'pause') {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'Enter') {
          e.preventDefault();
          weiter();
        }
        return;
      }
      if (phase !== 'run') return;
      if (e.key === 'Escape' || e.key === 'p') {
        e.preventDefault();
        pausiere();
        return;
      }
      /**
       * Auto-Repeat: nur beim Rutschen erwünscht. Gehaltenes ↓ verlängert
       * die Rutschpartie (rutsche() setzt die Frist jedes Mal neu) — wer
       * unter einem langen Tor liegt, will nicht im Takt nachtippen.
       * Für Spur und Sprung wäre Repeat dagegen ein Zittern.
       */
      if (e.repeat && e.key !== 'ArrowDown' && e.key !== 's') return;
      if (e.key === 'ArrowLeft' || e.key === 'a') wechsleSpur(-1);
      if (e.key === 'ArrowRight' || e.key === 'd') wechsleSpur(1);
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        e.preventDefault();
        springe();
      }
      if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault();
        rutsche();
      }
    };
    window.addEventListener('keydown', beiTaste);
    return () => window.removeEventListener('keydown', beiTaste);
  }, [phase, start, springe, rutsche, wechsleSpur, pausiere, weiter]);

  const pose: Pose = phase === 'flee' ? 'flee' : phase === 'run' || phase === 'pause' ? 'run' : 'idle';

  const meter = anzeige.meter;
  const muenzen = anzeige.muenzen;
  const punkte = meter + muenzen * PUNKTE_JE_MUENZE;

  const zurueck = hubMode && onBack ? onBack : undefined;

  return (
    <div
      className="runner"
      onTouchStart={(e) => {
        beruehrX.current = e.touches[0]?.clientX ?? null;
        beruehrY.current = e.touches[0]?.clientY ?? null;
        beruehrVerbraucht.current = false;
      }}
      onTouchMove={(e) => {
        /**
         * Der Wisch zählt beim ZIEHEN, nicht erst beim Loslassen.
         *
         * Vorher wertete erst onTouchEnd aus — zwischen Fingerbewegung und
         * Reaktion lag das Abheben des Fingers, und genau diese Lücke fühlt
         * sich träge an. Jetzt löst die Schwelle mitten in der Bewegung aus,
         * und der Startpunkt wird auf die aktuelle Stelle gesetzt: Wer den
         * Finger weiterzieht, wechselt flüssig noch eine Spur, ohne
         * abzusetzen.
         */
        if (phase !== 'run' || beruehrVerbraucht.current) return;
        if (beruehrX.current === null || beruehrY.current === null) return;
        const x = e.touches[0]?.clientX ?? 0;
        const y = e.touches[0]?.clientY ?? 0;
        const dx = x - beruehrX.current;
        const dy = y - beruehrY.current;
        if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
          wechsleSpur(dx > 0 ? 1 : -1);
          beruehrVerbraucht.current = true;
        } else if (dy < -30) {
          springe();
          beruehrVerbraucht.current = true;
        } else if (dy > 30) {
          rutsche();
          beruehrVerbraucht.current = true;
        }
      }}
      onTouchEnd={() => {
        // Menüs bedient man über ihre Knöpfe — ein Tipp irgendwohin soll
        // nicht ungefragt den nächsten Lauf starten.
        beruehrX.current = null;
        beruehrY.current = null;
        beruehrVerbraucht.current = false;
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, KAMERA.y, SPIELER_Z + KAMERA.z], fov: 42, near: 0.1, far: 120 }}
      >
        <color attach="background" args={['#87b8d8']} />
        <fog attach="fog" args={['#87b8d8', 28, 75]} />
        {/* 0,8 statt 0,65: Man sieht den Pinguin von hinten, und sein Rücken
            ist dunkelgrau — bei 0,65 las er sich als schwarze Silhouette. */}
        <ambientLight intensity={0.8} />
        <directionalLight
          castShadow
          intensity={1.55}
          position={[8, 16, 6]}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <hemisphereLight args={['#cfe8ff', '#4a6b35', 0.4]} />
        <Sky sunPosition={[80, 30, 40]} />

        <KameraFuehrung spielstand={spielstand} />
        <Laufuhr spielstand={spielstand} />
        <BiomStimmung spielstand={spielstand} />
        <Spieler spielstand={spielstand} pose={pose} onFleeFertig={beiFleeFertig} />

        {Array.from({ length: ANZAHL_CHUNKS }, (_, i) => (
          <WeltChunk
            key={`${neustartMarke}-${i}`}
            index={i}
            spielstand={spielstand}
            neustartMarke={neustartMarke}
            onMuenze={beiMuenze}
            onTreffer={beiTreffer}
            onKraft={beiKraft}
            kacheln={kacheln}
          />
        ))}
      </Canvas>

      {/* Anzeige oben: zwei Messingkapseln wie im Hub, rechts die Pause. */}
      {(phase === 'run' || phase === 'pause') && (
        <div className="runner-hud">
          <span className="runner-kapsel">{meter} m</span>
          <span className="runner-kapsel runner-kapsel--muenzen">
            <img src="/hub/muenze.png" alt="" draggable={false} />
            {muenzen}
            {muenzen > 0 && (
              <em key={muenzen} className="runner-plus" aria-hidden="true">
                +{anzeige.plus}
              </em>
            )}
          </span>
          {anzeige.magnetS > 0 && <span className="runner-chip">Magnet {anzeige.magnetS}s</span>}
          {anzeige.doppelS > 0 && <span className="runner-chip">×2 {anzeige.doppelS}s</span>}
          {anzeige.schild && <span className="runner-chip runner-chip--schild">Schild</span>}
          <button type="button" className="runner-pause" onClick={pausiere} aria-label="Pause">
            ❙❙
          </button>
        </div>
      )}

      {phase === 'flee' && (
        <div className="runner-banner">
          <span>Los!</span>
        </div>
      )}

      {/* Roter Blitz beim Aufprall — einmalige CSS-Animation. */}
      {phase === 'dead' && <div className="runner-blitz" aria-hidden="true" />}

      {phase === 'menu' && ranglisteOffen && (
        <div className="runner-schleier">
          <section className="hub-tafel runner-tafel">
            <header className="hub-tafel-kopf">
              <h2>Tagesliste</h2>
              <span className="hub-tafel-zusatz">Beste Läufe heute</span>
            </header>
            <div className="hub-tafel-inhalt runner-tafel-inhalt">
              {rangliste === null && <p className="runner-text">Wird geladen…</p>}
              {rangliste !== null && rangliste.eintraege.length === 0 && (
                <p className="runner-text">Heute ist noch niemand gelaufen — sei du es.</p>
              )}
              {rangliste !== null && rangliste.eintraege.length > 0 && (
                <ol className="runner-rang">
                  {rangliste.eintraege.map((e) => (
                    <li key={e.rang} className={e.du ? 'is-du' : undefined}>
                      <span className="runner-rang-nr">{e.rang}</span>
                      <span className="runner-rang-name">{e.displayName}</span>
                      <span className="runner-rang-punkte">{e.punkte}</span>
                    </li>
                  ))}
                </ol>
              )}
              {rangliste !== null && rangliste.rang > rangliste.eintraege.length && (
                <p className="runner-text runner-text--klein">
                  Du: Platz {rangliste.rang} · {rangliste.punkte} Punkte
                </p>
              )}
              <button
                type="button"
                className="hub-knopf hub-knopf--a runner-knopf"
                onClick={() => {
                  spiele('blatt-zu');
                  setRanglisteOffen(false);
                }}
              >
                Zurück
              </button>
            </div>
          </section>
        </div>
      )}

      {phase === 'menu' && !ranglisteOffen && (
        <div className="runner-schleier">
          <section className="hub-tafel runner-tafel">
            <header className="hub-tafel-kopf">
              <h2>Pro-Subway</h2>
              {rekord && <span className="hub-tafel-zusatz">Rekord: {rekord.punkte}</span>}
            </header>
            <div className="hub-tafel-inhalt runner-tafel-inhalt">
              <p className="runner-text">
                {hubMode
                  ? 'Renn, so weit du kommst — gesammelte Münzen landen in deinem Hub-Konto.'
                  : 'Renn, so weit du kommst. Hindernisse: drüber, drunter oder daneben.'}
              </p>
              {hubMode && restHeute !== null && (
                <p className="runner-text runner-text--klein">
                  Heute noch {restHeute} Hub-Münzen möglich (max. 40 am Tag).
                </p>
              )}
              <div className="runner-steuerung" aria-hidden="true">
                <span>
                  <kbd>←</kbd>
                  <kbd>→</kbd> Spur
                </span>
                <span>
                  <kbd>↑</kbd> springen
                </span>
                <span>
                  <kbd>↓</kbd> rutschen
                </span>
              </div>
              <p className="runner-text runner-text--klein">Am Handy: wischen.</p>
              <button type="button" className="hub-knopf hub-knopf--a-gold runner-knopf" onClick={start}>
                Los geht's!
              </button>
              {hubMode && (
                <button
                  type="button"
                  className="hub-knopf hub-knopf--a runner-knopf"
                  onClick={oeffneRangliste}
                >
                  Tagesliste
                </button>
              )}
              {zurueck && (
                <button
                  type="button"
                  className="hub-knopf hub-knopf--a runner-knopf"
                  onClick={() => {
                    spiele('tipp');
                    zurueck();
                  }}
                >
                  Zurück zur Auswahl
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {phase === 'pause' && (
        <div className="runner-schleier">
          <section className="hub-tafel runner-tafel">
            <header className="hub-tafel-kopf">
              <h2>Pause</h2>
              <span className="hub-tafel-zusatz">
                {meter} m · {muenzen} Münzen
              </span>
            </header>
            <div className="hub-tafel-inhalt runner-tafel-inhalt">
              <button type="button" className="hub-knopf hub-knopf--a-gold runner-knopf" onClick={weiter}>
                Weiter
              </button>
              <button type="button" className="hub-knopf hub-knopf--a runner-knopf" onClick={start}>
                Neu starten
              </button>
              {zurueck && (
                <button
                  type="button"
                  className="hub-knopf hub-knopf--a runner-knopf"
                  onClick={() => {
                    spiele('tipp');
                    zurueck();
                  }}
                >
                  Zurück zur Auswahl
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {phase === 'dead' && (
        <div className="runner-schleier">
          <section className="hub-tafel runner-tafel">
            <header className="hub-tafel-kopf">
              <h2>Umgerannt!</h2>
              {rekord && !neuerRekord && (
                <span className="hub-tafel-zusatz">Rekord: {rekord.punkte}</span>
              )}
            </header>
            <div className="hub-tafel-inhalt runner-tafel-inhalt">
              {neuerRekord && <p className="runner-rekord">Neuer Rekord!</p>}
              {/* Die Rechnung steht offen da — vorher gab es einen "Score",
                  der ×10 zählte und /10 angezeigt wurde, und niemand wusste
                  beim Debuggen, welche Zahl gerade gemeint ist. */}
              <dl className="runner-endstand">
                <div>
                  <dt>Strecke</dt>
                  <dd>{meter} m</dd>
                </div>
                <div>
                  <dt>Münzen</dt>
                  <dd>
                    {muenzen} × {PUNKTE_JE_MUENZE}
                  </dd>
                </div>
                <div className="runner-endstand-summe">
                  <dt>Punkte</dt>
                  <dd>{punkte}</dd>
                </div>
              </dl>
              {hubMode && (
                <p className="runner-text runner-text--klein">
                  {gutschriftLaeuft
                    ? 'Münzen werden gutgeschrieben…'
                    : hubMuenzen === null
                      ? ''
                      : hubMuenzen > 0
                        ? `+${hubMuenzen} Münzen im Hub-Konto`
                        : restHeute === 0
                          ? 'Tageslimit erreicht — morgen wieder'
                          : 'Keine Hub-Münzen diesmal'}
                </p>
              )}
              {hubMode && rangHeuteLauf > 0 && (
                <p className="runner-text runner-text--klein">
                  Platz {rangHeuteLauf} in der heutigen Tagesliste
                </p>
              )}
              <button type="button" className="hub-knopf hub-knopf--a-gold runner-knopf" onClick={start}>
                Nochmal
              </button>
              {zurueck && (
                <button
                  type="button"
                  className="hub-knopf hub-knopf--a runner-knopf"
                  onClick={() => {
                    spiele('tipp');
                    zurueck();
                  }}
                >
                  Zurück zur Auswahl
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
