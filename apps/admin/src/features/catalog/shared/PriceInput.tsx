import { toMajorUnits, type Money } from '@ite/contracts';

import { Field, Input } from '@/components/ui';

/**
 * A price field in major units, labelled with the store currency (from the API's catalog
 * settings). Read it on submit with `readPrice`/`readOptionalPrice`, which convert to minor units.
 */
export function PriceInput({
  name,
  label,
  storeCurrency,
  defaultValue,
  error,
  required = false,
  disabled,
  hint = 'Digits only, for example 899000.',
}: {
  name: string;
  label: string;
  storeCurrency: string;
  defaultValue?: Money | null;
  error?: string | undefined;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const hintId = `${name}-hint`;
  return (
    <Field label={`${label} (${storeCurrency})`} error={error}>
      <Input
        name={name}
        inputMode="decimal"
        autoComplete="off"
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintId}
        defaultValue={defaultValue ? toMajorUnits(defaultValue.amount, defaultValue.currency) : ''}
      />
      <span id={hintId} className="block text-xs text-muted">
        {hint}
      </span>
    </Field>
  );
}
