/**
 * Drizzle Kit configuration
 *
 * Generates SQL migrations from the schema barrel into
 * src/shared/persistence/migrations. Run with `pnpm db:generate`.
 * Migrations are applied at runtime by src/shared/persistence/migrate.ts.
 */

import type { Config } from 'drizzle-kit';

export default {
  schema: './src/shared/persistence/schema.ts',
  out: './src/shared/persistence/migrations',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './data/capital-care.db',
  },
} satisfies Config;
