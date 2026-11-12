import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  transactionRevisionTable,
  transactionSettlementTable,
  transactionTable,
} from './transaction.entity.js';
import type {
  InstalmentPlan,
  Recurrence,
  TransactionBundle,
  TransactionDefinition,
  TransactionRevision,
  TransactionSettlement,
  TransactionValues,
} from './transaction.types.js';

export interface NewTransaction {
  userId: string;
  startDate: string;
  recurrence: Recurrence | null;
  instalment: InstalmentPlan | null;
  values: TransactionValues;
}

export interface ITransactionRepository {
  /** Saves the definition and its first revision as one unit. */
  create(input: NewTransaction): TransactionBundle;
  /** The whole transaction, with every revision and settlement. */
  getBundle(id: string): TransactionBundle | null;
  /**
   * The user's transactions that may fall in [from, to] (both `YYYY-MM-DD`), with all their
   * revisions and only the settlements dated inside the range.
   */
  listBundlesInRange(userId: string, from: string, to: string): TransactionBundle[];
  /** Drops every revision from `effectiveFrom` on and adds one with these values, as one unit. */
  replaceRevisionsFrom(id: string, effectiveFrom: string, values: TransactionValues): void;
  /** Removes every occurrence from `date` on: its revisions, settlements, and ends the schedule. */
  stopFrom(id: string, date: string): void;
  deleteTransaction(id: string): void;
  insertSettlement(input: { transactionId: string; occurrenceDate: string } & TransactionValues): void;
  updateSettlement(transactionId: string, occurrenceDate: string, values: TransactionValues): void;
  deleteSettlement(transactionId: string, occurrenceDate: string): void;
}

export class TransactionRepository implements ITransactionRepository {
  constructor(private db: BetterSQLite3Database) {}

  create(input: NewTransaction): TransactionBundle {
    const id = uuidv4();
    const now = new Date();

    this.db.transaction((tx) => {
      tx.insert(transactionTable)
        .values({
          id,
          userId: input.userId,
          startDate: input.startDate,
          frequency: input.recurrence,
          instalmentStartNumber: input.instalment?.startNumber ?? null,
          instalmentTotal: input.instalment?.total ?? null,
          stopDate: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
      tx.insert(transactionRevisionTable)
        .values({ transactionId: id, effectiveFrom: input.startDate, ...input.values })
        .run();
    });

    const created = this.getBundle(id);
    if (!created) throw new Error('Failed to create transaction');
    return created;
  }

  getBundle(id: string): TransactionBundle | null {
    const row = this.db.select().from(transactionTable).where(eq(transactionTable.id, id)).get();
    if (!row) return null;
    return {
      definition: this.mapDefinition(row),
      revisions: this.revisionsOf([id]),
      settlements: this.db
        .select()
        .from(transactionSettlementTable)
        .where(eq(transactionSettlementTable.transactionId, id))
        .orderBy(asc(transactionSettlementTable.occurrenceDate))
        .all()
        .map((settlement) => this.mapSettlement(settlement)),
    };
  }

  listBundlesInRange(userId: string, from: string, to: string): TransactionBundle[] {
    const rows = this.db
      .select()
      .from(transactionTable)
      .where(
        and(
          eq(transactionTable.userId, userId),
          lte(transactionTable.startDate, to),
          or(isNull(transactionTable.stopDate), gt(transactionTable.stopDate, from)),
        ),
      )
      .all();
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    const revisions = this.revisionsOf(ids);
    const settlements = this.db
      .select()
      .from(transactionSettlementTable)
      .where(
        and(
          inArray(transactionSettlementTable.transactionId, ids),
          gte(transactionSettlementTable.occurrenceDate, from),
          lte(transactionSettlementTable.occurrenceDate, to),
        ),
      )
      .all()
      .map((settlement) => this.mapSettlement(settlement));

    return rows.map((row) => ({
      definition: this.mapDefinition(row),
      revisions: revisions.filter((revision) => revision.transactionId === row.id),
      settlements: settlements.filter((settlement) => settlement.transactionId === row.id),
    }));
  }

  replaceRevisionsFrom(id: string, effectiveFrom: string, values: TransactionValues): void {
    this.db.transaction((tx) => {
      tx.delete(transactionRevisionTable)
        .where(
          and(
            eq(transactionRevisionTable.transactionId, id),
            gte(transactionRevisionTable.effectiveFrom, effectiveFrom),
          ),
        )
        .run();
      tx.insert(transactionRevisionTable)
        .values({ transactionId: id, effectiveFrom, ...values })
        .run();
      tx.update(transactionTable)
        .set({ updatedAt: new Date() })
        .where(eq(transactionTable.id, id))
        .run();
    });
  }

  stopFrom(id: string, date: string): void {
    this.db.transaction((tx) => {
      tx.delete(transactionRevisionTable)
        .where(
          and(
            eq(transactionRevisionTable.transactionId, id),
            gte(transactionRevisionTable.effectiveFrom, date),
          ),
        )
        .run();
      tx.delete(transactionSettlementTable)
        .where(
          and(
            eq(transactionSettlementTable.transactionId, id),
            gte(transactionSettlementTable.occurrenceDate, date),
          ),
        )
        .run();
      tx.update(transactionTable)
        .set({ stopDate: date, updatedAt: new Date() })
        .where(eq(transactionTable.id, id))
        .run();
    });
  }

  deleteTransaction(id: string): void {
    this.db.delete(transactionTable).where(eq(transactionTable.id, id)).run();
  }

  insertSettlement(input: { transactionId: string; occurrenceDate: string } & TransactionValues): void {
    this.db.insert(transactionSettlementTable).values({ ...input, settledAt: new Date() }).run();
  }

  updateSettlement(transactionId: string, occurrenceDate: string, values: TransactionValues): void {
    this.db
      .update(transactionSettlementTable)
      .set(values)
      .where(
        and(
          eq(transactionSettlementTable.transactionId, transactionId),
          eq(transactionSettlementTable.occurrenceDate, occurrenceDate),
        ),
      )
      .run();
  }

  deleteSettlement(transactionId: string, occurrenceDate: string): void {
    this.db
      .delete(transactionSettlementTable)
      .where(
        and(
          eq(transactionSettlementTable.transactionId, transactionId),
          eq(transactionSettlementTable.occurrenceDate, occurrenceDate),
        ),
      )
      .run();
  }

  private revisionsOf(ids: string[]): TransactionRevision[] {
    return this.db
      .select()
      .from(transactionRevisionTable)
      .where(inArray(transactionRevisionTable.transactionId, ids))
      .orderBy(asc(transactionRevisionTable.effectiveFrom))
      .all();
  }

  private mapDefinition(row: typeof transactionTable.$inferSelect): TransactionDefinition {
    return {
      id: row.id,
      userId: row.userId,
      startDate: row.startDate,
      recurrence: row.frequency,
      instalment:
        row.instalmentStartNumber !== null && row.instalmentTotal !== null
          ? { startNumber: row.instalmentStartNumber, total: row.instalmentTotal }
          : null,
      stopDate: row.stopDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSettlement(row: typeof transactionSettlementTable.$inferSelect): TransactionSettlement {
    return { ...row };
  }
}
