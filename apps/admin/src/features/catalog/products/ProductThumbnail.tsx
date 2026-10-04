'use client';

import type { ProductListItem } from '@ite/contracts';
import { useEffect, useRef, useState } from 'react';

/**
 * A 48 px preview of the primary image, or a "No image" placeholder when the product has none
 * or the preview fails to load (URLs are entered by staff; files are not stored by the admin).
 */
export function ProductThumbnail({ image }: { image: ProductListItem['primaryImage'] }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A server-rendered image can fail before React attaches onError; check once mounted.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, [image?.url]);

  if (!image || failed) {
    return (
      <span
        data-testid="thumbnail-placeholder"
        className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-line bg-paper text-center text-[10px] leading-tight text-muted"
      >
        No image
      </span>
    );
  }
  return (
    // A plain <img>: next/image remote patterns are deferred (design D8).
    <img
      ref={imgRef}
      src={image.url}
      alt={image.alt}
      width={48}
      height={48}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-12 w-12 rounded border border-line bg-paper object-cover"
    />
  );
}
