/**
 * HTTP-Schnittstelle.
 *
 * Alles, was nicht am Tisch passiert: Konten, Spielauswahl, Regelsaetze,
 * Lobby. Der Tisch selbst laeuft ueber WebSocket, weil dort jeder Zug
 * unaufgefordert an alle muss.
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { GameId } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { AppError, RuleSetInvalidError, notFound, unauthorized } from '../errors.js';
import {
  type AuthDeps,
  anonymizeAccount,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
  sessionFromToken,
  verifyEmail,
} from '../auth/service.js';
import { isPlayable, registry, requireModule } from '../games/registry.js';
import {
  createTable,
  joinTable,
  leaveLobby,
  listRuleSets,
  listTables,
  saveRuleSet,
  tableWithSeats,
} from '../tables/service.js';
import type { PartyRuntime } from '../runtime/party.js';

export const SESSION_COOKIE = 'brauweg_session';

export interface AppDeps {
  readonly db: Db;
  readonly auth: AuthDeps;
  readonly runtime: PartyRuntime;
  readonly cookieSecure: boolean;
  readonly sessionTtlDays: number;
}

const gameIdSchema = z.enum(['doppelkopf', 'skat', 'schafkopf', 'romme', 'maumau']);

const registerSchema = z.object({
  email: z.string().email(),
  // Kurze Passwoerter sind das haeufigste Einfallstor. Zwoelf Zeichen ohne
  // Zeichenklassen-Zwang ist die heute empfohlene Vorgabe.
  password: z.string().min(12).max(200),
  displayName: z.string().min(2).max(30),
  inviteCode: z.string().min(1),
});

const createTableSchema = z.object({
  gameId: gameIdSchema,
  name: z.string().min(1).max(60).optional(),
  config: z.unknown(),
  seats: z.number().int().min(2).max(8),
  rounds: z.number().int().min(1).max(100),
  visibility: z.enum(['public', 'on_request', 'club_only']).optional(),
  fillWithBots: z.boolean().optional(),
});

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cookie);

  const setSession = (reply: FastifyReply, token: string): void => {
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: deps.cookieSecure,
      path: '/',
      maxAge: deps.sessionTtlDays * 24 * 3600,
    });
  };

  /** Wirft, wenn niemand angemeldet ist. */
  const requireAccount = async (request: FastifyRequest): Promise<string> => {
    const session = await sessionFromToken(deps.db, request.cookies[SESSION_COOKIE]);
    if (!session) throw unauthorized();
    return session.accountId;
  };

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof RuleSetInvalidError) {
      return reply
        .status(error.status)
        .send({ code: error.code, messageKey: error.messageKey, problems: error.problems });
    }
    if (error instanceof AppError) {
      return reply.status(error.status).send({ code: error.code, messageKey: error.messageKey });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send({ code: 'invalidInput', messageKey: 'error.invalidInput' });
    }
    app.log.error(error);
    return reply.status(500).send({ code: 'internal', messageKey: 'error.internal' });
  });

  // -------------------------------------------------------------------------
  // Konten
  // -------------------------------------------------------------------------

  app.post('/api/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    await register(deps.auth, body);
    // Bewusst ohne Sitzung: Erst bestaetigen, dann anmelden.
    return reply.status(201).send({ ok: true });
  });

  app.post('/api/auth/verify', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.body);
    const accountId = await verifyEmail(deps.db, token);
    return reply.send({ ok: true, accountId });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = z
      .object({ email: z.string().email(), password: z.string() })
      .parse(request.body);
    const { token, accountId } = await login(deps.auth, body.email, body.password);
    setSession(reply, token);
    return reply.send({ ok: true, accountId });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const session = await sessionFromToken(deps.db, request.cookies[SESSION_COOKIE]);
    if (session) await logout(deps.db, session.sessionId);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });

  app.post('/api/auth/reset-request', async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    await requestPasswordReset(deps.auth, email);
    // Immer dieselbe Antwort, damit sich registrierte Adressen nicht abfragen
    // lassen.
    return reply.send({ ok: true });
  });

  app.post('/api/auth/reset', async (request, reply) => {
    const body = z
      .object({ token: z.string(), password: z.string().min(12).max(200) })
      .parse(request.body);
    await resetPassword(deps.db, body.token, body.password);
    return reply.send({ ok: true });
  });

  app.get('/api/me', async (request, reply) => {
    const accountId = await requireAccount(request);
    const [account] = await deps.db
      .select({
        id: s.account.id,
        displayName: s.account.displayName,
        coins: s.account.coins,
        premiumUntil: s.account.premiumUntil,
      })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    if (!account) throw notFound('accountUnknown');

    const stats = await deps.db
      .select()
      .from(s.accountGameStat)
      .where(eq(s.accountGameStat.accountId, accountId));

    return reply.send({ ...account, stats });
  });

  /**
   * Kontoloeschung. Sie MUSS in der App funktionieren, und sie loescht keine
   * Zeilen, sondern anonymisiert: Sonst zerfielen die Partiehistorien aller
   * Mitspieler.
   */
  app.delete('/api/me', async (request, reply) => {
    const accountId = await requireAccount(request);

    // Waehrend laufender Partie gilt die Loeschung als Verlassen.
    const running = await deps.db
      .select({ tableId: s.tableSeat.tableId })
      .from(s.tableSeat)
      .innerJoin(s.gameTable, eq(s.gameTable.id, s.tableSeat.tableId))
      .where(and(eq(s.tableSeat.accountId, accountId), eq(s.gameTable.status, 'running')));
    for (const row of running) {
      await deps.runtime.markLeftByAccount(row.tableId, accountId);
    }

    await anonymizeAccount(deps.db, accountId);
    void reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Spielauswahl
  // -------------------------------------------------------------------------

  app.get('/api/games', async (_request, reply) => {
    const votes = await deps.db
      .select({ gameId: s.gameVote.gameId, count: sql<number>`count(*)::int` })
      .from(s.gameVote)
      .groupBy(s.gameVote.gameId);
    const countOf = new Map(votes.map((row) => [row.gameId, row.count]));

    return reply.send(
      registry.all().map((meta) => ({
        id: meta.id,
        nameKey: meta.nameKey,
        availability: meta.availability,
        seatCounts: meta.seatCounts,
        votes: countOf.get(meta.id) ?? 0,
      })),
    );
  });

  /** Vorschau-Spiele: Abstimmung, welches zuerst kommt. */
  app.post('/api/games/:gameId/vote', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    if (isPlayable(gameId)) {
      return reply.status(400).send({ code: 'alreadyPlayable', messageKey: 'error.alreadyPlayable' });
    }
    await deps.db.insert(s.gameVote).values({ accountId, gameId }).onConflictDoNothing();
    return reply.send({ ok: true });
  });

  /** Vorbelegung fuer den Regelsatz-Editor. Der Inhalt kommt aus dem Modul. */
  app.get('/api/games/:gameId/defaults', async (request, reply) => {
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    const module = requireModule(gameId as GameId);
    const seatCounts = module.meta.seatCounts;

    return reply.send({
      config: module.defaultConfig(),
      protocolVersion: module.protocolVersion,
      seatCounts,
      rounds: Object.fromEntries(
        seatCounts.map((seats) => [seats, module.meta.suggestedRounds(seats)]),
      ),
    });
  });

  // -------------------------------------------------------------------------
  // Regelsaetze
  // -------------------------------------------------------------------------

  app.get('/api/rulesets', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { game } = z.object({ game: gameIdSchema }).parse(request.query);
    return reply.send(await listRuleSets(deps.db, accountId, game));
  });

  app.post('/api/rulesets', async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = z
      .object({
        gameId: gameIdSchema,
        name: z.string().min(1).max(60),
        config: z.unknown(),
        seats: z.number().int(),
        rounds: z.number().int(),
        ruleSetId: z.string().uuid().optional(),
      })
      .parse(request.body);

    return reply.status(201).send(await saveRuleSet(deps.db, { accountId, ...body }));
  });

  // -------------------------------------------------------------------------
  // Lobby und Tische
  // -------------------------------------------------------------------------

  app.get('/api/tables', async (request, reply) => {
    const query = z
      .object({
        game: gameIdSchema,
        seats: z.coerce.number().int().optional(),
        rounds: z.coerce.number().int().optional(),
      })
      .parse(request.query);

    return reply.send(
      await listTables(deps.db, {
        gameId: query.game,
        seats: query.seats,
        rounds: query.rounds,
      }),
    );
  });

  app.post('/api/tables', async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = createTableSchema.parse(request.body);
    const table = await createTable(deps.db, { accountId, ...body });
    return reply.status(201).send(table);
  });

  app.get('/api/tables/:tableId', async (request, reply) => {
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    const { table, seats } = await tableWithSeats(deps.db, tableId);
    return reply.send({ table, seats });
  });

  app.post('/api/tables/:tableId/join', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await joinTable(deps.db, tableId, accountId);
    return reply.send({ ok: true });
  });

  /** Vor dem Start straffrei. Danach greift die Verlassen-Logik am Tisch. */
  app.post('/api/tables/:tableId/leave', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await leaveLobby(deps.db, tableId, accountId);
    return reply.send({ ok: true });
  });

  app.get('/api/health', async (_request, reply) => reply.send({ ok: true }));

  return app;
}
