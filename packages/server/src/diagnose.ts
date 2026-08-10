/**
 * Mitschnitt der Feldherr-Netzpartien: aufnehmen, abrufen, verfallen lassen.
 *
 * Der Anlass steht in docs/FELDHERR-DIAGNOSE.md: Feldherr wird auf dem
 * Produktivsystem strittig und in keiner Testfassung. Wer das finden will,
 * braucht den Lauf des echten Geraets — Takt, Wissensgrenze, schwebende
 * Zuege, beide Pruefsummen, jeden Verbindungsabbruch, jeden Fehlercode.
 *
 * Drei Entscheidungen, die den Rest erklaeren:
 *
 *   1. **Der Server prueft den Inhalt nicht.** `rumpf` ist jsonb und bleibt
 *      es. Ein Schema hier hiesse: Jeder neue Verdacht braucht erst eine
 *      Migration, waehrend der Fehler weiter unbeobachtet auftritt. Gegrenzt
 *      wird ueber Groesse und Rate, nicht ueber Form.
 *   2. **Datenbank, nicht Datei.** Auf Railway ist das Dateisystem
 *      fluechtig: Der naechste Deploy wischt es, und genau dann will man
 *      nachsehen. Die Datei entsteht auf dem Rechner des Entwicklers, wenn
 *      `werkzeug/diagnose-holen.mjs` den Mitschnitt abholt.
 *   3. **Aufnehmen darf jeder Angemeldete, lesen nur die Aufsicht.** Ein
 *      Mitschnitt ist eine Messung des eigenen Geraets; die Sammlung ueber
 *      alle Partien ist etwas anderes.
 */

import { and, desc, eq, gt, lt, sql } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';

/**
 * Wie lange ein Mitschnitt aufbewahrt wird.
 *
 * Vierzehn Tage: lang genug, dass eine Meldung vom Wochenende am Dienstag
 * noch Daten findet, kurz genug, dass hier kein Bestand entsteht. Ein
 * Mitschnitt ist ein Werkzeug, kein Archiv.
 */
export const AUFBEWAHRUNG_TAGE = 14;

/**
 * Hoechstzahl Zeilen je Tisch und Sitz.
 *
 * Eine Partie sendet alle 20 Sekunden eine Portion, dazu die Ereignisse.
 * 400 Zeilen sind ueber zwei Stunden Partie — darueber ist etwas kaputt
 * (Sendeschleife), und dann soll die Datenbank nicht volllaufen.
 */
export const MAX_ZEILEN_JE_SITZ = 400;

export interface Mitschnitt {
  readonly accountId: string;
  readonly tableId: string | null;
  readonly seat: number;
  readonly grund: string;
  readonly abIndex: number;
  readonly rumpf: unknown;
}

/**
 * Eine Portion aufnehmen.
 *
 * Gibt zurueck, ob sie gespeichert wurde. `false` heisst: Die Kappe ist
 * erreicht — kein Fehler fuer den Client, denn ein Geraet, dessen Meldungen
 * verworfen werden, soll nicht auch noch anfangen, sie zu wiederholen.
 */
export async function nimmAuf(db: Db, m: Mitschnitt): Promise<boolean> {
  if (m.tableId) {
    const [{ anzahl }] = await db
      .select({ anzahl: sql<number>`count(*)::int` })
      .from(s.feldherrDiagnose)
      .where(
        and(
          eq(s.feldherrDiagnose.tableId, m.tableId),
          eq(s.feldherrDiagnose.seat, m.seat),
        ),
      );
    if (anzahl >= MAX_ZEILEN_JE_SITZ) return false;
  }

  await db.insert(s.feldherrDiagnose).values({
    accountId: m.accountId,
    tableId: m.tableId,
    seat: m.seat,
    grund: m.grund,
    abIndex: m.abIndex,
    rumpf: m.rumpf,
  });
  return true;
}

export interface Abfrage {
  /** Nur Zeilen nach diesem Zeitpunkt. */
  readonly seit?: Date;
  /** Nur ein Tisch. Ohne Angabe: alle. */
  readonly tableId?: string;
  /** Hoechstzahl Zeilen; der Abruf ist sonst unbegrenzt gross. */
  readonly grenze: number;
}

export interface Zeile {
  readonly id: string;
  readonly tableId: string | null;
  readonly accountId: string | null;
  readonly seat: number;
  readonly grund: string;
  readonly abIndex: number;
  readonly createdAt: Date;
  readonly rumpf: unknown;
}

/**
 * Mitschnitte lesen, aelteste zuerst.
 *
 * Aufsteigend und nicht absteigend: Ein Mitschnitt wird von vorn nach
 * hinten gelesen wie ein Protokoll. Die Begrenzung greift deshalb ueber
 * `seit` (Zeitfenster), nicht ueber "die letzten N" — sonst bekaeme man das
 * Ende einer Partie ohne ihren Anfang.
 */
export async function lies(db: Db, abfrage: Abfrage): Promise<Zeile[]> {
  const bedingungen = [];
  if (abfrage.seit) bedingungen.push(gt(s.feldherrDiagnose.createdAt, abfrage.seit));
  if (abfrage.tableId) bedingungen.push(eq(s.feldherrDiagnose.tableId, abfrage.tableId));

  const zeilen = await db
    .select()
    .from(s.feldherrDiagnose)
    .where(bedingungen.length > 0 ? and(...bedingungen) : undefined)
    .orderBy(s.feldherrDiagnose.createdAt, s.feldherrDiagnose.id)
    .limit(abfrage.grenze);

  return zeilen.map((z) => ({
    id: z.id,
    tableId: z.tableId,
    accountId: z.accountId,
    seat: z.seat,
    grund: z.grund,
    abIndex: z.abIndex,
    createdAt: z.createdAt,
    rumpf: z.rumpf,
  }));
}

export interface Uebersicht {
  readonly tableId: string | null;
  readonly zeilen: number;
  readonly sitze: number;
  readonly von: Date;
  readonly bis: Date;
  /** Wurde fuer diesen Tisch ein Gleichlaufverlust gemeldet? */
  readonly strittig: boolean;
}

/**
 * Welche Partien ueberhaupt Mitschnitte haben.
 *
 * Der Einstieg in jede Untersuchung: erst sehen, welche Tische es gibt und
 * welcher auffaellig ist, dann einen davon ganz lesen. Ohne diese Liste
 * laedt man Megabyte, um festzustellen, dass nichts passiert ist.
 */
export async function uebersicht(db: Db, seit: Date, grenze = 100): Promise<Uebersicht[]> {
  const zeilen = await db
    .select({
      tableId: s.feldherrDiagnose.tableId,
      zeilen: sql<number>`count(*)::int`,
      sitze: sql<number>`count(distinct ${s.feldherrDiagnose.seat})::int`,
      von: sql<Date>`min(${s.feldherrDiagnose.createdAt})`,
      bis: sql<Date>`max(${s.feldherrDiagnose.createdAt})`,
      strittig: sql<boolean>`bool_or(${s.feldherrDiagnose.grund} in ('strittig','ausgang'))`,
    })
    .from(s.feldherrDiagnose)
    .where(gt(s.feldherrDiagnose.createdAt, seit))
    .groupBy(s.feldherrDiagnose.tableId)
    .orderBy(desc(sql`max(${s.feldherrDiagnose.createdAt})`))
    .limit(grenze);

  return zeilen.map((z) => ({
    tableId: z.tableId,
    zeilen: z.zeilen,
    sitze: z.sitze,
    von: new Date(z.von),
    bis: new Date(z.bis),
    strittig: z.strittig === true,
  }));
}

/** Alte Mitschnitte wegwerfen. Gibt die Zahl der geloeschten Zeilen zurueck. */
export async function aufraeumen(db: Db, jetzt = new Date()): Promise<number> {
  const grenze = new Date(jetzt.getTime() - AUFBEWAHRUNG_TAGE * 24 * 3600_000);
  const weg = await db
    .delete(s.feldherrDiagnose)
    .where(lt(s.feldherrDiagnose.createdAt, grenze))
    .returning({ id: s.feldherrDiagnose.id });
  return weg.length;
}
