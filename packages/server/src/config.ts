/**
 * Konfiguration aus der Umgebung.
 *
 * Bewusst streng: Fehlt in Produktion ein Geheimnis, faehrt der Server nicht
 * hoch. Ein Server, der mit einem Standardschluessel startet, ist schlimmer
 * als einer, der gar nicht startet.
 */

export interface Config {
  readonly env: 'development' | 'test' | 'production';
  readonly port: number;
  readonly databaseUrl: string;
  /** Basis fuer Links in E-Mails, z.B. https://brauweg-spielen.de */
  readonly publicUrl: string;
  readonly cookieSecure: boolean;
  readonly sessionTtlDays: number;
  /** Absender und Schluessel des Versanddienstes. Fehlt er, wird protokolliert. */
  readonly resendApiKey: string | null;
  readonly mailFrom: string;
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

  return {
    env,
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    publicUrl,
    cookieSecure: publicUrl.startsWith('https://'),
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    mailFrom: process.env.MAIL_FROM ?? 'Brauweg <noreply@brauweg-spielen.de>',
  };
}
