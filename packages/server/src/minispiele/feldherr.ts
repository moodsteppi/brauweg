/**
 * Feldherr — Belohnung fuer das Minispiel.
 *
 * Feldherr ist kein `GameModule`: Es laeuft in Echtzeit, und die
 * Spielmodul-Schnittstelle ist zugbasiert und ausdruecklich uhrlos. Der Server
 * rechnet die Partie deshalb nicht mit; er bekommt am Ende gemeldet, was
 * geschehen ist. Die Begruendung und die Wege zu einem echten Netzspiel stehen
 * in `docs/FELDHERR-PLAN.md`.
 *
 * Daraus folgt die wichtigste Regel dieser Datei: **Was hier ankommt, ist eine
 * Behauptung des Clients.** Ohne Deckel waere jede gemeldete Runde eine
 * Muenzquelle — jemand muss dafuer nicht einmal spielen, ein wiederholter
 * Aufruf genuegt. Deshalb:
 *
 *   1. Die Belohnung ist klein und haengt nicht an der Spieldauer.
 *   2. Es gibt einen Tagesdeckel je Konto.
 *   3. Eine Partie unter einer Minute zaehlt gar nicht — so kurz ist kein
 *      Gefecht, das gewonnen wurde.
 */

import type { Db } from './../db/types.js';
import { gutschreiben } from '../waehrung.js';
import { eq, sql } from 'drizzle-orm';
import * as s from '../db/schema.js';

/** Muenzen je Ausgang. Bewusst niedrig: ein Minispiel ist kein Broterwerb. */
const LOHN_SIEG = 3;
const LOHN_NIEDERLAGE = 1;

/** Erfahrung je Partie. Flach, damit lange Partien nicht mehr wert sind. */
const XP_SIEG = 12;
const XP_NIEDERLAGE = 6;

/** Hoechstens so viele Muenzen am Tag aus diesem Spiel. */
export const TAGESDECKEL = 20;

/** Kuerzer war kein Gefecht, sondern ein Aufruf. */
const MINDESTDAUER = 60;

export interface FeldherrErgebnis {
  readonly gewonnen: boolean;
  readonly gegenKI: boolean;
  readonly stufe: 'leicht' | 'normal' | 'schwer' | null;
  /** Spielzeit in Sekunden, wie sie die Uhr im Spiel zeigt. */
  readonly dauer: number;
}

export interface FeldherrLohn {
  readonly muenzen: number;
  readonly xp: number;
  readonly gedeckelt: boolean;
  readonly stand: number;
}

/**
 * Tagesstand je Konto, im Arbeitsspeicher.
 *
 * Absichtlich noch keine Tabelle: Feldherr hat keine `GameId`, und die
 * vorhandenen Zaehler haengen alle am Spiel-Enum — eine Zeile dort hiesse
 * Enum-Wert, Migration und einen Eintrag in der Registrierung, also die halbe
 * Aufnahme als vollwertiges Spiel. Solange das nicht entschieden ist
 * (siehe FELDHERR-PLAN.md, offene Frage 1), ist ein Neustart des Servers der
 * einzige Weg, den Deckel zurueckzusetzen. Das ist verschmerzbar: Der Deckel
 * schuetzt vor Dauerlauf, nicht vor einem geschickten Zeitpunkt.
 *
 * Sobald Feldherr eine Kennung bekommt, wandert das in `stat_counter` —
 * derselbe Zaehler, den die Kartentische schon benutzen.
 */
const heute = new Map<string, { tag: string; muenzen: number }>();

function berlinTag(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/** Sichtbar fuer Tests: setzt den Tagesstand zurueck. */
export function _tagesstandLeeren(): void {
  heute.clear();
}

export async function feldherrBelohnen(
  db: Db,
  accountId: string,
  ergebnis: FeldherrErgebnis,
): Promise<FeldherrLohn> {
  const zuKurz = ergebnis.dauer < MINDESTDAUER;
  const muenzenSoll = zuKurz ? 0 : ergebnis.gewonnen ? LOHN_SIEG : LOHN_NIEDERLAGE;
  const xp = zuKurz ? 0 : ergebnis.gewonnen ? XP_SIEG : XP_NIEDERLAGE;

  const tag = berlinTag();
  const stand = heute.get(accountId);
  const bisher = stand && stand.tag === tag ? stand.muenzen : 0;
  const rest = Math.max(0, TAGESDECKEL - bisher);
  const muenzen = Math.min(muenzenSoll, rest);

  // Testkonten bekommen ohnehin alles; ihr Stand soll durch Minispiele nicht
  // wandern, sonst sind die Zahlen in der Beta nicht mehr zu lesen. Gefragt
  // wird am Konto, wie ueberall sonst auch.
  const [konto] = await db
    .select({ staff: s.account.isStaff })
    .from(s.account)
    .where(eq(s.account.id, accountId));
  const staff = konto?.staff === true;

  if (muenzen > 0 && !staff) {
    await gutschreiben(db, accountId, 'coins', muenzen);
  }
  if (xp > 0 && !staff) {
    await db
      .update(s.account)
      .set({ xp: sql`${s.account.xp} + ${xp}` })
      .where(eq(s.account.id, accountId));
  }

  heute.set(accountId, { tag, muenzen: bisher + muenzen });

  return {
    muenzen,
    xp,
    gedeckelt: muenzenSoll > 0 && muenzen < muenzenSoll,
    stand: bisher + muenzen,
  };
}
