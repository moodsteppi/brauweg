/**
 * Einen Freund an den wartenden Tisch holen (Tom, 24.11.2026).
 *
 * Im Wartebereich steht neben „+ Bot" der Knopf „Freund einladen". Der Freund
 * bekommt eine Push-Mitteilung (Anlass `tischeinladung`, push/anlaesse.ts);
 * antippt er sie, oeffnet die App den Tisch und setzt ihn auf einen freien
 * Platz. Am Tisch steht danach, ob die Mitteilung rausging („wurde
 * benachrichtigt") oder ob der Freund kein Geraet mit der App hat.
 *
 * Nur Freunde, keine beliebigen Konten: Eine Mitteilung auf fremde Telefone
 * waere ein Spamweg, und die Freundesliste ist die Zusage, dass man sich
 * kennt.
 *
 * Die Einladung selbst merkt sich der Server nur im Speicher und nur eine
 * halbe Stunde — sie ist kein Datensatz, sondern eine Erlaubnis: Wer
 * eingeladen ist, kommt auch an einen privaten Tisch ohne Beitrittsanfrage
 * (`istEingeladen`, http/app.ts). Ein Neustart vergisst sie; dann bleibt
 * der gewoehnliche Weg ueber die Anfrage, und nichts ist kaputt.
 */

import type { Db } from '../db/types.js';
import { conflict, forbidden } from '../errors.js';
import { relationshipBetween } from '../social/service.js';
import { tableWithSeats } from './service.js';

/** So lange gilt eine Einladung als Erlaubnis zum direkten Beitritt. */
export const EINLADUNG_GILT_MS = 30 * 60_000;

export class TischEinladungen {
  /** tableId → (eingeladenes Konto → gilt bis). */
  private readonly offen = new Map<string, Map<string, number>>();

  constructor(private readonly jetzt: () => number = () => Date.now()) {}

  merke(tableId: string, gastId: string): void {
    this.raeume();
    const tisch = this.offen.get(tableId) ?? new Map<string, number>();
    tisch.set(gastId, this.jetzt() + EINLADUNG_GILT_MS);
    this.offen.set(tableId, tisch);
  }

  istEingeladen(tableId: string, gastId: string): boolean {
    const bis = this.offen.get(tableId)?.get(gastId);
    return bis !== undefined && bis > this.jetzt();
  }

  private raeume(): void {
    const jetzt = this.jetzt();
    for (const [tableId, tisch] of this.offen) {
      for (const [gast, bis] of tisch) if (bis <= jetzt) tisch.delete(gast);
      if (tisch.size === 0) this.offen.delete(tableId);
    }
  }
}

/**
 * Darf `einladerId` jetzt `gastId` an diesen Tisch einladen? Wirft, wenn
 * nicht; liefert sonst, was die Mitteilung braucht.
 */
export async function pruefeTischEinladung(
  db: Db,
  tableId: string,
  einladerId: string,
  gastId: string,
): Promise<{ gameId: string }> {
  const { table, seats } = await tableWithSeats(db, tableId);
  if (!seats.some((sitz) => sitz.accountId === einladerId)) throw forbidden('notSeated');
  if (table.status !== 'waiting') throw conflict('tableNotWaiting');
  if (seats.some((sitz) => sitz.accountId === gastId)) throw conflict('alreadySeated');
  if (!seats.some((sitz) => !sitz.accountId && !sitz.isBot)) throw conflict('tableFull');
  if ((await relationshipBetween(db, einladerId, gastId)) !== 'friends') throw forbidden('notFriends');
  return { gameId: table.gameId };
}
