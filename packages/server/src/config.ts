/**
 * Konfiguration aus der Umgebung.
 *
 * Bewusst streng: Fehlt in Produktion ein Geheimnis, faehrt der Server nicht
 * hoch. Ein Server, der mit einem Standardschluessel startet, ist schlimmer
 * als einer, der gar nicht startet.
 */

import { parseStaffEmails } from './staff.js';

export interface Config {
  readonly env: 'development' | 'test' | 'production';
  /**
   * Welche Ausgabe hier laeuft. Rein zur Kennzeichnung in der Oberflaeche —
   * Rechte haengen NICHT daran, sondern am Konto (siehe entitlements.ts).
   * Sonst waere ein falsch gesetzter Dienst gleichbedeutend mit einem
   * geschenkten Premium fuer alle.
   */
  readonly stage: 'production' | 'staging' | 'development';
  readonly port: number;
  readonly databaseUrl: string;
  /** Basis fuer Links in E-Mails, z.B. https://brauweg-spielen.de */
  readonly publicUrl: string;
  readonly cookieSecure: boolean;
  readonly sessionTtlDays: number;
  /** Absender und Schluessel des Versanddienstes. Fehlt er, wird protokolliert. */
  readonly resendApiKey: string | null;
  readonly mailFrom: string;
  /**
   * Adressen, die als Testkonto gelten (Komma-getrennt in STAFF_EMAILS).
   * Beim Start abgeglichen; wer heruntergenommen wird, verliert das Merkmal.
   */
  readonly staffEmails: readonly string[];
  /**
   * Schluessel fuer den Abruf der Feldherr-Mitschnitte
   * (docs/FELDHERR-DIAGNOSE.md). Ohne ihn geht der Abruf nur ueber ein
   * angemeldetes Testkonto — der uebliche Weg. Er ist der Ausweg fuer eine
   * Ausgabe ohne Testkonto und bewusst NICHT vorbelegt: Ein
   * Standardschluessel waere schlimmer als gar keiner.
   */
  readonly diagnoseSchluessel: string | null;
  /**
   * OAuth-Client-ID fuer "Mit Google anmelden" (GOOGLE_CLIENT_ID). Ohne sie
   * gibt es den Knopf nicht; E-Mail+Passwort geht immer.
   */
  readonly googleClientId: string | null;
  /**
   * Ziel-URL fuer das Feedback-Widget (nur Staging, siehe FeedbackWidget.tsx
   * im Client): `.../extern/issues` auf dem internen bro-server. Fehlt sie,
   * meldet der Feedback-Endpunkt einen Fehler statt still zu verwerfen — ein
   * abgeschicktes Feedback soll nie unbemerkt verschwinden.
   */
  readonly feedbackZielUrl: string | null;
  /** `Authorization: Bearer …` fuer obige URL, ein bromcp-Schluessel des bro-server. */
  readonly feedbackZielToken: string | null;
}

function required(name: string, fallbackInDev?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (fallbackInDev !== undefined && process.env.NODE_ENV !== 'production') {
    return fallbackInDev;
  }
  throw new Error(`${name} ist nicht gesetzt`);
}

export function loadConfig(): Config {
  const env = (process.env.NODE_ENV ?? 'development') as Config['env'];
  const publicUrl = required('PUBLIC_URL', 'http://localhost:5173');

  const stage = ((): Config['stage'] => {
    const gesetzt = process.env.STAGE;
    if (gesetzt === 'production' || gesetzt === 'staging' || gesetzt === 'development') {
      return gesetzt;
    }
    return env === 'production' ? 'production' : 'development';
  })();

  return {
    env,
    stage,
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    publicUrl,
    cookieSecure: publicUrl.startsWith('https://'),
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    mailFrom: process.env.MAIL_FROM ?? 'Brauweg <noreply@brauweg-spielen.de>',
    staffEmails: parseStaffEmails(process.env.STAFF_EMAILS),
    // Ein zu kurzer Schluessel ist schlimmer als keiner: Er sieht nach
    // Schutz aus und ist in Minuten durchprobiert. Dann lieber zu.
    diagnoseSchluessel:
      (process.env.DIAGNOSE_SCHLUESSEL ?? '').length >= 20
        ? (process.env.DIAGNOSE_SCHLUESSEL as string)
        : null,
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    feedbackZielUrl: process.env.FEEDBACK_ZIEL_URL ?? null,
    feedbackZielToken: process.env.FEEDBACK_ZIEL_TOKEN ?? null,
  };
}
