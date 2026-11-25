import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button, buttonClasses } from '@/components/ui/button';
import { Tabs, TableShell } from '@/components/ui/table';
import { OrderStatusPill } from '@/components/shared/StatusPills';
import { Money } from '@/components/shared/Money';
import { useDb, usePermission } from '@/hooks/useStore';
import { listOrders, ORDER_FLOW, ORDER_TYPE_LABELS } from '@/services/live/orderService';
import { orderTotals } from '@/services/orderMath';
import { customerName } from '@/services/live/customerService';
import { CreateOrderModal, QuoteModal } from '@/features/orders/OrderModals';
import type { Order } from '@/types/domain';
import { formatDate } from '@/utils/date';
import { formatCents } from '@/utils/money';

type TabKey = 'queue' | 'completed' | 'all';

export function CustomOrdersPage() {
  const db = useDb();
  const canManage = usePermission('orders.manage');
  const [tab, setTab] = useState<TabKey>('queue');
  const [createOpen, setCreateOpen] = useState(false);
  const [quoteOrder, setQuoteOrder] = useState<Order | null>(null);

  const customOrders = useMemo(
    () => listOrders().filter((order) => order.type !== 'regular'),
    [db],
  );
  const queue = customOrders.filter((order) => !['fulfilled', 'cancelled'].includes(order.status));
  const completed = customOrders.filter((order) => ['fulfilled', 'cancelled'].includes(order.status));
  const visible = tab === 'queue' ? queue : tab === 'completed' ? completed : customOrders;

  const awaitingQuote = customOrders.filter((order) => order.status === 'inquiry').length;
  const outstanding = customOrders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Math.max(0, orderTotals(db, order).balanceCents), 0);
  const deposits = customOrders
    .filter((order) => !['cancelled', 'inquiry'].includes(order.status))
    .reduce((sum, order) => sum + orderTotals(db, order).paidCents, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Custom, bulk & organisational"
        title="Custom order desk"
        description="Website inquiries, corporate requests and custom cakes move through quotation, confirmation, deposit, production and fulfilment — separate from the seven-product catalogue."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New custom order
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Awaiting quotation</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{awaitingQuote}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Deposits &amp; payments held</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(deposits, db.settings.currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Outstanding on custom orders</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{formatCents(outstanding, db.settings.currency)}</p>
        </div>
      </div>

      <Tabs<TabKey>
        items={[
          { key: 'queue', label: 'Open queue', count: queue.length },
          { key: 'completed', label: 'Closed', count: completed.length },
          { key: 'all', label: 'All', count: customOrders.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-paper/40 px-6 py-14 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted" />
          <p className="mt-3 font-display text-lg text-ink">No orders in this view.</p>
          <p className="mt-1 text-sm text-muted">
            Website enquiries appear here automatically. Create a custom order to start a quotation.
          </p>
        </div>
      ) : (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Customer</th>
                <th className="th">Type</th>
                <th className="th">Status</th>
                <th className="th">Requested date</th>
                <th className="th text-right">Quoted total</th>
                <th className="th text-right">Balance</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => {
                const totals = orderTotals(db, order);
                const canQuote = canManage && ['inquiry', 'quoted'].includes(order.status);
                return (
                  <tr key={order.id} className="transition-colors hover:bg-paper/40">
                    <td className="td">
                      <Link to={`/admin/orders/${order.id}`} className="font-semibold text-forest hover:underline">
                        {order.code}
                      </Link>
                      <p className="text-[11px] text-muted">{formatDate(order.createdAt)} · {order.source}</p>
                    </td>
                    <td className="td">{customerName(order.customerId)}</td>
                    <td className="td text-xs">{ORDER_TYPE_LABELS[order.type]}</td>
                    <td className="td"><OrderStatusPill status={order.status} /></td>
                    <td className="td text-xs">{order.deliveryDate ? formatDate(order.deliveryDate) : '—'}</td>
                    <td className="td text-right">
                      {order.status === 'inquiry' ? <span className="text-xs text-muted">Not quoted</span> : <Money cents={totals.totalCents} />}
                    </td>
                    <td className="td text-right">
                      {order.status === 'inquiry' || order.status === 'cancelled' ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={totals.balanceCents > 0 ? 'font-semibold text-clay-deep' : 'text-forest'}>
                          <Money cents={totals.balanceCents} />
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-2">
                        {canQuote && (
                          <Button size="sm" variant="outline" onClick={() => setQuoteOrder(order)}>
                            {order.status === 'inquiry' ? 'Quote' : 'Edit quote'}
                          </Button>
                        )}
                        {canManage && ORDER_FLOW[order.status].length > 0 && order.status !== 'inquiry' && (
                          <Link to={`/admin/orders/${order.id}`} className={buttonClasses('primary', 'sm')}>
                            Manage
                          </Link>
                        )}
                        {(order.status === 'inquiry' || !canManage) && (
                          <Link to={`/admin/orders/${order.id}`} className={buttonClasses('outline', 'sm')}>
                            Open
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Custom and organisational orders are never added to the regular product catalogue. Quotations,
        deposits and balances are tracked per order; a deposit never deducts finished-goods stock.
      </p>

      <CreateOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialType="custom"
        onCreated={(order) => setQuoteOrder(order)}
      />
      {quoteOrder && (
        <QuoteModal
          open={Boolean(quoteOrder)}
          onClose={() => setQuoteOrder(null)}
          order={quoteOrder}
        />
      )}
    </div>
  );
}
