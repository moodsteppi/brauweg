/**
 * Muenz-Codes (Tom, 27.10.2026): Einmal-Codes fuer Muenzen.
 *
 * Erzeugt werden sie im brotool, Tab „Spielen" → Codes, ueber die
 * Team-Schnittstelle (http/team-routen.ts) — wahlweise fuer Produktion oder
 * staging, je nachdem, welchen Server der bro-server fragt. Eingeloest werden
 * sie **nur auf der Webseite** (Profil → Einstellungen → Code einloesen).
 *
 * Warum nicht in der App: Apple verbietet in Apps eigene Wege, Inhalte
 * freizuschalten (App-Store-Regel 3.1.1, ausdruecklich auch Codes). Der
 * Server lehnt deshalb Einloesungen aus der App ab, nicht nur die Oberflaeche
 * blendet sie aus. Die Muenzen gelten danach natuerlich auch in der App —
 * es ist dasselbe Konto.
 *
 * Ein Code gilt genau einmal, fuer genau ein Konto (Tom: „Einmal-Codes").
 * Fuer zwanzig Leute erzeugt man zwanzig Codes.
 */

import { randomInt } from 'node:crypto';

import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { badRequest, notFound } from './errors.js';
import { zaehle } from './statistik.js';
import { gutschreiben } from './waehrung.js';

/**
 * Ohne 0/O, 1/I/L, 5/S, 2/Z, 8/B: Codes werden abgetippt, von einem Zettel
 * oder aus einer Nachricht, und genau diese Paare verwechselt man dabei.
 */
const ZEICHEN = 'ACDEFGHJKMNPQRTUVWXY34679';
/** 2 × 4 Zeichen aus 25: rund 1,5 · 10^11 Moeglichkeiten — Raten lohnt nicht bei der Ratengrenze. */
const BLOCK = 4;

export const MAX_ANZAHL = 200;
export const MAX_MUENZEN = 1_000_000;

/** `BW-XXXX-XXXX`. */
export function neuerCode(): string {
  const block = () => Array.from({ length: BLOCK }, () => ZEICHEN[randomInt(ZEICHEN.length)]).join('');
  return `BW-${block()}-${block()}`;
}

/** Was jemand eintippt: Leerzeichen und Bindestriche egal, Klein egal, ohne „BW". */
export function normalisiereCode(eingabe: string): string | null {
  const roh = eingabe.toUpperCase().replace(/[\s-]/g, '');
  const ohne = roh.startsWith('BW') ? roh.slice(2) : roh;
  if (ohne.length !== BLOCK * 2 || [...ohne].some((z) => !ZEICHEN.includes(z))) return null;
  return `BW-${ohne.slice(0, BLOCK)}-${ohne.slice(BLOCK)}`;
}

export interface CodeSicht {
  readonly id: string;
  readonly code: string;
  readonly muenzen: number;
  readonly notiz: string | null;
  readonly erstellt: string;
  readonly gueltigBis: string | null;
  readonly gesperrt: boolean;
  readonly eingeloestAm: string | null;
  /** Anzeigename des Kontos, das ihn eingeloest hat (bei geloeschten Konten `geloescht-…`). */
  readonly eingeloestVon: string | null;
}

export async function erzeugeCodes(
  db: Db,
  auftrag: { anzahl: number; muenzen: number; notiz?: string | null; gueltigBis?: Date | null },
): Promise<CodeSicht[]> {
  const { anzahl, muenzen } = auftrag;
  if (!Number.isInteger(anzahl) || anzahl < 1 || anzahl > MAX_ANZAHL) throw badRequest('invalidInput');
  if (!Number.isInteger(muenzen) || muenzen < 1 || muenzen > MAX_MUENZEN) throw badRequest('invalidInput');
  const notiz = auftrag.notiz?.trim() || null;
  const zeilen = Array.from({ length: anzahl }, () => ({
    code: neuerCode(),
    muenzen,
    notiz,
    gueltigBis: auftrag.gueltigBis ?? null,
  }));
  // Eine Doppelung bei 10^11 ist praktisch ausgeschlossen; trifft sie doch,
  // faellt nur dieser Code weg, statt dass der ganze Auftrag scheitert.
  const neu = await db.insert(s.muenzCode).values(zeilen).onConflictDoNothing().returning();
  return neu.map((z) => sicht(z, null));
}

export async function listeCodes(db: Db, grenze = 200): Promise<CodeSicht[]> {
  const zeilen = await db
    .select({ code: s.muenzCode, name: s.account.displayName })
    .from(s.muenzCode)
    .leftJoin(s.account, eq(s.account.id, s.muenzCode.eingeloestVon))
    .orderBy(desc(s.muenzCode.erstellt), s.muenzCode.code)
    .limit(Math.min(Math.max(1, grenze), 1000));
  return zeilen.map((z) => sicht(z.code, z.name));
}

/** Sperren geht nur, solange er nicht eingeloest ist — danach aendert es nichts mehr. */
export async function sperreCode(db: Db, id: string): Promise<void> {
  const [z] = await db
    .update(s.muenzCode)
    .set({ gesperrt: true })
    .where(and(eq(s.muenzCode.id, id), isNull(s.muenzCode.eingeloestVon)))
    .returning({ id: s.muenzCode.id });
  if (!z) throw notFound('codeUnbekannt');
}

/**
 * Einloesen. Unbekannt, verbraucht, gesperrt und abgelaufen bekommen dieselbe
 * Antwort (`codeUngueltig`): Wer probiert, soll nicht erfahren, dass er einen
 * echten Code getroffen hat, den nur schon jemand anderes hatte.
 */
export async function loeseCodeEin(db: Db, accountId: string, eingabe: string): Promise<{ muenzen: number; stand: number }> {
  const code = normalisiereCode(eingabe);
  if (!code) throw badRequest('codeUngueltig');
  return db.transaction(async (tx) => {
    const [treffer] = await tx
      .update(s.muenzCode)
      .set({ eingeloestVon: accountId, eingeloestAm: new Date() })
      .where(
        and(
          eq(s.muenzCode.code, code),
          isNull(s.muenzCode.eingeloestVon),
          eq(s.muenzCode.gesperrt, false),
          or(isNull(s.muenzCode.gueltigBis), gt(s.muenzCode.gueltigBis, sql`now()`)),
        ),
      )
      .returning({ muenzen: s.muenzCode.muenzen });
    if (!treffer) throw badRequest('codeUngueltig');
    const stand = await gutschreiben(tx as unknown as Db, accountId, 'coins', treffer.muenzen);
    zaehle('code_eingeloest');
    return { muenzen: treffer.muenzen, stand };
  });
}

function sicht(z: typeof s.muenzCode.$inferSelect, name: string | null): CodeSicht {
  return {
    id: z.id,
    code: z.code,
    muenzen: z.muenzen,
    notiz: z.notiz,
    erstellt: z.erstellt.toISOString(),
    gueltigBis: z.gueltigBis?.toISOString() ?? null,
    gesperrt: z.gesperrt,
    eingeloestAm: z.eingeloestAm?.toISOString() ?? null,
    eingeloestVon: z.eingeloestVon ? (name ?? '—') : null,
  };
}
