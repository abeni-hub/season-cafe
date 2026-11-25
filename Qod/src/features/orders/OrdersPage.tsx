import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui/page';
import { Button, buttonClasses } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { TableShell } from '@/components/ui/table';
import { OrderStatusPill } from '@/components/shared/StatusPills';
import { Money } from '@/components/shared/Money';
import { useDb, usePermission } from '@/hooks/useStore';
import { listOrders, ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from '@/services/live/orderService';
import { orderTotals } from '@/services/orderMath';
import { customerName } from '@/services/live/customerService';
import { CreateOrderModal } from './OrderModals';
import type { OrderStatus, OrderType } from '@/types/domain';
import { formatDate } from '@/utils/date';
import { formatCents } from '@/utils/money';

export function OrdersPage() {
  const db = useDb();
  const canManage = usePermission('orders.manage');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [type, setType] = useState<'all' | OrderType>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const orders = listOrders();
  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        if (status !== 'all' && order.status !== status) return false;
        if (type !== 'all' && order.type !== type) return false;
        if (!query.trim()) return true;
        const needle = query.trim().toLowerCase();
        return (
          order.code.toLowerCase().includes(needle) ||
          customerName(order.customerId).toLowerCase().includes(needle) ||
          order.items.some((line) => line.description.toLowerCase().includes(needle))
        );
      }),
    [orders, status, type, query, db],
  );

  const openCount = orders.filter((order) => !['fulfilled', 'cancelled'].includes(order.status)).length;
  const outstanding = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Math.max(0, orderTotals(db, order).balanceCents), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description="Regular counter sales and quoted custom, bulk and organisational orders — each with its own payments, stock events and lifecycle."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New order
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Orders</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{orders.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Open</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{openCount}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Outstanding balances</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{formatCents(outstanding, db.settings.currency)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Search" htmlFor="orders-search" className="w-full sm:w-64">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              id="orders-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Code, customer, item"
              className="pl-9"
            />
          </div>
        </Field>
        <Field label="Status" htmlFor="orders-status" className="w-40">
          <Select id="orders-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All statuses</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Type" htmlFor="orders-type" className="w-44">
          <Select id="orders-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="all">All types</option>
            {Object.entries(ORDER_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No orders match these filters."
          description="Adjust the search or status filters, or record a new order."
        />
      ) : (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Customer</th>
                <th className="th">Type</th>
                <th className="th">Status</th>
                <th className="th">Delivery</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Balance</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const totals = orderTotals(db, order);
                return (
                  <tr key={order.id} className="transition-colors hover:bg-paper/40">
                    <td className="td">
                      <Link to={`/admin/orders/${order.id}`} className="font-semibold text-forest hover:underline">
                        {order.code}
                      </Link>
                      <p className="text-[11px] text-muted">{formatDate(order.createdAt)}</p>
                    </td>
                    <td className="td">
                      <p className="font-medium text-ink">{customerName(order.customerId)}</p>
                      <p className="text-[11px] capitalize text-muted">{order.source}</p>
                    </td>
                    <td className="td text-xs">{ORDER_TYPE_LABELS[order.type]}</td>
                    <td className="td"><OrderStatusPill status={order.status} /></td>
                    <td className="td text-xs">{order.deliveryDate ? formatDate(order.deliveryDate) : '—'}</td>
                    <td className="td text-right">{order.status === 'inquiry' ? '—' : <Money cents={totals.totalCents} />}</td>
                    <td className="td text-right">
                      {order.status === 'inquiry' || order.status === 'cancelled' ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={totals.balanceCents > 0 ? 'font-semibold text-clay-deep' : 'text-forest'}>
                          <Money cents={totals.balanceCents} />
                        </span>
                      )}
                    </td>
                    <td className="td text-right">
                      <Link to={`/admin/orders/${order.id}`} className={buttonClasses('outline', 'sm')}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <CreateOrderModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
