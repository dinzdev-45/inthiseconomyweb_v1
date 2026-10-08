import { describe, expect, it } from 'vitest';

import { DESCRIPTION_MAX, productMetadata, shorten } from './seo.ts';

describe('product metadata', () => {
  it('is indexable, titled by the name, with a canonical URL without selection', () => {
    const meta = productMetadata({
      slug: 'overdraft-hoodie',
      name: 'Overdraft Hoodie',
      description: 'Heavyweight fleece hoodie.',
    });
    expect(meta).toEqual({
      title: 'Overdraft Hoodie',
      description: 'Heavyweight fleece hoodie.',
      alternates: { canonical: '/products/overdraft-hoodie' },
    });
    expect(meta.robots).toBeUndefined();
  });

  it('falls back to a generic description', () => {
    for (const description of [null, '   ']) {
      expect(productMetadata({ slug: 'cap', name: 'Allowance Cap', description }).description).toBe(
        'Allowance Cap from InThisEconomy.',
      );
    }
  });

  it('shortens long descriptions at a word boundary to at most 160 characters', () => {
    const long = `${'Heavyweight brushed fleece, '.repeat(10)}end.`;
    const short = shorten(long);
    expect(short.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(short.endsWith('…')).toBe(true);
    expect(long.startsWith(short.slice(0, -1))).toBe(true);
    expect(short).not.toMatch(/[ ,]…$/);
    expect(shorten('Line one.\n\n  Line   two.')).toBe('Line one. Line two.');
    expect(shorten('x'.repeat(200))).toHaveLength(DESCRIPTION_MAX);
  });
});
