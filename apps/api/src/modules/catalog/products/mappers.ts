import type {
  ProductDetail,
  ProductImage,
  ProductListItem,
  ProductStockSummary,
  ProductVariant,
} from '@ite/contracts';
import type {
  Category as CategoryRow,
  Color as ColorRow,
  ProductImage as ProductImageRow,
  ProductVariant as ProductVariantRow,
  Size as SizeRow,
} from '@ite/db';

import { attributionFields } from '../attribution.ts';
import { effectivePrice, priceOverride, toPrice } from '../money.ts';
import type { ProductDetailRow, ProductListRow } from './repository.ts';

/*
 * Product responses (product-management spec). Only API fields: prices as Money (never the
 * `*_amount` columns), references as compact summaries, attribution as `createdBy`/`updatedBy`.
 */

type PricedProduct = { basePriceAmount: number; currency: string };

function categoryRef(category: CategoryRow) {
  return { id: category.id, name: category.name, slug: category.slug, status: category.status };
}

export function toProductVariant(
  product: PricedProduct,
  variant: ProductVariantRow & { size: SizeRow; color: ColorRow },
): ProductVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    size: { id: variant.size.id, code: variant.size.code, label: variant.size.label },
    color: {
      id: variant.color.id,
      name: variant.color.name,
      slug: variant.color.slug,
      hex: variant.color.hex,
    },
    priceOverride: priceOverride(product, variant),
    effectivePrice: effectivePrice(product, variant),
    stockQuantity: variant.stockQuantity,
    status: variant.status,
    ...attributionFields(variant),
  };
}

export function toProductImage(image: ProductImageRow): ProductImage {
  return {
    id: image.id,
    url: image.url,
    alt: image.alt,
    variantId: image.variantId,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    ...attributionFields(image),
  };
}

export function toProductDetail(row: ProductDetailRow): ProductDetail {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    category: categoryRef(row.category),
    basePrice: toPrice(row.basePriceAmount, row.currency),
    activatedAt: row.activatedAt?.toISOString() ?? null,
    variants: row.variants.map((variant) => toProductVariant(row, variant)),
    images: row.images.map(toProductImage),
    ...attributionFields(row),
  };
}

const NO_STOCK: ProductStockSummary = {
  totalQuantity: 0,
  activeVariantCount: 0,
  outOfStockVariantCount: 0,
};

/** A list item; `stock` comes from the page's stock summaries (absent → no active variants). */
export function toProductListItem(
  row: ProductListRow,
  stock: ProductStockSummary = NO_STOCK,
): ProductListItem {
  const primary = row.images[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    category: categoryRef(row.category),
    basePrice: toPrice(row.basePriceAmount, row.currency),
    variantCount: row._count.variants,
    stock,
    primaryImage: primary ? { id: primary.id, url: primary.url, alt: primary.alt } : null,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    ...attributionFields(row),
  };
}
