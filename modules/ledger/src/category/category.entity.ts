import { text, integer, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';

export const categoryTable = sqliteTable(
  'category',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    // Null on a top-level category. Deleting a category deletes its whole branch.
    parentId: text('parentId').references((): AnySQLiteColumn => categoryTable.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    // The normalised name lower-cased by the service: one name per user in any letter case.
    nameKey: text('nameKey').notNull(),
    description: text('description'),
    createdAt: integer('createdAt').notNull(),
    updatedAt: integer('updatedAt').notNull(),
  },
  (table) => ({
    uniqueIndex: uniqueIndex('category_userId_nameKey_unique').on(table.userId, table.nameKey),
  }),
);
