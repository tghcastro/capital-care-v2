import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeLedgerDatabase, migrateLedger } from '@capital-care/ledger';
import { createApp } from '../src/app.js';

// Component: the whole API app against a real, disposable database file.
const saved = { DB_PATH: process.env.DB_PATH, ACCOUNT_LIMIT: process.env.ACCOUNT_LIMIT };
let dir: string;
let server: Server | undefined;

function restore(name: 'DB_PATH' | 'ACCOUNT_LIMIT'): void {
  if (saved[name] === undefined) delete process.env[name];
  else process.env[name] = saved[name];
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-component-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  process.env.ACCOUNT_LIMIT = '5';
  migrateLedger(process.env.DB_PATH);
});

afterEach(async () => {
  if (server) await new Promise((resolve) => server!.close(resolve));
  server = undefined;
  closeLedgerDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
  restore('DB_PATH');
  restore('ACCOUNT_LIMIT');
});

describe('API app: accounts', () => {
  it('C32 the app mounts /accounts', async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', resolve);
    });
    const address = server!.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/accounts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'alice' },
      body: JSON.stringify({ name: 'Money' }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).name).toBe('Money');
  });

  it('C25 the app fails to start with an invalid account limit', () => {
    process.env.ACCOUNT_LIMIT = '0';

    expect(() => createApp()).toThrow(/ACCOUNT_LIMIT/);
  });
});
