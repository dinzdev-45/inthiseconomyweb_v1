import { describe, expect, it } from 'vitest';

import { formatReleaseDate } from './format-release-date.ts';

describe('formatReleaseDate', () => {
  it('formats in the store time zone (Jakarta) by default', () => {
    // 20:00 UTC on 19 Nov is already 20 Nov in Jakarta (UTC+7).
    expect(formatReleaseDate('2026-11-19T20:00:00.000Z')).toBe('20 November 2026');
    expect(formatReleaseDate('2026-11-19T20:00:00.000Z', 'UTC')).toBe('19 November 2026');
  });
});
