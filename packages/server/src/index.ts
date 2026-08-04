/**
 * Serverstart.
 *
 * Reihenfolge: Konfiguration, Datenbank, Laufzeit, HTTP, WebSocket. Der
 * WebSocket-Server haengt sich an denselben HTTP-Server, damit Railway nur
 * einen Port braucht und das Sitzungs-Cookie ohne Sonderfall mitkommt.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { loadConfig } from './config.js';
import { connect } from './db/connect.js';
import * as s from './db/schema.js';
import { createMailer } from './mail/index.js';
import { APP_ORIGIN, buildApp } from './http/app.js';
import { Gateway } from './realtime/gateway.js';
import { PartyRuntime } from './runtime/party.js';
import { expireStaleTables } from './tables/service.js';

const HOUR = 3600_000;

const here = dirname(fileURLToPath(import.meta.url));
/** dist/src -> packages/server/drizzle */
const MIGRATIONS = resolve(here, '../../drizzle');
/**
 * dist/src -> packages/client/dist
 *
 * Der Server liefert den gebauten Client mit aus. Daraus folgt eine Regel fuer
 * das Deployment: Die Watch Paths des Dienstes duerfen NICHT auf
 * `/packages/server/**` stehen, sonst werden Aenderungen am Client
 * stillschweigend uebersprungen und nie ausgeliefert. Festgelegt ist das in
 * `railway.json` unter `build.watchPatterns`.
 */
const CLIENT_DIR = resolve(here, '../../../client/dist');

async function main(): Promise<void> {
  const config = loadConfig();
  const connection = await connect(config.databaseUrl, config.env);
  const { db } = connection;

  if (config.env !== 'production' || process.env.MIGRATE_ON_BOOT === 'true') {
    await connection.migrate(MIGRATIONS);
  }

  // Der Beta-Zugang laeuft ueber einen gemeinsamen, mehrfach nutzbaren
  // Einladungscode. Ihn aus der Umgebung anzulegen ist idempotent und erspart
  // es, nach jedem Aufsetzen von Hand in die Datenbank zu greifen.
  if (process.env.INVITE_CODE) {
    await db
      .insert(s.inviteCode)
      .values({
        code: process.env.INVITE_CODE,
        maxUses: Number(process.env.INVITE_CODE_MAX_USES ?? 100),
      })
      .onConflictDoNothing();
  }

  const mailer = createMailer(config.resendApiKey, config.mailFrom);
  if (!config.resendApiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      'ACHTUNG: RESEND_API_KEY fehlt. Bestaetigungs- und Passwortmails werden ' +
        'NICHT versendet, sondern nur hier ins Log geschrieben (Suche: "MAIL"). ' +
        'Fuer die Beta muss ein Versanddienst eingerichtet sein.',
    );
  }
  const runtime = new PartyRuntime(db);

  const app = await buildApp({
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
    // In der Entwicklung liefert Vite den Client aus, dann gibt es hier nichts
    // auszuliefern und der Server bleibt reine API.
    clientDir: existsSync(CLIENT_DIR) ? CLIENT_DIR : undefined,
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  new Gateway(app.server, db, runtime, {
    allowedOrigins: [config.publicUrl, APP_ORIGIN],
  });

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
