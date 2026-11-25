import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  CreditCard,
  FileText,
  PackageCheck,
  PencilLine,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { TableShell } from '@/components/ui/table';
import { OrderStatusPill, BatchStatusPill } from '@/components/shared/StatusPills';
import { ConfirmModal } from '@/components/ui/confirm';
import { Money } from '@/components/shared/Money';
import { useDb, usePermission } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import {
  getOrder,
  listOrderPayments,
  ORDER_FLOW,
  ORDER_STATUS_LABELS,
  ORDER_TYPE_LABELS,
  transitionOrder,
} from '@/services/live/orderService';
import { orderTotals } from '@/services/orderMath';
import { getCustomer } from '@/services/live/customerService';
import { PaymentModal, QuoteModal } from './OrderModals';
import type { OrderStatus } from '@/types/domain';
import { formatDate, formatDateTime } from '@/utils/date';
import { cn } from '@/utils/cn';

const nextLabels: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm order',
  in_production: 'Start production',
  ready: 'Mark ready for fulfilment',
  fulfilled: 'Fulfil order',
};

const movementLabels: Record<string, string> = {
  sale: 'Sale deduction',
  return: 'Stock reversal',
  production_consumption: 'Production consumption',
  production_output: 'Production output',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
  purchase_receipt: 'Purchase receipt',
  opening: 'Opening balance',
};

export function OrderDetailPage() {
  const { orderId } = useParams();
  const db = useDb();
  const toast = useToast();
  const canManage = usePermission('orders.manage');
  const canPay = usePermission('payments.manage');
  const order = orderId ? getOrder(orderId) : undefined;
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-2xl text-forest-deep">Order not found</p>
        <Link to="/admin/orders" className="mt-2 inline-block text-sm text-forest hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  const totals = orderTotals(db, order);
  const customer = getCustomer(order.customerId);
  const payments = listOrderPayments(order.id);
  const batches = db.batches.filter((batch) => batch.orderId === order.id);
  const movements = db.movements.filter((movement) => movement.refId === order.id);
  const netPaid = totals.paidCents - totals.refundedCents;
  const nextStatuses = ORDER_FLOW[order.status].filter((status) => status !== 'cancelled' && status !== 'quoted');
  const canQuote = order.status === 'inquiry' || order.status === 'quoted';

  const changeStatus = async (next: OrderStatus) => {
    try {
      await transitionOrder(order.id, next);
      toast.success(`${order.code} moved to ${ORDER_STATUS_LABELS[next]}.`);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        backTo="/admin/orders"
        backLabel="Orders"
        eyebrow={`${ORDER_TYPE_LABELS[order.type]} · ${order.source.toUpperCase()}`}
        title={order.code}
        description={`Created ${formatDateTime(order.createdAt)} · ${db.settings.locations.find((loc) => loc.id === order.location)?.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusPill status={order.status} />
            {canManage && canQuote && (
              <Button variant="outline" onClick={() => setQuoteOpen(true)}>
                <PencilLine className="h-4 w-4" />
                {order.status === 'inquiry' ? 'Prepare quotation' : 'Edit quotation'}
              </Button>
            )}
            {canManage &&
              nextStatuses.map((next) => (
                <Button key={next} onClick={() => void changeStatus(next)}>
                  {nextLabels[next] ?? ORDER_STATUS_LABELS[next]}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ))}
            {canManage && order.status !== 'cancelled' && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-lg text-forest-deep">Items</h2>
              <p className="text-[11px] text-muted">{order.items.length} line{order.items.length === 1 ? '' : 's'}</p>
            </div>
            <TableShell className="rounded-none border-0">
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="th">Description</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Unit</th>
                    <th className="th text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((line) => (
                    <tr key={line.id}>
                      <td className="td font-medium text-ink">{line.description}</td>
                      <td className="td text-right">{line.quantity}</td>
                      <td className="td text-right"><Money cents={line.unitPriceCents} /></td>
                      <td className="td text-right font-medium"><Money cents={line.quantity * line.unitPriceCents} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/40 px-5 py-3 text-sm">
              <p className="text-muted">
                Outstanding balance = order total − valid payments (net of refunds).
              </p>
              <p className="font-display text-lg text-forest-deep">
                Total <Money cents={totals.totalCents} />
              </p>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-display text-lg text-forest-deep">Payments</h2>
              {canPay && order.status !== 'cancelled' && totals.totalCents > 0 && (
                <div className="flex gap-2">
                  {netPaid > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
                      Refund
                    </Button>
                  )}
                  {totals.balanceCents > 0 && (
                    <Button size="sm" onClick={() => setPaymentOpen(true)}>
                      <CreditCard className="h-3.5 w-3.5" /> Record payment
                    </Button>
                  )}
                </div>
              )}
            </div>
            {payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                No payments recorded. Deposits are financial events only and never deduct stock.
              </p>
            ) : (
              <TableShell className="rounded-none border-0">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Type</th>
                      <th className="th">Method</th>
                      <th className="th">Reference</th>
                      <th className="th text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="td text-xs">{formatDateTime(payment.createdAt)}</td>
                        <td className="td">
                          <span className={cn('text-xs font-semibold uppercase tracking-wide', payment.kind === 'refund' ? 'text-[#8d2f24]' : 'text-forest')}>
                            {payment.kind === 'refund' ? 'Refund' : payment.role}
                          </span>
                        </td>
                        <td className="td text-xs capitalize">{payment.method}</td>
                        <td className="td text-xs text-muted">{payment.note ?? '—'}</td>
                        <td className={cn('td text-right font-medium', payment.kind === 'refund' && 'text-[#8d2f24]')}>
                          {payment.kind === 'refund' ? '−' : ''}
                          <Money cents={payment.amountCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            )}
            <div className="grid grid-cols-3 gap-3 border-t border-line bg-paper/40 px-5 py-3 text-center text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Paid</p>
                <p className="mt-0.5 font-semibold text-ink"><Money cents={totals.paidCents} /></p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Refunded</p>
                <p className="mt-0.5 font-semibold text-ink"><Money cents={totals.refundedCents} /></p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Balance</p>
                <p className="mt-0.5 font-semibold text-clay-deep"><Money cents={totals.balanceCents} /></p>
              </div>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-lg text-forest-deep">Stock events for this order</h2>
              <p className="mt-0.5 text-[11px] text-muted">
                A fulfilment deducts finished goods once. Deposits and payments never appear here.
              </p>
            </div>
            {movements.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                No stock has moved for this order yet.
                {order.status !== 'fulfilled' && ' Stock will move at fulfilment.'}
              </p>
            ) : (
              <TableShell className="rounded-none border-0">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Item</th>
                      <th className="th">Reason</th>
                      <th className="th text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => {
                      const item = db.inventoryItems.find((entry) => entry.id === movement.itemId);
                      return (
                        <tr key={movement.id}>
                          <td className="td text-xs">{formatDateTime(movement.createdAt)}</td>
                          <td className="td text-xs">{item?.name ?? movement.itemId}</td>
                          <td className="td text-xs">{movementLabels[movement.reason] ?? movement.reason}</td>
                          <td className={cn('td text-right text-xs font-semibold', movement.quantityDelta < 0 ? 'text-[#8d2f24]' : 'text-forest')}>
                            {movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta} {item?.unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableShell>
            )}
          </section>

          {order.notes && (
            <section className="card px-5 py-4">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                <FileText className="h-3.5 w-3.5" /> Notes
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{order.notes}</p>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Customer</p>
            <p className="mt-2 font-display text-xl text-forest-deep">{customer?.name ?? 'Unknown'}</p>
            {customer?.organization && <p className="text-xs text-muted">{customer.organization}</p>}
            <div className="mt-3 space-y-1 text-xs text-muted">
              {customer?.phone && <p>{customer.phone}</p>}
              {customer?.email && <p>{customer.email}</p>}
              {customer?.address && <p>{customer.address}</p>}
              <p className="capitalize">{customer?.kind}</p>
            </div>
          </section>

          <section className="card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Fulfilment</p>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Production location</dt>
                <dd className="text-right font-medium text-ink">
                  {db.settings.locations.find((loc) => loc.id === order.location)?.name}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Delivery date</dt>
                <dd className="text-right font-medium text-ink">{order.deliveryDate ? formatDate(order.deliveryDate) : 'Not set'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last updated</dt>
                <dd className="text-right font-medium text-ink">{formatDate(order.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Production batches</p>
              <PackageCheck className="h-4 w-4 text-forest" />
            </div>
            {batches.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                No batch linked. Custom cakes can be produced as a custom batch from the Production module.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {batches.map((batch) => (
                  <li key={batch.id} className="rounded-xl border border-line bg-paper/50 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-ink">{batch.code}</p>
                      <BatchStatusPill status={batch.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{batch.title}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/admin/production"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"
            >
              <ChefHat className="h-3.5 w-3.5" /> Open production
            </Link>
          </section>

          {order.status === 'inquiry' && (
            <div className="flex gap-3 rounded-2xl border border-clay/25 bg-clay-wash px-4 py-3.5 text-xs leading-relaxed text-clay-deep">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                An inquiry is not revenue. Prepare a quotation with a value before it can be confirmed or
                have payments recorded.
              </p>
            </div>
          )}
        </aside>
      </div>

      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        order={order}
      />
      <PaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} order={order} mode="payment" />
      <PaymentModal open={refundOpen} onClose={() => setRefundOpen(false)} order={order} mode="refund" />
      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${order.code}?`}
        description="This cancels the order and reverses any stock deducted for it exactly once. Payments stay in the ledger; record a refund separately if money must be returned. Linked production batches that are not complete are cancelled."
        confirmLabel="Cancel order"
        onConfirm={() => {
          void (async () => {
            try {
              await transitionOrder(order.id, 'cancelled');
              toast.success(`${order.code} cancelled.`);
            } catch (error) {
              toast.error(error);
            }
          })();
        }}
      />
    </div>
  );
}
