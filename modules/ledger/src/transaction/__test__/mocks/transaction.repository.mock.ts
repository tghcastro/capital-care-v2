import { v4 as uuidv4 } from 'uuid';
import type { ITransactionRepository, NewTransaction } from '../../transaction.repository.js';
import type {
  TransactionBundle,
  TransactionDefinition,
  TransactionRevision,
  TransactionSettlement,
  TransactionValues,
} from '../../transaction.types.js';

/** In-memory repository: same semantics as the SQLite one, with no database. */
export class InMemoryTransactionRepository implements ITransactionRepository {
  definitions = new Map<string, TransactionDefinition>();
  revisions: TransactionRevision[] = [];
  settlements: TransactionSettlement[] = [];

  create(input: NewTransaction): TransactionBundle {
    const now = new Date();
    const definition: TransactionDefinition = {
      id: uuidv4(),
      userId: input.userId,
      startDate: input.startDate,
      recurrence: input.recurrence,
      instalment: input.instalment,
      stopDate: null,
      createdAt: now,
      updatedAt: now,
    };
    this.definitions.set(definition.id, definition);
    this.revisions.push({ transactionId: definition.id, effectiveFrom: input.startDate, ...input.values });
    return this.bundle(definition);
  }

  getBundle(id: string): TransactionBundle | null {
    const definition = this.definitions.get(id);
    return definition ? this.bundle(definition) : null;
  }

  listBundlesInRange(userId: string, from: string, to: string): TransactionBundle[] {
    return [...this.definitions.values()]
      .filter(
        (d) =>
          d.userId === userId && d.startDate <= to && (d.stopDate === null || d.stopDate > from),
      )
      .map((d) => {
        const bundle = this.bundle(d);
        return {
          ...bundle,
          settlements: bundle.settlements.filter((s) => s.occurrenceDate >= from && s.occurrenceDate <= to),
        };
      });
  }

  replaceRevisionsFrom(id: string, effectiveFrom: string, values: TransactionValues): void {
    this.revisions = this.revisions.filter(
      (r) => !(r.transactionId === id && r.effectiveFrom >= effectiveFrom),
    );
    this.revisions.push({ transactionId: id, effectiveFrom, ...values });
  }

  stopFrom(id: string, date: string): void {
    this.revisions = this.revisions.filter((r) => !(r.transactionId === id && r.effectiveFrom >= date));
    this.settlements = this.settlements.filter(
      (s) => !(s.transactionId === id && s.occurrenceDate >= date),
    );
    const definition = this.definitions.get(id);
    if (definition) definition.stopDate = date;
  }

  deleteTransaction(id: string): void {
    this.definitions.delete(id);
    this.revisions = this.revisions.filter((r) => r.transactionId !== id);
    this.settlements = this.settlements.filter((s) => s.transactionId !== id);
  }

  insertSettlement(input: { transactionId: string; occurrenceDate: string } & TransactionValues): void {
    this.settlements.push({ ...input, settledAt: new Date() });
  }

  updateSettlement(transactionId: string, occurrenceDate: string, values: TransactionValues): void {
    this.settlements = this.settlements.map((s) =>
      s.transactionId === transactionId && s.occurrenceDate === occurrenceDate ? { ...s, ...values } : s,
    );
  }

  deleteSettlement(transactionId: string, occurrenceDate: string): void {
    this.settlements = this.settlements.filter(
      (s) => !(s.transactionId === transactionId && s.occurrenceDate === occurrenceDate),
    );
  }

  private bundle(definition: TransactionDefinition): TransactionBundle {
    return {
      definition: { ...definition },
      revisions: this.revisions
        .filter((r) => r.transactionId === definition.id)
        .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
      settlements: this.settlements.filter((s) => s.transactionId === definition.id),
    };
  }
}
