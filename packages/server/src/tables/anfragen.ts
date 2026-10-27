/**
 * Beitritt mit Zusage (Emile, 13.10.2026).
 *
 * An einem Tisch, der nicht oeffentlich ist, setzt sich niemand mehr von
 * selbst hin: Wer per Einladungscode kommt oder als Clanmitglied einen
 * Clantisch waehlt, stellt eine Anfrage, und der Gastgeber nimmt sie an oder
 * lehnt sie ab. Erst die Zusage setzt ihn auf einen Platz.
 *
 * **Gastgeber** ist der erste Mensch am Tisch (der niedrigste besetzte Sitz) —
 * dieselbe Regel, nach der `/api/tables/code/:code` den Gastgeber nennt und
 * die Push-Mitteilung „Einladung angenommen" ihren Empfaenger findet. Wer den
 * Tisch aufmacht, sitzt auf Platz 0.
 *
 * **Fuer welche Spiele.** Fuer die mit der gemeinsamen Kartenlobby
 * (`MIT_ZUSAGE`): Nur deren Bildschirme koennen auf eine Zusage warten
 * (Lobby.tsx, Einladungslink in App.tsx), und ihr Wartebereich zeigt dem
 * Gastgeber die Anfragen. Die Spiele mit eigenem Einstieg (Tafelrunde,
 * Feldherr, Poker …) treten weiter direkt bei — ihre Bildschirme hielten ein
 * `angefragt` fuer einen Beitritt und stuenden dann vor einem Tisch, der sie
 * nicht hereinlaesst. Kommt eines dazu, gehoert es in die Liste, sobald sein
 * Bildschirm das Warten kann.
 *
 * **Ausnahmen**, die ohne Zusage bleiben:
 * - oeffentliche Tische (dafuer sind sie oeffentlich);
 * - die Partykiste: Dort sitzt man zusammen im Raum, der Code steht gross auf
 *   dem Bildschirm des Gastgebers, und wer ihn abtippt, ist eingeladen. Zwoelf
 *   Leute einzeln freizugeben haelt nur den Abend auf. (Sie steht deshalb
 *   bewusst nicht in `MIT_ZUSAGE`.)
 * - die Mitspielersuche (`suche/vermittlung.ts`): Sie setzt beide Seiten
 *   selbst und ruft `joinTable` direkt, nicht ueber die Beitrittsrouten.
 *
 * Die Sperre steht in den Routen und nicht in `joinTable`: `joinTable` ist das
 * Hinsetzen selbst, das auch die Zusage am Ende benutzt.
 */

import { and, asc, eq } from 'drizzle-orm';

import { requireClubMember } from '../clubs/service.js';
import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { conflict, forbidden, notFound } from '../errors.js';
import { joinTable, tableWithSeats } from './service.js';

/** Spiele, deren private Tische eine Zusage verlangen (siehe oben). */
const MIT_ZUSAGE: ReadonlySet<string> = new Set(['doppelkopf', 'skat', 'wizard', 'cambio', 'brochess']);

type Tisch = Awaited<ReturnType<typeof tableWithSeats>>;

/** Braucht ein Beitritt an diesem Tisch die Zusage des Gastgebers? */
export function brauchtZusage(table: { visibility: string; gameId: string }): boolean {
  return table.visibility !== 'public' && MIT_ZUSAGE.has(table.gameId);
}

/** Der Gastgeber: der erste Mensch am Tisch, oder null an einem leeren. */
export function gastgeberVon(seats: Tisch['seats']): string | null {
  return seats.find((seat) => seat.accountId)?.accountId ?? null;
}

/**
 * Anfrage stellen. Dieselben Pruefungen wie beim Hinsetzen, nur frueher:
 * Eine Anfrage an einen laufenden, vollen oder fremden Clantisch soll der
 * Anfragende sofort als Fehler sehen, nicht erst, wenn der Gastgeber zusagt.
 * Eine zweite Anfrage an denselben Tisch ist kein Fehler, sie bleibt eine.
 */
export async function stelleAnfrage(db: Db, tableId: string, accountId: string): Promise<void> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (table.status !== 'waiting') throw conflict('tableAlreadyStarted');
  if (seats.some((seat) => seat.accountId === accountId)) return;
  if (!seats.some((seat) => !seat.accountId && !seat.isBot)) throw conflict('tableFull');
  if (table.visibility === 'club_only') {
    if (!table.clubId) throw forbidden('notClubMember');
    await requireClubMember(db, table.clubId, accountId);
  }
  await db.insert(s.tischAnfrage).values({ tischId: tableId, accountId }).onConflictDoNothing();
}

/** Eigene Anfrage zuruecknehmen — etwa, wenn man des Wartens muede ist. */
export async function zieheAnfrageZurueck(db: Db, tableId: string, accountId: string): Promise<void> {
  await db
    .delete(s.tischAnfrage)
    .where(and(eq(s.tischAnfrage.tischId, tableId), eq(s.tischAnfrage.accountId, accountId)));
}

export interface OffeneAnfrage {
  readonly accountId: string;
  readonly displayName: string;
  readonly erstellt: Date;
}

/** Offene Anfragen an einen Tisch, aelteste zuerst. Nur fuer den Gastgeber. */
export async function offeneAnfragen(
  db: Db,
  tableId: string,
  gastgeber: string,
): Promise<OffeneAnfrage[]> {
  const { seats } = await tableWithSeats(db, tableId);
  if (gastgeberVon(seats) !== gastgeber) throw forbidden('notHost');
  return db
    .select({
      accountId: s.tischAnfrage.accountId,
      displayName: s.account.displayName,
      erstellt: s.tischAnfrage.erstellt,
    })
    .from(s.tischAnfrage)
    .innerJoin(s.account, eq(s.account.id, s.tischAnfrage.accountId))
    .where(eq(s.tischAnfrage.tischId, tableId))
    .orderBy(asc(s.tischAnfrage.erstellt));
}

/**
 * Der Gastgeber entscheidet. Angenommen setzt den Anfragenden auf den
 * naechsten freien Platz (`joinTable`, mit allen Pruefungen dort); ist der
 * Tisch inzwischen voll oder gestartet, scheitert das mit genau diesem Fehler,
 * und die Anfrage ist trotzdem erledigt — sie liesse sich nie mehr erfuellen.
 */
export async function entscheide(
  db: Db,
  tableId: string,
  gastgeber: string,
  accountId: string,
  annehmen: boolean,
): Promise<void> {
  const { seats } = await tableWithSeats(db, tableId);
  if (gastgeberVon(seats) !== gastgeber) throw forbidden('notHost');
  const geloescht = await db
    .delete(s.tischAnfrage)
    .where(and(eq(s.tischAnfrage.tischId, tableId), eq(s.tischAnfrage.accountId, accountId)))
    .returning();
  if (geloescht.length === 0) throw notFound('anfrageUnbekannt');
  if (annehmen) await joinTable(db, tableId, accountId);
}

/**
 * Was aus der eigenen Anfrage wurde. `offen` solange die Zeile steht,
 * `angenommen` sobald man sitzt, sonst `abgelehnt` — abgelehnt, zurueckgezogen
 * und verfallen sehen von aussen gleich aus, und mehr braucht der Wartende
 * nicht zu wissen.
 */
export async function anfrageStand(
  db: Db,
  tableId: string,
  accountId: string,
): Promise<'offen' | 'angenommen' | 'abgelehnt'> {
  const { seats } = await tableWithSeats(db, tableId);
  if (seats.some((seat) => seat.accountId === accountId)) return 'angenommen';
  const [zeile] = await db
    .select({ accountId: s.tischAnfrage.accountId })
    .from(s.tischAnfrage)
    .where(and(eq(s.tischAnfrage.tischId, tableId), eq(s.tischAnfrage.accountId, accountId)));
  return zeile ? 'offen' : 'abgelehnt';
}
