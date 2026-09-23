/**
 * Geraete und Einstellungen in der Datenbank (Tabellen aus 0030).
 *
 * Alles, was ein Token anlegt, verschiebt, abschaltet oder loescht, steht
 * hier — damit Abmelden und Kontoloeschung (auth/service.ts) dieselben
 * Handgriffe benutzen wie die Routen.
 */

import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { ANLAESSE, type Anlass, istAnlass } from './kennungen.js';

export type Plattform = 'ios' | 'android';

/**
 * Hoechstens so viele Geraete je Konto. Ein Mensch hat ein Telefon und
 * vielleicht ein Tablet; wer oft neu installiert, sammelt tote Tokens an,
 * und jedes kostet bei jeder Mitteilung eine Anfrage. Das aelteste faellt.
 */
export const GERAETE_JE_KONTO = 10;

/**
 * Token anlegen oder aktualisieren.
 *
 * Ein Upsert auf das Token: Dasselbe Geraet meldet sich bei jedem App-Start
 * wieder, und nach einem Kontowechsel auf demselben Telefon gehoert es dem,
 * der jetzt angemeldet ist — mitsamt der neuen Sitzung, damit dessen
 * Abmelden es wieder mitnimmt.
 */
export async function registriereGeraet(
  db: Db,
  eintrag: {
    readonly accountId: string;
    readonly sitzungId: string | null;
    readonly plattform: Plattform;
    readonly token: string;
  },
): Promise<void> {
  const jetzt = new Date();
  await db
    .insert(s.geraetPush)
    .values({
      accountId: eintrag.accountId,
      sitzungId: eintrag.sitzungId,
      plattform: eintrag.plattform,
      token: eintrag.token,
      erstellt: jetzt,
      zuletztGesehen: jetzt,
      aktiv: true,
    })
    .onConflictDoUpdate({
      target: s.geraetPush.token,
      set: {
        accountId: eintrag.accountId,
        sitzungId: eintrag.sitzungId,
        plattform: eintrag.plattform,
        zuletztGesehen: jetzt,
        aktiv: true,
      },
    });

  // Aelteste ueber der Grenze entfernen.
  const alle = await db
    .select({ id: s.geraetPush.id })
    .from(s.geraetPush)
    .where(eq(s.geraetPush.accountId, eintrag.accountId))
    .orderBy(asc(s.geraetPush.zuletztGesehen));
  const zuviel = alle.length - GERAETE_JE_KONTO;
  if (zuviel > 0) {
    await db.delete(s.geraetPush).where(
      inArray(
        s.geraetPush.id,
        alle.slice(0, zuviel).map((zeile) => zeile.id),
      ),
    );
  }
}

/** Ein Token dieses Kontos abmelden. Fremde Tokens bleiben unberuehrt. */
export async function meldeGeraetAb(db: Db, accountId: string, token: string): Promise<boolean> {
  const weg = await db
    .delete(s.geraetPush)
    .where(and(eq(s.geraetPush.accountId, accountId), eq(s.geraetPush.token, token)))
    .returning({ id: s.geraetPush.id });
  return weg.length > 0;
}

/** Beim Abmelden: alles, was ueber diese Sitzung registriert wurde. */
export async function loescheGeraeteDerSitzung(db: Db, sitzungId: string): Promise<void> {
  await db.delete(s.geraetPush).where(eq(s.geraetPush.sitzungId, sitzungId));
}

/** Bei der Kontoloeschung: alle Geraete und die Einstellungen. */
export async function loescheGeraeteDesKontos(db: Db, accountId: string): Promise<void> {
  await db.delete(s.geraetPush).where(eq(s.geraetPush.accountId, accountId));
  await db.delete(s.pushEinstellung).where(eq(s.pushEinstellung.accountId, accountId));
}

/** Tokens, die der Dienst fuer tot erklaert hat. */
export async function deaktiviereGeraete(db: Db, tokens: readonly string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db
    .update(s.geraetPush)
    .set({ aktiv: false })
    .where(inArray(s.geraetPush.token, [...tokens]));
}

export interface AktivesGeraet {
  readonly accountId: string;
  readonly plattform: Plattform;
  readonly token: string;
}

/**
 * Aktive Geraete dieser Konten, die den Anlass nicht abgeschaltet haben.
 *
 * Wer keine Zeile in `push_einstellung` hat, will alles (Vorgabe an).
 *
 * Und nur Geraete, deren Anmeldung noch gilt: Widerruft der Server eine
 * Sitzung auf anderem Weg als ueber das Abmelden (Passwort zurueckgesetzt,
 * Sitzung abgelaufen), bleibt die Zeile stehen, bekommt aber nichts mehr —
 * sonst stupste das Telefon weiter fuer ein Konto, bei dem es gar nicht
 * mehr angemeldet ist. Mit der naechsten Anmeldung zieht die Zeile um.
 */
export async function geraeteFuer(
  db: Db,
  accountIds: readonly string[],
  anlass: Anlass,
): Promise<AktivesGeraet[]> {
  if (accountIds.length === 0) return [];
  const [abgeschaltet, geraete] = await Promise.all([
    db
      .select({ accountId: s.pushEinstellung.accountId, aus: s.pushEinstellung.aus })
      .from(s.pushEinstellung)
      .where(inArray(s.pushEinstellung.accountId, [...accountIds])),
    db
      .select({
        accountId: s.geraetPush.accountId,
        plattform: s.geraetPush.plattform,
        token: s.geraetPush.token,
      })
      .from(s.geraetPush)
      .leftJoin(s.session, eq(s.session.id, s.geraetPush.sitzungId))
      .where(
        and(
          inArray(s.geraetPush.accountId, [...accountIds]),
          eq(s.geraetPush.aktiv, true),
          or(
            isNull(s.geraetPush.sitzungId),
            and(isNull(s.session.revokedAt), gt(s.session.expiresAt, new Date())),
          ),
        ),
      ),
  ]);
  const ohne = new Set(abgeschaltet.filter((z) => z.aus.includes(anlass)).map((z) => z.accountId));
  return geraete.filter((g) => !ohne.has(g.accountId));
}

export type AnlassSchalter = Readonly<Record<Anlass, boolean>>;

/** Die Schalter eines Kontos, Vorgabe alle an. */
export async function leseEinstellungen(db: Db, accountId: string): Promise<AnlassSchalter> {
  const [zeile] = await db
    .select({ aus: s.pushEinstellung.aus })
    .from(s.pushEinstellung)
    .where(eq(s.pushEinstellung.accountId, accountId));
  const aus = new Set(zeile?.aus ?? []);
  return Object.fromEntries(ANLAESSE.map((a) => [a, !aus.has(a)])) as Record<Anlass, boolean>;
}

/** Einzelne Schalter setzen; nicht genannte bleiben, wie sie sind. */
export async function setzeEinstellungen(
  db: Db,
  accountId: string,
  aenderung: Partial<Record<Anlass, boolean>>,
): Promise<AnlassSchalter> {
  const jetzt = await leseEinstellungen(db, accountId);
  const neu: Record<Anlass, boolean> = { ...jetzt };
  for (const [anlass, an] of Object.entries(aenderung)) {
    if (istAnlass(anlass) && typeof an === 'boolean') neu[anlass] = an;
  }
  const aus = ANLAESSE.filter((a) => !neu[a]);
  await db
    .insert(s.pushEinstellung)
    .values({ accountId, aus, geaendert: new Date() })
    .onConflictDoUpdate({ target: s.pushEinstellung.accountId, set: { aus, geaendert: new Date() } });
  return neu;
}

/** Wie viele aktive Geraete ein Konto hat — fuer die Einstellungen. */
export async function zaehleGeraete(db: Db, accountId: string): Promise<number> {
  const zeilen = await db
    .select({ id: s.geraetPush.id })
    .from(s.geraetPush)
    .where(and(eq(s.geraetPush.accountId, accountId), eq(s.geraetPush.aktiv, true)));
  return zeilen.length;
}
