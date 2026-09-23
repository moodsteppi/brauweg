/**
 * Die Adressen, auf die Mails und die Aufsicht zeigen.
 *
 * - `/verify?token=…` — Bestaetigungslink aus der Registrierungsmail
 * - `/reset?token=…`  — Link aus "Passwort vergessen"
 * - `/aufsicht/mail`  — Mail-Diagnose fuer Testkonten (docs/MAIL.md)
 *
 * Eigenes kleines Modul, weil App.tsx es vor dem ersten Bild liest: Kaeme es
 * aus dem Schirm `KontoLink.tsx`, zoege diese eine Funktion den Schirm ins
 * Hauptpaket (siehe App.pakete.test.ts).
 *
 * Bis zum 23.09.2026 las nur der Anmeldeschirm `?token=` — und zwar auf
 * JEDEM Pfad als Bestaetigungstoken. Der Reset-Link lief damit in "Link
 * abgelaufen", und wer angemeldet war (ein Gast, der eben sein Konto
 * gesichert hat), sah die Spielauswahl und der Link tat gar nichts.
 */

export type KontoLinkArt = 'verify' | 'reset' | 'mailprobe';

export interface KontoLinkZiel {
  readonly art: KontoLinkArt;
  /** Leer bei der Diagnose. */
  readonly token: string;
}

export function leseKontoLink(
  ort: Pick<Location, 'pathname' | 'search'> = window.location,
): KontoLinkZiel | null {
  const pfad = ort.pathname.replace(/\/+$/, '') || '/';
  if (pfad === '/aufsicht/mail') return { art: 'mailprobe', token: '' };
  if (pfad !== '/verify' && pfad !== '/reset') return null;
  const token = new URLSearchParams(ort.search).get('token')?.trim() ?? '';
  return { art: pfad === '/verify' ? 'verify' : 'reset', token };
}

/**
 * Token aus der Adresszeile nehmen: Es gehoert nicht in den Verlauf und nicht
 * in ein Lesezeichen. Erst NACH dem Lesen aufrufen.
 */
export function kontoLinkAufraeumen(): void {
  window.history.replaceState(null, '', '/');
}
