/**
 * „Zuletzt gespielt" (Startseiten-Umbau, 28.11.2026): je Konto und Spiel der
 * letzte Zeitpunkt. Gezeigt wird es im Spiele-Tab unter „Deine Spiele".
 *
 * Zwei Quellen schreiben hierher:
 *   - Tischspiele traegt der Server selbst ein — beim Hinsetzen
 *     (`createTable`, `joinTable` in tables/service.ts; darueber laufen
 *     Lobby, Code, Anfrage, Suche und Uebungsrunde) und beim Partiestart
 *     (runtime/party.ts), damit der Zeitpunkt der Partie gilt und nicht der
 *     des Wartens.
 *   - Solo-Spiele und Arenen haben keinen Tisch; ihre Bildschirme melden sich
 *     beim Oeffnen selbst (`POST /api/zuletzt/:spiel`, http/schnellspiel-routen.ts).
 *
 * Diese Datei kennt nur die Datenbank, kein Spiel und keine Route — sonst
 * importierte `tables/service.ts` ueber sie die halbe Quick-Play-Schicht.
 */

import { and, desc, eq, inArray } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';

/** Wie viele Spiele „zuletzt gespielt" hoechstens nennt (Plan, Abschnitt 5). */
export const ZULETZT_MAX = 8;

/**
 * Ein Spiel fuer diese Konten als gerade gespielt eintragen.
 *
 * Hausspieler (src/hausrunden.ts) fallen heraus: Sie haben ein Konto, sitzen
 * aber als Bot am Tisch, und `erstelleHaustisch` legt ihre Tische ueber
 * dasselbe `createTable` an wie ein Mensch. Gaeste zaehlen mit — ihr
 * Spiele-Tab soll genauso aussehen.
 *
 * Wirft nie. „Zuletzt gespielt" ist eine Anzeige; scheitert sie, darf das
 * weder den Beitritt noch den Partiestart kosten. Gemeldet wird trotzdem,
 * sonst faellt eine kaputte Tabelle nie auf.
 */
export async function zuletztEintragen(
  db: Db,
  accountIds: readonly (string | null)[],
  spiel: string,
): Promise<void> {
  const konten = [...new Set(accountIds.filter((id): id is string => id !== null))];
  if (konten.length === 0) return;
  try {
    const menschen = await db
      .select({ id: s.account.id })
      .from(s.account)
      .where(and(inArray(s.account.id, konten), eq(s.account.hausspieler, false)));
    if (menschen.length === 0) return;
    const am = new Date();
    await db
      .insert(s.zuletztGespielt)
      .values(menschen.map((m) => ({ accountId: m.id, spiel, am })))
      .onConflictDoUpdate({
        target: [s.zuletztGespielt.accountId, s.zuletztGespielt.spiel],
        set: { am },
      });
  } catch (fehler) {
    // eslint-disable-next-line no-console
    console.error(`zuletzt gespielt (${spiel}) nicht eingetragen:`, fehler);
  }
}

/**
 * Die zuletzt gespielten Spiele, neueste zuerst. `sichtbar` filtert, was
 * diese Ausgabe nicht anbietet (Umfang) — VOR der Grenze, damit ein
 * ausgeblendetes Spiel keinen der acht Plaetze belegt.
 */
export async function zuletztFuer(
  db: Db,
  accountId: string,
  sichtbar: (spiel: string) => boolean = () => true,
): Promise<{ spiel: string; am: string }[]> {
  const zeilen = await db
    .select({ spiel: s.zuletztGespielt.spiel, am: s.zuletztGespielt.am })
    .from(s.zuletztGespielt)
    .where(eq(s.zuletztGespielt.accountId, accountId))
    .orderBy(desc(s.zuletztGespielt.am), s.zuletztGespielt.spiel);
  return zeilen
    .filter((z) => sichtbar(z.spiel))
    .slice(0, ZULETZT_MAX)
    .map((z) => ({ spiel: z.spiel, am: z.am.toISOString() }));
}
