import { describe, expect, it } from 'vitest';

import { readinessReasons } from './readiness.ts';

describe('readinessReasons', () => {
  it('lists the API reasons in its own words', () => {
    expect(
      readinessReasons(
        'The product is not ready to activate: its category is archived; it has no active variant; it has no images.',
      ),
    ).toEqual({
      lead: 'The product is not ready to activate:',
      reasons: ['Its category is archived', 'It has no active variant', 'It has no images'],
    });
  });

  it('handles a single reason', () => {
    expect(
      readinessReasons('The product is not ready to activate: it has no primary image.'),
    ).toEqual({
      lead: 'The product is not ready to activate:',
      reasons: ['It has no primary image'],
    });
  });

  it('returns null for text in another form (shown verbatim by callers)', () => {
    expect(readinessReasons('Not ready.')).toBeNull();
    expect(readinessReasons('')).toBeNull();
  });
});
