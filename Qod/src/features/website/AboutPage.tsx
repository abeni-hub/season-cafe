import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Leaf, MapPin, Sprout } from 'lucide-react';
import { BotanicalSprig } from '@/components/shared/ProductArt';
import { BakeryImage } from '@/components/shared/BakeryImage';
import { useDb } from '@/hooks/useStore';
import { BRAND, HAS_REMOTE_API } from '@/config/brand';
import { EDITORIAL_MEDIA } from '@/config/media';
import { useGsapScope } from '@/lib/gsap';
import { ctaTapProps } from '@/lib/motion';

export function AboutPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const db = useDb();
  const { siteContent, settings } = db;

  useGsapScope(
    rootRef,
    ({ gsap, reduced }) => {
      if (reduced) return;
      gsap.from('[data-about-hero]', {
        y: 20,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      gsap.from('[data-about-pillar]', {
        y: 22,
        opacity: 0,
        duration: 0.62,
        stagger: 0.1,
        ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: {
          trigger: '[data-about-pillars]',
          start: 'top 86%',
          once: true,
        },
      });
    },
    [],
  );

  return (
    <div ref={rootRef}>
      <section className="relative overflow-hidden border-b border-line">
        <BotanicalSprig className="pointer-events-none absolute -right-8 top-6 h-72 w-52 opacity-30" />
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div data-about-hero>
            <p className="eyebrow">About Seasons Cake</p>
            <h1 className="mt-3 max-w-xl text-balance font-display text-4xl leading-tight text-forest-deep sm:text-5xl">
              {siteContent.aboutTitle}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft/90">{siteContent.aboutLead}</p>
            <p className="mt-4 max-w-xl whitespace-pre-line text-sm leading-relaxed text-muted">
              {siteContent.aboutBody}
            </p>
          </div>

          <div data-about-hero className="relative mx-auto w-full max-w-xl">
            <div className="overflow-hidden rounded-[2rem] border border-line bg-cream shadow-soft">
              <BakeryImage
                src={EDITORIAL_MEDIA.brandCraft.src}
                srcSmall={EDITORIAL_MEDIA.brandCraft.srcSmall}
                width={EDITORIAL_MEDIA.brandCraft.width}
                height={EDITORIAL_MEDIA.brandCraft.height}
                alt={EDITORIAL_MEDIA.brandCraft.alt}
                sizes="(max-width: 1024px) 100vw, 45vw"
                priority
                className="aspect-[4/3] w-full"
              />
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-cream p-3.5 shadow-soft sm:absolute sm:-bottom-6 sm:-left-6 sm:mt-0 sm:w-80">
              <img
                src={BRAND.logoPath}
                alt="Seasons Cake official brand mark on signature bakery box"
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-xl border border-line object-cover"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-clay">Official brand mark</p>
                <p className="mt-0.5 font-display text-base text-forest-deep">Seasons Cake</p>
                <p className="mt-0.5 text-[11px] text-muted">{settings.tagline}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-16">
        <div data-about-pillars className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Sprout,
              title: 'A short catalogue',
              copy: 'Seven regular bakes. Custom work is a separate, quoted service — never forced into the regular range.',
            },
            {
              icon: Leaf,
              title: 'Ingredients that follow the season',
              copy: 'Fruit and finishes are chosen for the season; recipes carry measured ingredient and packaging costs.',
            },
            {
              icon: MapPin,
              title: 'Two physical locations',
              copy: 'Production and collection at the Home Bakery, with a café counter for the everyday bake.',
            },
          ].map((card) => (
            <div key={card.title} data-about-pillar className="card p-6 transition-colors hover:border-beige">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-wash text-forest">
                <card.icon className="h-4 w-4" />
              </span>
              <p className="mt-4 font-display text-lg text-forest-deep">{card.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{card.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid items-center gap-8 overflow-hidden rounded-3xl border border-line bg-cream p-6 shadow-soft lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
          <div className="overflow-hidden rounded-2xl border border-line">
            <BakeryImage
              src={EDITORIAL_MEDIA.cafeCounter.src}
              srcSmall={EDITORIAL_MEDIA.cafeCounter.srcSmall}
              width={EDITORIAL_MEDIA.cafeCounter.width}
              height={EDITORIAL_MEDIA.cafeCounter.height}
              alt={EDITORIAL_MEDIA.cafeCounter.alt}
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="aspect-[16/10] w-full"
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            {settings.locations.map((location) => (
              <div key={location.id} className="border-l-2 border-clay/50 pl-4">
                <p className="eyebrow">{location.kind}</p>
                <p className="mt-1.5 font-display text-2xl text-forest-deep">{location.name}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {siteContent.contactAddress && location.id === 'cafe'
                    ? siteContent.contactAddress
                    : 'Address, opening hours and direct contact details are maintained by the bakery in the Website module.'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
          <p className="max-w-md text-sm leading-relaxed text-muted">
            {HAS_REMOTE_API
              ? 'Brand story, catalogue pricing and contact details are published live by the bakery team.'
              : 'Brand copy and contact information shown here mirror the bakery’s CMS workspace.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <motion.div {...ctaTapProps}>
              <Link
                to="/gallery"
                className="inline-flex items-center gap-2 rounded-xl border border-forest/25 bg-cream px-5 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest-wash"
              >
                View gallery
              </Link>
            </motion.div>
            <motion.div {...ctaTapProps}>
              <Link
                to="/custom-orders"
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-forest-deep"
              >
                Work with us <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
