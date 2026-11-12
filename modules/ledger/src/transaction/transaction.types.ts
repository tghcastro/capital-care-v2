export type TransactionType = 'receipt' | 'debit';
export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'annually';
export type OccurrenceStatus = 'forecast' | 'settled';

/** The values of one occurrence: what a user sees and can edit. */
export interface TransactionValues {
  description: string;
  categoryId: string | null;
  accountId: string | null;
  type: TransactionType;
  /** Canonical decimal string, for example "229" or "0.5". */
  amount: string;
}

export interface InstalmentPlan {
  /** The number of the occurrence that falls on the start date. */
  startNumber: number;
  total: number;
}

/** The schedule of a transaction. Calendar dates are `YYYY-MM-DD` text (AD-001). */
export interface TransactionDefinition {
  id: string;
  userId: string;
  startDate: string;
  recurrence: Recurrence | null;
  instalment: InstalmentPlan | null;
  /** Exclusive: occurrences from this date on were removed. */
  stopDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The values in force from `effectiveFrom` until the next revision. */
export interface TransactionRevision extends TransactionValues {
  transactionId: string;
  effectiveFrom: string;
}

/** An occurrence the owner settled, with the values it was settled with. */
export interface TransactionSettlement extends TransactionValues {
  transactionId: string;
  occurrenceDate: string;
  settledAt: Date;
}

export interface TransactionBundle {
  definition: TransactionDefinition;
  /** Ascending by `effectiveFrom`; the first one is effective from the start date. */
  revisions: TransactionRevision[];
  settlements: TransactionSettlement[];
}

/** A transaction as returned on creation: its first occurrence's values. */
export interface Transaction extends TransactionValues {
  id: string;
  userId: string;
  date: string;
  recurrence: Recurrence | null;
  instalment: { number: number; total: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Occurrence extends TransactionValues {
  transactionId: string;
  date: string;
  recurrence: Recurrence | null;
  instalment: { number: number; total: number } | null;
  status: OccurrenceStatus;
}
