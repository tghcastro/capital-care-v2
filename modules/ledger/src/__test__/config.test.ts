import { afterEach, describe, expect, it } from 'vitest';
import { getLedgerConfig } from '../config.js';

const original = process.env.ACCOUNT_LIMIT;

afterEach(() => {
  if (original === undefined) delete process.env.ACCOUNT_LIMIT;
  else process.env.ACCOUNT_LIMIT = original;
});

describe('Ledger config: ACCOUNT_LIMIT', () => {
  it('C23 account limit defaults to 99 and reads valid values', () => {
    delete process.env.ACCOUNT_LIMIT;
    expect(getLedgerConfig().accountLimit).toBe(99);

    for (const [raw, expected] of [['5', 5], ['1', 1], ['99', 99]] as const) {
      process.env.ACCOUNT_LIMIT = raw;
      expect(getLedgerConfig().accountLimit).toBe(expected);
    }
  });

  it('C24 invalid account limit fails with the variable name', () => {
    for (const raw of ['0', '-3', '2.5', 'abc', '', '5abc', '1e1']) {
      process.env.ACCOUNT_LIMIT = raw;
      expect(() => getLedgerConfig(), JSON.stringify(raw)).toThrow(/ACCOUNT_LIMIT/);
    }
  });
});
