'use client';

import { useId, useRef, useState, type FormEvent } from 'react';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Colours per surface: light (warm white) or dark (Near Black footer). Errors use Dark Brown
 * on light (7.40:1) and Soft Brown on dark (9.34:1), never red.
 */
const TONES = {
  light: {
    label: 'text-ink',
    field: 'border-ink',
    input: 'text-ink placeholder:text-stone',
    button: 'bg-ink text-paper hover:bg-brand-dark',
    error: 'text-brand-dark',
  },
  dark: {
    label: 'text-sand',
    field: 'border-cream',
    input: 'text-cream placeholder:text-sand',
    button: 'bg-cream text-ink hover:bg-paper',
    error: 'text-soft',
  },
} as const;

export const NEWSLETTER_NOT_OPEN =
  'Newsletter sign-up isn’t open yet — we haven’t saved your email.';

/**
 * Frontend-only newsletter form (design D8). Validates in the browser and then
 * says honestly that sign-up isn't open: it sends nothing anywhere and writes
 * nothing to cookies or storage. The status region is always rendered so the
 * message is announced politely.
 */
export function NewsletterForm({
  label = 'Newsletter sign-up',
  tone = 'light',
}: {
  label?: string;
  tone?: keyof typeof TONES;
}) {
  const colors = TONES[tone];
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const errorId = `${id}-error`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = inputRef.current?.value.trim() ?? '';
    if (!EMAIL.test(email)) {
      setError('Enter a valid email address, like name@example.com.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setDone(true);
  }

  return (
    <div>
      {done ? null : (
        <form aria-label={label} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
          <label htmlFor={`${id}-email`} className={`text-label uppercase ${colors.label}`}>
            Email
          </label>
          <div className={`flex border ${colors.field}`}>
            <input
              ref={inputRef}
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              size={1}
              inputMode="email"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`w-full min-w-0 flex-1 bg-transparent px-4 py-3 text-base focus-visible:outline-offset-0 ${colors.input}`}
              placeholder="name@example.com"
            />
            <button
              type="submit"
              className={`shrink-0 px-5 text-label font-semibold uppercase ${colors.button}`}
            >
              Notify me
            </button>
          </div>
          {error ? (
            <p id={errorId} className={`text-sm ${colors.error}`}>
              {error}
            </p>
          ) : null}
        </form>
      )}
      <p
        role="status"
        aria-live="polite"
        className={done ? `text-sm ${tone === 'dark' ? 'text-cream' : 'text-ink'}` : 'sr-only'}
      >
        {done ? NEWSLETTER_NOT_OPEN : ''}
      </p>
    </div>
  );
}
