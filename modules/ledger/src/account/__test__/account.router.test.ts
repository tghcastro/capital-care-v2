import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Server } from 'node:http';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AccountRepository } from '../account.repository.js';
import { AccountService } from '../account.service.js';
import { createAccountRouter } from '../account.controller.js';

// Integration: the router, service, repository and a real SQLite database, called over HTTP.
const MIGRATIONS_FOLDER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../shared/persistence/migrations',
);
const LIMIT = 5;

let sqlite: Database.Database;
let server: Server;
let base: string;

beforeEach(async () => {
  sqlite = new Database(':memory:');
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const app = express();
  app.use(express.json());
  app.use('/accounts', createAccountRouter(new AccountService(new AccountRepository(db), LIMIT)));

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

interface Reply {
  status: number;
  body: any;
}

async function call(
  method: string,
  route: string,
  options: { user?: string | null; body?: unknown } = {},
): Promise<Reply> {
  const user = options.user === undefined ? 'alice' : options.user;
  const headers: Record<string, string> = {};
  if (user !== null) headers['x-user-id'] = user;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${base}${route}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
  return { status: response.status, body: text && isJson ? JSON.parse(text) : text || null };
}

const create = (name: string, user?: string) => call('POST', '/accounts', { body: { name }, ...(user ? { user } : {}) });
const names = async (user?: string) =>
  (await call('GET', '/accounts', user ? { user } : {})).body.accounts.map((a: any) => a.name);

describe('Account routes', () => {
  it('C1 POST /accounts returns 201 with the account fields', async () => {
    for (const name of ['Bank A account', 'Money', 'Credit Card from institution C']) {
      const reply = await create(name);

      expect(reply.status).toBe(201);
      expect(reply.body.name).toBe(name);
      expect(reply.body.userId).toBe('alice');
      expect(reply.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(new Date(reply.body.createdAt).toISOString()).toBe(reply.body.createdAt);
      expect(new Date(reply.body.updatedAt).toISOString()).toBe(reply.body.updatedAt);
    }
  });

  it('C2 GET /accounts with no accounts returns an empty list', async () => {
    const reply = await call('GET', '/accounts');

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ accounts: [] });
  });

  it('C3 GET /accounts returns only the caller accounts', async () => {
    await create('Cash', 'alice');
    await create('Bank A', 'bob');

    expect(await names('alice')).toEqual(['Cash']);
    expect(await names('bob')).toEqual(['Bank A']);
  });

  it('C5 PATCH /accounts/:id renames and keeps id userId createdAt', async () => {
    const created = (await create('Cash')).body;
    await sleep(5);

    const reply = await call('PATCH', `/accounts/${created.id}`, { body: { name: 'Wallet' } });

    expect(reply.status).toBe(200);
    expect(reply.body.name).toBe('Wallet');
    expect(reply.body.id).toBe(created.id);
    expect(reply.body.userId).toBe(created.userId);
    expect(reply.body.createdAt).toBe(created.createdAt);
    expect(new Date(reply.body.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
    expect(await names()).toEqual(['Wallet']);
  });

  it('C7 PATCH without a usable name returns 400 and changes nothing', async () => {
    const created = (await create('Cash')).body;

    for (const body of [{}, { name: '' }]) {
      const reply = await call('PATCH', `/accounts/${created.id}`, { body });
      expect(reply.status).toBe(400);
      expect(reply.body.type).toBe('ValidationError');
    }
    const noBody = await call('PATCH', `/accounts/${created.id}`);
    expect(noBody.status).toBe(400);

    expect(await names()).toEqual(['Cash']);
  });

  it('C12 invalid names return 400 with the rule and save nothing', async () => {
    const cases: Array<[unknown, RegExp]> = [
      ['', /required/],
      ['   ', /required/],
      ['x'.repeat(31), /30/],
      ['Bank-A', /letters, digits and spaces/],
    ];
    for (const [name, rule] of cases) {
      const reply = await call('POST', '/accounts', { body: { name } });
      expect(reply.status).toBe(400);
      expect(reply.body.type).toBe('ValidationError');
      expect(reply.body.detail).toMatch(rule);
    }
    const missing = await call('POST', '/accounts', { body: {} });
    expect(missing.status).toBe(400);
    expect(missing.body.detail).toMatch(/required/);
    expect(await names()).toEqual([]);

    const created = (await create('Cash')).body;
    for (const [name, rule] of cases) {
      const reply = await call('PATCH', `/accounts/${created.id}`, { body: { name } });
      expect(reply.status).toBe(400);
      expect(reply.body.detail).toMatch(rule);
    }
    expect(await names()).toEqual(['Cash']);
  });

  it('C16 two users can each create Cash', async () => {
    expect((await create('Cash', 'alice')).status).toBe(201);
    expect((await create('Cash', 'bob')).status).toBe(201);
  });

  it('C17 a deleted account name can be used again', async () => {
    const created = (await create('Cash')).body;
    expect((await call('DELETE', `/accounts/${created.id}`)).status).toBe(204);

    expect((await create('Cash')).status).toBe(201);
  });

  it('C18 conflicts return 409 with a ConflictError body', async () => {
    await create('Cash');
    const bank = (await create('Bank A')).body;

    const taken = await create('cash');
    expect(taken.status).toBe(409);
    expect(taken.body.type).toBe('ConflictError');
    expect(taken.body.detail).toMatch(/already exists/);

    const renamed = await call('PATCH', `/accounts/${bank.id}`, { body: { name: 'CASH' } });
    expect(renamed.status).toBe(409);
    expect(renamed.body.type).toBe('ConflictError');

    for (const name of ['One', 'Two', 'Three']) await create(name);
    const full = await create('Six');
    expect(full.status).toBe(409);
    expect(full.body.type).toBe('ConflictError');
    expect(full.body.detail).toMatch(/\b5\b/);
    expect(await names()).toHaveLength(5);
  });

  it('C27 a limit field in the request body is ignored', async () => {
    for (const name of ['One', 'Two', 'Three', 'Four', 'Five']) {
      const reply = await call('POST', '/accounts', {
        body: { name, limit: 1000, accountLimit: 1000, maxAccounts: 1000 },
      });
      expect(reply.status).toBe(201);
    }
    const sixth = await call('POST', '/accounts', { body: { name: 'Six', limit: 1000 } });
    expect(sixth.status).toBe(409);

    const first = (await call('GET', '/accounts')).body.accounts[0];
    const patched = await call('PATCH', `/accounts/${first.id}`, { body: { name: 'Uno', limit: 1000 } });
    expect(patched.status).toBe(200);
    expect(Object.keys(patched.body).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt', 'userId']);

    expect((await call('GET', '/accounts/limit')).status).toBe(404);
    expect((await call('POST', '/accounts/limit', { body: { limit: 1000 } })).status).toBe(404);
  });

  it('C28 DELETE /accounts/:id returns 204 and removes the account', async () => {
    const created = (await create('Cash')).body;
    await create('Bank A');

    const reply = await call('DELETE', `/accounts/${created.id}`);

    expect(reply.status).toBe(204);
    expect(reply.body).toBeNull();
    expect(await names()).toEqual(['Bank A']);
  });

  it('C29 PATCH and DELETE of a missing account return 404', async () => {
    await create('Cash');
    const missing = '00000000-0000-4000-8000-000000000000';

    const patch = await call('PATCH', `/accounts/${missing}`, { body: { name: 'Wallet' } });
    expect(patch.status).toBe(404);
    expect(patch.body.type).toBe('NotFoundError');
    expect((await call('DELETE', `/accounts/${missing}`)).status).toBe(404);

    const created = (await create('Bank A')).body;
    expect((await call('DELETE', `/accounts/${created.id}`)).status).toBe(204);
    expect((await call('DELETE', `/accounts/${created.id}`)).status).toBe(404);

    expect(await names()).toEqual(['Cash']);
  });

  it('C30 another user account returns 404 for PATCH and DELETE', async () => {
    const created = (await create('Cash', 'alice')).body;

    const patch = await call('PATCH', `/accounts/${created.id}`, { user: 'bob', body: { name: 'Mine' } });
    expect(patch.status).toBe(404);
    const del = await call('DELETE', `/accounts/${created.id}`, { user: 'bob' });
    expect(del.status).toBe(404);

    expect(await names('alice')).toEqual(['Cash']);
  });

  it('C31 a request without X-User-Id returns 401', async () => {
    const created = (await create('Cash')).body;

    const replies = [
      await call('POST', '/accounts', { user: null, body: { name: 'Bank A' } }),
      await call('GET', '/accounts', { user: null }),
      await call('PATCH', `/accounts/${created.id}`, { user: null, body: { name: 'Wallet' } }),
      await call('DELETE', `/accounts/${created.id}`, { user: null }),
    ];

    expect(replies.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(await names()).toEqual(['Cash']);
  });
});
