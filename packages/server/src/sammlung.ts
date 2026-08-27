/**
 * Mememory: Sammlung und Emote-Gurt.
 *
 * Wer ein Motiv im Spiel einmal aufgedeckt hat, hat es gesammelt. Aus der
 * Sammlung waehlt man bis zu drei Stueck; die fliegen im Spiel als Reaktion
 * ueber den Tisch — an der Stelle, an der vorher die Emojis sassen.
 *
 * **Gemeldet wird vom Client, und das ist Absicht.** Wer eine Karte
 * aufdeckt, weiss es dort; der Server muesste sonst in den Spielzustand
 * sehen, und das ist genau die Grenze, die diese Plattform nicht
 * ueberschreitet (der Server kennt kein einzelnes Spiel). Der Preis ist
 * bekannt: Mit der Entwicklerkonsole laesst sich eine Sammlung
 * zusammenluegen. Sie ist Schmuck — kein Preis, kein Handel, kein Vorteil
 * im Spiel —, und wer sich selbst Bilder in eine Liste schreibt, betruegt
 * niemanden ausser sich.
 *
 * **Geprueft wird die Form, nicht die Existenz.** Die 88 Grundmotive stehen
 * in keiner Tabelle; sie liegen als Dateien im Client. Eine
 * Existenzpruefung wuerde also die Haelfte des Sammelbaren ausschliessen.
 * Eine erfundene Kennung kostet den, der sie schickt, ein leeres Feld in
 * der eigenen Sammlung.
 */

import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest } from './errors.js';

/** Form einer Motivkennung. Muss zu KENNUNG_MUSTER in memes.ts passen. */
export const KENNUNG_MUSTER = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * So viele Motive fasst eine Sammlung.
 *
 * Grosszuegig ueber dem, was es gibt (88 Grundmotive plus die hochgeladenen),
 * aber nicht unbegrenzt: Ohne Deckel schriebe ein Skript in einer Minute
 * Zehntausende Zeilen, die niemand je ansieht.
 */
export const SAMMLUNG_MAX = 2000;

/** So viele Meldungen nimmt ein Aufruf entgegen. Ein Brett hat 24 Karten. */
export const MELDUNG_MAX = 40;

/** So viele Motive passen in den Gurt. Drei Knoepfe, drei Bilder. */
export const GURT_MAX = 3;

export interface SammlungsZeile {
  readonly kennung: string;
  /** 1..3 = im Gurt, sonst null. */
  readonly platz: number | null;
  /**
   * Haelt dieses Fach beim Zufallsgurt fest.
   *
   * Ohne `platz` bedeutungslos — gesperrt wird ein FACH, und ein Fach gibt
   * es nur, wo ein Platz vergeben ist.
   */
  readonly gesperrt: boolean;
}

/**
 * Aufgedeckte Motive gutschreiben.
 *
 * Ist eine Kennung schon dabei, passiert nichts — das ist der Normalfall,
 * denn dasselbe Motiv taucht in vielen Partien auf. Zurueck kommt, wie viele
 * WIRKLICH neu waren: Nur dafuer lohnt es sich, im Client etwas anzuzeigen.
 */
export async function merkeGesehen(
  db: Db,
  accountId: string,
  kennungen: readonly string[],
): Promise<{ neu: number; gesamt: number }> {
  const sauber = [...new Set(kennungen)].filter((k) => KENNUNG_MUSTER.test(k));
  if (sauber.length === 0) return { neu: 0, gesamt: await anzahl(db, accountId) };

  const bisher = await anzahl(db, accountId);
  if (bisher >= SAMMLUNG_MAX) return { neu: 0, gesamt: bisher };

  const eingefuegt = await db
    .insert(s.mememorySammlung)
    .values(sauber.slice(0, SAMMLUNG_MAX - bisher).map((kennung) => ({ accountId, kennung })))
    .onConflictDoNothing()
    .returning({ kennung: s.mememorySammlung.kennung });

  return { neu: eingefuegt.length, gesamt: bisher + eingefuegt.length };
}

async function anzahl(db: Db, accountId: string): Promise<number> {
  const [zeile] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.mememorySammlung)
    .where(eq(s.mememorySammlung.accountId, accountId));
  return zeile?.anzahl ?? 0;
}

/** Die ganze Sammlung, aelteste zuerst — so bleibt die Reihenfolge stabil. */
export async function sammlungVon(db: Db, accountId: string): Promise<SammlungsZeile[]> {
  return db
    .select({
      kennung: s.mememorySammlung.kennung,
      platz: s.mememorySammlung.platz,
      gesperrt: s.mememorySammlung.gesperrt,
    })
    .from(s.mememorySammlung)
    .where(eq(s.mememorySammlung.accountId, accountId))
    .orderBy(asc(s.mememorySammlung.createdAt), asc(s.mememorySammlung.kennung));
}

/** Nur der Gurt, in der Reihenfolge der Plaetze. Fuer den Tisch. */
export async function gurtVon(db: Db, accountId: string): Promise<string[]> {
  const zeilen = await db
    .select({ kennung: s.mememorySammlung.kennung, platz: s.mememorySammlung.platz })
    .from(s.mememorySammlung)
    .where(and(eq(s.mememorySammlung.accountId, accountId), isNotNull(s.mememorySammlung.platz)))
    .orderBy(asc(s.mememorySammlung.platz));
  return zeilen.map((zeile) => zeile.kennung);
}

/**
 * Den Gurt neu belegen.
 *
 * Die Liste ist die ganze Wahrheit: Was nicht darin steht, verliert seinen
 * Platz. Erst alles raeumen, dann setzen — sonst stolpert die zweite
 * Zuweisung ueber den Teilindex, wenn zwei Motive die Plaetze tauschen.
 *
 * Gewaehlt werden kann nur, was auch gesammelt ist. Das ist die eine Stelle,
 * an der die Sammlung wirklich etwas bedeutet, und deshalb wird sie hier
 * geprueft und nicht im Client.
 */
export async function setzeGurt(
  db: Db,
  accountId: string,
  kennungen: readonly string[],
  /**
   * Welche Faecher der Zufallsgurt in Ruhe laesst — Stellung fuer Stellung
   * zur Kennungsliste.
   *
   * Kuerzer oder ganz weg heisst "nicht gesperrt": Ein Client, der den
   * Zufallsmodus gar nicht kennt, schickt sie nicht mit und soll trotzdem
   * seinen Gurt setzen koennen.
   */
  gesperrt: readonly boolean[] = [],
): Promise<string[]> {
  const gewaehlt = [...new Set(kennungen)].filter((k) => KENNUNG_MUSTER.test(k));
  if (gewaehlt.length > GURT_MAX) throw badRequest('gurtZuVoll');

  if (gewaehlt.length > 0) {
    const vorhanden = await db
      .select({ kennung: s.mememorySammlung.kennung })
      .from(s.mememorySammlung)
      .where(
        and(
          eq(s.mememorySammlung.accountId, accountId),
          inArray(s.mememorySammlung.kennung, [...gewaehlt]),
        ),
      );
    if (vorhanden.length !== gewaehlt.length) throw badRequest('nichtGesammelt');
  }

  // Auch das Schloss faellt beim Raeumen: Es haengt am Fach, und das Fach
  // wird gerade neu vergeben.
  await db
    .update(s.mememorySammlung)
    .set({ platz: null, gesperrt: false })
    .where(and(eq(s.mememorySammlung.accountId, accountId), isNotNull(s.mememorySammlung.platz)));

  for (const [i, kennung] of gewaehlt.entries()) {
    await db
      .update(s.mememorySammlung)
      .set({ platz: i + 1, gesperrt: gesperrt[i] === true })
      .where(
        and(eq(s.mememorySammlung.accountId, accountId), eq(s.mememorySammlung.kennung, kennung)),
      );
  }

  return [...gewaehlt];
}

/**
 * Steht der Zufallsgurt dieses Kontos auf an?
 *
 * Er gehoert ans Konto und nicht ans Geraet, anders als die Lautstaerke: Er
 * gehoert zur Sammlung, und wer seine Bilder rollen laesst, will das auf
 * jedem Geraet.
 */
export async function zufallVon(db: Db, accountId: string): Promise<boolean> {
  const [zeile] = await db
    .select({ an: s.account.mememoryZufall })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  return zeile?.an ?? false;
}

/** Den Zufallsgurt ein- oder ausschalten. */
export async function setzeZufall(db: Db, accountId: string, an: boolean): Promise<void> {
  await db
    .update(s.account)
    .set({ mememoryZufall: an })
    .where(eq(s.account.id, accountId));
}
