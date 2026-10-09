import { formatReleaseDateTime } from '@/lib/release-date';

import { addToCart } from '../actions.ts';
import { ADD_FAILURE_MESSAGES, type AddFailure } from '../outcome.ts';

const button =
  'mt-8 block w-full px-6 py-4 text-label font-semibold uppercase disabled:cursor-not-allowed';

type AddToCartFormProps = {
  productSlug: string;
  colorSlug: string;
  /** null until a size is selected. */
  sizeCode: string | null;
  /** The selected variant is sold out. */
  soldOut: boolean;
  /** When the product releases (ISO 8601), or null once released. */
  releaseAt?: string | null;
  /** The product page with its selection, to come back to when the add fails. */
  returnTo: string;
  /** Why the last add failed (from the `cart` search param). */
  failure?: AddFailure;
};

/**
 * "Add to cart" for the selected variant (storefront-cart spec): a plain form posting to a Server
 * Action, so it works without client JavaScript. Unavailable, with the reason as its text, until
 * a size is chosen, when the variant is sold out, or, whatever the selection, until the product
 * releases.
 */
export function AddToCartForm({
  productSlug,
  colorSlug,
  sizeCode,
  soldOut,
  releaseAt = null,
  returnTo,
  failure,
}: AddToCartFormProps) {
  const message = failure ? (
    <p role="status" className="mt-3 border-l-2 border-brand pl-3 text-sm" data-cart-message>
      {ADD_FAILURE_MESSAGES[failure]}
    </p>
  ) : null;

  if (releaseAt) {
    return (
      <div data-add-to-cart>
        <button type="button" disabled className={`${button} bg-sand/60 text-ink/70`}>
          Releases {formatReleaseDateTime(releaseAt)}
        </button>
        {message}
      </div>
    );
  }
  if (!sizeCode || soldOut) {
    return (
      <div data-add-to-cart>
        <button type="button" disabled className={`${button} bg-sand/60 text-ink/70`}>
          {soldOut && sizeCode ? 'Sold out' : 'Select a size'}
        </button>
        {message}
      </div>
    );
  }
  return (
    <div data-add-to-cart>
      <form action={addToCart}>
        <input type="hidden" name="productSlug" value={productSlug} />
        <input type="hidden" name="colorSlug" value={colorSlug} />
        <input type="hidden" name="sizeCode" value={sizeCode} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className={`${button} bg-ink text-paper hover:bg-brand-dark`}>
          Add to cart
        </button>
      </form>
      {message}
    </div>
  );
}
