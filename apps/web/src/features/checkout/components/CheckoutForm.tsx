'use client';

import { PROVINCES, type Money } from '@ite/contracts';
import { useActionState, type ReactNode } from 'react';

import { placeOrder } from '../actions.ts';
import { INITIAL_STATE, type Field, type FormValues } from '../form.ts';

const input =
  'mt-1 block w-full border border-ink/40 bg-paper px-3 py-2 text-base aria-invalid:border-danger';
const LABELS: Record<Field, string> = {
  email: 'Email',
  name: 'Recipient name',
  phone: 'Mobile number',
  line1: 'Street address',
  line2: 'Apartment, building, etc. (optional)',
  city: 'City or regency',
  province: 'Province',
  postalCode: 'Postal code',
  note: 'Note for delivery (optional)',
};

/**
 * The checkout form (storefront-checkout spec, guest-checkout design D7). `useActionState` keeps it
 * working without client JavaScript; problems come back with the values entered.
 */
export function CheckoutForm({ expectedTotal }: { expectedTotal: Money }) {
  const [state, formAction, pending] = useActionState(placeOrder, INITIAL_STATE);
  const values: FormValues = state.status === 'idle' ? {} : state.values;
  const errors = state.status === 'invalid' ? state.errors : {};
  const fields = Object.keys(errors) as Field[];

  const field = (name: Field, control: (props: FieldProps) => ReactNode) => {
    const error = errors[name];
    return (
      <div>
        <label htmlFor={`checkout-${name}`} className="block text-label uppercase">
          {LABELS[name]}
        </label>
        {control({
          id: `checkout-${name}`,
          name,
          defaultValue: values[name] ?? '',
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `checkout-${name}-error` : undefined,
        })}
        {error ? (
          <p
            id={`checkout-${name}-error`}
            className="mt-1 text-sm text-danger"
            data-field-error={name}
          >
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  // Remount the form whenever the outcome or the total changes, so every field (selects included)
  // shows the values just returned and the hidden total is the one now displayed. A React form
  // reset alone would put a select back to its first option.
  const formKey = `${state.status}:${JSON.stringify(values)}:${expectedTotal.amount}`;

  return (
    <form key={formKey} action={formAction} className="space-y-8" noValidate>
      {state.status === 'invalid' && fields.length > 0 ? (
        <div role="alert" className="border-l-2 border-danger pl-4" data-error-summary>
          <p className="font-semibold">Please check these details:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {fields.map((name) => (
              <li key={name}>
                {/* Padded to a 24 px target (WCAG 2.2 target size). */}
                <a
                  href={`#checkout-${name}`}
                  className="inline-block py-1 underline underline-offset-4"
                >
                  {LABELS[name]}: {errors[name]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.status === 'changed' ? (
        <p role="alert" className="border-l-2 border-brand pl-4" data-checkout-message>
          Your cart changed since you opened checkout. Check the new total before placing your
          order.
        </p>
      ) : null}
      {state.status === 'failed' ? (
        <p role="alert" className="border-l-2 border-danger pl-4" data-checkout-message>
          We couldn’t place your order right now. Please try again.
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-label font-semibold uppercase">Contact</legend>
        {field('email', (p) => (
          <input {...p} type="email" autoComplete="email" className={input} />
        ))}
        {field('phone', (p) => (
          <input {...p} type="tel" inputMode="tel" autoComplete="tel" className={input} />
        ))}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-label font-semibold uppercase">Delivery</legend>
        {field('name', (p) => (
          <input {...p} autoComplete="name" className={input} />
        ))}
        {field('line1', (p) => (
          <input {...p} autoComplete="address-line1" className={input} />
        ))}
        {field('line2', (p) => (
          <input {...p} autoComplete="address-line2" className={input} />
        ))}
        {field('city', (p) => (
          <input {...p} autoComplete="address-level2" className={input} />
        ))}
        {field('province', (p) => (
          <select {...p} autoComplete="address-level1" className={input}>
            <option value="">Choose a province</option>
            {PROVINCES.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </select>
        ))}
        {field('postalCode', (p) => (
          <input
            {...p}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            className={input}
          />
        ))}
        {field('note', (p) => (
          <textarea {...p} rows={3} maxLength={500} className={input} />
        ))}
      </fieldset>

      <input type="hidden" name="expectedAmount" value={expectedTotal.amount} />
      <input type="hidden" name="expectedCurrency" value={expectedTotal.currency} />
      <button
        type="submit"
        disabled={pending}
        className="block w-full bg-ink px-6 py-4 text-label font-semibold text-paper uppercase hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? 'Placing order…' : 'Place order'}
      </button>
      <p className="text-sm text-stone">
        Online payment is coming next. Your order will wait 24 hours for payment.
      </p>
    </form>
  );
}

type FieldProps = {
  id: string;
  name: Field;
  defaultValue: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
};
