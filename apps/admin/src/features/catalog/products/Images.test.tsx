import type { ProductDetail, ProductImage } from '@ite/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const { ImagesList } = await import('./ImagesList.tsx');
const { ImagesSection } = await import('./ImagesSection.tsx');

const ID = (n: number) => `0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a${String(n).padStart(2, '0')}`;
const attribution = {
  createdAt: '2026-10-04T09:15:00.000Z',
  updatedAt: '2026-10-04T10:30:00.000Z',
  createdBy: null,
  updatedBy: null,
};
const image = (n: number, isPrimary = false, variantId: string | null = null): ProductImage => ({
  id: ID(10 + n),
  url: `/img/${n}.jpg`,
  alt: `View ${n}`,
  variantId,
  sortOrder: n,
  isPrimary,
  ...attribution,
});
const product = (images: ProductImage[]): ProductDetail => ({
  id: ID(2),
  name: 'Overdraft Hoodie',
  slug: 'overdraft-hoodie',
  description: null,
  status: 'DRAFT',
  category: { id: ID(1), name: 'Apparel', slug: 'apparel', status: 'ACTIVE' },
  basePrice: { amount: 89_900_000, currency: 'IDR' },
  activatedAt: null,
  variants: [
    {
      id: ID(3),
      sku: 'ITE-OH-M',
      size: { id: ID(4), code: 'M', label: 'Medium' },
      color: { id: ID(5), name: 'Washed Black', slug: 'washed-black', hex: null },
      priceOverride: null,
      effectivePrice: { amount: 89_900_000, currency: 'IDR' },
      stockQuantity: 1,
      status: 'ACTIVE',
      ...attribution,
    },
  ],
  images,
  ...attribution,
});

describe('images list', () => {
  it('is read-only without the manager slots, labelling position, primary, and variant in text', () => {
    const p = product([image(0, true), image(1, false, ID(3))]);
    const markup = renderToStaticMarkup(<ImagesList images={p.images} variants={p.variants} />);
    expect(markup).not.toMatch(/<(button|input|form|select)/);
    expect(markup).toContain('Image 1: ');
    expect(markup).toContain('Image 2: ');
    expect((markup.match(/>Primary</g) ?? []).length).toBe(1);
    expect(markup).toContain('All variants');
    expect(markup).toContain('Variant ITE-OH-M');
    expect(markup).toContain('alt="View 0"');
  });
});

describe('images section', () => {
  it('offers primary, move, edit, and delete controls per image, and the add form', () => {
    const markup = renderToStaticMarkup(
      <ImagesSection product={product([image(0, true), image(1)])} />,
    );
    // Only the non-primary image can be made primary.
    expect(markup).not.toContain('Make image 1 primary');
    expect(markup).toContain('aria-label="Make image 2 primary"');
    // The first image cannot move up, the last cannot move down.
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Move image 1 up"/);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Move image 2 down"/);
    expect(markup).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="Move image 1 down"/);
    expect(markup).toContain('aria-label="Edit image 2"');
    expect(markup).toContain('aria-label="Delete image 2"');
    expect(markup).toContain('2 of 20 images.');
    expect(markup).toContain('Add an image');
    // No file upload anywhere.
    expect(markup).not.toContain('type="file"');
  });

  it('shows the empty state with the add form when there are no images', () => {
    const markup = renderToStaticMarkup(<ImagesSection product={product([])} />);
    expect(markup).toContain('No images yet.');
    expect(markup).toContain('0 of 20 images.');
    expect(markup).toContain('Add an image');
  });
});
