/**
 * Push in der App: Token an den Server, einmal freundlich fragen.
 *
 * Alles hier laeuft nur in der Huelle. `PushBegleiter` (die einzige
 * Einhaengestelle in App.tsx) wird auf der Webseite gar nicht erst geladen.
 */

import { pushApi } from '../api';
import { abgelegtesToken, beiPushToken, bitteUmErlaubnis, kannPush, type PushToken } from './bruecke';

/**
 * Ob schon gefragt wurde — je Geraet, nicht je Konto: Die Systemabfrage gibt
 * es auf einem Telefon genau einmal, und wer "Lieber nicht" getippt hat, soll
 * nicht nach jedem Kontowechsel wieder gefragt werden. In den Einstellungen
 * kann man es jederzeit nachholen.
 */
const GEFRAGT_SCHLUESSEL = 'brauweg.push.gefragt';

/**
 * Das Ereignis, mit dem useTable meldet: "Wir sitzen an einem Tisch."
 *
 * Erst dort wird gefragt, nicht beim Start. Apple lehnt Apps ab, die sofort
 * nach dem Oeffnen Mitteilungen verlangen, und wer noch nie an einem Tisch
 * sass, weiss nicht, wofuer er Ja sagen soll. Am Tisch ist die Antwort
 * offensichtlich: "Sag mir Bescheid, wenn ich dran bin."
 */
export const TISCH_EREIGNIS = 'brauweg:tisch';

export function schonGefragt(): boolean {
  try {
    return localStorage.getItem(GEFRAGT_SCHLUESSEL) !== null;
  } catch {
    return true;
  }
}

export function merkeGefragt(antwort: 'ja' | 'nein'): void {
  try {
    localStorage.setItem(GEFRAGT_SCHLUESSEL, antwort);
  } catch {
    /* ohne Speicher fragen wir eben beim naechsten Start noch einmal */
  }
}

/** Soll die freundliche Frage jetzt erscheinen? */
export function sollFragen(): boolean {
  return kannPush() && !schonGefragt();
}

/** "Ja" in der freundlichen Frage oder in den Einstellungen. */
export function erlauben(): boolean {
  merkeGefragt('ja');
  return bitteUmErlaubnis();
}

/**
 * Meldet jedes Token der Huelle an den Server, solange das Konto angemeldet
 * ist. Liefert die Abmeldung.
 *
 * Dasselbe Token geht je Konto einmal pro Start hinaus — das genuegt, damit
 * der Server `zuletzt_gesehen` pflegt und ein Kontowechsel das Geraet
 * mitnimmt. Scheitert der Aufruf (Netz weg), versucht es das naechste
 * Ereignis oder der naechste Start wieder.
 */
export function melde(kontoId: string, beiGemeldet?: (token: PushToken) => void): () => void {
  let zuletzt: string | null = null;
  const senden = (token: PushToken): void => {
    if (!token.token) return;
    const schluessel = `${kontoId}|${token.token}`;
    if (schluessel === zuletzt) return;
    zuletzt = schluessel;
    void pushApi
      .geraetAnmelden(token.plattform, token.token)
      .then(() => beiGemeldet?.(token))
      .catch(() => {
        zuletzt = null;
      });
  };
  const vorhanden = abgelegtesToken();
  if (vorhanden) senden(vorhanden);
  return beiPushToken(senden);
}
