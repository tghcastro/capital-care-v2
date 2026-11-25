import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { categoryTable } from './category.entity.js';
import type { Category } from './category.types.js';
import { ConflictError } from '../shared/errors.js';

export const NAME_TAKEN = 'name is taken';

export interface ICategoryRepository {
  create(data: {
    userId: string;
    parentId: string | null;
    name: string;
    nameKey: string;
    description: string | null;
  }): Category;
  getById(id: string): Category | null;
  /** Every category of the user, in no particular order. */
  listByUser(userId: string): Category[];
  update(
    id: string,
    data: {
      name?: string;
      nameKey?: string;
      description?: string | null;
      parentId?: string | null;
    },
  ): Category | null;
  /** Deletes the category; the database deletes its descendants with it. */
  delete(id: string): boolean;
  findByUserAndNameKey(userId: string, nameKey: string): Category | null;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export class CategoryRepository implements ICategoryRepository {
  constructor(private db: BetterSQLite3Database) {}

  create(data: {
    userId: string;
    parentId: string | null;
    name: string;
    nameKey: string;
    description: string | null;
  }): Category {
    const id = uuidv4();
    const now = Date.now();

    try {
      this.db
        .insert(categoryTable)
        .values({
          id,
          userId: data.userId,
          parentId: data.parentId,
          name: data.name,
          nameKey: data.nameKey,
          description: data.description || null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(NAME_TAKEN);
      throw err;
    }

    const row = this.db.select().from(categoryTable).where(eq(categoryTable.id, id)).get();
    if (!row) throw new Error('Failed to create category');

    return this.mapToDomain(row);
  }

  getById(id: string): Category | null {
    const row = this.db.select().from(categoryTable).where(eq(categoryTable.id, id)).get();
    return row ? this.mapToDomain(row) : null;
  }

  listByUser(userId: string): Category[] {
    const rows = this.db
      .select()
      .from(categoryTable)
      .where(eq(categoryTable.userId, userId))
      .all();
    return rows.map((row) => this.mapToDomain(row));
  }

  update(
    id: string,
    data: {
      name?: string;
      nameKey?: string;
      description?: string | null;
      parentId?: string | null;
    },
  ): Category | null {
    const now = Date.now();
    const updateData: Partial<typeof categoryTable.$inferInsert> = { updatedAt: now };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.nameKey !== undefined) updateData.nameKey = data.nameKey;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;

    try {
      this.db.update(categoryTable).set(updateData).where(eq(categoryTable.id, id)).run();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(NAME_TAKEN);
      throw err;
    }

    const row = this.db.select().from(categoryTable).where(eq(categoryTable.id, id)).get();
    return row ? this.mapToDomain(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db.delete(categoryTable).where(eq(categoryTable.id, id)).run();
    return (result.changes ?? 0) > 0;
  }

  findByUserAndNameKey(userId: string, nameKey: string): Category | null {
    const row = this.db
      .select()
      .from(categoryTable)
      .where(and(eq(categoryTable.userId, userId), eq(categoryTable.nameKey, nameKey)))
      .get();
    return row ? this.mapToDomain(row) : null;
  }

  private mapToDomain(row: typeof categoryTable.$inferSelect): Category {
    return {
      id: row.id,
      userId: row.userId,
      parentId: row.parentId,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
