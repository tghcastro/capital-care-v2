import { text, integer, uniqueIndex, sqliteTable } from 'drizzle-orm/sqlite-core';

export const accountTable = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    // The name as the user wrote it (trimmed), shown back unchanged.
    name: text('name').notNull(),
    // The name lowercased: the case-insensitive uniqueness key (see account.dto.ts).
    nameKey: text('nameKey').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    uniqueNameKey: uniqueIndex('account_userId_nameKey_unique').on(table.userId, table.nameKey),
  }),
);
