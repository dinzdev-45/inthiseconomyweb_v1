/**
 * Creates the first OWNER account. Operator-run only; there is no HTTP equivalent.
 *
 *   pnpm --filter @ite/api admin:bootstrap-owner --email owner@example.com
 *
 * The password is prompted for (hidden) on a terminal, or read from the first
 * line of stdin when piped. It is never accepted as a command-line argument.
 */
import { parseArgs } from 'node:util';

import { NewPassword, StaffEmail } from '@ite/contracts';
import { createPrismaClient } from '@ite/db';
import { z } from 'zod';

import { DatabaseUrl, EnvError, parseEnvWith } from '../env.ts';
import { BootstrapRefusedError, bootstrapOwner } from '../modules/admin-auth/bootstrap.ts';

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    return input.split(/\r?\n/)[0] ?? '';
  }
  const ask = (prompt: string) =>
    new Promise<string>((resolve) => {
      process.stdout.write(prompt);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      let value = '';
      const onData = (chunk: Buffer) => {
        for (const char of chunk.toString('utf8')) {
          if (char === '\r' || char === '\n') {
            process.stdin.off('data', onData);
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\n');
            return resolve(value);
          }
          if (char === '\u0003') fail('\nAborted.', 130);
          value = char === '\u007f' ? value.slice(0, -1) : value + char;
        }
      };
      process.stdin.on('data', onData);
    });
  const first = await ask('Owner password (min 12 characters): ');
  if ((await ask('Confirm password: ')) !== first) fail('Passwords do not match.');
  return first;
}

const { values } = parseArgs({ options: { email: { type: 'string' } } });
const email = StaffEmail.safeParse(values.email);
if (!email.success) fail('Usage: admin:bootstrap-owner --email <owner email>', 2);

let env;
try {
  env = parseEnvWith(z.object({ DATABASE_URL: DatabaseUrl }), process.env);
} catch (error) {
  if (error instanceof EnvError) fail(error.message);
  throw error;
}

const password = NewPassword.safeParse(await readPassword());
if (!password.success) fail('Password must be between 12 and 256 characters.');

const db = createPrismaClient(env.DATABASE_URL);
try {
  const owner = await bootstrapOwner(db, { email: email.data, password: password.data });
  console.log(`Created OWNER ${owner.email}. Sign in to the admin to continue.`);
} catch (error) {
  if (error instanceof BootstrapRefusedError) fail(error.message);
  throw error;
} finally {
  await db.$disconnect();
}
