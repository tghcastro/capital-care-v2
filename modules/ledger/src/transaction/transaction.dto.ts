import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { isValidDate } from './transaction.schedule.js';

export const DESCRIPTION_MAX_LENGTH = 100;
export const INSTALMENT_TOTAL_MAX = 999;

export const transactionTypeSchema = z.enum(['receipt', 'debit'], 'type must be receipt or debit');
export const recurrenceSchema = z.enum(
  ['daily', 'weekly', 'monthly', 'annually'],
  'recurrence must be daily, weekly, monthly or annually',
);

export const dateSchema = z
  .string('date is required')
  .refine(isValidDate, { message: 'date must be a real date written YYYY-MM-DD' });

const AMOUNT_MAX_INTEGER_DIGITS = 12;

/**
 * A positive decimal string, at most 12 integer digits and 4 decimals; the result is canonical.
 * Leading zeros are ignored when counting digits: "000000000005" is 5.
 */
export const amountSchema = z
  .string('amount must be a string')
  .regex(/^\d+(\.\d{1,4})?$/, {
    message: 'amount must be a decimal with at most 12 integer digits and 4 decimals',
    // Stop here: the checks below read the value as a number, which this pattern guarantees.
    abort: true,
  })
  .refine((value) => new Decimal(value).trunc().toFixed().length <= AMOUNT_MAX_INTEGER_DIGITS, {
    message: 'amount must be a decimal with at most 12 integer digits and 4 decimals',
  })
  .refine((value) => new Decimal(value).gt(0), { message: 'amount must be greater than zero' })
  .transform((value) => new Decimal(value).toFixed());

/** A description: trimmed, 1 to 100 characters. */
export const descriptionSchema = z
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

const referenceSchema = (field: string) =>
  z.string(`${field} is required`).min(1, `${field} is required`);

export const instalmentSchema = z
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
  });

export const createTransactionSchema = z
  .object({
    date: dateSchema,
    description: descriptionSchema,
    categoryId: referenceSchema('categoryId'),
    accountId: referenceSchema('accountId'),
    amount: amountSchema,
    type: transactionTypeSchema,
    recurrence: recurrenceSchema.optional(),
    instalment: instalmentSchema.optional(),
  })
  .refine((value) => !(value.recurrence !== undefined && value.instalment !== undefined), {
    message: 'recurrence and instalment cannot be used together',
  });

export const updateTransactionSchema = z
  .object({
    description: descriptionSchema.optional(),
    categoryId: referenceSchema('categoryId').optional(),
    accountId: referenceSchema('accountId').optional(),
    amount: amountSchema.optional(),
    type: transactionTypeSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'at least one of description, categoryId, accountId, amount, type is required',
  });

export const settleSchema = z.object({ amount: amountSchema.optional() });

export const monthSchema = z
  .string('month is required')
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be written YYYY-MM' });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type SettleInput = z.infer<typeof settleSchema>;
