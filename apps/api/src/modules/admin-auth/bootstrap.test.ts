import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createPrismaClient, type PrismaClient } from '@ite/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../../../test/support/database.ts';

const CLI = fileURLToPath(new URL('../../cli/bootstrap-owner.ts', import.meta.url));
const PASSWORD = 'first-owner-password';

let url: string;
let db: PrismaClient;

beforeEach(async () => {
  url = await createTestDatabase();
  db = createPrismaClient(url);
});
afterEach(async () => db.$disconnect());

function runCli(args: string[], stdin: string) {
  const child = spawn(process.execPath, [CLI, ...args], {
    env: { PATH: process.env.PATH ?? '', DATABASE_URL: url },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
  child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
  child.stdin.end(stdin);
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) =>
    child.on('exit', (code) => resolve({ code, stdout, stderr })),
  );
}

describe('admin-authentication: Initial owner bootstrap', () => {
  it('Bootstrap on empty system', async () => {
    const run = await runCli(['--email', 'owner@example.com'], `${PASSWORD}\n`);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain('Created OWNER owner@example.com');
    expect(run.stdout + run.stderr).not.toContain(PASSWORD);
    const owner = await db.adminUser.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(owner).toMatchObject({ role: 'OWNER', status: 'ACTIVE', mustChangePassword: false });
    expect(owner.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('Bootstrap after setup', async () => {
    expect((await runCli(['--email', 'owner@example.com'], `${PASSWORD}\n`)).code).toBe(0);

    const run = await runCli(['--email', 'second@example.com'], `${PASSWORD}\n`);

    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain('refusing to bootstrap');
    expect(await db.adminUser.count()).toBe(1);
  });

  it('refuses a password shorter than 12 characters', async () => {
    const run = await runCli(['--email', 'owner@example.com'], 'short\n');
    expect(run.code).not.toBe(0);
    expect(await db.adminUser.count()).toBe(0);
  });

  it('requires --email', async () => {
    const run = await runCli([], `${PASSWORD}\n`);
    expect(run.code).toBe(2);
    expect(await db.adminUser.count()).toBe(0);
  });
});

describe('admin-access-control: Change attribution', () => {
  it('Bootstrap attribution', async () => {
    expect((await runCli(['--email', 'owner@example.com'], `${PASSWORD}\n`)).code).toBe(0);

    const owner = await db.adminUser.findUniqueOrThrow({ where: { email: 'owner@example.com' } });
    expect(owner.createdById).toBeNull();
    expect(owner.updatedById).toBeNull();
  });
});
