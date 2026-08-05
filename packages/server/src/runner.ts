/**
 * Pro-Subway — Solo-Endless-Runner.
 *
 * Kein GameModule (kein Tisch, keine Plaetze), sondern ein Hub-Minispiel.
 * Eingesammelte Runner-Muenzen werden hier in Hub-Muenzen umgewandelt, mit
 * Kappen gegen Client-Tricks: pro Lauf und pro Kalendertag.
 */

import { and, eq, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest } from './errors.js';
import { heute } from './truhen.js';
import { gutschreiben, standVon } from './waehrung.js';

/** Eine Runner-Muenze → eine Hub-Muenze. */
export const RUNNER_MUENZE_WERT = 1;
/** Max. Hub-Muenzen, die ein einzelner Cashout gutschreiben darf. */
export const RUNNER_MAX_PRO_LAUF = 20;
/** Max. Hub-Muenzen aus dem Runner pro Kalendertag (Berlin). */
export const RUNNER_MAX_PRO_TAG = 40;

export type RunnerCashoutErgebnis = {
  /** Tatsaechlich gutgeschrieben (nach Kappen). */
  gutgeschrieben: number;
  /** Sichtbarer Muenzstand danach. */
  stand: number;
  /** Wie viele Hub-Muenzen heute noch aus dem Runner kommen koennen. */
  restHeute: number;
  /** Tageslimit. */
  limitTag: number;
};

/**
 * Ergebnis eines Laufs gutschreiben.
 *
 * `runnerCoins` = Anzahl eingesammelter Muenzen im Lauf (nicht der Score×10).
 * Der Client darf luegen — die Kappen halten den Schaden klein.
 */
export async function runnerCashout(
  db: Db,
  accountId: string,
  runnerCoins: number,
  now = new Date(),
): Promise<RunnerCashoutErgebnis> {
  if (!Number.isFinite(runnerCoins) || runnerCoins < 0) {
    throw badRequest('invalidInput');
  }

  const roh = Math.floor(runnerCoins) * RUNNER_MUENZE_WERT;
  const angefragt = Math.min(roh, RUNNER_MAX_PRO_LAUF);
  const tag = heute(now);

  const [row] = await db
    .select({ coins: s.runnerDay.coins })
    .from(s.runnerDay)
    .where(and(eq(s.runnerDay.accountId, accountId), eq(s.runnerDay.day, tag)));

  const schon = row?.coins ?? 0;
  const frei = Math.max(0, RUNNER_MAX_PRO_TAG - schon);
  const geben = Math.min(angefragt, frei);

  if (geben <= 0) {
    const stand = (await standVon(db, accountId)).coins;
    return {
      gutgeschrieben: 0,
      stand,
      restHeute: frei,
      limitTag: RUNNER_MAX_PRO_TAG,
    };
  }

  await db
    .insert(s.runnerDay)
    .values({ accountId, day: tag, coins: geben })
    .onConflictDoUpdate({
      target: [s.runnerDay.accountId, s.runnerDay.day],
      set: { coins: sql`${s.runnerDay.coins} + ${geben}` },
    });

  const stand = await gutschreiben(db, accountId, 'coins', geben);
  return {
    gutgeschrieben: geben,
    stand,
    restHeute: Math.max(0, frei - geben),
    limitTag: RUNNER_MAX_PRO_TAG,
  };
}

export async function runnerTagesstand(
  db: Db,
  accountId: string,
  now = new Date(),
): Promise<{ verdient: number; restHeute: number; limitTag: number }> {
  const tag = heute(now);
  const [row] = await db
    .select({ coins: s.runnerDay.coins })
    .from(s.runnerDay)
    .where(and(eq(s.runnerDay.accountId, accountId), eq(s.runnerDay.day, tag)));
  const verdient = row?.coins ?? 0;
  return {
    verdient,
    restHeute: Math.max(0, RUNNER_MAX_PRO_TAG - verdient),
    limitTag: RUNNER_MAX_PRO_TAG,
  };
}
