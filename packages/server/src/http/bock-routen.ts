/**
 * BroweG-Bock — die Endpunkte (Dienst: src/bock/dienst.ts).
 *
 *   GET  /api/bock/aktiv              der Bock, in dem man gerade steckt
 *   GET  /api/bock/rangliste          Bock-Trophaeen (account_game_stat `mehrkampf`)
 *   POST /api/bock                    mit Freunden: Bock aufmachen (Gastgeber)
 *   POST /api/bock/code/:code         per Code beitreten
 *   GET  /api/bock/:id                Stand — im Takt abgefragt, zugleich Lebenszeichen
 *   PUT  /api/bock/:id/plan           Gastgeber: Stationen (2–5, Spiel oder null)
 *   POST /api/bock/:id/start          Gastgeber: los
 *   POST /api/bock/:id/verlassen      gehen (Lobby straffrei, sonst Letzter)
 *   POST /api/bock/suche              Suche betreten
 *   GET  /api/bock/suche              Suche abfragen (im Sekundentakt)
 *   POST /api/bock/suche/abbrechen    Suche abbrechen
 *
 * Alle Wege haengen am Umfang `mehrkampf` (src/umfang.ts): Was nicht in der
 * Ausgabe steht, gibt es nicht — dieselbe Antwort wie bei einem gesperrten
 * Spiel, damit der Client nichts Neues lernen muss.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { GameId } from '@brauweg/game-api';

import { BOCK_KENNUNG, BockDienst } from '../bock/dienst.js';
import type { Db } from '../db/types.js';
import { notFound } from '../errors.js';
import { registry, type Plattform } from '../games/registry.js';
import { rankingForGame } from '../rankings/service.js';
import type { PartyRuntime } from '../runtime/party.js';
import type { Vermittlung } from '../suche/vermittlung.js';
import { imUmfang, type Umfang } from '../umfang.js';

type Grenze = { max: number; timeWindow: string };

export interface BockRoutenDeps {
  readonly db: Db;
  readonly runtime: PartyRuntime;
  /** Fehlt er, baut die Route ihn selbst — so braucht `index.ts` keine Zeile. */
  readonly bock?: BockDienst;
  readonly vermittlung?: Vermittlung;
  readonly umfang: Umfang;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly plattform: (request: FastifyRequest) => Plattform;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

const kennung = z.object({ id: z.string().uuid() });
/** Ob die Kennung eine Station sein kann, prueft der Dienst; hier nur die Form. */
const planSchema = z.object({
  plan: z
    .array(z.enum(registry.all().map((meta) => meta.id) as [GameId, ...GameId[]]).nullable())
    .min(1)
    .max(8),
});

export function bockRouten(app: FastifyInstance, deps: BockRoutenDeps): BockDienst {
  const bock = deps.bock ?? new BockDienst(deps.db, deps.runtime, { umfang: deps.umfang });
  app.addHook('onClose', async () => bock.shutdown());

  /** Konto UND Umfang — in dieser Reihenfolge, wie an den Tischrouten. */
  const konto = async (request: FastifyRequest): Promise<string> => {
    const kontoId = await deps.requireAccount(request);
    if (!imUmfang(deps.umfang, BOCK_KENNUNG)) throw notFound('gameNotPlayable');
    return kontoId;
  };

  app.get('/api/bock/aktiv', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const kontoId = await konto(request);
    return reply.send({ bockId: await bock.aktiv(kontoId) });
  });

  app.get('/api/bock/rangliste', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await konto(request);
    const query = z
      .object({ limit: z.coerce.number().int().optional(), offset: z.coerce.number().int().optional() })
      .parse(request.query);
    return reply.send(await rankingForGame(deps.db, BOCK_KENNUNG, query.limit, query.offset));
  });

  app.post('/api/bock', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    // Wer einen Bock aufmacht, sucht keinen Tisch mehr (wie beim Tischbau).
    deps.vermittlung?.verlaesstAlle(kontoId);
    return reply.status(201).send(await bock.erstellen(kontoId, deps.plattform(request)));
  });

  app.post('/api/bock/code/:code', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    const { code } = z.object({ code: z.string().min(1).max(24) }).parse(request.params);
    deps.vermittlung?.verlaesstAlle(kontoId);
    return reply.send(await bock.beitreten(code, kontoId, deps.plattform(request)));
  });

  // Vor `/api/bock/:id`, damit „suche" nicht als Kennung durchgeht — die
  // uuid-Pruefung finge es ab, aber erst nach einer verwirrenden 400.
  app.post('/api/bock/suche', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    deps.vermittlung?.verlaesstAlle(kontoId);
    return reply.send(await bock.sucheBetreten(kontoId, deps.plattform(request)));
  });

  /** Im Sekundentakt — daher die Grenze des Lesens, nicht die des Schreibens. */
  app.get('/api/bock/suche', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const kontoId = await konto(request);
    return reply.send(await bock.sucheAbruf(kontoId));
  });

  app.post('/api/bock/suche/abbrechen', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    bock.sucheAbbrechen(kontoId);
    return reply.send({ ok: true });
  });

  /** Im Takt abgefragt (Lobby, Zwischenstand, Band am Tisch). */
  app.get('/api/bock/:id', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const kontoId = await konto(request);
    const { id } = kennung.parse(request.params);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send(await bock.abruf(id, kontoId));
  });

  app.put('/api/bock/:id/plan', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    const { id } = kennung.parse(request.params);
    const { plan } = planSchema.parse(request.body ?? {});
    return reply.send(await bock.planSetzen(id, kontoId, plan));
  });

  app.post('/api/bock/:id/start', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    const { id } = kennung.parse(request.params);
    return reply.send(await bock.starten(id, kontoId));
  });

  app.post('/api/bock/:id/verlassen', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const kontoId = await konto(request);
    const { id } = kennung.parse(request.params);
    await bock.verlassen(id, kontoId);
    return reply.send({ ok: true });
  });

  return bock;
}
