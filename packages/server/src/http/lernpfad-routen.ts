/**
 * Doppelkopf lernen — die Endpunkte des Lernpfads (lernpfad.ts).
 *
 *   GET  /api/lernpfad                    Pfad, erledigte Lektionen, Serie
 *   GET  /api/lernpfad/lektion/:id        die Schritte einer Lektion
 *   POST /api/lernpfad/lektion/:id/fertig Lektion geschafft → Spieltag
 *   POST /api/lernpfad/uebung             Uebungstisch gegen Bots aufmachen
 *
 * Die Lektion geht mit ihren richtigen Antworten hinaus. Das ist Absicht: Es
 * gibt dabei nichts zu gewinnen ausser der Serie, und eine Pruefung hin und
 * her ueber die Leitung machte jeden Tipp traege — gerade das, was sich wie
 * Duolingo anfuehlen soll. Ausgerechnet hat die Antworten trotzdem die
 * Engine, nicht der Client (game-doppelkopf/src/lernen.ts).
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { doppelkopf, lektionVon } from '@brauweg/game-doppelkopf';

import type { Db } from '../db/types.js';
import { notFound } from '../errors.js';
import { lektionAbschliessen, lernpfadVon } from '../lernpfad.js';
import { zaehle } from '../statistik.js';
import { createTable } from '../tables/service.js';

type Grenze = { max: number; timeWindow: string };

export interface LernpfadRoutenDeps {
  readonly db: Db;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly limitSchreiben: Grenze;
  readonly limitAllgemein: Grenze;
}

const kennung = z.object({ id: z.string().regex(/^[a-z][a-z-]{1,39}$/) });

export function lernpfadRouten(app: FastifyInstance, deps: LernpfadRoutenDeps): void {
  app.get('/api/lernpfad', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    return reply.send(await lernpfadVon(deps.db, accountId));
  });

  app.get('/api/lernpfad/lektion/:id', { config: { rateLimit: deps.limitAllgemein } }, async (request, reply) => {
    await deps.requireAccount(request);
    const { id } = kennung.parse(request.params);
    const lektion = lektionVon(id);
    if (!lektion) throw notFound('lektionUnbekannt');
    return reply.send(lektion);
  });

  app.post(
    '/api/lernpfad/lektion/:id/fertig',
    { config: { rateLimit: deps.limitSchreiben } },
    async (request, reply) => {
      const accountId = await deps.requireAccount(request);
      const { id } = kennung.parse(request.params);
      const spieltag = await lektionAbschliessen(deps.db, accountId, id);
      // Ohne die Lektion: Welche es war, ist eine Frage fuer Stufe 1 (statistik.ts).
      zaehle('lektion_fertig');
      return reply.send({ ...spieltag, pfad: await lernpfadVon(deps.db, accountId) });
    },
  );

  /**
   * Der Uebungstisch: vier Sitze, drei Bots der leichtesten Stufe, nicht in
   * der Lobby (`on_request`) und ohne Rangliste (`training`). Gespielt wird
   * EINE Runde — die Tischregel verlangt die volle Geberrotation, der Tisch
   * endet aber nach der ersten Abrechnung (`uebung`, runtime/party.ts).
   */
  app.post('/api/lernpfad/uebung', { config: { rateLimit: deps.limitSchreiben } }, async (request, reply) => {
    const accountId = await deps.requireAccount(request);
    const sitze = 4;
    const tisch = await createTable(deps.db, {
      accountId,
      gameId: 'doppelkopf',
      name: 'Übungsrunde',
      config: { ...doppelkopf.defaultConfig(), training: true },
      seats: sitze,
      rounds: doppelkopf.meta.rotationSize(sitze),
      visibility: 'on_request',
      fillWithBots: true,
      botLevel: 'anfaenger',
      uebung: true,
    });
    return reply.send({ tableId: tisch.id });
  });
}
