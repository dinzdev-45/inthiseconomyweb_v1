import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Wordmark } from './Wordmark.tsx';

describe('Wordmark', () => {
  it('reads as the brand name and is uppercased visually only', () => {
    const { container } = render(<Wordmark />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.textContent).toBe('InThisEconomy');
    expect(mark.className).toContain('uppercase');
  });
});
