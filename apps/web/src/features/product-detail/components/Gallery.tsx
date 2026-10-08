import { FallbackImage } from '@/components/FallbackImage';

import type { GalleryImage } from '../types.ts';

const SIZES = '(min-width: 1024px) 30vw, 85vw';

/**
 * The product gallery (design D6): 4:5 frames that reserve their space. Below 1024 px a
 * horizontally scrolling, snap-aligned list inside its own box; from 1024 px a two-column grid
 * with the first image spanning both. The first image loads first; the rest lazily. Without
 * images, one placeholder frame.
 */
export function Gallery({ images }: { images: readonly GalleryImage[] }) {
  return (
    <section aria-label="Product images" className="min-w-0">
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:px-0">
        {images.length === 0 ? (
          <li className="w-[85%] shrink-0 snap-start lg:col-span-2 lg:w-auto" data-gallery-item>
            <FallbackImage image={null} ratio={4 / 5} sizes={SIZES} />
          </li>
        ) : (
          images.map((image, index) => (
            <li
              key={image.src}
              className={`w-[85%] shrink-0 snap-start lg:w-auto ${index === 0 ? 'lg:col-span-2' : ''}`}
              data-gallery-item
              data-color={image.color ?? ''}
            >
              <FallbackImage image={image} ratio={4 / 5} sizes={SIZES} priority={index === 0} />
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
