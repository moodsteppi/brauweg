/**
 * BroJetons am Tisch.
 *
 * Das Spielmodul kennt nur Zahlen (Startstapel, Blinds). Hier wird daraus
 * ein Beutel: Beim Start geht der Buy-in vom Konto, am Ende kommt der
 * Reststapel zurueck. Bots haben kein Konto — ihre Chips entstehen und
 * vergehen mit der Partie.
 *
 * Die Abbuchung haengt am Tisch (`chip_lock`), nicht an der Partie: So ist
 * ein zweiter Startversuch idempotent, und ein zweites Auszahlen trifft
 * keine offene Zeile mehr.
 */

import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, conflict } from './errors.js';
import { entitlementsFor } from './entitlements.js';
import { abbuchen, gutschreiben, standVon } from './waehrung.js';

export function einsatzVon(config: unknown, feld: string): number {
  if (typeof config !== 'object' || config === null) throw badRequest('invalidInput');
  const wert = (config as Record<string, unknown>)[feld];
  if (typeof wert !== 'number' || !Number.isInteger(wert) || wert < 1) {
    throw badRequest('invalidInput');
  }
  return wert;
}

/**
 * Blinds und Buy-in, soweit der Regelsatz sie traegt.
 *
 * Nur anzeigen: Die Lobby zeigt die Zahlen, ohne das Spiel zu kennen. Fehlen
 * die Felder, ist es kein Chip-Tisch.
 */
export function stakesVon(config: unknown): {
  startJetons: number;
  kleinerBlind: number;
  grosserBlind: number;
} | null {
  if (typeof config !== 'object' || config === null) return null;
  const gegeben = config as Record<string, unknown>;
  const { startJetons, kleinerBlind, grosserBlind } = gegeben;
  if (
    typeof startJetons !== 'number' ||
    typeof kleinerBlind !== 'number' ||
    typeof grosserBlind !== 'number'
  ) {
    return null;
  }
  return { startJetons, kleinerBlind, grosserBlind };
}

/** Wirft `broJetonsInsufficient`, wenn der Stapel nicht fuer den Buy-in reicht. */
export async function verlangen(db: Db, accountId: string, buyIn: number): Promise<void> {
  const stand = await standVon(db, accountId);
  if (stand.broJetons < buyIn) throw conflict('broJetonsInsufficient');
}

export async function zieheEinsatz(
  db: Db,
  tableId: string,
  sitze: readonly { readonly accountId: string; readonly seat: number }[],
  buyIn: number,
): Promise<void> {
  const vorhanden = await db
    .select({ accountId: s.chipLock.accountId })
    .from(s.chipLock)
    .where(eq(s.chipLock.tableId, tableId));
  if (vorhanden.length > 0) return;

  const gezogen: { accountId: string; staff: boolean }[] = [];
  try {
    for (const sitz of sitze) {
      const [konto] = await db
        .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
        .from(s.account)
        .where(eq(s.account.id, sitz.accountId));
      const staff = konto ? entitlementsFor(konto).unlimitedCoins : false;
      await abbuchen(db, sitz.accountId, 'broJetons', buyIn);
      await db.insert(s.chipLock).values({
        tableId,
        accountId: sitz.accountId,
        seat: sitz.seat,
        buyIn,
      });
      gezogen.push({ accountId: sitz.accountId, staff });
    }
  } catch (fehler) {
    for (const eintrag of gezogen) {
      if (!eintrag.staff) {
        await gutschreiben(db, eintrag.accountId, 'broJetons', buyIn).catch(() => undefined);
      }
      await db
        .delete(s.chipLock)
        .where(
          and(eq(s.chipLock.tableId, tableId), eq(s.chipLock.accountId, eintrag.accountId)),
        );
    }
    throw fehler;
  }
}

/**
 * Reststapel zurueck auf die Konten. `rest` ist, was am Sitz noch liegt
 * (Platzierungspunkte beim Poker = Jetons). Fehlt ein Sitz, geht der
 * originale Buy-in zurueck — lieber den Einsatz erstatten als ihn
 * verschwinden lassen.
 */
export async function zahleAus(
  db: Db,
  tableId: string,
  restJeKonto: Readonly<Record<string, number>>,
): Promise<void> {
  const schloesser = await db
    .select()
    .from(s.chipLock)
    .where(and(eq(s.chipLock.tableId, tableId), isNull(s.chipLock.settledAt)));

  for (const schloss of schloesser) {
    const restRoh = restJeKonto[schloss.accountId];
    const rest =
      typeof restRoh === 'number' && Number.isFinite(restRoh)
        ? Math.max(0, Math.trunc(restRoh))
        : schloss.buyIn;

    const [markiert] = await db
      .update(s.chipLock)
      .set({ returned: rest, settledAt: new Date() })
      .where(
        and(
          eq(s.chipLock.tableId, tableId),
          eq(s.chipLock.accountId, schloss.accountId),
          isNull(s.chipLock.settledAt),
        ),
      )
      .returning({ accountId: s.chipLock.accountId });
    if (!markiert) continue;
    if (rest > 0) await gutschreiben(db, schloss.accountId, 'broJetons', rest);
  }
}
