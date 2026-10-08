import 'server-only';

import type { StoreCart } from '@ite/contracts';

import { isAllowedImage } from '@/lib/images';

import type { CartViewModel } from '../types.ts';

/** Store API cart → cart page view model (images limited to allowed hosts). */
export function toCartView(cart: StoreCart, allowedHosts: readonly string[]): CartViewModel {
  return {
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    lines: cart.lines.map((line) => {
      const params = new URLSearchParams({ color: line.color.slug, size: line.size.code });
      const image = line.product.image;
      return {
        id: line.id,
        name: line.product.name,
        href: `/products/${line.product.slug}?${params.toString()}`,
        image:
          image && isAllowedImage(image.url, allowedHosts)
            ? { src: image.url, alt: image.alt, width: 800, height: 1000 }
            : null,
        colorName: line.color.name,
        sizeCode: line.size.code,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        status: line.status,
      };
    }),
  };
}
