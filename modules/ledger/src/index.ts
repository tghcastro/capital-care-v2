/**
 * Ledger module
 *
 * Exports:
 * - Routers: mounted by apps/api
 * - Lifecycle helpers: schema migration and database shutdown, called by apps/api
 * - Public types: consumed by API clients and tests
 */

import { getLedgerConfig } from './config.js';
import { getDatabase, closeDatabase } from './shared/persistence/client.js';
import { migrateLedgerDatabase } from './shared/persistence/migrate.js';
import { CategoryRepository } from './category/category.repository.js';
import { CategoryService } from './category/category.service.js';
import { createCategoryRouter } from './category/category.controller.js';

export { getLedgerConfig } from './config.js';
export type { Category } from './category/category.types.js';

export function createLedgerRouters() {
  const config = getLedgerConfig();
  const db = getDatabase(config.dbPath);

  const categoryRepository = new CategoryRepository(db);
  const categoryService = new CategoryService(categoryRepository);
  const categoryRouter = createCategoryRouter(categoryService);

  return {
    categoryRouter,
  };
}

export function migrateLedger(dbPath: string = getLedgerConfig().dbPath): void {
  migrateLedgerDatabase(dbPath);
}

export function closeLedgerDatabase(): void {
  closeDatabase();
}
