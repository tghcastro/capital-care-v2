import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeLedgerDatabase, migrateLedger } from '@capital-care/ledger';
import { createApp } from '../src/app.js';

// Component: the whole API app serving a fixture "web dist" directory on the same origin.
const saved = { DB_PATH: process.env.DB_PATH, WEB_DIST_PATH: process.env.WEB_DIST_PATH };
let dir: string;
let server: Server | undefined;

function restore(name: 'DB_PATH' | 'WEB_DIST_PATH'): void {
  const value = saved[name];
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

async function start(): Promise<string> {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server?.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-web-'));
  process.env.DB_PATH = path.join(dir, 'test.db');
  migrateLedger(process.env.DB_PATH);
  fs.mkdirSync(path.join(dir, 'dist', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html><title>Capital Care</title>');
  fs.writeFileSync(path.join(dir, 'dist', 'assets', 'index-abc123.js'), 'console.log("hi");');
});

afterEach(async () => {
  const running = server;
  if (running) await new Promise((resolve) => running.close(resolve));
  server = undefined;
  closeLedgerDatabase();
  fs.rmSync(dir, { recursive: true, force: true });
  restore('DB_PATH');
  restore('WEB_DIST_PATH');
});

describe('API app: web static files', () => {
  it('serves index.html at / with no-cache when WEB_DIST_PATH is set', async () => {
    process.env.WEB_DIST_PATH = path.join(dir, 'dist');
    const base = await start();

    const response = await fetch(`${base}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(await response.text()).toContain('Capital Care');
  });

  it('serves hashed assets with long-lived immutable caching', async () => {
    process.env.WEB_DIST_PATH = path.join(dir, 'dist');
    const base = await start();

    const response = await fetch(`${base}/assets/index-abc123.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('keeps the API routes ahead of the static files', async () => {
    process.env.WEB_DIST_PATH = path.join(dir, 'dist');
    const base = await start();

    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('has no SPA fallback: an unknown path is a 404', async () => {
    process.env.WEB_DIST_PATH = path.join(dir, 'dist');
    const base = await start();

    expect((await fetch(`${base}/does-not-exist`)).status).toBe(404);
  });

  it('serves no static files when WEB_DIST_PATH is unset', async () => {
    Reflect.deleteProperty(process.env, 'WEB_DIST_PATH');
    const base = await start();

    expect((await fetch(`${base}/`)).status).toBe(404);
    expect((await fetch(`${base}/health`)).status).toBe(200);
  });
});
