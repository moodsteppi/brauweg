/**
 * Kartenmanufaktur — die Endpunkte (manufaktur/dienst.ts).
 *
 *   GET  /api/manufaktur          bis jetzt nachrechnen, Stand, Offline-Meldung
 *   POST /api/manufaktur/aktion   { typ, ziel?, menge?, id? } — arbeiten, ausbauen,
 *                                 einstellen, zuweisen, verkaufen, faehigkeit, boost,
 *                                 freischalten, umziehen, renovieren, wechseln, buch
 *
 * Massgeblich gerechnet wird hier; der Bildschirm rechnet mit demselben Kern
 * (@brauweg/manufaktur-kern) weiter, bis die naechste Antwort kommt.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { MAX_PRESSEN } from '@brauweg/manufaktur-kern';

import type { Db } from '../db/types.js';
import { manufakturAktion, manufakturHeute } from '../manufaktur/dienst.js';
import { zaehle } from '../statistik.js';

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
  z.object({ typ: z.literal('einstellen'), ziel }),
  z.object({ typ: z.literal('zuweisen'), ziel, id: z.number().int().positive() }),
  z.object({ typ: z.literal('verkaufen'), ziel, id: z.number().int().positive() }),
  z.object({ typ: z.literal('buch'), eintrag: z.enum(['nachtschicht', 'ruf', 'erfahrene', 'pausen', 'feilschen', 'bewerber', 'bautrupps', 'lager']) }),
  z.object({ typ: z.literal('faehigkeit'), ziel }),
  z.object({ typ: z.literal('boost') }),
  z.object({ typ: z.literal('freischalten') }),
  z.object({ typ: z.literal('umziehen') }),
  z.object({ typ: z.literal('jubilaeum') }),
  z.object({ typ: z.literal('renovieren') }),
  z.object({ typ: z.literal('bauen') }),
  z.object({ typ: z.literal('ziel') }),
  z.object({ typ: z.literal('auftrag-annehmen'), art: z.enum(['laden', 'gilde', 'hof']) }),
  z.object({ typ: z.literal('auftrag-abholen') }),
  z.object({ typ: z.literal('ausbilden'), ziel, id: z.number().int().positive() }),
  z.object({ typ: z.literal('wechseln'), nach: z.number().int().min(1).max(5) }),
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
      const geprueft = aktion.parse(request.body ?? {});
      const antwort = await manufakturAktion(deps.db, accountId, geprueft, new Date(), bei);
      // `typ` ist eines der Literale oben, also ein festes Verzeichnis (statistik.ts).
      zaehle('manufaktur_aktion', { modus: geprueft.typ });
      return reply.send(antwort);
    },
  );
}
