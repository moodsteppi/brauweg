/**
 * Der Fun-Modus von Golf: was an einem Loch anders ist als sonst.
 *
 * Robin hat am 22.09.2026 entschieden: Neben dem fairen klassischen Golf gibt
 * es einen Fun-Modus als eigene Regeloption (`GolfRegeln.modus` im Modul) —
 * mit Wind, Wetter und einem Roulette je Loch (dieser Teil), Power-ups
 * (Teil 2) und Störschlägen (Teil 3). Ausdrücklich NICHT: verrückte Bälle
 * und wandernde Wände.
 *
 * **Wo ein Loch seine Modifikatoren trägt:** `Lochmodifikatoren`, gezogen in
 * `starteLoch` und abgelegt in `Partiezustand.aktuell.mod`. Physik und Bots
 * lesen daraus nie direkt, sondern über `physikwerte` (physik.ts) — dort wird
 * aus „Regen" eine Reibungszahl und aus „Riesenball" ein Radius. So bleibt
 * der klassische Modus derselbe Satz Zahlen wie vorher, Byte für Byte
 * (`klassisch-gold.test.ts`), und ein neuer Modifikator ist eine Zeile hier
 * plus eine Zeile dort. Teil 2 hängt seine Power-up-Felder an
 * `Lochmodifikatoren`.
 *
 * **Warum die Wahl rein aus Saat und Lochindex kommt**, ohne jeden Zustand:
 * Das Replay (#201) spielt ein Loch später allein aus Saat, Bahn und
 * Zugliste nach und muss dabei auf denselben Modifikator kommen — und jedes
 * Gerät am Tisch ebenso, auch eines, das mitten im dritten Loch neu lädt.
 * Aus dem gemeinsamen Zufallsstrom der Partie zu ziehen wäre bequemer, hinge
 * aber an allem, was vorher gezogen wurde.
 *
 * **Determinismus** wie überall in Golf (docs/GOLF-PLAN.md): nur `+ - * /`
 * und `Math.sqrt`, Zufall aus mulberry32, Richtungen aus den Winkeltabellen
 * in `zufall.ts`. Die Reihenfolge von `ROULETTE` ist Teil davon: Wer sie
 * umsortiert oder mittendrin etwas einfügt, lässt dieselbe Saat einen
 * anderen Modifikator ziehen — das ist ein Protokollbruch
 * (`GOLF_MODULE_VERSION`).
 */

import type { Wind } from './karte';
import type { ZonePowerup } from './powerup';
import { drehe, ganzzahl, mulberry32 } from './zufall';

/** Die Spielart eines Tisches — Spiegel von `GolfModus` im Modul (modus.ts). */
export type Golfmodus = 'klassisch' | 'fun';

/** Was das Roulette je Loch ziehen kann. */
export type Rouletteart =
  | 'wind'
  | 'regen'
  | 'riesenball'
  | 'miniball'
  | 'gummiwaende'
  | 'zeitlupe'
  | 'schwerelos';

/** Die Trommel des Roulettes. Reihenfolge ist Determinismus — siehe Dateikopf. */
export const ROULETTE: readonly Rouletteart[] = [
  'wind',
  'regen',
  'riesenball',
  'miniball',
  'gummiwaende',
  'zeitlupe',
  'schwerelos',
];

/**
 * Was an einem Loch gilt, außer der Bahn selbst.
 *
 * UNVERÄNDERLICH: `kopiere` nimmt `aktuell` nur flach mit, alle
 * Schnappschüsse eines Lochs teilen sich also dasselbe Objekt. Wer hier
 * später Zustand ablegen will, der sich im Loch ändert (etwa wer welches
 * Power-up schon eingesammelt hat), legt ihn an den Ball oder den
 * Partiezustand und kopiert ihn in `kopiere` mit — nicht hierher.
 */
export interface Lochmodifikatoren {
  /** Der gezogene Modifikator; `null` im klassischen Modus. */
  readonly roulette: Rouletteart | null;
  /** Wind dieses Lochs (nur beim Roulette „wind"). Geht einem Bahnwind vor. */
  readonly wind: Readonly<Wind> | null;
  /**
   * Die Power-up-Felder dieses Lochs (Teil 2/3, seit dem 23.09.2026) —
   * gezogen in `starteLoch` aus Saat, Lochindex und Bahn (`mitPowerups` in
   * powerup.ts). Fehlt im klassischen Modus. Welche schon eingesammelt sind,
   * steht NICHT hier (unveränderlich!), sondern in `Lochstand.felderWeg`.
   */
  readonly powerups?: readonly ZonePowerup[];
}

/** Der klassische Modus: nichts ist anders. */
export const OHNE_MODIFIKATOR: Lochmodifikatoren = Object.freeze({ roulette: null, wind: null });

/* --------------------------------------------------------------------------
 * Wirkung — die Zahlen hinter den Namen
 *
 * Gelesen von `physikwerte` in physik.ts. Hier und nicht dort, damit die
 * Anzeige (FunAnsage.tsx) und die Tests dieselben Zahlen sehen, ohne die
 * Physik zu laden.
 * ----------------------------------------------------------------------- */

/** Regen: alle Reibung halb — der nasse Rasen trägt den Ball weiter. */
export const REGEN_REIBUNG = 0.5;
/**
 * Schwerelos: kaum Reibung. Ein Viertel und nicht weniger: Schon so rollt die
 * kleinste Kraft (0,05) knapp zwei Einheiten, noch weniger Reibung, und ein
 * Putt aus einem Meter wäre unmöglich.
 */
export const SCHWERELOS_REIBUNG = 0.25;
/** Schwerelos: Sprungfelder tragen anderthalbmal so lang. */
export const SCHWERELOS_FLUG = 1.5;
/** Riesenball: Radius mal 1,5 (0,48 E) — passt auf allen 40 Bahnen noch durch jede Gasse. */
export const RIESEN_FAKTOR = 1.5;
/**
 * Miniball: Radius mal 0,625 (0,2 E).
 *
 * Kleiner als der Weg eines vollen Schlags in einem Unterschritt (28 E/s mal
 * 10 ms = 0,28 E) — damit tunnelte der Ball durch Wände. Der Miniball rechnet
 * deshalb mit doppelt so vielen, halb so langen Unterschritten
 * (`physikwerte`); das kostet nur in seinen Löchern Rechenzeit.
 */
export const MINI_FAKTOR = 0.625;
/**
 * Gummiwände: Abprall mal 1,4 (0,82 → 1,148).
 *
 * Über 1 hieße: Jede Wand gibt Schwung dazu. Zwischen zwei Wänden, die
 * weniger als rund vier Einheiten auseinanderstehen, schaukelte sich ein Ball
 * senkrecht zu ihnen so bis zur Höchstgeschwindigkeit auf und käme nie mehr
 * zur Ruhe. Deshalb deckelt `pralleAbWand` den Betrag: Eine Gummiwand lenkt
 * den Ball steiler ab und nimmt ihm keine Fahrt — sie gibt ihm aber auch
 * keine dazu.
 */
export const GUMMI_FAKTOR = 1.4;
/** Zeitlupe: die Bälle laufen mit halber Zeit, das Zeitlimit wird doppelt so lang. */
export const ZEITLUPE_FAKTOR = 0.5;

/**
 * Windstärken in E/s², alle unter der Rollreibung (0,9 E/s²) — sonst hielte
 * der Wind einen Ball auf freier Fläche ewig in Fahrt. „Stark" verschiebt
 * einen vollen Schlag um knapp zwei Einheiten, einen Putt um eine halbe.
 */
export const WIND_STAERKEN: readonly number[] = [0.4, 0.6, 0.85];
/** Windrichtungen im 45-Grad-Raster, als ganze Grad für `drehe`. */
const WIND_GRAD = 45;
const WIND_RICHTUNGEN = 8;

/* --------------------------------------------------------------------------
 * Ziehung
 * ----------------------------------------------------------------------- */

/*
 * Eigene Ströme, getrennt von allem anderen in der Partie: Die Konstanten
 * sind beliebig, aber fest — dieselben wie bei der Einführung, sonst zieht
 * dieselbe Saat einen anderen Modifikator.
 */
function trommelStrom(saat: number, runde: number): number {
  return mulberry32(saat ^ Math.imul(runde + 1, 0x85ebca6b) ^ 0x2c1b3c6d);
}

function windStrom(saat: number, loch: number): number {
  return mulberry32(saat ^ Math.imul(loch + 1, 0xc2b2ae35) ^ 0x68e31da4);
}

/** Eine gemischte Trommel für eine Runde von sieben Löchern (Fisher-Yates). */
function mischung(saat: number, runde: number): Rouletteart[] {
  const folge = [...ROULETTE];
  let zustand = trommelStrom(saat, runde);
  for (let i = folge.length - 1; i > 0; i -= 1) {
    const z = ganzzahl(zustand, 0, i);
    zustand = z.zustand;
    const tausch = folge[i];
    folge[i] = folge[z.wert];
    folge[z.wert] = tausch;
  }
  return folge;
}

/**
 * Der Roulette-Modifikator eines Lochs.
 *
 * Keine freie Ziehung je Loch, sondern eine gemischte Trommel je Runde von
 * sieben Löchern: So kommt in einem Match mit sieben Löchern jeder
 * Modifikator genau einmal, und nie zweimal hintereinander — auch nicht über
 * die Rundengrenze, dafür tauscht die neue Runde notfalls ihre ersten beiden.
 * Bei freier Ziehung käme derselbe in jedem siebten Lochwechsel zweimal.
 */
export function rouletteFuerLoch(saat: number, loch: number): Rouletteart {
  const n = ROULETTE.length;
  const l = loch < 0 ? 0 : Math.floor(loch);
  const runde = Math.floor(l / n);
  const folge = mischung(saat, runde);
  if (runde > 0 && folge[0] === mischung(saat, runde - 1)[n - 1]) {
    const erster = folge[0];
    folge[0] = folge[1];
    folge[1] = erster;
  }
  return folge[l - runde * n];
}

/** Wind eines Lochs: eine von acht Richtungen, eine von drei Stärken. */
export function windFuerLoch(saat: number, loch: number): Readonly<Wind> {
  const r = ganzzahl(windStrom(saat, loch), 0, WIND_RICHTUNGEN - 1);
  const s = ganzzahl(r.zustand, 0, WIND_STAERKEN.length - 1);
  const richtung = drehe(1, 0, r.wert * WIND_GRAD);
  return Object.freeze({ rx: richtung.x, ry: richtung.y, staerke: WIND_STAERKEN[s.wert] });
}

/**
 * Die Modifikatoren eines Lochs — die einzige Stelle, an der sie entstehen.
 *
 * Rein aus Modus, Saat und Lochindex (siehe Dateikopf). `saat` ist die Saat
 * der Sicht, dieselbe, aus der das Modul die Bahnen zieht.
 */
export function modifikatorenFuerLoch(modus: Golfmodus, saat: number, loch: number): Lochmodifikatoren {
  if (modus !== 'fun') return OHNE_MODIFIKATOR;
  const roulette = rouletteFuerLoch(saat, loch);
  return Object.freeze({
    roulette,
    wind: roulette === 'wind' ? windFuerLoch(saat, loch) : null,
  });
}

/**
 * Ein fester Modifikator, unabhängig von der Saat — für Messungen und Tests
 * (`golf-botprobe.ts --modifikator`, `botLoestKarte`). Der Wind kommt dabei
 * aus Saat und Loch wie im Spiel.
 */
export function festerModifikator(art: Rouletteart, saat = 1, loch = 0): Lochmodifikatoren {
  return Object.freeze({ roulette: art, wind: art === 'wind' ? windFuerLoch(saat, loch) : null });
}

/** Liest einen Modus aus der Sicht; alles außer `'fun'` ist klassisch. */
export function modusAus(wert: unknown): Golfmodus {
  return wert === 'fun' ? 'fun' : 'klassisch';
}
