import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeLedgerDatabase, createLedgerRouters, migrateLedger } from '@capital-care/ledger';
import { createApp } from '../src/app.js';

// Component: the whole API app, with the real category and account services, on a disposable database.
const ALICE = 'alice';
let dir: string;
let server: Server | undefined;
let base: string;
const savedDbPath = process.env.DB_PATH;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-transactions-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  migrateLedger(process.env.DB_PATH);

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server?.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterEach(async () => {
  const running = server;
  if (running) await new Promise((resolve) => running.close(resolve));
  server = undefined;
  closeLedgerDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
  if (savedDbPath === undefined) Reflect.deleteProperty(process.env, 'DB_PATH');
  else process.env.DB_PATH = savedDbPath;
});

async function call(method: string, url: string, body?: unknown) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      'x-user-id': ALICE,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
}

async function idOf(url: string, body: unknown): Promise<string> {
  const response = await call('POST', url, body);
  expect(response.status).toBe(201);
  return response.body?.id as string;
}

async function month(value: string) {
  const response = await call('GET', `/transactions?month=${value}`);
  expect(response.status).toBe(200);
  return response.body?.occurrences as Record<string, unknown>[];
}

const transaction = (categoryId: string, accountId: string, overrides: Record<string, unknown> = {}) => ({
  date: '2026-11-05',
  description: 'Condo fees',
  categoryId,
  accountId,
  amount: '450',
  type: 'debit',
  recurrence: 'monthly',
  ...overrides,
});

describe('API app: transactions', () => {
  it('C45 deleting a used category keeps the transactions with a null category', async () => {
    const housing = await idOf('/categories', { name: 'Housing' });
    const account = await idOf('/accounts', { name: 'Checking Account' });
    const id = await idOf('/transactions', transaction(housing, account));
    await call('PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, {});
    const before = await month('2026-12');

    expect((await call('DELETE', `/categories/${housing}`)).status).toBe(204);

    const nov = await month('2026-11');
    const dec = await month('2026-12');
    expect(nov).toEqual([{ ...nov[0], categoryId: null, accountId: account, status: 'settled', amount: '450' }]);
    expect(dec).toEqual([{ ...before[0], categoryId: null }]);
    expect(dec[0]).toMatchObject({ description: 'Condo fees', status: 'forecast', accountId: account });
  });

  it('C46 deleting a used account keeps the transactions with a null account', async () => {
    const housing = await idOf('/categories', { name: 'Housing' });
    const card = await idOf('/accounts', { name: 'Credit Card' });
    const id = await idOf('/transactions', transaction(housing, card, { description: 'Gym', amount: '50' }));
    await call('PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, {});

    expect((await call('DELETE', `/accounts/${card}`)).status).toBe(204);

    for (const value of ['2026-11', '2026-12', '2027-06']) {
      const occurrences = await month(value);
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]).toMatchObject({ accountId: null, categoryId: housing, description: 'Gym', amount: '50' });
    }
    expect((await month('2026-11'))[0]?.status).toBe('settled');
  });

  it('C47 only occurrences that used the deleted category lose it', async () => {
    const housing = await idOf('/categories', { name: 'Housing' });
    const groceries = await idOf('/categories', { name: 'Groceries' });
    const account = await idOf('/accounts', { name: 'Checking Account' });
    await idOf('/transactions', transaction(housing, account));
    await idOf(
      '/transactions',
      transaction(groceries, account, { description: 'Weekly shopping', date: '2026-11-12', amount: '80' }),
    );

    await call('DELETE', `/categories/${housing}`);

    const occurrences = await month('2026-11');
    expect(occurrences.map((o) => [o.description, o.categoryId])).toEqual([
      ['Condo fees', null],
      ['Weekly shopping', groceries],
    ]);
  });

  it('C48 editing a description keeps a null category', async () => {
    const housing = await idOf('/categories', { name: 'Housing' });
    const account = await idOf('/accounts', { name: 'Checking Account' });
    const id = await idOf('/transactions', transaction(housing, account));
    await call('DELETE', `/categories/${housing}`);

    const edited = await call('PATCH', `/transactions/${id}/occurrences/2026-12-05`, { description: 'Condo' });

    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ categoryId: null, description: 'Condo', accountId: account });
    expect((await month('2027-01'))[0]).toMatchObject({ categoryId: null, description: 'Condo' });
  });

  it('C55 the app serves the transaction contract under /transactions', async () => {
    const housing = await idOf('/categories', { name: 'Housing' });
    const account = await idOf('/accounts', { name: 'Checking Account' });

    const created = await call('POST', '/transactions', transaction(housing, account, { amount: '1200.00', type: 'receipt', recurrence: 'annually' }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ type: 'receipt', recurrence: 'annually', amount: '1200', instalment: null });
    expect(typeof created.body?.amount).toBe('string');

    const id = created.body?.id as string;
    expect(Object.keys((await month('2026-11'))[0] ?? {}).sort()).toEqual(
      [
        'accountId',
        'amount',
        'categoryId',
        'date',
        'description',
        'instalment',
        'recurrence',
        'status',
        'transactionId',
        'type',
      ].sort(),
    );
    const settled = await call('PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, {});
    expect(settled.body).toMatchObject({ status: 'settled', transactionId: id, date: '2026-11-05' });
    const singular = await fetch(`${base}/transaction?month=2026-11`, { headers: { 'x-user-id': ALICE } });
    expect(singular.status).toBe(404);

    // Both assemblies that boot the module hand out the router: the module and the app above.
    expect(typeof createLedgerRouters().transactionRouter).toBe('function');
  });
});
