import { describe, expect, it } from 'vitest';

import { lifecycleActions, needsConfirmation } from './lifecycle.ts';

describe('lifecycleActions', () => {
  it('offers the published transitions for each status', () => {
    expect(lifecycleActions('DRAFT')).toEqual(['activate', 'archive']);
    expect(lifecycleActions('ACTIVE')).toEqual(['deactivate']);
    expect(lifecycleActions('INACTIVE')).toEqual(['activate', 'archive']);
    expect(lifecycleActions('ARCHIVED')).toEqual(['restore']);
  });

  it('confirms deactivate and archive only', () => {
    expect(needsConfirmation('deactivate')).toBe(true);
    expect(needsConfirmation('archive')).toBe(true);
    expect(needsConfirmation('activate')).toBe(false);
    expect(needsConfirmation('restore')).toBe(false);
  });
});
