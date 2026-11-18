import type { MonthBalance, Occurrence } from '@capital-care/shared';

/** The id of the "Uncategorized" / "Unassigned" pseudo-entry: it matches a null reference. */
export const NONE = '__none__';

export interface DayGroup {
  date: string;
  items: Occurrence[];
  /** The balance after this day, from GET /transactions/balance; null until it answers. */
  balance: string | null;
}

/**
 * Groups the occurrences the API listed by day, ascending, keeping the API's order inside a day,
 * and attaches each day's balance from the balance route. No balance is computed here.
 */
export function groupByDay(
  occurrences: readonly Occurrence[],
  days: MonthBalance['days']
): DayGroup[] {
  const balances = new Map(days.map((d) => [d.date, d.balance]));
  const ordered = occurrences
    .map((o, index) => ({ o, index }))
    .sort((a, b) => a.o.date.localeCompare(b.o.date) || a.index - b.index)
    .map(({ o }) => o);

  const groups: DayGroup[] = [];
  for (const item of ordered) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== item.date) {
      group = { date: item.date, items: [], balance: balances.get(item.date) ?? null };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
