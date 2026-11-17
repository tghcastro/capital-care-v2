import { Decimal } from 'decimal.js';
import { z } from 'zod';

// Request schema for creating a transaction, written to match the API's own validation messages
// so the web form reports the same text the API would. Calendar dates are `YYYY-MM-DD` text.

export const DESCRIPTION_MAX_LENGTH = 100;
export const INSTALMENT_TOTAL_MAX = 999;

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 0;
  return m >= 1 && m <= 12 && d >= 1 && d <= days;
}

const amountSchema = z
  .string('amount must be a string')
  .regex(/^\d+(\.\d{1,4})?$/, {
    message: 'amount must be a decimal with at most 12 integer digits and 4 decimals',
    abort: true,
  })
  .refine((value) => new Decimal(value).trunc().toFixed().length <= 12, {
    message: 'amount must be a decimal with at most 12 integer digits and 4 decimals',
  })
  .refine((value) => new Decimal(value).gt(0), { message: 'amount must be greater than zero' })
  .transform((value) => new Decimal(value).toFixed());

const descriptionSchema = z
  .string('description is required')
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, 'description is required')
      .refine((value) => [...value].length <= DESCRIPTION_MAX_LENGTH, {
        message: `description must not exceed ${DESCRIPTION_MAX_LENGTH} characters`,
      }),
  );

export const recurrenceSchema = z.enum(
  ['daily', 'weekly', 'monthly', 'annually'],
  'recurrence must be daily, weekly, monthly or annually',
);

export const createTransactionSchema = z
  .object({
    date: z
      .string('date is required')
      .refine(isValidDate, { message: 'date must be a real date written YYYY-MM-DD' }),
    description: descriptionSchema,
    categoryId: z.string('categoryId is required').min(1, 'categoryId is required'),
    accountId: z.string('accountId is required').min(1, 'accountId is required'),
    amount: amountSchema,
    type: z.enum(['receipt', 'debit'], 'type must be receipt or debit'),
    recurrence: recurrenceSchema.optional(),
    instalment: z
      .object({
        number: z.number('instalment.number must be a whole number').int().min(1),
        total: z
          .number('instalment.total must be a whole number')
          .int()
          .min(1)
          .max(INSTALMENT_TOTAL_MAX, `instalment.total must not exceed ${INSTALMENT_TOTAL_MAX}`),
      })
      .refine((value) => value.number <= value.total, {
        message: 'instalment.number must not exceed instalment.total',
      })
      .optional(),
  })
  .refine((value) => !(value.recurrence !== undefined && value.instalment !== undefined), {
    message: 'recurrence and instalment cannot be used together',
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
