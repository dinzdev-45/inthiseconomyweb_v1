'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui';

/**
 * Inline two-step confirmation for disruptive actions (admin-catalog-ui spec: Confirmation for
 * disruptive actions). The button turns into a question with Confirm and Cancel; focus moves to
 * Confirm, Escape or Cancel returns to the original button, and nothing is sent until Confirm.
 */
export function ConfirmAction({
  children,
  label,
  question,
  confirmLabel,
  onConfirm,
  busy = false,
  disabled = false,
}: {
  /** Visible text of the first button, e.g. "Archive". */
  children: string;
  /** Accessible name of the first button, starting with the visible text, e.g. "Archive Overdraft Hoodie". */
  label: string;
  /** Shown while confirming, e.g. "Archive this product?". */
  question: string;
  /** e.g. "Confirm archive". */
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      triggerRef.current?.focus();
    }
  }, [confirming]);

  function cancel() {
    returnFocus.current = true;
    setConfirming(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  if (!confirming) {
    return (
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        disabled={disabled || busy}
        aria-label={label}
        onClick={() => setConfirming(true)}
      >
        {children}
      </Button>
    );
  }

  return (
    <span
      role="group"
      aria-label={question}
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-2"
    >
      <span className="text-sm">{question}</span>
      <Button
        ref={confirmRef}
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          await onConfirm();
          setConfirming(false);
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="secondary" disabled={busy} onClick={cancel}>
        Cancel
      </Button>
    </span>
  );
}
