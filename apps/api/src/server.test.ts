import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SERVER = fileURLToPath(new URL('./server.ts', import.meta.url));

const VALID_ENV = {
  DATABASE_URL: 'postgresql://ite:pw@localhost:5433/inthiseconomy',
  SESSION_SECRET: 'a'.repeat(32),
  ADMIN_ORIGIN: 'http://localhost:3001',
  HOST: '127.0.0.1',
  PORT: '0',
};

type Run = { code: number | null; stdout: string; stderr: string };

/** Starts the API process with only the given variables (plus PATH). */
function startServer(
  env: Record<string, string>,
  onStdout?: (text: string, kill: () => void) => void,
) {
  const child = spawn(process.execPath, [SERVER], {
    env: { PATH: process.env.PATH ?? '', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
    onStdout?.(stdout, () => child.kill('SIGTERM'));
  });
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  return new Promise<Run>((resolve) =>
    child.on('exit', (code) => resolve({ code, stdout, stderr })),
  );
}

describe('api-conventions: Validated environment configuration', () => {
  it.each(['DATABASE_URL', 'SESSION_SECRET'])('Missing required variable (%s)', async (missing) => {
    const env: Record<string, string> = { ...VALID_ENV };
    delete env[missing];
    const run = await startServer(env);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain(`${missing}: is required`);
  });

  it('Secret not echoed', async () => {
    const secret = 'shortButSecretValue42';
    const run = await startServer({ ...VALID_ENV, SESSION_SECRET: secret });
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('SESSION_SECRET: must be at least 32 characters');
    expect(run.stdout + run.stderr).not.toContain(secret);
  });
});

describe('graceful shutdown', () => {
  it('closes and exits 0 on SIGTERM', async () => {
    let signalled = false;
    const run = await startServer(VALID_ENV, (stdout, kill) => {
      if (!signalled && stdout.includes('Server listening')) {
        signalled = true;
        kill();
      }
    });
    expect(run.code).toBe(0);
    expect(run.stdout).toContain('"signal":"SIGTERM"');
    expect(run.stdout).toContain('shutting down');
  });
});
