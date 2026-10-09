'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { countdownParts } from '../countdown-parts.ts';

const UNITS = [
  ['days', 'Days'],
  ['hours', 'Hours'],
  ['minutes', 'Min'],
  ['seconds', 'Sec'],
] as const;

/**
 * A live countdown to a release (storefront-drops spec, drops design D5). Rendered empty on the
 * server and filled after mount, so server and browser clocks never disagree during hydration;
 * the release time itself is shown next to it in a `<time>` for readers without JavaScript. It is
 * a labelled timer that does not announce each tick, and digits never animate. At zero it
 * refreshes the page once, so the page shows the drop as live.
 */
export function Countdown({
  releaseAt,
  tone = 'light',
}: {
  releaseAt: string;
  tone?: 'light' | 'dark';
}) {
  const router = useRouter();
  const target = Date.parse(releaseAt);
  const [remaining, setRemaining] = useState<number | null>(null);
  const refreshed = useRef(false);

  useEffect(() => {
    const tick = () => {
      const left = target - Date.now();
      setRemaining(left);
      if (left <= 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, router]);

  const parts = remaining === null ? null : countdownParts(remaining);
  const muted = tone === 'dark' ? 'text-sand' : 'text-stone';
  return (
    <div role="timer" aria-live="off" aria-label="Time until release" data-countdown>
      <p className={`text-label uppercase ${muted}`}>Releases in</p>
      <dl className="mt-2 flex gap-4 tabular-nums">
        {UNITS.map(([key, label]) => (
          // Label first in the DOM (valid term/definition order), number shown on top.
          <div key={key} className="flex min-w-12 flex-col-reverse">
            <dt className={`text-label uppercase ${muted}`}>{label}</dt>
            <dd className="text-2xl font-black" data-unit={key}>
              {parts ? String(parts[key]).padStart(2, '0') : '--'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
