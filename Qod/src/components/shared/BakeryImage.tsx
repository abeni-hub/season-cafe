import { useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface BakeryImageProps {
  src: string;
  srcSmall?: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
}

/**
 * Responsive bakery photography wrapper with intrinsic sizing, soft paper placeholder,
 * optional eager loading for above-the-fold heroes, and graceful fallback on load errors.
 */
export function BakeryImage({
  src,
  srcSmall,
  alt,
  width,
  height,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
  className,
  imgClassName,
  fallback,
}: BakeryImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed && fallback) {
    return <div className={cn('relative overflow-hidden bg-paper-deep', className)}>{fallback}</div>;
  }

  const srcSet = srcSmall ? `${srcSmall} 560w, ${src} ${width ?? 1000}w` : undefined;

  return (
    <div className={cn('relative overflow-hidden bg-paper-deep', className)}>
      {!loaded && !failed && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-paper via-paper-deep to-beige/40 transition-opacity duration-300"
        />
      )}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-500 ease-out',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  );
}
