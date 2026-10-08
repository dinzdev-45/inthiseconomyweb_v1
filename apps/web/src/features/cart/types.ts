import type { CartLineStatus, Money } from '@ite/contracts';

import type { Media } from '@/features/catalog';

/** A cart line ready to render: the image is null when missing or not on an allowed host. */
export type CartLineView = {
  id: string;
  name: string;
  /** The product page with this line's color and size selected. */
  href: string;
  image: Media | null;
  colorName: string;
  sizeCode: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  status: CartLineStatus;
};

export type CartViewModel = { lines: CartLineView[]; itemCount: number; subtotal: Money };
