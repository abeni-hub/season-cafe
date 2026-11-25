import { Link } from 'react-router-dom';
import { HAS_REMOTE_API } from '@/config/brand';
import { ArrowRight, CalendarDays, Leaf, MapPin, Sprout } from 'lucide-react';
import { BotanicalSprig, ProductArt } from '@/components/shared/ProductArt';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';

export function ProductCard({ productId }: { productId: string }) {
  const db = useDb();
  const product = db.products.find((entry) => entry.id === productId);
  if (!product) return null;
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-cream transition-all hover:-translate-y-0.5 hover:shadow-soft"
    >
      <ProductArt
        artIndex={product.artIndex}
        className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03]"
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg leading-snug text-forest-deep">{product.name}</h3>
          <p className="whitespace-nowrap text-sm font-semibold text-clay">
            <Money cents={product.priceCents} />
          </p>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{product.tagline}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-forest opacity-0 transition-opacity group-hover:opacity-100">
          View details <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

export function HomePage() {
  const db = useDb();
  const { siteContent, settings, products } = db;
  const published = products.filter((product) => product.isPublished);
  const preview = published.slice(0, 3);

  return (
    <div>
      <section className="relative overflow-hidden">
        <BotanicalSprig className="pointer-events-none absolute -left-16 top-24 hidden h-72 w-52 opacity-40 lg:block" />
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="animate-fade-up">
            <p className="eyebrow">{siteContent.heroEyebrow}</p>
            <h1 className="mt-4 max-w-xl text-balance font-display text-5xl leading-[1.05] text-forest-deep sm:text-6xl">
              {siteContent.heroTitle}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft/90">{siteContent.heroLead}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-forest-deep"
              >
                Explore the collection
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/custom-orders"
                className="inline-flex items-center gap-2 rounded-xl border border-forest/25 px-6 py-3 text-sm font-semibold text-forest transition-colors hover:bg-forest-wash"
              >
                Commission a cake
              </Link>
            </div>
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-line pt-6 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">The catalogue</dt>
                <dd className="mt-1 font-display text-lg text-forest-deep">Seven signature bakes</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Where to find us</dt>
                <dd className="mt-1 font-display text-lg text-forest-deep">Home Bakery · Café</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">For celebrations</dt>
                <dd className="mt-1 font-display text-lg text-forest-deep">Custom &amp; corporate</dd>
              </div>
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 rounded-[2.5rem] border border-forest/10" />
            <div className="absolute -right-4 -top-6 h-20 w-20 rounded-full bg-clay-wash" />
            <div className="relative overflow-hidden rounded-[2rem] border border-line bg-cream shadow-lift">
              <img
                src="/brand/season-cake-logo.png"
                alt="Seasons Cake — botanical logo on the signature cake box"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-6 rounded-2xl border border-line bg-cream px-5 py-3 shadow-soft">
              <p className="font-script text-xl text-forest-deep">Delicious &amp; Fresh</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted">The Seasons Cake promise</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-cream/70">
        <div className="container-page grid gap-6 py-9 sm:grid-cols-3">
          {[
            {
              icon: Sprout,
              title: 'Small-batch baking',
              copy: 'Seven bakes, made in batches we can stand behind — never an endless menu.',
            },
            {
              icon: Leaf,
              title: 'Season-led finishes',
              copy: 'Fruit follows the season, cream is whipped to order, pastry is baked for the day.',
            },
            {
              icon: CalendarDays,
              title: 'Written quotations',
              copy: 'Custom, bulk and corporate orders are quoted in writing before production begins.',
            },
          ].map((value) => (
            <div key={value.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-wash text-forest">
                <value.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-display text-base text-forest-deep">{value.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{value.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The collection</p>
            <h2 className="mt-2 font-display text-3xl text-forest-deep sm:text-4xl">Seven bakes, one standard.</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              A deliberately short regular catalogue. Custom cakes and corporate requests are quoted
              separately — they are never squeezed into these seven products.
            </p>
          </div>
          <Link to="/products" className="link-underline">
            View all products <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((product) => (
            <ProductCard key={product.id} productId={product.id} />
          ))}
        </div>
        <p className="mt-5 text-[11px] text-muted">
          {HAS_REMOTE_API
            ? 'Product imagery is illustration until final photography is uploaded; names, descriptions and prices are published by the bakery through its live catalogue.'
            : 'Catalogue preview — product imagery and prices are demo placeholders until the business publishes its final content.'}
        </p>
      </section>

      <section className="relative overflow-hidden bg-forest-deep text-cream">
        <BotanicalSprig className="pointer-events-none absolute -right-10 bottom-0 h-80 w-60 opacity-20" />
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="eyebrow text-clay-soft">Custom &amp; corporate orders</p>
            <h2 className="mt-3 max-w-lg font-display text-4xl leading-tight text-cream">
              A cake for the occasion, quoted properly.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-cream/70">{siteContent.customOrderNote}</p>
            <ul className="mt-6 space-y-2.5 text-sm text-cream/75">
              {['Custom cakes and celebration tiers', 'Bulk orders for offices and events', 'Organisational purchase orders & deposits'].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-clay-soft" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/custom-orders"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-clay px-6 py-3 text-sm font-semibold text-cream transition-colors hover:bg-clay-deep"
            >
              Start an enquiry <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { src: preview[0], caption: 'Custards' },
              { src: published[3], caption: 'Pastry' },
              { src: preview[1], caption: 'Chocolate' },
              { src: published[5], caption: 'Seasonal fruit' },
            ].map(
              (tile) =>
                tile.src && (
                  <div key={tile.caption} className="overflow-hidden rounded-2xl border border-cream/10">
                    <ProductArt artIndex={tile.src.artIndex} className="aspect-square w-full" />
                    <p className="bg-cream/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-cream/45">
                      {tile.caption} — demo art
                    </p>
                  </div>
                ),
            )}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-5 md:grid-cols-2">
          {settings.locations.map((location) => (
            <div key={location.id} className="card flex items-start gap-4 p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-wash text-clay-deep">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-xl text-forest-deep">{location.name}</p>
                <p className="mt-1 text-sm text-muted">{location.kind}</p>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Address and opening hours are published by the bakery in the business workspace.
                </p>
                <Link to="/contact" className="link-underline mt-4 text-xs">
                  Contact the bakery <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page pb-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-cream px-6 py-12 text-center">
          <p className="eyebrow">Enquiries</p>
          <h2 className="max-w-2xl text-balance font-display text-3xl text-forest-deep">
            Planning a celebration or a company order?
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Share the details and the bakery will confirm availability and pricing.{' '}
            {HAS_REMOTE_API
              ? 'Enquiries are delivered to the bakery team for a written quotation.'
              : 'Website submissions are stored in this demo workspace so you can see the full workflow.'}
          </p>
          <Link
            to="/custom-orders"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-3 text-sm font-semibold text-cream hover:bg-forest-deep"
          >
            Request a quotation <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
