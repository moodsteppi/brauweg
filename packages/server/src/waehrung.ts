/**
 * Die zwei Waehrungen.
 *
 * DIE EINZIGE STELLE, an der ein Guthaben sich aendert. Wer irgendwo sonst
 * `update(account).set({ coins: ... })` schreibt, umgeht die Sperre gegen
 * negative Staende und die Sonderbehandlung der Testkonten — und beides
 * faellt erst auf, wenn jemand mit −40 Muenzen dasteht.
 *
 * **Muenzen** (`coins`) fallen aus Truhen und Tagesaufgaben. Sie sind die
 * Waehrung des Mitspielens: Wer regelmaessig spielt, kommt an alles Bunte.
 *
 * **Edelsteine** (`gems`) entstehen nur aus Kauf oder Geschenk. Sie sind die
 * Waehrung des Ungeduldigen.
 *
 * Getrennt und ohne Wechselkurs, mit Absicht: Gaebe es einen, waere jede
 * Truhe indirekt eine Geldquelle, und der Kurs waere die einzige Zahl, die
 * noch zaehlt. Was mit Edelsteinen zu haben ist, ist mit Muenzen nicht zu
 * haben — und umgekehrt.
 *
 * Bewusst kein Einsatz- und Topfsystem (Plan 11): Verwettete virtuelle
 * Waehrung ist in Deutschland gluecksspielrechtlich eine Grauzone.
 */

import { and, eq, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, conflict, notFound } from './errors.js';
import { entitlementsFor } from './entitlements.js';

export const WAEHRUNGEN = ['coins', 'gems'] as const;
export type Waehrung = (typeof WAEHRUNGEN)[number];

/** Die Spalte zur Waehrung. Eine Stelle, damit kein Zweig sie vergisst. */
const SPALTE = {
  coins: s.account.coins,
  gems: s.account.gems,
} as const;

export interface Stand {
  readonly coins: number;
  readonly gems: number;
}

/**
 * Oberkante eines Guthabens.
 *
 * Nicht aus Sparsamkeit, sondern gegen den Ueberlauf: `integer` in Postgres
 * endet bei 2.147.483.647, und eine Gutschrift, die darueber hinausgeht,
 * bricht die Anweisung ab statt still zu saettigen. Der Wert liegt weit ueber
 * allem, was durch Spielen erreichbar ist, und unter dem Rand.
 */
export const OBERGRENZE = 1_000_000_000;

/**
 * Guthaben eines Kontos, wie die Oberflaeche es zeigen soll.
 *
 * Fuer Testkonten meldet `coinsFor` einen hohen Festwert — deshalb geht das
 * hier ueber `entitlements.ts` und nicht direkt an die Spalte.
 */
export async function standVon(db: Db, accountId: string): Promise<Stand> {
  const [row] = await db
    .select({
      coins: s.account.coins,
      gems: s.account.gems,
      premiumUntil: s.account.premiumUntil,
      isStaff: s.account.isStaff,
    })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!row) throw notFound('accountUnknown');

  return sichtbarerStand(row);
}

/** Dieselbe Rechnung fuer eine bereits geladene Zeile — ohne zweite Abfrage. */
export function sichtbarerStand(row: {
  coins: number;
  gems: number;
  premiumUntil: Date | string | null;
  isStaff: boolean;
}): Stand {
  const rechte = entitlementsFor(row);
  if (rechte.unlimitedCoins) {
    return { coins: STAFF_STAND, gems: STAFF_STAND };
  }
  return { coins: row.coins, gems: row.gems };
}

/**
 * Guthaben eines Testkontos.
 *
 * Eine grosse, aber endliche Zahl — dieselbe Begruendung wie bei
 * `STAFF_COINS` in `entitlements.ts`: `Infinity` wird auf dem Weg durch JSON
 * zu `null` und in jeder Rechnung zu NaN.
 */
export const STAFF_STAND = 9_999_999;

/**
 * Gutschrift. Gibt den neuen Stand zurueck, wie die Oberflaeche ihn zeigt.
 *
 * Der Betrag muss positiv sein: Eine Gutschrift mit negativem Betrag waere
 * eine Abbuchung ohne Deckungspruefung, und genau die soll es nicht geben.
 *
 * Zurueck geht der SICHTBARE Stand und nicht der Spaltenwert — genau wie bei
 * `abbuchen`. Fuer ein Testkonto sind das verschiedene Zahlen, und ein
 * Endpunkt, der nach dem Oeffnen einer Truhe `stand: 2` meldet, waehrend die
 * Kopfzeile 9.999.999 zeigt, widerspricht sich.
 */
export async function gutschreiben(
  db: Db,
  accountId: string,
  waehrung: Waehrung,
  betrag: number,
): Promise<number> {
  const wert = ganzzahlig(betrag);
  if (wert <= 0) throw badRequest('invalidInput');

  const spalte = SPALTE[waehrung];
  const [row] = await db
    .update(s.account)
    // least() statt einer Vorabpruefung: Der Deckel greift in derselben
    // Anweisung, also auch dann, wenn zwei Gutschriften gleichzeitig laufen.
    .set({ [feldname(waehrung)]: sql`least(${spalte} + ${wert}, ${OBERGRENZE})` })
    .where(eq(s.account.id, accountId))
    // Alles in einem Zug zurueck, damit der sichtbare Stand ohne zweite
    // Abfrage zu rechnen ist.
    .returning({
      coins: s.account.coins,
      gems: s.account.gems,
      premiumUntil: s.account.premiumUntil,
      isStaff: s.account.isStaff,
    });

  if (!row) throw notFound('accountUnknown');
  return sichtbarerStand(row)[waehrung];
}

/**
 * Abbuchung. Wirft `coinsInsufficient`, wenn das Guthaben nicht reicht.
 *
 * Die Deckungspruefung steht in der WHERE-Klausel und nicht davor: Ein
 * `select` und danach ein `update` sind zwei Schritte, und zwischen ihnen
 * passt ein zweiter Kauf. So kann der Stand bauartbedingt nie unter Null
 * geraten — trifft die Bedingung nicht zu, aendert die Anweisung keine Zeile.
 *
 * Testkonten zahlen nicht. Ihr Stand soll nicht langsam schrumpfen, sonst
 * waere er nach hundert Kaeufen kein Testkonto mehr.
 */
export async function abbuchen(
  db: Db,
  accountId: string,
  waehrung: Waehrung,
  betrag: number,
): Promise<number> {
  const wert = ganzzahlig(betrag);
  if (wert < 0) throw badRequest('invalidInput');

  const [konto] = await db
    .select({ premiumUntil: s.account.premiumUntil, isStaff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  if (!konto) throw notFound('accountUnknown');

  if (entitlementsFor(konto).unlimitedCoins) return STAFF_STAND;
  // Nichts zu zahlen: Freie Stuecke sollen keine Anweisung ausloesen.
  if (wert === 0) return (await standVon(db, accountId))[waehrung];

  const spalte = SPALTE[waehrung];
  const [row] = await db
    .update(s.account)
    .set({ [feldname(waehrung)]: sql`${spalte} - ${wert}` })
    .where(and(eq(s.account.id, accountId), sql`${spalte} >= ${wert}`))
    .returning({ stand: spalte });

  if (!row) throw conflict(waehrung === 'gems' ? 'gemsInsufficient' : 'coinsInsufficient');
  return row.stand;
}

/**
 * Feldname im Drizzle-Objekt.
 *
 * `set()` erwartet den Namen der Eigenschaft, `where()` die Spalte. Beides
 * steht hier beieinander, damit ein Umbenennen nicht die Haelfte trifft.
 */
function feldname(waehrung: Waehrung): 'coins' | 'gems' {
  return waehrung;
}

function ganzzahlig(betrag: number): number {
  if (!Number.isFinite(betrag)) throw badRequest('invalidInput');
  return Math.trunc(betrag);
}
