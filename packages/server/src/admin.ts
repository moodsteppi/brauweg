/**
 * Broweg-Admins am Tisch (Tom, 24.11.2026).
 *
 * Die Gruender (Liste `ADMIN_EMAILS`, Adressen mit Komma getrennt — dieselbe
 * Form wie `STAFF_EMAILS`, staff.ts) koennen eine Einladung annehmen und
 * mitspielen, und sobald sie die App verlassen oder „Bot uebernimmt" tippen,
 * spielt fuer sie ein Bot auf hoechster Stufe weiter — ohne dass es am Tisch
 * zu sehen ist (`vertretungAn` in runtime/party.ts). Fuer die Mitspieler
 * sieht es aus, als spiele der Admin weiter.
 *
 * Bewusst eine eigene Liste und nicht `STAFF_EMAILS`: Dort steht in der
 * Produktion das Demokonto fuer die App-Store-Pruefung, und das soll nie
 * verdeckt von einem Bot vertreten werden.
 *
 * Ob es ueberhaupt greift, entscheidet `ADMIN_VERTRETUNG` (an/aus). Vorgabe
 * wie bei den Hausrunden: staging an, Produktion aus — die Produktion kommt,
 * sobald die iOS-App mit dem passenden Client ausgeliefert ist.
 *
 * Die Partie zaehlt normal (Rangliste, Trophaeen, auch fuer das Admin-Konto).
 */

import { eq } from 'drizzle-orm';

import type { Db } from './db/types.js';
import * as s from './db/schema.js';
import { parseStaffEmails } from './staff.js';

/** Vertretung an? Staging an, Produktion aus — per Umgebung umstellbar. */
export function adminVertretungAn(stage: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const wert = env.ADMIN_VERTRETUNG?.trim().toLowerCase();
  if (wert === 'an') return true;
  if (wert === 'aus') return false;
  return stage === 'staging';
}

/**
 * Prueft Konten gegen `ADMIN_EMAILS`. Je Konto einmal nachgeschlagen und
 * gemerkt: Gefragt wird bei jeder Verbindung, und die Adresse aendert sich
 * in der Laufzeit eines Servers praktisch nie.
 */
export class AdminListe {
  private readonly adressen: ReadonlySet<string>;
  private readonly gemerkt = new Map<string, boolean>();

  constructor(
    private readonly db: Db,
    roh: string | undefined | null,
  ) {
    this.adressen = new Set(parseStaffEmails(roh));
  }

  get leer(): boolean {
    return this.adressen.size === 0;
  }

  async istAdmin(accountId: string): Promise<boolean> {
    if (this.adressen.size === 0) return false;
    const bekannt = this.gemerkt.get(accountId);
    if (bekannt !== undefined) return bekannt;
    const [zeile] = await this.db
      .select({ email: s.account.email })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    const ja = !!zeile?.email && this.adressen.has(zeile.email.trim().toLowerCase());
    this.gemerkt.set(accountId, ja);
    return ja;
  }
}
