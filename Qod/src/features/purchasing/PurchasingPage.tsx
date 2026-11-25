import { useMemo, useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell, Tabs } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { Money } from '@/components/shared/Money';
import { useDb, usePermission } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  listPurchaseOrders,
  listReceipts,
  listSuppliers,
  receivePurchaseOrder,
  receivedQuantities,
  recordSupplierPayment,
  supplierBalances,
} from '@/services/live/purchasingService';
import { listInventoryItems } from '@/services/live/inventoryService';
import type { LocationId, PaymentMethod, PurchaseOrder } from '@/types/domain';
import { dayOffset, formatDate, formatDateTime } from '@/utils/date';
import { formatCents, parseMoneyToCents, quantity } from '@/utils/money';

const poLabels: Record<PurchaseOrder['status'], { label: string; tone: 'neutral' | 'amber' | 'green' | 'red' }> = {
  ordered: { label: 'Ordered', tone: 'amber' },
  partially_received: { label: 'Partially received', tone: 'amber' },
  received: { label: 'Received', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

type TabKey = 'orders' | 'suppliers' | 'receipts';

interface DraftLine {
  itemId: string;
  quantity: string;
  cost: string;
}

export function PurchasingPage() {
  const db = useDb();
  const toast = useToast();
  const canManage = usePermission('purchasing.manage');
  const [tab, setTab] = useState<TabKey>('orders');
  const [createOpen, setCreateOpen] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [payingSupplierId, setPayingSupplierId] = useState<string | null>(null);

  const items = listInventoryItems().filter((item) => item.kind !== 'finished');
  const suppliers = listSuppliers();
  const orders = listPurchaseOrders();
  const receipts = listReceipts();
  const balances = supplierBalances();
  const currency = db.settings.currency;

  const poValue = (order: PurchaseOrder) =>
    order.lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0);

  const payables = balances.reduce((sum, row) => sum + Math.max(0, row.balanceCents), 0);
  const openCount = orders.filter((order) => ['ordered', 'partially_received'].includes(order.status)).length;
  const receivedValue = receipts.reduce(
    (sum, receipt) => sum + receipt.lines.reduce((lineSum, line) => lineSum + line.quantity * line.unitCostCents, 0),
    0,
  );

  const [draft, setDraft] = useState<{
    supplierId: string;
    expectedAt: string;
    notes: string;
    lines: DraftLine[];
  }>({
    supplierId: suppliers[0]?.id ?? '',
    expectedAt: dayOffset(3),
    notes: '',
    lines: [{ itemId: items[0]?.id ?? '', quantity: '', cost: '' }],
  });

  const [receiveForm, setReceiveForm] = useState<{ location: LocationId; lines: Record<string, string> }>({
    location: 'home_bakery',
    lines: {},
  });

  const [newSupplier, setNewSupplier] = useState({ name: '', contactName: '', phone: '', email: '', notes: '' });
  const [supplierPay, setSupplierPay] = useState({ amount: '', method: 'transfer' as PaymentMethod, note: '' });

  const openReceive = (order: PurchaseOrder) => {
    setReceiving(order);
    setReceiveForm({
      location: 'home_bakery',
      lines: Object.fromEntries(order.lines.map((line) => [line.itemId, ''])),
    });
  };

  const submitCreate = async () => {
    try {
      await createPurchaseOrder({
        supplierId: draft.supplierId,
        expectedAt: draft.expectedAt || undefined,
        notes: draft.notes,
        lines: draft.lines.map((line) => ({
          itemId: line.itemId,
          quantity: Number(line.quantity),
          unitCostCents: parseMoneyToCents(line.cost),
        })),
      });
      toast.success('Purchase order raised. Stock is unchanged until goods are received.');
      setCreateOpen(false);
      setDraft({
        supplierId: suppliers[0]?.id ?? '',
        expectedAt: dayOffset(3),
        notes: '',
        lines: [{ itemId: items[0]?.id ?? '', quantity: '', cost: '' }],
      });
    } catch (error) {
      toast.error(error);
    }
  };

  const remainingFor = useMemo(
    () => (order: PurchaseOrder) => {
      if (!receiving) return [];
      const received = receivedQuantities(order.id);
      return order.lines.map((line) => {
        const item = db.inventoryItems.find((entry) => entry.id === line.itemId);
        return {
          ...line,
          name: item?.name ?? 'Unknown',
          unit: item?.unit ?? '',
          remaining: Math.round((line.quantity - (received[line.itemId] ?? 0)) * 1000) / 1000,
        };
      });
    },
    [receiving, db],
  );

  const submitReceive = async () => {
    if (!receiving) return;
    try {
      const lines = Object.entries(receiveForm.lines)
        .map(([itemId, value]) => ({ itemId, quantity: Number(value) }))
        .filter((line) => line.quantity > 0);
      await receivePurchaseOrder(receiving.id, { location: receiveForm.location, lines });
      toast.success('Goods received. Inventory and weighted costs updated.');
      setReceiving(null);
    } catch (error) {
      toast.error(error);
    }
  };

  const cancelPo = async (order: PurchaseOrder) => {
    try {
      await cancelPurchaseOrder(order.id);
      toast.success(`${order.code} cancelled.`);
    } catch (error) {
      toast.error(error);
    }
  };

  const submitSupplier = async () => {
    try {
      await createSupplier(newSupplier);
      toast.success('Supplier added.');
      setSupplierOpen(false);
      setNewSupplier({ name: '', contactName: '', phone: '', email: '', notes: '' });
    } catch (error) {
      toast.error(error);
    }
  };

  const submitSupplierPayment = async () => {
    if (!payingSupplierId) return;
    try {
      await recordSupplierPayment({
        supplierId: payingSupplierId,
        amountCents: parseMoneyToCents(supplierPay.amount),
        method: supplierPay.method,
        note: supplierPay.note,
      });
      toast.success('Supplier payment recorded.');
      setPayingSupplierId(null);
      setSupplierPay({ amount: '', method: 'transfer', note: '' });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Purchasing"
        description="Raise purchase orders, receive goods against them, and track what is owed to suppliers."
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setSupplierOpen(true)}>New supplier</Button>
              <Button onClick={() => setCreateOpen(true)}>Raise purchase order</Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Open purchase orders</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{openCount}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Owed to suppliers</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{formatCents(payables, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Goods received (value)</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(receivedValue, currency)}</p>
        </div>
      </div>

      <Tabs<TabKey>
        items={[
          { key: 'orders', label: 'Purchase orders' },
          { key: 'suppliers', label: 'Suppliers & balances' },
          { key: 'receipts', label: 'Receipts' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'orders' && (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Order</th>
                <th className="th">Supplier</th>
                <th className="th">Raised</th>
                <th className="th">Expected</th>
                <th className="th">Status</th>
                <th className="th text-right">Value</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const supplier = suppliers.find((entry) => entry.id === order.supplierId);
                const status = poLabels[order.status];
                return (
                  <tr key={order.id}>
                    <td className="td font-medium text-ink">{order.code}</td>
                    <td className="td text-xs">{supplier?.name ?? '—'}</td>
                    <td className="td text-xs">{formatDate(order.createdAt)}</td>
                    <td className="td text-xs">{order.expectedAt ? formatDate(order.expectedAt) : '—'}</td>
                    <td className="td"><Pill tone={status.tone}>{status.label}</Pill></td>
                    <td className="td text-right font-medium"><Money cents={poValue(order)} /></td>
                    <td className="td text-right">
                      {canManage && ['ordered', 'partially_received'].includes(order.status) && (
                        <div className="flex justify-end gap-2">
                          {order.status === 'ordered' && (
                            <Button size="sm" variant="ghost" onClick={() => cancelPo(order)}>Cancel</Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openReceive(order)}>
                            <Truck className="h-3.5 w-3.5" /> Receive
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      {tab === 'suppliers' && (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Supplier</th>
                <th className="th">Contact</th>
                <th className="th text-right">Received value</th>
                <th className="th text-right">Paid</th>
                <th className="th text-right">Balance</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => (
                <tr key={row.supplier.id}>
                  <td className="td">
                    <p className="font-medium text-ink">{row.supplier.name}</p>
                    <p className="text-[11px] text-muted">{row.supplier.notes ?? '—'}</p>
                  </td>
                  <td className="td text-xs">
                    {row.supplier.contactName && <p>{row.supplier.contactName}</p>}
                    <p className="text-muted">{row.supplier.phone ?? row.supplier.email ?? '—'}</p>
                  </td>
                  <td className="td text-right text-xs"><Money cents={row.receivedCents} /></td>
                  <td className="td text-right text-xs"><Money cents={row.paidCents} /></td>
                  <td className="td text-right text-xs font-semibold"><Money cents={row.balanceCents} /></td>
                  <td className="td text-right">
                    {canManage && row.balanceCents > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setPayingSupplierId(row.supplier.id)}>
                        <PackageCheck className="h-3.5 w-3.5" /> Pay supplier
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}

      {tab === 'receipts' && (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Received</th>
                <th className="th">Purchase order</th>
                <th className="th">Supplier</th>
                <th className="th">Location</th>
                <th className="th">Lines</th>
                <th className="th text-right">Value</th>
                <th className="th">Received by</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => {
                const order = orders.find((entry) => entry.id === receipt.purchaseOrderId);
                const supplier = suppliers.find((entry) => entry.id === receipt.supplierId);
                return (
                  <tr key={receipt.id}>
                    <td className="td whitespace-nowrap text-xs">{formatDateTime(receipt.receivedAt)}</td>
                    <td className="td text-xs font-medium text-ink">{order?.code ?? '—'}</td>
                    <td className="td text-xs">{supplier?.name ?? '—'}</td>
                    <td className="td text-xs">{receipt.location === 'cafe' ? 'Café' : 'Home Bakery'}</td>
                    <td className="td text-xs">
                      {receipt.lines
                        .map((line) => `${db.inventoryItems.find((item) => item.id === line.itemId)?.name ?? 'Item'} × ${quantity(line.quantity)}`)
                        .join(', ')}
                    </td>
                    <td className="td text-right text-xs">
                      <Money cents={receipt.lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0)} />
                    </td>
                    <td className="td text-xs text-muted">{receipt.receivedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        A purchase order is a commitment, not stock. Physical inventory only increases when a receipt is
        recorded, and supplier balances are based on received value minus payments.
      </p>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Raise purchase order"
        description="Nothing is added to inventory until goods are received."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate}>Create order</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="po-supplier">
              <Select id="po-supplier" value={draft.supplierId} onChange={(e) => setDraft((current) => ({ ...current, supplierId: e.target.value }))}>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Expected date" htmlFor="po-expected">
              <Input id="po-expected" type="date" value={draft.expectedAt} onChange={(e) => setDraft((current) => ({ ...current, expectedAt: e.target.value }))} />
            </Field>
          </div>

          <div>
            <p className="field-label">Order lines</p>
            <div className="space-y-2">
              {draft.lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <Select
                      aria-label={`Line ${index + 1} item`}
                      value={line.itemId}
                      onChange={(e) => {
                        const item = items.find((entry) => entry.id === e.target.value);
                        setDraft((current) => ({
                          ...current,
                          lines: current.lines.map((entry, i) =>
                            i === index
                              ? { ...entry, itemId: e.target.value, cost: item ? (item.costPerUnitCents / 100).toString() : entry.cost }
                              : entry,
                          ),
                        }));
                      }}
                    >
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      aria-label={`Line ${index + 1} quantity`}
                      inputMode="decimal"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          lines: current.lines.map((entry, i) => (i === index ? { ...entry, quantity: e.target.value } : entry)),
                        }))
                      }
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      aria-label={`Line ${index + 1} unit cost`}
                      inputMode="decimal"
                      placeholder="Unit cost"
                      value={line.cost}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          lines: current.lines.map((entry, i) => (i === index ? { ...entry, cost: e.target.value } : entry)),
                        }))
                      }
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Remove line"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          lines: current.lines.length > 1 ? current.lines.filter((_, i) => i !== index) : current.lines,
                        }))
                      }
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="subtle"
              className="mt-2"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  lines: [...current.lines, { itemId: items[0]?.id ?? '', quantity: '', cost: '' }],
                }))
              }
            >
              Add line
            </Button>
          </div>

          <Field label="Notes" htmlFor="po-notes">
            <Textarea id="po-notes" value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(receiving)}
        onClose={() => setReceiving(null)}
        title={receiving ? `Receive ${receiving.code}` : 'Receive goods'}
        description="Enter only the quantities physically delivered. Weighted average cost is recalculated automatically."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReceiving(null)}>Cancel</Button>
            <Button onClick={submitReceive}>Record receipt</Button>
          </div>
        }
      >
        {receiving && (
          <div className="space-y-4">
            <Field label="Receiving location" htmlFor="receive-location">
              <Select id="receive-location" value={receiveForm.location} onChange={(e) => setReceiveForm((current) => ({ ...current, location: e.target.value as LocationId }))}>
                {db.settings.locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2">
              {remainingFor(receiving).map((line) => (
                <div key={line.itemId} className="flex items-center justify-between gap-3 rounded-xl border border-line/70 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{line.name}</p>
                    <p className="text-[11px] text-muted">
                      Remaining {quantity(line.remaining)} {line.unit} · {formatCents(line.unitCostCents, currency)}/{line.unit}
                    </p>
                  </div>
                  <Input
                    className="w-28"
                    aria-label={`Quantity received for ${line.name}`}
                    inputMode="decimal"
                    placeholder="0"
                    disabled={line.remaining <= 0}
                    value={receiveForm.lines[line.itemId] ?? ''}
                    onChange={(e) =>
                      setReceiveForm((current) => ({
                        ...current,
                        lines: { ...current.lines, [line.itemId]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        title="New supplier"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSupplierOpen(false)}>Cancel</Button>
            <Button onClick={submitSupplier}>Add supplier</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Supplier name" htmlFor="supplier-name" className="sm:col-span-2">
            <Input id="supplier-name" value={newSupplier.name} onChange={(e) => setNewSupplier((current) => ({ ...current, name: e.target.value }))} />
          </Field>
          <Field label="Contact person" htmlFor="supplier-contact">
            <Input id="supplier-contact" value={newSupplier.contactName} onChange={(e) => setNewSupplier((current) => ({ ...current, contactName: e.target.value }))} />
          </Field>
          <Field label="Phone" htmlFor="supplier-phone">
            <Input id="supplier-phone" value={newSupplier.phone} onChange={(e) => setNewSupplier((current) => ({ ...current, phone: e.target.value }))} />
          </Field>
          <Field label="Email" htmlFor="supplier-email">
            <Input id="supplier-email" value={newSupplier.email} onChange={(e) => setNewSupplier((current) => ({ ...current, email: e.target.value }))} />
          </Field>
          <Field label="Notes" htmlFor="supplier-notes">
            <Input id="supplier-notes" value={newSupplier.notes} onChange={(e) => setNewSupplier((current) => ({ ...current, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(payingSupplierId)}
        onClose={() => setPayingSupplierId(null)}
        title="Record supplier payment"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPayingSupplierId(null)}>Cancel</Button>
            <Button onClick={submitSupplierPayment}>Record payment</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Amount" htmlFor="supplier-amount">
            <Input id="supplier-amount" inputMode="decimal" value={supplierPay.amount} onChange={(e) => setSupplierPay((current) => ({ ...current, amount: e.target.value }))} />
          </Field>
          <Field label="Method" htmlFor="supplier-method">
            <Select id="supplier-method" value={supplierPay.method} onChange={(e) => setSupplierPay((current) => ({ ...current, method: e.target.value as PaymentMethod }))}>
              <option value="transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="pos">POS terminal</option>
            </Select>
          </Field>
          <Field label="Note" htmlFor="supplier-pay-note">
            <Input id="supplier-pay-note" value={supplierPay.note} onChange={(e) => setSupplierPay((current) => ({ ...current, note: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
