import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NEWSLETTER_NOT_OPEN, NewsletterForm } from './NewsletterForm.tsx';

afterEach(() => vi.restoreAllMocks());

describe('storefront-homepage: Frontend-only newsletter form', () => {
  it('Invalid newsletter email', async () => {
    render(<NewsletterForm />);
    const input = screen.getByLabelText('Email');
    await userEvent.type(input, 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    expect(input.getAttribute('aria-invalid')).toBe('true');
    const errorId = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(errorId)?.textContent).toMatch(/valid email/i);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('form', { name: 'Newsletter sign-up' })).toBeDefined();
  });
});

describe('NewsletterForm', () => {
  it('treats an empty email as invalid', async () => {
    render(<NewsletterForm />);
    await userEvent.click(screen.getByRole('button', { name: 'Notify me' }));
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
  });

  it('says honestly that sign-up is not open and sends or stores nothing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    render(<NewsletterForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'name@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Notify me' }));

    expect(screen.getByRole('status').textContent).toBe(NEWSLETTER_NOT_OPEN);
    expect(screen.getByRole('status').textContent).not.toMatch(/subscribed|thank/i);
    expect(screen.queryByRole('form')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });
});
