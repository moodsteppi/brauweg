/**
 * Testfundament.
 *
 * PGlite ist echtes Postgres, uebersetzt nach WebAssembly. Damit laufen die
 * Migrationen und alle Abfragen gegen dieselbe Datenbank wie in Produktion,
 * ohne dass ein Dienst installiert sein muss. Jeder Test bekommt eine frische
 * Instanz im Arbeitsspeicher.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

import * as schema from '../src/db/schema.js';
import type { Db } from '../src/db/types.js';
import type { AuthDeps } from '../src/auth/service.js';
import { register, verifyEmail } from '../src/auth/service.js';
import { ConsoleMailer, type Mail } from '../src/mail/index.js';

const here = dirname(fileURLToPath(import.meta.url));
/** dist/test -> packages/server/drizzle */
const MIGRATIONS = resolve(here, '../../drizzle');

/** Sammelt Mails, statt sie zu senden, und schweigt dabei. */
export class TestMailer extends ConsoleMailer {
  override async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }

  /** Letzter Link aus der zuletzt an diese Adresse gesendeten Mail. */
  lastLink(to: string): string {
    const mail = [...this.sent].reverse().find((m) => m.to === to);
    if (!mail) throw new Error(`keine Mail an ${to}`);
    const match = mail.text.match(/https?:\/\/\S+/);
    if (!match) throw new Error(`kein Link in der Mail an ${to}`);
    return match[0];
  }

  tokenFrom(to: string): string {
    const url = new URL(this.lastLink(to));
    const token = url.searchParams.get('token');
    if (!token) throw new Error(`kein Token im Link an ${to}`);
    return token;
  }
}

export interface TestContext {
  readonly db: Db;
  readonly mailer: TestMailer;
  readonly auth: AuthDeps;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const client = new PGlite();
  // PGlite und node-postgres liefern strukturgleiche Handles. Der Unterschied
  // wird genau hier einmal ueberbrueckt, damit der Produktivpfad ehrlich
  // getypt bleibt.
  const db = drizzle(client, { schema, casing: 'snake_case' }) as unknown as Db;

  await migrate(db as never, { migrationsFolder: MIGRATIONS });

  const mailer = new TestMailer();
  const auth: AuthDeps = {
    db,
    mailer,
    publicUrl: 'http://localhost:5173',
    sessionTtlDays: 30,
  };

  return {
    db,
    mailer,
    auth,
    close: () => client.close(),
  };
}

export const INVITE = 'BRAUWEG-BETA';

export async function seedInvite(db: Db, maxUses = 50): Promise<void> {
  await db.insert(schema.inviteCode).values({ code: INVITE, maxUses });
}

/** Registriert ein Konto, bestaetigt die Adresse und gibt die Kennung zurueck. */
export async function createVerifiedAccount(
  ctx: TestContext,
  displayName: string,
  email = `${displayName.toLowerCase()}@example.org`,
): Promise<{ accountId: string; email: string }> {
  await register(ctx.auth, {
    email,
    password: 'geheim-genug-1234',
    displayName,
    inviteCode: INVITE,
  });
  const accountId = await verifyEmail(ctx.db, ctx.mailer.tokenFrom(email));
  return { accountId, email };
}

export { schema };
