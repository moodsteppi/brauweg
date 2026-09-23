/**
 * Die Absprache mit der nativen Huelle ueber Push-Mitteilungen.
 *
 * Der Client fragt, die Huelle antwortet. Beides nur in der App — auf der
 * Webseite gibt es keine dieser Schnittstellen, und `kannPush()` ist dort
 * immer falsch. Der Vertrag stammt aus der Android-Huelle (PR #238,
 * apps/android/…/Huelle.kt und Bruecke.kt) und steht auch in docs/PUSH.md;
 * die iOS-Huelle haelt sich an denselben. Wer ihn hier aendert, aendert ihn
 * dort und in beiden Huellen.
 *
 * **Huelle → Client, vor der ersten Zeile (Vorspann):**
 *
 *   window.BRAUWEG_APP = { apiBase, plattform: 'ios' | 'android', push: boolean }
 *
 * `push` sagt, ob diese Huelle ueberhaupt Push kann. Android baut es nur mit
 * `-Ppush=an` ein; ohne das ist `push: false`, und der Client fragt NIE —
 * eine Frage, auf die nichts folgt, waere schlimmer als keine.
 *
 * **Client → Huelle: um Erlaubnis bitten.**
 *
 *   window.BrauwegNativ.pushErlauben()
 *
 * Android: `@JavascriptInterface` in Bruecke.kt, dieselbe Schnittstelle wie
 * `teilen` und `wachHalten`. iOS legt sich im Vorspann dasselbe Objekt an
 * und reicht an einen WKScriptMessageHandler weiter; als Rueckfall ruft der
 * Client `webkit.messageHandlers.pushErlauben.postMessage({})` direkt. Die
 * Huelle zeigt die Systemabfrage (iOS `requestAuthorization`, Android 13+
 * POST_NOTIFICATIONS), holt das Token und meldet es wie unten.
 *
 * **Huelle → Client: das Token.**
 *
 *   window.BRAUWEG_APP.pushToken = { plattform, token };
 *   window.dispatchEvent(new CustomEvent('brauweg:push-token', { detail: { plattform, token } }));
 *
 * Erst ablegen, dann ausloesen: Kommt das Token beim Start, bevor der Client
 * zuhoert, liest er es beim Einhaengen aus `pushToken`. Die Huelle meldet es
 * bei jedem Start und bei jedem neuen Token wieder, sobald Push an ist.
 */

export type PushPlattform = 'ios' | 'android';

export interface PushToken {
  readonly plattform: PushPlattform;
  /** null: abgelehnt oder (noch) nicht verfuegbar. */
  readonly token: string | null;
}

declare global {
  interface Window {
    /** Native Schnittstelle der Huelle (Android: Bruecke.kt; iOS: Vorspann). */
    BrauwegNativ?: {
      teilen?: (daten: string) => void;
      wachHalten?: (an: boolean) => void;
      pushErlauben?: () => void;
    };
    webkit?: {
      messageHandlers?: Record<string, { postMessage(nachricht: unknown): void } | undefined>;
    };
  }
}

/** Name des Ereignisses, mit dem die Huelle das Token meldet. */
export const PUSH_EREIGNIS = 'brauweg:push-token';

/** Prueft, was die Huelle meldet — sie ist eine Grenze wie das Netz. */
export function lesePushToken(wert: unknown): PushToken | null {
  if (typeof wert !== 'object' || wert === null) return null;
  const { plattform, token } = wert as { plattform?: unknown; token?: unknown };
  if (plattform !== 'ios' && plattform !== 'android') return null;
  if (token === null || token === undefined || token === '') return { plattform, token: null };
  if (typeof token !== 'string' || token.length > 4096) return null;
  return { plattform, token };
}

/**
 * Kann diese Huelle um Erlaubnis bitten?
 *
 * Beides muss stimmen: Die Huelle sagt `push: true`, UND es gibt einen Weg
 * zur Systemabfrage. Nur das eine hiesse, eine Frage zu stellen, auf die
 * nichts folgt.
 */
export function kannPush(): boolean {
  if (typeof window === 'undefined' || window.BRAUWEG_APP?.push !== true) return false;
  return (
    typeof window.BrauwegNativ?.pushErlauben === 'function' ||
    typeof window.webkit?.messageHandlers?.pushErlauben?.postMessage === 'function'
  );
}

/** Bittet die Huelle um die Systemabfrage. Falsch, wenn es keinen Weg gibt. */
export function bitteUmErlaubnis(): boolean {
  if (!kannPush()) return false;
  try {
    const nativ = window.BrauwegNativ;
    if (typeof nativ?.pushErlauben === 'function') {
      nativ.pushErlauben();
      return true;
    }
    window.webkit?.messageHandlers?.pushErlauben?.postMessage({});
    return true;
  } catch {
    return false;
  }
}

/** Was die Huelle zuletzt abgelegt hat. */
export function abgelegtesToken(): PushToken | null {
  if (typeof window === 'undefined') return null;
  return lesePushToken(window.BRAUWEG_APP?.pushToken);
}

/** Hoert auf gemeldete Tokens. Liefert die Abmeldung. */
export function beiPushToken(rueckruf: (token: PushToken) => void): () => void {
  const hoerer = (ereignis: Event): void => {
    const token = lesePushToken((ereignis as CustomEvent).detail ?? window.BRAUWEG_APP?.pushToken);
    if (token) rueckruf(token);
  };
  window.addEventListener(PUSH_EREIGNIS, hoerer);
  return () => window.removeEventListener(PUSH_EREIGNIS, hoerer);
}
