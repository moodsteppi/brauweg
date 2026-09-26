/**
 * Trophaeenweg: Belohnungen anzeigen und abholen.
 *
 * Was es wo gibt, steht in `trophaeenweg-katalog.ts`; hier steht, wie es
 * abgeholt wird. Die Regeln (Robin, 26.09.2026):
 *
 *  - **Freigeschaltet, sobald die aktuelle Summe die Schwelle erreicht.**
 *    Gezaehlt wird die Summe der Trophaeen ueber alle Spiele, genau wie der
 *    Kopf des Hubs sie zeigt. Faellt die Summe wieder (Verlassen-Strafe), ist
 *    eine noch nicht geholte Stufe wieder zu — geholt ist aber geholt.
 *  - **Abholen von Hand**, wie bei Truhen und Tagesaufgaben (Begruendung in
 *    `quests.ts`: Belohnungen, die unbemerkt eintreffen, hat niemand).
 *  - **Truhen enthalten nur Muenzen** und werden genau einmal gewuerfelt
 *    (`truhen.ts`). Das Ergebnis steht in `weg_abholung`.
 *  - **Gegenstaende** landen in `account_cosmetic`, wie ein Kauf es taete,
 *    nur ohne Abbuchung. Wer ihn schon hat, behaelt ihn einfach — kein Fehler,
 *    keine zweite Zeile, und die Truhe gibt es trotzdem.
 *
 * **Gaeste** werden wie bei Truhen und Aufgaben nicht gesondert behandelt:
 * Ein Gastkonto ist ein Konto, und was es holt, bleibt beim Sichern erhalten
 * (dieselbe Zeile). Trophaeen sammelt ein Gast ohnehin kaum — ein Tisch mit
 * Gast zaehlt fuer niemanden (`countsForRanking`).
 */

import { and, eq, lte, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { conflict, notFound } from './errors.js';
import { SPANNE, wuerfeln, type Grad, type Spanne } from './truhen.js';
import { gutschreiben } from './waehrung.js';
import {
  wegSichtbarBis,
  wegStufe,
  wegStufenBis,
  type WegArt,
} from './trophaeenweg-katalog.js';

export interface WegStufeAnsicht {
  readonly schwelle: number;
  readonly art: WegArt;
  /** Die Truhe mit ihrer Spanne — angezeigt, damit nichts geraten wird. */
  readonly truhe: (Spanne & { readonly grad: Grad }) | null;
  /** Feste Muenzen (Checkpoint), sonst null. */
  readonly muenzen: number | null;
  /** Kennung des Gegenstands (Station), sonst null. */
  readonly gegenstand: string | null;
  /** Die aktuelle Summe hat die Schwelle erreicht. */
  readonly erreicht: boolean;
  readonly geholt: boolean;
  /** Was gutgeschrieben wurde — erst gesetzt, wenn geholt. */
  readonly coins: number | null;
}

export interface WegAnsicht {
  /** Summe der Trophaeen ueber alle Spiele. */
  readonly trophaeen: number;
  readonly stufen: readonly WegStufeAnsicht[];
  /** Wie viele Stufen jetzt abgeholt werden koennen. */
  readonly bereit: number;
}

/** Summe der Trophaeen ueber alle Spiele — dieselbe Zahl wie im Kopf des Hubs. */
export async function trophaeenSumme(db: Db, accountId: string): Promise<number> {
  const [zeile] = await db
    .select({ summe: sql<number>`coalesce(sum(${s.accountGameStat.trophies}), 0)::int` })
    .from(s.accountGameStat)
    .where(eq(s.accountGameStat.accountId, accountId));
  return zeile?.summe ?? 0;
}

/**
 * Der ganze Weg eines Kontos: alle Stufen bis zur naechsten ueber 1000, mit
 * Zustand. Auch die gesperrten — wer nicht sieht, was bei 500 wartet, hat
 * keinen Grund, dorthin zu wollen (dieselbe Begruendung wie bei `truhenFuer`).
 */
export async function wegFuer(db: Db, accountId: string): Promise<WegAnsicht> {
  const summe = await trophaeenSumme(db, accountId);
  const geholt = await db
    .select({ schwelle: s.wegAbholung.schwelle, coins: s.wegAbholung.coins })
    .from(s.wegAbholung)
    .where(eq(s.wegAbholung.accountId, accountId));
  const coinsBei = new Map(geholt.map((zeile) => [zeile.schwelle, zeile.coins]));

  // Geholtes jenseits der sichtbaren Grenze bleibt sichtbar: Wer bei 2000 war,
  // abgeholt hat und durch Strafen auf 1400 fiel, soll die 1750 als geholt
  // sehen und nicht als verschwunden.
  const hoechsteGeholte = Math.max(0, ...coinsBei.keys());
  const stufen = wegStufenBis(Math.max(wegSichtbarBis(summe), hoechsteGeholte)).map((stufe) => {
    const istGeholt = coinsBei.has(stufe.schwelle);
    return {
      schwelle: stufe.schwelle,
      art: stufe.art,
      truhe: stufe.truhe ? { grad: stufe.truhe, ...SPANNE[stufe.truhe] } : null,
      muenzen: stufe.muenzen,
      gegenstand: stufe.gegenstand,
      erreicht: summe >= stufe.schwelle,
      geholt: istGeholt,
      coins: coinsBei.get(stufe.schwelle) ?? null,
    };
  });

  return {
    trophaeen: summe,
    stufen,
    bereit: stufen.filter((stufe) => stufe.erreicht && !stufe.geholt).length,
  };
}

/**
 * Wie viele Stufen abholbereit sind — nur die Zahl, fuer `/api/me`.
 *
 * Wie `offeneTruhen`: Die Summe kommt als Parameter, weil `/api/me` die
 * Statistik schon geladen hat, und gezaehlt wird in SQL statt die Zeilen zu
 * holen. Nur Zeilen bis zur aktuellen Summe zaehlen: Eine geholte Stufe ueber
 * der Summe (nach einem Absturz) ist keine, die hier abgezogen werden darf.
 */
export async function offeneWegBelohnungen(
  db: Db,
  accountId: string,
  summe: number,
): Promise<number> {
  const erreichbar = wegStufenBis(summe).length;
  if (erreichbar === 0) return 0;

  const [zeile] = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(s.wegAbholung)
    .where(and(eq(s.wegAbholung.accountId, accountId), lte(s.wegAbholung.schwelle, summe)));

  return Math.max(0, erreichbar - (zeile?.anzahl ?? 0));
}

export interface WegFund {
  readonly schwelle: number;
  /** Grad der Truhe; null bei festen Muenzen. Der Client zeigt damit die Oeffnung. */
  readonly grad: Grad | null;
  /** Was gutgeschrieben wurde. */
  readonly coins: number;
  readonly gegenstand: string | null;
  /** Nein, wenn der Gegenstand schon im Besitz war (etwa gekauft). */
  readonly gegenstandNeu: boolean;
  /** Muenzstand danach, wie die Oberflaeche ihn zeigt. */
  readonly stand: number;
}

/**
 * Eine Stufe abholen: pruefen, eintragen, dann gutschreiben und schenken.
 *
 * Dieselbe Reihenfolge wie `truheOeffnen` und aus demselben Grund: Die Zeile
 * in `weg_abholung` kommt ZUERST und mit `onConflictDoNothing`. Nur wer sie
 * wirklich angelegt hat, schreibt danach Muenzen und legt den Gegenstand hin
 * — ein Doppeltipp oder zwei Geraete zugleich zahlen also bauartbedingt
 * einmal. Andersherum zahlte der zweite Tipp ein zweites Mal.
 *
 * Bricht es zwischen Eintrag und Gutschrift ab, fehlen die Muenzen: unangenehm,
 * reparierbar, und es meldet sich jemand. Eine Transaktion waere sauberer,
 * aber `gutschreiben` nimmt das Datenbankhandle und keine Transaktion, und
 * dafuer die Waehrung umzubauen, ist ein eigener Schritt.
 */
export async function wegHolen(db: Db, accountId: string, schwelle: number): Promise<WegFund> {
  const stufe = wegStufe(schwelle);
  if (!stufe) throw notFound('wegStufeUnbekannt');

  const summe = await trophaeenSumme(db, accountId);
  if (summe < schwelle) throw conflict('wegNichtErreicht');

  // Ausdruecklich als `Grad` getypt: Der Katalog darf nichts importieren und
  // fuehrt seinen Grad selbst (`WegGrad`). Diese Zuweisung haelt ihn beim
  // Uebersetzen an `truhen.ts` — faellt dort ein Grad weg, bricht der Bau.
  const grad: Grad | null = stufe.truhe;
  // Gewuerfelt wird vor dem Eintrag, damit die Zeile gleich das Ergebnis traegt.
  // Wer den Eintrag verliert (zweite Anfrage), dessen Wurf verfaellt ungesehen.
  const coins = grad ? wuerfeln(grad) : (stufe.muenzen ?? 0);

  const eingetragen = await db
    .insert(s.wegAbholung)
    .values({ accountId, schwelle, grade: grad, coins, itemId: stufe.gegenstand })
    .onConflictDoNothing()
    .returning({ schwelle: s.wegAbholung.schwelle });
  if (eingetragen.length === 0) throw conflict('wegSchonGeholt');

  let gegenstandNeu = false;
  if (stufe.gegenstand) {
    // Wie der Kauf in shop.ts, nur ohne Abbuchung. Steht die Zeile schon
    // (gekauft oder geschenkt), bleibt es beim Besitz: kein Fehler, denn die
    // Truhe der Station gibt es trotzdem.
    const neu = await db
      .insert(s.accountCosmetic)
      .values({ accountId, itemId: stufe.gegenstand })
      .onConflictDoNothing()
      .returning({ itemId: s.accountCosmetic.itemId });
    gegenstandNeu = neu.length > 0;
  }

  const stand = await gutschreiben(db, accountId, 'coins', coins);
  return { schwelle, grad, coins, gegenstand: stufe.gegenstand, gegenstandNeu, stand };
}
