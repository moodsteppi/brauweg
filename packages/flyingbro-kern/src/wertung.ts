/**
 * Was ein Versuch einbringt: Sterne, Flugmeilen, Hub-Münzen — und die
 * Plausibilität, mit der der Server eine Meldung annimmt.
 *
 * Der Client meldet nur Punkte, verschossene Bros und Hilfsmittel; die Sterne
 * rechnet der Server selbst aus dieser Datei. Der Client rechnet dieselbe
 * Funktion für die Anzeige — eine zweite Rechnung im Bildschirm wäre eine
 * zweite Wahrheit über die Regel (CLAUDE.md, „Was das Modul weiß").
 */

import { hoechstpunkte, type Level } from './level.js';
import { LEVELS, levelIndex, LEVEL_JE_WELT } from './levels.js';
import { HILFSMITTEL, type Hilfsmittel, istHilfsmittel } from './shop.js';

// ---------------------------------------------------------------------------
// Sterne
// ---------------------------------------------------------------------------

export type Sterne = 0 | 1 | 2 | 3;

/**
 * Die Sternregel:
 * - 1 Stern: geschafft (alle Giraffen umgefallen),
 * - 2 Sterne: Punkte ≥ `sterne[1]`,
 * - 3 Sterne: Punkte ≥ `sterne[2]` **und kein Hilfsmittel**.
 *
 * Die letzte Bedingung trennt den Shop von den Sternen: Sterne bringen
 * Hub-Münzen und den Goldhelm, ein gekaufter dritter Stern wäre gekaufter
 * Fortschritt auf dem Hub.
 */
export function sterneFuer(level: Level, v: { geschafft: boolean; punkte: number; hilfsmittel: readonly Hilfsmittel[] }): Sterne {
  if (!v.geschafft) return 0;
  if (v.punkte >= level.sterne[2] && v.hilfsmittel.length === 0) return 3;
  if (v.punkte >= level.sterne[1]) return 2;
  return 1;
}

/** Je Level zählt das beste Ergebnis; Sterne gehen nie verloren. */
export function besteSterne(vorher: number, jetzt: Sterne): number {
  return Math.max(vorher, jetzt);
}

// ---------------------------------------------------------------------------
// Freischaltung und Plausibilität
// ---------------------------------------------------------------------------

/** Ein Level ist offen, wenn es das erste ist oder sein Vorgänger in der Reihenfolge geschafft ist. */
export function freigeschaltet(id: string, geschafft: ReadonlySet<string>): boolean {
  const i = levelIndex(id);
  if (i < 0) return false;
  return i === 0 || geschafft.has(LEVELS[i - 1].id);
}

export const MELDUNG = {
  /** Mindestens so viel Zeit je verschossenem Bro zwischen Start und Meldung. */
  msJeBro: 4000,
} as const;

export interface Meldung {
  levelId: string;
  geschafft: boolean;
  punkte: number;
  /** Wie viele Bros geflogen sind (mindestens einer). */
  verschossen: number;
  hilfsmittel: string[];
  /** Zeit zwischen dem Zeitstempel des Levelstarts und der Meldung, vom Server gemessen. */
  dauerMs: number;
}

export type MeldungAbgelehnt =
  | 'level_unbekannt'
  | 'nicht_freigeschaltet'
  | 'hilfsmittel_ungueltig'
  | 'bros_ungueltig'
  | 'punkte_ungueltig'
  | 'zu_schnell';

/**
 * Plausibilität beim Melden (Spezifikation, „Hub-Münzen"). Das hält ein
 * manipuliertes Gerät nicht auf, deckelt aber, was es holen kann — die
 * Kappen der Münzen tun den Rest.
 */
export function pruefeMeldung(m: Meldung, geschafft: ReadonlySet<string>): { ok: true; level: Level; hilfsmittel: Hilfsmittel[] } | { ok: false; grund: MeldungAbgelehnt } {
  const i = levelIndex(m.levelId);
  if (i < 0) return { ok: false, grund: 'level_unbekannt' };
  const level = LEVELS[i];
  if (!freigeschaltet(level.id, geschafft)) return { ok: false, grund: 'nicht_freigeschaltet' };
  if (!m.hilfsmittel.every(istHilfsmittel) || new Set(m.hilfsmittel).size !== m.hilfsmittel.length)
    return { ok: false, grund: 'hilfsmittel_ungueltig' };
  const hilfsmittel = HILFSMITTEL.filter((h) => m.hilfsmittel.includes(h));
  const ersatzPelle = hilfsmittel.includes('ersatz-pelle');
  const bros = level.bros.length + (ersatzPelle ? 1 : 0);
  if (!Number.isInteger(m.verschossen) || m.verschossen < 1 || m.verschossen > bros) return { ok: false, grund: 'bros_ungueltig' };
  if (!Number.isInteger(m.punkte) || m.punkte < 0 || m.punkte > hoechstpunkte(level, { ersatzPelle }))
    return { ok: false, grund: 'punkte_ungueltig' };
  if (!(m.dauerMs >= m.verschossen * MELDUNG.msJeBro)) return { ok: false, grund: 'zu_schnell' };
  return { ok: true, level, hilfsmittel };
}

// ---------------------------------------------------------------------------
// Flugmeilen
// ---------------------------------------------------------------------------

/** Die Spielwährung bleibt im Spiel — nie in Hub-Münzen getauscht, auch nicht umgekehrt. */
export const MEILEN = {
  erstmalsGeschafft: 30,
  jeNeuerStern: 10,
  erneutGeschafft: 5,
  /** So viele Wiederholungen je Tag bringen Meilen, danach nichts mehr. */
  wiederholungenJeTag: 10,
  weltGeschafft: 100,
  weltAlleSterne: 200,
} as const;

/** Bestes Ergebnis je Level-Kennung (0 = nie geschafft). */
export type SterneJeLevel = Readonly<Record<string, number>>;

/**
 * Ist die Welt vollständig im Katalog und jedes ihrer Level mit mindestens
 * `mind` Sternen? Eine Welt, die erst teilweise als Daten vorliegt, gilt nie
 * als geschafft — sonst gäbe es den Weltbonus nach Level 10 und für die
 * später nachgelieferten fünf nichts mehr.
 *
 * `katalog` gibt es nur für Tests — eine vollständige Welt liegt noch nicht vor.
 */
export function weltErfuellt(welt: number, sterne: SterneJeLevel, mind: number, katalog: readonly Level[] = LEVELS): boolean {
  const ls = katalog.filter((l) => l.welt === welt);
  return ls.length === LEVEL_JE_WELT && ls.every((l) => (sterne[l.id] ?? 0) >= mind);
}

export interface MeilenErgebnis {
  erstmals: number;
  neueSterne: number;
  wiederholung: number;
  welt: number;
  weltAlleSterne: number;
  summe: number;
  /** Zählt diese Meldung als eine der Wiederholungen des Tages? */
  zaehltAlsWiederholung: boolean;
}

/**
 * Flugmeilen für einen gewerteten Versuch.
 *
 * `vorher` ist der Stand aller Level VOR dieser Meldung; `wiederholungenHeute`
 * zählt die Wiederholungen, die heute schon Meilen gebracht haben (die
 * Tagesgrenze zieht der Server nach Berliner Kalendertag, wie beim Runner).
 */
export function meilenFuer(
  level: Level,
  sterne: Sterne,
  vorher: SterneJeLevel,
  wiederholungenHeute: number,
  katalog: readonly Level[] = LEVELS,
): MeilenErgebnis {
  const alt = vorher[level.id] ?? 0;
  const neu = besteSterne(alt, sterne);
  const nachher: SterneJeLevel = { ...vorher, [level.id]: neu };

  const geschafft = sterne > 0;
  const erstmals = geschafft && alt === 0 ? MEILEN.erstmalsGeschafft : 0;
  const neueSterne = (neu - alt) * MEILEN.jeNeuerStern;
  const zaehltAlsWiederholung = geschafft && alt > 0 && wiederholungenHeute < MEILEN.wiederholungenJeTag;
  const wiederholung = zaehltAlsWiederholung ? MEILEN.erneutGeschafft : 0;
  const neuErfuellt = (mind: number) => !weltErfuellt(level.welt, vorher, mind, katalog) && weltErfuellt(level.welt, nachher, mind, katalog);
  const welt = neuErfuellt(1) ? MEILEN.weltGeschafft : 0;
  const weltAlleSterne = neuErfuellt(3) ? MEILEN.weltAlleSterne : 0;
  return {
    erstmals,
    neueSterne,
    wiederholung,
    welt,
    weltAlleSterne,
    summe: erstmals + neueSterne + wiederholung + welt + weltAlleSterne,
    zaehltAlsWiederholung,
  };
}

// ---------------------------------------------------------------------------
// Hub-Münzen (gekappt wie beim Runner)
// ---------------------------------------------------------------------------

/** Hub-Münzen je NEU erreichtem Stern. */
export const FLYINGBRO_MUENZEN_JE_STERN = 2;
/** Höchstens so viel aus einer einzelnen Levelmeldung (3 neue Sterne). */
export const FLYINGBRO_MAX_PRO_LEVEL = 6;
/** Höchstens so viel aus Flying Bro je Kalendertag (Berlin), wie der Runner. */
export const FLYINGBRO_MAX_PRO_TAG = 40;
/** Einmalig je Welt, wenn alle 15 Level geschafft sind — außerhalb der Tageskappe. */
export const FLYINGBRO_WELT_MUENZEN = 50;

export interface MuenzErgebnis {
  /** Jetzt gutzuschreiben (Sterne plus Nachzahlung, gekappt). */
  gutschrift: number;
  /** Weltbonus, ohne Tageskappe. */
  welt: number;
  /** Was über die Tageskappe ging und am nächsten Tag nachgezahlt wird (Spalte `muenzen_offen`). */
  offen: number;
}

/**
 * Münzen gibt es nur für neue Sterne, nie fürs Wiederholen — damit ist auch
 * die Lebenssumme gedeckelt. Was über die Tageskappe geht, verfällt nicht,
 * sondern wird beim nächsten Melden nachgezahlt; sonst bestraft die Kappe
 * den, der an einem Abend eine ganze Welt durchspielt.
 */
export function muenzenFuer(v: {
  neueSterne: number;
  /** Aus Flying Bro heute schon gutgeschrieben (ohne Weltbonus). */
  heuteSchon: number;
  /** Offen aus früheren Tagen. */
  offen: number;
  weltNeuGeschafft: boolean;
}): MuenzErgebnis {
  const sterne = Math.min(Math.max(0, v.neueSterne) * FLYINGBRO_MUENZEN_JE_STERN, FLYINGBRO_MAX_PRO_LEVEL);
  const anspruch = sterne + Math.max(0, v.offen);
  const frei = Math.max(0, FLYINGBRO_MAX_PRO_TAG - v.heuteSchon);
  const gutschrift = Math.min(anspruch, frei);
  return { gutschrift, welt: v.weltNeuGeschafft ? FLYINGBRO_WELT_MUENZEN : 0, offen: anspruch - gutschrift };
}

// ---------------------------------------------------------------------------
// Alles zusammen
// ---------------------------------------------------------------------------

export interface Wertung {
  sterne: Sterne;
  besteSterne: number;
  neueSterne: number;
  meilen: MeilenErgebnis;
  muenzen: MuenzErgebnis;
}

/**
 * Eine bereits geprüfte Meldung (`pruefeMeldung`) werten: Sterne, Meilen und
 * Münzen in einem Aufruf, wie `/api/runner/lauf`.
 */
export function werte(
  level: Level,
  v: { geschafft: boolean; punkte: number; hilfsmittel: readonly Hilfsmittel[] },
  konto: { sterne: SterneJeLevel; wiederholungenHeute: number; muenzenHeute: number; muenzenOffen: number },
  katalog: readonly Level[] = LEVELS,
): Wertung {
  const sterne = sterneFuer(level, v);
  const alt = konto.sterne[level.id] ?? 0;
  const beste = besteSterne(alt, sterne);
  const nachher = { ...konto.sterne, [level.id]: beste };
  const meilen = meilenFuer(level, sterne, konto.sterne, konto.wiederholungenHeute, katalog);
  const muenzen = muenzenFuer({
    neueSterne: beste - alt,
    heuteSchon: konto.muenzenHeute,
    offen: konto.muenzenOffen,
    weltNeuGeschafft: !weltErfuellt(level.welt, konto.sterne, 1, katalog) && weltErfuellt(level.welt, nachher, 1, katalog),
  });
  return { sterne, besteSterne: beste, neueSterne: beste - alt, meilen, muenzen };
}
