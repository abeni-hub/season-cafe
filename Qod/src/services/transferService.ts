import type { LocationId, Transfer, TransferLine } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { nextCode, requirePositive, roundQty } from './helpers';
import { addMovement, itemName, requireStock } from './inventoryLedger';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export const TRANSFER_STATUS_LABELS: Record<Transfer['status'], string> = {
  requested: 'Requested',
  approved: 'Approved',
  dispatched: 'Dispatched',
  received: 'Received',
  cancelled: 'Cancelled',
};

export function listTransfers(): Transfer[] {
  return [...getDb().transfers].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export interface TransferInput {
  from: LocationId;
  to: LocationId;
  lines: TransferLine[];
  notes?: string;
}

export function createTransfer(input: TransferInput): Transfer {
  const actor = requirePermission('transfers.manage');
  if (input.from === input.to) throw new AppError('Source and destination must differ.');
  const lines = input.lines.filter((line) => line.itemId && line.quantity > 0);
  if (!lines.length) throw new AppError('Add at least one transfer line.');
  lines.forEach((line) => requirePositive(roundQty(line.quantity), 'Transfer quantities must be positive.'));

  return mutateDb(
    (draft) => {
      const seen = new Set<string>();
      lines.forEach((line) => {
        if (!draft.inventoryItems.some((item) => item.id === line.itemId)) {
          throw new AppError('A transfer line references an unknown item.');
        }
        if (seen.has(line.itemId)) throw new AppError('Each item may only appear once per transfer.');
        seen.add(line.itemId);
      });
      const transfer: Transfer = {
        id: uid('trf'),
        code: nextCode(draft, 'transfer', 'TRF'),
        from: input.from,
        to: input.to,
        lines: lines.map((line) => ({ itemId: line.itemId, quantity: roundQty(line.quantity) })),
        status: 'requested',
        notes: input.notes?.trim() || undefined,
        createdAt: nowIso(),
      };
      draft.transfers.push(transfer);
      draft.activity.unshift({
        id: uid('act'),
        message: `${transfer.code} requested (${input.from === 'cafe' ? 'Café' : 'Home Bakery'} → ${input.to === 'cafe' ? 'Café' : 'Home Bakery'}).`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return transfer;
    },
    undefined,
  );
}

function setStatus(transferId: string, next: Transfer['status'], actionLabel: string): Transfer {
  const actor = requirePermission('transfers.manage');
  return mutateDb(
    (draft) => {
      const transfer = draft.transfers.find((entry) => entry.id === transferId);
      if (!transfer) throw new AppError('Transfer not found.');

      if (next === 'approved' && transfer.status !== 'requested') {
        throw new AppError('Only requested transfers can be approved.');
      }
      if (next === 'dispatched') {
        if (transfer.status !== 'approved') throw new AppError('Approve the transfer before dispatching.');
        const already = draft.movements.some(
          (movement) => movement.refId === transfer.id && movement.reason === 'transfer_out',
        );
        if (already) throw new AppError('This transfer has already been dispatched.');
        transfer.lines.forEach((line) => {
          requireStock(draft, line.itemId, transfer.from, line.quantity, itemName(draft, line.itemId));
        });
        transfer.lines.forEach((line) => {
          addMovement(draft, {
            itemId: line.itemId,
            location: transfer.from,
            quantityDelta: -line.quantity,
            reason: 'transfer_out',
            refId: transfer.id,
            note: `${transfer.code} dispatched`,
            createdBy: actor.name,
          });
        });
        transfer.dispatchedAt = nowIso();
      }
      if (next === 'received') {
        if (transfer.status !== 'dispatched') throw new AppError('Only dispatched transfers can be received.');
        const already = draft.movements.some(
          (movement) => movement.refId === transfer.id && movement.reason === 'transfer_in',
        );
        if (already) throw new AppError('This transfer has already been received.');
        transfer.lines.forEach((line) => {
          addMovement(draft, {
            itemId: line.itemId,
            location: transfer.to,
            quantityDelta: line.quantity,
            reason: 'transfer_in',
            refId: transfer.id,
            note: `${transfer.code} received`,
            createdBy: actor.name,
          });
        });
        transfer.receivedAt = nowIso();
      }
      if (next === 'cancelled') {
        if (!['requested', 'approved'].includes(transfer.status)) {
          throw new AppError('Only transfers that have not been dispatched can be cancelled.');
        }
      }

      transfer.status = next;
      draft.activity.unshift({
        id: uid('act'),
        message: `${transfer.code} ${actionLabel}.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return transfer;
    },
    undefined,
  );
}

export function approveTransfer(id: string): Transfer {
  return setStatus(id, 'approved', 'approved');
}

export function dispatchTransfer(id: string): Transfer {
  return setStatus(id, 'dispatched', 'dispatched — stock moved out once');
}

export function receiveTransfer(id: string): Transfer {
  return setStatus(id, 'received', 'received — stock moved in once');
}

export function cancelTransfer(id: string): Transfer {
  return setStatus(id, 'cancelled', 'cancelled');
}
