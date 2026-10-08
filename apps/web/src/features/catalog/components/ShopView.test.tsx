import type { StoreCatalogFilters } from '@ite/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProductSummary } from '../types.ts';
import { DEFAULT_STATE } from '../url-state.ts';
import { CatalogSkeleton } from './CatalogSkeleton.tsx';
import { ShopView } from './ShopView.tsx';

const FILTERS: StoreCatalogFilters = {
  categories: [{ slug: 'outerwear', name: 'Outerwear', productCount: 2 }],
  sizes: [{ code: 'M', label: 'Medium' }],
  colors: [{ slug: 'black', name: 'Black', hex: '#171615' }],
};
const product = (i: number): ProductSummary => ({
  slug: `product-${i}`,
  name: `Product ${i}`,
  color: 'Black',
  price: { amount: 100_000 * i, currency: 'IDR' },
  availability: 'IN_STOCK',
  image: null,
  hoverImage: null,
});
const page = (products: ProductSummary[], totalItems = products.length) => ({
  products,
  page: 1,
  pageSize: 24,
  totalItems,
  totalPages: Math.ceil(totalItems / 24),
});

describe('storefront-catalog: Catalog states', () => {
  it('Empty catalog', () => {
    const { container } = render(
      <ShopView state={DEFAULT_STATE} ignored={false} page={page([])} filters={FILTERS} />,
    );
    expect(screen.getByText(/no products yet/i)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to the homepage' }).getAttribute('href')).toBe(
      '/',
    );
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });

  it('No filter results', () => {
    render(
      <ShopView
        state={{ ...DEFAULT_STATE, size: 'M', sort: 'price-asc' }}
        ignored={false}
        page={page([])}
        filters={FILTERS}
      />,
    );
    expect(screen.getByText('No products match these filters.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe(
      '/shop?sort=price-asc',
    );
    expect(screen.getByRole('status').textContent).toBe('0 products');
  });

  it('Catalog loading skeleton', () => {
    const { container } = render(<CatalogSkeleton heading="Shop" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    const cards = container.querySelectorAll('[data-skeleton] > li');
    expect(cards.length).toBeGreaterThanOrEqual(4);
    for (const card of cards) {
      const frame = card.querySelector('[data-media="placeholder"]') as HTMLElement;
      expect(frame.style.aspectRatio).toBe('0.8 / 1');
    }
    // Same grid as the real catalog.
    expect(container.querySelector('[data-skeleton]')!.className).toMatch(
      /grid-cols-2.*md:grid-cols-3.*lg:grid-cols-4/,
    );
  });
});

describe('ShopView', () => {
  it('lists products as a list of single-link cards with the count and filters', () => {
    const products = Array.from({ length: 3 }, (_, i) => product(i + 1));
    render(
      <ShopView state={DEFAULT_STATE} ignored={false} page={page(products)} filters={FILTERS} />,
    );
    const list = screen.getAllByRole('list').find((ul) => ul.className.includes('grid-cols-2'))!;
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getAllByRole('link')).toHaveLength(3);
    expect(screen.getByRole('status').textContent).toBe('3 products');
    expect(screen.getByRole('heading', { level: 1, name: 'Shop' })).toBeDefined();
  });

  it('explains a page beyond the last page with a link to page 1', () => {
    render(
      <ShopView
        state={{ ...DEFAULT_STATE, page: 9 }}
        ignored={false}
        page={{ ...page([], 30), page: 9 }}
        filters={FILTERS}
      />,
    );
    expect(screen.getByText('There are no products on page 9.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Go to page 1' }).getAttribute('href')).toBe('/shop');
  });
});
