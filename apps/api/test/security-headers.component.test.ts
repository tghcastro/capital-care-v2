import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeLedgerDatabase, migrateLedger } from '@capital-care/ledger';
import { createApp } from '../src/app.js';

// Component: the whole API app answers every response with the helmet default security headers.
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

function expectSecurityHeaders(response: Response, cspDefaultSrc = "'self'"): void {
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  expect(response.headers.get('strict-transport-security')).toContain('max-age=');
  expect(response.headers.get('content-security-policy')).toContain(`default-src ${cspDefaultSrc}`);
  expect(response.headers.has('x-powered-by')).toBe(false);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-headers-'));
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

describe('API app: security headers', () => {
  it('sends the helmet headers on GET /health and no X-Powered-By', async () => {
    const base = await start();

    const response = await fetch(`${base}/health`);

    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });

  it('sends the helmet headers on a 401 from a protected route', async () => {
    const base = await start();

    const response = await fetch(`${base}/categories`);

    expect(response.status).toBe(401);
    expectSecurityHeaders(response);
  });

  it('sends the helmet headers on a 404 for an unknown route', async () => {
    const base = await start();

    const response = await fetch(`${base}/does-not-exist`);

    expect(response.status).toBe(404);
    // Express's own 404 handler replaces the CSP with the stricter `default-src 'none'`.
    expectSecurityHeaders(response, "'none'");
  });

  it('sends the helmet headers on the web app at / and on a static asset when WEB_DIST_PATH is set', async () => {
    process.env.WEB_DIST_PATH = path.join(dir, 'dist');
    const base = await start();

    const response = await fetch(`${base}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expectSecurityHeaders(response);

    const asset = await fetch(`${base}/assets/index-abc123.js`);

    expect(asset.status).toBe(200);
    expectSecurityHeaders(asset);
  });
});
