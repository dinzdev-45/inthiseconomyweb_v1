import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ProductSummary } from '../types.ts';
import baseline from './__fixtures__/homepage-card.json';
import { ProductCard } from './ProductCard.tsx';

vi.mock('server-only', () => ({}));
const { toProductSummary } = await import('../server/mapper.ts');

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const FRONT = {
  src: '/e2e-fixtures/product-front.png',
  alt: 'Front view',
  width: 800,
  height: 1000,
};
const BACK = { src: '/e2e-fixtures/product-back.png', alt: 'Back view', width: 800, height: 1000 };
const HOMEPAGE: ProductSummary = {
  slug: 'overdraft-hoodie',
  name: 'Overdraft Hoodie',
  color: 'Washed Black',
  price: idr(89_900_000),
  image: null,
  hoverImage: null,
};
const CATALOG: ProductSummary = { ...HOMEPAGE, availability: 'IN_STOCK', image: FRONT };

describe('storefront-catalog: Catalog product cards', () => {
  it('Catalog card content', () => {
    const { container } = render(<ProductCard product={CATALOG} />);
    const link = screen.getByRole('link');
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(link.getAttribute('href')).toBe('/products/overdraft-hoodie');
    expect(screen.getByAltText('Front view')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Overdraft Hoodie' })).toBeDefined();
    expect(screen.getByText('Washed Black')).toBeDefined();
    expect(screen.getByText(/^Rp\s899\.000$/)).toBeDefined();
    expect(link.textContent).not.toMatch(/sold out|in stock|from/i);
    expect(container.querySelectorAll('button, input, form, select')).toHaveLength(0);
  });

  it('Price range on a card', () => {
    render(<ProductCard product={{ ...CATALOG, priceMax: idr(94_900_000) }} />);
    expect(screen.getByText(/^From Rp\s899\.000$/)).toBeDefined();
    expect(screen.getByRole('link').textContent).not.toContain('949.000');
    // Equal min and max is a single price.
    render(<ProductCard product={{ ...CATALOG, slug: 'same', priceMax: idr(89_900_000) }} />);
    expect(screen.getAllByText(/^Rp\s899\.000$/)).toHaveLength(1);
  });

  it('Sold-out card', () => {
    render(<ProductCard product={{ ...CATALOG, availability: 'SOLD_OUT' }} />);
    const link = screen.getByRole('link');
    expect(screen.getByText('Sold out')).toBeDefined();
    // Visible text inside the link, so it is part of the accessible name.
    expect(link.contains(screen.getByText('Sold out'))).toBe(true);
    expect(link.hasAttribute('aria-label')).toBe(false);
    expect(link.textContent).toMatch(/Overdraft Hoodie.*Sold out/);
    expect(link.textContent).not.toMatch(/\d+ (left|in stock)/i);
  });

  it('Missing or broken product image', async () => {
    // No image.
    const none = render(<ProductCard product={{ ...CATALOG, image: null }} />);
    expect(none.container.querySelector('img')).toBeNull();
    expect(none.container.querySelector('[data-media="placeholder"]')).not.toBeNull();
    none.unmount();

    // An image on a host that is not allowed never reaches the card.
    const mapped = toProductSummary(
      {
        slug: 'parka',
        name: 'Layoff Parka',
        category: { slug: 'outerwear', name: 'Outerwear' },
        price: { min: idr(1), max: idr(1) },
        availability: 'IN_STOCK',
        colors: [],
        image: { url: 'https://images.not-allowed.test/parka.jpg', alt: 'Front' },
        secondaryImage: null,
      },
      ['cdn.example.com'],
    );
    const disallowed = render(<ProductCard product={mapped} />);
    expect(disallowed.container.querySelector('img')).toBeNull();
    expect(disallowed.container.querySelector('[data-media="placeholder"]')).not.toBeNull();
    disallowed.unmount();

    // An image that fails to load is replaced by the placeholder at the same ratio.
    const { container } = render(<ProductCard product={{ ...CATALOG, hoverImage: BACK }} />);
    const [front, back] = [...container.querySelectorAll('img')];
    act(() => {
      fireEvent.error(front!);
      fireEvent.error(back!);
    });
    expect(container.querySelector('img')).toBeNull();
    const placeholders = container.querySelectorAll('[data-media="placeholder"]');
    expect(placeholders).toHaveLength(2);
    for (const placeholder of placeholders) {
      expect((placeholder as HTMLElement).style.aspectRatio).toBe('0.8 / 1');
      expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    }
  });
});

describe('ProductCard regression', () => {
  it('homepage card output is unchanged (no catalog fields set)', () => {
    // Server-rendered HTML, compared with the card before this change (captured fixture).
    expect(renderToStaticMarkup(<ProductCard product={HOMEPAGE} />)).toBe(baseline.placeholder);
    expect(
      renderToStaticMarkup(
        <ProductCard product={{ ...HOMEPAGE, image: FRONT, hoverImage: BACK }} />,
      ),
    ).toBe(baseline.images);
  });

  it('detects an image that failed before hydration', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const width = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    const { container } = render(<ProductCard product={CATALOG} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-media="placeholder"]')).not.toBeNull();
    complete.mockRestore();
    width.mockRestore();
  });
});
