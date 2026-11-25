import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, MapPin, Sprout } from 'lucide-react';
import { BotanicalSprig } from '@/components/shared/ProductArt';
import { useDb } from '@/hooks/useStore';
import { HAS_REMOTE_API } from '@/config/brand';

export function AboutPage() {
  const db = useDb();
  const { siteContent, settings } = db;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <BotanicalSprig className="pointer-events-none absolute -right-8 top-6 h-72 w-52 opacity-30" />
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <p className="eyebrow">About Seasons Cake</p>
            <h1 className="mt-3 max-w-xl text-balance font-display text-4xl leading-tight text-forest-deep sm:text-5xl">
              {siteContent.aboutTitle}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft/90">{siteContent.aboutLead}</p>
            <p className="mt-4 max-w-xl whitespace-pre-line text-sm leading-relaxed text-muted">{siteContent.aboutBody}</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-[2rem] border border-line bg-cream shadow-soft">
              <img src="/brand/season-cake-logo.png" alt="Seasons Cake brand mark" className="h-full w-full object-cover" />
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">Official brand mark supplied by the bakery.</p>
          </div>
        </div>
      </div>

      <div className="container-page py-14">
        <div className="grid gap-5 md:grid-cols-3">
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
            <div key={card.title} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-wash text-forest">
                <card.icon className="h-4 w-4" />
              </span>
              <p className="mt-4 font-display text-lg text-forest-deep">{card.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">{card.copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 rounded-3xl border border-line bg-cream px-6 py-8 md:grid-cols-2">
          {settings.locations.map((location) => (
            <div key={location.id}>
              <p className="eyebrow">{location.kind}</p>
              <p className="mt-2 font-display text-2xl text-forest-deep">{location.name}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Address, opening hours and direct contact details are maintained by the bakery in the
                Website module of the BMS.
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
          <p className="max-w-md text-sm leading-relaxed text-muted">
            {HAS_REMOTE_API
              ? 'Imagery on this storefront is illustration until final photography is uploaded; brand copy and contact details are published by the bakery in the business workspace.'
              : 'The story, imagery and contact information on this storefront are demo placeholders until the business publishes its own content.'}
          </p>
          <div className="flex gap-2">
            <Link
              to="/gallery"
              className="inline-flex items-center gap-2 rounded-xl border border-forest/25 px-5 py-2.5 text-sm font-semibold text-forest hover:bg-forest-wash"
            >
              View gallery
            </Link>
            <Link
              to="/custom-orders"
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-cream hover:bg-forest-deep"
            >
              Work with us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
