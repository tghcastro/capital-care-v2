/**
 * Ledger module
 *
 * Exports:
 * - Routers: mounted by apps/api
 * - Lifecycle helpers: schema migration and database shutdown, called by apps/api
 * - Backup commands: database backup and restore, run by apps/api `backup.ts` and `restore.ts`
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
import { TransactionRepository } from './transaction/transaction.repository.js';
import { TransactionService } from './transaction/transaction.service.js';
import { createTransactionRouter } from './transaction/transaction.controller.js';
import { silentLogger, type LedgerLogger } from './shared/logger.js';

export { getLedgerConfig } from './config.js';
export { runBackupCommand, runRestoreCommand } from './backup/backup.command.js';
export type { Category, CategoryNode } from './category/category.types.js';
export type { LedgerLogger } from './shared/logger.js';
export type { Account } from './account/account.types.js';
export type { Transaction, Occurrence } from './transaction/transaction.types.js';

export function createLedgerRouters(options: { logger?: LedgerLogger } = {}) {
  const config = getLedgerConfig();
  const db = getDatabase(config.dbPath);

  const categoryRepository = new CategoryRepository(db);
  const categoryService = new CategoryService(categoryRepository, options.logger ?? silentLogger);
  const categoryRouter = createCategoryRouter(categoryService);

  const accountRepository = new AccountRepository(db);
  const accountService = new AccountService(accountRepository, config.accountLimit);
  const accountRouter = createAccountRouter(accountService);

  const transactionRepository = new TransactionRepository(db);
  const transactionService = new TransactionService(
    transactionRepository,
    accountService,
    categoryService,
  );
  const transactionRouter = createTransactionRouter(transactionService);

  return {
    categoryRouter,
    accountRouter,
    transactionRouter,
  };
}

export function migrateLedger(dbPath: string = getLedgerConfig().dbPath): void {
  migrateLedgerDatabase(dbPath);
}

export function closeLedgerDatabase(): void {
  closeDatabase();
}
