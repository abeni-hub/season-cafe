import { Link } from 'react-router-dom';
import { ArrowRight, Leaf } from 'lucide-react';
import { ProductArt } from '@/components/shared/ProductArt';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { HAS_REMOTE_API } from '@/config/brand';

export function ProductsPage() {
  const db = useDb();
  const published = db.products.filter((product) => product.isPublished);

  return (
    <div className="container-page py-14 lg:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">The catalogue</p>
        <h1 className="mt-3 font-display text-4xl text-forest-deep sm:text-5xl">Seven signature bakes.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          The regular collection is fixed at seven products — the bakes the kitchen is built around.
          Custom cakes, bulk orders and corporate requests are quoted through the custom-order process.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {published.map((product) => (
          <Link
            key={product.id}
            to={`/products/${product.slug}`}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-cream transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="relative">
              <ProductArt artIndex={product.artIndex} className="aspect-[4/3] w-full" />
              {!product.isAvailable && (
                <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cream">
                  Currently unavailable
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl text-forest-deep">{product.name}</h2>
                <p className="whitespace-nowrap text-sm font-semibold text-clay">
                  <Money cents={product.priceCents} />
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{product.tagline}</p>
              <span className="mt-auto pt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-forest">
                Read more <ArrowRight className="inline h-3 w-3" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-cream/70 px-5 py-4 text-xs leading-relaxed text-muted">
        <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
        <p>
          {HAS_REMOTE_API
            ? 'Product artwork is illustration until final photography is uploaded. Names, descriptions, prices and availability are published by the bakery through the live catalogue in the BMS. Regular products are sold at the counter; custom and corporate orders use a separate quotation workflow.'
            : 'Catalogue preview: product artwork, descriptions and prices are demo placeholders. The bakery manages the live catalogue and publication status from the BMS. Regular products are sold at the counter; custom and corporate orders use a separate quotation workflow.'}
        </p>
      </div>
    </div>
  );
}
