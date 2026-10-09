import { describe, expect, it } from 'vitest';

import { formatWib, fromWibInput, toWibInput } from './release-time.ts';

describe('drop release time in WIB', () => {
  it('converts a WIB date and time to UTC with a fixed +07:00 offset', () => {
    expect(fromWibInput('2099-01-01T10:00')).toBe('2099-01-01T03:00:00.000Z');
    // Crossing midnight: 05:30 WIB is 22:30 UTC the day before.
    expect(fromWibInput('2026-11-20T05:30')).toBe('2026-11-19T22:30:00.000Z');
  });

  it('shows a UTC instant as the WIB value the field expects, and back', () => {
    expect(toWibInput('2099-01-01T03:00:00.000Z')).toBe('2099-01-01T10:00');
    expect(toWibInput('2026-11-19T22:30:00.000Z')).toBe('2026-11-20T05:30');
    const iso = '2026-10-09T16:45:00.000Z';
    expect(fromWibInput(toWibInput(iso))).toBe(iso);
  });

  it('refuses values that are not a real date and time', () => {
    for (const value of [
      '',
      '2099-01-01',
      '2099-01-01 10:00',
      '2026-04-31T10:00',
      '2026-02-29T10:00',
      '2026-01-01T24:00',
      'soon',
    ]) {
      expect(fromWibInput(value), value).toBeNull();
    }
  });

  it('formats a release time in WIB for lists', () => {
    expect(formatWib('2099-01-01T03:00:00.000Z')).toBe('1 Jan 2099, 10:00 WIB');
  });
});
