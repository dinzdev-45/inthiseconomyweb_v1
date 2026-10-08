import type { StoreProductDetail } from '@ite/contracts';

/** A store API product detail for unit tests (test data only). */
const idr = (amount: number) => ({ amount, currency: 'IDR' });

export const DETAIL: StoreProductDetail = {
  slug: 'two-tone-hoodie',
  name: 'Two Tone Hoodie',
  category: { slug: 'apparel', name: 'Apparel' },
  price: { min: idr(69_900_000), max: idr(69_900_000) },
  availability: 'IN_STOCK',
  colors: [{ slug: 'black', name: 'Black', hex: '#171615' }],
  image: { url: '/images/front.jpg', alt: 'Front' },
  secondaryImage: null,
  description: 'Two-tone fleece.',
  images: [
    { url: '/images/front.jpg', alt: 'Front', color: 'black' },
    { url: 'https://cdn.example.com/detail.jpg', alt: 'Detail', color: null },
    { url: 'https://elsewhere.example.org/x.jpg', alt: 'Elsewhere', color: null },
  ],
  variants: [
    {
      size: { code: 'M', label: 'Medium' },
      color: { slug: 'black', name: 'Black', hex: '#171615' },
      price: idr(69_900_000),
      availability: 'IN_STOCK',
    },
  ],
};
