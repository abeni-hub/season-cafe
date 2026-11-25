import { resolveProductMedia } from '@/config/media';
import { BakeryImage } from './BakeryImage';
import { ProductArt } from './ProductArt';

interface ProductMediaProps {
  slug?: string;
  artIndex: number;
  name?: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}

/**
 * Renders the distinct artisan bakery photograph for each of the seven regular products,
 * falling back cleanly to the botanical ProductArt illustration if an image cannot load.
 */
export function ProductMedia({
  slug,
  artIndex,
  name,
  alt,
  sizes,
  priority = false,
  className,
  imgClassName,
}: ProductMediaProps) {
  const media = resolveProductMedia(slug, artIndex);
  const resolvedAlt = alt ?? (name ? `${name} — ${media.alt}` : media.alt);

  return (
    <BakeryImage
      src={media.src}
      srcSmall={media.srcSmall}
      width={media.width}
      height={media.height}
      alt={resolvedAlt}
      sizes={sizes}
      priority={priority}
      className={className}
      imgClassName={imgClassName}
      fallback={<ProductArt artIndex={artIndex} className="h-full w-full" />}
    />
  );
}
