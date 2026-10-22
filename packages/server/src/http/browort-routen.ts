/**
 * Browort und Clanwort — die Endpunkte (browort/dienst.ts).
 *
 *   GET  /api/browort            heutige Runde, Serie, Zahlen
 *   POST /api/browort/versuch    { wort } → Farben; am Ende Loesung und Belohnung
 *   GET  /api/clanwort           heutiges Clanwort (loest beim ersten Aufruf aus)
 *   POST /api/clanwort/wahl      { wort } — nur das ausgeloste Mitglied
 *   POST /api/clanwort/versuch   { wort }
 *
 * Geraten wird auf dem Server, nicht im Geraet: Das Tageswort geht erst
 * hinaus, wenn die Runde fertig ist. Ein Wort, das es nicht gibt, kostet
 * keinen Versuch (`browortUnbekannt`).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  browortHeute,
  browortRaten,
  clanwortHeute,
  clanwortRaten,
  clanwortWaehlen,
} from '../browort/dienst.js';
import type { Db } from '../db/types.js';
import type { PushAnlaesse } from '../push/anlaesse.js';

type Grenze = { max: number; timeWindow: string };

export interface BrowortRoutenDeps {
  readonly db: Db;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly push?: PushAnlaesse;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

// Laenge und Zeichen prueft der Dienst; hier nur, dass es ein kurzer Text ist.
const eingabe = z.object({ wort: z.string().min(1).max(12) });

export function browortRouten(app: FastifyInstance, deps: BrowortRoutenDeps): void {
  const ausgelost = (waehlerId: string): void => deps.push?.clanwortWaehlen(waehlerId);

  app.get('/api/browort', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send(await browortHeute(deps.db, accountId));
  });

  app.post('/api/browort/versuch', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { wort } = eingabe.parse(request.body ?? {});
    return reply.send(await browortRaten(deps.db, accountId, wort));
  });

  app.get('/api/clanwort', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send({ clanwort: await clanwortHeute(deps.db, accountId, new Date(), ausgelost) });
  });

  app.post('/api/clanwort/wahl', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { wort } = eingabe.parse(request.body ?? {});
    return reply.send({ clanwort: await clanwortWaehlen(deps.db, accountId, wort) });
  });

  app.post('/api/clanwort/versuch', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { wort } = eingabe.parse(request.body ?? {});
    const { belohnung, ...clanwort } = await clanwortRaten(deps.db, accountId, wort);
    return reply.send({ clanwort, belohnung });
  });
}
