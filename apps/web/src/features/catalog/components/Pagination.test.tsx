import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_STATE } from '../url-state.ts';
import { Pagination, pageWindow } from './Pagination.tsx';

describe('pageWindow', () => {
  it.each([
    [1, 1, [1]],
    [1, 2, [1, 2]],
    [1, 10, [1, 2, 3, null, 10]],
    [5, 10, [1, 2, 3, 4, 5, 6, 7, null, 10]],
    [10, 10, [1, null, 8, 9, 10]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
  ])('page %i of %i → %j', (current, total, expected) => {
    expect(pageWindow(current, total)).toEqual(expected);
  });
});

describe('Pagination', () => {
  const state = { ...DEFAULT_STATE, category: 'tops', sort: 'price-asc' as const, page: 2 };

  it('links pages with filters and sort kept, marking the current page', () => {
    render(<Pagination path="/shop" state={state} totalPages={3} />);
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
      '/shop?category=tops&sort=price-asc',
    );
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(
      '/shop?category=tops&sort=price-asc&page=3',
    );
    expect(screen.getByRole('link', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Page 1' }).hasAttribute('aria-current')).toBe(false);
  });

  it('omits Previous on the first page and Next on the last', () => {
    const { rerender } = render(
      <Pagination path="/search" state={{ ...state, page: 1 }} totalPages={2} />,
    );
    expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
    rerender(<Pagination path="/search" state={state} totalPages={2} />);
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
  });

  it('renders nothing for a single page or a page beyond the last', () => {
    const one = render(<Pagination path="/shop" state={state} totalPages={1} />);
    expect(one.container.innerHTML).toBe('');
    const beyond = render(<Pagination path="/shop" state={{ ...state, page: 9 }} totalPages={2} />);
    expect(beyond.container.innerHTML).toBe('');
  });
});
