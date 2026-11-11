import { accountNameSchema } from './account.dto.js';
import { ACCOUNT_NAME_TAKEN_MESSAGE, type IAccountRepository } from './account.repository.js';
import type { Account } from './account.types.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';

export class AccountService {
  /**
   * @param accountLimit the most accounts one user may have; a system setting, never user input.
   */
  constructor(
    private repository: IAccountRepository,
    private accountLimit: number,
  ) {}

  createAccount(input: { userId: string; name: string }): Account {
    const name = this.validName(input.name);

    if (this.repository.isNameTaken(input.userId, name)) {
      throw new ConflictError(ACCOUNT_NAME_TAKEN_MESSAGE);
    }
    if (this.repository.countByUser(input.userId) >= this.accountLimit) {
      throw new ConflictError(`The maximum of ${this.accountLimit} accounts has been reached`);
    }

    return this.repository.create({ userId: input.userId, name });
  }

  getAccount(id: string, userId: string): Account {
    const account = this.repository.getById(id);
    if (!account || account.userId !== userId) {
      throw new NotFoundError('Account not found');
    }
    return account;
  }

  listAccounts(userId: string): Account[] {
    return this.repository.listByUser(userId);
  }

  renameAccount(id: string, input: { userId: string; name: string }): Account {
    this.getAccount(id, input.userId);
    const name = this.validName(input.name);

    if (this.repository.isNameTaken(input.userId, name, id)) {
      throw new ConflictError(ACCOUNT_NAME_TAKEN_MESSAGE);
    }

    const updated = this.repository.update(id, { name });
    if (!updated) throw new NotFoundError('Account not found');
    return updated;
  }

  deleteAccount(id: string, userId: string): void {
    this.getAccount(id, userId);
    this.repository.delete(id);
  }

  private validName(name: unknown): string {
    const parsed = accountNameSchema.safeParse(name);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid name');
    }
    return parsed.data;
  }
}
