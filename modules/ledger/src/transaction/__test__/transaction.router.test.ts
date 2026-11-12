import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountRepository } from '../../account/account.repository.js';
import { AccountService } from '../../account/account.service.js';
import { CategoryRepository } from '../../category/category.repository.js';
import { CategoryService } from '../../category/category.service.js';
import { createTransactionRouter } from '../transaction.controller.js';
import { TransactionRepository } from '../transaction.repository.js';
import { TransactionService } from '../transaction.service.js';

// Integration: router, service, repository and a real SQLite database, called over HTTP.
const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../shared/persistence/migrations',
);
const ALICE = 'alice';
const BOB = 'bob';

let sqlite: Database.Database;
let server: Server;
let base: string;
let alice: { categoryId: string; categoryId2: string; accountId: string };
let bob: { categoryId: string; accountId: string };

beforeEach(async () => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const accounts = new AccountService(new AccountRepository(db), 99);
  const categories = new CategoryService(new CategoryRepository(db));
  alice = {
    categoryId: categories.createCategory({ userId: ALICE, name: 'Housing' }).id,
    categoryId2: categories.createCategory({ userId: ALICE, name: 'Shopping' }).id,
    accountId: accounts.createAccount({ userId: ALICE, name: 'Checking Account' }).id,
  };
  bob = {
    categoryId: categories.createCategory({ userId: BOB, name: 'Housing' }).id,
    accountId: accounts.createAccount({ userId: BOB, name: 'Checking Account' }).id,
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/transactions',
    createTransactionRouter(new TransactionService(new TransactionRepository(db), accounts, categories)),
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
  sqlite.close();
});

async function call(method: string, url: string, userId: string | null, body?: unknown) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(userId === null ? {} : { 'x-user-id': userId }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : null };
}

const monthly = (overrides: Record<string, unknown> = {}) => ({
  date: '2026-11-05',
  description: 'Condo fees',
  categoryId: alice.categoryId,
  accountId: alice.accountId,
  amount: '20',
  type: 'debit',
  recurrence: 'monthly',
  ...overrides,
});

async function createFor(userId: string, body: Record<string, unknown>): Promise<string> {
  const response = await call('POST', '/transactions', userId, body);
  expect(response.status).toBe(201);
  return response.body?.id as string;
}

async function amountsIn(month: string, userId: string = ALICE) {
  const response = await call('GET', `/transactions?month=${month}`, userId);
  return (response.body?.occurrences as Record<string, string>[]).map((o) => [o.date, o.amount, o.status]);
}

describe('transaction routes (HTTP)', () => {
  it('C1 POST /transactions returns 201 with the transaction fields and a canonical amount', async () => {
    const response = await call('POST', '/transactions', ALICE, {
      date: '2026-11-01',
      description: 'Salary - Acme',
      categoryId: alice.categoryId,
      accountId: alice.accountId,
      amount: '1000.00',
      type: 'receipt',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      userId: ALICE,
      date: '2026-11-01',
      description: 'Salary - Acme',
      categoryId: alice.categoryId,
      accountId: alice.accountId,
      type: 'receipt',
      amount: '1000',
      recurrence: null,
      instalment: null,
    });
    expect(response.body?.id).toMatch(/^[0-9a-f-]{36}$/);
    for (const field of ['createdAt', 'updatedAt']) {
      expect(new Date(response.body?.[field]).toISOString()).toBe(response.body?.[field]);
    }

    for (const [sent, stored] of [['229.00', '229'], ['0.5', '0.5'], ['20', '20']] as const) {
      const created = await call('POST', '/transactions', ALICE, monthly({ amount: sent, recurrence: undefined }));
      expect(created.body?.amount).toBe(stored);
    }
  });

  it('C4 PATCH and settlement reject an invalid amount with 400 and change nothing', async () => {
    const id = await createFor(ALICE, monthly());

    for (const amount of ['0', '-5', '1,5', 'abc', 229, '12.12345']) {
      expect((await call('PATCH', `/transactions/${id}/occurrences/2026-11-05`, ALICE, { amount })).status).toBe(400);
      expect(
        (await call('PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, ALICE, { amount })).status,
      ).toBe(400);
    }

    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
  });

  it('C7 POST and PATCH answer 400 naming the field for a bad reference', async () => {
    const { status, body } = await call('POST', '/transactions', ALICE, monthly({ accountId: bob.accountId }));
    expect(status).toBe(400);
    expect(body?.detail).toMatch(/accountId/);

    const missing = await call('POST', '/transactions', ALICE, { ...monthly(), categoryId: undefined });
    expect(missing.status).toBe(400);
    expect(missing.body?.detail).toMatch(/categoryId/);

    const id = await createFor(ALICE, monthly());
    const toNull = await call('PATCH', `/transactions/${id}/occurrences/2026-11-05`, ALICE, { categoryId: null });
    expect(toNull.status).toBe(400);
    const unknown = await call('PATCH', `/transactions/${id}/occurrences/2026-11-05`, ALICE, { categoryId: 'nope' });
    expect(unknown.status).toBe(400);
    expect(unknown.body?.detail).toMatch(/categoryId/);
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
  });

  it('C9 fields outside the contract are ignored', async () => {
    const before = Date.now();
    const created = await call(
      'POST',
      '/transactions',
      ALICE,
      monthly({
        id: 'chosen-by-caller',
        userId: 'mallory',
        createdAt: '2000-01-01T00:00:00.000Z',
        status: 'settled',
        stopDate: '2026-11-06',
        limit: 1,
      }),
    );

    expect(created.status).toBe(201);
    expect(created.body?.id).not.toBe('chosen-by-caller');
    expect(created.body?.userId).toBe(ALICE);
    expect(new Date(created.body?.createdAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(await amountsIn('2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
  });

  it('C14 GET with a bad month returns 400', async () => {
    for (const query of ['', '?month=2026-13', '?month=2026-1', '?month=2026-11-05']) {
      expect((await call('GET', `/transactions${query}`, ALICE)).status).toBe(400);
    }
  });

  it('C31 a date that is not an occurrence returns 404 for settle edit and delete', async () => {
    const monthlyId = await createFor(ALICE, monthly());
    const instalmentId = await createFor(
      ALICE,
      monthly({ date: '2026-11-15', recurrence: undefined, instalment: { number: 1, total: 2 } }),
    );
    const cases: [string, string][] = [
      [monthlyId, '2026-11-06'],
      [monthlyId, '2026-10-05'],
      [monthlyId, 'not-a-date'],
      [instalmentId, '2027-01-15'],
    ];

    for (const [id, date] of cases) {
      const url = `/transactions/${id}/occurrences/${date}`;
      expect((await call('PATCH', url, ALICE, { amount: '1' })).status, `PATCH ${date}`).toBe(404);
      expect((await call('DELETE', url, ALICE)).status, `DELETE ${date}`).toBe(404);
      expect((await call('PUT', `${url}/settlement`, ALICE, {})).status, `PUT ${date}`).toBe(404);
      expect((await call('DELETE', `${url}/settlement`, ALICE)).status, `DELETE settlement ${date}`).toBe(404);
    }
    expect(await amountsIn('2026-11')).toHaveLength(2);
  });

  it('C38 an empty edit returns 400 and schedule fields are ignored', async () => {
    const id = await createFor(ALICE, monthly());
    const url = `/transactions/${id}/occurrences/2026-11-05`;

    expect((await call('PATCH', url, ALICE, {})).status).toBe(400);
    expect(
      (await call('PATCH', url, ALICE, { date: '2030-01-01', recurrence: 'daily', instalment: { number: 1, total: 2 } }))
        .status,
    ).toBe(400);

    const edited = await call('PATCH', url, ALICE, {
      amount: '21',
      date: '2030-01-01',
      recurrence: 'daily',
      instalment: { number: 1, total: 2 },
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ date: '2026-11-05', amount: '21', recurrence: 'monthly', instalment: null });
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '21', 'forecast']]);
  });

  it('C49 every route returns 401 without a user id', async () => {
    const id = await createFor(ALICE, monthly());
    const routes: [string, string, unknown?][] = [
      ['POST', '/transactions', monthly()],
      ['GET', '/transactions?month=2026-11'],
      ['PATCH', `/transactions/${id}/occurrences/2026-11-05`, { amount: '1' }],
      ['DELETE', `/transactions/${id}/occurrences/2026-11-05`],
      ['PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, {}],
      ['DELETE', `/transactions/${id}/occurrences/2026-11-05/settlement`],
    ];

    for (const [method, url, body] of routes) {
      for (const userId of [null, '', '   ']) {
        const response = await fetch(`${base}${url}`, {
          method,
          headers: {
            ...(userId === null ? {} : { 'x-user-id': userId }),
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        expect(response.status, `${method} ${url} with user ${JSON.stringify(userId)}`).toBe(401);
      }
    }
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
  });

  it('C50 another user\'s or unknown transaction returns 404 and changes nothing', async () => {
    const bobsId = await createFor(BOB, monthly({ categoryId: bob.categoryId, accountId: bob.accountId }));
    await call('PUT', `/transactions/${bobsId}/occurrences/2026-11-05/settlement`, BOB, {});

    for (const id of [bobsId, 'unknown-id']) {
      const url = `/transactions/${id}/occurrences/2026-11-05`;
      expect((await call('PATCH', url, ALICE, { amount: '1' })).status).toBe(404);
      expect((await call('DELETE', url, ALICE)).status).toBe(404);
      expect((await call('PUT', `${url}/settlement`, ALICE, {})).status).toBe(404);
      expect((await call('DELETE', `${url}/settlement`, ALICE)).status).toBe(404);
    }

    expect(await amountsIn('2026-11', BOB)).toEqual([['2026-11-05', '20', 'settled']]);
    expect(await amountsIn('2026-12', BOB)).toEqual([['2026-12-05', '20', 'forecast']]);
  });

  const nothingSaved = async () => {
    for (const month of ['2026-11', '2026-12']) expect(await amountsIn(month)).toEqual([]);
  };

  it('C3 POST with a bad type returns 400 and saves nothing', async () => {
    for (const type of ['Debit', 'expense', undefined]) {
      expect((await call('POST', '/transactions', ALICE, monthly({ type }))).status).toBe(400);
    }
    await nothingSaved();
  });

  it('C4 POST with a bad amount returns 400 and saves nothing', async () => {
    for (const amount of ['0', '-5', '1,5', 'abc', 229, '12.12345', '1234567890123', undefined]) {
      expect((await call('POST', '/transactions', ALICE, monthly({ amount }))).status).toBe(400);
    }
    await nothingSaved();
  });

  it('C5 POST and PATCH with a bad description return 400 and save nothing', async () => {
    for (const description of ['', '   ', 'x'.repeat(101), undefined]) {
      expect((await call('POST', '/transactions', ALICE, monthly({ description }))).status).toBe(400);
    }
    await nothingSaved();

    const id = await createFor(ALICE, monthly());
    for (const description of ['', '   ', 'x'.repeat(101)]) {
      expect(
        (await call('PATCH', `/transactions/${id}/occurrences/2026-11-05`, ALICE, { description })).status,
      ).toBe(400);
    }
    const trimmed = await call('PATCH', `/transactions/${id}/occurrences/2026-11-05`, ALICE, {
      description: '  Gym  ',
    });
    expect(trimmed.body?.description).toBe('Gym');
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
  });

  it('C6 POST with a bad date returns 400 and saves nothing', async () => {
    for (const date of ['2026-02-30', '2026-1-5', '05/11/2026', '', undefined]) {
      expect((await call('POST', '/transactions', ALICE, monthly({ date }))).status).toBe(400);
    }
    await nothingSaved();
    expect((await call('POST', '/transactions', ALICE, monthly({ date: '2028-02-29' }))).status).toBe(201);
  });

  it('C11 GET of an empty month returns 200 with an occurrences envelope', async () => {
    const response = await call('GET', '/transactions?month=2026-11', ALICE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ occurrences: [] });
  });

  it('C22 instalment occurrences carry recurrence null and the POST response carries the plan', async () => {
    const instalment = await call(
      'POST',
      '/transactions',
      ALICE,
      monthly({ date: '2026-11-15', recurrence: undefined, instalment: { number: 97, total: 504 } }),
    );
    expect(instalment.status).toBe(201);
    expect(instalment.body).toMatchObject({ recurrence: null, instalment: { number: 97, total: 504 } });

    const recurring = await call('POST', '/transactions', ALICE, monthly({ recurrence: 'weekly' }));
    expect(recurring.body).toMatchObject({ recurrence: 'weekly', instalment: null });

    const occurrences = (await call('GET', '/transactions?month=2026-12', ALICE)).body
      ?.occurrences as Record<string, unknown>[];
    const loan = occurrences.find((o) => o.transactionId === instalment.body?.id);
    expect(loan).toMatchObject({ date: '2026-12-15', recurrence: null, instalment: { number: 98, total: 504 } });
  });

  it('C26 PUT settlement returns 200 with the settled occurrence', async () => {
    const id = await createFor(ALICE, monthly());

    const response = await call('PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, ALICE, {});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ transactionId: id, date: '2026-11-05', status: 'settled', amount: '20' });
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'settled']]);
    expect(await amountsIn('2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
  });

  it('C28 settling twice returns 409 over HTTP and changes nothing', async () => {
    const id = await createFor(ALICE, monthly());
    const url = `/transactions/${id}/occurrences/2026-11-05/settlement`;
    await call('PUT', url, ALICE, { amount: '22' });

    const again = await call('PUT', url, ALICE, { amount: '30' });

    expect(again.status).toBe(409);
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '22', 'settled']]);
  });

  it('C29 undo returns 200 with the forecast and undoing a forecast returns 409 over HTTP', async () => {
    const id = await createFor(ALICE, monthly());
    const url = `/transactions/${id}/occurrences/2026-11-05/settlement`;
    await call('PUT', url, ALICE, { amount: '22' });

    const undone = await call('DELETE', url, ALICE);

    expect(undone.status).toBe(200);
    expect(undone.body).toMatchObject({ status: 'forecast', amount: '20', date: '2026-11-05' });
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'forecast']]);
    expect((await call('DELETE', url, ALICE)).status).toBe(409);
  });

  it('C40 DELETE returns 204 and the stopped dates leave the real listing', async () => {
    const id = await createFor(ALICE, monthly());
    await call('PUT', `/transactions/${id}/occurrences/2026-11-05/settlement`, ALICE, {});
    await call('PUT', `/transactions/${id}/occurrences/2027-02-05/settlement`, ALICE, {});

    const stopped = await call('DELETE', `/transactions/${id}/occurrences/2027-01-05`, ALICE);

    expect(stopped.status).toBe(204);
    expect(await amountsIn('2026-11')).toEqual([['2026-11-05', '20', 'settled']]);
    expect(await amountsIn('2026-12')).toEqual([['2026-12-05', '20', 'forecast']]);
    expect(await amountsIn('2027-01')).toEqual([]);
    expect(await amountsIn('2027-02')).toEqual([]);
    expect(await amountsIn('2031-01')).toEqual([]);
  });

  it('C42 a stopped date returns 404 over HTTP', async () => {
    const id = await createFor(ALICE, monthly());
    await call('DELETE', `/transactions/${id}/occurrences/2027-01-05`, ALICE);
    const url = `/transactions/${id}/occurrences/2027-01-05`;

    expect((await call('PATCH', url, ALICE, { amount: '1' })).status).toBe(404);
    expect((await call('PUT', `${url}/settlement`, ALICE, {})).status).toBe(404);
    expect((await call('DELETE', url, ALICE)).status).toBe(404);
    expect((await call('DELETE', `/transactions/${id}/occurrences/2027-03-05`, ALICE)).status).toBe(404);
  });

  it('C51 two users with data each list only their own over real SQL', async () => {
    await createFor(ALICE, monthly({ description: 'Gym', recurrence: undefined }));
    await createFor(ALICE, monthly({ description: 'Condo fees' }));
    await createFor(BOB, monthly({ description: 'Rent', categoryId: bob.categoryId, accountId: bob.accountId }));

    const names = async (userId: string) =>
      ((await call('GET', '/transactions?month=2026-11', userId)).body?.occurrences as { description: string }[]).map(
        (o) => o.description,
      );

    expect(await names(ALICE)).toEqual(['Condo fees', 'Gym']);
    expect(await names(BOB)).toEqual(['Rent']);
    expect(await names('carol')).toEqual([]);
  });
});
