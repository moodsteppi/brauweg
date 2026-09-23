/**
 * Push-Mitteilungen: Geraet anmelden, abmelden, Anlaesse ein- und ausschalten.
 *
 *   POST   /api/push/geraet          { plattform: 'ios'|'android', token }
 *   DELETE /api/push/geraet          { token }
 *   GET    /api/push/einstellungen   → { anlaesse: { dran, start, einladung }, geraete }
 *   PUT    /api/push/einstellungen   { dran?, start?, einladung? } → wie GET
 *
 * Die Registrierung haengt an der SITZUNG, nicht nur am Konto: Beim Abmelden
 * nimmt `logout` die Tokens dieser Sitzung mit (auth/service.ts), auch wenn
 * die App ihres vorher nicht mehr selbst abmelden konnte.
 *
 * Nicht auf die App-Herkunft beschraenkt: Ein Token nuetzt nur dem, der den
 * APNs-Schluessel bzw. das Firebase-Dienstkonto hat, und eine Sperre an der
 * Herkunft waere nur eine zweite Stelle, die beim naechsten Huellen-Umbau
 * (neue Herkunft) still bricht. Die Webseite ruft die Routen nie auf.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { SessionInfo } from '../auth/service.js';
import type { Db } from '../db/types.js';
import {
  leseEinstellungen,
  meldeGeraetAb,
  registriereGeraet,
  setzeEinstellungen,
  zaehleGeraete,
} from '../push/geraete.js';

type Grenze = { max: number; timeWindow: string };

export interface PushRoutenDeps {
  readonly db: Db;
  readonly requireSitzung: (request: FastifyRequest) => Promise<SessionInfo>;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

/**
 * Geraetetoken: APNs liefert 64 Hex-Zeichen, FCM rund 160 Zeichen aus
 * Buchstaben, Ziffern, `-`, `_` und `:`. Die Grenzen sind grosszuegig, die
 * Zeichenmenge nicht — ein Token geht als Pfadteil an Apple.
 */
const tokenSchema = z
  .string()
  .min(20)
  .max(4096)
  .regex(/^[A-Za-z0-9:_\-.]+$/);

export function pushRouten(app: FastifyInstance, deps: PushRoutenDeps): void {
  app.post('/api/push/geraet', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const sitzung = await deps.requireSitzung(request);
    const body = z
      .object({ plattform: z.enum(['ios', 'android']), token: tokenSchema })
      .parse(request.body);
    await registriereGeraet(deps.db, {
      accountId: sitzung.accountId,
      sitzungId: sitzung.sessionId,
      plattform: body.plattform,
      token: body.token,
    });
    return reply.send({ ok: true });
  });

  app.delete('/api/push/geraet', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const sitzung = await deps.requireSitzung(request);
    const body = z.object({ token: tokenSchema }).parse(request.body ?? {});
    const entfernt = await meldeGeraetAb(deps.db, sitzung.accountId, body.token);
    return reply.send({ ok: true, entfernt });
  });

  app.get('/api/push/einstellungen', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const { accountId } = await deps.requireSitzung(request);
    return reply.send({
      anlaesse: await leseEinstellungen(deps.db, accountId),
      geraete: await zaehleGeraete(deps.db, accountId),
    });
  });

  app.put('/api/push/einstellungen', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const { accountId } = await deps.requireSitzung(request);
    const body = z
      .object({
        dran: z.boolean().optional(),
        start: z.boolean().optional(),
        einladung: z.boolean().optional(),
      })
      .strict()
      .parse(request.body ?? {});
    return reply.send({
      anlaesse: await setzeEinstellungen(deps.db, accountId, body),
      geraete: await zaehleGeraete(deps.db, accountId),
    });
  });
}
