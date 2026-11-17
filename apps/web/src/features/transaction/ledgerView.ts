import type { Occurrence } from '@capital-care/shared';
import { Decimal } from 'decimal.js';

/** The id of the "Uncategorized" / "Unassigned" pseudo-entry: it matches a null reference. */
export const NONE = '__none__';

export interface Filters {
  categories: ReadonlySet<string>;
  accounts: ReadonlySet<string>;
}

export interface DayGroup {
  date: string;
  items: Occurrence[];
  /** Available balance after this day's items, starting from 0 at the month's start (AD-003). */
  balance: string;
}

export interface Totals {
  received: string;
  debits: string;
  net: string;
  finalBalance: string;
}

function matches(selected: ReadonlySet<string>, id: string | null): boolean {
  return selected.size === 0 || selected.has(id ?? NONE);
}

/** Filters, orders by date, groups by day and computes the running balance and totals. */
export function buildLedger(
  occurrences: readonly Occurrence[],
  filters: Filters
): { groups: DayGroup[]; totals: Totals } {
  const visible = occurrences
    .filter(
      (o) => matches(filters.categories, o.categoryId) && matches(filters.accounts, o.accountId)
    )
    .map((o, index) => ({ o, index }))
    .sort((a, b) => a.o.date.localeCompare(b.o.date) || a.index - b.index)
    .map(({ o }) => o);

  let received = new Decimal(0);
  let debits = new Decimal(0);
  const groups: DayGroup[] = [];
  for (const item of visible) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== item.date) {
      group = { date: item.date, items: [], balance: '0' };
      groups.push(group);
    }
    group.items.push(item);
    if (item.type === 'receipt') received = received.plus(item.amount);
    else debits = debits.plus(item.amount);
    group.balance = received.minus(debits).toFixed();
  }
  const net = received.minus(debits);
  return {
    groups,
    totals: {
      received: received.toFixed(),
      debits: debits.toFixed(),
      net: net.toFixed(),
      finalBalance: net.toFixed(),
    },
  };
}
