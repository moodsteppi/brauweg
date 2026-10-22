/**
 * Kartenmanufaktur: was der Server festhaelt (Emile, 23.10.2026).
 *
 * Eine Zeile je Konto mit dem ganzen Stand. Jeder Aufruf rechnet erst bis
 * jetzt nach (`vorspulen` in regeln.ts), dann gilt die Aktion. Muenzen fuers
 * Hub gibt es nur fuer Meilensteine, die regeln.ts meldet — Taler bleiben
 * Taler (Wirtschaftsmodell, docs/SPEZIFIKATION-KARTENMANUFAKTUR.md).
 */

import { and, eq } from 'drizzle-orm';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, conflict } from '../errors.js';
import { gutschreiben } from '../waehrung.js';
import {
  type Aktion,
  AktionAbgelehnt,
  type ManufakturAnsicht,
  type ManufakturStand,
  ansicht,
  handle,
  neueMeilensteine,
  neuerStand,
  vorspulen,
} from './regeln.js';

/** Ab dieser Abwesenheit meldet der Bildschirm „Waehrend du weg warst". */
const OFFLINE_MELDUNG_AB_MS = 5 * 60 * 1000;

export interface ManufakturAntwort {
  ansicht: ManufakturAnsicht;
  /** Gesetzt, wenn seit dem letzten Besuch Zeit vergangen ist und Taler kamen. */
  offline: { sekunden: number; taler: number } | null;
  /** Muenzen fuers Hub, die gerade gutgeschrieben wurden. */
  muenzen: number;
}

async function lade(db: Db, accountId: string): Promise<{ stand: ManufakturStand; version: number } | null> {
  const [zeile] = await db.select().from(s.manufaktur).where(eq(s.manufaktur.accountId, accountId));
  return zeile ? { stand: zeile.stand, version: zeile.version } : null;
}

/**
 * Schreibt, wenn seit dem Lesen niemand dazwischen war. Sonst `false` —
 * der Aufrufer liest neu und rechnet noch einmal (zwei Tipps im selben
 * Augenblick, zwei Geraete).
 */
async function speichere(
  db: Db,
  accountId: string,
  stand: ManufakturStand,
  version: number | null,
  jetzt: Date,
): Promise<boolean> {
  if (version === null) {
    const neu = await db
      .insert(s.manufaktur)
      .values({ accountId, stand, version: 1, aktualisiert: jetzt })
      .onConflictDoNothing()
      .returning({ v: s.manufaktur.version });
    return neu.length > 0;
  }
  const geaendert = await db
    .update(s.manufaktur)
    .set({ stand, version: version + 1, aktualisiert: jetzt })
    .where(and(eq(s.manufaktur.accountId, accountId), eq(s.manufaktur.version, version)))
    .returning({ v: s.manufaktur.version });
  return geaendert.length > 0;
}

async function zahleAus(db: Db, accountId: string, muenzen: number): Promise<void> {
  if (muenzen > 0) await gutschreiben(db, accountId, 'coins', muenzen);
}

/**
 * Den Stand bis jetzt nachrechnen und zeigen. Die erste Million unterwegs
 * (auch offline) zahlt ihren Meilenstein hier aus.
 */
export async function manufakturHeute(db: Db, accountId: string, jetzt = new Date()): Promise<ManufakturAntwort> {
  const ms = jetzt.getTime();
  for (let versuch = 0; versuch < 3; versuch += 1) {
    const geladen = await lade(db, accountId);
    const alt = geladen?.stand ?? neuerStand(ms);
    const weg = ms - alt.zeit;
    const vorgespult = vorspulen(alt, ms);
    const meilensteine = neueMeilensteine(vorgespult);
    const stand: ManufakturStand = meilensteine.length
      ? { ...vorgespult, meilensteine: [...vorgespult.meilensteine, ...meilensteine.map((m) => m.kennung)] }
      : vorgespult;
    if (!(await speichere(db, accountId, stand, geladen?.version ?? null, jetzt))) continue;
    const muenzen = meilensteine.reduce((summe, m) => summe + m.muenzen, 0);
    await zahleAus(db, accountId, muenzen);
    const gewonnen = stand.taler - alt.taler;
    return {
      ansicht: ansicht(stand, ms),
      offline:
        geladen && weg >= OFFLINE_MELDUNG_AB_MS && gewonnen > 0
          ? { sekunden: Math.round(weg / 1000), taler: gewonnen }
          : null,
      muenzen,
    };
  }
  throw conflict('manufakturBeschaeftigt');
}

/** Eine Aktion: ausbauen, Meister, Schicht, freischalten, umziehen. */
export async function manufakturAktion(
  db: Db,
  accountId: string,
  aktion: Aktion,
  jetzt = new Date(),
): Promise<ManufakturAntwort> {
  const ms = jetzt.getTime();
  for (let versuch = 0; versuch < 3; versuch += 1) {
    const geladen = await lade(db, accountId);
    const alt = geladen?.stand ?? neuerStand(ms);
    let ergebnis: ReturnType<typeof handle>;
    try {
      ergebnis = handle(alt, aktion, ms);
    } catch (err) {
      if (err instanceof AktionAbgelehnt) throw badRequest(err.code);
      throw err;
    }
    if (!(await speichere(db, accountId, ergebnis.stand, geladen?.version ?? null, jetzt))) continue;
    const muenzen = ergebnis.meilensteine.reduce((summe, m) => summe + m.muenzen, 0);
    await zahleAus(db, accountId, muenzen);
    return { ansicht: ansicht(ergebnis.stand, ms), offline: null, muenzen };
  }
  throw conflict('manufakturBeschaeftigt');
}
