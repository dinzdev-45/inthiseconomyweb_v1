import Image from 'next/image';

import type { Media } from '@/features/catalog/types';

type MediaFrameProps = {
  /** Real image, or null to show the decorative placeholder. */
  image: Media | null;
  /**
   * Width / height, e.g. 4 / 5 or 16 / 9, reserved before anything loads (no layout shift).
   * Omit it only when the parent sizes the frame (e.g. a min-height hero, or responsive
   * `aspect-*` classes passed in `className`).
   */
  ratio?: number;
  /** next/image `sizes` for the frame's rendered width at each breakpoint. */
  sizes: string;
  /** Caption shown on the placeholder only. */
  placeholderLabel?: string;
  /** Load eagerly with high fetch priority (the hero/LCP image only). */
  priority?: boolean;
  className?: string;
};

/**
 * A fixed-aspect media box (storefront-homepage design D3/D7). Server
 * Component with no client JavaScript. With an image it renders next/image
 * (`fill`, lazy by default); without one it renders a sand-toned, grain-textured
 * placeholder that is hidden from assistive technology, so surrounding text
 * carries the meaning.
 */
export function MediaFrame({
  image,
  ratio,
  sizes,
  placeholderLabel,
  priority = false,
  className = '',
}: MediaFrameProps) {
  const frame = `relative w-full overflow-hidden bg-sand ${className}`.trim();
  const style = ratio === undefined ? undefined : { aspectRatio: ratio };

  if (!image) {
    return (
      <div aria-hidden="true" data-media="placeholder" className={frame} style={style}>
        <div className="media-grain absolute inset-0" />
        {placeholderLabel ? (
          <span className="absolute bottom-3 left-3 text-label text-ink/70 uppercase">
            {placeholderLabel}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div data-media="image" className={frame} style={style}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        sizes={sizes}
        // Next 16 deprecates `priority`; eager loading + high fetch priority is the recommended form.
        {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
        className="object-cover"
      />
    </div>
  );
}
