/**
 * Rechte eines Kontos.
 *
 * DIE EINZIGE STELLE, die beantwortet, was jemand darf. Heute ist noch alles
 * frei - genau deshalb steht sie schon: Sobald die erste Schranke kommt
 * (Werbung, gespeicherte Regelsaetze, Shop), fragt sie hier nach und nirgends
 * sonst. Verstreute `premiumUntil > now`-Vergleiche waeren der sichere Weg,
 * ein Testkonto irgendwo zu vergessen.
 *
 * Testkonten (`is_staff`) haben alles. Das haengt am Konto und nicht an der
 * Umgebung, weil es an beiden Orten gebraucht wird: auf staging fuer alle,
 * die dort ausprobieren, und in der Produktion fuer das Demokonto, das App
 * Store Connect verlangt.
 */

/**
 * Muenzstand eines Testkontos.
 *
 * Eine grosse, aber endliche Zahl statt `Infinity`: Sie geht durch JSON, durch
 * die Datenbank und durch jede Anzeige, ohne unterwegs zu NaN zu werden. Wer
 * Muenzen abzieht, fragt trotzdem vorher `unlimitedCoins` - der Stand soll
 * nicht langsam schrumpfen.
 */
export const STAFF_COINS = 9_999_999;

export interface Entitlements {
  /** Werbefrei, alle Statistiken, unbegrenzt gespeicherte Regelsaetze. */
  readonly premium: boolean;
  /** Muenzen werden nicht abgezogen. */
  readonly unlimitedCoins: boolean;
  /** Blaetter, Szenerien, Emotes, Namensdekoration gelten als besessen. */
  readonly ownsEverything: boolean;
  /** Testkonto - fuer die dezente Kennzeichnung in der Oberflaeche. */
  readonly staff: boolean;
}

export interface EntitlementInput {
  readonly premiumUntil: Date | string | null;
  readonly isStaff: boolean;
}

export function entitlementsFor(
  account: EntitlementInput,
  now: Date = new Date(),
): Entitlements {
  if (account.isStaff) {
    return { premium: true, unlimitedCoins: true, ownsEverything: true, staff: true };
  }

  const bis = account.premiumUntil ? new Date(account.premiumUntil) : null;
  const premium = bis !== null && bis.getTime() > now.getTime();

  return { premium, unlimitedCoins: false, ownsEverything: false, staff: false };
}

/** Muenzstand, wie ihn die Oberflaeche zeigen soll. */
export function coinsFor(account: EntitlementInput & { coins: number }): number {
  return account.isStaff ? STAFF_COINS : account.coins;
}
