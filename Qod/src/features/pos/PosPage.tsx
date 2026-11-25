import { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  ReceiptText,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { ProductArt } from '@/components/shared/ProductArt';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { HAS_REMOTE_API } from '@/config/brand';
import { useToast } from '@/components/ui/toast';
import {
  availableProductStock,
  createSale,
  listOrders,
  listOrderPayments,
  walkInCustomer,
  type SaleResult,
} from '@/services/live/orderService';
import { listCustomers, customerName } from '@/services/live/customerService';
import type { LocationId, PaymentMethod } from '@/types/domain';
import { formatDateTime } from '@/utils/date';
import { cn } from '@/utils/cn';
import { centsToInput, formatCents, parseMoneyToCents } from '@/utils/money';

const methods: Array<{ key: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'transfer', label: 'Transfer', icon: Wallet },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'pos', label: 'POS terminal', icon: Smartphone },
];

export function PosPage() {
  const db = useDb();
  const toast = useToast();
  const customers = listCustomers();
  const products = db.products.filter((product) => product.isAvailable);
  const walkIn = walkInCustomer();
  const [location, setLocation] = useState<LocationId>('cafe');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState(walkIn?.id ?? '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [receipt, setReceipt] = useState<SaleResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lines = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({
          product,
          quantity: cart[product.id],
          stock: availableProductStock(product.id, location),
        })),
    [products, cart, location],
  );
  const totalCents = lines.reduce((sum, line) => sum + line.quantity * line.product.priceCents, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const tenderedCents = tendered.trim() ? parseMoneyToCents(tendered) : Number.NaN;
  const changeCents = Number.isFinite(tenderedCents) ? tenderedCents - totalCents : 0;
  const tenderedShort = method === 'cash' && Number.isFinite(tenderedCents) && tenderedCents < totalCents;

  const recentSales = listOrders()
    .filter((order) => order.source === 'pos')
    .slice(0, 6);

  const add = (productId: string) => {
    const stock = availableProductStock(productId, location);
    const current = cart[productId] ?? 0;
    if (current >= stock) {
      toast.push('No more of this product is available at the selected location.', 'error');
      return;
    }
    setCart((value) => ({ ...value, [productId]: current + 1 }));
  };

  const setQuantity = (productId: string, quantity: number) => {
    const stock = availableProductStock(productId, location);
    const clamped = Math.max(0, Math.min(quantity, stock));
    setCart((value) => {
      const next = { ...value };
      if (clamped === 0) delete next[productId];
      else next[productId] = clamped;
      return next;
    });
  };

  const completeSale = async () => {
    if (!lines.length) {
      toast.push('Add at least one product to the sale.', 'error');
      return;
    }
    if (tenderedShort) {
      toast.push('The amount tendered is less than the total.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createSale({
        customerId,
        location,
        method,
        items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      });
      setReceipt(result);
      setCart({});
      setTendered('');
      toast.success(`Sale ${result.order.code} completed.`);
    } catch (error) {
      toast.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Point of sale"
        title="Counter sales"
        description="Regular products only. A completed sale records payment and deducts finished goods once, at the selected location."
        actions={
          <div className="flex rounded-xl border border-line bg-cream p-1">
            {db.settings.locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  setLocation(loc.id);
                  setCart({});
                }}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  location === loc.id ? 'bg-forest text-cream' : 'text-muted hover:text-ink',
                )}
              >
                {loc.name}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const stock = availableProductStock(product.id, location);
              const inCart = cart[product.id] ?? 0;
              const disabled = stock <= 0 || inCart >= stock;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => add(product.id)}
                  disabled={disabled}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border border-line bg-cream text-left transition-all',
                    disabled ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:shadow-soft',
                  )}
                >
                  <ProductArt artIndex={product.artIndex} className="aspect-[16/10] w-full" />
                  {inCart > 0 && (
                    <span className="absolute right-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-forest px-1.5 text-xs font-bold text-cream">
                      {inCart}
                    </span>
                  )}
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug text-ink">{product.name}</p>
                      <p className="whitespace-nowrap text-xs font-semibold text-clay">
                        <Money cents={product.priceCents} />
                      </p>
                    </div>
                    <p className={cn('mt-1.5 text-[10px] font-medium', stock <= 0 ? 'text-[#8d2f24]' : 'text-muted')}>
                      {stock <= 0 ? 'Out of stock here' : `${stock} in stock at ${location === 'cafe' ? 'Café' : 'Home Bakery'}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg text-forest-deep">Recent counter sales</h2>
              <span className="text-[11px] text-muted">Latest {recentSales.length}</span>
            </div>
            <TableShell>
              <table className="table-base">
                <thead>
                  <tr>
                    <th className="th">Sale</th>
                    <th className="th">Customer</th>
                    <th className="th">Items</th>
                    <th className="th">Method</th>
                    <th className="th text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((order) => {
                    const payment = listOrderPayments(order.id).find((entry) => entry.kind === 'payment');
                    const units = order.items.reduce((sum, line) => sum + line.quantity, 0);
                    return (
                      <tr key={order.id}>
                        <td className="td">
                          <p className="font-semibold text-forest">{order.code}</p>
                          <p className="text-[11px] text-muted">{formatDateTime(order.createdAt)}</p>
                        </td>
                        <td className="td">{customerName(order.customerId)}</td>
                        <td className="td">{units}</td>
                        <td className="td capitalize">{payment?.method ?? '—'}</td>
                        <td className="td text-right font-medium">
                          <Money cents={order.items.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          </div>
        </section>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-line bg-forest-deep px-5 py-4 text-cream">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cream/60">
                <ReceiptText className="h-3.5 w-3.5" /> Current sale
              </p>
              <p className="mt-1 font-display text-2xl text-cream">
                <Money cents={totalCents} />
              </p>
              <p className="text-[11px] text-cream/50">{itemCount} item{itemCount === 1 ? '' : 's'} · {location === 'cafe' ? 'Café' : 'Home Bakery'}</p>
            </div>
            <div className="space-y-4 p-5">
              <Field label="Customer" htmlFor="pos-customer">
                <Select id="pos-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value={walkIn?.id ?? ''}>Walk-in customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}{customer.organization ? ` — ${customer.organization}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <div>
                <p className="field-label">Cart</p>
                {lines.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-paper/50 px-3.5 py-6 text-center text-xs text-muted">
                    Select a product to start the sale.
                  </p>
                ) : (
                  <ul className="divide-y divide-line/70">
                    {lines.map((line) => (
                      <li key={line.product.id} className="flex items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{line.product.name}</p>
                          <p className="text-[11px] text-muted">
                            <Money cents={line.product.priceCents} /> each
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                            className="rounded-md border border-line p-1 text-muted hover:bg-paper"
                            aria-label={`Reduce ${line.product.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                            disabled={line.quantity >= line.stock}
                            className="rounded-md border border-line p-1 text-muted hover:bg-paper disabled:opacity-40"
                            aria-label={`Add ${line.product.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuantity(line.product.id, 0)}
                            className="ml-1 rounded-md p-1 text-muted hover:text-[#8d2f24]"
                            aria-label={`Remove ${line.product.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="field-label">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  {methods.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setMethod(entry.key)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors',
                        method === entry.key
                          ? 'border-forest bg-forest-wash text-forest-deep'
                          : 'border-line bg-white/60 text-muted hover:border-forest/20',
                      )}
                    >
                      <entry.icon className="h-3.5 w-3.5" />
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              {method === 'cash' && (
                <Field label="Amount tendered (optional)" htmlFor="tendered" error={tenderedShort ? 'Less than the total due.' : undefined}>
                  <Input
                    id="tendered"
                    inputMode="decimal"
                    placeholder={centsToInput(totalCents)}
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                  {!tenderedShort && Number.isFinite(tenderedCents) && tenderedCents >= totalCents && (
                    <p className="text-xs font-medium text-forest">
                      Change due {formatCents(changeCents, db.settings.currency)}
                    </p>
                  )}
                </Field>
              )}

              <div className="rounded-xl bg-paper/70 px-3.5 py-3 text-[11px] leading-relaxed text-muted">
                Payment is recorded in full at completion. Finished-goods stock is deducted once and cannot be
                deducted twice for this order.
              </div>

              <Button className="w-full" size="lg" onClick={() => void completeSale()} disabled={!lines.length || submitting}>
                {submitting ? 'Recording sale…' : <>Complete sale · <Money cents={totalCents} /></>}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={Boolean(receipt)}
        onClose={() => setReceipt(null)}
        title={receipt ? `Receipt ${receipt.order.code}` : 'Receipt'}
        description="Sale completed and paid in full."
        size="sm"
        footer={
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            <Button onClick={() => setReceipt(null)}>
              New sale <CheckCircle2 className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {receipt && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-dashed border-line pb-3">
              <div>
                <p className="font-script text-2xl text-forest-deep">Seasons cake</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                  {receipt.order.location === 'cafe' ? 'Café counter' : 'Home Bakery'} · {formatDateTime(receipt.order.createdAt)}
                </p>
              </div>
              <p className="text-right text-xs text-muted">
                Customer<br />
                <span className="font-medium text-ink">{customerName(receipt.order.customerId)}</span>
              </p>
            </div>
            <ul className="space-y-1.5">
              {receipt.order.items.map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">
                    {line.quantity} × {line.description}
                  </span>
                  <Money cents={line.quantity * line.unitPriceCents} />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line pt-3 font-display text-lg text-forest-deep">
              <span>Total paid</span>
              <Money cents={receipt.payment.amountCents} />
            </div>
            <p className="text-center text-[11px] uppercase tracking-[0.14em] text-muted">
              Paid by {receipt.payment.method} · Balance {formatCents(0, db.settings.currency)}
            </p>
            <p className="text-center text-[10px] text-muted">
              {HAS_REMOTE_API
                ? 'Recorded in the live ledger. Stock deducted once for this sale.'
                : 'Demo receipt. Stock deducted once for this sale.'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
