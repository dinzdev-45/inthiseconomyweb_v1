import { describe, expect, it } from 'vitest';

import { sizeGuideFor, sizingSystem } from './size-guide.ts';

describe('sizingSystem', () => {
  it.each([
    [['S', 'M', 'L', 'XL'], 'letters'],
    [['XS', 'XXL'], 'letters'],
    [['28', '30', '32', '34'], 'waist'],
    [['OS'], 'one-size'],
    [['M', '30'], null], // mixed
    [['EU-42'], null], // unknown
    [['M', 'OS'], null],
    [[], null],
  ])('%j → %s', (codes, system) => {
    expect(sizingSystem(codes)).toBe(system);
  });
});

describe('sizeGuideFor', () => {
  it('lists only the product sizes, in its order, with units in every column', () => {
    const guide = sizeGuideFor(['S', 'M', 'L'])!;
    expect(guide.system).toBe('letters');
    expect(guide.rows.map((row) => row.size)).toEqual(['S', 'M', 'L']);
    expect(guide.columns).toEqual(['Chest (cm)', 'Length (cm)', 'Sleeve (cm)']);
    for (const row of guide.rows) expect(row.values).toHaveLength(3);
    expect(guide.caption).toBeTruthy();
  });

  it('uses waist, inseam, and leg opening for waist sizes', () => {
    const guide = sizeGuideFor(['28', '30', '32', '34'])!;
    expect(guide.columns).toEqual(['Waist (cm)', 'Inseam (cm)', 'Leg opening (cm)']);
    expect(guide.rows).toHaveLength(4);
  });

  it('notes that a one-size item is one size, with its measurement', () => {
    const guide = sizeGuideFor(['OS'])!;
    expect(guide.note).toBe('This item is one size.');
    expect(guide.rows).toEqual([{ size: 'OS', values: ['56–60, adjustable'] }]);
    expect(guide.columns[0]).toMatch(/\(cm\)$/);
  });

  it('gives no guide for a mixed or unknown size set', () => {
    expect(sizeGuideFor(['M', '30'])).toBeNull();
    expect(sizeGuideFor(['EU-42'])).toBeNull();
  });
});
