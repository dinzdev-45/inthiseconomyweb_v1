import type { StoreOrder } from '@ite/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formatDeadline, OrderView } from './OrderView.tsx';

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const ORDER: StoreOrder = {
  number: 'ITE-7KQ2M9XA',
  status: 'AWAITING_PAYMENT',
  placedAt: '2026-10-08T05:00:00.000Z',
  paymentDeadline: '2026-10-09T05:00:00.000Z',
  lines: [
    {
      productName: 'Two Tone Hoodie',
      productSlug: 'two-tone-hoodie',
      colorName: 'Off-White',
      sizeCode: 'M',
      unitPrice: idr(69_900_000),
      quantity: 2,
      lineTotal: idr(139_800_000),
    },
  ],
  subtotal: idr(139_800_000),
  shippingFee: idr(0),
  total: idr(139_800_000),
  contact: { email: 'ana@example.com', name: 'Ana Putri', phone: '+6281234567890' },
  delivery: {
    line1: 'Jl. Melati No. 5',
    line2: 'Blok C',
    city: 'Bandung',
    province: { code: '32', name: 'Jawa Barat' },
    postalCode: '40115',
  },
  note: 'Leave with the guard',
};

describe('storefront-checkout: Order page', () => {
  it('Expired order', () => {
    render(<OrderView order={{ ...ORDER, status: 'EXPIRED' }} />);
    expect(screen.getByText('Expired')).toBeDefined();
    expect(screen.getByText(/wasn’t paid in time/)).toBeDefined();
    expect(screen.queryByText('Awaiting payment')).toBeNull();
  });
});

describe('OrderView', () => {
  it('shows the deadline in Western Indonesian Time', () => {
    // 05:00 UTC is 12:00 in Jakarta (UTC+7).
    expect(formatDeadline('2026-10-09T05:00:00.000Z')).toBe('9 October 2026 at 12:00 WIB');
    render(<OrderView order={ORDER} />);
    expect(screen.getByText(/Pay by 9 October 2026 at 12:00 WIB/)).toBeDefined();
  });

  it('shows lines, totals ("Free" shipping), and the full delivery details', () => {
    const { container } = render(<OrderView order={ORDER} />);
    expect(screen.getByRole('heading', { level: 1, name: 'ITE-7KQ2M9XA' })).toBeDefined();
    expect(screen.getByText('Free')).toBeDefined();
    const address = container.querySelector('[data-delivery]')!.textContent!;
    for (const part of [
      'Ana Putri',
      'Jl. Melati No. 5',
      'Blok C',
      'Bandung, Jawa Barat 40115',
      '+6281234567890',
    ]) {
      expect(address).toContain(part);
    }
    expect(screen.getByText('Note: Leave with the guard')).toBeDefined();
  });
});
