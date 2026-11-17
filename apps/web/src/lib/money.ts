import { Decimal } from 'decimal.js';

const formatter = new Intl.NumberFormat('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Display form of a money value: grouping and exactly two decimals, rounded half up. */
export function formatAmount(value: Decimal.Value): string {
  return formatter.format(new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) as unknown as number);
}
