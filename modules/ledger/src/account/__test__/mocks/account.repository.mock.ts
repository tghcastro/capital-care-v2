import { v4 as uuidv4 } from 'uuid';
import { toAccountNameKey } from '../../account.dto.js';
import type { IAccountRepository } from '../../account.repository.js';
import type { Account } from '../../account.types.js';

/** In-memory stand-in for the account repository, used by the service unit tests. */
export class MockAccountRepository implements IAccountRepository {
  private accounts: Map<string, Account> = new Map();

  create(data: { userId: string; name: string }): Account {
    const now = new Date();
    const account: Account = {
      id: uuidv4(),
      userId: data.userId,
      name: data.name,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(account.id, account);
    return account;
  }

  getById(id: string): Account | null {
    return this.accounts.get(id) ?? null;
  }

  listByUser(userId: string): Account[] {
    return [...this.accounts.values()]
      .filter((a) => a.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  update(id: string, data: { name: string }): Account | null {
    const account = this.accounts.get(id);
    if (!account) return null;
    const updated: Account = { ...account, name: data.name, updatedAt: new Date() };
    this.accounts.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.accounts.delete(id);
  }

  countByUser(userId: string): number {
    return this.listByUser(userId).length;
  }

  isNameTaken(userId: string, name: string, excludeId?: string): boolean {
    return [...this.accounts.values()].some(
      (a) =>
        a.userId === userId &&
        a.id !== excludeId &&
        toAccountNameKey(a.name) === toAccountNameKey(name),
    );
  }
}
