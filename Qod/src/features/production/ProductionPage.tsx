import { useState } from 'react';
import { AlertTriangle, ChefHat, FlaskConical } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { BatchStatusPill } from '@/components/shared/StatusPills';
import { ProductMedia } from '@/components/shared/ProductMedia';
import { useDb, usePermission } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import {
  BATCH_FLOW,
  BATCH_STATUS_LABELS,
  advanceBatch,
  createBatch,
  ingredientAvailability,
  listBatches,
} from '@/services/live/productionService';
import { listEmployees } from '@/services/live/employeeService';
import type { BatchStatus, LocationId, ProductionBatch } from '@/types/domain';
import { dayOffset, formatDate, isToday } from '@/utils/date';
import { quantity } from '@/utils/money';
import { cn } from '@/utils/cn';

const nextActionLabel: Partial<Record<BatchStatus, Record<string, string>>> = {
  pending: { scheduled: 'Schedule' },
  scheduled: { in_production: 'Start production' },
  in_production: { quality_check: 'Send to quality check' },
  quality_check: { completed: 'Complete & consume' },
  completed: { ready: 'Mark ready' },
  ready: {},
  cancelled: {},
};

export function ProductionPage() {
  const db = useDb();
  const toast = useToast();
  const canManage = usePermission('production.manage');
  const [createOpen, setCreateOpen] = useState(false);
  const batches = listBatches();
  const products = db.products.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const employees = listEmployees().filter((employee) => employee.isActive);
  const openOrders = db.orders.filter((order) => ['confirmed', 'in_production'].includes(order.status));

  const active = batches.filter((batch) =>
    ['pending', 'scheduled', 'in_production', 'quality_check'].includes(batch.status),
  );
  const awaitingQc = batches.filter((batch) => batch.status === 'quality_check').length;
  const ready = batches.filter((batch) => ['completed', 'ready'].includes(batch.status)).length;

  const [draft, setDraft] = useState<{
    title: string;
    productId: string;
    quantity: string;
    location: LocationId;
    scheduledFor: string;
    assignedEmployeeId: string;
    orderId: string;
    notes: string;
  }>({
    title: '',
    productId: products[0]?.id ?? '',
    quantity: '',
    location: 'home_bakery',
    scheduledFor: dayOffset(0),
    assignedEmployeeId: '',
    orderId: '',
    notes: '',
  });

  const submit = async () => {
    try {
      const recipe = db.recipes.find((entry) => entry.productId === draft.productId);
      await createBatch({
        title: draft.title,
        productId: draft.productId || undefined,
        recipeId: recipe?.id,
        quantity: Number(draft.quantity),
        location: draft.location,
        scheduledFor: draft.scheduledFor || undefined,
        assignedEmployeeId: draft.assignedEmployeeId || undefined,
        orderId: draft.orderId || undefined,
        notes: draft.notes,
      });
      toast.success('Production batch scheduled.');
      setCreateOpen(false);
      setDraft((current) => ({ ...current, title: '', quantity: '', notes: '', orderId: '' }));
    } catch (error) {
      toast.error(error);
    }
  };

  const advance = async (batch: ProductionBatch, next: BatchStatus) => {
    try {
      await advanceBatch(batch.id, next);
      if (next === 'completed') {
        toast.success(`${batch.code} completed — ingredients consumed and finished goods recorded.`);
      } else {
        toast.success(`${batch.code} → ${BATCH_STATUS_LABELS[next]}.`);
      }
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Production"
        description="A traceable batch lifecycle. Ingredients are consumed and finished goods created only at completion, as distinct ledger events."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <ChefHat className="h-4 w-4" /> Schedule batch
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Active batches</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{active.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Awaiting quality check</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{awaitingQc}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Completed / ready</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{ready}</p>
        </div>
      </div>

      <p className="mb-4 text-[11px] leading-relaxed text-muted">
        Lifecycle: Pending → Scheduled → In production → Quality check → Completed → Ready for fulfilment.
        Completion writes one consumption movement per recipe line and one finished-goods output movement.
      </p>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Batch</th>
              <th className="th">Product & quantity</th>
              <th className="th">Location</th>
              <th className="th">Scheduled</th>
              <th className="th">Status</th>
              <th className="th">Materials</th>
              <th className="th">Order</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const product = db.products.find((entry) => entry.id === batch.productId);
              const employee = employees.find((entry) => entry.id === batch.assignedEmployeeId);
              const order = db.orders.find((entry) => entry.id === batch.orderId);
              const availability = ingredientAvailability(batch);
              const shortages = availability.filter((entry) => entry.short);
              const next = BATCH_FLOW[batch.status];
              return (
                <tr key={batch.id} className="transition-colors hover:bg-paper/45">
                  <td className="td">
                    <p className="font-medium text-ink">{batch.code}</p>
                    <p className="text-[11px] text-muted">{batch.title}</p>
                    {employee && <p className="text-[11px] text-muted">{employee.name}</p>}
                  </td>
                  <td className="td text-xs">
                    <div className="flex items-center gap-2.5">
                      {product && (
                        <ProductMedia
                          slug={product.slug}
                          artIndex={product.artIndex}
                          name={product.name}
                          sizes="40px"
                          className="h-8 w-10 shrink-0 rounded-md border border-line"
                        />
                      )}
                      <div>
                        <span>{product ? product.name : 'Custom work'}</span>
                        <span className="block text-muted tabular-nums">{quantity(batch.quantity)} units</span>
                      </div>
                    </div>
                  </td>
                  <td className="td text-xs">{batch.location === 'cafe' ? 'Café' : 'Home Bakery'}</td>
                  <td className="td text-xs">
                    {batch.scheduledFor ? formatDate(batch.scheduledFor) : '—'}
                    {batch.scheduledFor && isToday(batch.scheduledFor) && (
                      <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-clay">Today</span>
                    )}
                  </td>
                  <td className="td"><BatchStatusPill status={batch.status} /></td>
                  <td className="td text-xs">
                    {availability.length === 0 ? (
                      <span className="text-muted">No recipe</span>
                    ) : shortages.length ? (
                      <span className="inline-flex items-center gap-1 text-[#8d2f24]">
                        <AlertTriangle className="h-3 w-3" /> {shortages.length} short
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-forest">
                        <FlaskConical className="h-3 w-3" /> Ready
                      </span>
                    )}
                  </td>
                  <td className="td text-xs">{order?.code ?? '—'}</td>
                  <td className="td text-right">
                    {canManage && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {next
                          .filter((status) => status !== 'cancelled')
                          .map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant={status === 'completed' ? 'primary' : 'outline'}
                              onClick={() => advance(batch, status)}
                            >
                              {nextActionLabel[batch.status]?.[status] ?? BATCH_STATUS_LABELS[status]}
                            </Button>
                          ))}
                        {['pending', 'scheduled', 'in_production', 'quality_check'].includes(batch.status) && (
                          <Button size="sm" variant="ghost" onClick={() => advance(batch, 'cancelled')}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Schedule production batch"
        description="Attach a product, quantity and recipe. Completion will consume ingredients exactly once."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Schedule batch</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product" htmlFor="batch-product" className="sm:col-span-2">
            <Select id="batch-product" value={draft.productId} onChange={(e) => setDraft((current) => ({ ...current, productId: e.target.value }))}>
              <option value="">Custom production (no catalogue product)</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Batch title" htmlFor="batch-title">
            <Input id="batch-title" value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} placeholder="e.g. Weekend vanilla run" />
          </Field>
          <Field label="Quantity" htmlFor="batch-qty">
            <Input id="batch-qty" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft((current) => ({ ...current, quantity: e.target.value }))} />
          </Field>
          <Field label="Location" htmlFor="batch-location">
            <Select id="batch-location" value={draft.location} onChange={(e) => setDraft((current) => ({ ...current, location: e.target.value as LocationId }))}>
              {db.settings.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Scheduled for" htmlFor="batch-date">
            <Input id="batch-date" type="date" value={draft.scheduledFor} onChange={(e) => setDraft((current) => ({ ...current, scheduledFor: e.target.value }))} />
          </Field>
          <Field label="Assigned to" htmlFor="batch-employee">
            <Select id="batch-employee" value={draft.assignedEmployeeId} onChange={(e) => setDraft((current) => ({ ...current, assignedEmployeeId: e.target.value }))}>
              <option value="">Unassigned</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Linked order" htmlFor="batch-order">
            <Select id="batch-order" value={draft.orderId} onChange={(e) => setDraft((current) => ({ ...current, orderId: e.target.value }))}>
              <option value="">No linked order</option>
              {openOrders.map((order) => (
                <option key={order.id} value={order.id}>{order.code}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="batch-notes" className="sm:col-span-2">
            <Textarea id="batch-notes" value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
          </Field>
        </div>
        {draft.productId && (
          <p className={cn('mt-3 rounded-xl px-3 py-2 text-[11px]', db.recipes.some((recipe) => recipe.productId === draft.productId) ? 'bg-forest-wash/70 text-forest-deep' : 'bg-clay-wash text-clay-deep')}>
            {db.recipes.some((recipe) => recipe.productId === draft.productId)
              ? 'A recipe is attached — completion will consume ingredients and create finished goods.'
              : 'No recipe for this product yet. Completion will create finished goods without consuming ingredients.'}
          </p>
        )}
      </Modal>
    </div>
  );
}
