import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CalendarDays, Leaf, MapPin, Sprout } from 'lucide-react';
import { BotanicalSprig } from '@/components/shared/ProductArt';
import { BakeryImage } from '@/components/shared/BakeryImage';
import { ProductMedia } from '@/components/shared/ProductMedia';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { BRAND, HAS_REMOTE_API } from '@/config/brand';
import { EDITORIAL_MEDIA, GALLERY_MEDIA, resolveProductMedia } from '@/config/media';
import { useGsapScope } from '@/lib/gsap';
import { ctaTapProps, hoverLiftProps } from '@/lib/motion';

export function ProductCard({ productId }: { productId: string }) {
  const db = useDb();
  const product = db.products.find((entry) => entry.id === productId);
  if (!product) return null;
  const meta = resolveProductMedia(product.slug, product.artIndex);

  return (
    <motion.div {...hoverLiftProps} className="h-full">
      <Link
        to={`/products/${product.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-cream shadow-[0_10px_30px_-24px_rgba(41,61,34,0.3)] transition-shadow duration-300 hover:border-beige hover:shadow-soft"
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
            {meta.category}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl leading-snug text-forest-deep">{product.name}</h3>
            <p className="whitespace-nowrap pt-0.5 text-sm font-semibold text-clay tabular-nums">
              <Money cents={product.priceCents} />
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{product.tagline}</p>
          <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[11px] font-bold uppercase tracking-[0.15em] text-forest transition-colors group-hover:text-clay">
            Explore bake
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const db = useDb();
  const { siteContent, settings, products } = db;
  const published = products.filter((product) => product.isPublished).sort((a, b) => a.sortOrder - b.sortOrder);
  const preview = published.slice(0, 3);
  const counterStrip = published.slice(3);
  const homeGallery = GALLERY_MEDIA.slice(0, 4);

  useGsapScope(
    rootRef,
    ({ gsap, reduced }) => {
      if (reduced) return;

      // 1. Hero entrance timeline
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform,opacity' } });
      heroTl
        .from('[data-hero-reveal]', {
          y: 24,
          opacity: 0,
          duration: 0.72,
          stagger: 0.08,
        })
        .from(
          '[data-hero-media]',
          {
            y: 18,
            scale: 0.97,
            opacity: 0,
            duration: 0.85,
          },
          '-=0.45',
        )
        .from(
          '[data-hero-badge]',
          {
            y: 14,
            opacity: 0,
            duration: 0.55,
          },
          '-=0.35',
        );

      // 2. Subtle ScrollTrigger parallax on hero photo (never collides with Framer Motion)
      gsap.fromTo(
        '[data-hero-parallax]',
        { yPercent: -3 },
        {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-hero-section]',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        },
      );

      // 3. Pillars strip stagger
      gsap.from('[data-pillar]', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-pillars]',
          start: 'top 88%',
          once: true,
        },
      });

      // 4. Featured product cards stagger
      gsap.from('[data-featured-card]', {
        y: 26,
        opacity: 0,
        duration: 0.68,
        stagger: 0.12,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-featured-grid]',
          start: 'top 86%',
          once: true,
        },
      });

      // 5. Brand story split reveal + subtle image drift
      gsap.from('[data-story-block]', {
        y: 26,
        opacity: 0,
        duration: 0.75,
        stagger: 0.15,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-story-section]',
          start: 'top 84%',
          once: true,
        },
      });

      gsap.fromTo(
        '[data-story-parallax]',
        { yPercent: -4 },
        {
          yPercent: 4,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-story-section]',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );

      // 6. Curated gallery mosaic reveal
      gsap.from('[data-gallery-tile]', {
        y: 22,
        opacity: 0,
        duration: 0.65,
        stagger: 0.1,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-gallery-grid]',
          start: 'top 86%',
          once: true,
        },
      });

      // 7. Custom orders dark showcase reveal
      gsap.from('[data-custom-block]', {
        y: 24,
        opacity: 0,
        duration: 0.72,
        stagger: 0.14,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-custom-section]',
          start: 'top 84%',
          once: true,
        },
      });

      // 8. Locations reveal
      gsap.from('[data-location-block]', {
        y: 20,
        opacity: 0,
        duration: 0.62,
        stagger: 0.12,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-location-section]',
          start: 'top 86%',
          once: true,
        },
      });
    },
    [published.length],
  );

  return (
    <div ref={rootRef}>
      {/* Hero Section */}
      <section data-hero-section className="relative overflow-hidden">
        <BotanicalSprig className="pointer-events-none absolute -left-16 top-20 hidden h-72 w-52 opacity-35 lg:block" />
        <div className="container-page grid items-center gap-12 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:py-20">
          <div>
            <p data-hero-reveal className="eyebrow">
              {siteContent.heroEyebrow}
            </p>
            <h1
              data-hero-reveal
              className="mt-4 max-w-xl text-balance font-display text-5xl leading-[1.04] tracking-tight text-forest-deep sm:text-6xl"
            >
              {siteContent.heroTitle}
            </h1>
            <p data-hero-reveal className="mt-5 max-w-lg text-base leading-relaxed text-ink-soft/90">
              {siteContent.heroLead}
            </p>
            <div data-hero-reveal className="mt-8 flex flex-wrap items-center gap-3.5">
              <motion.div {...ctaTapProps}>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-3.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-forest-deep"
                >
                  Explore the collection
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div {...ctaTapProps}>
                <Link
                  to="/custom-orders"
                  className="inline-flex items-center gap-2 rounded-xl border border-forest/30 bg-cream/65 px-6 py-3.5 text-sm font-semibold text-forest transition-colors hover:bg-forest-wash"
                >
                  Commission a cake
                </Link>
              </motion.div>
            </div>
            <dl data-hero-reveal className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-line pt-6 text-sm sm:gap-6">
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted sm:text-[10px] sm:tracking-[0.16em]">The catalogue</dt>
                <dd className="mt-1 font-display text-sm text-forest-deep sm:text-lg">Seven bakes</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted sm:text-[10px] sm:tracking-[0.16em]">Two counters</dt>
                <dd className="mt-1 font-display text-sm text-forest-deep sm:text-lg">Bakery · Café</dd>
              </div>
              <div>
                <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted sm:text-[10px] sm:tracking-[0.16em]">Celebrations</dt>
                <dd className="mt-1 font-display text-sm text-forest-deep sm:text-lg">Custom quoted</dd>
              </div>
            </dl>
          </div>

          <div data-hero-media className="relative mx-auto w-full max-w-2xl">
            <div className="pointer-events-none absolute -inset-4 hidden rounded-[2.4rem] border border-forest/15 sm:block" />
            <div className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full bg-clay-wash/80" />
            <div className="relative overflow-hidden rounded-[2rem] border border-line bg-cream shadow-lift">
              <div data-hero-parallax className="scale-[1.06]">
                <BakeryImage
                  src={EDITORIAL_MEDIA.hero.src}
                  srcSmall={EDITORIAL_MEDIA.hero.srcSmall}
                  width={EDITORIAL_MEDIA.hero.width}
                  height={EDITORIAL_MEDIA.hero.height}
                  alt={EDITORIAL_MEDIA.hero.alt}
                  sizes="(max-width: 1024px) 100vw, 52vw"
                  priority
                  className="aspect-[16/11] w-full"
                />
              </div>
            </div>
            <div
              data-hero-badge
              className="mt-4 flex items-center gap-3.5 rounded-2xl border border-line bg-cream/95 px-4 py-3 shadow-soft backdrop-blur-sm sm:absolute sm:-bottom-5 sm:left-6 sm:mt-0"
            >
              <img
                src={BRAND.logoPath}
                alt="Seasons Cake official box seal"
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-xl border border-line object-cover"
              />
              <div>
                <p className="font-script text-xl leading-none text-forest-deep">Delicious &amp; Fresh</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted">
                  Small-batch patisserie · Morning bake
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Craft Pillars */}
      <section className="border-y border-line bg-cream/75">
        <div data-pillars className="container-page grid gap-6 py-10 sm:grid-cols-3">
          {[
            {
              icon: Sprout,
              title: 'Small-batch baking',
              copy: 'Seven signature bakes made in measured daily batches — never an endless menu.',
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
            <div key={value.title} data-pillar className="flex gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-wash text-forest">
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

      {/* Featured Products */}
      <section className="container-page py-16 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The collection</p>
            <h2 className="mt-2 font-display text-3xl text-forest-deep sm:text-4xl">Seven bakes, one standard.</h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">
              A deliberately short regular catalogue. Custom cakes and corporate requests are quoted
              separately — they are never squeezed into these seven products.
            </p>
          </div>
          <Link to="/products" className="link-underline">
            View all seven products <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div data-featured-grid className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((product) => (
            <div key={product.id} data-featured-card className="h-full">
              <ProductCard productId={product.id} />
            </div>
          ))}
        </div>

        {counterStrip.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-cream/85 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Also at the counter today</p>
            <div className="flex flex-wrap gap-2">
              {counterStrip.map((item) => (
                <Link
                  key={item.id}
                  to={`/products/${item.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 px-3.5 py-1.5 text-xs font-semibold text-forest-deep transition-colors hover:border-forest/35 hover:bg-forest-wash/60"
                >
                  <span>{item.name}</span>
                  <span className="text-clay tabular-nums">
                    <Money cents={item.priceCents} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Brand Story Editorial Section */}
      <section data-story-section className="border-y border-line bg-cream/60 py-16 lg:py-24">
        <div className="container-page grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div data-story-block className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-line bg-cream shadow-soft">
              <div data-story-parallax className="scale-[1.06]">
                <BakeryImage
                  src={EDITORIAL_MEDIA.brandCraft.src}
                  srcSmall={EDITORIAL_MEDIA.brandCraft.srcSmall}
                  width={EDITORIAL_MEDIA.brandCraft.width}
                  height={EDITORIAL_MEDIA.brandCraft.height}
                  alt={EDITORIAL_MEDIA.brandCraft.alt}
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className="aspect-[4/3] w-full"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-cream p-3.5 shadow-soft sm:ml-auto sm:mt-0 sm:w-80 sm:-translate-x-4 sm:-translate-y-10">
              <img
                src={BRAND.logoPath}
                alt="Seasons Cake official packaging mark"
                width={64}
                height={64}
                loading="lazy"
                className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-clay">Brand heritage</p>
                <p className="mt-0.5 font-display text-base text-forest-deep">Official Seasons Cake mark</p>
                <p className="mt-0.5 text-[11px] text-muted">Botanical foliage &amp; warm kraft craft</p>
              </div>
            </div>
          </div>

          <div data-story-block>
            <p className="eyebrow">Our story</p>
            <h2 className="mt-2.5 text-balance font-display text-3xl leading-tight text-forest-deep sm:text-4xl">
              {siteContent.aboutTitle}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft/90">{siteContent.aboutLead}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted">{siteContent.aboutBody}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <motion.div {...ctaTapProps}>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 rounded-xl border border-forest/30 bg-cream px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest-wash"
                >
                  Read our story
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <Link to="/gallery" className="link-underline">
                Visit the gallery <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Mosaic Section */}
      <section className="container-page py-16 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">From the kitchen &amp; counter</p>
            <h2 className="mt-2 font-display text-3xl text-forest-deep sm:text-4xl">Morning light, layered craft.</h2>
          </div>
          <Link to="/gallery" className="link-underline">
            Explore full gallery <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div data-gallery-grid className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {homeGallery.map((tile, index) => (
            <Link
              key={tile.id}
              to="/gallery"
              data-gallery-tile
              className={`group relative overflow-hidden rounded-2xl border border-line bg-cream shadow-[0_8px_24px_-20px_rgba(41,61,34,0.3)] ${
                index === 0 ? 'sm:col-span-2' : ''
              }`}
            >
              <BakeryImage
                src={tile.asset.src}
                srcSmall={tile.asset.srcSmall}
                width={tile.asset.width}
                height={tile.asset.height}
                alt={tile.asset.alt}
                sizes={index === 0 ? '(max-width: 1024px) 100vw, 50vw' : '(max-width: 1024px) 50vw, 25vw'}
                className={index === 0 ? 'aspect-[16/10] w-full' : 'aspect-[4/3] w-full sm:aspect-[4/5]'}
                imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
              <div className="flex items-center justify-between gap-2 border-t border-line/70 bg-cream px-4 py-3">
                <p className="text-xs font-semibold text-forest-deep">{tile.label}</p>
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{tile.category}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Custom & Corporate Orders Section */}
      <section data-custom-section className="relative overflow-hidden bg-forest-deep text-cream">
        <BotanicalSprig className="pointer-events-none absolute -right-10 bottom-0 h-80 w-60 opacity-20" />
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1fr_1fr] lg:py-24">
          <div data-custom-block>
            <p className="eyebrow text-clay-soft">Custom &amp; corporate orders</p>
            <h2 className="mt-3 max-w-lg text-balance font-display text-4xl leading-tight text-cream">
              A cake for the occasion, quoted properly.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-cream/75">{siteContent.customOrderNote}</p>
            <ul className="mt-6 space-y-2.5 text-sm text-cream/85">
              {[
                'Custom celebration cakes and botanical tiered work',
                'Bulk pastry boxes for offices, launches, and gifting',
                'Organisational purchase orders & advance deposits',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-clay-soft" />
                  {item}
                </li>
              ))}
            </ul>
            <motion.div {...ctaTapProps} className="mt-8 inline-block">
              <Link
                to="/custom-orders"
                className="inline-flex items-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-clay-deep"
              >
                Start an enquiry <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          <div data-custom-block className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1.15fr_0.85fr]">
            <div className="overflow-hidden rounded-3xl border border-cream/15 bg-forest">
              <BakeryImage
                src={EDITORIAL_MEDIA.customCelebration.src}
                srcSmall={EDITORIAL_MEDIA.customCelebration.srcSmall}
                width={EDITORIAL_MEDIA.customCelebration.width}
                height={EDITORIAL_MEDIA.customCelebration.height}
                alt={EDITORIAL_MEDIA.customCelebration.alt}
                sizes="(max-width: 1024px) 60vw, 28vw"
                className="aspect-[3/4] w-full"
              />
              <p className="border-t border-cream/10 bg-forest-deep/80 px-4 py-2.5 text-[11px] font-medium text-cream/80">
                Bespoke celebration tiers
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-cream/15 bg-forest">
              <BakeryImage
                src={EDITORIAL_MEDIA.giftPackaging.src}
                srcSmall={EDITORIAL_MEDIA.giftPackaging.srcSmall}
                width={EDITORIAL_MEDIA.giftPackaging.width}
                height={EDITORIAL_MEDIA.giftPackaging.height}
                alt={EDITORIAL_MEDIA.giftPackaging.alt}
                sizes="(max-width: 1024px) 40vw, 20vw"
                className="aspect-[4/3] w-full"
              />
              <p className="border-t border-cream/10 bg-forest-deep/80 px-3.5 py-2.5 text-[11px] font-medium text-cream/80">
                Corporate &amp; bulk gifting
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Locations & Café Counter */}
      <section data-location-section className="container-page py-16 lg:py-20">
        <div className="grid items-stretch gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div data-location-block className="overflow-hidden rounded-3xl border border-line bg-cream shadow-soft">
            <BakeryImage
              src={EDITORIAL_MEDIA.cafeCounter.src}
              srcSmall={EDITORIAL_MEDIA.cafeCounter.srcSmall}
              width={EDITORIAL_MEDIA.cafeCounter.width}
              height={EDITORIAL_MEDIA.cafeCounter.height}
              alt={EDITORIAL_MEDIA.cafeCounter.alt}
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="aspect-[16/10] h-full w-full"
            />
          </div>
          <div data-location-block className="flex flex-col justify-between gap-4">
            {settings.locations.map((location) => (
              <div key={location.id} className="card flex flex-1 items-start gap-4 p-6 transition-colors hover:border-beige">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-wash text-clay-deep">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <p className="eyebrow">{location.kind}</p>
                  <p className="mt-1 font-display text-2xl text-forest-deep">{location.name}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {siteContent.contactAddress && location.id === 'cafe'
                      ? siteContent.contactAddress
                      : 'Address and opening hours are published by the bakery when finalized in the workspace.'}
                  </p>
                  <Link to="/contact" className="link-underline mt-4 text-xs">
                    Contact the bakery <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Callout Banner */}
      <section className="container-page pb-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-cream px-6 py-12 text-center shadow-soft">
          <p className="eyebrow">Enquiries</p>
          <h2 className="max-w-2xl text-balance font-display text-3xl text-forest-deep">
            Planning a celebration or a company order?
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Share the details and the bakery will confirm availability and pricing.{' '}
            {HAS_REMOTE_API
              ? 'Enquiries are delivered directly to the bakery team for a written quotation.'
              : 'Website submissions are stored in this demo workspace so you can explore the full workflow.'}
          </p>
          <motion.div {...ctaTapProps} className="mt-2">
            <Link
              to="/custom-orders"
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-6 py-3.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-forest-deep"
            >
              Request a quotation <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
