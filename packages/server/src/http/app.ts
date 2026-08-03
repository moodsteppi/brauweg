/**
 * HTTP-Schnittstelle.
 *
 * Alles, was nicht am Tisch passiert: Konten, Spielauswahl, Regelsaetze,
 * Lobby. Der Tisch selbst laeuft ueber WebSocket, weil dort jeder Zug
 * unaufgefordert an alle muss.
 */

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { and, eq, sql } from 'drizzle-orm';
import { ZodError, z } from 'zod';
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
  requestVerification,
  resetPassword,
  sessionFromToken,
  verifyEmail,
} from '../auth/service.js';
import { CARD_DECKS } from '../decks.js';
import { isPlayable, registry, requireModule } from '../games/registry.js';
import {
  acceptFriendship,
  listFriendships,
  playerProfile,
  removeFriendship,
  requestFriendship,
  searchPlayers,
} from '../social/service.js';
import { clubsFor } from '../clubs/service.js';
import { overallRanking, rankingForGame } from '../rankings/service.js';
import {
  activeTableFor,
  createTable,
  joinTable,
  leaveLobby,
  listRuleSets,
  listTables,
  saveRuleSet,
  tableRules,
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
  /** Verzeichnis des gebauten Clients. Fehlt es, liefert der Server nur die API. */
  readonly clientDir?: string;
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
  clubId: z.string().uuid().optional(),
  fillWithBots: z.boolean().optional(),
});

export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cookie);

  /**
   * Ein leerer Rumpf mit `content-type: application/json` ist fuer Fastify ein
   * Fehler. Fuer die Aufrufe ohne Daten - beitreten, verlassen, abmelden,
   * abstimmen - ist er aber das Naheliegende, und jeder Client schickt den
   * Kopf frueher oder spaeter versehentlich mit. Statt daran zu scheitern,
   * wird er als "keine Daten" gelesen; ob das reicht, entscheidet danach das
   * Schema der jeweiligen Route.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const text = (body as string).trim();
      if (text === '') return done(null, undefined);
      try {
        done(null, JSON.parse(text));
      } catch (err) {
        done(err as Error);
      }
    },
  );

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

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof RuleSetInvalidError) {
      return reply
        .status(error.status)
        .send({ code: error.code, messageKey: error.messageKey, problems: error.problems });
    }
    if (error instanceof AppError) {
      return reply.status(error.status).send({ code: error.code, messageKey: error.messageKey });
    }
    // Zod wirft einen ZodError, keinen Fastify-Validierungsfehler. Ohne diesen
    // Zweig wurde jede fehlerhafte Eingabe zu einem 500 mit "etwas ist
    // schiefgelaufen" - eine Meldung, die weder dem Benutzer noch dem
    // Betreiber sagt, was los ist.
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'invalidInput',
        messageKey: 'error.invalidInput',
        fields: error.issues.map((issue) => issue.path.join('.')),
      });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.status(400).send({ code: 'invalidInput', messageKey: 'error.invalidInput' });
    }

    // Fastify wirft eigene Fehler mit Statuscode - fehlerhaftes JSON, zu
    // grosser Rumpf, leerer Rumpf bei gesetztem content-type. Sie hier
    // durchfallen zu lassen machte aus einem 400 einen 500 samt "etwas ist
    // schiefgelaufen", was weder stimmte noch weiterhalf.
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply
        .status(status)
        .send({ code: 'invalidRequest', messageKey: 'error.invalidRequest' });
    }

    // Hierher kommt nur, was wirklich unerwartet ist. Es MUSS im Log landen,
    // sonst sucht man es spaeter vergeblich.
    // eslint-disable-next-line no-console
    console.error(`500 bei ${request.method} ${request.url}:`, error);
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

  /** Bestaetigungslink erneut anfordern. Antwortet immer gleich. */
  app.post('/api/auth/verification/resend', async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    await requestVerification(deps.auth, email);
    return reply.send({ ok: true });
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
        cardDeck: s.account.cardDeck,
        // Nur, OB ein Bild vorliegt — die Bytes gehen nie mit /api/me raus,
        // sondern nur ueber die eigene URL, die der Browser zwischenspeichert.
        hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
      })
      .from(s.account)
      .where(eq(s.account.id, accountId));
    if (!account) throw notFound('accountUnknown');

    const stats = await deps.db
      .select()
      .from(s.accountGameStat)
      .where(eq(s.accountGameStat.accountId, accountId));

    // Bestehende Konten (vor dem Vereins-Verdrahten) holen wir hier nach.
    const clubs = await clubsFor(deps.db, accountId);
    const activeTable = await activeTableFor(deps.db, accountId);

    const { hasAvatar, ...rest } = account;
    return reply.send({
      ...rest,
      avatarUrl: hasAvatar ? `/api/avatars/${account.id}` : null,
      stats,
      clubs,
      activeTable,
    });
  });

  /**
   * Profilbild eines Kontos. Oeffentlich, weil es genau dafuer da ist: die
   * Mitspieler am Tisch sollen es sehen. Gespeichert ist es als data-URL, hier
   * wird es in Bytes zurueckuebersetzt und kurz zwischengespeichert.
   */
  app.get('/api/avatars/:accountId', async (request, reply) => {
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    const [row] = await deps.db
      .select({ avatar: s.account.avatar })
      .from(s.account)
      .where(eq(s.account.id, accountId));

    const match = row?.avatar ? /^data:(image\/[a-z+]+);base64,(.+)$/.exec(row.avatar) : null;
    if (!match) throw notFound('avatarUnknown');

    return reply
      .header('content-type', match[1]!)
      .header('cache-control', 'public, max-age=120')
      .send(Buffer.from(match[2]!, 'base64'));
  });

  /**
   * Persoenliche Einstellungen. Bislang nur das Kartenblatt.
   *
   * Es gehoert an das Konto und nicht in den Browser: Wer am Rechner ein Blatt
   * waehlt, will es am Telefon nicht erneut suchen. Geprueft wird gegen eine
   * feste Liste — was der Server speichert, muss er auch benennen koennen.
   */
  app.patch('/api/me', async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = z
      .object({
        cardDeck: z.enum(CARD_DECKS).optional(),
        // Ein kleines, im Browser verkleinertes Quadrat als data-URL. Die
        // Groesse ist bewusst hart begrenzt: Die Verkleinerung passiert im
        // Client, hier steht nur der Riegel, falls sie umgangen wird. null
        // entfernt das Bild wieder.
        avatar: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/)
          .max(60_000)
          .nullable()
          .optional(),
      })
      .parse(request.body);

    const set: Record<string, unknown> = {};
    if (body.cardDeck) set.cardDeck = body.cardDeck;
    if (body.avatar !== undefined) set.avatar = body.avatar;
    if (Object.keys(set).length > 0) {
      await deps.db.update(s.account).set(set).where(eq(s.account.id, accountId));
    }

    return reply.send({ ok: true });
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
  // Profile und Freunde
  // -------------------------------------------------------------------------

  /** Namenssuche zum Anfreunden. Vor der Profilroute, sonst faengt :id "search". */
  app.get('/api/players', async (request, reply) => {
    const viewerId = await requireAccount(request);
    const { q } = z.object({ q: z.string().max(60) }).parse(request.query);
    return reply.send(await searchPlayers(deps.db, viewerId, q));
  });

  app.get('/api/players/:accountId', async (request, reply) => {
    const viewerId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    return reply.send(await playerProfile(deps.db, viewerId, accountId));
  });

  app.get('/api/friends', async (request, reply) => {
    const meId = await requireAccount(request);
    return reply.send(await listFriendships(deps.db, meId));
  });

  app.post('/api/friends/:accountId/request', async (request, reply) => {
    const meId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    return reply.send(await requestFriendship(deps.db, meId, accountId));
  });

  app.post('/api/friends/:accountId/accept', async (request, reply) => {
    const meId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    await acceptFriendship(deps.db, meId, accountId);
    return reply.send({ ok: true });
  });

  /** Entfernt Freundschaft, lehnt eine Anfrage ab oder zieht die eigene zurueck. */
  app.delete('/api/friends/:accountId', async (request, reply) => {
    const meId = await requireAccount(request);
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.params);
    await removeFriendship(deps.db, meId, accountId);
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
    const accountId = await requireAccount(request);
    const query = z
      .object({
        game: gameIdSchema,
        seats: z.coerce.number().int().optional(),
        rounds: z.coerce.number().int().optional(),
      })
      .parse(request.query);

    const clubs = await clubsFor(deps.db, accountId);
    return reply.send(
      await listTables(deps.db, {
        gameId: query.game,
        seats: query.seats,
        rounds: query.rounds,
        clubIds: clubs.map((c) => c.id),
      }),
    );
  });

  app.post('/api/tables', async (request, reply) => {
    const accountId = await requireAccount(request);
    const body = createTableSchema.parse(request.body);
    // Clantisch ohne clubId: den ersten (und in der Beta einzigen) Clan nehmen.
    let clubId = body.clubId;
    if (body.visibility === 'club_only' && !clubId) {
      const clubs = await clubsFor(deps.db, accountId);
      clubId = clubs[0]?.id;
    }
    const table = await createTable(deps.db, { accountId, ...body, clubId });
    return reply.status(201).send(table);
  });

  /** Clantisch pausieren — Zugtimer und 24h-Verfall stehen still. */
  app.post('/api/tables/:tableId/pause', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await deps.runtime.pause(tableId, accountId);
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  /** Pausierten Clantisch fortsetzen. */
  app.post('/api/tables/:tableId/resume', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await deps.runtime.unpause(tableId, accountId);
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  app.get('/api/tables/:tableId', async (request, reply) => {
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    const { table, seats } = await tableWithSeats(deps.db, tableId);
    return reply.send({ table, seats });
  });

  /** Wer am Tisch sitzt, muss nachlesen koennen, welche Regeln hier gelten. */
  app.get('/api/tables/:tableId/rules', async (request, reply) => {
    await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    return reply.send({ config: await tableRules(deps.db, tableId) });
  });

  app.post('/api/tables/:tableId/join', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await joinTable(deps.db, tableId, accountId);
    // Die schon Verbundenen sollen sehen, dass sich der Tisch fuellt - und
    // wenn er damit voll ist, startet die Partie von selbst.
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  /** Vor dem Start straffrei. Danach greift die Verlassen-Logik am Tisch. */
  app.post('/api/tables/:tableId/leave', async (request, reply) => {
    const accountId = await requireAccount(request);
    const { tableId } = z.object({ tableId: z.string().uuid() }).parse(request.params);
    await leaveLobby(deps.db, tableId, accountId);
    deps.runtime.notify(tableId);
    return reply.send({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Ranglisten
  // -------------------------------------------------------------------------

  app.get('/api/rankings/:gameId', async (request, reply) => {
    await requireAccount(request);
    const { gameId } = z.object({ gameId: gameIdSchema }).parse(request.params);
    const query = z
      .object({
        limit: z.coerce.number().int().optional(),
        offset: z.coerce.number().int().optional(),
      })
      .parse(request.query);
    return reply.send(await rankingForGame(deps.db, gameId, query.limit, query.offset));
  });

  app.get('/api/rankings', async (request, reply) => {
    await requireAccount(request);
    const query = z
      .object({
        limit: z.coerce.number().int().optional(),
        offset: z.coerce.number().int().optional(),
      })
      .parse(request.query);
    return reply.send(await overallRanking(deps.db, query.limit, query.offset));
  });

  app.get('/api/health', async (_request, reply) => reply.send({ ok: true }));

  // -------------------------------------------------------------------------
  // Client
  // -------------------------------------------------------------------------

  /**
   * Der gebaute Client wird vom selben Server ausgeliefert.
   *
   * Damit gibt es genau einen Ursprung: Das Sitzungs-Cookie gilt ohne
   * Sonderfall auch fuer den WebSocket, es braucht kein CORS und keine zweite
   * Domain. In der Entwicklung uebernimmt Vite diese Rolle und reicht /api und
   * /ws hierher weiter.
   */
  if (deps.clientDir) {
    void app.register(fastifyStatic, { root: deps.clientDir });

    // Caching des Clients steuern.
    //
    // index.html traegt keinen Hash und verweist auf die gehashten Bundles.
    // Wird sie gecacht, zeigt eine alte index.html nach einem Deploy auf ein
    // Bundle, das es nicht mehr gibt - und die Seite bleibt weiss. Also nie
    // cachen. Die Assets darunter aendern bei jeder Aenderung ihren Namen und
    // duerfen deshalb dauerhaft im Cache bleiben.
    app.addHook('onSend', async (request, reply) => {
      const path = request.url.split('?')[0] ?? '';
      if (path.startsWith('/api') || path.startsWith('/ws')) return;
      if (path.startsWith('/assets/')) {
        reply.header('cache-control', 'public, max-age=31536000, immutable');
      } else {
        // index.html und jede SPA-Route: nie cachen, damit ein Deploy sofort
        // greift und keine alte Seite auf ein verschwundenes Bundle zeigt.
        reply.header('cache-control', 'no-cache');
      }
    });

    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split('?')[0] ?? '';

      // API und WebSocket bleiben ehrliche 404.
      if (path.startsWith('/api') || path.startsWith('/ws')) {
        return reply.status(404).send({ code: 'notFound', messageKey: 'error.notFound' });
      }

      // Eine fehlende Datei mit Endung (ein altes Bundle, ein Bild) darf NICHT
      // die index.html zurueckbekommen: Ein Browser, der ein veraltetes
      // /assets/index-XXXX.js anfragt, bekaeme sonst HTML als "JavaScript"
      // geliefert und die Seite bliebe weiss. Nur echte Navigationsrouten der
      // Einzelseiten-Anwendung erhalten die index.html - und die ungecacht.
      if (path.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(path)) {
        return reply.status(404).send({ code: 'notFound', messageKey: 'error.notFound' });
      }
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  }

  return app;
}
