/**
 * Kartenmanufaktur — die Endpunkte (manufaktur/dienst.ts).
 *
 *   GET  /api/manufaktur          bis jetzt nachrechnen, Stand, Offline-Meldung
 *   POST /api/manufaktur/aktion   { typ, ziel?, menge? } — arbeiten, ausbauen,
 *                                 meister, faehigkeit, boost, freischalten, umziehen
 *
 * Massgeblich gerechnet wird hier; der Bildschirm rechnet mit demselben Kern
 * (@brauweg/manufaktur-kern) weiter, bis die naechste Antwort kommt.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { MAX_PRESSEN } from '@brauweg/manufaktur-kern';

import type { Db } from '../db/types.js';
import { manufakturAktion, manufakturHeute } from '../manufaktur/dienst.js';

type Grenze = { max: number; timeWindow: string };

export interface ManufakturRoutenDeps {
  readonly db: Db;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

const ziel = z.discriminatedUnion('art', [
  z.object({ art: z.literal('presse'), index: z.number().int().min(0).max(MAX_PRESSEN - 1) }),
  z.object({ art: z.literal('paternoster') }),
  z.object({ art: z.literal('versand') }),
]);

const menge = z.union([z.literal(1), z.literal(10), z.literal(50), z.literal('max')]);

const aktion = z.discriminatedUnion('typ', [
  z.object({ typ: z.literal('arbeiten'), ziel }),
  z.object({ typ: z.literal('ausbauen'), ziel, menge }),
  z.object({ typ: z.literal('meister'), ziel }),
  z.object({ typ: z.literal('faehigkeit'), ziel }),
  z.object({ typ: z.literal('boost') }),
  z.object({ typ: z.literal('freischalten') }),
  z.object({ typ: z.literal('umziehen') }),
  z.object({ typ: z.literal('jubilaeum') }),
]);

export function manufakturRouten(app: FastifyInstance, deps: ManufakturRoutenDeps): void {
  app.get('/api/manufaktur', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send(await manufakturHeute(deps.db, accountId));
  });

  // Eigene, grosszuegige Grenze: Ohne Meister ist jeder Zyklus ein Tipp, und
  // ausbauen tippt man gern zehnmal hintereinander.
  app.post(
    '/api/manufaktur/aktion',
    { config: { rateLimit: { max: 240, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const accountId = await deps.requireAccount(request);
      // `bei`: wann getippt wurde — der Dienst nimmt es nur mit kleiner Nachsicht an.
      const bei = z.object({ bei: z.number().finite().optional() }).parse(request.body ?? {}).bei;
      return reply.send(await manufakturAktion(deps.db, accountId, aktion.parse(request.body ?? {}), new Date(), bei));
    },
  );
}
