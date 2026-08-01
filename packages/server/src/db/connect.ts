/**
 * Datenbankverbindung.
 *
 * In Produktion ist das immer PostgreSQL (Railway stellt DATABASE_URL selbst
 * bereit). Fuer die Entwicklung gibt es zusaetzlich eine eingebettete
 * Variante: `DATABASE_URL=pglite` startet Postgres als WebAssembly im selben
 * Prozess und legt die Daten unter .pglite ab.
 *
 * Der Grund ist praktisch: Wer den Server nur einmal ansehen will, soll nicht
 * erst einen Datenbankdienst installieren muessen. Der Pfad wird dynamisch
 * geladen, damit das Paket in Produktion gar nicht erst im Bundle landet, und
 * er verweigert dort ausdruecklich den Dienst.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';
import type { Db } from './types.js';

export interface Connection {
  readonly db: Db;
  /** Migrationen anwenden. In Produktion uebernimmt das drizzle-kit. */
  migrate(migrationsFolder: string): Promise<void>;
  close(): Promise<void>;
}

const EMBEDDED = ['pglite', 'pglite://', 'embedded'];

/**
 * TLS fuer die Datenbankverbindung.
 *
 * node-postgres schaltet TLS nicht allein aus der Verbindungszeichenfolge ein,
 * gehostete Anbieter wie Supabase verlangen es aber. Deshalb wird es hier
 * ausdruecklich gesetzt — mit drei Ausnahmen:
 *
 *   - Private Netze (`*.railway.internal`, `*.internal`) und localhost. Dort
 *     verlaesst der Verkehr die Umgebung nicht, und die Anbieter benutzen
 *     selbst signierte Zertifikate. Strenge Pruefung scheitert dann mit
 *     SELF_SIGNED_CERT_IN_CHAIN, ohne dass es etwas schuetzen wuerde.
 *   - `sslmode=disable`, wenn jemand es ausdruecklich abschaltet.
 *   - `sslmode=no-verify` fuer oeffentliche Hosts mit eigenem Zertifikat.
 *     Wer das setzt, weiss, was er aufgibt.
 *
 * Fuer alles andere bleibt `rejectUnauthorized` an. Eine Verbindung uebers
 * offene Netz ohne Zertifikatspruefung waere gegen einen Angreifer in der
 * Leitung wertlos.
 */
function sslFor(url: string): false | { rejectUnauthorized: boolean } {
  if (/[?&]sslmode=disable/.test(url)) return false;

  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    // Unlesbare Zeichenfolge: TLS an und pruefen. Fehlschlag ist hier besser
    // als eine ungeprueft offene Verbindung.
    return { rejectUnauthorized: true };
  }

  const isPrivate =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.internal') ||
    host.endsWith('.local');

  if (isPrivate && !/[?&]sslmode=require/.test(url)) return false;

  return { rejectUnauthorized: !/[?&]sslmode=no-verify/.test(url) };
}

export async function connect(url: string, env: string): Promise<Connection> {
  if (EMBEDDED.includes(url)) {
    if (env === 'production') {
      throw new Error('Die eingebettete Datenbank ist in Produktion nicht zulaessig');
    }
    return connectEmbedded();
  }

  const pool = new Pool({ connectionString: url, ssl: sslFor(url) });
  const db = drizzle(pool, { schema, casing: 'snake_case' }) as Db;

  return {
    db,
    async migrate(migrationsFolder) {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      await migrate(db, { migrationsFolder });
    },
    close: () => pool.end(),
  };
}

async function connectEmbedded(): Promise<Connection> {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');

  const client = new PGlite('.pglite');
  const db = drizzlePglite(client, { schema, casing: 'snake_case' }) as unknown as Db;

  return {
    db,
    async migrate(migrationsFolder) {
      const { migrate } = await import('drizzle-orm/pglite/migrator');
      await migrate(db as never, { migrationsFolder });
    },
    close: () => client.close(),
  };
}
