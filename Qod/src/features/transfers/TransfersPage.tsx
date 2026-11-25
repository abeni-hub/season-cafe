import { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { TransferStatusPill } from '@/components/shared/StatusPills';
import { useDb, usePermission } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import {
  approveTransfer,
  cancelTransfer,
  createTransfer,
  dispatchTransfer,
  listTransfers,
  receiveTransfer,
} from '@/services/live/transferService';
import { listInventoryItems, stockAt } from '@/services/live/inventoryService';
import type { LocationId, Transfer } from '@/types/domain';
import { formatDateTime } from '@/utils/date';
import { quantity } from '@/utils/money';

interface LineDraft {
  itemId: string;
  quantity: string;
}

export function TransfersPage() {
  const db = useDb();
  const toast = useToast();
  const canManage = usePermission('transfers.manage');
  const [createOpen, setCreateOpen] = useState(false);
  const transfers = listTransfers();
  const items = listInventoryItems();
  const locationName = (id: LocationId) => db.settings.locations.find((entry) => entry.id === id)?.name ?? id;

  const [draft, setDraft] = useState<{ from: LocationId; to: LocationId; notes: string; lines: LineDraft[] }>({
    from: 'home_bakery',
    to: 'cafe',
    notes: '',
    lines: [{ itemId: items[0]?.id ?? '', quantity: '' }],
  });

  const submit = async () => {
    try {
      await createTransfer({
        from: draft.from,
        to: draft.to,
        notes: draft.notes,
        lines: draft.lines
          .filter((line) => line.itemId && Number(line.quantity) > 0)
          .map((line) => ({ itemId: line.itemId, quantity: Number(line.quantity) })),
      });
      toast.success('Transfer requested. Stock moves only on dispatch.');
      setCreateOpen(false);
      setDraft((current) => ({ ...current, notes: '', lines: [{ itemId: items[0]?.id ?? '', quantity: '' }] }));
    } catch (error) {
      toast.error(error);
    }
  };

  const act = async (transfer: Transfer, action: 'approve' | 'dispatch' | 'receive' | 'cancel') => {
    try {
      if (action === 'approve') await approveTransfer(transfer.id);
      if (action === 'dispatch') await dispatchTransfer(transfer.id);
      if (action === 'receive') await receiveTransfer(transfer.id);
      if (action === 'cancel') await cancelTransfer(transfer.id);
      const messages = {
        approve: `${transfer.code} approved.`,
        dispatch: `${transfer.code} dispatched — stock left ${locationName(transfer.from)} once.`,
        receive: `${transfer.code} received — stock arrived at ${locationName(transfer.to)} once.`,
        cancel: `${transfer.code} cancelled.`,
      } as const;
      toast.success(messages[action]);
    } catch (error) {
      toast.error(error);
    }
  };

  const counts = {
    requested: transfers.filter((transfer) => transfer.status === 'requested').length,
    inTransit: transfers.filter((transfer) => transfer.status === 'dispatched').length,
    received: transfers.filter((transfer) => transfer.status === 'received').length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Stock transfers"
        description="Move stock between Home Bakery and Café with an explicit lifecycle. A transfer never creates or destroys stock."
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <ArrowLeftRight className="h-4 w-4" /> New transfer
            </Button>
          ) : undefined
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Awaiting approval</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{counts.requested}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">In transit</p>
          <p className="mt-1 font-display text-xl text-clay-deep">{counts.inTransit}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Received</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{counts.received}</p>
        </div>
      </div>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Transfer</th>
              <th className="th">Route</th>
              <th className="th">Contents</th>
              <th className="th">Status</th>
              <th className="th">Timeline</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id}>
                <td className="td font-medium text-ink">{transfer.code}</td>
                <td className="td text-xs">
                  {locationName(transfer.from)} → {locationName(transfer.to)}
                </td>
                <td className="td max-w-[280px] text-xs">
                  {transfer.lines.map((line) => {
                    const item = db.inventoryItems.find((entry) => entry.id === line.itemId);
                    return `${item?.name ?? 'Item'} × ${quantity(line.quantity)}${item ? ` ${item.unit}` : ''}`;
                  }).join(', ')}
                  {transfer.notes && <p className="text-[11px] text-muted">{transfer.notes}</p>}
                </td>
                <td className="td"><TransferStatusPill status={transfer.status} /></td>
                <td className="td text-[11px] text-muted">
                  <p>Requested {formatDateTime(transfer.createdAt)}</p>
                  {transfer.dispatchedAt && <p>Dispatched {formatDateTime(transfer.dispatchedAt)}</p>}
                  {transfer.receivedAt && <p>Received {formatDateTime(transfer.receivedAt)}</p>}
                </td>
                <td className="td text-right">
                  {canManage && (
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {transfer.status === 'requested' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => act(transfer, 'approve')}>
                            <ShieldCheck className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => act(transfer, 'cancel')}>Cancel</Button>
                        </>
                      )}
                      {transfer.status === 'approved' && (
                        <>
                          <Button size="sm" onClick={() => act(transfer, 'dispatch')}>
                            <Send className="h-3.5 w-3.5" /> Dispatch
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => act(transfer, 'cancel')}>Cancel</Button>
                        </>
                      )}
                      {transfer.status === 'dispatched' && (
                        <Button size="sm" onClick={() => act(transfer, 'receive')}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Receive
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Dispatch writes a single stock-out movement at the source. Receipt writes a single stock-in movement at
        the destination. Duplicate dispatch or receipt is rejected by the transfer service.
      </p>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New stock transfer"
        description="Availability is checked at dispatch, not at request."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Request transfer</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From" htmlFor="transfer-from">
              <Select id="transfer-from" value={draft.from} onChange={(e) => setDraft((current) => ({ ...current, from: e.target.value as LocationId }))}>
                {db.settings.locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="To" htmlFor="transfer-to">
              <Select id="transfer-to" value={draft.to} onChange={(e) => setDraft((current) => ({ ...current, to: e.target.value as LocationId }))}>
                {db.settings.locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="field-label">Items</p>
            <div className="space-y-2">
              {draft.lines.map((line, index) => {
                const available = line.itemId ? stockAt(line.itemId, draft.from) : 0;
                const item = items.find((entry) => entry.id === line.itemId);
                return (
                  <div key={index} className="grid grid-cols-12 items-center gap-2">
                    <div className="col-span-8">
                      <Select
                        aria-label={`Transfer line ${index + 1} item`}
                        value={line.itemId}
                        onChange={(e) =>
                          setDraft((current) => ({
                            ...current,
                            lines: current.lines.map((entry, i) => (i === index ? { ...entry, itemId: e.target.value } : entry)),
                          }))
                        }
                      >
                        {items.map((entry) => (
                          <option key={entry.id} value={entry.id}>{entry.name} ({entry.unit})</option>
                        ))}
                      </Select>
                      {item && <p className="mt-1 text-[10px] text-muted">{quantity(available)} {item.unit} available at {locationName(draft.from)}</p>}
                    </div>
                    <div className="col-span-3">
                      <Input
                        aria-label={`Transfer line ${index + 1} quantity`}
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
                    <div className="col-span-1 flex justify-end">
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
                );
              })}
            </div>
            <Button
              size="sm"
              variant="subtle"
              className="mt-2"
              onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, { itemId: items[0]?.id ?? '', quantity: '' }] }))}
            >
              Add item
            </Button>
          </div>

          <Field label="Notes" htmlFor="transfer-notes">
            <Textarea id="transfer-notes" value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
