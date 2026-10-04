import { CatalogSettings, ProblemDetails } from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  login,
  sessionCookie,
  type AuthHarness,
} from '../../../../test/support/auth.ts';

const PASSWORD = 'correct-horse-battery';
const URL = '/api/v1/admin/catalog/settings';

async function signedIn(env: Record<string, string> = {}) {
  const h = await createAuthHarness(env);
  await createStaff(h.db, { email: 'admin@example.com', password: PASSWORD, role: 'ADMIN' });
  const cookie = sessionCookie(await login(h.app, 'admin@example.com', PASSWORD));
  return { h, cookie };
}

describe('product-management: Store currency setting', () => {
  let idr: { h: AuthHarness; cookie: string };
  let usd: { h: AuthHarness; cookie: string };

  beforeAll(async () => {
    idr = await signedIn();
    usd = await signedIn({ STORE_CURRENCY: 'USD' });
  });
  afterAll(async () => {
    await idr.h.close();
    await usd.h.close();
  });

  it('Read the store currency', async () => {
    const res = await idr.h.app.inject({
      method: 'GET',
      url: URL,
      headers: { cookie: idr.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
    expect(CatalogSettings.parse(res.json())).toEqual({ storeCurrency: 'IDR' });
    // Nothing but the store currency is exposed.
    expect(Object.keys(res.json())).toEqual(['storeCurrency']);

    const other = await usd.h.app.inject({
      method: 'GET',
      url: URL,
      headers: { cookie: usd.cookie },
    });
    expect(CatalogSettings.parse(other.json())).toEqual({ storeCurrency: 'USD' });
  });

  it('Store currency cannot be changed through the API', async () => {
    for (const method of ['PUT', 'PATCH', 'POST'] as const) {
      const res = await idr.h.app.inject({
        method,
        url: URL,
        headers: { cookie: idr.cookie, origin: ADMIN_ORIGIN },
        payload: { storeCurrency: 'USD' },
      });
      expect(res.statusCode, method).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
    const after = await idr.h.app.inject({
      method: 'GET',
      url: URL,
      headers: { cookie: idr.cookie },
    });
    expect(CatalogSettings.parse(after.json())).toEqual({ storeCurrency: 'IDR' });
  });

  it('requires a staff session', async () => {
    const res = await idr.h.app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
    expect(ProblemDetails.parse(res.json())).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
