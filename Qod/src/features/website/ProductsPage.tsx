import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Leaf } from 'lucide-react';
import { ProductMedia } from '@/components/shared/ProductMedia';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { HAS_REMOTE_API } from '@/config/brand';
import { resolveProductMedia } from '@/config/media';
import { useGsapScope } from '@/lib/gsap';
import { ctaTapProps, hoverLiftProps } from '@/lib/motion';
import { cn } from '@/utils/cn';

type AvailabilityFilter = 'all' | 'available';

export function ProductsPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const db = useDb();
  const [filter, setFilter] = useState<AvailabilityFilter>('all');

  const published = useMemo(
    () =>
      db.products
        .filter((product) => product.isPublished)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [db.products],
  );

  const visible = useMemo(
    () => (filter === 'available' ? published.filter((product) => product.isAvailable) : published),
    [published, filter],
  );

  useGsapScope(
    rootRef,
    ({ gsap, reduced }) => {
      if (reduced) return;
      gsap.from('[data-catalogue-head]', {
        y: 18,
        opacity: 0,
        duration: 0.65,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      gsap.from('[data-catalogue-card]', {
        y: 22,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    },
    [],
  );

  return (
    <div ref={rootRef} className="container-page py-14 lg:py-20">
      <div data-catalogue-head className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="eyebrow">The catalogue</p>
          <h1 className="mt-3 font-display text-4xl text-forest-deep sm:text-5xl">Seven signature bakes.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            The regular collection is fixed at seven products — the bakes the kitchen is built around.
            Custom cakes, bulk orders and corporate requests are quoted separately through the custom-order desk.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-line bg-cream p-1" role="group" aria-label="Filter catalogue">
          {(
            [
              { key: 'all', label: `All (${published.length})` },
              { key: 'available', label: 'Available today' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFilter(option.key)}
              className={cn(
                'rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors',
                filter === option.key ? 'bg-forest text-cream' : 'text-muted hover:text-ink',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product) => {
          const media = resolveProductMedia(product.slug, product.artIndex);
          return (
            <div key={product.id} data-catalogue-card className="h-full">
              <motion.div {...hoverLiftProps} className="h-full">
                <Link
                  to={`/products/${product.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-[0_10px_28px_-22px_rgba(41,61,34,0.3)] transition-shadow duration-300 hover:border-beige hover:shadow-soft"
                >
                  <div className="relative overflow-hidden">
                    <ProductMedia
                      slug={product.slug}
                      artIndex={product.artIndex}
                      name={product.name}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="aspect-[4/3] w-full"
                      imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                    />
                    <span className="absolute left-3.5 top-3.5 rounded-full border border-cream/30 bg-ink/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
                      {media.category}
                    </span>
                    {!product.isAvailable && (
                      <span className="absolute right-3.5 top-3.5 rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cream">
                        Currently unavailable
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display text-xl text-forest-deep">{product.name}</h2>
                      <p className="whitespace-nowrap pt-0.5 text-sm font-semibold text-clay tabular-nums">
                        <Money cents={product.priceCents} />
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{product.tagline}</p>
                    <p className="mt-1.5 text-[11px] text-ink-soft/70">{media.note}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-forest transition-colors group-hover:text-clay">
                      Read more
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-cream/85 px-6 py-5 text-xs leading-relaxed text-muted">
        <div className="flex max-w-2xl items-start gap-3">
          <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
          <p>
            {HAS_REMOTE_API
              ? 'Names, descriptions, prices and publication status are synced live with the bakery catalogue. Regular products are sold at the counter; custom and corporate orders follow a separate quotation workflow.'
              : 'Regular products are sold at the counter through the bakery point of sale. Custom cakes and organisational orders are handled through a separate written quotation workflow.'}
          </p>
        </div>
        <motion.div {...ctaTapProps}>
          <Link
            to="/custom-orders"
            className="inline-flex items-center gap-2 rounded-xl border border-forest/25 bg-paper px-4 py-2 text-xs font-semibold text-forest transition-colors hover:bg-forest-wash"
          >
            Commission custom cake <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
