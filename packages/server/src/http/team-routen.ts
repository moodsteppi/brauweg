/**
 * Team-Schnittstelle fuers brotool (Tab „Spielen", 27.10.2026) und das
 * Einloesen der Muenz-Codes.
 *
 *   GET  /api/team/statistik           Tagessummen + Bestandszahlen   (Schluessel)
 *   GET  /api/team/codes               die letzten Codes mit Stand    (Schluessel)
 *   POST /api/team/codes               Einmal-Codes erzeugen          (Schluessel)
 *   POST /api/team/codes/:id/sperren   einen offenen Code sperren     (Schluessel)
 *   POST /api/me/code                  einen Code einloesen           (Konto, nur Webseite)
 *
 * Die Team-Routen ruft der bro-server, kein Mensch im Browser: Schluessel
 * `TEAM_SCHLUESSEL` in `x-team-schluessel`, wie `x-herkunft-schluessel` bei
 * der Werbelink-Auswertung (herkunft-routen.ts). Nicht in `authorization`,
 * dort sucht der Server ein Sitzungstoken. Ohne gesetzten Schluessel sind sie
 * zu — und antworten 404, damit niemand an der Antwort erkennt, dass es sie gibt.
 *
 * Wer die Codes erzeugen darf (nur Admins), entscheidet der bro-server; hier
 * gilt der Schluessel.
 */

import { timingSafeEqual } from 'node:crypto';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Db } from '../db/types.js';
import { forbidden, notFound } from '../errors.js';
import { erzeugeCodes, listeCodes, loeseCodeEin, MAX_ANZAHL, MAX_MUENZEN, sperreCode } from '../muenzcodes.js';
import { teamStatistik } from '../team-statistik.js';

type Grenze = { max: number; timeWindow: string };

export interface TeamRoutenDeps {
  readonly db: Db;
  /** `TEAM_SCHLUESSEL`; ohne ihn sind die Team-Routen zu. */
  readonly schluessel: string | null;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly istApp: (origin: string | undefined) => boolean;
  readonly limitAllgemein: Grenze;
}

/**
 * Wer Codes durchprobiert, soll dafuer Jahre brauchen. Zehn Versuche je
 * Viertelstunde reichen jedem, der sich vertippt.
 */
const LIMIT_EINLOESEN = { max: 10, timeWindow: '15 minutes' };

const TAG = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function schluesselPasst(erwartet: string | null, request: FastifyRequest): boolean {
  const roh = request.headers['x-team-schluessel'];
  const gereicht = Array.isArray(roh) ? roh[0] : roh;
  if (!erwartet || !gereicht) return false;
  const a = Buffer.from(gereicht);
  const b = Buffer.from(erwartet);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function teamRouten(app: FastifyInstance, deps: TeamRoutenDeps): void {
  const nurTeam = async (request: FastifyRequest): Promise<void> => {
    if (!schluesselPasst(deps.schluessel, request)) throw notFound('notFound');
  };

  app.get('/api/team/statistik', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await nurTeam(request);
    const bereich = z.object({ von: TAG.optional(), bis: TAG.optional() }).parse(request.query);
    void reply.header('cache-control', 'no-store');
    return reply.send(await teamStatistik(deps.db, bereich));
  });

  app.get('/api/team/codes', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await nurTeam(request);
    const { grenze } = z.object({ grenze: z.coerce.number().int().min(1).max(1000).optional() }).parse(request.query);
    void reply.header('cache-control', 'no-store');
    return reply.send({ codes: await listeCodes(deps.db, grenze) });
  });

  app.post('/api/team/codes', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await nurTeam(request);
    const auftrag = z
      .object({
        anzahl: z.number().int().min(1).max(MAX_ANZAHL),
        muenzen: z.number().int().min(1).max(MAX_MUENZEN),
        notiz: z.string().max(200).optional(),
        gueltigBis: z.string().datetime({ offset: true }).optional(),
      })
      .parse(request.body);
    const codes = await erzeugeCodes(deps.db, {
      ...auftrag,
      gueltigBis: auftrag.gueltigBis ? new Date(auftrag.gueltigBis) : null,
    });
    return reply.code(201).send({ codes });
  });

  app.post('/api/team/codes/:id/sperren', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await nurTeam(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await sperreCode(deps.db, id);
    return reply.send({ ok: true });
  });

  app.post('/api/me/code', { config: { rateLimit: LIMIT_EINLOESEN } }, async (request, reply) => {
    // Apple 3.1.1: keine eigenen Freischalt-Codes in der App (muenzcodes.ts).
    if (deps.istApp(request.headers.origin)) throw forbidden('codeNurImWeb');
    const accountId = await deps.requireAccount(request);
    const { code } = z.object({ code: z.string().min(1).max(40) }).parse(request.body);
    return reply.send({ ok: true, ...(await loeseCodeEin(deps.db, accountId, code)) });
  });
}
