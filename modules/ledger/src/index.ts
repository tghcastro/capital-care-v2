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
import { AccountRepository } from './account/account.repository.js';
import { AccountService } from './account/account.service.js';
import { createAccountRouter } from './account/account.controller.js';

export { getLedgerConfig } from './config.js';
export type { Category } from './category/category.types.js';
export type { Account } from './account/account.types.js';

export function createLedgerRouters() {
  const config = getLedgerConfig();
  const db = getDatabase(config.dbPath);

  const categoryRepository = new CategoryRepository(db);
  const categoryService = new CategoryService(categoryRepository);
  const categoryRouter = createCategoryRouter(categoryService);

  const accountRepository = new AccountRepository(db);
  const accountService = new AccountService(accountRepository, config.accountLimit);
  const accountRouter = createAccountRouter(accountService);

  return {
    categoryRouter,
    accountRouter,
  };
}

export function migrateLedger(dbPath: string = getLedgerConfig().dbPath): void {
  migrateLedgerDatabase(dbPath);
}

export function closeLedgerDatabase(): void {
  closeDatabase();
}
