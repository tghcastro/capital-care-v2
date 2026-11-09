/**
 * Schema barrel export for Drizzle Kit
 *
 * This file aggregates all entity/table definitions from the module.
 * Each aggregate owns its own entity file (e.g. user/user.entity.ts);
 * they are re-exported here to give drizzle-kit a single entry point
 * for generating migrations.
 */

export * from '../../user/user.entity.js';
export * from '../../category/category.entity.js';
// TODO: export * from '../../account/account.entity.js';
// TODO: export * from '../../transaction/transaction.entity.js';
