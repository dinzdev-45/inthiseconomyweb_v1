import type { Category, ProductDetail } from '@ite/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const { ProductForm } = await import('./ProductForm.tsx');
const { LifecycleSection } = await import('./LifecycleSection.tsx');
const { ProductSummary } = await import('./ProductSummary.tsx');
const { VariantsTable } = await import('./VariantsTable.tsx');
const { ImagesList } = await import('./ImagesList.tsx');

const ID = (n: number) => `0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a${String(n).padStart(2, '0')}`;
const attribution = {
  createdAt: '2026-10-04T09:15:00.000Z',
  updatedAt: '2026-10-04T10:30:00.000Z',
  createdBy: null,
  updatedBy: null,
};
const category: Category = {
  id: ID(1),
  name: 'Apparel',
  slug: 'apparel',
  status: 'ACTIVE',
  ...attribution,
};
const product = (overrides: Partial<ProductDetail> = {}): ProductDetail => ({
  id: ID(2),
  name: 'Overdraft Hoodie',
  slug: 'overdraft-hoodie',
  description: 'Heavyweight fleece.',
  status: 'DRAFT',
  category: { id: category.id, name: 'Apparel', slug: 'apparel', status: 'ACTIVE' },
  basePrice: { amount: 89_900_000, currency: 'IDR' },
  activatedAt: null,
  variants: [
    {
      id: ID(3),
      sku: 'ITE-OH-M',
      size: { id: ID(4), code: 'M', label: 'Medium' },
      color: { id: ID(5), name: 'Washed Black', slug: 'washed-black', hex: '#2B2A28' },
      priceOverride: null,
      effectivePrice: { amount: 89_900_000, currency: 'IDR' },
      stockQuantity: 12,
      status: 'ACTIVE',
      ...attribution,
    },
  ],
  images: [
    {
      id: ID(6),
      url: '/img/front.jpg',
      alt: 'Front view',
      variantId: null,
      sortOrder: 0,
      isPrimary: true,
      ...attribution,
    },
  ],
  ...attribution,
  ...overrides,
});
const html = (node: React.ReactElement) => renderToStaticMarkup(node).replace(/\u00a0/g, ' ');
const controls = (markup: string) => ({
  forms: (markup.match(/<form/g) ?? []).length,
  buttons: (markup.match(/<button/g) ?? []).length,
  inputs: (markup.match(/<(input|textarea|select)/g) ?? []).length,
});

describe('product page read-only rendering', () => {
  it('shows details, lifecycle, variants, and images without any mutation control', () => {
    const p = product({ status: 'ACTIVE', activatedAt: '2026-10-04T10:00:00.000Z' });
    const markup = [
      html(<LifecycleSection product={p} canManage={false} />),
      html(<ProductSummary product={p} />),
      html(<VariantsTable variants={p.variants} />),
      html(<ImagesList images={p.images} variants={p.variants} />),
    ].join('');
    expect(controls(markup)).toEqual({ forms: 0, buttons: 0, inputs: 0 });
    for (const text of [
      'Active',
      '4 Oct 2026, 10:00:00 UTC',
      'overdraft-hoodie',
      '(locked)',
      'Heavyweight fleece.',
      'Apparel',
      'Rp 899.000',
      'ITE-OH-M',
      'Washed Black',
      '>12<',
      'Front view',
      'Primary',
    ]) {
      expect(markup).toContain(text);
    }
  });

  it('offers the lifecycle actions of the status to staff who can manage', () => {
    const markup = html(<LifecycleSection product={product()} canManage />);
    expect(markup).toContain('aria-label="Activate Overdraft Hoodie"');
    expect(markup).toContain('aria-label="Archive Overdraft Hoodie"');
    expect(markup).not.toContain('Deactivate');
    expect(markup).toContain('Never');
  });
});

describe('ProductForm', () => {
  it('labels the price with the store currency and prefills it in major units', () => {
    const markup = html(
      <ProductForm categories={[category]} storeCurrency="IDR" product={product()} />,
    );
    expect(markup).toContain('Base price (IDR)');
    expect(markup).toContain('value="899000"');
    expect(markup).toContain('name="slug"');
    expect(markup).toContain('Save details');
  });

  it('shows the slug as locked text, not an input, after the first activation', () => {
    const markup = html(
      <ProductForm
        categories={[category]}
        storeCurrency="IDR"
        product={product({ status: 'INACTIVE', activatedAt: '2026-10-04T10:00:00.000Z' })}
      />,
    );
    expect(markup).not.toContain('name="slug"');
    expect(markup).toContain('data-testid="slug-locked"');
    expect(markup).toContain('Locked: the slug cannot change after the product has been activated');
    // Other details stay editable.
    expect(markup).toContain('name="name"');
    expect(markup).toContain('name="basePrice"');
  });

  it('starts empty when creating, asking for a category', () => {
    const markup = html(<ProductForm categories={[category]} storeCurrency="USD" />);
    expect(markup).toContain('Choose a category');
    expect(markup).toContain('Slug (optional; generated from the name)');
    expect(markup).toContain('Base price (USD)');
    expect(markup).toContain('Create product');
  });
});
