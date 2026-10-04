import { describe, expect, it } from 'vitest';

import { EnvError, parseEnv } from './env.ts';

const valid = {
  DATABASE_URL: 'postgresql://ite:pw@localhost:5433/inthiseconomy',
  SESSION_SECRET: 'a'.repeat(32),
  ADMIN_ORIGIN: 'http://localhost:3001',
};

function problems(source: Record<string, string | undefined>): readonly string[] {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
  throw new Error('expected parseEnv to throw');
}

describe('parseEnv', () => {
  it('applies defaults and returns a frozen config', () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 4000, LOG_LEVEL: 'info' });
    expect(Object.isFrozen(env)).toBe(true);
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each(['DATABASE_URL', 'SESSION_SECRET', 'ADMIN_ORIGIN'])(
    'reports %s as required when missing',
    (key) => {
      expect(problems({ ...valid, [key]: undefined })).toEqual([`${key}: is required`]);
    },
  );

  it('treats an empty value as missing', () => {
    expect(problems({ ...valid, SESSION_SECRET: '' })).toEqual(['SESSION_SECRET: is required']);
  });

  it('reports every invalid variable at once', () => {
    expect(problems({})).toHaveLength(3);
  });

  it('names the rule but not the value of an invalid secret', () => {
    const secret = 'tooShortSecretValue9';
    const [problem] = problems({ ...valid, SESSION_SECRET: secret });
    expect(problem).toBe('SESSION_SECRET: must be at least 32 characters');
    expect(problem).not.toContain(secret);
  });

  it('does not echo a database URL (which contains a password)', () => {
    const url = 'mysql://ite:hunter2-secret@db/app';
    const [problem] = problems({ ...valid, DATABASE_URL: url });
    expect(problem).toBe('DATABASE_URL: must be a postgres:// or postgresql:// URL');
    expect(problem).not.toContain('hunter2-secret');
  });

  it.each([
    'http://localhost:3001/',
    'https://admin.example.com/app',
    'ftp://admin.example.com',
    'not a url',
  ])('rejects ADMIN_ORIGIN %s', (origin) => {
    expect(problems({ ...valid, ADMIN_ORIGIN: origin })[0]).toMatch(/^ADMIN_ORIGIN: /);
  });

  it('defaults STORE_CURRENCY to IDR', () => {
    expect(parseEnv(valid).STORE_CURRENCY).toBe('IDR');
  });

  it('accepts another ISO 4217 STORE_CURRENCY', () => {
    expect(parseEnv({ ...valid, STORE_CURRENCY: 'USD' }).STORE_CURRENCY).toBe('USD');
  });

  it.each(['idr', 'RUPIAH', 'QQQ', ''])('rejects STORE_CURRENCY %j without echoing it', (value) => {
    const [problem] = problems({ ...valid, STORE_CURRENCY: value });
    expect(problem).toBe('STORE_CURRENCY: must be an uppercase ISO 4217 currency code, e.g. IDR');
    if (value)
      expect(problem!.replace('ISO 4217', '').replace('e.g. IDR', '')).not.toContain(value);
  });

  it.each([{ NODE_ENV: 'staging' }, { PORT: '70000' }, { LOG_LEVEL: 'verbose' }])(
    'rejects %j',
    (override) => {
      expect(problems({ ...valid, ...override })).toHaveLength(1);
    },
  );
});
