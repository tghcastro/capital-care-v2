import { describe, it, expect } from 'vitest';
import { accountNameSchema, createAccountSchema } from '../account.dto.js';

function messageFor(value: unknown): string | undefined {
  const parsed = accountNameSchema.safeParse(value);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

describe('Account name rules', () => {
  it('C8 name rule rejects a missing empty or blank name', () => {
    expect(createAccountSchema.safeParse({}).success).toBe(false);
    expect(messageFor(undefined)).toMatch(/required/);
    expect(messageFor('')).toMatch(/required/);
    expect(messageFor('   ')).toMatch(/required/);
  });

  it('C9 name rule accepts 30 characters and rejects 31', () => {
    expect(accountNameSchema.safeParse('a'.repeat(30)).success).toBe(true);
    expect(messageFor('a'.repeat(31))).toMatch(/30/);

    // Length counts characters as written after normalizing: 30 accented letters, written
    // decomposed (e + combining accent), are still 30; astral-plane letters count once each.
    expect(accountNameSchema.safeParse('e\u0301'.repeat(30)).success).toBe(true);
    expect(messageFor('e\u0301'.repeat(31))).toMatch(/30/);
    expect(accountNameSchema.safeParse('𝒜'.repeat(30)).success).toBe(true);
    expect(messageFor('𝒜'.repeat(31))).toMatch(/30/);
  });

  it('C10 name rule accepts letters digits and spaces only', () => {
    for (const ok of [
      'Conta Poupança',
      'Cartão 2',
      'Σ Bank',
      'Bank A account',
      'नमस्ते',
      'สวัสดี',
      'שָׁלוֹם',
    ]) {
      expect(accountNameSchema.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of ['Bank-A', 'Card #2', 'Money 💰', 'a_b', 'a.b', 'a\tb']) {
      expect(messageFor(bad), bad).toMatch(/letters, digits and spaces/);
    }
  });

  it('C11 name is trimmed before the rules apply', () => {
    expect(accountNameSchema.parse('  Cash  ')).toBe('Cash');

    const padded30 = `  ${'a'.repeat(30)}  `;
    expect(accountNameSchema.parse(padded30)).toBe('a'.repeat(30));

    expect(messageFor(`  ${'a'.repeat(31)}  `)).toMatch(/30/);

    // The same name typed decomposed (c + combining cedilla) is saved in composed form.
    expect(accountNameSchema.parse('Poupanc\u0327a')).toBe('Poupança');
  });
});
