import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/types.js';
import { tanksStartSchema, tanksStart, tanksErgebnis, tanksVerlauf } from '../brotanks.js';
export function tanksRouten(app:FastifyInstance,deps:{db:Db;requireAccount(r:FastifyRequest):Promise<string>;limitSchreiben:{max:number;timeWindow:string};limitAllgemein:{max:number;timeWindow:string}}):void {
  app.get('/api/brotanks',{config:{rateLimit:deps.limitAllgemein}},async r=>tanksVerlauf(deps.db,await deps.requireAccount(r)));
  app.post('/api/brotanks/start',{config:{rateLimit:deps.limitSchreiben}},async r=>tanksStart(deps.db,await deps.requireAccount(r),r.body));
  app.post('/api/brotanks/ergebnis',{config:{rateLimit:deps.limitSchreiben}},async r=>{const konto=await deps.requireAccount(r),b=z.object({partie:tanksStartSchema.shape.partie,ergebnis:z.unknown()}).parse(r.body);return tanksErgebnis(deps.db,konto,b.partie,b.ergebnis);});
}
