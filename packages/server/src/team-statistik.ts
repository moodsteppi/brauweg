/**
 * Zahlen fuers brotool-Dashboard (Tab „Spielen", 27.10.2026).
 *
 * Liefert die Tagessummen aus `stats_tag` (Niklas' „Tracking Stufe 0",
 * src/statistik.ts) roh und unveraendert — das Dashboard rechnet und zeichnet
 * selbst. Dazu ein paar Bestandszahlen, die es in den Tagessummen nicht gibt,
 * weil sie keine Ereignisse sind: wie viele Konten es gibt, wie viele davon
 * Gaeste sind, und der Stand der Muenz-Codes.
 *
 * Nichts davon nennt eine Person: Zaehlungen, keine Listen.
 */

import { and, count, gte, isNotNull, isNull, lte, sql, sum } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';

export interface TagesZeile {
  readonly datum: string;
  readonly metrik: string;
  readonly spiel: string;
  readonly modus: string;
  readonly ergebnis: string;
  readonly wert: number;
}

export interface TeamStatistik {
  readonly von: string;
  readonly bis: string;
  readonly tage: TagesZeile[];
  readonly konten: { readonly gesamt: number; readonly gaeste: number; readonly geloescht: number };
  readonly codes: { readonly offen: number; readonly eingeloest: number; readonly muenzenEingeloest: number };
}

/** Hoechstens ein Jahr auf einmal: Mehr zeichnet kein Dashboard sinnvoll. */
const MAX_TAGE = 366;

function tagVor(tage: number, ab = new Date()): string {
  return new Date(ab.getTime() - tage * 86_400_000).toISOString().slice(0, 10);
}

export async function teamStatistik(db: Db, bereich: { von?: string; bis?: string }): Promise<TeamStatistik> {
  const bis = bereich.bis ?? tagVor(0);
  let von = bereich.von ?? tagVor(29, new Date(`${bis}T12:00:00Z`));
  if (Date.parse(bis) - Date.parse(von) > MAX_TAGE * 86_400_000) von = tagVor(MAX_TAGE - 1, new Date(`${bis}T12:00:00Z`));

  const tage = await db
    .select()
    .from(s.statsTag)
    .where(and(gte(s.statsTag.datum, von), lte(s.statsTag.datum, bis)))
    .orderBy(s.statsTag.datum, s.statsTag.metrik);

  const [konten] = await db
    .select({
      gesamt: count(),
      gaeste: sql<number>`count(*) filter (where ${s.account.gastSeit} is not null and ${s.account.anonymizedAt} is null)`,
      geloescht: sql<number>`count(*) filter (where ${s.account.anonymizedAt} is not null)`,
    })
    .from(s.account);

  const [offen] = await db
    .select({ n: count() })
    .from(s.muenzCode)
    .where(and(isNull(s.muenzCode.eingeloestVon), sql`${s.muenzCode.gesperrt} = false`));
  const [eingeloest] = await db
    .select({ n: count(), muenzen: sum(s.muenzCode.muenzen) })
    .from(s.muenzCode)
    .where(isNotNull(s.muenzCode.eingeloestVon));

  return {
    von,
    bis,
    tage: tage.map((z) => ({ ...z, wert: Number(z.wert) })),
    konten: {
      gesamt: Number(konten?.gesamt ?? 0) - Number(konten?.geloescht ?? 0),
      gaeste: Number(konten?.gaeste ?? 0),
      geloescht: Number(konten?.geloescht ?? 0),
    },
    codes: {
      offen: Number(offen?.n ?? 0),
      eingeloest: Number(eingeloest?.n ?? 0),
      muenzenEingeloest: Number(eingeloest?.muenzen ?? 0),
    },
  };
}
