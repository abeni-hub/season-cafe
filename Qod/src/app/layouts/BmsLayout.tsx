import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Cake,
  ChefHat,
  ClipboardList,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { useToast } from '@/components/ui/toast';
import { DemoBadge } from '@/components/shared/StatusPills';
import { useDb, useSession } from '@/hooks/useStore';
import { ROLE_LABELS, roleHasPermission, type Permission } from '@/config/permissions';
import { logout } from '@/services/live/authService';
import { cn } from '@/utils/cn';
import { DEMO_NOTE, HAS_REMOTE_API } from '@/config/brand';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  end?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view', end: true },
      { to: '/admin/pos', label: 'Point of sale', icon: ShoppingCart, permission: 'pos.use' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: ClipboardList, permission: 'orders.view' },
      { to: '/admin/custom-orders', label: 'Custom & corporate', icon: Sparkles, permission: 'orders.view' },
      { to: '/admin/customers', label: 'Customers', icon: Users, permission: 'customers.manage' },
      { to: '/admin/payments', label: 'Payments', icon: Wallet, permission: 'payments.view' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin/inventory', label: 'Inventory', icon: Package, permission: 'inventory.view' },
      { to: '/admin/purchasing', label: 'Purchasing', icon: Truck, permission: 'purchasing.manage' },
      { to: '/admin/production', label: 'Production', icon: ChefHat, permission: 'production.view' },
      { to: '/admin/recipes', label: 'Recipes & costing', icon: BookOpen, permission: 'production.view' },
      { to: '/admin/transfers', label: 'Transfers', icon: ArrowLeftRight, permission: 'transfers.manage' },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/admin/expenses', label: 'Expenses', icon: Receipt, permission: 'expenses.manage' },
      { to: '/admin/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/products', label: 'Catalogue', icon: Cake, permission: 'products.manage' },
      { to: '/admin/employees', label: 'Team & access', icon: UserCog, permission: 'employees.manage' },
      { to: '/admin/website', label: 'Website & settings', icon: Globe2, permission: 'cms.manage' },
    ],
  },
];

export function BmsLayout() {
  const [open, setOpen] = useState(false);
  const session = useSession();
  const navigate = useNavigate();
  const db = useDb();
  const toast = useToast();
  const canViewFinance = session ? roleHasPermission(session.role, 'finance.view') : false;

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error(error);
    }
    navigate('/admin/login');
  };

  const navSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        session ? roleHasPermission(session.role, item.permission) : false,
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-paper">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-forest-deep text-cream transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <Logo invert to="/admin" compact />
          <button
            type="button"
            className="rounded-lg p-1.5 text-cream/60 hover:bg-cream/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-5">
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.28em] text-cream/35">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-cream/10 text-cream'
                            : 'text-cream/60 hover:bg-cream/5 hover:text-cream',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={cn(
                              'h-1 w-1 rounded-full transition-colors',
                              isActive ? 'bg-clay' : 'bg-transparent',
                            )}
                          />
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-cream/10 p-4">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-cream/55 transition-colors hover:bg-cream/5 hover:text-cream"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View public website
          </Link>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-cream/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-cream">{session?.name}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-cream/40">
                {session ? ROLE_LABELS[session.role] : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg p-1.5 text-cream/50 transition-colors hover:bg-cream/10 hover:text-cream"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          aria-label="Close menu overlay"
          className="fixed inset-0 z-40 bg-forest-deep/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-line p-2 text-forest lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden items-center gap-2 text-[11px] font-medium text-muted sm:flex">
                {db.settings.locations.map((loc) => (
                  <span key={loc.id} className="rounded-full border border-line bg-cream px-2.5 py-1">
                    {loc.name}
                  </span>
                ))}
                <span className="rounded-full border border-line bg-cream px-2.5 py-1">{db.settings.currency}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {!canViewFinance && (
                <span className="hidden rounded-full border border-line bg-cream px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted sm:block">
                  Limited view
                </span>
              )}
              <DemoBadge />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
          <p className="mt-10 border-t border-line pt-4 text-[11px] leading-relaxed text-muted">
            {HAS_REMOTE_API
              ? 'Connected to the Django API and PostgreSQL. Authorisation is enforced by the server; this screen only mirrors the signed-in role.'
              : DEMO_NOTE}
          </p>
        </main>
      </div>
    </div>
  );
}
