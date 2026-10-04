import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MediaFrame } from './MediaFrame.tsx';

const IMAGE = {
  src: '/campaign/look-01.jpg',
  alt: 'Model in a black coach jacket',
  width: 1600,
  height: 2000,
};

describe('MediaFrame', () => {
  it('renders a decorative, captioned placeholder hidden from assistive technology', () => {
    const { container } = render(
      <MediaFrame image={null} ratio={4 / 5} sizes="50vw" placeholderLabel="LOOK 01" />,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.dataset.media).toBe('placeholder');
    expect(frame.textContent).toBe('LOOK 01');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the real image with its alt text and responsive sizes, lazily by default', () => {
    const { container, getByAltText } = render(
      <MediaFrame image={IMAGE} ratio={4 / 5} sizes="(min-width: 1024px) 25vw, 50vw" />,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.getAttribute('aria-hidden')).toBeNull();
    const img = getByAltText(IMAGE.alt);
    expect(img.getAttribute('sizes')).toBe('(min-width: 1024px) 25vw, 50vw');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('loads the priority (hero) image eagerly with high fetch priority', () => {
    const { getByAltText } = render(
      <MediaFrame image={IMAGE} ratio={16 / 9} sizes="100vw" priority />,
    );
    const img = getByAltText(IMAGE.alt);
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it.each([
    ['placeholder', null],
    ['image', IMAGE],
  ])('reserves its aspect ratio before anything loads (%s)', (_label, image) => {
    const { container } = render(<MediaFrame image={image} ratio={4 / 5} sizes="50vw" />);
    const frame = container.firstElementChild as HTMLElement;
    // Set inline at render time, so the box has its final shape before any image request completes.
    // jsdom normalizes `0.8` to `0.8 / 1`; both mean width / height = 4 / 5.
    expect(frame.style.aspectRatio).toMatch(/^0\.8( \/ 1)?$/);
  });
});

describe('MediaFrame without a ratio', () => {
  it('lets the parent or className size the frame', () => {
    const { container } = render(
      <MediaFrame image={null} sizes="100vw" className="aspect-[4/5] md:aspect-[21/9]" />,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.style.aspectRatio).toBe('');
    expect(frame.className).toContain('aspect-[4/5]');
  });
});
