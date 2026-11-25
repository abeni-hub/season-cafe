import { HAS_REMOTE_API } from '@/config/brand';
import type { Transfer } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import {
  approveTransfer as demoApproveTransfer,
  cancelTransfer as demoCancelTransfer,
  createTransfer as demoCreateTransfer,
  dispatchTransfer as demoDispatchTransfer,
  receiveTransfer as demoReceiveTransfer,
  type TransferInput,
} from '../transferService';

export * from '../transferService';

export function createTransfer(input: TransferInput): Transfer | Promise<Transfer> {
  if (!HAS_REMOTE_API) return demoCreateTransfer(input);
  return (async () => {
    const transfer = await apiRequest<Transfer>('/transfers/', {
      method: 'POST',
      body: {
        from: input.from,
        to: input.to,
        lines: input.lines,
        notes: input.notes,
      },
    });
    return synced(`Transfer ${transfer.code}`, transfer);
  })();
}

function action(id: string, endpoint: 'approve' | 'dispatch' | 'receive' | 'cancel'): Promise<Transfer> {
  return (async () => {
    const transfer = await apiRequest<Transfer>(`/transfers/${id}/${endpoint}/`, {
      method: 'POST',
    });
    return synced(`${transfer.code} ${endpoint}`, transfer);
  })();
}

export function approveTransfer(id: string): Transfer | Promise<Transfer> {
  return HAS_REMOTE_API ? action(id, 'approve') : demoApproveTransfer(id);
}

export function dispatchTransfer(id: string): Transfer | Promise<Transfer> {
  return HAS_REMOTE_API ? action(id, 'dispatch') : demoDispatchTransfer(id);
}

export function receiveTransfer(id: string): Transfer | Promise<Transfer> {
  return HAS_REMOTE_API ? action(id, 'receive') : demoReceiveTransfer(id);
}

export function cancelTransfer(id: string): Transfer | Promise<Transfer> {
  return HAS_REMOTE_API ? action(id, 'cancel') : demoCancelTransfer(id);
}
