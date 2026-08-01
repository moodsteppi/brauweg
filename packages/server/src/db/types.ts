import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from './schema.js';

/**
 * Datenbankhandle, wie es durch alle Dienste gereicht wird.
 *
 * Die Tests fahren dasselbe Schema auf PGlite. Dessen Handle ist strukturell
 * gleich, wird dort aber einmal an der Grenze umgetypt, damit der
 * Produktivpfad ehrlich getypt bleibt.
 */
export type Db = NodePgDatabase<typeof schema>;
