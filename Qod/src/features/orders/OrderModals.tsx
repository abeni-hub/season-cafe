import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useDb } from '@/hooks/useStore';
import { listCustomers } from '@/services/live/customerService';
import { createOrder, ORDER_TYPE_LABELS, saveQuotation } from '@/services/live/orderService';
import { recordPayment, recordRefund } from '@/services/live/paymentService';
import { orderTotals } from '@/services/orderMath';
import type { LocationId, Order, OrderType, PaymentMethod } from '@/types/domain';
import { formatCents, parseMoneyToCents } from '@/utils/money';

interface LineDraft {
  description: string;
  quantity: string;
  price: string;
}

const emptyLine = (): LineDraft => ({ description: '', quantity: '1', price: '' });

function useLineDrafts(initial?: Array<{ description: string; quantity: number; priceCents: number }>) {
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.length
      ? initial.map((line) => ({
          description: line.description,
          quantity: String(line.quantity),
          price: (line.priceCents / 100).toString(),
        }))
      : [emptyLine()],
  );
  return { lines, setLines };
}

function lineTotalCents(lines: LineDraft[]): number {
  return lines.reduce((sum, line) => {
    const price = parseMoneyToCents(line.price || 0);
    const qty = Number(line.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum;
    return sum + price * qty;
  }, 0);
}

function LineEditor({
  lines,
  setLines,
}: {
  lines: LineDraft[];
  setLines: React.Dispatch<React.SetStateAction<LineDraft[]>>;
}) {
  const update = (index: number, patch: Partial<LineDraft>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };
  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-[1fr_64px_96px_32px] items-start gap-2">
          <Input
            aria-label={`Line ${index + 1} description`}
            placeholder="Description or item"
            value={line.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <Input
            aria-label={`Line ${index + 1} quantity`}
            inputMode="numeric"
            placeholder="Qty"
            value={line.quantity}
            onChange={(e) => update(index, { quantity: e.target.value })}
          />
          <Input
            aria-label={`Line ${index + 1} unit price`}
            inputMode="decimal"
            placeholder="Unit price"
            value={line.price}
            onChange={(e) => update(index, { price: e.target.value })}
          />
          <button
            type="button"
            onClick={() => setLines((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current))}
            className="mt-2 rounded-lg p-1 text-muted hover:text-[#8d2f24]"
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLines((current) => [...current, emptyLine()])}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Add line
      </button>
    </div>
  );
}

export function CreateOrderModal({
  open,
  onClose,
  onCreated,
  initialType = 'custom',
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (order: Order) => void;
  initialType?: OrderType;
}) {
  const db = useDb();
  const toast = useToast();
  const customers = listCustomers();
  const { lines, setLines } = useLineDrafts();
  const [type, setType] = useState<OrderType>(initialType);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 'c_walkin');
  const [location, setLocation] = useState<LocationId>('home_bakery');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const currency = db.settings.currency;
  const total = lineTotalCents(lines);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setLines([emptyLine()]);
      setNotes('');
      setDeliveryDate('');
      setCustomerId(customers[0]?.id ?? 'c_walkin');
    }
  }, [open, initialType]);

  const submit = async () => {
    try {
      const order = await createOrder({
        type,
        customerId,
        location,
        deliveryLocation: location,
        deliveryDate: deliveryDate || undefined,
        notes,
        status: 'quoted',
        items: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unitPriceCents: parseMoneyToCents(line.price),
        })),
      });
      toast.success(`${order.code} created.`);
      onCreated?.(order);
      onClose();
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New order"
      description="Custom, bulk and organisational orders are quoted, never mixed into the seven-product catalogue."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Total <span className="font-semibold text-ink">{formatCents(total, currency)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit}>Create order</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Order type" htmlFor="order-type">
            <Select id="order-type" value={type} onChange={(e) => setType(e.target.value as OrderType)}>
              {Object.entries(ORDER_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Customer" htmlFor="order-customer">
            <Select id="order-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Production location" htmlFor="order-location">
            <Select id="order-location" value={location} onChange={(e) => setLocation(e.target.value as LocationId)}>
              {db.settings.locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Delivery date" htmlFor="order-delivery">
            <Input id="order-delivery" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Order lines" hint="Prices are recorded in the workspace currency; integer minor units are used internally.">
          <LineEditor lines={lines} setLines={setLines} />
        </Field>
        <Field label="Notes" htmlFor="order-notes">
          <Textarea id="order-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Specification, delivery, invoicing notes…" />
        </Field>
      </div>
    </Modal>
  );
}

export function QuoteModal({
  open,
  onClose,
  order,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  onSaved?: (order: Order) => void;
}) {
  const db = useDb();
  const toast = useToast();
  const { lines, setLines } = useLineDrafts(
    order.items.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      priceCents: line.unitPriceCents,
    })),
  );
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryDate ?? '');
  const [notes, setNotes] = useState(order.notes ?? '');
  const total = lineTotalCents(lines);

  useEffect(() => {
    if (open) {
      setLines(
        order.items.map((line) => ({
          description: line.description,
          quantity: String(line.quantity),
          price: (line.unitPriceCents / 100).toString(),
        })),
      );
      setDeliveryDate(order.deliveryDate ?? '');
      setNotes(order.notes ?? '');
    }
  }, [open, order.id]);

  const submit = async () => {
    try {
      const saved = await saveQuotation(order.id, {
        items: lines.map((line) => ({
          description: line.description,
          quantity: Number(line.quantity),
          unitPriceCents: parseMoneyToCents(line.price),
        })),
        deliveryDate: deliveryDate || undefined,
        notes,
      });
      toast.success(`Quotation saved for ${saved.code}.`);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Prepare quotation · ${order.code}`}
      description="A quotation is not revenue. Deposits are recorded separately after the order is confirmed."
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Quotation total <span className="font-semibold text-ink">{formatCents(total, db.settings.currency)}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit}>Save quotation</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Quotation lines">
          <LineEditor lines={lines} setLines={setLines} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Delivery date" htmlFor="quote-date">
            <Input id="quote-date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
          <Field label="Quotation status">
            <div className="rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-sm text-muted">
              Saving marks the order <span className="font-semibold text-ink">Quoted</span>.
            </div>
          </Field>
        </div>
        <Field label="Notes" htmlFor="quote-notes">
          <Textarea id="quote-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export function PaymentModal({
  open,
  onClose,
  order,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  order: Order;
  mode: 'payment' | 'refund';
}) {
  const db = useDb();
  const toast = useToast();
  const totals = orderTotals(db, order);
  const netPaid = totals.paidCents - totals.refundedCents;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [note, setNote] = useState('');
  const suggested = mode === 'payment' ? totals.balanceCents : netPaid;

  useEffect(() => {
    if (open) {
      setAmount(suggested > 0 ? (suggested / 100).toString() : '');
      setNote('');
      setMethod('transfer');
    }
  }, [open, suggested]);

  const submit = async () => {
    try {
      const amountCents = parseMoneyToCents(amount);
      if (mode === 'payment') {
        await recordPayment({ orderId: order.id, amountCents, method, note });
        toast.success('Payment recorded. Stock was not affected.');
      } else {
        await recordRefund({ orderId: order.id, amountCents, method, note, reason: note });
        toast.success('Refund recorded.');
      }
      onClose();
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'payment' ? `Record payment · ${order.code}` : `Record refund · ${order.code}`}
      description={
        mode === 'payment'
          ? 'Deposits and partial payments are financial events only — they never deduct stock.'
          : 'Refunds reverse collected cash; stock is only adjusted through an explicit return or cancellation.'
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={mode === 'payment' ? 'primary' : 'danger'} onClick={submit}>
            {mode === 'payment' ? 'Record payment' : 'Record refund'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-paper/60 p-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Total</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{formatCents(totals.totalCents, db.settings.currency)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Net paid</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{formatCents(netPaid, db.settings.currency)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.1em] text-muted">Balance</p>
            <p className="mt-0.5 text-sm font-semibold text-clay-deep">{formatCents(totals.balanceCents, db.settings.currency)}</p>
          </div>
        </div>
        <Field label="Amount" htmlFor="pay-amount">
          <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="pos">POS terminal</option>
          </Select>
        </Field>
        <Field label={mode === 'refund' ? 'Reason / note' : 'Note'} htmlFor="pay-note">
          <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reference or description" />
        </Field>
      </div>
    </Modal>
  );
}
