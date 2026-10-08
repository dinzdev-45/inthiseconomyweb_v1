import { describe, expect, it } from 'vitest';

import { resolveSelection, selectionHref } from './selection.ts';
import type { DetailVariant, ProductDetail } from './types.ts';

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const COLORS = {
  black: { slug: 'black', name: 'Black', hex: '#171615' },
  white: { slug: 'white', name: 'White', hex: null },
  bone: { slug: 'bone', name: 'Bone', hex: null },
};
const variant = (
  size: 'S' | 'M' | 'L',
  color: keyof typeof COLORS,
  amount = 79_900_000,
  availability: DetailVariant['availability'] = 'IN_STOCK',
): DetailVariant => ({
  size: { code: size, label: { S: 'Small', M: 'Medium', L: 'Large' }[size] },
  color: COLORS[color],
  price: idr(amount),
  availability,
});
const image = (src: string, color: string | null) => ({
  src,
  alt: src,
  width: 1,
  height: 1,
  color,
});

/** Black in M and L (L sold out, dearer); white only in M. API order: by size, then color name. */
const PRODUCT: ProductDetail = {
  slug: 'two-tone-hoodie',
  name: 'Two Tone Hoodie',
  category: { slug: 'apparel', name: 'Apparel' },
  description: null,
  price: { min: idr(79_900_000), max: idr(82_900_000) },
  availability: 'IN_STOCK',
  images: [image('/black.jpg', 'black'), image('/plain.jpg', null), image('/white.jpg', 'white')],
  variants: [
    variant('M', 'black'),
    variant('M', 'white'),
    variant('L', 'black', 82_900_000, 'SOLD_OUT'),
  ],
};
const states = (options: { state: string }[]) => options.map((o) => o.state);

describe('resolveSelection', () => {
  it('defaults to the first color by name with stock, and no size', () => {
    const s = resolveSelection(PRODUCT, {});
    expect(s.color.slug).toBe('black');
    expect(s.colors.map((c) => c.name)).toEqual(['Black', 'White']);
    expect(s.size).toBeNull();
    expect(s.variant).toBeNull();
    expect(s.availability).toBeNull();
  });

  it('skips a first color that is sold out in every size', () => {
    const product = {
      ...PRODUCT,
      variants: [variant('M', 'bone', 79_900_000, 'SOLD_OUT'), ...PRODUCT.variants],
    };
    const s = resolveSelection(product, {});
    expect(s.color.slug).toBe('black');
    expect(s.colors.find((c) => c.slug === 'bone')).toMatchObject({
      state: 'sold-out',
      soldOut: true,
    });
    // When every color is sold out, the first by name is used.
    const allGone = {
      ...PRODUCT,
      variants: PRODUCT.variants.map((v) => ({ ...v, availability: 'SOLD_OUT' as const })),
    };
    const gone = resolveSelection(allGone, {});
    expect(gone.color.slug).toBe('black');
    expect(gone.soldOut).toBe(true);
  });

  it('selects the single size of a one-size product', () => {
    const cap = { ...PRODUCT, variants: [variant('M', 'black')] };
    expect(resolveSelection(cap, {}).size?.code).toBe('M');
  });

  it('reads color and size from the URL, normalizing the size code', () => {
    const s = resolveSelection(PRODUCT, { color: 'white', size: 'm' });
    expect(s.color.slug).toBe('white');
    expect(s.size?.code).toBe('M');
    expect(s.variant).toEqual(variant('M', 'white'));
    expect(s.availability).toBe('IN_STOCK');
  });

  it.each([
    [{ color: 'purple' }],
    [{ color: 'Not A Slug' }],
    [{ color: ['white', 'black'] }],
    [{ size: 'M L' }],
    [{ size: 'XXL' }],
  ])('ignores invalid or unoffered values %j', (params) => {
    const s = resolveSelection(PRODUCT, params);
    expect(s.color.slug).toBe('black');
    expect(s.size).toBeNull();
  });

  it('ignores a size that does not exist in the selected color', () => {
    const s = resolveSelection(PRODUCT, { color: 'white', size: 'L' });
    expect(s.color.slug).toBe('white');
    expect(s.size).toBeNull();
  });

  it('marks size states for the selected color', () => {
    expect(states(resolveSelection(PRODUCT, { color: 'black' }).sizes)).toEqual([
      'available',
      'sold-out',
    ]);
    expect(states(resolveSelection(PRODUCT, { color: 'black', size: 'L' }).sizes)).toEqual([
      'available',
      'selected',
    ]);
    const white = resolveSelection(PRODUCT, { color: 'white' }).sizes;
    expect(states(white)).toEqual(['available', 'unavailable']);
    expect(white[1]!.href).toBeNull();
  });

  it('a sold-out size stays selectable and reports its availability', () => {
    const s = resolveSelection(PRODUCT, { color: 'black', size: 'L' });
    expect(s.size).toMatchObject({ code: 'L', soldOut: true });
    expect(s.availability).toBe('SOLD_OUT');
    expect(s.price).toEqual({ amount: idr(82_900_000), from: false });
  });

  it('builds option links: color changes keep the size only when it exists there', () => {
    const s = resolveSelection(PRODUCT, { color: 'black', size: 'L' });
    expect(s.colors.map((c) => c.href)).toEqual([
      '/products/two-tone-hoodie?color=black&size=L',
      '/products/two-tone-hoodie?color=white',
    ]);
    expect(s.sizes.map((o) => o.href)).toEqual([
      '/products/two-tone-hoodie?color=black&size=M',
      '/products/two-tone-hoodie?color=black&size=L',
    ]);
    const m = resolveSelection(PRODUCT, { color: 'black', size: 'M' });
    expect(m.colors[1]!.href).toBe('/products/two-tone-hoodie?color=white&size=M');
    expect(selectionHref('cap', 'bone')).toBe('/products/cap?color=bone');
  });

  it('shows the color price, with "From" only when its prices differ', () => {
    expect(resolveSelection(PRODUCT, { color: 'black' }).price).toEqual({
      amount: idr(79_900_000),
      from: true,
    });
    expect(resolveSelection(PRODUCT, { color: 'white' }).price).toEqual({
      amount: idr(79_900_000),
      from: false,
    });
  });

  it('orders the gallery: selected color, then untied images; other colors left out', () => {
    expect(resolveSelection(PRODUCT, { color: 'white' }).gallery.map((i) => i.src)).toEqual([
      '/white.jpg',
      '/plain.jpg',
    ]);
    expect(resolveSelection(PRODUCT, {}).gallery.map((i) => i.src)).toEqual([
      '/black.jpg',
      '/plain.jpg',
    ]);
  });
});
