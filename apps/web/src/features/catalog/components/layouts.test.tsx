import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HOME_CONTENT } from '../../home/content.ts';
import { ProductGrid } from './ProductGrid.tsx';
import { ProductRail } from './ProductRail.tsx';

describe('product layouts', () => {
  it('ProductGrid lists every product: two columns, four from 1024 px', () => {
    const { container } = render(<ProductGrid products={HOME_CONTENT.featured.products} />);
    const list = container.querySelector('ul')!;
    expect(list.querySelectorAll(':scope > li')).toHaveLength(4);
    expect(list.className).toMatch(/\bgrid-cols-2\b/);
    expect(list.className).toMatch(/\blg:grid-cols-4\b/);
  });

  it('ProductRail scrolls inside its own box below 1024 px and becomes a grid above', () => {
    const { container } = render(<ProductRail products={HOME_CONTENT.newArrivals.products} />);
    const list = container.querySelector('ul')!;
    expect(list.querySelectorAll(':scope > li')).toHaveLength(5);
    expect(list.className).toMatch(/\boverflow-x-auto\b/);
    expect(list.className).toMatch(/\bsnap-x\b/);
    expect(list.className).toMatch(/\blg:grid\b/);
  });
});
