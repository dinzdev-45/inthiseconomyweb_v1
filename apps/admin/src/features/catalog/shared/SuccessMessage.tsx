/**
 * A polite live region for "saved" style messages. It is always rendered (empty when there is
 * nothing to say) so assistive technology picks up the message when it appears.
 */
export function SuccessMessage({ message }: { message: string | null }) {
  return (
    <p role="status" aria-live="polite" className="min-h-5 text-sm text-ink">
      {message ?? ''}
    </p>
  );
}
