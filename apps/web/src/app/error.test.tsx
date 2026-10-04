import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ErrorPage from './error.tsx';

describe('ErrorPage', () => {
  it('shows a generic message without error details and retries on request', async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('connect ECONNREFUSED 127.0.0.1:4000')} reset={reset} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeDefined();
    expect(document.body.textContent).not.toContain('ECONNREFUSED');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
