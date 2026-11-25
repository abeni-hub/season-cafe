import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowRight, Leaf, Lock, Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { BotanicalSprig } from '@/components/shared/ProductArt';
import { useDb } from '@/hooks/useStore';
import { cn } from '@/utils/cn';
import { BRAND, HAS_REMOTE_API } from '@/config/brand';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
  { to: '/about', label: 'About us' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/custom-orders', label: 'Custom orders' },
  { to: '/contact', label: 'Contact' },
];

export function SiteLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const db = useDb();
  const { siteContent, settings } = db;
  const isCustomPage = location.pathname === '/custom-orders';

  return (
    <div className="min-h-screen bg-paper botanical-paper">
      <div className="bg-forest-deep text-cream/80">
        <div className="container-page flex items-center justify-between gap-4 py-2 text-[11px] font-medium tracking-wide">
          <p className="flex items-center gap-2">
            <Leaf className="h-3.5 w-3.5 text-forest-soft" />
            {settings.locations.map((loc) => loc.name).join(' · ')}
          </p>
          <p className="hidden sm:block">{settings.tagline} — artisan bakes, made in small batches.</p>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/90 backdrop-blur-md">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'text-[13px] font-semibold tracking-wide transition-colors',
                    isActive ? 'text-forest-deep' : 'text-ink-soft/80 hover:text-forest',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/admin/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-forest">
              <Lock className="h-3.5 w-3.5" />
              Business login
            </Link>
            {!isCustomPage && (
              <Link
                to="/custom-orders"
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-cream transition-colors hover:bg-forest-deep"
              >
                Commission an order
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg border border-line p-2 text-forest lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-line bg-paper lg:hidden">
            <nav className="container-page flex flex-col py-2" aria-label="Mobile">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'border-b border-line/60 py-3 text-sm font-semibold',
                      isActive ? 'text-clay' : 'text-ink-soft',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <Link
                to="/admin/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 py-3 text-sm font-semibold text-muted"
              >
                <Lock className="h-4 w-4" /> Business login
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="relative mt-20 overflow-hidden bg-forest-deep text-cream/75">
        <BotanicalSprig className="pointer-events-none absolute -right-6 top-0 h-64 w-48 opacity-20" />
        <div className="container-page relative grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo invert />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              {BRAND.description}
            </p>
            <p className="mt-5 text-[11px] leading-relaxed text-cream/45">
              {HAS_REMOTE_API
                ? 'Catalogue and business content are served by the live Django API. Imagery remains illustrative until final photography is uploaded by the business.'
                : 'Storefront demo — imagery, catalogue copy and pricing are placeholders pending the business’s content. Forms write to a local demo dataset.'}
            </p>
          </div>
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-cream/50">Explore</p>
            <ul className="space-y-2 text-sm">
              {navItems.slice(0, 4).map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="transition-colors hover:text-cream">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-cream/50">Orders</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/custom-orders" className="transition-colors hover:text-cream">
                  Custom cakes
                </Link>
              </li>
              <li>
                <Link to="/custom-orders" className="transition-colors hover:text-cream">
                  Corporate &amp; bulk
                </Link>
              </li>
              <li>
                <Link to="/contact" className="transition-colors hover:text-cream">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="inline-flex items-center gap-1.5 transition-colors hover:text-cream">
                  <Lock className="h-3 w-3" /> Business login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-cream/50">Find us</p>
            <ul className="space-y-2 text-sm">
              {settings.locations.map((loc) => (
                <li key={loc.id}>
                  <span className="text-cream">{loc.name}</span>
                  <span className="block text-xs text-cream/50">{loc.kind}</span>
                </li>
              ))}
            </ul>
            {siteContent.contactPhone && (
              <p className="mt-3 text-sm">{siteContent.contactPhone}</p>
            )}
            {siteContent.contactEmail && (
              <p className="text-sm">{siteContent.contactEmail}</p>
            )}
          </div>
        </div>
        <div className="container-page flex flex-wrap items-center justify-between gap-2 border-t border-cream/10 py-5 text-[11px] text-cream/40">
          <p>© {new Date().getFullYear()} {settings.businessName}. All rights reserved.</p>
          <p>{siteContent.heroEyebrow} · {settings.tagline}</p>
        </div>
      </footer>
    </div>
  );
}
