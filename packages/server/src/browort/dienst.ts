/**
 * Browort und Clanwort: was der Server festhaelt (Emile, 23.10.2026).
 *
 * **Browort** — ein Wort am Tag fuer alle (Europe/Berlin), sechs Versuche.
 * Die Serie waechst je Tag, an dem das Wort geloest wird; wer es nicht
 * loest, faengt neu an (wie im Original). Fehlt EIN Tag, haelt der
 * Wochenschutz die Serie — dieselbe Regel wie beim Lernpfad, deshalb hier
 * `spielen` und `serieHeute` von dort. Im Profil stehen Serie und der
 * Schnitt der Versuche bei geloesten Woertern.
 *
 * **Clanwort** — je Clan und Tag wird ein Mitglied ausgelost, das bis 12 Uhr
 * ein Wort waehlt (und an dem Tag selbst nicht raet). Waehlt es nicht,
 * nimmt der Server ein Zufallswort. Die anderen raten; die Clanhalle zeigt
 * die Tagesrangliste. Eigene Serie, eigene Belohnung.
 *
 * Das Loesungswort verlaesst den Server erst, wenn die Runde fertig ist —
 * vorher gehen nur die Farben hinaus.
 */

import { randomInt } from 'node:crypto';

import { and, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { type SerieHeute, type SerienStand, LEERE_SERIE, serieHeute, spielen, tagDavor } from '../lernpfad.js';
import { heute } from '../truhen.js';
import { zaehle } from '../statistik.js';
import { gutschreiben } from '../waehrung.js';
import {
  type Farbe,
  MAX_VERSUCHE,
  MUENZEN_BROWORT,
  MUENZEN_CLANWORT,
  XP_BROWORT,
  XP_CLANWORT,
  farben,
  schnitt,
  tageswort,
} from './regeln.js';
import { ERLAUBT, LOESUNGEN, wortGueltig } from './woerter.js';

/** Aus der Umgebung, damit der Kalender nicht aus dem Repo nachzurechnen ist (regeln.ts). */
export const SALZ = process.env.BROWORT_SALZ ?? 'brauweg-browort';

/** Bis zu dieser Stunde (Berlin) darf das ausgeloste Mitglied waehlen. */
export const WAHL_BIS_STUNDE = 12;
/** Ab dieser Stunde (Berlin) erinnert der Server an ein offenes Browort. */
export const ERINNERUNG_AB_STUNDE = 19;

function berlinStunde(jetzt: Date): number {
  // Aus den Teilen, nicht aus dem fertigen Text — siehe lernpfad.ts.
  const teil = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(jetzt)
    .find((p) => p.type === 'hour');
  return Number(teil?.value ?? 0);
}

/** Eingabe vom Geraet: gross, ohne Leerraum. „ß" gibt es nicht (woerter.ts). */
export function normiere(wort: string): string {
  return wort.trim().toLocaleUpperCase('de-DE');
}

function pruefeWort(wort: string): string {
  const normiert = normiere(wort);
  if (!wortGueltig(normiert)) throw badRequest('browortForm');
  if (!ERLAUBT.has(normiert)) throw badRequest('browortUnbekannt');
  return normiert;
}

// ---------------------------------------------------------------------------
// Ansicht
// ---------------------------------------------------------------------------

export interface VersuchAnsicht {
  readonly wort: string;
  readonly farben: readonly Farbe[];
}

export interface RundenAnsicht {
  readonly tag: string;
  readonly versuche: readonly VersuchAnsicht[];
  readonly maxVersuche: number;
  readonly fertig: boolean;
  readonly geloest: boolean;
  /** Erst nach dem Ende der Runde, vorher null. */
  readonly loesung: string | null;
}

export interface Statistik {
  readonly gespielt: number;
  readonly geloest: number;
  /** Schnitt der Versuche bei geloesten Woertern, null ohne Loesung. */
  readonly schnitt: number | null;
  /** Wie oft mit 1 … 6 Versuchen geloest. */
  readonly verteilung: readonly number[];
}

export interface BrowortAnsicht extends RundenAnsicht {
  readonly serie: SerieHeute;
  readonly statistik: Statistik;
}

export interface Belohnung {
  readonly muenzen: number;
  readonly xp: number;
}

function runde(tag: string, versuche: readonly string[], loesung: string, fertig: boolean, geloest: boolean): RundenAnsicht {
  return {
    tag,
    versuche: versuche.map((wort) => ({ wort, farben: farben(wort, loesung) })),
    maxVersuche: MAX_VERSUCHE,
    fertig,
    geloest,
    loesung: fertig ? loesung : null,
  };
}

// ---------------------------------------------------------------------------
// Stand (Serien, Zahlen)
// ---------------------------------------------------------------------------

type StandZeile = typeof s.browortStand.$inferSelect;

async function standVon(db: Db, accountId: string): Promise<StandZeile | undefined> {
  const [zeile] = await db.select().from(s.browortStand).where(eq(s.browortStand.accountId, accountId));
  return zeile;
}

function browortSerie(zeile: StandZeile | undefined): SerienStand {
  if (!zeile) return LEERE_SERIE;
  return { serie: zeile.serie, beste: zeile.beste, letzterTag: zeile.letzterTag, schutzTag: zeile.schutzTag };
}

function clanSerie(zeile: StandZeile | undefined): SerienStand {
  if (!zeile) return LEERE_SERIE;
  return {
    serie: zeile.clanSerie,
    beste: zeile.clanBeste,
    letzterTag: zeile.clanLetzterTag,
    schutzTag: zeile.clanSchutzTag,
  };
}

function statistikAus(zeile: StandZeile | undefined): Statistik {
  return {
    gespielt: zeile?.gespielt ?? 0,
    geloest: zeile?.geloest ?? 0,
    schnitt: schnitt(zeile?.versucheSumme ?? 0, zeile?.geloest ?? 0),
    verteilung: zeile?.verteilung ?? [0, 0, 0, 0, 0, 0],
  };
}

/** Wer nicht loest, faengt neu an: Serie 0, heute gespielt (kein Schutz ueber diesen Tag). */
function verloren(stand: SerienStand, tag: string): SerienStand {
  return { serie: 0, beste: stand.beste, letzterTag: tag, schutzTag: stand.schutzTag };
}

async function belohnen(db: Db, accountId: string, belohnung: Belohnung): Promise<void> {
  if (belohnung.muenzen > 0) await gutschreiben(db, accountId, 'coins', belohnung.muenzen);
  if (belohnung.xp > 0) {
    await db
      .update(s.account)
      .set({ xp: sql`${s.account.xp} + ${belohnung.xp}` })
      .where(eq(s.account.id, accountId));
  }
}

// ---------------------------------------------------------------------------
// Browort
// ---------------------------------------------------------------------------

export async function browortHeute(db: Db, accountId: string, jetzt = new Date(), salz = SALZ): Promise<BrowortAnsicht> {
  const tag = heute(jetzt);
  const loesung = tageswort(tag, salz);
  const [zeile] = await db
    .select()
    .from(s.browortRunde)
    .where(and(eq(s.browortRunde.accountId, accountId), eq(s.browortRunde.tag, tag)));
  const stand = await standVon(db, accountId);
  return {
    ...runde(tag, zeile?.versuche ?? [], loesung, zeile?.fertig ?? false, zeile?.geloest ?? false),
    serie: serieHeute(browortSerie(stand), tag),
    statistik: statistikAus(stand),
  };
}

/**
 * Tagesstatistik (statistik.ts). Erst hier, nachdem der Versuch in der
 * Zeile steht — ein abgewiesener Doppelversuch zaehlt nicht. `begonnen` beim
 * ersten Versuch des Tages, `geloest`/`verloren`, sobald der Server die Runde
 * entschieden hat; wer aufhoert, bleibt nur in `begonnen`.
 */
function rundeZaehlen(spiel: 'browort' | 'clanwort', erster: boolean, fertig: boolean, geloest: boolean): void {
  if (erster) zaehle('wortspiel_runde', { spiel, ergebnis: 'begonnen' });
  if (fertig) zaehle('wortspiel_runde', { spiel, ergebnis: geloest ? 'geloest' : 'verloren' });
}

export async function browortRaten(
  db: Db,
  accountId: string,
  eingabe: string,
  jetzt = new Date(),
  salz = SALZ,
): Promise<BrowortAnsicht & { belohnung: Belohnung | null; geschuetzt: boolean }> {
  const wort = pruefeWort(eingabe);
  const tag = heute(jetzt);
  const loesung = tageswort(tag, salz);

  const [alt] = await db
    .select()
    .from(s.browortRunde)
    .where(and(eq(s.browortRunde.accountId, accountId), eq(s.browortRunde.tag, tag)));
  if (alt?.fertig) throw conflict('browortFertig');

  const versuche = [...(alt?.versuche ?? []), wort];
  const geloest = wort === loesung;
  const fertig = geloest || versuche.length >= MAX_VERSUCHE;

  if (!alt) {
    // Gleichzeitiger erster Versuch zweier Geraete: der zweite trifft auf die
    // Zeile und scheitert hier, statt einen Versuch zu verschlucken.
    const neu = await db
      .insert(s.browortRunde)
      .values({ accountId, tag, versuche, geloest, fertig })
      .onConflictDoNothing()
      .returning({ tag: s.browortRunde.tag });
    if (neu.length === 0) throw conflict('browortDoppelt');
  } else {
    // Nur, wenn seit dem Lesen niemand dazwischen geraten hat.
    const geaendert = await db
      .update(s.browortRunde)
      .set({ versuche, geloest, fertig })
      .where(
        and(
          eq(s.browortRunde.accountId, accountId),
          eq(s.browortRunde.tag, tag),
          sql`jsonb_array_length(${s.browortRunde.versuche}) = ${alt.versuche.length}`,
        ),
      )
      .returning({ tag: s.browortRunde.tag });
    if (geaendert.length === 0) throw conflict('browortDoppelt');
  }

  rundeZaehlen('browort', !alt, fertig, geloest);

  let belohnung: Belohnung | null = null;
  let geschuetzt = false;
  if (fertig) {
    const zeile = await standVon(db, accountId);
    const vorher = browortSerie(zeile);
    let serie: SerienStand;
    if (geloest) {
      const gespielt = spielen(vorher, tag);
      serie = gespielt.stand;
      geschuetzt = gespielt.geschuetzt;
      belohnung = { muenzen: MUENZEN_BROWORT[versuche.length - 1]!, xp: XP_BROWORT[versuche.length - 1]! };
    } else {
      serie = verloren(vorher, tag);
    }
    const verteilung = [...(zeile?.verteilung ?? [0, 0, 0, 0, 0, 0])];
    if (geloest) verteilung[versuche.length - 1] = (verteilung[versuche.length - 1] ?? 0) + 1;
    const werte = {
      serie: serie.serie,
      beste: serie.beste,
      letzterTag: serie.letzterTag,
      schutzTag: serie.schutzTag,
      gespielt: (zeile?.gespielt ?? 0) + 1,
      geloest: (zeile?.geloest ?? 0) + (geloest ? 1 : 0),
      versucheSumme: (zeile?.versucheSumme ?? 0) + (geloest ? versuche.length : 0),
      verteilung,
    };
    await db
      .insert(s.browortStand)
      .values({ accountId, ...werte })
      .onConflictDoUpdate({ target: s.browortStand.accountId, set: werte });
    if (belohnung) await belohnen(db, accountId, belohnung);
  }

  return { ...(await browortHeute(db, accountId, jetzt, salz)), belohnung, geschuetzt };
}

/** Kurzfassung fuer `/api/me` — die Flamme auf dem Startbildschirm. */
export async function browortKurz(
  db: Db,
  accountId: string,
  jetzt = new Date(),
): Promise<{ serie: number; heuteGespielt: boolean; schnitt: number | null; geloest: number }> {
  const tag = heute(jetzt);
  const zeile = await standVon(db, accountId);
  const stand = serieHeute(browortSerie(zeile), tag);
  return {
    serie: stand.serie,
    heuteGespielt: stand.heuteGespielt,
    schnitt: schnitt(zeile?.versucheSumme ?? 0, zeile?.geloest ?? 0),
    geloest: zeile?.geloest ?? 0,
  };
}

/** Fuer das Profil eines Spielers — auch eines fremden (Emile: „steht im Profil"). */
export async function browortProfil(
  db: Db,
  accountId: string,
  jetzt = new Date(),
): Promise<{ serie: number; beste: number; schnitt: number | null; geloest: number; gespielt: number } | null> {
  const zeile = await standVon(db, accountId);
  if (!zeile || zeile.gespielt === 0) return null;
  const stand = serieHeute(browortSerie(zeile), heute(jetzt));
  return {
    serie: stand.serie,
    beste: zeile.beste,
    schnitt: schnitt(zeile.versucheSumme, zeile.geloest),
    geloest: zeile.geloest,
    gespielt: zeile.gespielt,
  };
}

/**
 * Konten mit laufender Serie, deren Wort heute noch offen ist — markiert sie
 * zugleich als erinnert (eine Mitteilung je Tag). Dieselbe Regel wie beim
 * Lernpfad: vor dem Abend niemand.
 */
export async function faelligeBrowortErinnerungen(db: Db, jetzt = new Date()): Promise<string[]> {
  if (berlinStunde(jetzt) < ERINNERUNG_AB_STUNDE) return [];
  const tag = heute(jetzt);
  const kandidaten = await db
    .select()
    .from(s.browortStand)
    .where(
      and(
        gt(s.browortStand.serie, 0),
        ne(s.browortStand.letzterTag, tag),
        gt(s.browortStand.letzterTag, tagDavor(tag, 3)),
        or(isNull(s.browortStand.erinnertTag), lt(s.browortStand.erinnertTag, tag)),
      ),
    );
  const faellig = kandidaten.filter((zeile) => serieHeute(browortSerie(zeile), tag).serie > 0);
  for (const zeile of faellig) {
    await db.update(s.browortStand).set({ erinnertTag: tag }).where(eq(s.browortStand.accountId, zeile.accountId));
  }
  return faellig.map((zeile) => zeile.accountId);
}

// ---------------------------------------------------------------------------
// Clanwort
// ---------------------------------------------------------------------------

export type ClanwortPhase = 'waehlen' | 'warten' | 'raten' | 'wortgeber';

export interface ClanwortAnsicht extends RundenAnsicht {
  readonly clubId: string;
  readonly phase: ClanwortPhase;
  readonly waehler: { readonly id: string; readonly name: string } | null;
  /** Bis wann (Stunde, Berlin) gewaehlt werden kann. */
  readonly wahlBis: number;
  /** Der Server hat gewaehlt, weil bis Mittag nichts kam. */
  readonly zufall: boolean;
  readonly rangliste: readonly {
    readonly accountId: string;
    readonly name: string;
    readonly versuche: number;
    readonly geloest: boolean;
    readonly fertig: boolean;
  }[];
  readonly serie: SerieHeute;
}

async function clubVon(db: Db, accountId: string): Promise<string | null> {
  const [zeile] = await db
    .select({ clubId: s.clubMember.clubId })
    .from(s.clubMember)
    .where(eq(s.clubMember.accountId, accountId))
    .limit(1);
  return zeile?.clubId ?? null;
}

type TagZeile = typeof s.clanwortTag.$inferSelect;

/**
 * Der Clanwort-Tag: beim ersten Aufruf des Tages wird ausgelost. Zwei
 * Mitglieder gleichzeitig: Das zweite Einfuegen laeuft ins Leere, beide
 * lesen danach dieselbe Zeile — und nur der Gewinner des Einfuegens schickt
 * die Mitteilung.
 */
async function tagVon(
  db: Db,
  clubId: string,
  tag: string,
  jetzt: Date,
  onAusgelost?: (waehlerId: string) => void,
): Promise<TagZeile> {
  const [vorhanden] = await db
    .select()
    .from(s.clanwortTag)
    .where(and(eq(s.clanwortTag.clubId, clubId), eq(s.clanwortTag.tag, tag)));
  let zeile = vorhanden;
  if (!zeile) {
    const mitglieder = await db
      .select({ accountId: s.clubMember.accountId })
      .from(s.clubMember)
      .where(and(eq(s.clubMember.clubId, clubId), ne(s.clubMember.role, 'guest')));
    if (mitglieder.length === 0) throw notFound('clubUnknown');
    const waehlerId = mitglieder[randomInt(mitglieder.length)]!.accountId;
    // Allein im Clan gibt es niemanden, der raten koennte — dann waehlt der Server.
    const allein = mitglieder.length < 2;
    const neu = await db
      .insert(s.clanwortTag)
      .values({
        clubId,
        tag,
        waehlerId: allein ? null : waehlerId,
        ...(allein ? { wort: LOESUNGEN[randomInt(LOESUNGEN.length)]!, zufall: true, gewaehltAm: jetzt } : {}),
      })
      .onConflictDoNothing()
      .returning();
    if (neu[0] && !allein) onAusgelost?.(waehlerId);
    [zeile] = neu.length > 0
      ? neu
      : await db
          .select()
          .from(s.clanwortTag)
          .where(and(eq(s.clanwortTag.clubId, clubId), eq(s.clanwortTag.tag, tag)));
  }
  // Mittag vorbei und nichts gewaehlt: Der Server waehlt, damit der Clan raten kann.
  if (zeile && zeile.wort === null && berlinStunde(jetzt) >= WAHL_BIS_STUNDE) {
    const [gewaehlt] = await db
      .update(s.clanwortTag)
      .set({ wort: LOESUNGEN[randomInt(LOESUNGEN.length)]!, zufall: true, gewaehltAm: jetzt })
      .where(and(eq(s.clanwortTag.clubId, clubId), eq(s.clanwortTag.tag, tag), isNull(s.clanwortTag.wort)))
      .returning();
    if (gewaehlt) zeile = gewaehlt;
    else {
      [zeile] = await db
        .select()
        .from(s.clanwortTag)
        .where(and(eq(s.clanwortTag.clubId, clubId), eq(s.clanwortTag.tag, tag)));
    }
  }
  return zeile!;
}

export async function clanwortHeute(
  db: Db,
  accountId: string,
  jetzt = new Date(),
  onAusgelost?: (waehlerId: string) => void,
): Promise<ClanwortAnsicht | null> {
  const clubId = await clubVon(db, accountId);
  if (!clubId) return null;
  const tag = heute(jetzt);
  const tagZeile = await tagVon(db, clubId, tag, jetzt, onAusgelost);

  const ichWaehle = tagZeile.waehlerId === accountId;
  const phase: ClanwortPhase =
    tagZeile.wort === null ? (ichWaehle ? 'waehlen' : 'warten') : ichWaehle && !tagZeile.zufall ? 'wortgeber' : 'raten';

  const [meine] = await db
    .select()
    .from(s.clanwortRunde)
    .where(and(eq(s.clanwortRunde.clubId, clubId), eq(s.clanwortRunde.tag, tag), eq(s.clanwortRunde.accountId, accountId)));

  const zeilen = await db
    .select({
      accountId: s.clanwortRunde.accountId,
      name: s.account.displayName,
      versuche: s.clanwortRunde.versuche,
      geloest: s.clanwortRunde.geloest,
      fertig: s.clanwortRunde.fertig,
    })
    .from(s.clanwortRunde)
    .innerJoin(s.account, eq(s.account.id, s.clanwortRunde.accountId))
    .where(and(eq(s.clanwortRunde.clubId, clubId), eq(s.clanwortRunde.tag, tag)));
  const rangliste = zeilen
    .map((z) => ({ accountId: z.accountId, name: z.name, versuche: z.versuche.length, geloest: z.geloest, fertig: z.fertig }))
    // Geloest vor nicht geloest, wenige Versuche vor vielen.
    .sort((a, b) => Number(b.geloest) - Number(a.geloest) || a.versuche - b.versuche);

  let waehler: ClanwortAnsicht['waehler'] = null;
  if (tagZeile.waehlerId) {
    const [konto] = await db
      .select({ name: s.account.displayName })
      .from(s.account)
      .where(eq(s.account.id, tagZeile.waehlerId));
    if (konto) waehler = { id: tagZeile.waehlerId, name: konto.name };
  }

  const loesung = tagZeile.wort ?? '';
  const fertig = meine?.fertig ?? false;
  const stand = await standVon(db, accountId);
  return {
    ...runde(tag, loesung ? (meine?.versuche ?? []) : [], loesung || 'XXXXX', fertig, meine?.geloest ?? false),
    // Der Wortgeber kennt sein Wort; alle anderen erst nach der Runde.
    loesung: phase === 'wortgeber' || fertig ? tagZeile.wort : null,
    clubId,
    phase,
    waehler,
    wahlBis: WAHL_BIS_STUNDE,
    zufall: tagZeile.zufall,
    rangliste,
    serie: serieHeute(clanSerie(stand), tag),
  };
}

async function clanSerieSchreiben(db: Db, accountId: string, serie: SerienStand): Promise<void> {
  const werte = {
    clanSerie: serie.serie,
    clanBeste: serie.beste,
    clanLetzterTag: serie.letzterTag,
    clanSchutzTag: serie.schutzTag,
  };
  await db
    .insert(s.browortStand)
    .values({ accountId, ...werte })
    .onConflictDoUpdate({ target: s.browortStand.accountId, set: werte });
}

/** Das ausgeloste Mitglied waehlt. Zaehlt fuer seine Clanwort-Serie als Spieltag. */
export async function clanwortWaehlen(db: Db, accountId: string, eingabe: string, jetzt = new Date()): Promise<ClanwortAnsicht> {
  const wort = pruefeWort(eingabe);
  const clubId = await clubVon(db, accountId);
  if (!clubId) throw notFound('notInClub');
  const tag = heute(jetzt);
  const tagZeile = await tagVon(db, clubId, tag, jetzt);
  if (tagZeile.waehlerId !== accountId) throw forbidden('clanwortNichtDran');
  if (tagZeile.wort !== null) throw conflict('clanwortGewaehlt');
  const [gesetzt] = await db
    .update(s.clanwortTag)
    .set({ wort, gewaehltAm: jetzt })
    .where(and(eq(s.clanwortTag.clubId, clubId), eq(s.clanwortTag.tag, tag), isNull(s.clanwortTag.wort)))
    .returning();
  if (!gesetzt) throw conflict('clanwortGewaehlt');
  await clanSerieSchreiben(db, accountId, spielen(clanSerie(await standVon(db, accountId)), tag).stand);
  return (await clanwortHeute(db, accountId, jetzt))!;
}

export async function clanwortRaten(
  db: Db,
  accountId: string,
  eingabe: string,
  jetzt = new Date(),
): Promise<ClanwortAnsicht & { belohnung: Belohnung | null }> {
  const wort = pruefeWort(eingabe);
  const clubId = await clubVon(db, accountId);
  if (!clubId) throw notFound('notInClub');
  const tag = heute(jetzt);
  const tagZeile = await tagVon(db, clubId, tag, jetzt);
  if (tagZeile.wort === null) throw conflict('clanwortNochNicht');
  if (tagZeile.waehlerId === accountId && !tagZeile.zufall) throw forbidden('clanwortEigenes');
  const loesung = tagZeile.wort;

  const [alt] = await db
    .select()
    .from(s.clanwortRunde)
    .where(and(eq(s.clanwortRunde.clubId, clubId), eq(s.clanwortRunde.tag, tag), eq(s.clanwortRunde.accountId, accountId)));
  if (alt?.fertig) throw conflict('browortFertig');
  const versuche = [...(alt?.versuche ?? []), wort];
  const geloest = wort === loesung;
  const fertig = geloest || versuche.length >= MAX_VERSUCHE;

  if (!alt) {
    const neu = await db
      .insert(s.clanwortRunde)
      .values({ clubId, tag, accountId, versuche, geloest, fertig })
      .onConflictDoNothing()
      .returning({ tag: s.clanwortRunde.tag });
    if (neu.length === 0) throw conflict('browortDoppelt');
  } else {
    const geaendert = await db
      .update(s.clanwortRunde)
      .set({ versuche, geloest, fertig })
      .where(
        and(
          eq(s.clanwortRunde.clubId, clubId),
          eq(s.clanwortRunde.tag, tag),
          eq(s.clanwortRunde.accountId, accountId),
          sql`jsonb_array_length(${s.clanwortRunde.versuche}) = ${alt.versuche.length}`,
        ),
      )
      .returning({ tag: s.clanwortRunde.tag });
    if (geaendert.length === 0) throw conflict('browortDoppelt');
  }

  rundeZaehlen('clanwort', !alt, fertig, geloest);

  let belohnung: Belohnung | null = null;
  if (fertig) {
    const vorher = clanSerie(await standVon(db, accountId));
    await clanSerieSchreiben(db, accountId, geloest ? spielen(vorher, tag).stand : verloren(vorher, tag));
    if (geloest) {
      belohnung = { muenzen: MUENZEN_CLANWORT[versuche.length - 1]!, xp: XP_CLANWORT[versuche.length - 1]! };
      await belohnen(db, accountId, belohnung);
    }
  }
  return { ...(await clanwortHeute(db, accountId, jetzt))!, belohnung };
}
