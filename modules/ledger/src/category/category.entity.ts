import { text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sqliteTable } from 'drizzle-orm/sqlite-core';

export const categoryTable = sqliteTable(
  'category',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdAt: integer('createdAt').notNull(),
    updatedAt: integer('updatedAt').notNull(),
  },
  (table) => ({
    uniqueIndex: uniqueIndex('category_userId_name_unique').on(table.userId, table.name),
  }),
);
