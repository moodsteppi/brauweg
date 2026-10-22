/**
 * Kartenmanufaktur — die Endpunkte (manufaktur/dienst.ts).
 *
 *   GET  /api/manufaktur          bis jetzt nachrechnen, Ansicht, Offline-Meldung
 *   POST /api/manufaktur/aktion   { typ, ziel? } — ausbauen, meister, schicht,
 *                                 freischalten, umziehen
 *
 * Gerechnet wird nur hier; der Bildschirm zaehlt mit den gelieferten Raten
 * hoch, bis die naechste Antwort kommt.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Db } from '../db/types.js';
import { manufakturAktion, manufakturHeute } from '../manufaktur/dienst.js';
import { MAX_PRESSEN } from '../manufaktur/regeln.js';

type Grenze = { max: number; timeWindow: string };

export interface ManufakturRoutenDeps {
  readonly db: Db;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

const ziel = z.discriminatedUnion('art', [
  z.object({ art: z.literal('presse'), index: z.number().int().min(0).max(MAX_PRESSEN - 1) }),
  z.object({ art: z.literal('laufband') }),
  z.object({ art: z.literal('versand') }),
]);

const aktion = z.discriminatedUnion('typ', [
  z.object({ typ: z.literal('ausbauen'), ziel }),
  z.object({ typ: z.literal('meister'), ziel }),
  z.object({ typ: z.literal('schicht'), ziel }),
  z.object({ typ: z.literal('freischalten') }),
  z.object({ typ: z.literal('umziehen') }),
]);

export function manufakturRouten(app: FastifyInstance, deps: ManufakturRoutenDeps): void {
  app.get('/api/manufaktur', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send(await manufakturHeute(deps.db, accountId));
  });

  // Eigene, grosszuegige Grenze: Ausbauen tippt man gern zehnmal hintereinander.
  app.post(
    '/api/manufaktur/aktion',
    { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const accountId = await deps.requireAccount(request);
      return reply.send(await manufakturAktion(deps.db, accountId, aktion.parse(request.body ?? {})));
    },
  );
}
