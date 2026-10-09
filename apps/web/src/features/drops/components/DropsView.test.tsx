import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DropsView } from './DropsView.tsx';

describe('storefront-drops: Drops page', () => {
  it('No drops yet on the drops page', () => {
    const { container } = render(
      <DropsView overview={{ upcoming: [], current: null, archive: [] }} />,
    );
    expect(container.textContent).toContain('The first drop is coming');
    expect(screen.getByRole('link', { name: 'Browse the shop' }).getAttribute('href')).toBe(
      '/shop',
    );
    expect(screen.queryByRole('link', { name: 'Drop archive' })).toBeNull();
    expect(screen.queryByRole('timer')).toBeNull();
  });
});
