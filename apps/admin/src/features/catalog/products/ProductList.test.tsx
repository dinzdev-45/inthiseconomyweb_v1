import type { ProductListItem } from '@ite/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const { ProductList } = await import('./ProductList.tsx');

const CATEGORY_ID = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const item = (overrides: Partial<ProductListItem> = {}): ProductListItem => ({
  id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a21',
  name: 'Overdraft Hoodie',
  slug: 'overdraft-hoodie',
  status: 'DRAFT',
  category: { id: CATEGORY_ID, name: 'Apparel', slug: 'apparel', status: 'ACTIVE' },
  basePrice: { amount: 89_900_000, currency: 'IDR' },
  variantCount: 3,
  stock: { totalQuantity: 12, activeVariantCount: 2, outOfStockVariantCount: 1 },
  primaryImage: {
    id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a22',
    url: '/img/front.jpg',
    alt: 'Front view',
  },
  activatedAt: null,
  createdAt: '2026-10-04T09:15:00.000Z',
  updatedAt: '2026-10-04T09:15:00.000Z',
  createdBy: null,
  updatedBy: null,
  ...overrides,
});

const render = (props: Partial<Parameters<typeof ProductList>[0]> = {}) =>
  renderToStaticMarkup(
    <ProductList items={[item()]} nextCursor={null} state={{}} canManage {...props} />,
  ).replace(/\u00a0/g, ' ');

describe('admin-catalog-ui: Progress, empty, and success states', () => {
  it('Empty catalog list', () => {
    // The catalog itself is empty: say so, and offer to create the first product.
    const empty = render({ items: [], state: {} });
    expect(empty).toContain('No products yet.');
    expect(empty).toContain('href="/catalog/products/new"');
    // Nothing matches the current search or filters: a different message, no create link.
    const noMatches = render({ items: [], state: { q: 'nothing-like-this' } });
    expect(noMatches).toContain('No products match this search and these filters.');
    expect(noMatches).toContain('clear all filters');
    expect(noMatches).not.toContain('/catalog/products/new');
    // Without catalog:manage, the empty catalog has no create link.
    expect(render({ items: [], canManage: false })).not.toContain('/catalog/products/new');
  });
});

describe('ProductList rendering', () => {
  it('shows each column, linking the name to the product page', () => {
    const html = render();
    expect(html).toContain('src="/img/front.jpg"');
    expect(html).toContain('alt="Front view"');
    expect(html).toContain('href="/catalog/products/0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a21"');
    expect(html).toContain('overdraft-hoodie');
    expect(html).toContain('Apparel');
    expect(html).toContain('Draft');
    expect(html).toContain('Rp 899.000');
    expect(html).toContain('12 units in stock');
    expect(html).toContain('2 active variants');
    expect(html).toContain('1 out of stock');
    expect(html).toContain('4 Oct 2026, 09:15:00 UTC');
  });

  it('shows a placeholder without a primary image, and words for empty stock', () => {
    const html = render({
      items: [
        item({
          primaryImage: null,
          variantCount: 0,
          stock: { totalQuantity: 0, activeVariantCount: 0, outOfStockVariantCount: 0 },
        }),
      ],
    });
    expect(html).toContain('data-testid="thumbnail-placeholder"');
    expect(html).toContain('No image');
    expect(html).toContain('No active variants');
    expect(html).not.toContain('out of stock');
  });

  it('shows row lifecycle actions only to staff who can manage', () => {
    expect(render()).toContain('aria-label="Activate Overdraft Hoodie"');
    const readOnly = render({ canManage: false });
    expect(readOnly).not.toContain('<button');
    expect(readOnly).not.toContain('>Actions<');
    expect(readOnly).toContain('Overdraft Hoodie');
  });

  it('links to the next page and back to the first, keeping search and filters', () => {
    const state = { q: 'hoodie', status: 'DRAFT' as const, cursor: 'c1' };
    const html = render({ state, nextCursor: 'c2' });
    expect(html).toContain('href="/catalog/products?q=hoodie&amp;status=DRAFT&amp;cursor=c2"');
    expect(html).toContain('href="/catalog/products?q=hoodie&amp;status=DRAFT"');
    expect(html).toContain('>Next page<');
    expect(html).toContain('>First page<');
    // First page with no more results: no pagination at all.
    expect(render({ nextCursor: null, state: {} })).not.toContain('aria-label="Pagination"');
  });
});
