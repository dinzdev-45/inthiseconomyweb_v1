'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { MediaFrame } from '@/components/MediaFrame';

import type { Media } from '@/features/catalog/types';

type FallbackImageProps = {
  image: Media | null;
  ratio: number;
  sizes: string;
  /** Load immediately instead of lazily (the first row of a grid). */
  eager?: boolean;
  /** Load eagerly with high fetch priority (the page's main image). */
  priority?: boolean;
};

/**
 * A media frame that never shows a broken image (storefront-catalog design D6; shared by catalog
 * cards and the product gallery): without
 * an image, or once the image fails to load, it renders the decorative placeholder at the same
 * ratio. An image that already failed before hydration (no `error` event left to catch) is
 * detected on mount. Same markup as `MediaFrame` while the image is fine.
 */
export function FallbackImage({
  image,
  ratio,
  sizes,
  eager = false,
  priority = false,
}: FallbackImageProps) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (!image || failed) return <MediaFrame image={null} ratio={ratio} sizes={sizes} />;
  return (
    <div
      data-media="image"
      className="relative w-full overflow-hidden bg-sand"
      style={{ aspectRatio: ratio }}
    >
      <Image
        ref={ref}
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        onError={() => setFailed(true)}
        {...(priority
          ? { loading: 'eager' as const, fetchPriority: 'high' as const }
          : eager
            ? { loading: 'eager' as const }
            : {})}
        className="object-cover"
      />
    </div>
  );
}
