/**
 * Herkunft je Werbelink — die Endpunkte (src/herkunft.ts).
 *
 *   POST /api/herkunft/besuch      ein Aufruf mit `?q=`, ohne Anmeldung
 *   GET  /api/herkunft/auswertung  Summen je Kennung, NUR mit Schluessel
 *
 * Das Anlegen eines Gastkontos mit Kennung laeuft ueber `/api/auth/gast`
 * (Feld `herkunft`), weil das Konto dort entsteht.
 *
 * Die Auswertung liest der bro-server, kein Mensch im Browser — deshalb
 * gibt es dafuer keinen Weg ueber ein Testkonto wie bei der Diagnose, nur
 * den Schluessel `HERKUNFT_SCHLUESSEL` in `x-herkunft-schluessel`. Nicht in
 * `authorization`: Dort sucht der Server ein Sitzungstoken.
 */

import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Db } from '../db/types.js';
import { forbidden } from '../errors.js';
import { auswertung, besuchZaehlen, normalisiereKennung } from '../herkunft.js';

type Grenze = { max: number; timeWindow: string };

export interface HerkunftRoutenDeps {
  readonly db: Db;
  /** `HERKUNFT_SCHLUESSEL`; ohne ihn ist die Auswertung zu. */
  readonly schluessel: string | null;
  readonly limitAllgemein: Grenze;
}

/**
 * Ein Besuch je Seitenaufruf, und eine Party hinter einem WLAN ruft die Seite
 * vielleicht zwanzigmal auf. Mehr von derselben Adresse ist jemand, der die
 * Zahl hochtreibt — fuer den gibt es die Grenze, und nicht fuer die Party.
 */
const LIMIT_BESUCH = { max: 30, timeWindow: '15 minutes' };

const TAG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Zeitgleich verglichen, aus dem Grund von `requireAufsicht` in app.ts. */
function schluesselPasst(erwartet: string | null, request: FastifyRequest): boolean {
  const roh = request.headers['x-herkunft-schluessel'];
  const gereicht = Array.isArray(roh) ? roh[0] : roh;
  if (!erwartet || !gereicht) return false;
  const a = Buffer.from(gereicht);
  const b = Buffer.from(erwartet);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function herkunftRouten(app: FastifyInstance, deps: HerkunftRoutenDeps): void {
  /*
   * Immer `ok`, auch bei einer ungueltigen Kennung oder voller Tagesgrenze:
   * Der Client wertet die Antwort nicht aus, und wer probiert, soll nicht
   * erfahren, was gezaehlt wurde.
   */
  app.post('/api/herkunft/besuch', { config: { rateLimit: LIMIT_BESUCH } }, async (request, reply) => {
    const { kennung } = z.object({ kennung: z.string().max(100) }).parse(request.body);
    await besuchZaehlen(deps.db, kennung);
    return reply.send({ ok: true });
  });

  app.get('/api/herkunft/auswertung', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    if (!schluesselPasst(deps.schluessel, request)) throw forbidden('nurAufsicht');
    const filter = z
      .object({ von: TAG.optional(), bis: TAG.optional(), kennung: z.string().max(100).optional() })
      .parse(request.query);
    const kennung = filter.kennung === undefined ? undefined : normalisiereKennung(filter.kennung);
    // Eine ungueltige Kennung kann nie gezaehlt worden sein: leere Liste,
    // nicht stillschweigend alle.
    if (kennung === null) return reply.send({ kennungen: [] });
    const kennungen = await auswertung(deps.db, { von: filter.von, bis: filter.bis, kennung });
    return reply.send({ kennungen });
  });
}
