import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Leaf, MapPin } from 'lucide-react';
import { ProductMedia } from '@/components/shared/ProductMedia';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { HAS_REMOTE_API } from '@/config/brand';
import { resolveProductMedia } from '@/config/media';
import { EDITORIAL_EASE, ctaTapProps, hoverLiftProps } from '@/lib/motion';
import { NotFoundPage } from './NotFoundPage';

export function ProductDetailPage() {
  const { slug } = useParams();
  const db = useDb();
  const product = db.products.find((entry) => entry.slug === slug);
  if (!product || !product.isPublished) return <NotFoundPage />;

  const media = resolveProductMedia(product.slug, product.artIndex);
  const others = db.products
    .filter((entry) => entry.isPublished && entry.id !== product.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 3);

  return (
    <div className="container-page py-12 lg:py-16">
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted transition-colors hover:text-forest"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All products
      </Link>

      <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
        >
          <div className="overflow-hidden rounded-3xl border border-line bg-cream shadow-soft">
            <ProductMedia
              slug={product.slug}
              artIndex={product.artIndex}
              name={product.name}
              sizes="(max-width: 1024px) 100vw, 55vw"
              priority
              className="aspect-[4/3] w-full"
            />
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <Leaf className="h-3.5 w-3.5 text-forest" />
            <span>
              {media.category} · {media.note}
            </span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: EDITORIAL_EASE }}
          className="max-w-lg"
        >
          <p className="eyebrow">Regular catalogue</p>
          <h1 className="mt-3 font-display text-4xl text-forest-deep sm:text-5xl">{product.name}</h1>
          <p className="mt-2 font-script text-2xl italic text-clay">{product.tagline}</p>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft/90">{product.description}</p>

          <div className="mt-6 flex items-baseline gap-3 border-y border-line py-4">
            <p className="font-display text-3xl text-forest-deep tabular-nums">
              <Money cents={product.priceCents} />
            </p>
            <p className="text-xs text-muted">{HAS_REMOTE_API ? 'Published counter price' : 'Counter catalogue price'}</p>
          </div>

          <div className="mt-5 space-y-2.5 text-sm text-ink-soft">
            <p className="flex items-center gap-2.5">
              <span
                className={
                  product.isAvailable ? 'h-2 w-2 rounded-full bg-forest' : 'h-2 w-2 rounded-full bg-clay'
                }
              />
              {product.isAvailable ? 'Baked for the counter and collection' : 'Temporarily unavailable'}
            </p>
            <p className="flex items-center gap-2.5 text-muted">
              <MapPin className="h-4 w-4 shrink-0 text-clay" />
              Available at {db.settings.locations.map((loc) => loc.name).join(' and ')}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <motion.div {...ctaTapProps}>
              <Link
                to="/custom-orders"
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-forest-deep"
              >
                Enquire about a bulk or custom order <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div {...ctaTapProps}>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-forest/25 bg-cream px-5 py-3 text-sm font-semibold text-forest transition-colors hover:bg-forest-wash"
              >
                Ask the bakery
              </Link>
            </motion.div>
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-muted">
            Regular products are sold in store through the bakery&apos;s point of sale. Availability shown here is
            the catalogue publication status, not live counter stock.
          </p>
        </motion.div>
      </div>

      <div className="mt-20">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest-deep">More from the counter</h2>
          <Link to="/products" className="link-underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {others.map((entry) => (
            <motion.div key={entry.id} {...hoverLiftProps}>
              <Link
                to={`/products/${entry.slug}`}
                className="group block overflow-hidden rounded-2xl border border-line bg-cream transition-shadow hover:shadow-soft"
              >
                <ProductMedia
                  slug={entry.slug}
                  artIndex={entry.artIndex}
                  name={entry.name}
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="aspect-[4/3] w-full"
                  imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="flex items-center justify-between gap-2 p-4">
                  <p className="font-display text-base text-forest-deep">{entry.name}</p>
                  <p className="text-xs font-semibold text-clay tabular-nums">
                    <Money cents={entry.priceCents} />
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
