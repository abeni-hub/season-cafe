import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-react';
import { ProductArt } from '@/components/shared/ProductArt';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { NotFoundPage } from './NotFoundPage';

export function ProductDetailPage() {
  const { slug } = useParams();
  const db = useDb();
  const product = db.products.find((entry) => entry.slug === slug);
  if (!product || !product.isPublished) return <NotFoundPage />;

  const others = db.products.filter((entry) => entry.isPublished && entry.id !== product.id).slice(0, 3);

  return (
    <div className="container-page py-12 lg:py-16">
      <Link to="/products" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted hover:text-forest">
        <ArrowLeft className="h-3.5 w-3.5" /> All products
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="overflow-hidden rounded-3xl border border-line bg-cream">
            <ProductArt artIndex={product.artIndex} className="aspect-[4/3] w-full" />
          </div>
          <p className="mt-2 text-[11px] text-muted">Illustrative demo artwork — final product photography pending.</p>
        </div>
        <div className="max-w-lg">
          <p className="eyebrow">Regular catalogue</p>
          <h1 className="mt-3 font-display text-4xl text-forest-deep">{product.name}</h1>
          <p className="mt-2 font-script text-xl text-clay">{product.tagline}</p>
          <p className="mt-5 text-sm leading-relaxed text-ink-soft/90">{product.description}</p>

          <div className="mt-6 flex items-baseline gap-3 border-y border-line py-4">
            <p className="font-display text-2xl text-forest-deep">
              <Money cents={product.priceCents} />
            </p>
            <p className="text-xs text-muted">Demo catalogue price</p>
          </div>

          <div className="mt-5 space-y-2.5 text-sm text-ink-soft">
            <p className="flex items-center gap-2">
              <span
                className={
                  product.isAvailable
                    ? 'h-2 w-2 rounded-full bg-forest'
                    : 'h-2 w-2 rounded-full bg-clay'
                }
              />
              {product.isAvailable ? 'Baked for the counter and collection' : 'Temporarily unavailable'}
            </p>
            <p className="flex items-center gap-2 text-muted">
              <MapPin className="h-4 w-4" />
              Available at {db.settings.locations.map((loc) => loc.name).join(' and ')}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <Link
              to="/custom-orders"
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-deep"
            >
              Enquire about a custom order <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-forest/25 px-5 py-2.5 text-sm font-semibold text-forest hover:bg-forest-wash"
            >
              Ask the bakery
            </Link>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Regular products are sold in store through the bakery&apos;s point of sale. Availability shown here is
            the catalogue publication status, not live counter stock.
          </p>
        </div>
      </div>

      <div className="mt-16">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest-deep">More from the counter</h2>
          <Link to="/products" className="link-underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {others.map((entry) => (
            <Link
              key={entry.id}
              to={`/products/${entry.slug}`}
              className="group overflow-hidden rounded-2xl border border-line bg-cream transition-all hover:shadow-soft"
            >
              <ProductArt artIndex={entry.artIndex} className="aspect-[4/3] w-full" />
              <div className="flex items-center justify-between gap-2 p-4">
                <p className="font-display text-base text-forest-deep">{entry.name}</p>
                <p className="text-xs font-semibold text-clay">
                  <Money cents={entry.priceCents} />
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
