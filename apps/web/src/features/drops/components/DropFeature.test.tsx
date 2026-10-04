import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DropSummary } from '../types.ts';
import { DropFeature } from './DropFeature.tsx';

const LIVE: DropSummary = {
  slug: 'collection-001-cost-of-living',
  collection: 'COLLECTION 001',
  title: 'COST OF LIVING',
  status: 'live',
  startsAt: '2026-10-01T03:00:00.000Z',
  image: null,
};
const UPCOMING: DropSummary = { ...LIVE, status: 'upcoming', startsAt: '2026-11-20T03:00:00.000Z' };

describe('storefront-homepage: Drop feature', () => {
  it('Live drop', () => {
    render(<DropFeature drop={LIVE} />);
    const section = screen.getByRole('region', { name: /COLLECTION 001\s*COST OF LIVING/ });
    expect(section.textContent).toContain('Now live');
    const link = screen.getByRole('link', { name: 'EXPLORE THE COLLECTION' });
    expect(link.getAttribute('href')).toBe('/drops/collection-001-cost-of-living');
    expect(screen.queryByRole('timer')).toBeNull();
  });

  it('Upcoming drop', () => {
    const { container } = render(<DropFeature drop={UPCOMING} />);
    expect(container.textContent).toContain('Upcoming');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(
      /COLLECTION 001\s*COST OF LIVING/,
    );
    const time = container.querySelector('time')!;
    expect(time.getAttribute('dateTime')).toBe('2026-11-20T03:00:00.000Z');
    expect(time.textContent).toBe('20 November 2026');
    const countdown = screen.getByRole('timer', { name: 'Countdown to release' });
    expect(countdown.textContent).toBe('');
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('DropFeature', () => {
  it('renders nothing when there is no drop', () => {
    const { container } = render(<DropFeature drop={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('uses a captioned placeholder until drop photography exists', () => {
    const { container } = render(<DropFeature drop={LIVE} />);
    const frame = container.querySelector('[data-media="placeholder"]')!;
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.textContent).toBe('COLLECTION 001 — COST OF LIVING');
  });
});
