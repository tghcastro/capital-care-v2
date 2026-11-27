import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// scripts/db-restore.sh (plan S3, door 3) with a fake `docker` on PATH that logs its arguments.
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db-restore.sh');

let dir: string;
let logFile: string;

function runScript(args: string[], runExit = 0) {
  const result = spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}`, FAKE_DOCKER_LOG: logFile, FAKE_RUN_EXIT: String(runExit) },
  });
  const calls = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean) : [];
  return { code: result.status, calls, stderr: result.stderr };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capital-care-restore-sh-'));
  logFile = path.join(dir, 'docker.log');
  const fake = path.join(dir, 'docker');
  fs.writeFileSync(
    fake,
    '#!/usr/bin/env bash\necho "$*" >> "$FAKE_DOCKER_LOG"\ncase " $* " in *" run "*) sleep "${FAKE_RUN_SLEEP:-0}"; exit "$FAKE_RUN_EXIT";; esac\nexit 0\n'
  );
  fs.chmodSync(fake, 0o755);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('db-restore.sh', () => {
  it('AC17 db-restore.sh stops, restores and starts the app', () => {
    const { code, calls } = runScript(['capital-care-20261126T120000000Z.db']);
    expect(code).toBe(0);
    expect(calls).toEqual([
      'compose --profile prod stop capital-care-prd',
      'compose --profile prod run --rm --no-deps --pull never capital-care-prd node dist/restore.js capital-care-20261126T120000000Z.db',
      'compose --profile prod start capital-care-prd',
    ]);
  });

  it('AC17 db-restore.sh starts the app again when the restore fails', () => {
    const { code, calls } = runScript(['capital-care-20261126T120000000Z.db'], 1);
    expect(code).toBe(1);
    expect(calls.at(-1)).toBe('compose --profile prod start capital-care-prd');
    expect(calls).toHaveLength(3);
  });

  it('AC17 db-restore.sh needs a backup name', () => {
    const { code, calls, stderr } = runScript([]);
    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(stderr).toContain('Usage: scripts/db-restore.sh <backup-file-name>');
  });

  for (const [signal, code] of [['SIGHUP', 129], ['SIGTERM', 143], ['SIGINT', 130]] as const) {
    it(`AC17 db-restore.sh starts the app again after ${signal} during the restore`, async () => {
      const child = spawn('bash', [SCRIPT, 'capital-care-20261126T120000000Z.db'], {
        env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ''}`, FAKE_DOCKER_LOG: logFile, FAKE_RUN_EXIT: '0', FAKE_RUN_SLEEP: '1' },
        stdio: 'ignore',
      });
      // wait until the restore is running, then signal the script only
      for (let i = 0; i < 100 && !(fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes(' run ')); i++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      child.kill(signal);
      const exitCode = await new Promise<number | null>((resolve) => child.on('exit', (c) => resolve(c)));
      const calls = fs.readFileSync(logFile, 'utf8').trim().split('\n');
      expect(exitCode).toBe(code);
      expect(calls).toHaveLength(3);
      expect(calls.at(-1)).toBe('compose --profile prod start capital-care-prd');
    });
  }
});
