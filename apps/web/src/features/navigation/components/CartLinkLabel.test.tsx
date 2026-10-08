import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));
const { CartLinkLabel } = await import('./CartLinkLabel.tsx');

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  pathname = '/';
});
const link = () =>
  render(
    <a href="/cart">
      <CartLinkLabel label="Cart" />
    </a>,
  );

describe('CartLinkLabel', () => {
  it('shows the count visibly and inside the label for screen readers', async () => {
    fetchMock.mockResolvedValue(Response.json({ count: 2 }));
    const { container } = link();
    await waitFor(() =>
      expect(container.querySelector('[data-cart-count]')?.textContent).toBe('2'),
    );
    expect(container.querySelector('[data-cart-count]')!.getAttribute('aria-hidden')).toBe('true');
    // The label span holds "Cart" and the suffix together: the link is named "Cart, 2 items".
    expect(container.querySelector('a > span')!.textContent).toBe('Cart, 2 items');
    expect(fetchMock).toHaveBeenCalledWith('/cart/count', { cache: 'no-store' });
  });

  it('is a plain link for an empty cart or a failed load', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ count: 0 }));
    const empty = link();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(empty.container.textContent).toBe('Cart');
    empty.unmount();

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }));
    const failed = link();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(failed.container.textContent).toBe('Cart');
  });

  it('refetches after navigation', async () => {
    fetchMock.mockResolvedValue(Response.json({ count: 1 }));
    const { rerender, container } = link();
    await waitFor(() => expect(container.textContent).toBe('Cart, 1 item1'));
    pathname = '/cart';
    rerender(
      <a href="/cart">
        <CartLinkLabel label="Cart" />
      </a>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
