import { eq, and, count, desc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { categoryTable } from './category.entity.js';
import type { Category } from './category.types.js';

export interface ICategoryRepository {
  create(data: {
    userId: string;
    name: string;
    description: string | null;
  }): Category;
  getById(id: string): Category | null;
  listByUser(userId: string, sort?: 'name' | '-name'): Category[];
  update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
    },
  ): Category | null;
  delete(id: string): boolean;
  countByUserAndName(userId: string, name: string): number;
  hasTransactions(categoryId: string): boolean;
}

export class CategoryRepository implements ICategoryRepository {
  constructor(private db: BetterSQLite3Database) {}

  create(data: { userId: string; name: string; description: string | null }): Category {
    const id = uuidv4();
    const now = Date.now();

    this.db.insert(categoryTable).values({
      id,
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      createdAt: now,
      updatedAt: now,
    }).run();

    const row = this.db.select().from(categoryTable).where(eq(categoryTable.id, id)).get();
    if (!row) throw new Error('Failed to create category');

    return this.mapToDomain(row);
  }

  getById(id: string): Category | null {
    const row = this.db.select().from(categoryTable).where(eq(categoryTable.id, id)).get();
    return row ? this.mapToDomain(row) : null;
  }

  listByUser(userId: string, sort: 'name' | '-name' = 'name'): Category[] {
    let query = this.db
      .select()
      .from(categoryTable)
      .where(eq(categoryTable.userId, userId)) as any;

    if (sort === 'name') {
      query = query.orderBy(categoryTable.name);
    } else if (sort === '-name') {
      query = query.orderBy(desc(categoryTable.name));
    }

    const rows = query.all() as any[];
    return rows.map((row) => this.mapToDomain(row));
  }

  update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
    },
  ): Category | null {
    const now = Date.now();
    const updateData: any = { updatedAt: now };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    this.db.update(categoryTable).set(updateData).where(eq(categoryTable.id, id)).run();

    const row = this.db.select().from(categoryTable).where(eq(categoryTable.id, id)).get();
    return row ? this.mapToDomain(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db.delete(categoryTable).where(eq(categoryTable.id, id)).run();
    return (result.changes ?? 0) > 0;
  }

  countByUserAndName(userId: string, name: string): number {
    const result = this.db
      .select({ count: count() })
      .from(categoryTable)
      .where(and(eq(categoryTable.userId, userId), eq(categoryTable.name, name)))
      .get() as any;
    return (result?.count ?? 0) as number;
  }

  hasTransactions(categoryId: string): boolean {
    // Placeholder: future implementation when transactions reference categories
    return false;
  }

  private mapToDomain(row: any): Category {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
