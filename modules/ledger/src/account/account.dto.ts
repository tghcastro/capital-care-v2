import { z } from 'zod';

export const ACCOUNT_NAME_MAX_LENGTH = 30;

// \p{M}: combining marks, which many scripts need to spell a letter (Devanagari, Thai, Hebrew).
const ACCOUNT_NAME_CHARACTERS = /^[\p{L}\p{M}\p{Nd} ]+$/u;

/**
 * An account name: trimmed, 1 to 30 characters, letters of any language, digits and spaces.
 * The result is trimmed and in Unicode NFC form, so the same name typed two ways is one name.
 */
export const accountNameSchema = z
  .string('name is required')
  .transform((value) => value.trim().normalize('NFC'))
  .pipe(
    z
      .string()
      .min(1, 'name is required')
      .refine((value) => [...value].length <= ACCOUNT_NAME_MAX_LENGTH, {
        message: `name must not exceed ${ACCOUNT_NAME_MAX_LENGTH} characters`,
      })
      .regex(ACCOUNT_NAME_CHARACTERS, {
        message: 'name may contain only letters, digits and spaces',
      }),
  );

export const createAccountSchema = z.object({ name: accountNameSchema });
export const updateAccountSchema = z.object({ name: accountNameSchema });

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/** The case-insensitive identity of a name: two names with the same key are the same name. */
export function toAccountNameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}
