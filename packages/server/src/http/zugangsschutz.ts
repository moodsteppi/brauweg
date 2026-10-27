/**
 * Zugangsschutz fuer staging: Die Webseite fragt nach Name und Passwort
 * (HTTP Basic), bevor sie irgendetwas ausliefert.
 *
 * Warum (Tom, 27.10.2026): staging.brauweg-spielen.de war fuer jeden offen.
 * Dort laeuft, was noch nicht freigegeben ist — Spiele, die es in Produktion
 * nicht gibt, Testkonten, halbfertige Oberflaechen. Wer den Link bekam
 * (Werbeclips, Bildschirmaufnahmen, ein weitergeleiteter Einladungslink),
 * landete mittendrin.
 *
 * Eingeschaltet nur, wenn `STAGING_ZUGANG=name:passwort` gesetzt ist (Railway,
 * Umgebung staging). Ohne Variable aendert sich nichts — Produktion und jede
 * Entwicklungsfassung bleiben offen.
 *
 * Bewusst NICHT geschuetzt, weil dort kein Mensch mit Browser anklopft und
 * eine Passwortabfrage den Dienst bricht:
 *
 * - `/api/health` — Railways Gesundheitspruefung. Antwortet sie nicht mit 200,
 *   gilt der Deploy als gescheitert.
 * - `/.well-known/*` — Apple und Google holen die Verknuepfungsdateien
 *   (Universal Links, Domain-Nachweis) ohne Anmeldung.
 * - `/api/auth/apple/rueckweg` — dorthin schickt Apple im Notfall ein Formular.
 * - **Anfragen der App** (Herkunft `brauweg://app` bzw. die Android-Herkunft)
 *   und **Anfragen mit eigenem Schluessel** — Bearer (App nach der
 *   Anmeldung) oder eine `x-…-schluessel`-Kopfzeile (bro-server:
 *   `x-herkunft-schluessel`, `x-team-schluessel`, Diagnose): Die TestFlight-Fassung „Brauweg
 *   Test" spricht mit staging und kann keine Passwortabfrage beantworten. Die
 *   Route prueft das Token ohnehin selbst. Wer eine Herkunft faelscht, kommt
 *   damit an die API, nicht an die Webseite — und die API zeigt nichts, was
 *   nicht auch ohne Anmeldung lesbar waere.
 *
 * Basic statt eigener Anmeldeseite: Der Browser merkt sich die Angabe und
 * schickt sie bei jeder Anfrage derselben Adresse mit — auch bei `fetch` und
 * beim WebSocket. Eine eigene Seite braeuchte ein Cookie, und das teilte sich
 * den Platz mit der Sitzung.
 */

import { timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Pfade, die ohne Passwort erreichbar bleiben (siehe oben). */
const FREI: readonly RegExp[] = [/^\/api\/health$/, /^\/\.well-known\//, /^\/api\/auth\/apple\/rueckweg$/];

/** `name:passwort` aus der Umgebung; null bei fehlender oder unbrauchbarer Angabe. */
export function leseZugang(wert: string | undefined): string | null {
  const roh = wert?.trim();
  if (!roh) return null;
  const trenner = roh.indexOf(':');
  // Ohne Namen oder mit kurzem Passwort lieber laut aus als still schwach.
  if (trenner < 1 || roh.length - trenner - 1 < 8) {
    throw new Error('STAGING_ZUGANG muss "name:passwort" sein, Passwort mindestens 8 Zeichen.');
  }
  return roh;
}

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function frei(request: FastifyRequest, istApp: (origin: string | undefined) => boolean): boolean {
  const pfad = request.url.split('?')[0] ?? '';
  if (FREI.some((muster) => muster.test(pfad))) return true;
  if (istApp(request.headers.origin)) return true;
  // Die Route prueft den Schluessel selbst; hier zaehlt nur, dass einer da ist.
  if (Object.keys(request.headers).some((name) => /^x-[a-z]+-schluessel$/.test(name))) return true;
  return /^bearer\s+\S/i.test(request.headers.authorization ?? '');
}

/** `istApp` kommt von app.ts herein (istAppHerkunft) — ein Import von dort waere ein Kreis. */
export function zugangsschutz(
  app: FastifyInstance,
  zugang: string | null,
  istApp: (origin: string | undefined) => boolean,
): void {
  if (!zugang) return;
  const erwartet = `Basic ${Buffer.from(zugang).toString('base64')}`;
  app.addHook('onRequest', async (request, reply) => {
    if (frei(request, istApp)) return;
    if (gleich(request.headers.authorization ?? '', erwartet)) return;
    return reply
      .code(401)
      .header('www-authenticate', 'Basic realm="Brauweg staging", charset="UTF-8"')
      .header('cache-control', 'no-store')
      .type('text/plain; charset=utf-8')
      .send('Brauweg staging ist nur fuer das Team.');
  });
}
