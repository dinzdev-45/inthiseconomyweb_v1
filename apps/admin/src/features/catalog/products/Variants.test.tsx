import type { Color, ProductDetail, ProductVariant, Size } from '@ite/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const { VariantsTable } = await import('./VariantsTable.tsx');
const { VariantsSection } = await import('./VariantsSection.tsx');
const { VariantForm } = await import('./VariantForm.tsx');

const ID = (n: number) => `0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a${String(n).padStart(2, '0')}`;
const attribution = {
  createdAt: '2026-10-04T09:15:00.000Z',
  updatedAt: '2026-10-04T10:30:00.000Z',
  createdBy: null,
  updatedBy: null,
};
const size: Size = { id: ID(4), code: 'M', label: 'Medium', sortOrder: 30, ...attribution };
const color: Color = {
  id: ID(5),
  name: 'Washed Black',
  slug: 'washed-black',
  hex: '#2B2A28',
  ...attribution,
};
const variant: ProductVariant = {
  id: ID(3),
  sku: 'ITE-OH-M',
  size: { id: size.id, code: 'M', label: 'Medium' },
  color: { id: color.id, name: 'Washed Black', slug: 'washed-black', hex: '#2B2A28' },
  priceOverride: { amount: 94_900_000, currency: 'IDR' },
  effectivePrice: { amount: 94_900_000, currency: 'IDR' },
  stockQuantity: 12,
  status: 'ACTIVE',
  ...attribution,
};
const product = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: ID(2),
  name: 'Overdraft Hoodie',
  slug: 'overdraft-hoodie',
  description: null,
  status: 'DRAFT',
  category: { id: ID(1), name: 'Apparel', slug: 'apparel', status: 'ACTIVE' },
  basePrice: { amount: 89_900_000, currency: 'IDR' },
  activatedAt: null,
  variants: [variant],
  images: [],
  ...attribution,
  ...overrides,
});
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const common = { productId: ID(2), sizes: [size], colors: [color], storeCurrency: 'IDR' };
const action = {
  run: vi.fn(),
  reject: vi.fn(),
  clear: vi.fn(),
  busy: false,
  problem: null,
  success: null,
  successAt: 0,
  summaryRef: { current: null },
};

describe('variants table', () => {
  it('stays read-only without the manager slots', () => {
    const markup = html(<VariantsTable variants={[variant]} />);
    expect(markup).not.toMatch(/<(button|input|form|select)/);
    expect(markup).not.toContain('>Actions<');
    for (const text of ['ITE-OH-M', '>M<', 'Washed Black', 'override', '>12<', 'Active']) {
      expect(markup).toContain(text);
    }
  });

  it('adds a stock adjuster and row actions for managers', () => {
    const markup = html(
      <VariantsSection product={product()} sizes={[size]} colors={[color]} storeCurrency="IDR" />,
    );
    expect(markup).toContain('aria-label="Stock change for ITE-OH-M"');
    expect(markup).toContain('Positive adds stock, negative removes it.');
    expect(markup).toContain('aria-label="Edit variant ITE-OH-M"');
    expect(markup).toContain('aria-label="Deactivate variant ITE-OH-M"');
    expect(markup).toContain('Add a variant');
  });
});

describe('VariantForm', () => {
  it('offers an initial stock only when adding', () => {
    expect(html(<VariantForm {...common} action={action} />)).toContain('name="stockQuantity"');
    const edit = html(<VariantForm {...common} action={action} variant={variant} />);
    expect(edit).not.toContain('name="stockQuantity"');
    expect(edit).not.toMatch(/stock/i);
    // The override is prefilled in major units with the store currency.
    expect(edit).toContain('Price override (IDR)');
    expect(edit).toContain('value="949000"');
  });

  it('shows an existing SKU as locked text after the product has been activated', () => {
    const edit = html(<VariantForm {...common} action={action} variant={variant} skuLocked />);
    expect(edit).not.toContain('name="sku"');
    expect(edit).toContain('data-testid="sku-locked"');
    expect(edit).toContain('name="sizeId"');
    expect(edit).toContain('name="colorId"');
    expect(edit).toContain('name="priceOverride"');
    // New variants still choose their own SKU.
    expect(html(<VariantForm {...common} action={action} skuLocked />)).toContain('name="sku"');
  });
});
