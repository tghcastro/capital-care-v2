import { Decimal } from 'decimal.js';
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

/**
 * The filters of a month view. Empty means no filter; `null` selects occurrences with no category
 * or no account. Within one list any id matches; the two lists combine with AND.
 */
export interface MonthFilters {
  categoryIds: (string | null)[];
  accountIds: (string | null)[];
}

export interface MonthBalance {
  /** One entry per date with occurrences, ascending: the balance after that day. */
  days: { date: string; balance: string }[];
  /** Null while a category filter is active: only the selected month counts then. */
  totals: { received: string; debits: string; net: string; finalBalance: string } | null;
}

const NO_FILTER: MonthFilters = { categoryIds: [], accountIds: [] };

function matches(selected: (string | null)[], id: string | null): boolean {
  return selected.length === 0 || selected.includes(id);
}

function matchesFilters(occurrence: Occurrence, filters: MonthFilters): boolean {
  return (
    matches(filters.categoryIds, occurrence.categoryId) &&
    matches(filters.accountIds, occurrence.accountId)
  );
}

function signed(occurrence: Occurrence): Decimal {
  const amount = new Decimal(occurrence.amount);
  return occurrence.type === 'receipt' ? amount : amount.negated();
}

/** `YYYY-MM` one month earlier. */
function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) - 1;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** Every `YYYY-MM` from `from` to `to`, both included. */
function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = to; month >= from; month = previousMonth(month)) months.unshift(month);
  return months;
}

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

  /**
   * The balance of `month` for the occurrences matching `filters`. Without a category filter the
   * month opens with every matching occurrence dated before it and the totals are returned; with
   * one it opens at 0 and the totals are not returned.
   */
  balance(userId: string, month: string, filters: MonthFilters): MonthBalance {
    const byCategory = filters.categoryIds.length > 0;
    let running = byCategory ? new Decimal(0) : this.openingBalance(userId, month, filters);
    const opening = running;
    let received = new Decimal(0);
    let debits = new Decimal(0);
    const days: MonthBalance['days'] = [];

    for (const occurrence of this.listMonth(userId, month, filters)) {
      if (occurrence.type === 'receipt') received = received.plus(occurrence.amount);
      else debits = debits.plus(occurrence.amount);
      running = running.plus(signed(occurrence));
      const last = days[days.length - 1];
      if (last && last.date === occurrence.date) last.balance = running.toFixed();
      else days.push({ date: occurrence.date, balance: running.toFixed() });
    }

    const net = received.minus(debits);
    return {
      days,
      totals: byCategory
        ? null
        : {
            received: received.toFixed(),
            debits: debits.toFixed(),
            net: net.toFixed(),
            finalBalance: opening.plus(net).toFixed(),
          },
    };
  }

  /** Every matching occurrence dated before `month`, settled or forecast: receipts minus debits. */
  private openingBalance(userId: string, month: string, filters: MonthFilters): Decimal {
    const lastMonth = previousMonth(month);
    let total = new Decimal(0);
    for (const bundle of this.repository.listBundlesInRange(userId, '0000-01-01', `${lastMonth}-31`)) {
      for (const each of monthsBetween(bundle.definition.startDate.slice(0, 7), lastMonth)) {
        for (const date of this.datesInMonth(bundle, each)) {
          const occurrence = this.occurrenceOn(bundle, date);
          if (matchesFilters(occurrence, filters)) total = total.plus(signed(occurrence));
        }
      }
    }
    return total;
  }

  /** Every occurrence dated in `month` (`YYYY-MM`) matching `filters`, ordered by date, description, then id. */
  listMonth(userId: string, month: string, filters: MonthFilters = NO_FILTER): Occurrence[] {
    const from = `${month}-01`;
    const to = `${month}-31`;
    const occurrences: Occurrence[] = [];

    for (const bundle of this.repository.listBundlesInRange(userId, from, to)) {
      for (const date of this.datesInMonth(bundle, month)) {
        const occurrence = this.occurrenceOn(bundle, date);
        if (matchesFilters(occurrence, filters)) occurrences.push(occurrence);
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
   * on, replacing any change planned for later dates. A new `date` moves a one-off, settlement
   * included, or shifts a series from this occurrence on (see `shiftSeries`).
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

    const moving = patch.date !== undefined && patch.date !== date;
    if (moving && this.isSeries(bundle)) return this.shiftSeries(bundle, date, patch);

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

    if (moving && patch.date !== undefined) {
      this.repository.moveOneOff(id, date, patch.date);
      return this.occurrenceOn(this.requireBundle(userId, id), patch.date);
    }
    return this.occurrenceOn(this.requireBundle(userId, id), date);
  }

  /**
   * Moves a forecast occurrence of a series to `patch.date`: the series ends before it, keeping
   * its earlier occurrences, and a new series with the same recurrence starts on the new date with
   * the values in force on the old one (and the patch), instalment numbers continuing. Refused
   * while that occurrence or a later one is settled, since ending the series would drop them.
   */
  private shiftSeries(
    bundle: TransactionBundle,
    date: string,
    patch: UpdateTransactionInput,
  ): Occurrence {
    const { definition } = bundle;
    if (bundle.settlements.some((s) => s.occurrenceDate === date)) {
      throw new ConflictError('A settled occurrence of a recurring entry cannot be moved');
    }
    if (bundle.settlements.some((s) => s.occurrenceDate > date)) {
      throw new ConflictError('A later occurrence of this entry is settled, so it cannot be moved');
    }

    const base = this.valuesOn(bundle, date);
    const number = instalmentNumber(this.spec(bundle), date);
    const next = this.repository.shiftSeries(definition.id, date, {
      userId: definition.userId,
      startDate: patch.date ?? date,
      recurrence: definition.recurrence,
      instalment:
        definition.instalment && number !== null
          ? { startNumber: number, total: definition.instalment.total }
          : null,
      values: {
        description: patch.description ?? base.description,
        categoryId: patch.categoryId ?? base.categoryId,
        accountId: patch.accountId ?? base.accountId,
        type: patch.type ?? base.type,
        amount: patch.amount ?? base.amount,
      },
    });
    return this.occurrenceOn(next, next.definition.startDate);
  }

  private isSeries(bundle: TransactionBundle): boolean {
    return bundle.definition.recurrence !== null || bundle.definition.instalment !== null;
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
