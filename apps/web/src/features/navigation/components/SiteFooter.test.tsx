import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteFooter } from './SiteFooter.tsx';

describe('SiteFooter', () => {
  it('groups links under headings and opens social links safely in a new tab', () => {
    render(<SiteFooter />);
    const nav = screen.getByRole('navigation', { name: 'Footer' });
    for (const heading of ['Shop', 'Help', 'Company', 'Follow']) {
      expect(within(nav).getByRole('heading', { name: heading })).toBeDefined();
    }
    for (const name of ['Instagram', 'TikTok']) {
      const link = within(nav).getByRole('link', { name: new RegExp(`^${name}`) });
      expect(link.textContent).toContain('(opens in a new tab)');
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('renders the newsletter slot only when given', () => {
    const { container, rerender } = render(<SiteFooter />);
    expect(container.querySelector('form')).toBeNull();
    rerender(<SiteFooter newsletter={<form aria-label="Newsletter" />} />);
    expect(screen.getByRole('form', { name: 'Newsletter' })).toBeDefined();
  });
});
