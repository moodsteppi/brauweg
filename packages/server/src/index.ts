/**
 * Serverstart.
 *
 * Reihenfolge: Konfiguration, Datenbank, Laufzeit, HTTP, WebSocket. Der
 * WebSocket-Server haengt sich an denselben HTTP-Server, damit Railway nur
 * einen Port braucht und das Sitzungs-Cookie ohne Sonderfall mitkommt.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { loadConfig } from './config.js';
import { connect } from './db/connect.js';
import * as s from './db/schema.js';
import { createMailer } from './mail/index.js';
import { buildApp } from './http/app.js';
import { Gateway } from './realtime/gateway.js';
import { PartyRuntime } from './runtime/party.js';
import { expireStaleTables } from './tables/service.js';

const HOUR = 3600_000;

/** dist/src -> packages/server/drizzle */
const MIGRATIONS = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

async function main(): Promise<void> {
  const config = loadConfig();
  const connection = await connect(config.databaseUrl, config.env);
  const { db } = connection;

  if (config.env !== 'production' || process.env.MIGRATE_ON_BOOT === 'true') {
    await connection.migrate(MIGRATIONS);
  }

  // In der Entwicklung soll man sich sofort registrieren koennen, ohne erst
  // von Hand einen Einladungscode anzulegen.
  if (config.env !== 'production' && process.env.INVITE_CODE) {
    await db
      .insert(s.inviteCode)
      .values({ code: process.env.INVITE_CODE, maxUses: 1000 })
      .onConflictDoNothing();
  }

  const mailer = createMailer(config.resendApiKey, config.mailFrom);
  const runtime = new PartyRuntime(db);

  const app = buildApp({
    db,
    runtime,
    auth: {
      db,
      mailer,
      publicUrl: config.publicUrl,
      sessionTtlDays: config.sessionTtlDays,
    },
    cookieSecure: config.cookieSecure,
    sessionTtlDays: config.sessionTtlDays,
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  new Gateway(app.server, db, runtime);

  // Tische ohne Aktivitaet verfallen nach 24 Stunden.
  const sweeper = setInterval(() => {
    void expireStaleTables(db).catch((err) => app.log.error(err));
  }, HOUR);

  const stop = async (): Promise<void> => {
    clearInterval(sweeper);
    runtime.shutdown();
    await app.close();
    await connection.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());

  // eslint-disable-next-line no-console
  console.info(`Brauweg laeuft auf Port ${config.port}`);
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Serverstart fehlgeschlagen:', err);
  process.exit(1);
});
