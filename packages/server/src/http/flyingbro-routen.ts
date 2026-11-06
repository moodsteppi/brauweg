/**
 * Flying Bro — die Endpunkte (src/flyingbro.ts).
 *
 *   GET  /api/flyingbro            Stand: Sterne je Level, Meilen, Vorrat, Zierde,
 *                                  offene Muenzen, heutige Kappen, offener Start
 *   POST /api/flyingbro/start      { levelId, hilfsmittel[] } — Zeitstempel, Hilfsmittel abbuchen
 *   POST /api/flyingbro/ergebnis   { levelId, geschafft, punkte, verschossen, hilfsmittel? }
 *                                  — Sterne, Meilen, Hub-Muenzen in einem Aufruf
 *   POST /api/flyingbro/kauf       { id } — Hilfsmittel oder Zierde, nur mit Meilen
 *
 * Anders als Pro-Subway auch in der App: Flying Bro ist fuer Web und
 * TestFlight geplant (Spezifikation, „Einstieg im Hub und Umfang"). Gesperrt
 * wird nur ueber den Umfang (`flyingbro` in FUNKTION_ZU_ROUTE).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { Db } from '../db/types.js';
import { flyingbroErgebnis, flyingbroKauf, flyingbroStand, flyingbroStart } from '../flyingbro.js';
import { zaehle } from '../statistik.js';

type Grenze = { max: number; timeWindow: string };

export interface FlyingbroRoutenDeps {
  readonly db: Db;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

// Grob begrenzt, damit kein Riesenkoerper bis zum Kern kommt; die genaue
// Pruefung (gibt es das Level, ist es ein Hilfsmittel) macht der Dienst.
const levelId = z.string().min(1).max(16);
const hilfsmittel = z.array(z.string().max(32)).max(8);

const startKoerper = z.object({ levelId, hilfsmittel: hilfsmittel.default([]) });

const ergebnisKoerper = z.object({
  levelId,
  geschafft: z.boolean(),
  // Die echte Obergrenze sind die Hoechstpunkte des Levels (Kern); das hier
  // haelt nur Unsinn wie 1e300 vor der Tuer.
  punkte: z.number().int().min(0).max(10_000_000),
  verschossen: z.number().int().min(1).max(32),
  hilfsmittel: hilfsmittel.optional(),
});

const kaufKoerper = z.object({ id: z.string().min(1).max(64) });

export function flyingbroRouten(app: FastifyInstance, deps: FlyingbroRoutenDeps): void {
  app.get('/api/flyingbro', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send(await flyingbroStand(deps.db, accountId));
  });

  app.post('/api/flyingbro/start', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const body = startKoerper.parse(request.body ?? {});
    return reply.send(await flyingbroStart(deps.db, accountId, body));
  });

  app.post('/api/flyingbro/ergebnis', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const body = ergebnisKoerper.parse(request.body ?? {});
    const antwort = await flyingbroErgebnis(deps.db, accountId, body);
    // Erst nach Pruefung und Verbuchung; ohne Level und Punkte (statistik.ts).
    zaehle('flyingbro_versuch', { ergebnis: antwort.geschafft ? 'geschafft' : 'verloren' });
    return reply.send(antwort);
  });

  app.post('/api/flyingbro/kauf', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const { id } = kaufKoerper.parse(request.body ?? {});
    return reply.send(await flyingbroKauf(deps.db, accountId, id));
  });
}
