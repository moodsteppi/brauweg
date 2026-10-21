/**
 * Herkunft je Werbelink: `?q=<kennung>` (Werbetest, 19.10.2026).
 *
 * Eine Anzeige verlinkt auf `https://brauweg-spielen.de/?q=tiktok-1`. Der
 * Client liest die Kennung beim ersten Aufruf, meldet den Besuch und haelt
 * die Kennung im Arbeitsspeicher, bis jemand ein Gastkonto anlegt
 * (client/src/herkunft.ts). Ab dort haengt sie am Konto
 * (`account.herkunft`), und jede Runde, die dieses Konto an einem Tisch zu
 * Ende spielt, zaehlt fuer sie.
 *
 * **Gezaehlt wird nur, nie protokolliert.** Es gibt keine Zeile je Besuch,
 * keine Adresse, keinen Geraetekennzeichner — nur Summen je Kennung und Tag
 * (`herkunft_zaehler`). Der Client legt dafuer nichts im Browser ab, weder
 * Cookie noch Speicher; deshalb braucht es kein Einwilligungsbanner und
 * keinen fremden Dienst. Der Preis: Wer die Seite neu laedt, bevor er ein
 * Gastkonto anlegt, ist ab da nicht mehr zuzuordnen. Das ist gewollt — ein
 * zweiter Weg wuerde genau das Merken einfuehren, das hier wegfallen soll.
 *
 * **Die Summen wachsen nur.** Sie stehen nicht am Konto, sondern daneben:
 * Ein geloeschtes oder gesichertes Gastkonto nimmt seine schon gezaehlten
 * Runden nicht mit. Gelesen werden sie ausschliesslich ueber den Schluessel
 * `HERKUNFT_SCHLUESSEL` (`GET /api/herkunft/auswertung`), vom bro-server.
 */

import { and, asc, count, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { heute } from './truhen.js';

/**
 * Was als Kennung durchgeht: Kleinbuchstaben, Ziffern, Binde- und
 * Unterstrich, hoechstens 40 Zeichen. Bewusst eng — die Kennung landet als
 * Schluessel in der Datenbank und in der Auswertung, und wer dort beliebigen
 * Text unterbringen kann, schreibt uns die Tabelle voll.
 */
const KENNUNG = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/**
 * Hoechstens so viele verschiedene Kennungen je Tag. Ein Werbetest hat eine
 * Handvoll; mehr ist jemand, der Adressen durchprobiert. Was darueber
 * hinausgeht, wird still verworfen — schon bekannte Kennungen zaehlen weiter.
 */
export const KENNUNGEN_JE_TAG = 200;

/** Gross geschrieben in der Anzeige ist dieselbe Kennung: `TikTok-1` = `tiktok-1`. */
export function normalisiereKennung(roh: unknown): string | null {
  if (typeof roh !== 'string') return null;
  const kennung = roh.trim().toLowerCase();
  return KENNUNG.test(kennung) ? kennung : null;
}

type Spalte = 'besuche' | 'gastkonten' | 'runden' | 'partien';

async function zaehle(
  db: Db,
  kennung: string,
  spalte: Spalte,
  anzahl: number,
  jetzt: Date,
): Promise<void> {
  if (anzahl <= 0) return;
  const tag = heute(jetzt);
  const z = s.herkunftZaehler;
  await db
    .insert(z)
    .values({ kennung, tag, [spalte]: anzahl })
    .onConflictDoUpdate({
      target: [z.kennung, z.tag],
      set: { [spalte]: sql`${z[spalte]} + ${anzahl}` },
    });
}

/**
 * Ein Aufruf mit `?q=`. Gibt zurueck, ob gezaehlt wurde — nach aussen meldet
 * die Route trotzdem immer Erfolg: Der Client soll nicht erfahren, wann die
 * Tagesgrenze erreicht ist.
 */
export async function besuchZaehlen(db: Db, roh: unknown, jetzt = new Date()): Promise<boolean> {
  const kennung = normalisiereKennung(roh);
  if (!kennung) return false;

  const tag = heute(jetzt);
  const z = s.herkunftZaehler;
  const [bekannt] = await db
    .select({ kennung: z.kennung })
    .from(z)
    .where(and(eq(z.kennung, kennung), eq(z.tag, tag)));
  if (!bekannt) {
    const [heutige] = await db.select({ n: count() }).from(z).where(eq(z.tag, tag));
    if ((heutige?.n ?? 0) >= KENNUNGEN_JE_TAG) return false;
  }

  await zaehle(db, kennung, 'besuche', 1, jetzt);
  return true;
}

/**
 * Ein Gastkonto ist mit einer Kennung entstanden: am Konto vermerken und
 * zaehlen. Eine ungueltige Kennung ist kein Fehler — das Konto entsteht
 * trotzdem, nur ohne Herkunft. Ein Werbelink darf niemanden aussperren.
 */
export async function gastkontoZaehlen(
  db: Db,
  accountId: string,
  roh: unknown,
  jetzt = new Date(),
): Promise<void> {
  const kennung = normalisiereKennung(roh);
  if (!kennung) return;
  await db.update(s.account).set({ herkunft: kennung }).where(eq(s.account.id, accountId));
  await zaehle(db, kennung, 'gastkonten', 1, jetzt);
}

/**
 * Runden oder Partien fuer die Konten an einem Tisch. Gezaehlt wird JE KONTO:
 * Spielen zwei Gaeste derselben Kennung eine Runde zusammen, sind das zwei
 * Runden fuer die Kennung — gemessen wird, wie viel die Geworbenen spielen,
 * nicht wie viele Tische es gab.
 */
export async function spielZaehlen(
  db: Db,
  accountIds: readonly string[],
  art: 'runden' | 'partien',
  anzahl: number,
  jetzt = new Date(),
): Promise<void> {
  if (accountIds.length === 0 || anzahl <= 0) return;
  const konten = await db
    .select({ herkunft: s.account.herkunft })
    .from(s.account)
    .where(and(inArray(s.account.id, [...accountIds]), isNotNull(s.account.herkunft)));

  const je = new Map<string, number>();
  for (const { herkunft } of konten) {
    if (herkunft) je.set(herkunft, (je.get(herkunft) ?? 0) + 1);
  }
  for (const [kennung, konto] of je) {
    await zaehle(db, kennung, art, konto * anzahl, jetzt);
  }
}

export interface HerkunftTag {
  readonly tag: string;
  readonly besuche: number;
  readonly gastkonten: number;
  readonly runden: number;
  readonly partien: number;
}

export interface HerkunftSumme extends Omit<HerkunftTag, 'tag'> {
  readonly kennung: string;
  readonly tage: readonly HerkunftTag[];
}

/**
 * Summen je Kennung, auf Wunsch auf einen Zeitraum (Kalendertage in Berlin,
 * beide Grenzen eingeschlossen) und eine Kennung beschraenkt.
 */
export async function auswertung(
  db: Db,
  filter: { readonly von?: string; readonly bis?: string; readonly kennung?: string } = {},
): Promise<HerkunftSumme[]> {
  const z = s.herkunftZaehler;
  const bedingungen = [
    filter.von ? gte(z.tag, filter.von) : undefined,
    filter.bis ? lte(z.tag, filter.bis) : undefined,
    filter.kennung ? eq(z.kennung, filter.kennung) : undefined,
  ].filter((b) => b !== undefined);

  const zeilen = await db
    .select()
    .from(z)
    .where(bedingungen.length > 0 ? and(...bedingungen) : undefined)
    .orderBy(asc(z.kennung), asc(z.tag));

  const summen = new Map<string, HerkunftSumme & { tage: HerkunftTag[] }>();
  for (const zeile of zeilen) {
    let summe = summen.get(zeile.kennung);
    if (!summe) {
      summe = { kennung: zeile.kennung, besuche: 0, gastkonten: 0, runden: 0, partien: 0, tage: [] };
      summen.set(zeile.kennung, summe);
    }
    summe.tage.push({
      tag: zeile.tag,
      besuche: zeile.besuche,
      gastkonten: zeile.gastkonten,
      runden: zeile.runden,
      partien: zeile.partien,
    });
  }
  return [...summen.values()].map((summe) => ({
    ...summe,
    besuche: summe.tage.reduce((n, t) => n + t.besuche, 0),
    gastkonten: summe.tage.reduce((n, t) => n + t.gastkonten, 0),
    runden: summe.tage.reduce((n, t) => n + t.runden, 0),
    partien: summe.tage.reduce((n, t) => n + t.partien, 0),
  }));
}
