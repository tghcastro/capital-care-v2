import { and, eq, ne } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { accountTable } from './account.entity.js';
import { toAccountNameKey } from './account.dto.js';
import type { Account } from './account.types.js';
import { ConflictError } from '../shared/errors.js';

export const ACCOUNT_NAME_TAKEN_MESSAGE = 'An account with this name already exists';

export interface IAccountRepository {
  create(data: { userId: string; name: string }): Account;
  getById(id: string): Account | null;
  /** All of the user's accounts, alphabetical by name ignoring case and accents. */
  listByUser(userId: string): Account[];
  update(id: string, data: { name: string }): Account | null;
  delete(id: string): boolean;
  countByUser(userId: string): number;
  /** True when the user has an account with this name ignoring case, other than `excludeId`. */
  isNameTaken(userId: string, name: string, excludeId?: string): boolean;
}

const alphabetical = new Intl.Collator(undefined, { sensitivity: 'base' });

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

export class AccountRepository implements IAccountRepository {
  constructor(private db: BetterSQLite3Database) {}

  create(data: { userId: string; name: string }): Account {
    const id = uuidv4();
    const now = new Date();

    try {
      this.db
        .insert(accountTable)
        .values({
          id,
          userId: data.userId,
          name: data.name,
          nameKey: toAccountNameKey(data.name),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(ACCOUNT_NAME_TAKEN_MESSAGE);
      throw err;
    }

    const created = this.getById(id);
    if (!created) throw new Error('Failed to create account');
    return created;
  }

  getById(id: string): Account | null {
    const row = this.db.select().from(accountTable).where(eq(accountTable.id, id)).get();
    return row ? this.mapToDomain(row) : null;
  }

  listByUser(userId: string): Account[] {
    return this.db
      .select()
      .from(accountTable)
      .where(eq(accountTable.userId, userId))
      .all()
      .map((row) => this.mapToDomain(row))
      .sort(
        (a, b) =>
          alphabetical.compare(a.name, b.name) || toAccountNameKey(a.name).localeCompare(toAccountNameKey(b.name)),
      );
  }

  update(id: string, data: { name: string }): Account | null {
    try {
      this.db
        .update(accountTable)
        .set({ name: data.name, nameKey: toAccountNameKey(data.name), updatedAt: new Date() })
        .where(eq(accountTable.id, id))
        .run();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError(ACCOUNT_NAME_TAKEN_MESSAGE);
      throw err;
    }
    return this.getById(id);
  }

  delete(id: string): boolean {
    return this.db.delete(accountTable).where(eq(accountTable.id, id)).run().changes > 0;
  }

  countByUser(userId: string): number {
    return this.db.select().from(accountTable).where(eq(accountTable.userId, userId)).all().length;
  }

  isNameTaken(userId: string, name: string, excludeId?: string): boolean {
    const sameKey = and(
      eq(accountTable.userId, userId),
      eq(accountTable.nameKey, toAccountNameKey(name)),
    );
    const row = this.db
      .select({ id: accountTable.id })
      .from(accountTable)
      .where(excludeId ? and(sameKey, ne(accountTable.id, excludeId)) : sameKey)
      .get();
    return row !== undefined;
  }

  private mapToDomain(row: typeof accountTable.$inferSelect): Account {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
