import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HOME_CONTENT } from '../content.ts';
import { HomeSections } from './HomeSections.tsx';

/** The heading text labelling each top-level homepage section, in document order. */
function sectionLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll(':scope > div > section')].map((section) => {
    const id = section.getAttribute('aria-labelledby')!;
    return container.querySelector(`#${CSS.escape(id)}`)!.textContent!.trim();
  });
}

const ALL = [
  'IN THIS ECONOMY',
  'COLLECTION 001 COST OF LIVING',
  'Featured',
  'PRICED IN',
  'Shop the look',
  'New arrivals',
  'Lookbook',
  'OUR ECONOMY.',
  'Newsletter',
];

describe('storefront-homepage: Drop feature', () => {
  it('No drop to feature', () => {
    const { container } = render(<HomeSections content={{ ...HOME_CONTENT, drop: null }} />);
    expect(container.querySelector('[data-drop-status]')).toBeNull();
    expect(sectionLabels(container)).toEqual(
      ALL.filter((label) => !label.startsWith('COLLECTION')),
    );
  });
});

describe('HomeSections', () => {
  it('renders every section in spec order from the content', () => {
    const { container } = render(<HomeSections content={HOME_CONTENT} />);
    expect(sectionLabels(container)).toEqual(ALL);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});
