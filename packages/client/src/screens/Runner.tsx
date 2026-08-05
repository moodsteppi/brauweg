import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Sky, useGLTF } from '@react-three/drei';
import {
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopOnce,
  LoopRepeat,
  MathUtils,
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

/** Füße müssen beim Sprung über diese Kante (Prop-Oberkante + Luft). */
const SPRUNG_FREI_PROP = 0.7;
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
}

const BIOME_LOOK: readonly BiomLook[] = [
  { name: 'Heimat', grasA: '#4a7c3f', grasB: '#3d6b35', rand: '#5c4030', linie: '#c9b896', himmel: '#87b8d8', kanteA: '#c9b896', kanteB: '#8a6f4a', fleck: '#365a2c' },
  { name: 'Wiesen', grasA: '#58a06a', grasB: '#4a8f5c', rand: '#4a5c30', linie: '#d8cfa8', himmel: '#8fd0e8', kanteA: '#d8cfa8', kanteB: '#7a9a5a', fleck: '#3f7a4d' },
  { name: 'Strand', grasA: '#d8c48a', grasB: '#cbb578', rand: '#8a6f4a', linie: '#a8dce4', himmel: '#9adcf0', kanteA: '#e8dcb0', kanteB: '#b09468', fleck: '#c0a86a' },
  { name: 'Feuerberg', grasA: '#6d4a3a', grasB: '#5c3a2c', rand: '#3a2620', linie: '#e8a05a', himmel: '#d8906a', kanteA: '#8a5a3a', kanteB: '#4a2c20', fleck: '#e86a3a' },
  { name: 'Schneefeld', grasA: '#e4ecf2', grasB: '#d4e0ea', rand: '#7a8ca0', linie: '#b0c4d4', himmel: '#c8dcec', kanteA: '#ffffff', kanteB: '#a0b4c8', fleck: '#b8d0e4' },
  { name: 'Sternenhafen', grasA: '#3a3a5c', grasB: '#30304c', rand: '#26263a', linie: '#e2b64f', himmel: '#2e2e50', kanteA: '#e2b64f', kanteB: '#3a3a6c', fleck: '#4a4a7c' },
];

const BIOM_LAENGE = 220;

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

/** Sichthöhe je Prop (Skalierung des Modells). Alle unter SPRUNG_FREI_PROP. */
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
  bike: 0.62,
  barrier: 0.5,
  cart: 0.62,
};
const BUSCH_H: Record<BuschProp, number> = { bush: 0.6, planter: 0.58 };
/** Tore: Gesamthöhe des Modells; der Durchlass steht in TOR_LUECKE. */
const RUTSCH_H: Record<RutschProp, number> = { banner: 2.15, scaffold: 2.2, garland: 2.1 };
const FAHRZEUG_H: Record<FahrzeugArt, number> = { scooter: 0.72, silver: 0.68, bmw: 0.64 };

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
  bike: { x: 0.55, z: 0.22 },
  barrier: { x: 0.8, z: 0.18 },
  cart: { x: 0.55, z: 0.42 },
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

/** Fahrzeuge: Kasten, Sprungkante und wie schnell sie einem entgegenkommen. */
const FAHRZEUG: Record<FahrzeugArt, { x: number; z: number; frei: number; tempo: number }> = {
  scooter: { x: 0.42, z: 0.6, frei: 0.82, tempo: 7 },
  silver: { x: 0.88, z: 1.1, frei: 0.94, tempo: 5.5 },
  bmw: { x: 0.92, z: 1.15, frei: 0.96, tempo: 5.5 },
};

function propGlb(name: string): string {
  return `${PROP}/prop_${name}.glb`;
}

/**
 * Vorladen in zwei Wellen: Pinguin und Fahrzeuge sofort (die braucht der
 * erste Bildschirm), die sechzehn Props gestaffelt im Leerlauf. Alles auf
 * einmal hielt auf schwachem Netz den Start sekundenlang schwarz — und der
 * Browser lädt ohnehin nach, was bis dahin fehlt.
 */
function ladeRunnerModelle(): void {
  useGLTF.preload(ANIM);
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
}

interface Platz {
  z: number;
  hindernisse: [Hindernis, Hindernis];
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

function bauePinguin(quelle: Object3D, clips: AnimationClip[]): PinguinBausatz {
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
    return { wurzel, mixer, flee: leer, run: leer, hip, hipRuhe, bodenY: wurzel.position.y };
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

  return { wurzel, mixer, flee, run, hip, hipRuhe, bodenY: wurzel.position.y };
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
  const bausatz = useMemo(
    () => bauePinguin(gltf.scene, gltf.animations),
    [gltf.scene, gltf.animations],
  );
  const fleeFertig = useRef(false);

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

/** Deko-Busch am Rand (einfache Geometrie, kein Ladegewicht). */
function RandBusch(): React.JSX.Element {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshStandardMaterial color="#2f6b2f" />
      </mesh>
      <mesh position={[-0.35, 0.22, 0.15]} castShadow>
        <sphereGeometry args={[0.38, 10, 8]} />
        <meshStandardMaterial color="#3a7a35" />
      </mesh>
      <mesh position={[0.32, 0.2, -0.1]} castShadow>
        <sphereGeometry args={[0.34, 10, 8]} />
        <meshStandardMaterial color="#275c28" />
      </mesh>
    </group>
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
        // Gepufferter Sprungwunsch von kurz vor der Landung — jetzt einlösen.
        if (performance.now() - gs.sprungPuffer < 140) {
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
      <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={2.6} blur={2.2} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Weltstücke
// ---------------------------------------------------------------------------

function WeltChunk({
  index,
  spielstand,
  onMuenze,
  onTreffer,
  onKraft,
  neustartMarke,
}: {
  index: number;
  spielstand: React.MutableRefObject<Spielstand>;
  onMuenze: () => void;
  onTreffer: () => void;
  onKraft: (art: KraftArt) => void;
  neustartMarke: number;
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
    const z = (Math.random() - 0.5) * (CHUNK_LAENGE - 8);
    const nochHin = SPIELER_Z - (chunkZ + z);
    kraftRef.current = {
      art: zufall(arten),
      spur: pfadSpur,
      z,
      aktiv: Math.random() < KRAFT_CHANCE && nochHin >= ANLAUF_M,
    };
  }, []);

  /**
   * Münzen liegen als Dreierreihe auf dem begehbaren Pfad — nie in einem
   * Hindernis. Vorher schwebten sie einzeln auf zufälligen Spuren in
   * zufälliger Höhe; die Hälfte war unerreichbar oder saß in einer Kiste.
   */
  const legeMuenzen = useCallback((chunkZ: number) => {
    const reihen = [0, 1] as const;
    for (const reihe of reihen) {
      const spur = pfadSpur;
      const startZ = -CHUNK_LAENGE / 2 + 4 + reihe * (CHUNK_LAENGE / 2 - 2) + Math.random() * 3;
      for (let i = 0; i < 3; i++) {
        const muenze = muenzenRef.current[reihe * 3 + i];
        if (!muenze) continue;
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
        if (!hindernis.aktiv) continue;

        const kasten = kastenFuer(hindernis);
        const weltZ = gruppe.position.z + platz.z + hindernis.fahrt;
        const dx = Math.abs(pos.x - hindernis.spur * SPUR_BREITE);
        const dz = Math.abs(pos.z - weltZ);
        if (dx >= (kasten.x + SPIELER_BREIT) * NACHSICHT) continue;
        if (dz >= (kasten.z + SPIELER_BREIT) * NACHSICHT) continue;

        let getroffen = false;
        if (hindernis.rolle === 'jump' || hindernis.rolle === 'bush') {
          getroffen = pos.y < SPRUNG_FREI_PROP;
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

  return (
    <group ref={gruppeRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SPUR_BREITE * 3 + 2, CHUNK_LAENGE]} />
        <meshStandardMaterial color={gras} />
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
      <mesh position={[-(SPUR_BREITE * 1.5 + 0.85), 0.45, 0]} castShadow>
        <boxGeometry args={[0.45, 0.9, CHUNK_LAENGE]} />
        <meshStandardMaterial color={look.rand} />
      </mesh>
      <mesh position={[SPUR_BREITE * 1.5 + 0.85, 0.45, 0]} castShadow>
        <boxGeometry args={[0.45, 0.9, CHUNK_LAENGE]} />
        <meshStandardMaterial color={look.rand} />
      </mesh>

      {[-1, 1].map((seite) =>
        [-8, -2, 5].map((z) => (
          <group key={`${seite}-${z}`} position={[seite * (SPUR_BREITE * 1.5 + 1.1), 0, z]}>
            <RandBusch />
          </group>
        )),
      )}

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
    if (gs.phase !== 'run' || gs.springt) return;
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
