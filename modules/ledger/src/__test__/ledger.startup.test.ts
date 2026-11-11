import { afterEach, describe, expect, it } from 'vitest';
import { createLedgerRouters } from '../index.js';

const original = process.env.ACCOUNT_LIMIT;

afterEach(() => {
  if (original === undefined) delete process.env.ACCOUNT_LIMIT;
  else process.env.ACCOUNT_LIMIT = original;
});

describe('Ledger startup', () => {
  it('C25 createLedgerRouters fails to start with an invalid account limit', () => {
    process.env.ACCOUNT_LIMIT = 'abc';

    expect(() => createLedgerRouters()).toThrow(/ACCOUNT_LIMIT/);
  });
});
