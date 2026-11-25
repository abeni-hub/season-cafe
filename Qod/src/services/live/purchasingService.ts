import { HAS_REMOTE_API } from '@/config/brand';
import type {
  PurchaseOrder,
  PurchaseReceipt,
  Supplier,
  SupplierPayment,
} from '@/types/domain';
import { apiRequest } from '../api/client';
import { newIdempotencyKey, synced } from '../api/session';
import {
  cancelPurchaseOrder as demoCancelPurchaseOrder,
  createPurchaseOrder as demoCreatePurchaseOrder,
  createSupplier as demoCreateSupplier,
  receivePurchaseOrder as demoReceivePurchaseOrder,
  recordSupplierPayment as demoRecordSupplierPayment,
  type PurchaseOrderInput,
  type ReceiveInput,
  type SupplierInput,
  type SupplierPaymentInput,
} from '../purchasingService';

export * from '../purchasingService';

export function createSupplier(input: SupplierInput): Supplier | Promise<Supplier> {
  if (!HAS_REMOTE_API) return demoCreateSupplier(input);
  return (async () => {
    const supplier = await apiRequest<Supplier>('/suppliers/', { method: 'POST', body: input });
    return synced(`Supplier ${supplier.name}`, supplier);
  })();
}

export function createPurchaseOrder(input: PurchaseOrderInput): PurchaseOrder | Promise<PurchaseOrder> {
  if (!HAS_REMOTE_API) return demoCreatePurchaseOrder(input);
  return (async () => {
    const order = await apiRequest<PurchaseOrder>('/purchase-orders/', {
      method: 'POST',
      body: {
        supplierId: input.supplierId,
        lines: input.lines,
        expectedAt: input.expectedAt || undefined,
        notes: input.notes,
      },
    });
    return synced(`Purchase order ${order.code}`, order);
  })();
}

export function receivePurchaseOrder(
  poId: string,
  input: ReceiveInput,
): PurchaseReceipt | Promise<PurchaseReceipt> {
  if (!HAS_REMOTE_API) return demoReceivePurchaseOrder(poId, input);
  return (async () => {
    const receipt = await apiRequest<PurchaseReceipt>(`/purchase-orders/${poId}/receive/`, {
      method: 'POST',
      body: input,
    });
    return synced('Goods receipt', receipt);
  })();
}

export function cancelPurchaseOrder(poId: string): PurchaseOrder | Promise<PurchaseOrder> {
  if (!HAS_REMOTE_API) return demoCancelPurchaseOrder(poId);
  return (async () => {
    const order = await apiRequest<PurchaseOrder>(`/purchase-orders/${poId}/cancel/`, {
      method: 'POST',
    });
    return synced(`Cancellation of ${order.code}`, order);
  })();
}

export function recordSupplierPayment(
  input: SupplierPaymentInput,
): SupplierPayment | Promise<SupplierPayment> {
  if (!HAS_REMOTE_API) return demoRecordSupplierPayment(input);
  return (async () => {
    const idempotencyKey = newIdempotencyKey('supplier-payment');
    const payment = await apiRequest<SupplierPayment>('/supplier-payments/', {
      method: 'POST',
      idempotencyKey,
      body: { ...input, idempotencyKey },
    });
    return synced('Supplier payment', payment);
  })();
}
