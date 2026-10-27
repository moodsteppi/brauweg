/**
 * Power-ups im Fun-Modus von Golf (Teil 2/3, Robins Entscheidung vom
 * 22.09.2026): Felder auf der Bahn, die ein Ball beim Drüberrollen
 * einsammelt und für den nächsten eigenen Schlag hält.
 *
 * **Wo was liegt.** Die Felder eines Lochs stehen in
 * `Lochmodifikatoren.powerups` (unveränderlich, wie der Roulette-Modifikator
 * aus Teil 1) — gezogen in `starteLoch` rein aus Saat, Lochindex und Bahn.
 * Was sich IM Loch ändert, liegt dort, wo `kopiere` es mitnimmt: welche
 * Felder schon weg sind in `Lochstand.felderWeg` (eine Bitmaske, von der
 * flachen Kopie von `aktuell` mitgenommen), was ein Ball hält und was gerade
 * wirkt an `Ball.halt` und `Ball.wirkung`. Einsammeln ist Physik und läuft
 * in `schritt` auf jedem Gerät gleich — über die Leitung geht dafür nichts,
 * und der Server weiß von Power-ups nichts.
 *
 * **Keine Zone der Karte.** `ZonePowerup` sieht aus wie eine Zone (`art:
 * 'powerup'`, Kreisfläche) und wird gezeichnet wie eine, steht aber nicht in
 * `Karte.zonen`: Die Bahnen bleiben, wie sie gebaut sind, der klassische
 * Modus sieht nie ein Feld, und Werkstatt, Bahnprüfung und Themen-Vertrag
 * (die über `Zone['art']` laufen) müssen keine zehnte Art kennen.
 *
 * **Die Halte-Mechanik** (Anschluss für Teil 3/3). Ein Ball hält höchstens
 * eines; ein neues ersetzt das alte. Wann es wirkt, sagt `EINSATZ` je Art:
 *
 *   - `'schlag'` — mit dem nächsten eigenen Schlag, von selbst (Turbo,
 *     Magnet, Geisterball). `wendeSchlagAn` macht aus `halt` die `wirkung`
 *     dieses Schlags; sie endet, sobald der Ball wieder liegt.
 *   - `'passiv'` — liegt bereit, bis etwas sie auslöst (Schild: der nächste
 *     Stoß eines fremden Balls, `schildHaelt` in physik.ts). Ein eigener
 *     Schlag verbraucht es nicht.
 *   - `'ausloesen'` — Teil 3 (Störschläge, stoerschlag.ts): Bombe, Klebefeld
 *     und Tausch, die der Spieler STATT eines Schlags auslöst. `wendeSchlagAn`
 *     lässt sie im Halt liegen; das Ereignis `'ausloesen'` in physik.ts nimmt
 *     sie heraus (`wendeAusloesenAn`), und trifft ein Störschlag einen Ball
 *     mit Schild, fragt er `verbraucheSchild`. Aufnehmen darf sie nur, wer
 *     zurückliegt und seinen Störschlag im Loch noch nicht hatte.
 *
 * **Determinismus** wie überall in Golf (docs/GOLF-PLAN.md): nur `+ - * /`
 * und `Math.sqrt`, Zufall aus mulberry32. Die Reihenfolge von `POWERUPS` ist
 * Teil davon — wer sie umsortiert, lässt dieselbe Saat andere Felder ziehen
 * (Protokollbruch, `GOLF_MODULE_VERSION`).
 */

import { RASTER, wegfeld } from './bot';
import {
  type Karte,
  type Kreisflaeche,
  type Segment,
  abstandQuadrat,
  istInZone,
  istRechteck,
  segment,
} from './karte';
import type { Lochmodifikatoren } from './modifikator';
import { ganzzahl, mulberry32 } from './zufall';

/** Was auf der Bahn liegen kann. */
export type Powerupart = 'turbo' | 'magnet' | 'geist' | 'schild' | 'bombe' | 'klebefeld' | 'tausch';

/** Alle Arten. Reihenfolge ist Determinismus — siehe Dateikopf. */
export const POWERUPS: readonly Powerupart[] = [
  'turbo',
  'magnet',
  'geist',
  'schild',
  // Teil 3/3 (seit dem 23.09.2026, Version 9): die Störschläge, hinten angehängt.
  // Sie verschieben die Ziehung jedes Fun-Lochs — deshalb die neue Version.
  'bombe',
  'klebefeld',
  'tausch',
];

/** Wann ein gehaltenes Power-up wirkt — siehe „Halte-Mechanik" im Dateikopf. */
export type Einsatz = 'schlag' | 'passiv' | 'ausloesen';

export const EINSATZ: Readonly<Record<Powerupart, Einsatz>> = Object.freeze({
  turbo: 'schlag',
  magnet: 'schlag',
  geist: 'schlag',
  schild: 'passiv',
  // Störschläge (stoerschlag.ts): statt eines Schlags ausgelöst, gegen andere.
  bombe: 'ausloesen',
  klebefeld: 'ausloesen',
  tausch: 'ausloesen',
});

/** Ein Feld auf der Bahn — gezeichnet wie eine Zone, gesammelt in der Physik. */
export interface ZonePowerup extends Kreisflaeche {
  art: 'powerup';
  powerup: Powerupart;
}

/* --------------------------------------------------------------------------
 * Wirkung — die Zahlen hinter den Namen
 *
 * Gelesen von physik.ts und bot.ts; hier, damit Anzeige und Tests dieselben
 * Zahlen sehen.
 * ----------------------------------------------------------------------- */

/** Turbo: Anfangstempo mal 1,6 — auch die Höchstkraft (28 → 44,8 E/s). */
export const TURBO_FAKTOR = 1.6;

/**
 * Magnet: Reichweite um das Loch, in E. Nur im letzten Drittel der
 * Rollstrecke (`MAGNET_DRITTEL`) und nur auf einen rollenden Ball.
 */
export const MAGNET_R = 5;

/**
 * Magnet: Zug zum Loch in E/s². Aus 5 E Entfernung holt er einen Ball auf
 * höchstens gut 6 E/s — unter `LOCH_VMAX` (9), der Ball fällt also, statt
 * übers Loch zu springen.
 */
export const MAGNET_STAERKE = 4;

/**
 * „Das letzte Drittel der Rollstrecke", als Tempo: Der Magnet zieht, sobald
 * der Ball langsamer ist als ein Drittel seines Anfangstempos.
 *
 * Warum das Tempo und nicht der Weg: Wie weit ein Schlag noch rollt, weiß
 * die Physik erst hinterher. Die Reibung ist aber fast ganz proportional zum
 * Tempo (`REIBUNG_RASEN`), und dann ist der Restweg proportional zum Tempo —
 * ein Drittel Tempo heißt ein Drittel Restweg. Die feste Rollreibung macht
 * es etwas früher, das ist gewollt: Beim Putt, wo sie überwiegt, zieht der
 * Magnet sonst kaum.
 */
export const MAGNET_DRITTEL = 1 / 3;

/** Radius eines Feldes; eingesammelt wird, wenn die Ballmitte darin liegt. */
export const POWERUP_R = 0.6;

/** 2 bis 4 Felder je Loch (Karte). */
export const POWERUPS_MIN = 2;
export const POWERUPS_MAX = 4;

/** Abstand der Felder untereinander, zum Loch und zum Abschlag, in E. */
const FELD_ABSTAND = 3;
const LOCH_ABSTAND = 3;
const ABSCHLAG_ABSTAND = 3;
/** So weit bleibt ein Feld von jeder Wand — es soll auf freier Fläche liegen. */
const WAND_ABSTAND = 0.9;
/** So oft sucht die Ziehung einen Platz für ein Feld, bevor sie es auslässt. */
const PLATZ_VERSUCHE = 40;

/** Kein Feld — der klassische Modus und jede Probe ohne Felder. */
export const KEINE_FELDER: readonly ZonePowerup[] = Object.freeze([]);

/* --------------------------------------------------------------------------
 * Wo die Felder liegen
 * ----------------------------------------------------------------------- */

/** Liegt der Punkt innerhalb einer Wand der Karte (der Rahmen liegt außerhalb)? */
export function punktInWand(karte: Karte, x: number, y: number): boolean {
  for (let i = 0; i < karte.waende.length; i += 1) {
    const w = karte.waende[i];
    if (istRechteck(w)) {
      if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
      continue;
    }
    const halb = w.dicke / 2;
    if (abstandQuadrat(segment(w.ax, w.ay, w.bx, w.by), x, y) <= halb * halb) return true;
  }
  return false;
}

/** Stört an dieser Stelle eine Zone ein Feld (alles außer Sand und Eis, mit Rand)? */
function zoneStoert(karte: Karte, x: number, y: number): boolean {
  const r = POWERUP_R;
  for (let i = 0; i < karte.zonen.length; i += 1) {
    const zone = karte.zonen[i];
    if (zone.art === 'sand' || zone.art === 'eis') continue;
    if (zone.art === 'drehkreuz') {
      const grenze = zone.laenge / 2 + r;
      const dx = x - zone.x;
      const dy = y - zone.y;
      if (dx * dx + dy * dy < grenze * grenze) return true;
      continue;
    }
    // Die Mitte und vier Punkte am Rand des Feldes: Ein Feld halb im Wasser
    // wäre eines, das man nur mit Strafschlag bekommt.
    if (
      istInZone(zone, x, y) ||
      istInZone(zone, x + r, y) ||
      istInZone(zone, x - r, y) ||
      istInZone(zone, x, y + r) ||
      istInZone(zone, x, y - r)
    ) {
      return true;
    }
  }
  return false;
}

const platzSpeicher = new Map<Karte, readonly number[]>();

/**
 * Alle Plätze, an denen auf dieser Bahn ein Feld liegen darf, als x,y-Paare.
 *
 * Die Rastermitten des Wegfelds (0,5 E) — nur die, von denen das Loch
 * erreichbar ist: frei von Wänden und Wasser, keine Portaltür. Dazu Abstand
 * zu Wand, Loch, Abschlag und jeder Zone außer Sand und Eis. Einmal je Karte
 * und wie das Wegfeld kein Spielzustand: eine reine Funktion der Bahn.
 */
export function freiePlaetze(karte: Karte): readonly number[] {
  const fertig = platzSpeicher.get(karte);
  if (fertig !== undefined) return fertig;
  const feld = wegfeld(karte);
  const segmente: Segment[] = [];
  // Rahmen als vier Linien genügt — innen liegt alles weiter als WAND_ABSTAND.
  segmente.push(segment(0, 0, karte.breite, 0));
  segmente.push(segment(karte.breite, 0, karte.breite, karte.hoehe));
  segmente.push(segment(karte.breite, karte.hoehe, 0, karte.hoehe));
  segmente.push(segment(0, karte.hoehe, 0, 0));
  const plaetze: number[] = [];
  const grenze = WAND_ABSTAND * WAND_ABSTAND;
  for (let i = 0; i < feld.frei.length; i += 1) {
    if (feld.frei[i] !== 1 || feld.entfernung[i] < 0 || feld.portalZu[i] >= 0) continue;
    const x = (i % feld.spalten) * RASTER + RASTER / 2;
    const y = Math.floor(i / feld.spalten) * RASTER + RASTER / 2;
    if (x > karte.breite || y > karte.hoehe) continue;
    let frei = true;
    for (let s = 0; s < segmente.length && frei; s += 1) {
      if (abstandQuadrat(segmente[s], x, y) < grenze) frei = false;
    }
    if (!frei || zuNahAnWand(karte, x, y)) continue;
    if (abstand(x, y, karte.loch[0], karte.loch[1]) < LOCH_ABSTAND) continue;
    let amAbschlag = false;
    for (const platz of karte.abschlaege) {
      if (abstand(x, y, platz[0], platz[1]) < ABSCHLAG_ABSTAND) amAbschlag = true;
    }
    if (amAbschlag || zoneStoert(karte, x, y)) continue;
    plaetze.push(x, y);
  }
  platzSpeicher.set(karte, plaetze);
  return plaetze;
}

/** Leert den Zwischenspeicher — nur für Messungen, Tests und die Werkstatt. */
export function vergissPlaetze(): void {
  platzSpeicher.clear();
}

function zuNahAnWand(karte: Karte, x: number, y: number): boolean {
  if (punktInWand(karte, x, y)) return true;
  const grenze = WAND_ABSTAND * WAND_ABSTAND;
  for (let i = 0; i < karte.waende.length; i += 1) {
    const w = karte.waende[i];
    if (istRechteck(w)) {
      // Abstand zum Rechteck: zur nächsten Stelle darin.
      const nx = x < w.x ? w.x : x > w.x + w.w ? w.x + w.w : x;
      const ny = y < w.y ? w.y : y > w.y + w.h ? w.y + w.h : y;
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < grenze) return true;
      continue;
    }
    const r = w.dicke / 2 + WAND_ABSTAND;
    if (abstandQuadrat(segment(w.ax, w.ay, w.bx, w.by), x, y) < r * r) return true;
  }
  return false;
}

function abstand(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/*
 * Ein eigener Strom, getrennt von allem anderen der Partie — wie Trommel und
 * Wind in modifikator.ts. Die Konstanten sind beliebig, aber fest.
 */
function feldStrom(saat: number, loch: number): number {
  return mulberry32(saat ^ Math.imul(loch + 1, 0x27d4eb2d) ^ 0x165667b1);
}

/**
 * Die Felder eines Lochs, rein aus Saat, Lochindex und Bahn.
 *
 * 2 bis 4 Felder, jede Art höchstens einmal (eine gemischte Trommel wie beim
 * Roulette), auf den `freiePlaetze` der Bahn mit `FELD_ABSTAND`
 * untereinander. Findet ein Feld in `PLATZ_VERSUCHE` Zügen keinen Platz,
 * fällt es aus — auf einer sehr engen Bahn liegen dann weniger.
 */
export function powerupsFuerLoch(saat: number, loch: number, karte: Karte): readonly ZonePowerup[] {
  const plaetze = freiePlaetze(karte);
  const anzahlPlaetze = plaetze.length / 2;
  if (anzahlPlaetze === 0) return KEINE_FELDER;
  let zustand = feldStrom(saat, loch < 0 ? 0 : Math.floor(loch));
  const n = ganzzahl(zustand, POWERUPS_MIN, POWERUPS_MAX);
  zustand = n.zustand;
  const trommel = [...POWERUPS];
  for (let i = trommel.length - 1; i > 0; i -= 1) {
    const z = ganzzahl(zustand, 0, i);
    zustand = z.zustand;
    const tausch = trommel[i];
    trommel[i] = trommel[z.wert];
    trommel[z.wert] = tausch;
  }
  const felder: ZonePowerup[] = [];
  const grenze = FELD_ABSTAND * FELD_ABSTAND;
  for (let f = 0; f < n.wert && f < trommel.length; f += 1) {
    for (let v = 0; v < PLATZ_VERSUCHE; v += 1) {
      const z = ganzzahl(zustand, 0, anzahlPlaetze - 1);
      zustand = z.zustand;
      const x = plaetze[z.wert * 2];
      const y = plaetze[z.wert * 2 + 1];
      let passt = true;
      for (const anderes of felder) {
        const dx = anderes.x - x;
        const dy = anderes.y - y;
        if (dx * dx + dy * dy < grenze) passt = false;
      }
      if (!passt) continue;
      felder.push(Object.freeze({ art: 'powerup', powerup: trommel[f], x, y, r: POWERUP_R }));
      break;
    }
  }
  return Object.freeze(felder);
}

/**
 * Die Modifikatoren eines Fun-Lochs samt Feldern — gerufen von `starteLoch`.
 * Im klassischen Modus kommt `mod` unverändert zurück (kein Feld, dasselbe
 * Objekt).
 */
export function mitPowerups(mod: Lochmodifikatoren, karte: Karte, saat: number, loch: number): Lochmodifikatoren {
  if (mod.roulette === null) return mod;
  return Object.freeze({ ...mod, powerups: powerupsFuerLoch(saat, loch, karte) });
}

/** Die Felder eines Lochs; ohne Angabe keine. */
export function felderVon(mod: Lochmodifikatoren): readonly ZonePowerup[] {
  return mod.powerups ?? KEINE_FELDER;
}

/** Ist Feld `i` in diesem Loch schon eingesammelt? */
export function feldWeg(felderWeg: number, i: number): boolean {
  return (felderWeg & (1 << i)) !== 0;
}

/**
 * Fängt das Schild dieses Balls einen Stoß ab? Verbraucht es dabei.
 *
 * Für den Ballstoß (`schildHaelt` in physik.ts) und für Teil 3: Ein
 * Störschlag, der einen Ball mit Schild trifft, fragt hier.
 */
export function verbraucheSchild(b: { halt: Powerupart | null }): boolean {
  if (b.halt !== 'schild') return false;
  b.halt = null;
  return true;
}
