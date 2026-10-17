/**
 * Doppelkopf lernen: Lernpfad und Tagesserie (Emile, 17.10.2026).
 *
 * Die Lektionen selbst — Inhalt und richtige Antworten — stehen im Modul
 * (`LEKTIONEN` in game-doppelkopf/src/lernen.ts). Hier steht nur, was der
 * Server darueber festhalten muss: welche Lektionen erledigt sind und wie
 * lang die Serie ist.
 *
 * **Die Serie** waechst um eins je Kalendertag (Europe/Berlin, wie die
 * Tagesaufgaben), an dem man eine Lektion abschliesst oder eine
 * Uebungsrunde zu Ende spielt. Mehrere am selben Tag zaehlen einmal.
 *
 * **Ein Schutz je Woche** (Emiles Wahl): Fehlt GENAU ein Tag, ueberbrueckt
 * ihn der Schutz — sofern der letzte Schutz mindestens sieben Tage
 * zurueckliegt. Ab dem zweiten verpassten Tag beginnt die Serie neu. Der
 * ueberbrueckte Tag zaehlt nicht mit, er haelt die Serie nur am Leben (wie
 * Duolingos Streak-Freeze).
 *
 * **Nach sieben Tagen** gibt es das Doko-Meister-Outfit (`LERN_OUTFIT`), genau
 * einmal je Konto. Die Serie zaehlt danach weiter.
 *
 * Die Regeln stehen als reine Funktionen vorn (`spielen`, `serieHeute`), die
 * Datenbank dahinter — so laesst sich jede Kalenderlage pruefen, ohne einen
 * Tag zu warten.
 */

import { and, eq, gt, isNull, lt, ne, or } from 'drizzle-orm';
import { LEKTIONEN, UEBUNGS_LEKTION, lektionVon } from '@brauweg/game-doppelkopf';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { notFound } from './errors.js';
import { LERN_OUTFIT, schenken } from './kosmetik.js';
import { heute } from './truhen.js';

/** So viele Tage am Stueck bringen das Outfit. */
export const ZIEL_TAGE = 7;
/** So viele Tage muessen zwischen zwei ueberbrueckten Tagen liegen. */
export const SCHUTZ_ABSTAND = 7;

// ---------------------------------------------------------------------------
// Regeln
// ---------------------------------------------------------------------------

export interface SerienStand {
  readonly serie: number;
  readonly beste: number;
  /** Letzter Tag, an dem gespielt wurde (ISO, Berlin). */
  readonly letzterTag: string | null;
  /** Letzter Tag, den der Schutz ueberbrueckt hat. */
  readonly schutzTag: string | null;
}

export const LEERE_SERIE: SerienStand = { serie: 0, beste: 0, letzterTag: null, schutzTag: null };

/** Tage von `von` bis `bis` (beide ISO-Kalendertage). */
export function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 86_400_000);
}

/** Der Kalendertag `tage` vor `tag`. */
export function tagDavor(tag: string, tage = 1): string {
  return new Date(Date.parse(`${tag}T00:00:00Z`) - tage * 86_400_000).toISOString().slice(0, 10);
}

/** Ist der Wochenschutz an diesem Tag noch zu haben? */
export function schutzFrei(stand: SerienStand, tag: string): boolean {
  return stand.schutzTag === null || tageZwischen(stand.schutzTag, tag) >= SCHUTZ_ABSTAND;
}

/**
 * Was ein Spieltag aus der Serie macht.
 *
 * `geschuetzt` sagt, ob dabei der Wochenschutz verbraucht wurde — der
 * Bildschirm erzaehlt es dann („Dein Schutz hat gestern gerettet").
 */
export function spielen(stand: SerienStand, tag: string): { stand: SerienStand; geschuetzt: boolean } {
  if (stand.letzterTag === tag) return { stand, geschuetzt: false };
  const luecke = stand.letzterTag === null ? Infinity : tageZwischen(stand.letzterTag, tag);

  let serie = 1;
  let schutzTag = stand.schutzTag;
  let geschuetzt = false;
  if (luecke === 1) {
    serie = stand.serie + 1;
  } else if (luecke === 2 && stand.serie > 0 && schutzFrei(stand, tag)) {
    serie = stand.serie + 1;
    schutzTag = tagDavor(tag);
    geschuetzt = true;
  }
  return {
    stand: { serie, beste: Math.max(stand.beste, serie), letzterTag: tag, schutzTag },
    geschuetzt,
  };
}

/** Die Serie, wie sie heute dasteht — ohne dass gespielt wird. */
export interface SerieHeute {
  /** Laufende Serie; 0, wenn sie gerissen ist. */
  readonly serie: number;
  readonly beste: number;
  readonly heuteGespielt: boolean;
  /** Ein verpasster Tag liegt schon dazwischen — heute spielen, sonst ist sie weg. */
  readonly brauchtSchutz: boolean;
  readonly schutzFrei: boolean;
}

export function serieHeute(stand: SerienStand, tag: string): SerieHeute {
  const frei = schutzFrei(stand, tag);
  const luecke = stand.letzterTag === null ? Infinity : tageZwischen(stand.letzterTag, tag);
  const lebt = luecke <= 1 || (luecke === 2 && stand.serie > 0 && frei);
  return {
    serie: lebt ? stand.serie : 0,
    beste: stand.beste,
    heuteGespielt: luecke === 0,
    brauchtSchutz: lebt && luecke === 2,
    schutzFrei: frei,
  };
}

// ---------------------------------------------------------------------------
// Datenbank
// ---------------------------------------------------------------------------

type Zeile = typeof s.lernpfad.$inferSelect;

function standAus(zeile: Zeile | undefined): SerienStand {
  if (!zeile) return LEERE_SERIE;
  return { serie: zeile.serie, beste: zeile.beste, letzterTag: zeile.letzterTag, schutzTag: zeile.schutzTag };
}

async function zeileVon(db: Db, accountId: string): Promise<Zeile | undefined> {
  const [zeile] = await db.select().from(s.lernpfad).where(eq(s.lernpfad.accountId, accountId));
  return zeile;
}

/** Was der Bildschirm ueber den Pfad wissen muss. */
export interface LernpfadAnsicht {
  readonly lektionen: readonly {
    readonly id: string;
    readonly titel: string;
    readonly kurz: string;
    readonly uebung: boolean;
    readonly erledigt: boolean;
  }[];
  readonly serie: SerieHeute;
  readonly ziel: number;
  /** Gesetzt, sobald das Outfit vergeben ist. */
  readonly belohnt: boolean;
  readonly outfit: readonly string[];
}

export async function lernpfadVon(db: Db, accountId: string, jetzt = new Date()): Promise<LernpfadAnsicht> {
  const zeile = await zeileVon(db, accountId);
  const erledigt = new Set(zeile?.lektionen ?? []);
  return {
    lektionen: LEKTIONEN.map((lektion) => ({
      id: lektion.id,
      titel: lektion.titel,
      kurz: lektion.kurz,
      uebung: lektion.uebung === true,
      erledigt: erledigt.has(lektion.id),
    })),
    serie: serieHeute(standAus(zeile), heute(jetzt)),
    ziel: ZIEL_TAGE,
    belohnt: zeile?.belohntAm != null,
    outfit: LERN_OUTFIT,
  };
}

/** Kurzfassung fuer `/api/me` — die Flamme auf dem Startbildschirm. */
export async function lernserieKurz(
  db: Db,
  accountId: string,
  jetzt = new Date(),
): Promise<{ serie: number; heuteGespielt: boolean; belohnt: boolean; ziel: number }> {
  const zeile = await zeileVon(db, accountId);
  const stand = serieHeute(standAus(zeile), heute(jetzt));
  return { serie: stand.serie, heuteGespielt: stand.heuteGespielt, belohnt: zeile?.belohntAm != null, ziel: ZIEL_TAGE };
}

export interface Spieltag {
  readonly serie: number;
  /** Die Serie ist durch diesen Aufruf gewachsen (erster Spieltag heute). */
  readonly neuerTag: boolean;
  readonly geschuetzt: boolean;
  /** Das Outfit wurde gerade vergeben. */
  readonly belohnung: boolean;
}

/**
 * Ein Spieltag: Lektion erledigt (`lektionId`) oder Uebungsrunde gespielt.
 * Schreibt Serie und Lektion in einem Zug und vergibt bei Tag sieben das
 * Outfit.
 */
export async function spieltagEintragen(
  db: Db,
  accountId: string,
  lektionId: string | null,
  jetzt = new Date(),
): Promise<Spieltag> {
  const tag = heute(jetzt);
  const zeile = await zeileVon(db, accountId);
  const vorher = standAus(zeile);
  const { stand, geschuetzt } = spielen(vorher, tag);
  const lektionen = new Set(zeile?.lektionen ?? []);
  if (lektionId) lektionen.add(lektionId);
  const belohnung = stand.serie >= ZIEL_TAGE && zeile?.belohntAm == null;

  const werte = {
    lektionen: [...lektionen],
    serie: stand.serie,
    beste: stand.beste,
    letzterTag: stand.letzterTag,
    schutzTag: stand.schutzTag,
    ...(belohnung ? { belohntAm: jetzt } : {}),
  };
  await db
    .insert(s.lernpfad)
    .values({ accountId, ...werte })
    .onConflictDoUpdate({ target: s.lernpfad.accountId, set: werte });

  if (belohnung) await schenken(db, accountId, LERN_OUTFIT);
  return { serie: stand.serie, neuerTag: vorher.letzterTag !== tag, geschuetzt, belohnung };
}

/** Eine Lektion ohne Tisch ist geschafft. Die Uebungslektion endet am Tisch. */
export async function lektionAbschliessen(
  db: Db,
  accountId: string,
  lektionId: string,
  jetzt = new Date(),
): Promise<Spieltag> {
  const lektion = lektionVon(lektionId);
  if (!lektion || lektion.uebung) throw notFound('lektionUnbekannt');
  return spieltagEintragen(db, accountId, lektionId, jetzt);
}

/** Eine Uebungsrunde ist abgerechnet — zaehlt als Spieltag und erledigt die Uebungslektion. */
export async function uebungGespielt(db: Db, accountId: string, jetzt = new Date()): Promise<Spieltag> {
  return spieltagEintragen(db, accountId, UEBUNGS_LEKTION, jetzt);
}

// ---------------------------------------------------------------------------
// Abend-Erinnerung
// ---------------------------------------------------------------------------

/** Ab dieser Stunde (Berlin) erinnert der Server an eine gefaehrdete Serie. */
export const ERINNERUNG_AB_STUNDE = 19;

function berlinStunde(jetzt: Date): number {
  // Aus den Teilen und nicht aus dem fertigen Text: `de-DE` schreibt
  // „12 Uhr", und `Number("12 Uhr")` ist NaN — dann waere jede Stunde Abend.
  const teil = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(jetzt)
    .find((p) => p.type === 'hour');
  return Number(teil?.value ?? 0);
}

/**
 * Konten, deren Serie heute noch offen ist und die heute noch keine
 * Erinnerung bekommen haben — markiert sie zugleich als erinnert. Vor
 * `ERINNERUNG_AB_STUNDE` niemand: Morgens an eine Serie zu erinnern, die
 * man am Abend ohnehin pflegt, waere Laerm.
 */
export async function faelligeErinnerungen(db: Db, jetzt = new Date()): Promise<string[]> {
  if (berlinStunde(jetzt) < ERINNERUNG_AB_STUNDE) return [];
  const tag = heute(jetzt);
  const vorgestern = tagDavor(tag, 2);
  const kandidaten = await db
    .select()
    .from(s.lernpfad)
    .where(
      and(
        gt(s.lernpfad.serie, 0),
        ne(s.lernpfad.letzterTag, tag),
        // Aelter als vorgestern ist die Serie ohnehin weg.
        gt(s.lernpfad.letzterTag, tagDavor(vorgestern)),
        or(isNull(s.lernpfad.erinnertTag), lt(s.lernpfad.erinnertTag, tag)),
      ),
    );
  const faellig = kandidaten.filter((zeile) => serieHeute(standAus(zeile), tag).serie > 0);
  for (const zeile of faellig) {
    await db.update(s.lernpfad).set({ erinnertTag: tag }).where(eq(s.lernpfad.accountId, zeile.accountId));
  }
  return faellig.map((zeile) => zeile.accountId);
}
