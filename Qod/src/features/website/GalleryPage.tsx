import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import { BakeryImage } from '@/components/shared/BakeryImage';
import { useDb } from '@/hooks/useStore';
import { GALLERY_MEDIA, type GalleryCategory, type GalleryItem } from '@/config/media';
import { useGsapScope } from '@/lib/gsap';
import { EDITORIAL_EASE, fadeInVariants, modalPanelVariants } from '@/lib/motion';
import { cn } from '@/utils/cn';

const categories: Array<{ key: GalleryCategory; label: string }> = [
  { key: 'all', label: 'All stories' },
  { key: 'counter', label: 'Counter bakes' },
  { key: 'craft', label: 'Craft & café' },
  { key: 'celebration', label: 'Celebrations & boxes' },
];

export function GalleryPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const db = useDb();
  const captions = db.siteContent.galleryCaptions;
  const [category, setCategory] = useState<GalleryCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const items = useMemo<Array<GalleryItem & { caption: string }>>(
    () =>
      GALLERY_MEDIA.map((item, idx) => {
        const cmsCaption = captions[idx];
        const cleanCaption =
          cmsCaption && !cmsCaption.toLowerCase().includes('demo caption')
            ? cmsCaption
            : item.fallbackCaption;
        return { ...item, caption: cleanCaption };
      }),
    [captions],
  );

  const visible = useMemo(
    () => (category === 'all' ? items : items.filter((item) => item.category === category)),
    [items, category],
  );

  useGsapScope(
    rootRef,
    ({ gsap, reduced }) => {
      if (reduced) return;
      gsap.from('[data-gallery-head]', {
        y: 18,
        opacity: 0,
        duration: 0.65,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    },
    [],
  );

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIndex(null);
      if (event.key === 'ArrowRight') {
        setSelectedIndex((current) => (current === null ? null : (current + 1) % visible.length));
      }
      if (event.key === 'ArrowLeft') {
        setSelectedIndex((current) =>
          current === null ? null : (current - 1 + visible.length) % visible.length,
        );
      }
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [selectedIndex, visible.length]);

  const activeItem = selectedIndex !== null ? visible[selectedIndex] : null;

  return (
    <div ref={rootRef} className="container-page py-14 lg:py-20">
      <div data-gallery-head className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="eyebrow">Gallery</p>
          <h1 className="mt-3 font-display text-4xl text-forest-deep sm:text-5xl">
            From the counter and the kitchen.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Daily small-batch custards, laminated pastry, café counter service, and bespoke botanical cakes
            crafted by Seasons Cake.
          </p>
        </div>
        <Link to="/custom-orders" className="link-underline">
          Commission a cake <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter gallery">
        {categories.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setCategory(entry.key);
              setSelectedIndex(null);
            }}
            className={cn(
              'rounded-full border px-4 py-2 text-xs font-semibold transition-colors',
              category === entry.key
                ? 'border-forest bg-forest text-cream'
                : 'border-line bg-cream text-muted hover:border-forest/30 hover:text-forest',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((tile, index) => {
          const isLead = category === 'all' && index === 0;
          return (
            <motion.figure
              key={tile.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.25), ease: EDITORIAL_EASE }}
              className={cn(
                'group overflow-hidden rounded-2xl border border-line bg-cream shadow-[0_8px_24px_-20px_rgba(41,61,34,0.3)] transition-shadow hover:shadow-soft',
                isLead && 'rounded-3xl sm:col-span-2 lg:col-span-2',
              )}
            >
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`Open ${tile.label} in gallery view`}
                className="relative block w-full overflow-hidden text-left"
              >
                <BakeryImage
                  src={tile.asset.src}
                  srcSmall={tile.asset.srcSmall}
                  width={tile.asset.width}
                  height={tile.asset.height}
                  alt={tile.asset.alt}
                  sizes={isLead ? '(max-width: 1024px) 100vw, 66vw' : '(max-width: 640px) 100vw, 33vw'}
                  priority={index === 0}
                  className={isLead ? 'aspect-[16/9] w-full' : 'aspect-[4/3] w-full'}
                  imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                <span className="absolute right-3.5 top-3.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-cream/30 bg-ink/55 text-cream opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <Expand className="h-3.5 w-3.5" />
                </span>
              </button>
              <figcaption className="flex items-baseline justify-between gap-3 px-4 py-3 text-xs">
                <div>
                  <p className="font-semibold text-forest-deep">{tile.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{tile.caption}</p>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-clay">
                  {tile.category}
                </span>
              </figcaption>
            </motion.figure>
          );
        })}
      </div>

      <AnimatePresence>
        {activeItem && selectedIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <motion.button
              type="button"
              aria-label="Close lightbox"
              onClick={() => setSelectedIndex(null)}
              variants={fadeInVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={activeItem.label}
              variants={modalPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl border border-line/40 bg-cream shadow-lift"
            >
              <div className="relative bg-ink">
                <img
                  src={activeItem.asset.src}
                  alt={activeItem.asset.alt}
                  className="max-h-[72vh] w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setSelectedIndex(null)}
                  aria-label="Close"
                  className="absolute right-4 top-4 rounded-full bg-ink/70 p-2 text-cream transition-colors hover:bg-ink"
                >
                  <X className="h-4 w-4" />
                </button>
                {visible.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIndex((selectedIndex - 1 + visible.length) % visible.length)
                      }
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/65 p-2.5 text-cream transition-colors hover:bg-ink"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIndex((selectedIndex + 1) % visible.length)}
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink/65 p-2.5 text-cream transition-colors hover:bg-ink"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="font-display text-xl text-forest-deep">{activeItem.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{activeItem.caption}</p>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted tabular-nums">
                  {selectedIndex + 1} / {visible.length}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
