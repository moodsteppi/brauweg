/** Hostberechnete Partien wie Flying Bro: serverseitiger Start, Plausibilität,
 * einmalige Gutschrift und Berliner Tageskappe. Keine kompetitive Rangliste. */
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { BELOHNUNG, bauAbzeichen } from '@brauweg/building-kern';
import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, conflict, forbidden } from './errors.js';
import { gutschreiben } from './waehrung.js';
import { heute } from './truhen.js';

export const bauStartSchema = z.object({ partie: z.string().regex(/^[a-zA-Z0-9-]{8,80}$/), modus: z.enum(['rennen', 'standfest']) });
export const bauErgebnisSchema = z.object({
  modus: z.enum(['rennen', 'standfest']), hoehe: z.number().min(0).max(125), gebaut: z.number().int().min(0).max(30), verloren: z.number().int().min(0).max(30),
  leben: z.number().int().min(0).max(3), platz: z.number().int().min(1).max(4), gewonnen: z.boolean(), aufgegeben: z.boolean(), dauer: z.number().int().min(0).max(181), spielerzahl: z.number().int().min(1).max(4),
});
export async function buildingStart(db: Db, konto: string, eingabe: unknown, jetzt = new Date()) {
  const b = bauStartSchema.parse(eingabe);
  return db.transaction(async tx0 => {
    const tx = tx0 as unknown as Db;
    const [account] = await tx.select({ id: s.account.id, gastSeit: s.account.gastSeit }).from(s.account).where(eq(s.account.id, konto)).for('update');
    if (!account || account.gastSeit) throw forbidden();
    const [vorher] = await tx.select().from(s.buildingRunde).where(and(eq(s.buildingRunde.accountId, konto), eq(s.buildingRunde.partie, b.partie)));
    if (vorher) { if (vorher.modus !== b.modus) throw badRequest('invalidInput'); return { konto, partie: b.partie }; }
    // Offline-Abschlüsse bleiben bis 24 Stunden nachmeldbar. Ein neuer Start
    // darf den noch nicht übertragenen Abschluss nicht löschen.
    await tx.delete(s.buildingRunde).where(and(eq(s.buildingRunde.accountId, konto), sql`${s.buildingRunde.ergebnis} is null`, sql`${s.buildingRunde.start} < ${new Date(jetzt.getTime() - 86400000)}`));
    const [offen] = await tx.select({ zahl: sql<number>`count(*)::int` }).from(s.buildingRunde).where(and(eq(s.buildingRunde.accountId, konto), sql`${s.buildingRunde.ergebnis} is null`));
    if (offen.zahl >= 30) throw badRequest('invalidInput');
    await tx.insert(s.buildingRunde).values({ accountId: konto, partie: b.partie, modus: b.modus, start: jetzt });
    return { konto, partie: b.partie };
  });
}
export async function buildingErgebnis(db: Db, konto: string, partie: string, eingabe: unknown, jetzt = new Date()) {
  const e = bauErgebnisSchema.parse(eingabe);
  return db.transaction(async tx0 => {
    const tx = tx0 as unknown as Db;
    // Dieselbe Kontosperre schützt Ergebnis, Tageslimit und Münzstand atomar.
    const [account] = await tx.select({ id: s.account.id, gastSeit: s.account.gastSeit }).from(s.account).where(eq(s.account.id, konto)).for('update');
    if (!account || account.gastSeit) throw forbidden();
    const bedingung = and(eq(s.buildingRunde.accountId, konto), eq(s.buildingRunde.partie, partie));
    const [runde] = await tx.select().from(s.buildingRunde).where(bedingung);
    if (!runde) throw conflict('buildingKeinStart');
    if (runde.ergebnis) return { muenzen: runde.muenzen, abzeichen: bauAbzeichen(runde.ergebnis), wiederholt: true };
    const vergangen = (jetzt.getTime() - runde.start.getTime()) / 1000;
    if (e.modus !== runde.modus || e.platz > e.spielerzahl || (e.gewonnen && (e.aufgegeben || e.platz !== 1)) || e.gebaut + e.verloren > 60
      || vergangen < Math.max(0, e.dauer - 5) || vergangen > 86400 || e.gebaut > e.dauer * 2 + 1
      || (e.gewonnen && e.spielerzahl === 1 && !(e.modus === 'rennen' ? e.hoehe >= 16 : e.gebaut === 30 && e.leben > 0))
      || (e.modus === 'standfest' && e.gewonnen && e.leben === 0)) throw badRequest('invalidInput');
    const tag = heute(jetzt);
    const [summe] = await tx.select({ wert: sql<number>`coalesce(sum(${s.buildingRunde.muenzen}), 0)::int` }).from(s.buildingRunde).where(and(eq(s.buildingRunde.accountId, konto), eq(s.buildingRunde.tag, tag)));
    // Abgebrochene/sofort aufgegebene Runden ergeben keine Münzquelle.
    const verdient = !e.aufgegeben && e.dauer >= 15 && e.gebaut >= 3 ? BELOHNUNG.runde + (e.gewonnen ? BELOHNUNG.sieg : 0) : 0;
    const muenzen = Math.max(0, Math.min(verdient, BELOHNUNG.tag - (summe?.wert ?? 0)));
    await tx.update(s.buildingRunde).set({ ende: jetzt, tag, ergebnis: e, muenzen }).where(bedingung);
    if (muenzen) await gutschreiben(tx, konto, 'coins', muenzen);
    return { muenzen, abzeichen: bauAbzeichen(e), wiederholt: false };
  });
}
export async function buildingVerlauf(db: Db, konto: string, jetzt = new Date()) {
  const [account] = await db.select({ gastSeit: s.account.gastSeit }).from(s.account).where(eq(s.account.id, konto));
  if (!account || account.gastSeit) throw forbidden();
  const runden = await db.select({ partie: s.buildingRunde.partie, am: s.buildingRunde.ende, ergebnis: s.buildingRunde.ergebnis, muenzen: s.buildingRunde.muenzen }).from(s.buildingRunde)
    .where(and(eq(s.buildingRunde.accountId, konto), isNotNull(s.buildingRunde.ergebnis))).orderBy(desc(s.buildingRunde.ende)).limit(30);
  const [summe] = await db.select({ wert: sql<number>`coalesce(sum(${s.buildingRunde.muenzen}), 0)::int` }).from(s.buildingRunde).where(and(eq(s.buildingRunde.accountId, konto), eq(s.buildingRunde.tag, heute(jetzt))));
  return { konto, runden, restMuenzen: Math.max(0, BELOHNUNG.tag - (summe?.wert ?? 0)) };
}
