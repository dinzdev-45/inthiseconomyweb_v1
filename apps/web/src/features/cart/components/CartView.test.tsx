import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CartLineView, CartViewModel } from '../types.ts';

// CartView's forms post to Server Actions, whose module is server-only.
vi.mock('server-only', () => ({}));
const { CartView } = await import('./CartView.tsx');

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const line = (overrides: Partial<CartLineView> = {}): CartLineView => ({
  id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
  name: 'Two Tone Hoodie',
  href: '/products/two-tone-hoodie?color=black&size=M',
  image: null,
  colorName: 'Black',
  sizeCode: 'M',
  quantity: 2,
  unitPrice: idr(69_900_000),
  lineTotal: idr(139_800_000),
  status: 'AVAILABLE',
  ...overrides,
});

describe('storefront-cart: Cart page', () => {
  it('Unavailable line in the cart', () => {
    const cart: CartViewModel = {
      lines: [
        line(),
        line({
          id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2c',
          name: 'Gone Jacket',
          status: 'UNAVAILABLE',
          lineTotal: idr(99_900_000),
        }),
      ],
      itemCount: 2,
      subtotal: idr(139_800_000), // the API leaves the unavailable line out
    };
    const { container } = render(<CartView cart={cart} />);
    const [available, gone] = screen.getAllByRole('listitem');
    expect(within(gone!).getByText('No longer available. Remove it to continue.')).toBeDefined();
    expect(
      within(gone!).getByRole('button', { name: 'Remove Gone Jacket, Black, M' }),
    ).toBeDefined();
    expect(within(available!).queryByText(/No longer available/)).toBeNull();
    // Checkout waits until the flagged line is fixed.
    expect(screen.getByText('Remove or update the items marked above to check out.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Checkout' })).toBeNull();
    // The subtotal is the API's, which leaves the unavailable line out.
    expect(container.querySelector('[data-subtotal]')!.textContent).toMatch(/Rp\s1\.398\.000$/);
  });
});

describe('CartView', () => {
  it('confirms the added line, and shows change outcomes, in a polite status region', () => {
    const cart = { lines: [line()], itemCount: 2, subtotal: idr(139_800_000) };
    const { rerender } = render(<CartView cart={cart} addedLineId={line().id} />);
    expect(screen.getByRole('status').textContent).toBe(
      'Added Two Tone Hoodie (Black, M) to your cart.',
    );
    rerender(<CartView cart={cart} status="stock" />);
    expect(screen.getByRole('status').textContent).toBe(
      'There isn’t enough stock for that quantity.',
    );
  });

  it('offers Checkout when every line can be bought', () => {
    render(<CartView cart={{ lines: [line()], itemCount: 2, subtotal: idr(139_800_000) }} />);
    expect(screen.getByRole('link', { name: 'Checkout' }).getAttribute('href')).toBe('/checkout');
  });

  it('labels each quantity control with its product, color, and size', () => {
    render(<CartView cart={{ lines: [line()], itemCount: 2, subtotal: idr(139_800_000) }} />);
    const select = screen.getByLabelText(/^Quantity for Two Tone Hoodie, Black, M/);
    expect((select as HTMLSelectElement).value).toBe('2');
    expect(select.querySelectorAll('option')).toHaveLength(10);
  });

  it('shows the empty cart without a subtotal', () => {
    const { container } = render(<CartView cart={null} />);
    expect(screen.getByText('Your cart is empty.')).toBeDefined();
    expect(container.querySelector('[data-subtotal]')).toBeNull();
  });
});
