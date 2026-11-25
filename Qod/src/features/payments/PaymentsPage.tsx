import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReceiptText, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { Tabs, TableShell } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { customerName } from '@/services/live/customerService';
import { listPayments } from '@/services/live/paymentService';
import { formatDateTime } from '@/utils/date';
import { formatCents } from '@/utils/money';
import { cn } from '@/utils/cn';

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Bank transfer',
  card: 'Card',
  pos: 'POS terminal',
};

const roleTones = {
  deposit: 'blue',
  partial: 'amber',
  final: 'green',
  refund: 'red',
} as const;

type TabKey = 'all' | 'payments' | 'refunds';

export function PaymentsPage() {
  const db = useDb();
  const [tab, setTab] = useState<TabKey>('all');
  const [method, setMethod] = useState('all');
  const payments = listPayments();

  const netCollected = payments.reduce(
    (sum, payment) => sum + (payment.kind === 'payment' ? payment.amountCents : -payment.amountCents),
    0,
  );
  const refunded = payments
    .filter((payment) => payment.kind === 'refund')
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  const rows = useMemo(
    () =>
      payments.filter((payment) => {
        if (tab === 'payments' && payment.kind !== 'payment') return false;
        if (tab === 'refunds' && payment.kind !== 'refund') return false;
        if (method !== 'all' && payment.method !== method) return false;
        return true;
      }),
    [payments, tab, method],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Payments"
        description="Every customer deposit, instalment, final payment and refund. Financial events never move stock."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Net collected</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(netCollected, db.settings.currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Refunds issued</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{formatCents(refunded, db.settings.currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Total entries</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{payments.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs<TabKey>
          items={[
            { key: 'all', label: 'All entries' },
            { key: 'payments', label: 'Payments' },
            { key: 'refunds', label: 'Refunds' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Field label="Method" htmlFor="payment-method" className="w-44">
          <Select id="payment-method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">All methods</option>
            {Object.entries(methodLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">When</th>
              <th className="th">Order</th>
              <th className="th">Customer</th>
              <th className="th">Role</th>
              <th className="th">Method</th>
              <th className="th">Location</th>
              <th className="th text-right">Amount</th>
              <th className="th">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => {
              const order = db.orders.find((entry) => entry.id === payment.orderId);
              return (
                <tr key={payment.id} className="transition-colors hover:bg-paper/45">
                  <td className="td whitespace-nowrap text-xs">{formatDateTime(payment.createdAt)}</td>
                  <td className="td text-xs">
                    {order ? (
                      <Link to={`/admin/orders/${order.id}`} className="font-medium text-forest underline-offset-2 hover:underline">
                        {order.code}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td text-xs">{customerName(payment.customerId)}</td>
                  <td className="td">
                    <Pill tone={roleTones[payment.role]}>
                      {payment.kind === 'refund' ? 'Refund' : payment.role.charAt(0).toUpperCase() + payment.role.slice(1)}
                    </Pill>
                  </td>
                  <td className="td text-xs">{methodLabels[payment.method] ?? payment.method}</td>
                  <td className="td text-xs">{payment.location === 'cafe' ? 'Café' : 'Home Bakery'}</td>
                  <td className={cn('td text-right font-medium', payment.kind === 'refund' ? 'text-[#8d2f24]' : 'text-forest')}>
                    <span className="inline-flex items-center gap-1">
                      {payment.kind === 'refund' ? <RotateCcw className="h-3 w-3" /> : <ReceiptText className="h-3 w-3" />}
                      {payment.kind === 'refund' ? '−' : ''}
                      <Money cents={payment.amountCents} />
                    </span>
                  </td>
                  <td className="td max-w-[240px] text-xs text-muted">{payment.note ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Outstanding balance is always recalculated as order total minus valid payments. Deposits are shown
        separately and are not treated as completed sales.
      </p>
    </div>
  );
}
