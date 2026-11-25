import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Leaf, Lock, Menu, X } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { BotanicalSprig } from '@/components/shared/ProductArt';
import { useDb } from '@/hooks/useStore';
import { cn } from '@/utils/cn';
import { BRAND, HAS_REMOTE_API } from '@/config/brand';
import {
  SPRING_SNAPPY,
  ctaTapProps,
  drawerLinkVariants,
  fadeInVariants,
  mobileDrawerVariants,
} from '@/lib/motion';

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

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col bg-paper botanical-paper">
      <div className="bg-forest-deep text-cream/85">
        <div className="container-page flex items-center justify-between gap-4 py-2 text-[11px] font-medium tracking-wide">
          <p className="flex items-center gap-2 truncate">
            <Leaf className="h-3.5 w-3.5 shrink-0 text-forest-soft" />
            <span className="truncate">{settings.locations.map((loc) => loc.name).join(' · ')}</span>
          </p>
          <p className="hidden text-cream/75 sm:block">{settings.tagline} — small-batch artisan patisserie.</p>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line/75 bg-paper/90 backdrop-blur-md">
        <div className="container-page flex items-center justify-between gap-6 py-3.5">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-lg px-3.5 py-2 text-[13px] font-semibold tracking-wide transition-colors',
                    isActive ? 'text-forest-deep' : 'text-ink-soft/80 hover:text-forest',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span>{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="site-nav-indicator"
                        transition={SPRING_SNAPPY}
                        className="absolute inset-x-3.5 bottom-1 h-[1.5px] bg-clay"
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-muted transition-colors hover:text-forest"
            >
              <Lock className="h-3.5 w-3.5" />
              Business login
            </Link>
            {!isCustomPage && (
              <motion.div {...ctaTapProps}>
                <Link
                  to="/custom-orders"
                  className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-cream shadow-sm transition-colors hover:bg-forest-deep"
                >
                  Commission an order
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            )}
          </div>

          <button
            type="button"
            className="rounded-lg border border-line bg-cream/70 p-2 text-forest transition-colors hover:bg-cream lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              variants={mobileDrawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative z-40 border-t border-line bg-cream shadow-soft lg:hidden"
            >
              <nav className="container-page flex flex-col py-3" aria-label="Mobile">
                {navItems.map((item) => (
                  <motion.div key={item.to} variants={drawerLinkVariants}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between border-b border-line/60 py-3 text-sm font-semibold transition-colors',
                          isActive ? 'text-clay' : 'text-ink-soft hover:text-forest',
                        )
                      }
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-45" />
                    </NavLink>
                  </motion.div>
                ))}
                <motion.div variants={drawerLinkVariants} className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Link
                    to="/admin/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-muted hover:text-forest"
                  >
                    <Lock className="h-4 w-4" /> Business login
                  </Link>
                  {!isCustomPage && (
                    <Link
                      to="/custom-orders"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-cream"
                    >
                      Commission an order <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </motion.div>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close mobile menu"
            onClick={() => setOpen(false)}
            variants={fadeInVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-30 bg-forest-deep/30 backdrop-blur-[1px] lg:hidden"
          />
        )}
      </AnimatePresence>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="relative mt-24 overflow-hidden bg-forest-deep text-cream/80">
        <BotanicalSprig className="pointer-events-none absolute -right-6 top-0 h-72 w-52 opacity-15" />
        <div className="container-page relative grid gap-10 py-16 md:grid-cols-[1.45fr_1fr_1fr_1.2fr]">
          <div>
            <Logo invert />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-cream/75">{BRAND.description}</p>
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-cream/15 bg-cream/5 p-2.5 pr-4">
              <img
                src={BRAND.logoPath}
                alt="Seasons Cake official packaging mark"
                width={44}
                height={44}
                loading="lazy"
                className="h-11 w-11 rounded-xl object-cover"
              />
              <div className="text-[11px] leading-snug">
                <p className="font-semibold text-cream">Official patisserie seal</p>
                <p className="text-cream/60">{settings.tagline}</p>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-[11px] leading-relaxed text-cream/65">
              {HAS_REMOTE_API
                ? 'Live catalogue and CMS copy served directly by the Seasons Cake platform.'
                : 'Storefront preview — inquiries and contact notes write to a local demo workspace.'}
            </p>
          </div>

          <div>
            <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.24em] text-cream/65">Explore</p>
            <ul className="space-y-2.5 text-sm">
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
            <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.24em] text-cream/65">Orders</p>
            <ul className="space-y-2.5 text-sm">
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
            <p className="mb-3.5 text-[10px] font-bold uppercase tracking-[0.24em] text-cream/65">Find us</p>
            <ul className="space-y-2.5 text-sm">
              {settings.locations.map((loc) => (
                <li key={loc.id}>
                  <span className="font-medium text-cream">{loc.name}</span>
                  <span className="block text-xs text-cream/70">{loc.kind}</span>
                </li>
              ))}
            </ul>
            {(siteContent.contactPhone || siteContent.contactEmail || siteContent.contactAddress || siteContent.openingHours) && (
              <div className="mt-4 space-y-1 border-t border-cream/10 pt-3 text-xs text-cream/80">
                {siteContent.contactAddress && <p>{siteContent.contactAddress}</p>}
                {siteContent.openingHours && <p className="text-cream/70">{siteContent.openingHours}</p>}
                {siteContent.contactPhone && <p>{siteContent.contactPhone}</p>}
                {siteContent.contactEmail && <p>{siteContent.contactEmail}</p>}
              </div>
            )}
          </div>
        </div>
        <div className="container-page flex flex-wrap items-center justify-between gap-2 border-t border-cream/10 py-5 text-[11px] text-cream/60">
          <p>
            © {new Date().getFullYear()} {settings.businessName}. All rights reserved.
          </p>
          <p>
            {siteContent.heroEyebrow} · {settings.tagline}
          </p>
        </div>
      </footer>
    </div>
  );
}
