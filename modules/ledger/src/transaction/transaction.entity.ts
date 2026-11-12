import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { accountTable } from '../account/account.entity.js';
import { categoryTable } from '../category/category.entity.js';

// Calendar dates are `YYYY-MM-DD` text, not instants (AD-001).
export const transactionTable = sqliteTable(
  'transaction',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    startDate: text('startDate').notNull(),
    frequency: text('frequency', { enum: ['daily', 'weekly', 'monthly', 'annually'] }),
    instalmentStartNumber: integer('instalmentStartNumber'),
    instalmentTotal: integer('instalmentTotal'),
    // Exclusive: occurrences from this date on were removed.
    stopDate: text('stopDate'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    userIdx: index('transaction_userId_idx').on(table.userId),
  }),
);

// The values in force from `effectiveFrom` until the next revision.
export const transactionRevisionTable = sqliteTable(
  'transaction_revision',
  {
    transactionId: text('transactionId')
      .notNull()
      .references(() => transactionTable.id, { onDelete: 'cascade' }),
    effectiveFrom: text('effectiveFrom').notNull(),
    description: text('description').notNull(),
    categoryId: text('categoryId').references(() => categoryTable.id, { onDelete: 'set null' }),
    accountId: text('accountId').references(() => accountTable.id, { onDelete: 'set null' }),
    type: text('type', { enum: ['receipt', 'debit'] }).notNull(),
    amount: text('amount').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.transactionId, table.effectiveFrom] }),
  }),
);

// One row per occurrence the owner settled; the values are a snapshot of that occurrence.
export const transactionSettlementTable = sqliteTable(
  'transaction_settlement',
  {
    transactionId: text('transactionId')
      .notNull()
      .references(() => transactionTable.id, { onDelete: 'cascade' }),
    occurrenceDate: text('occurrenceDate').notNull(),
    description: text('description').notNull(),
    categoryId: text('categoryId').references(() => categoryTable.id, { onDelete: 'set null' }),
    accountId: text('accountId').references(() => accountTable.id, { onDelete: 'set null' }),
    type: text('type', { enum: ['receipt', 'debit'] }).notNull(),
    amount: text('amount').notNull(),
    settledAt: integer('settledAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.transactionId, table.occurrenceDate] }),
  }),
);
