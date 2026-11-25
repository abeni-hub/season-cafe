import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  ClipboardList,
  Package,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState, PageHeader, StatCard } from '@/components/ui/page';
import { OrderStatusPill } from '@/components/shared/StatusPills';
import { TableShell } from '@/components/ui/table';
import { buttonClasses } from '@/components/ui/button';
import { useDb, usePermission, useSession } from '@/hooks/useStore';
import { HAS_REMOTE_API } from '@/config/brand';
import { dashboardSummary, salesSeries } from '@/services/reportService';
import { listLowStock } from '@/services/live/inventoryService';
import { customerName } from '@/services/live/customerService';
import { orderTotals } from '@/services/orderMath';
import { ORDER_STATUS_LABELS } from '@/services/live/orderService';
import { formatCents } from '@/utils/money';
import { formatDateTime } from '@/utils/date';

export function DashboardPage() {
  const db = useDb();
  const session = useSession();
  const canSeeFinance = usePermission('finance.view');
  const canSeeOrders = usePermission('orders.view');
  const canUsePos = usePermission('pos.use');
  const canSeeInventory = usePermission('inventory.view');
  const canSeeProduction = usePermission('production.view');
  const summary = dashboardSummary();
  const series = salesSeries(14);
  const lowStock = listLowStock().slice(0, 5);
  const currency = db.settings.currency;

  const financeCards = [
    {
      label: "Today's collections",
      value: formatCents(summary.todayCollectedCents, currency),
      hint: 'Valid payments recorded today',
      icon: <Wallet className="h-4 w-4" />,
      tone: 'forest' as const,
    },
    {
      label: 'Last 30 days',
      value: formatCents(summary.last30CollectedCents, currency),
      hint: 'Net of refunds',
      icon: <TrendingUp className="h-4 w-4" />,
      tone: 'clay' as const,
    },
    {
      label: 'Outstanding balances',
      value: formatCents(summary.outstandingCents, currency),
      hint: 'Across open and fulfilled orders',
      icon: <ClipboardList className="h-4 w-4" />,
      tone: 'amber' as const,
    },
  ];

  const operationalCards = [
    {
      label: 'Open orders',
      value: String(summary.pendingOrders),
      hint: 'Inquiry through ready',
      icon: <ClipboardList className="h-4 w-4" />,
      tone: 'forest' as const,
    },
    {
      label: "Today's orders",
      value: String(summary.todayOrdersCount),
      hint: 'Created today, any type',
      icon: <Sparkles className="h-4 w-4" />,
      tone: 'clay' as const,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={`Good ${greeting()}, ${session?.name ?? 'team'}`}
        title="Bakery overview"
        description={
          HAS_REMOTE_API
            ? 'A working view of sales, balances, production and stock, computed from the live ledger. Payments are cash-basis; orders carry their own balances.'
            : 'A working view of sales, balances, production and stock. Figures derive from the demo ledger — payments are cash-basis, orders carry their own balances.'
        }
        actions={
          canUsePos ? (
            <Link to="/admin/pos" className={buttonClasses('primary', 'md')}>
              Open point of sale
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(canSeeFinance ? financeCards : operationalCards).map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
        <StatCard
          label="Production active"
          value={String(summary.activeBatches)}
          hint="Batches not yet completed"
          icon={<ChefHat className="h-4 w-4" />}
          tone="neutral"
        />
        <StatCard
          label="Low stock"
          value={String(summary.lowStockCount)}
          hint="Items below reorder level"
          icon={<Package className="h-4 w-4" />}
          tone="amber"
        />
        {!canSeeFinance && (
          <div className="card flex flex-col justify-between border-dashed p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Limited role view</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Revenue, balances and expenses are hidden for your role. Your operational work is unaffected.
              </p>
            </div>
            {canUsePos && (
              <Link to="/admin/pos" className={buttonClasses('outline', 'sm', 'mt-4 self-start')}>
                Start a sale <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {canSeeFinance && (
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Collections</p>
                <h2 className="mt-1 font-display text-lg text-forest-deep">Last 14 days</h2>
              </div>
              <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-[10px] font-semibold text-muted">
                Cash basis
              </span>
            </div>
            <div className="mt-4 h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="collections" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3f5c35" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#3f5c35" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e3dbc9" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#7c7564' }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#7c7564' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(value: number) => formatCents(value, currency, { compact: true })}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCents(value, currency), 'Collected']}
                    labelStyle={{ fontSize: 11, color: '#49463c', fontWeight: 600 }}
                    contentStyle={{
                      backgroundColor: '#fcfaf4',
                      borderRadius: 12,
                      borderColor: '#e3dbc9',
                      fontSize: 12,
                      boxShadow: '0 10px 25px -15px rgba(41,61,34,0.35)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="collectedCents"
                    stroke="#3f5c35"
                    strokeWidth={2}
                    fill="url(#collections)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-forest-deep">Stock alerts</h2>
            {canSeeInventory && (
              <Link to="/admin/inventory" className="link-underline text-xs">
                Inventory
              </Link>
            )}
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-line bg-paper/50 px-4 py-6 text-center text-xs text-muted">
              Nothing below its reorder level.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {lowStock.map((row) => (
                <li key={row.item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{row.item.name}</p>
                    <p className="text-[11px] text-muted tabular-nums">
                      {row.total} {row.item.unit} on hand · reorder at {row.item.reorderLevel}
                    </p>
                  </div>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-clay" />
                </li>
              ))}
            </ul>
          )}
          {canSeeProduction && (
            <Link
              to="/admin/production"
              className="mt-4 flex items-center justify-between rounded-xl border border-line bg-paper/55 px-3.5 py-2.5 text-xs font-semibold text-forest transition-colors hover:bg-paper"
            >
              Production schedule
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {canSeeOrders && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-forest-deep">Recent orders</h2>
              <Link to="/admin/orders" className="link-underline text-xs">
                All orders
              </Link>
            </div>
            {summary.recentOrders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No orders yet"
                description="Counter sales and custom enquiries will appear here as they are recorded."
              />
            ) : (
              <TableShell>
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="th">Order</th>
                      <th className="th">Customer</th>
                      <th className="th">Status</th>
                      <th className="th text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentOrders.map((order) => {
                      const totals = orderTotals(db, order);
                      return (
                        <tr key={order.id} className="transition-colors hover:bg-paper/45">
                          <td className="td">
                            <Link to={`/admin/orders/${order.id}`} className="font-semibold text-forest hover:underline">
                              {order.code}
                            </Link>
                            <p className="text-[11px] text-muted">{formatDateTime(order.createdAt)}</p>
                          </td>
                          <td className="td">{customerName(order.customerId)}</td>
                          <td className="td">
                            <OrderStatusPill status={order.status} />
                          </td>
                          <td className="td text-right tabular-nums">
                            {order.status === 'inquiry' ? '—' : formatCents(totals.balanceCents, currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableShell>
            )}
          </section>
        )}

        <section className="card p-5">
          <h2 className="font-display text-lg text-forest-deep">Activity</h2>
          {summary.recentActivity.length === 0 ? (
            <p className="mt-4 text-xs text-muted">No recent activity logged.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {summary.recentActivity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay/75" />
                  <div>
                    <p className="text-xs leading-relaxed text-ink-soft">{entry.message}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                      {entry.actor} · {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canSeeOrders && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Status key</span>
          {Object.keys(ORDER_STATUS_LABELS).map((status) => (
            <OrderStatusPill key={status} status={status as keyof typeof ORDER_STATUS_LABELS} />
          ))}
        </div>
      )}
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
