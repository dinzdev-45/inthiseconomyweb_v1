import { describe, expect, it } from 'vitest';

import { latestSuccess, nextSuccessAt } from './success.ts';

describe('latestSuccess', () => {
  it('shows the newest message, whichever action produced it', () => {
    const first = { success: 'Category archived.', successAt: nextSuccessAt() };
    const second = { success: 'Category created.', successAt: nextSuccessAt() };
    expect(latestSuccess(first, second)).toBe('Category created.');
    expect(latestSuccess(second, first)).toBe('Category created.');
  });

  it('ignores cleared messages and returns null when there is none', () => {
    const cleared = { success: null, successAt: nextSuccessAt() };
    const older = { success: 'Size deleted.', successAt: 1 };
    expect(latestSuccess(cleared, older)).toBe('Size deleted.');
    expect(latestSuccess({ success: null, successAt: 0 })).toBeNull();
  });
});
