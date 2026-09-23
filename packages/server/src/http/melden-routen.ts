/**
 * Blockieren und Melden (seit dem 23.09.2026).
 *
 * Apple verlangt beides fuer jede App, in der Fremde aufeinandertreffen
 * (Richtlinie 1.2: Nutzerinhalte und -kontakt brauchen einen Weg, jemanden
 * zu melden und zu blockieren). Die Tabellen `block` und `report` standen
 * seit dem Beta-Plan im Schema, nur benutzt wurde `report` nie, und
 * `block` wirkte zwar an oeffentlichen Tischen (tables/service.ts), liess
 * sich aber nirgends setzen.
 *
 * Was Blockieren bewirkt:
 * - Man sitzt nicht mehr zusammen an oeffentlichen Tischen — in beide
 *   Richtungen, das pruefte `joinTable` schon.
 * - Freundschaft und offene Anfragen zwischen beiden verschwinden, und der
 *   Blockierte kann keine neue stellen.
 *
 * Eine Meldung landet in `report` und geht per Mail an jedes Testkonto
 * (`isStaff`, dieselbe Aufsicht wie bei den Meme-Motiven). Scheitert die Mail,
 * bleibt die Meldung trotzdem stehen — die Liste unter
 * `/api/aufsicht/meldungen` ist die Quelle, die Mail nur der Stups.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import type { AuthDeps } from '../auth/service.js';
import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { badRequest, forbidden, notFound } from '../errors.js';

type Grenze = { max: number; timeWindow: string };

export interface MeldenRoutenDeps {
  readonly db: Db;
  readonly auth: AuthDeps;
  readonly requireAccount: (request: FastifyRequest) => Promise<string>;
  readonly limitSchreiben: Grenze;
}

/** Gruende zur Auswahl. Kennungen stehen in `report.reason` — nie umbenennen. */
export const MELDEGRUENDE = ['beleidigung', 'betrug', 'unangemessen', 'spam', 'anderes'] as const;

/** Wenige Meldungen je Stunde reichen jedem Ehrlichen und bremsen jede Flut. */
const LIMIT_MELDEN = { max: 10, timeWindow: '1 hour' };

/** Hat einer der beiden den anderen blockiert? */
export async function blockiertZwischen(db: Db, a: string, b: string): Promise<boolean> {
  const [zeile] = await db
    .select({ id: s.block.accountId })
    .from(s.block)
    .where(
      or(
        and(eq(s.block.accountId, a), eq(s.block.blockedAccountId, b)),
        and(eq(s.block.accountId, b), eq(s.block.blockedAccountId, a)),
      ),
    )
    .limit(1);
  return zeile !== undefined;
}

/** Hat `wer` den anderen blockiert? (Nur diese Richtung — fuer die Anzeige.) */
export async function hatBlockiert(db: Db, wer: string, wen: string): Promise<boolean> {
  const [zeile] = await db
    .select({ id: s.block.accountId })
    .from(s.block)
    .where(and(eq(s.block.accountId, wer), eq(s.block.blockedAccountId, wen)))
    .limit(1);
  return zeile !== undefined;
}

async function gibtEsKonto(db: Db, id: string): Promise<boolean> {
  const [zeile] = await db.select({ id: s.account.id }).from(s.account).where(eq(s.account.id, id));
  return zeile !== undefined;
}

export function meldenRouten(app: FastifyInstance, deps: MeldenRoutenDeps): void {
  const kennung = z.object({ accountId: z.string().uuid() });

  app.post(
    '/api/players/:accountId/block',
    { config: { rateLimit: deps.limitSchreiben } },
    async (request, reply) => {
      const meId = await deps.requireAccount(request);
      const { accountId } = kennung.parse(request.params);
      if (accountId === meId) throw badRequest('selbstBlockieren');
      if (!(await gibtEsKonto(deps.db, accountId))) throw notFound('accountUnknown');
      await deps.db
        .insert(s.block)
        .values({ accountId: meId, blockedAccountId: accountId })
        .onConflictDoNothing();
      await deps.db
        .delete(s.friendship)
        .where(
          or(
            and(eq(s.friendship.accountA, meId), eq(s.friendship.accountB, accountId)),
            and(eq(s.friendship.accountA, accountId), eq(s.friendship.accountB, meId)),
          ),
        );
      return reply.send({ ok: true, blockiert: true });
    },
  );

  app.delete(
    '/api/players/:accountId/block',
    { config: { rateLimit: deps.limitSchreiben } },
    async (request, reply) => {
      const meId = await deps.requireAccount(request);
      const { accountId } = kennung.parse(request.params);
      await deps.db
        .delete(s.block)
        .where(and(eq(s.block.accountId, meId), eq(s.block.blockedAccountId, accountId)));
      return reply.send({ ok: true, blockiert: false });
    },
  );

  app.post(
    '/api/players/:accountId/report',
    { config: { rateLimit: LIMIT_MELDEN } },
    async (request, reply) => {
      const meId = await deps.requireAccount(request);
      const { accountId } = kennung.parse(request.params);
      const body = z
        .object({
          grund: z.enum(MELDEGRUENDE),
          text: z.string().trim().max(500).optional(),
        })
        .parse(request.body);
      if (accountId === meId) throw badRequest('selbstMelden');

      const beteiligte = await deps.db
        .select({ id: s.account.id, displayName: s.account.displayName })
        .from(s.account)
        .where(inArray(s.account.id, [meId, accountId]));
      const ziel = beteiligte.find((k) => k.id === accountId);
      if (!ziel) throw notFound('accountUnknown');
      const melder = beteiligte.find((k) => k.id === meId);

      await deps.db.insert(s.report).values({
        reporterId: meId,
        targetId: accountId,
        reason: body.grund,
        freeText: body.text || null,
      });

      // Der Stups an die Aufsicht. Nie am Mailfehler scheitern: Die Meldung
      // steht schon in der Tabelle.
      const aufsicht = await deps.db
        .select({ email: s.account.email })
        .from(s.account)
        .where(and(eq(s.account.isStaff, true), isNotNull(s.account.email)));
      for (const { email } of aufsicht) {
        try {
          await deps.auth.mailer.send({
            to: email!,
            subject: `Brauweg: Meldung gegen ${ziel.displayName}`,
            text:
              `${melder?.displayName ?? 'Jemand'} hat ${ziel.displayName} gemeldet.\n` +
              `Grund: ${body.grund}\n` +
              (body.text ? `Text: ${body.text}\n` : '') +
              `\nKonto: ${accountId}\nAlle Meldungen: ${deps.auth.publicUrl}/api/aufsicht/meldungen`,
          });
        } catch (fehler) {
          // eslint-disable-next-line no-console
          console.error('Meldung: Mail an die Aufsicht gescheitert', fehler);
        }
      }
      return reply.status(201).send({ ok: true });
    },
  );

  /** Die juengsten Meldungen — nur fuer Testkonten. */
  app.get('/api/aufsicht/meldungen', async (request, reply) => {
    const meId = await deps.requireAccount(request);
    const [ich] = await deps.db
      .select({ isStaff: s.account.isStaff })
      .from(s.account)
      .where(eq(s.account.id, meId));
    if (!ich?.isStaff) throw forbidden('nurAufsicht');

    const melder = alias(s.account, 'melder');
    const ziel = alias(s.account, 'ziel');
    const zeilen = await deps.db
      .select({
        id: s.report.id,
        am: s.report.createdAt,
        grund: s.report.reason,
        text: s.report.freeText,
        melderId: s.report.reporterId,
        melder: melder.displayName,
        zielId: s.report.targetId,
        ziel: ziel.displayName,
      })
      .from(s.report)
      .innerJoin(melder, eq(melder.id, s.report.reporterId))
      .innerJoin(ziel, eq(ziel.id, s.report.targetId))
      .orderBy(desc(s.report.createdAt))
      .limit(200);
    return reply.send(zeilen);
  });
}
