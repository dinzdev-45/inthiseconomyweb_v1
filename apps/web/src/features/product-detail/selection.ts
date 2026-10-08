import { SizeCode, Slug, type Money, type StoreAvailability } from '@ite/contracts';

import type { DetailVariant, GalleryImage, ProductDetail } from './types.ts';

/*
 * Color and size selection (product-detail design D4). The URL is the only state: `color` and
 * `size` are read with the contract primitives, checked against the product's variants, and
 * replaced by defaults when missing or not offered. Every option is a link. Pure functions.
 */

export type SelectionParams = Record<string, string | string[] | undefined>;

/**
 * `selected`: the current choice. `available`: in stock. `sold-out`: offered but out of stock
 * (still selectable). `unavailable`: no such variant in the selected color (sizes only).
 */
export type OptionState = 'selected' | 'available' | 'sold-out' | 'unavailable';

export type ColorOption = {
  slug: string;
  name: string;
  hex: string | null;
  state: Exclude<OptionState, 'unavailable'>;
  /** True when every variant of this color is sold out (also when it is the selected one). */
  soldOut: boolean;
  href: string;
};

export type SizeOption = {
  code: string;
  label: string;
  state: OptionState;
  /** True when this size's variant in the selected color is sold out. */
  soldOut: boolean;
  /** null when the size does not exist in the selected color. */
  href: string | null;
};

export type Selection = {
  color: ColorOption;
  colors: ColorOption[];
  size: SizeOption | null;
  sizes: SizeOption[];
  /** The selected variant, when a size is selected. */
  variant: DetailVariant | null;
  /** The variant's price, or the selected color's lowest price ("From" when its prices differ). */
  price: { amount: Money; from: boolean };
  /** The selected variant's availability; null until a size is selected. */
  availability: StoreAvailability | null;
  /** Every variant of the product is sold out. */
  soldOut: boolean;
  /** The selected color's images, then the images tied to no color. */
  gallery: GalleryImage[];
};

/** A single string value from search params (repeated values count as not given). */
function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** The product page URL for a color and, optionally, a size. */
export function selectionHref(slug: string, color: string, size?: string): string {
  const params = new URLSearchParams({ color });
  if (size) params.set('size', size);
  return `/products/${slug}?${params.toString()}`;
}

/**
 * The selection for `product` from the URL's `color` and `size`. Malformed values, and values
 * the product does not offer, fall back to the defaults: the first color by name with an
 * in-stock variant (else the first by name), and no size unless the product has one size.
 */
export function resolveSelection(product: ProductDetail, params: SelectionParams): Selection {
  const { slug, variants } = product;
  const colorList = [...new Map(variants.map((v) => [v.color.slug, v.color])).values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug),
  );
  // Variants are already in size display order (the API orders them).
  const sizeList = [...new Map(variants.map((v) => [v.size.code, v.size])).values()];
  const inColor = (color: string) => variants.filter((v) => v.color.slug === color);
  const allSoldOut = (list: DetailVariant[]) => list.every((v) => v.availability === 'SOLD_OUT');

  const requestedColor = Slug.safeParse(single(params.color));
  const color =
    (requestedColor.success && colorList.find((c) => c.slug === requestedColor.data)) ||
    colorList.find((c) => !allSoldOut(inColor(c.slug))) ||
    colorList[0]!;
  const colorVariants = inColor(color.slug);

  const requestedSize = SizeCode.safeParse(single(params.size));
  const sizeCode =
    requestedSize.success && colorVariants.some((v) => v.size.code === requestedSize.data)
      ? requestedSize.data
      : sizeList.length === 1 && colorVariants.length === 1
        ? sizeList[0]!.code
        : undefined;
  const variant = colorVariants.find((v) => v.size.code === sizeCode) ?? null;

  const colors: ColorOption[] = colorList.map((c) => {
    const soldOut = allSoldOut(inColor(c.slug));
    // Keep the size when it exists in the other color, otherwise drop it.
    const keepSize = sizeCode && inColor(c.slug).some((v) => v.size.code === sizeCode);
    return {
      ...c,
      state: c.slug === color.slug ? 'selected' : soldOut ? 'sold-out' : 'available',
      soldOut,
      href: selectionHref(slug, c.slug, keepSize ? sizeCode : undefined),
    };
  });

  const sizes: SizeOption[] = sizeList.map((s) => {
    const match = colorVariants.find((v) => v.size.code === s.code);
    const soldOut = match?.availability === 'SOLD_OUT';
    return {
      ...s,
      state: !match
        ? 'unavailable'
        : s.code === sizeCode
          ? 'selected'
          : soldOut
            ? 'sold-out'
            : 'available',
      soldOut,
      href: match ? selectionHref(slug, color.slug, s.code) : null,
    };
  });

  const prices = colorVariants.map((v) => v.price.amount);
  const lowest = colorVariants.find((v) => v.price.amount === Math.min(...prices))!.price;

  return {
    color: colors.find((c) => c.slug === color.slug)!,
    colors,
    size: sizes.find((s) => s.code === sizeCode) ?? null,
    sizes,
    variant,
    price: variant
      ? { amount: variant.price, from: false }
      : { amount: lowest, from: new Set(prices).size > 1 },
    availability: variant?.availability ?? null,
    soldOut: allSoldOut(variants),
    gallery: [
      ...product.images.filter((image) => image.color === color.slug),
      ...product.images.filter((image) => image.color === null),
    ],
  };
}
