import type { AccountService } from '../account/account.service.js';
import type { CategoryService } from '../category/category.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors.js';
import type {
  CreateTransactionInput,
  SettleInput,
  UpdateTransactionInput,
} from './transaction.dto.js';
import type { ITransactionRepository } from './transaction.repository.js';
import {
  instalmentNumber,
  isOccurrenceDate,
  occurrencesInMonth,
  type ScheduleSpec,
} from './transaction.schedule.js';
import type {
  Occurrence,
  Transaction,
  TransactionBundle,
  TransactionValues,
} from './transaction.types.js';

export class TransactionService {
  constructor(
    private repository: ITransactionRepository,
    private accounts: Pick<AccountService, 'getAccount'>,
    private categories: Pick<CategoryService, 'getCategory'>,
  ) {}

  createTransaction(userId: string, input: CreateTransactionInput): Transaction {
    this.requireOwnReferences(userId, input.categoryId, input.accountId);

    const bundle = this.repository.create({
      userId,
      startDate: input.date,
      recurrence: input.instalment ? 'monthly' : (input.recurrence ?? null),
      instalment: input.instalment
        ? { startNumber: input.instalment.number, total: input.instalment.total }
        : null,
      values: {
        description: input.description,
        categoryId: input.categoryId,
        accountId: input.accountId,
        type: input.type,
        amount: input.amount,
      },
    });

    const { definition } = bundle;
    const first = this.valuesOn(bundle, definition.startDate);
    return {
      id: definition.id,
      userId: definition.userId,
      date: definition.startDate,
      ...first,
      recurrence: input.instalment ? null : definition.recurrence,
      instalment: definition.instalment
        ? { number: definition.instalment.startNumber, total: definition.instalment.total }
        : null,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    };
  }

  /** Every occurrence dated in `month` (`YYYY-MM`), ordered by date, description, then id. */
  listMonth(userId: string, month: string): Occurrence[] {
    const from = `${month}-01`;
    const to = `${month}-31`;
    const occurrences: Occurrence[] = [];

    for (const bundle of this.repository.listBundlesInRange(userId, from, to)) {
      for (const date of this.datesInMonth(bundle, month)) {
        occurrences.push(this.occurrenceOn(bundle, date));
      }
    }

    return occurrences.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.description.toLowerCase().localeCompare(b.description.toLowerCase()) ||
        a.transactionId.localeCompare(b.transactionId),
    );
  }

  /**
   * Changes one occurrence. A settled one changes alone; a forecast one changes from its date
   * on, replacing any change planned for later dates.
   */
  editOccurrence(
    userId: string,
    id: string,
    date: string,
    patch: UpdateTransactionInput,
  ): Occurrence {
    const bundle = this.requireOccurrence(userId, id, date);
    if (patch.categoryId !== undefined || patch.accountId !== undefined) {
      this.requireOwnReferences(userId, patch.categoryId, patch.accountId);
    }

    const settlement = bundle.settlements.find((s) => s.occurrenceDate === date);
    const base: TransactionValues = settlement ?? this.valuesOn(bundle, date);
    const next: TransactionValues = {
      description: patch.description ?? base.description,
      categoryId: patch.categoryId ?? base.categoryId,
      accountId: patch.accountId ?? base.accountId,
      type: patch.type ?? base.type,
      amount: patch.amount ?? base.amount,
    };

    if (settlement) this.repository.updateSettlement(id, date, next);
    else this.repository.replaceRevisionsFrom(id, date, next);

    return this.occurrenceOn(this.requireBundle(userId, id), date);
  }

  /** Removes the occurrence and every later one; earlier ones stay as they were. */
  stopFrom(userId: string, id: string, date: string): void {
    const bundle = this.requireOccurrence(userId, id, date);
    if (date === bundle.definition.startDate) this.repository.deleteTransaction(id);
    else this.repository.stopFrom(id, date);
  }

  settle(userId: string, id: string, date: string, input: SettleInput): Occurrence {
    const bundle = this.requireOccurrence(userId, id, date);
    if (bundle.settlements.some((s) => s.occurrenceDate === date)) {
      throw new ConflictError('This occurrence is already settled');
    }

    const values = this.valuesOn(bundle, date);
    this.repository.insertSettlement({
      transactionId: id,
      occurrenceDate: date,
      ...values,
      amount: input.amount ?? values.amount,
    });
    return this.occurrenceOn(this.requireBundle(userId, id), date);
  }

  unsettle(userId: string, id: string, date: string): Occurrence {
    const bundle = this.requireOccurrence(userId, id, date);
    if (!bundle.settlements.some((s) => s.occurrenceDate === date)) {
      throw new ConflictError('This occurrence is not settled');
    }

    this.repository.deleteSettlement(id, date);
    return this.occurrenceOn(this.requireBundle(userId, id), date);
  }

  private requireBundle(userId: string, id: string): TransactionBundle {
    const bundle = this.repository.getBundle(id);
    if (!bundle || bundle.definition.userId !== userId) {
      throw new NotFoundError('Transaction not found');
    }
    return bundle;
  }

  private requireOccurrence(userId: string, id: string, date: string): TransactionBundle {
    const bundle = this.requireBundle(userId, id);
    if (!this.isOccurrence(bundle, date)) throw new NotFoundError('Occurrence not found');
    return bundle;
  }

  private requireOwnReferences(
    userId: string,
    categoryId: string | undefined,
    accountId: string | undefined,
  ): void {
    if (categoryId !== undefined) {
      this.requireFound('categoryId', () => this.categories.getCategory(categoryId, userId));
    }
    if (accountId !== undefined) {
      this.requireFound('accountId', () => this.accounts.getAccount(accountId, userId));
    }
  }

  private requireFound(field: string, lookup: () => unknown): void {
    try {
      lookup();
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new ValidationError(`${field} must be an existing one of yours`);
      }
      throw err;
    }
  }

  private spec(bundle: TransactionBundle): ScheduleSpec {
    const { startDate, recurrence, instalment } = bundle.definition;
    return { startDate, recurrence, instalment };
  }

  private datesInMonth(bundle: TransactionBundle, month: string): string[] {
    const { stopDate } = bundle.definition;
    return occurrencesInMonth(this.spec(bundle), month).filter(
      (date) => stopDate === null || date < stopDate,
    );
  }

  private isOccurrence(bundle: TransactionBundle, date: string): boolean {
    const { stopDate } = bundle.definition;
    return isOccurrenceDate(this.spec(bundle), date) && (stopDate === null || date < stopDate);
  }

  /** The values in force on `date`: those of the latest revision effective on or before it. */
  private valuesOn(bundle: TransactionBundle, date: string): TransactionValues {
    let inForce = bundle.revisions[0];
    for (const revision of bundle.revisions) {
      if (revision.effectiveFrom <= date) inForce = revision;
    }
    if (!inForce) throw new Error('Transaction has no revision');
    return {
      description: inForce.description,
      categoryId: inForce.categoryId,
      accountId: inForce.accountId,
      type: inForce.type,
      amount: inForce.amount,
    };
  }

  private occurrenceOn(bundle: TransactionBundle, date: string): Occurrence {
    const { definition } = bundle;
    const settlement = bundle.settlements.find((s) => s.occurrenceDate === date);
    const values = settlement ?? this.valuesOn(bundle, date);
    const number = instalmentNumber(this.spec(bundle), date);

    return {
      transactionId: definition.id,
      date,
      description: values.description,
      categoryId: values.categoryId,
      accountId: values.accountId,
      type: values.type,
      amount: values.amount,
      recurrence: definition.instalment ? null : definition.recurrence,
      instalment:
        definition.instalment && number !== null
          ? { number, total: definition.instalment.total }
          : null,
      status: settlement ? 'settled' : 'forecast',
    };
  }
}
