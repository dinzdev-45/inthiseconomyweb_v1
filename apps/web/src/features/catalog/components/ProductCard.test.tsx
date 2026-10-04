import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProductSummary } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

const PRODUCT: ProductSummary = {
  slug: 'overdraft-hoodie',
  name: 'Overdraft Hoodie',
  color: 'Washed Black',
  price: { amount: 89_900_000, currency: 'IDR' },
  image: null,
  hoverImage: null,
};
const FRONT = {
  src: '/e2e-fixtures/product-front.png',
  alt: 'Front view',
  width: 800,
  height: 1000,
};
const BACK = { src: '/e2e-fixtures/product-back.png', alt: 'Back view', width: 800, height: 1000 };

describe('storefront-homepage: Product cards', () => {
  it('Product card content', () => {
    render(<ProductCard product={{ ...PRODUCT, image: FRONT }} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/products/overdraft-hoodie');
    expect(link.textContent).toContain('Overdraft Hoodie');
    expect(screen.getByRole('heading', { level: 3, name: 'Overdraft Hoodie' })).toBeDefined();
    expect(screen.getByText('Washed Black')).toBeDefined();
    expect(screen.getByText(/^Rp\s899\.000$/)).toBeDefined();
    expect(screen.getByAltText('Front view')).toBeDefined();
  });

  it('No shopping controls on cards', () => {
    const { container } = render(
      <ProductCard product={{ ...PRODUCT, image: FRONT, hoverImage: BACK }} />,
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(container.querySelectorAll('button, input, form, select')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/wishlist|add to cart|quick add|account/i);
  });
});

describe('ProductCard', () => {
  it('shows a decorative placeholder when the product has no image', () => {
    const { container } = render(<ProductCard product={PRODUCT} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-media="placeholder"]')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(screen.getByRole('link').textContent).toContain('Overdraft Hoodie');
  });

  it('adds the hover image only when both images exist, hidden from assistive technology', () => {
    const { container, rerender } = render(<ProductCard product={{ ...PRODUCT, image: FRONT }} />);
    expect(container.querySelector('[data-hover-image]')).toBeNull();

    rerender(<ProductCard product={{ ...PRODUCT, image: FRONT, hoverImage: BACK }} />);
    const hover = container.querySelector('[data-hover-image]')!;
    expect(hover.getAttribute('aria-hidden')).toBe('true');
    expect(hover.querySelector('img')?.getAttribute('alt')).toBe('Back view');
    // Only the primary image is exposed to assistive technology.
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });

  it('uses the requested heading level', () => {
    render(<ProductCard product={PRODUCT} as="h4" />);
    expect(screen.getByRole('heading', { level: 4, name: 'Overdraft Hoodie' })).toBeDefined();
  });
});
