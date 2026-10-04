import { describe, expect, it } from 'vitest';

import { describeDelta, parseStockDelta } from './stock-delta.ts';

describe('parseStockDelta', () => {
  it.each([
    ['5', 5],
    ['+5', 5],
    ['-3', -3],
    [' 12 ', 12],
    ['007', 7],
  ])('reads %j as %i', (input, delta) => {
    expect(parseStockDelta(input)).toEqual({ ok: true, delta });
  });

  it.each([
    '',
    '  ',
    '0',
    '+0',
    '-0',
    '1.5',
    'abc',
    '5 units',
    '--3',
    '1e3',
    '99999999999999999999',
  ])('refuses %j before any request', (input) => {
    const result = parseStockDelta(input);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).not.toBe('');
  });

  it('leaves the allowed range to the API', () => {
    expect(parseStockDelta('100001')).toEqual({ ok: true, delta: 100_001 });
  });
});

describe('describeDelta', () => {
  it('says what the adjustment will do', () => {
    expect(describeDelta(5)).toBe('Adds 5 units');
    expect(describeDelta(1)).toBe('Adds 1 unit');
    expect(describeDelta(-3)).toBe('Removes 3 units');
  });
});
