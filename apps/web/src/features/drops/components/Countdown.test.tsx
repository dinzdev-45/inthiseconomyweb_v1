import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const { Countdown } = await import('./Countdown.tsx');
const { countdownParts } = await import('../countdown-parts.ts');

const NOW = Date.parse('2026-10-09T03:00:00.000Z');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  refresh.mockReset();
});

const unit = (name: string) => document.querySelector(`[data-unit="${name}"]`)!.textContent;

describe('countdownParts', () => {
  it('splits a duration into days, hours, minutes, and seconds, never negative', () => {
    expect(countdownParts((2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
    });
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('storefront-drops: Release countdown', () => {
  it('counts down each second, as a labelled timer that does not announce ticks', () => {
    render(<Countdown releaseAt={new Date(NOW + (2 * 86_400 + 3 * 3600) * 1000).toISOString()} />);
    const timer = screen.getByRole('timer', { name: 'Time until release' });
    expect(timer.getAttribute('aria-live')).toBe('off');
    expect([unit('days'), unit('hours'), unit('minutes'), unit('seconds')]).toEqual([
      '02',
      '03',
      '00',
      '00',
    ]);
    act(() => vi.advanceTimersByTime(1000));
    expect([unit('days'), unit('hours'), unit('minutes'), unit('seconds')]).toEqual([
      '02',
      '02',
      '59',
      '59',
    ]);
  });

  it('Countdown reaches zero', () => {
    render(<Countdown releaseAt={new Date(NOW + 2000).toISOString()} />);
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3000));
    expect(unit('seconds')).toBe('00');
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
