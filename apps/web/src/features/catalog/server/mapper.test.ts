import type { StoreProductSummary } from '@ite/contracts';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { colorLabel, isAllowedImage, toProductSummary } = await import('./mapper.ts');

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const HOSTS = ['cdn.example.com'];
const product: StoreProductSummary = {
  slug: 'overdraft-hoodie',
  name: 'Overdraft Hoodie',
  category: { slug: 'tops', name: 'Tops' },
  price: { min: idr(89_900_000), max: idr(89_900_000) },
  availability: 'IN_STOCK',
  colors: [{ slug: 'washed-black', name: 'Washed Black', hex: '#2B2A28' }],
  image: { url: '/images/products/overdraft-hoodie/front.jpg', alt: 'Front view' },
  secondaryImage: { url: 'https://cdn.example.com/back.jpg', alt: 'Back view' },
};

describe('catalog mapper', () => {
  it('maps a single-price, single-color product to the card view model', () => {
    expect(toProductSummary(product, HOSTS)).toEqual({
      slug: 'overdraft-hoodie',
      name: 'Overdraft Hoodie',
      color: 'Washed Black',
      price: idr(89_900_000),
      availability: 'IN_STOCK',
      image: {
        src: '/images/products/overdraft-hoodie/front.jpg',
        alt: 'Front view',
        width: 800,
        height: 1000,
      },
      hoverImage: {
        src: 'https://cdn.example.com/back.jpg',
        alt: 'Back view',
        width: 800,
        height: 1000,
      },
    });
  });

  it('keeps the highest price only for a price range', () => {
    const range = toProductSummary(
      { ...product, price: { min: idr(89_900_000), max: idr(94_900_000) } },
      HOSTS,
    );
    expect(range.price).toEqual(idr(89_900_000));
    expect(range.priceMax).toEqual(idr(94_900_000));
    expect(toProductSummary(product, HOSTS)).not.toHaveProperty('priceMax');
  });

  it('passes availability through', () => {
    expect(toProductSummary({ ...product, availability: 'SOLD_OUT' }, HOSTS).availability).toBe(
      'SOLD_OUT',
    );
  });

  it('names one color, counts several', () => {
    expect(colorLabel(product.colors)).toBe('Washed Black');
    expect(
      colorLabel([
        ...product.colors,
        { slug: 'bone', name: 'Bone', hex: null },
        { slug: 'red', name: 'Red', hex: null },
      ]),
    ).toBe('3 colors');
    expect(colorLabel([])).toBe('');
  });

  it.each([
    ['/images/a.jpg', true],
    ['https://cdn.example.com/a.jpg', true],
    ['https://CDN.example.com/a.jpg', true],
    ['https://cdn.example.com:8443/a.jpg', false],
    ['https://evil.example.com/a.jpg', false],
    ['https://cdn.example.com.evil.net/a.jpg', false],
    ['http://cdn.example.com/a.jpg', false],
    ['//cdn.example.com/a.jpg', false],
  ])('allows %s → %s', (url, allowed) => {
    expect(isAllowedImage(url, HOSTS)).toBe(allowed);
  });

  it('drops images that are missing or not on an allowed host', () => {
    const mapped = toProductSummary(
      {
        ...product,
        image: { url: 'https://elsewhere.example.org/a.jpg', alt: 'Front' },
        secondaryImage: null,
      },
      HOSTS,
    );
    expect(mapped.image).toBeNull();
    expect(mapped.hoverImage).toBeNull();
    expect(toProductSummary({ ...product, image: null }, []).image).toBeNull();
    // Without configured hosts, only root-relative images remain.
    expect(toProductSummary(product, []).hoverImage).toBeNull();
  });
});
