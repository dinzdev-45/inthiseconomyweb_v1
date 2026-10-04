import type { Ref } from 'react';

import type { CatalogProblem } from './problem.ts';

/**
 * The error summary at the top of a catalog form or section (admin-catalog-ui spec: API error
 * rendering). Announced as an alert; focusable so focus can move here after a failed submit.
 * `fieldLabels` names fields in the list (field messages also appear next to their fields).
 */
export function ErrorSummary({
  problem,
  summaryRef,
  fieldLabels = {},
  title,
}: {
  problem: CatalogProblem | null;
  summaryRef?: Ref<HTMLDivElement>;
  fieldLabels?: Record<string, string>;
  /** Context shown before the message, e.g. "Could not activate “Overdraft Hoodie”." */
  title?: string | undefined;
}) {
  if (!problem) return null;
  const fields = Object.entries(problem.fieldErrors);
  return (
    <div
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
      data-problem-kind={problem.kind}
      className="space-y-1 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger outline-none focus:ring-2 focus:ring-danger/40"
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <p className={title ? undefined : 'font-medium'}>{problem.message}</p>
      {fields.length > 0 && problem.kind === 'validation' ? (
        <ul className="list-inside list-disc">
          {fields.map(([path, message]) => (
            <li key={path}>
              {fieldLabels[path] ?? path}: {message}
            </li>
          ))}
        </ul>
      ) : null}
      {problem.reference ? <p className="text-xs">Reference: {problem.reference}</p> : null}
    </div>
  );
}

/** The message for one field, if the problem has one. */
export function fieldError(problem: CatalogProblem | null, path: string): string | undefined {
  return problem?.fieldErrors[path];
}
