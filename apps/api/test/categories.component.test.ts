import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeLedgerDatabase, migrateLedger } from '@capital-care/ledger';
import { createApp } from '../src/app.js';

// Component: the whole API app on a disposable database, for CAP-8 child categories. The app gets
// a logger that keeps its records, so the log records are read from the composed app.
const ALICE = 'alice';
const BOB = 'bob';
let dir: string;
let server: Server | undefined;
let base: string;
let records: Record<string, unknown>[];
const savedDbPath = process.env.DB_PATH;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-categories-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  migrateLedger(process.env.DB_PATH);
  records = [];
  accountId = undefined;
  const app = createApp({ logger: { info: (record) => void records.push(record) } });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
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

type Json = Record<string, unknown>;

async function call(method: string, url: string, body?: unknown, userId: string | null = ALICE) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(userId === null ? {} : { 'x-user-id': userId }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: text ? (JSON.parse(text) as Json) : null };
}

async function category(
  name: string,
  parentId: string | null = null,
  userId = ALICE
): Promise<string> {
  const response = await call('POST', '/categories', { name, parentId }, userId);
  expect(response.status).toBe(201);
  return response.body?.id as string;
}

interface Node {
  name: string;
  parentId: string | null;
  children: Node[];
}
type Shape = [string, Shape[]];
const shape = (nodes: Node[]): Shape[] => nodes.map((n) => [n.name, shape(n.children)]);

async function tree(query = ''): Promise<Node[]> {
  const response = await call('GET', `/categories${query}`);
  expect(response.status).toBe(200);
  return response.body?.categories as Node[];
}

let accountId: string | undefined;

/** A one-off debit on 2026-11-05; the API needs a category, so `null` uses one deleted afterwards. */
async function transaction(description: string, categoryId: string | null, amount = '10') {
  if (!accountId) {
    const account = await call('POST', '/accounts', { name: 'Checking' });
    accountId = account.body?.id as string;
  }
  const temporary = categoryId === null ? await category('Temporary') : null;
  const response = await call('POST', '/transactions', {
    date: '2026-11-05',
    description,
    categoryId: categoryId ?? temporary,
    accountId,
    amount,
    type: 'debit',
  });
  expect(response.status).toBe(201);
  if (temporary) expect((await call('DELETE', `/categories/${temporary}`)).status).toBe(204);
}

async function descriptions(query: string): Promise<string[]> {
  const response = await call('GET', `/transactions?month=2026-11&${query}`);
  expect(response.status).toBe(200);
  return (response.body?.occurrences as { description: string }[]).map((o) => o.description).sort();
}

describe('API app: POST /categories', () => {
  it('AC1 AC2 answers 201 with parentId null for a root and the parent id for a child', async () => {
    const root = await call('POST', '/categories', { name: 'Food' });
    expect(root.status).toBe(201);
    expect(root.body).toMatchObject({ name: 'Food', parentId: null, description: null });
    const child = await call('POST', '/categories', { name: 'Groceries', parentId: root.body?.id });
    expect(child.status).toBe(201);
    expect(child.body?.parentId).toBe(root.body?.id);
  });

  it('AC3 AC4 AC10 AC13 answers 400, 404, 409 and 401 with their detail', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    const fruit = await category('Fruit', groceries);
    const bobs = await category('Bobs', null, BOB);

    expect(await call('POST', '/categories', { name: 'Apples', parentId: fruit })).toEqual({
      status: 400,
      body: { type: 'ValidationError', detail: 'maximum depth is 3 tiers' },
    });
    expect(await call('POST', '/categories', {})).toEqual({
      status: 400,
      body: { type: 'ValidationError', detail: 'name is required' },
    });
    expect(await call('POST', '/categories', { name: 'Food & Drinks' })).toEqual({
      status: 400,
      body: { type: 'ValidationError', detail: 'name may contain only letters, digits and spaces' },
    });
    expect(await call('POST', '/categories', { name: 'Child', parentId: bobs })).toEqual({
      status: 404,
      body: { type: 'NotFoundError', detail: 'Parent category not found' },
    });
    expect(await call('POST', '/categories', { name: 'FRUIT' })).toEqual({
      status: 409,
      body: { type: 'ConflictError', detail: 'name is taken' },
    });
    expect((await call('POST', '/categories', { name: 'Other' }, null)).status).toBe(401);
  });
});

describe('API app: GET /categories', () => {
  it('AC5 AC6 AC7 answers the nested tree, alphabetical at each level, reversed with sort=-name', async () => {
    expect(await tree()).toEqual([]);
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    await category('Fruit', groceries);
    await category('bakery', food);
    await category('Home');
    await category('Travel', null, BOB);

    const nodes = await tree();
    expect(shape(nodes)).toEqual([
      [
        'Food',
        [
          ['bakery', []],
          ['Groceries', [['Fruit', []]]],
        ],
      ],
      ['Home', []],
    ]);
    expect(nodes[0]).toMatchObject({ parentId: null, description: null });
    expect(nodes[0]?.children[1]?.parentId).toBe(food);
    expect(shape(await tree('?sort=-name'))).toEqual([
      ['Home', []],
      [
        'Food',
        [
          ['Groceries', [['Fruit', []]]],
          ['bakery', []],
        ],
      ],
    ]);
    expect((await call('GET', '/categories', undefined, null)).status).toBe(401);
  });
});

describe('API app: PATCH /categories/:id', () => {
  it('AC16 AC17 moves a branch and answers 200 with the new parentId', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    await category('Fruit', groceries);
    const home = await call('POST', '/categories', { name: 'Home' });

    const moved = await call('PATCH', `/categories/${groceries}`, { parentId: home.body?.id });
    expect(moved.status).toBe(200);
    expect(moved.body?.parentId).toBe(home.body?.id);
    expect(shape(await tree())).toEqual([
      ['Food', []],
      ['Home', [['Groceries', [['Fruit', []]]]]],
    ]);

    const top = await call('PATCH', `/categories/${groceries}`, { parentId: null });
    expect(top.status).toBe(200);
    expect(top.body?.parentId).toBeNull();
  });

  it('AC18 AC19 AC20 AC25 AC13 answers 400, 404, 409 and 401 with their detail and changes nothing', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    await category('Fruit', groceries);
    const home = await category('Home');
    const bobs = await category('Bobs', null, BOB);
    const before = shape(await tree());

    expect(await call('PATCH', `/categories/${food}`, { parentId: home })).toEqual({
      status: 400,
      body: { type: 'ValidationError', detail: 'maximum depth is 3 tiers' },
    });
    expect(await call('PATCH', `/categories/${food}`, { parentId: groceries })).toEqual({
      status: 400,
      body: {
        type: 'ValidationError',
        detail: 'a category cannot be moved into itself or its descendants',
      },
    });
    expect(await call('PATCH', `/categories/${food}`, { name: 'x'.repeat(31) })).toEqual({
      status: 400,
      body: { type: 'ValidationError', detail: 'name must be at most 30 characters' },
    });
    expect(await call('PATCH', `/categories/${home}`, { parentId: bobs })).toEqual({
      status: 404,
      body: { type: 'NotFoundError', detail: 'Parent category not found' },
    });
    expect(await call('PATCH', `/categories/${bobs}`, { name: 'Mine' })).toEqual({
      status: 404,
      body: { type: 'NotFoundError', detail: 'Category not found' },
    });
    expect(await call('PATCH', `/categories/${home}`, { name: 'food' })).toEqual({
      status: 409,
      body: { type: 'ConflictError', detail: 'name is taken' },
    });
    expect((await call('PATCH', `/categories/${home}`, { name: 'Other' }, null)).status).toBe(401);
    expect(shape(await tree())).toEqual(before);
  });
});

describe('API app: DELETE /categories/:id', () => {
  it('AC22 AC23 deletes the branch with 204 and its transactions become uncategorized', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    const fruit = await category('Fruit', groceries);
    const home = await category('Home');
    await transaction('Lunch', food);
    await transaction('Market', groceries);
    await transaction('Apples', fruit);
    await transaction('Rent', home);

    const response = await call('DELETE', `/categories/${food}`);
    expect(response).toEqual({ status: 204, body: null });
    expect(shape(await tree())).toEqual([['Home', []]]);
    expect(await descriptions('')).toEqual(['Apples', 'Lunch', 'Market', 'Rent']);
    expect(await descriptions('category=none')).toEqual(['Apples', 'Lunch', 'Market']);
  });

  it('AC25 answers 404 for a missing or another user’s category and 401 without a user', async () => {
    const bobs = await category('Bobs', null, BOB);
    for (const id of ['missing', bobs]) {
      expect(await call('DELETE', `/categories/${id}`)).toEqual({
        status: 404,
        body: { type: 'NotFoundError', detail: 'Category not found' },
      });
    }
    expect((await call('DELETE', `/categories/${bobs}`, undefined, null)).status).toBe(401);
    expect((await call('GET', `/categories/${bobs}`, undefined, BOB)).status).toBe(200);
  });
});

describe('API app: GET /categories/:id', () => {
  it('answers 200 with parentId, 404 for another user and 401 without a user', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    const found = await call('GET', `/categories/${groceries}`);
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ name: 'Groceries', parentId: food });
    expect((await call('GET', `/categories/${groceries}`, undefined, BOB)).status).toBe(404);
    expect((await call('GET', `/categories/${groceries}`, undefined, null)).status).toBe(401);
  });
});

describe('API app: transactions filtered by a branch', () => {
  it('AC32 AC33 a category filter includes its descendants in the list and the balance; none is unchanged', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    const fruit = await category('Fruit', groceries);
    const home = await category('Home');
    await transaction('Lunch', food, '1');
    await transaction('Market', groceries, '2');
    await transaction('Apples', fruit, '4');
    await transaction('Rent', home, '8');
    await transaction('Loose', null, '16');

    expect(await descriptions(`category=${food}`)).toEqual(['Apples', 'Lunch', 'Market']);
    expect(await descriptions(`category=${groceries}`)).toEqual(['Apples', 'Market']);
    expect(await descriptions(`category=${groceries}&category=none`)).toEqual([
      'Apples',
      'Loose',
      'Market',
    ]);
    expect(await descriptions('category=none')).toEqual(['Loose']);

    const balance = await call('GET', `/transactions/balance?month=2026-11&category=${food}`);
    expect(balance.status).toBe(200);
    expect(balance.body).toEqual({ days: [{ date: '2026-11-05', balance: '-7' }], totals: null });
  });
});

describe('API app: category log records', () => {
  it('AC26 AC27 AC28 AC30 the composed app writes a record per change through its logger', async () => {
    const food = await category('Food');
    const groceries = await category('Groceries', food);
    const home = await category('Home');
    await call('PATCH', `/categories/${groceries}`, { name: 'Market', parentId: home });
    await call('DELETE', `/categories/${home}`);

    expect(records.map((r) => [r.event, r.categoryName])).toEqual([
      ['category.created', 'Food'],
      ['category.created', 'Groceries'],
      ['category.created', 'Home'],
      ['category.renamed', 'Market'],
      ['category.moved', 'Market'],
      ['category.deleted', 'Home'],
      ['category.deleted', 'Market'],
    ]);
    expect(records.every((r) => r.userId === ALICE && typeof r.categoryId === 'string')).toBe(true);
  });
});
