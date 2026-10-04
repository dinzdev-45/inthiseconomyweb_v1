import { describe, expect, it } from 'vitest';

import { changedFields, numberValue, textValue } from './form.ts';
import { formatTimestamp } from './time.ts';

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe('form helpers', () => {
  it('reads trimmed text', () => {
    expect(textValue(form({ name: '  Outerwear ' }), 'name')).toBe('Outerwear');
    expect(textValue(form({}), 'name')).toBe('');
  });

  it('reads numbers, leaving non-numeric text for the API to reject', () => {
    expect(numberValue(form({ sortOrder: '20' }), 'sortOrder')).toBe(20);
    expect(numberValue(form({ sortOrder: '1.5' }), 'sortOrder')).toBe(1.5);
    expect(numberValue(form({ sortOrder: 'ten' }), 'sortOrder')).toBe('ten');
    expect(numberValue(form({ sortOrder: '  ' }), 'sortOrder')).toBeUndefined();
  });

  it('keeps only changed fields for a partial update', () => {
    const initial = { name: 'Tees', slug: 'tees', hex: '#111111' as string | null };
    expect(changedFields(initial, { name: 'Tees', slug: 't-shirts' })).toEqual({
      slug: 't-shirts',
    });
    expect(changedFields(initial, { hex: null })).toEqual({ hex: null });
    expect(changedFields(initial, { name: 'Tees', slug: undefined })).toEqual({});
  });
});

describe('formatTimestamp', () => {
  it('formats in UTC regardless of the machine time zone', () => {
    expect(formatTimestamp('2026-10-04T09:15:30.000Z')).toBe('4 Oct 2026, 09:15:30 UTC');
  });
});
