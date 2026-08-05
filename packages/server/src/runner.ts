/**
 * Pro-Subway — Solo-Endless-Runner.
 *
 * Kein GameModule (kein Tisch, keine Plaetze), sondern ein Hub-Minispiel.
 * Eingesammelte Runner-Muenzen werden hier in Hub-Muenzen umgewandelt, mit
 * Kappen gegen Client-Tricks: pro Lauf und pro Kalendertag.
 */

import { and, desc, eq, gt, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest } from './errors.js';
import { fortschreibeRunner } from './quests.js';
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

// ---------------------------------------------------------------------------
// Lauf beendet: Muenzen, Aufgaben, Tagesbestwert — ein Aufruf
// ---------------------------------------------------------------------------

/**
 * Obergrenze fuer gemeldete Punkte.
 *
 * Bei Tempo 30 und einer Muenze je Sekunde waeren 100 000 Punkte fast eine
 * Stunde fehlerfreier Lauf. Alles darueber ist kein Rekord, sondern ein
 * Skript — und fliegt raus, bevor es die Tagesliste verstopft. Fuers Geld
 * gilt das nicht: Da kappen Lauf- und Tageslimit ohnehin.
 */
const PUNKTE_OBERGRENZE = 100_000;

export interface RunnerLaufErgebnis extends RunnerCashoutErgebnis {
  /** Platz in der heutigen Tagesliste nach diesem Lauf (1 = bester). */
  rangHeute: number;
}

/**
 * Ein beendeter Lauf, in einem Aufruf: Muenzen gutschreiben (mit den
 * bekannten Kappen), Tagesaufgaben fortschreiben, Tagesbestwert festhalten.
 *
 * Ein Aufruf statt drei, weil der Client am Lebensende des Laufs genau eine
 * Chance hat: Stirbt die Verbindung nach dem ersten von drei Aufrufen, gaebe
 * es Muenzen ohne Aufgabe und Aufgabe ohne Rangliste — und niemand koennte
 * sagen, welcher Zustand nun stimmt.
 *
 * Auch ein Lauf mit 0 Muenzen wird gemeldet: Die Aufgabe "spiel eine Runde
 * Pro-Subway" zaehlt das Laufen, nicht das Sammeln.
 */
export async function runnerLauf(
  db: Db,
  accountId: string,
  lauf: { muenzen: number; punkte: number; meter: number },
  now = new Date(),
): Promise<RunnerLaufErgebnis> {
  const punkte = Math.floor(lauf.punkte);
  const meter = Math.floor(lauf.meter);
  if (!Number.isFinite(punkte) || punkte < 0 || punkte > PUNKTE_OBERGRENZE) {
    throw badRequest('invalidInput');
  }
  if (!Number.isFinite(meter) || meter < 0 || meter > PUNKTE_OBERGRENZE) {
    throw badRequest('invalidInput');
  }

  const cash = await runnerCashout(db, accountId, lauf.muenzen, now);
  await fortschreibeRunner(db, accountId, lauf.muenzen, now);

  const tag = heute(now);
  await db
    .insert(s.runnerBest)
    .values({ accountId, day: tag, punkte, meter, muenzen: Math.floor(lauf.muenzen) })
    .onConflictDoUpdate({
      target: [s.runnerBest.accountId, s.runnerBest.day],
      // Alle drei Spalten zusammen ersetzen, und nur bei mehr Punkten:
      // Meter und Muenzen gehoeren zum besten Lauf. Getrennte greatest()
      // ergaeben einen Lauf, den es nie gab.
      set: {
        punkte: sql`excluded.punkte`,
        meter: sql`excluded.meter`,
        muenzen: sql`excluded.muenzen`,
      },
      setWhere: sql`${s.runnerBest.punkte} < excluded.punkte`,
    });

  return { ...cash, rangHeute: await rangHeute(db, accountId, now) };
}

/** Platz in der heutigen Liste: 1 + Zahl der Konten mit mehr Punkten. */
async function rangHeute(db: Db, accountId: string, now = new Date()): Promise<number> {
  const tag = heute(now);
  const [eigene] = await db
    .select({ punkte: s.runnerBest.punkte })
    .from(s.runnerBest)
    .where(and(eq(s.runnerBest.accountId, accountId), eq(s.runnerBest.day, tag)));
  if (!eigene) return 0;
  const [besser] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.runnerBest)
    .where(and(eq(s.runnerBest.day, tag), gt(s.runnerBest.punkte, eigene.punkte)));
  return 1 + (besser?.n ?? 0);
}

export interface RanglistenEintrag {
  rang: number;
  displayName: string;
  punkte: number;
  meter: number;
  muenzen: number;
  /** Die eigene Zeile — der Client hebt sie hervor. */
  du: boolean;
}

export interface RunnerRangliste {
  eintraege: RanglistenEintrag[];
  /** Eigener Platz, auch wenn er nicht unter den ersten zehn liegt. 0 = heute noch nicht gelaufen. */
  rang: number;
  punkte: number;
}

/** Die heutige Tagesliste: die besten zehn plus der eigene Platz. */
export async function runnerRangliste(
  db: Db,
  accountId: string,
  now = new Date(),
): Promise<RunnerRangliste> {
  const tag = heute(now);
  const zeilen = await db
    .select({
      accountId: s.runnerBest.accountId,
      displayName: s.account.displayName,
      punkte: s.runnerBest.punkte,
      meter: s.runnerBest.meter,
      muenzen: s.runnerBest.muenzen,
    })
    .from(s.runnerBest)
    .innerJoin(s.account, eq(s.account.id, s.runnerBest.accountId))
    .where(eq(s.runnerBest.day, tag))
    .orderBy(desc(s.runnerBest.punkte), s.account.displayName)
    .limit(10);

  const eintraege = zeilen.map((z, i) => ({
    rang: i + 1,
    displayName: z.displayName,
    punkte: z.punkte,
    meter: z.meter,
    muenzen: z.muenzen,
    du: z.accountId === accountId,
  }));

  const rang = await rangHeute(db, accountId, now);
  const eigene = eintraege.find((e) => e.du);
  const [eigeneZeile] = eigene
    ? [eigene]
    : await db
        .select({ punkte: s.runnerBest.punkte })
        .from(s.runnerBest)
        .where(and(eq(s.runnerBest.accountId, accountId), eq(s.runnerBest.day, tag)));

  return { eintraege, rang, punkte: eigeneZeile?.punkte ?? 0 };
}
