import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/types.js';
import { bauStartSchema, buildingStart, buildingErgebnis, buildingVerlauf } from '../building.js';
export function buildingRouten(app: FastifyInstance, deps: { db: Db; requireAccount(r: FastifyRequest): Promise<string>; limitSchreiben: { max: number; timeWindow: string }; limitAllgemein: { max: number; timeWindow: string } }): void {
  app.get('/api/building', { config: { rateLimit: deps.limitAllgemein } }, async r => buildingVerlauf(deps.db, await deps.requireAccount(r)));
  app.post('/api/building/start', { config: { rateLimit: deps.limitSchreiben } }, async r => buildingStart(deps.db, await deps.requireAccount(r), r.body));
  app.post('/api/building/ergebnis', { config: { rateLimit: deps.limitSchreiben } }, async r => {
    const konto = await deps.requireAccount(r), b = z.object({ partie: bauStartSchema.shape.partie, ergebnis: z.unknown() }).parse(r.body);
    return buildingErgebnis(deps.db, konto, b.partie, b.ergebnis);
  });
}
