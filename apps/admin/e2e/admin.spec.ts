import { expect, test, type Page } from '@playwright/test';

import { E2E } from './config.ts';

const ADMIN_EMAIL = 'admin@e2e.test';
const TEMP_PASSWORD = 'temporary-password-1';
const ADMIN_PASSWORD = 'admin-chosen-password';
const OWNER_NEW_PASSWORD = 'owner-chosen-password';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** App error messages (Next's own route announcer also has role="alert"). */
const errorAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe.configure({ mode: 'serial' });

/**
 * Full smoke journey (task 9.2), run in order against a fresh database:
 * bootstrap Owner (global setup, real CLI) → Owner signs in and changes their
 * password → Owner creates an ADMIN → ADMIN signs in and must change the
 * temporary password → ADMIN is denied the staff page. The Section 7 checks
 * (framing, redirects, staff actions) run alongside.
 */
test.describe('admin app smoke', () => {
  test('Admin page framed', async ({ page }) => {
    const response = await page.request.get('/login');
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-robots-tag']).toContain('noindex');

    // Another site tries to frame the admin: the browser refuses to render it.
    await page.goto('about:blank');
    await page.setContent(`<iframe id="victim" src="${E2E.adminOrigin}/login"></iframe>`);
    const frame = page.frameLocator('#victim');
    await page.waitForTimeout(1_000);
    await expect(frame.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  });

  test('redirects to sign-in without a session', async ({ page }) => {
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('rejects wrong credentials', async ({ page }) => {
    await signIn(page, E2E.ownerEmail, 'not-the-password');
    await expect(errorAlert(page)).toHaveText('Invalid email or password.');
  });

  test('bootstrapped Owner signs in and changes their password', async ({ page }) => {
    await signIn(page, E2E.ownerEmail, process.env.E2E_OWNER_PASSWORD!);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.goto('/account/password');
    await page.getByLabel('Current password').fill(process.env.E2E_OWNER_PASSWORD!);
    await page.getByLabel(/^New password/).fill(OWNER_NEW_PASSWORD);
    await page.getByLabel('Confirm new password').fill(OWNER_NEW_PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await signOut(page);

    // The bootstrap password no longer works; the new one does.
    await signIn(page, E2E.ownerEmail, process.env.E2E_OWNER_PASSWORD!);
    await expect(errorAlert(page)).toHaveText('Invalid email or password.');
    await signIn(page, E2E.ownerEmail, OWNER_NEW_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await signOut(page);
  });

  test('Owner signs in and creates an ADMIN account', async ({ page }) => {
    await signIn(page, E2E.ownerEmail, OWNER_NEW_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // The session cookie is httpOnly: page scripts cannot read it.
    expect(await page.evaluate(() => document.cookie)).not.toContain('ite_admin_session');

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Staff' })
      .click();
    const form = page.getByRole('form', { name: 'Create staff account' });
    await form.getByLabel('Email').fill(ADMIN_EMAIL);
    await form.getByLabel(/Temporary password/).fill(TEMP_PASSWORD);
    await form.getByRole('button', { name: 'Create account' }).click();

    const row = page.getByTestId(`staff-row-${ADMIN_EMAIL}`);
    await expect(row).toContainText('must change password');
    await expect(row).toContainText('Active');

    // Duplicate email is reported from the API.
    await form.getByLabel('Email').fill(ADMIN_EMAIL.toUpperCase());
    await form.getByLabel(/Temporary password/).fill(TEMP_PASSWORD);
    await form.getByRole('button', { name: 'Create account' }).click();
    await expect(errorAlert(page)).toContainText('already exists');

    await signOut(page);
  });

  test('Temporary password must be changed', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, TEMP_PASSWORD);
    await expect(page).toHaveURL(/\/account\/password$/);
    // Any other page sends the user back until the password is changed.
    await page.goto('/');
    await expect(page).toHaveURL(/\/account\/password$/);

    await page.getByLabel('Current password').fill(TEMP_PASSWORD);
    await page.getByLabel(/^New password/).fill(ADMIN_PASSWORD);
    await page.getByLabel('Confirm new password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('Direct navigation without permission', async ({ page }) => {
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Staff' })).toHaveCount(0);

    const staffRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/admin/staff')) staffRequests.push(request.url());
    });
    await page.goto('/staff');

    await expect(page.getByRole('heading', { name: 'Not permitted' })).toBeVisible();
    await expect(page.getByText(E2E.ownerEmail)).toHaveCount(0);
    expect(staffRequests).toEqual([]);
    // The API is the authority either way.
    expect((await page.request.get('/api/v1/admin/staff')).status()).toBe(403);
    await signOut(page);
  });

  test('Owner changes role, deactivates, and reactivates staff; the last Owner is protected', async ({
    page,
  }) => {
    await signIn(page, E2E.ownerEmail, OWNER_NEW_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goto('/staff');
    const row = page.getByTestId(`staff-row-${ADMIN_EMAIL}`);

    await row.getByRole('button', { name: 'Deactivate' }).click();
    await expect(row).toContainText('Deactivated');
    await row.getByRole('button', { name: 'Reactivate' }).click();
    await expect(row).toContainText('Active');

    await page.getByLabel(`Role for ${ADMIN_EMAIL}`).selectOption('OWNER');
    await expect(page.getByLabel(`Role for ${ADMIN_EMAIL}`)).toHaveValue('OWNER');
    await page.getByLabel(`Role for ${ADMIN_EMAIL}`).selectOption('ADMIN');
    await expect(page.getByLabel(`Role for ${ADMIN_EMAIL}`)).toHaveValue('ADMIN');

    // Deactivating yourself as the only Owner is refused by the API and shown.
    await page
      .getByTestId(`staff-row-${E2E.ownerEmail}`)
      .getByRole('button', { name: 'Deactivate' })
      .click();
    await expect(errorAlert(page)).toHaveText('At least one active owner is required.');

    await signOut(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
