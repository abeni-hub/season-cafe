import { useMemo, useState } from 'react';
import { AlertTriangle, PackagePlus, Search, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Tabs, TableShell } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { useDb, usePermission } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import {
  adjustStock,
  createInventoryItem,
  listInventoryItems,
  listLowStock,
  listMovements,
  listStockRows,
} from '@/services/live/inventoryService';
import type { ItemKind, LocationId, Unit } from '@/types/domain';
import { formatDateTime } from '@/utils/date';
import { formatCents, parseMoneyToCents, quantity } from '@/utils/money';
import { cn } from '@/utils/cn';

const reasonLabels: Record<string, string> = {
  opening: 'Opening balance',
  purchase_receipt: 'Purchase receipt',
  production_consumption: 'Production consumption',
  production_output: 'Production output',
  sale: 'Sale',
  return: 'Stock reversal',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
};

const kindLabels: Record<ItemKind, string> = {
  raw: 'Raw material',
  packaging: 'Packaging',
  finished: 'Finished good',
};

type TabKey = 'stock' | 'movements';

export function InventoryPage() {
  const db = useDb();
  const toast = useToast();
  const canManage = usePermission('inventory.manage');
  const [tab, setTab] = useState<TabKey>('stock');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | ItemKind>('all');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);

  const rows = listStockRows();
  const movements = listMovements(150);
  const lowStock = listLowStock();
  const items = listInventoryItems();
  const currency = db.settings.currency;

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind !== 'all' && row.item.kind !== kind) return false;
      if (!needle) return true;
      return row.item.name.toLowerCase().includes(needle) || row.item.sku.toLowerCase().includes(needle);
    });
  }, [rows, query, kind]);

  const stockValue = rows.reduce((sum, row) => sum + row.total * row.item.costPerUnitCents, 0);

  const [adjust, setAdjust] = useState({
    itemId: items[0]?.id ?? '',
    location: 'home_bakery' as LocationId,
    mode: 'add' as 'add' | 'remove' | 'wastage',
    quantity: '',
    note: '',
  });
  const [newItem, setNewItem] = useState({
    name: '',
    kind: 'raw' as 'raw' | 'packaging',
    unit: 'kg' as Unit,
    cost: '',
    reorderLevel: '',
  });

  const submitAdjust = async () => {
    try {
      await adjustStock({
        itemId: adjust.itemId,
        location: adjust.location,
        mode: adjust.mode,
        quantity: Number(adjust.quantity),
        note: adjust.note,
      });
      toast.success('Stock movement recorded.');
      setAdjustOpen(false);
      setAdjust((current) => ({ ...current, quantity: '', note: '' }));
    } catch (error) {
      toast.error(error);
    }
  };

  const submitNewItem = async () => {
    try {
      await createInventoryItem({
        name: newItem.name,
        kind: newItem.kind,
        unit: newItem.unit,
        costPerUnitCents: parseMoneyToCents(newItem.cost),
        reorderLevel: Number(newItem.reorderLevel || 0),
      });
      toast.success('Material added.');
      setNewItemOpen(false);
      setNewItem({ name: '', kind: 'raw', unit: 'kg', cost: '', reorderLevel: '' });
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Inventory"
        description="Raw materials, packaging and finished goods, tracked per location. Every change is a ledger movement."
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => setNewItemOpen(true)}>
                <PackagePlus className="h-4 w-4" /> New material
              </Button>
              <Button onClick={() => setAdjustOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" /> Adjust stock
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Stock value at cost</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(stockValue, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Tracked materials</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{items.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Below reorder level</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{lowStock.length}</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-clay/25 bg-clay-wash px-4 py-3 text-xs text-clay-deep">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Low stock:</span>{' '}
            {lowStock.slice(0, 5).map((row) => `${row.item.name} (${quantity(row.total)} ${row.item.unit})`).join(', ')}
            {lowStock.length > 5 ? ` and ${lowStock.length - 5} more` : ''}. Receiving goods or recording an adjustment updates the ledger.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Search" htmlFor="inventory-search" className="w-full sm:w-64">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input id="inventory-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or SKU" />
          </div>
        </Field>
        <Field label="Category" htmlFor="inventory-kind" className="w-44">
          <Select id="inventory-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">All categories</option>
            <option value="raw">Raw materials</option>
            <option value="packaging">Packaging</option>
            <option value="finished">Finished goods</option>
          </Select>
        </Field>
      </div>

      <Tabs<TabKey>
        items={[
          { key: 'stock', label: 'Stock levels' },
          { key: 'movements', label: 'Movement ledger' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'stock' ? (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Material</th>
                <th className="th">Category</th>
                <th className="th text-right">Home Bakery</th>
                <th className="th text-right">Café</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Reorder at</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.item.id} className={cn('transition-colors hover:bg-paper/40', row.low && 'bg-clay-wash/25')}>
                  <td className="td">
                    <p className="font-medium text-ink">{row.item.name}</p>
                    <p className="text-[11px] text-muted">{row.item.sku} · {formatCents(row.item.costPerUnitCents, currency)}/{row.item.unit}</p>
                  </td>
                  <td className="td"><Pill tone={row.item.kind === 'finished' ? 'green' : row.item.kind === 'packaging' ? 'blue' : 'neutral'}>{kindLabels[row.item.kind]}</Pill></td>
                  <td className="td text-right">{quantity(row.byLocation.home_bakery)} {row.item.unit}</td>
                  <td className="td text-right">{quantity(row.byLocation.cafe)} {row.item.unit}</td>
                  <td className="td text-right font-semibold text-ink">{quantity(row.total)} {row.item.unit}</td>
                  <td className="td text-right text-xs">{row.item.reorderLevel} {row.item.unit}</td>
                  <td className="td">
                    <Pill tone={row.low ? 'amber' : 'outline'}>{row.low ? 'Low' : 'OK'}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      ) : (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">Item</th>
                <th className="th">Location</th>
                <th className="th">Reason</th>
                <th className="th text-right">Change</th>
                <th className="th">Note</th>
                <th className="th">By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => {
                const item = db.inventoryItems.find((entry) => entry.id === movement.itemId);
                return (
                  <tr key={movement.id} className="transition-colors hover:bg-paper/45">
                    <td className="td whitespace-nowrap text-xs">{formatDateTime(movement.createdAt)}</td>
                    <td className="td text-xs font-medium text-ink">{item?.name ?? 'Unknown'}</td>
                    <td className="td text-xs">{movement.location === 'cafe' ? 'Café' : 'Home Bakery'}</td>
                    <td className="td text-xs">{reasonLabels[movement.reason] ?? movement.reason}</td>
                    <td className={cn('td text-right text-xs font-semibold', movement.quantityDelta < 0 ? 'text-[#8d2f24]' : 'text-forest')}>
                      {movement.quantityDelta > 0 ? '+' : ''}{quantity(movement.quantityDelta)} {item?.unit}
                    </td>
                    <td className="td max-w-[280px] text-xs text-muted">{movement.note ?? '—'}</td>
                    <td className="td text-xs text-muted">{movement.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Stock is never a single undifferentiated quantity: every receipt, adjustment, transfer, sale and
        production event is recorded against a specific location and time.
      </p>

      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust stock"
        description="Record an explicit movement. Removing stock without a reason is discouraged — use wastage where appropriate."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={submitAdjust}>Record movement</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Item" htmlFor="adjust-item" className="sm:col-span-2">
            <Select id="adjust-item" value={adjust.itemId} onChange={(e) => setAdjust((current) => ({ ...current, itemId: e.target.value }))}>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
              ))}
            </Select>
          </Field>
          <Field label="Location" htmlFor="adjust-location">
            <Select id="adjust-location" value={adjust.location} onChange={(e) => setAdjust((current) => ({ ...current, location: e.target.value as LocationId }))}>
              {db.settings.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reason" htmlFor="adjust-mode">
            <Select id="adjust-mode" value={adjust.mode} onChange={(e) => setAdjust((current) => ({ ...current, mode: e.target.value as typeof adjust.mode }))}>
              <option value="add">Add stock</option>
              <option value="remove">Remove stock</option>
              <option value="wastage">Record wastage</option>
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="adjust-qty">
            <Input id="adjust-qty" inputMode="decimal" value={adjust.quantity} onChange={(e) => setAdjust((current) => ({ ...current, quantity: e.target.value }))} />
          </Field>
          <Field label="Note" htmlFor="adjust-note" className="sm:col-span-2">
            <Textarea id="adjust-note" value={adjust.note} onChange={(e) => setAdjust((current) => ({ ...current, note: e.target.value }))} placeholder="What caused this movement?" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={newItemOpen}
        onClose={() => setNewItemOpen(false)}
        title="New material"
        description="Finished goods are created through production, not here."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNewItemOpen(false)}>Cancel</Button>
            <Button onClick={submitNewItem}>Add material</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="material-name" className="sm:col-span-2">
            <Input id="material-name" value={newItem.name} onChange={(e) => setNewItem((current) => ({ ...current, name: e.target.value }))} />
          </Field>
          <Field label="Category" htmlFor="material-kind">
            <Select id="material-kind" value={newItem.kind} onChange={(e) => setNewItem((current) => ({ ...current, kind: e.target.value as 'raw' | 'packaging' }))}>
              <option value="raw">Raw material</option>
              <option value="packaging">Packaging</option>
            </Select>
          </Field>
          <Field label="Unit" htmlFor="material-unit">
            <Select id="material-unit" value={newItem.unit} onChange={(e) => setNewItem((current) => ({ ...current, unit: e.target.value as Unit }))}>
              {['kg', 'g', 'l', 'ml', 'pcs'].map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cost per unit" htmlFor="material-cost">
            <Input id="material-cost" inputMode="decimal" value={newItem.cost} onChange={(e) => setNewItem((current) => ({ ...current, cost: e.target.value }))} />
          </Field>
          <Field label="Reorder level" htmlFor="material-reorder">
            <Input id="material-reorder" inputMode="decimal" value={newItem.reorderLevel} onChange={(e) => setNewItem((current) => ({ ...current, reorderLevel: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
