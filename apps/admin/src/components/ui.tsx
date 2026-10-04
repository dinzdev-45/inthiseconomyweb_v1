import type {
  ComponentPropsWithRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="block text-danger">{error}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded border border-line bg-white px-3 py-2 outline-none focus:border-ink"
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={4}
      {...props}
      className="w-full rounded border border-line bg-white px-3 py-2 outline-none focus:border-ink"
    />
  );
}

/** A small text label. `tone` adds emphasis; the text itself always carries the meaning. */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'strong' | 'muted' | 'danger';
  children: ReactNode;
}) {
  const styles = {
    neutral: 'border-line bg-white text-ink',
    strong: 'border-ink bg-ink text-paper',
    muted: 'border-line bg-paper text-muted',
    danger: 'border-danger/40 bg-danger/5 text-danger',
  }[tone];
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="rounded border border-line bg-white px-2 py-1" />;
}

export function Button({
  variant = 'primary',
  ...props
}: ComponentPropsWithRef<'button'> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'bg-ink text-paper hover:opacity-90'
      : 'border border-line bg-white hover:border-ink';
  return (
    <button
      {...props}
      className={`rounded px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}
    />
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
    >
      {children}
    </p>
  );
}
