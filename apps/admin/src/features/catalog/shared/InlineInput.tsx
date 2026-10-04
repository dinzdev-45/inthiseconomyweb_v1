import type { InputHTMLAttributes } from 'react';

/**
 * A compact input for table rows: labelled by `label` (screen readers) and, when there is an
 * error, described by it and marked invalid. The error text is shown under the input.
 */
export function InlineInput({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  name: string;
}) {
  const errorId = `${props.name}-${label.replace(/\W+/g, '-')}-error`;
  return (
    <span className="block">
      <input
        {...props}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="w-full min-w-24 rounded border border-line bg-white px-2 py-1 outline-none focus:border-ink"
      />
      {error ? (
        <span id={errorId} className="block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
