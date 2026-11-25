import { HAS_REMOTE_API } from '@/config/brand';
import type { Order, OrderStatus, Payment } from '@/types/domain';
import { apiRequest } from '../api/client';
import { newIdempotencyKey, synced } from '../api/session';
import {
  cancelOrder as demoCancelOrder,
  createCustomInquiry as demoCreateCustomInquiry,
  createOrder as demoCreateOrder,
  createSale as demoCreateSale,
  saveQuotation as demoSaveQuotation,
  transitionOrder as demoTransitionOrder,
  type InquiryInput,
  type OrderDraft,
  type QuotationInput,
  type SaleInput,
  type SaleResult,
} from '../orderService';

export * from '../orderService';

export function createSale(input: SaleInput): SaleResult | Promise<SaleResult> {
  if (!HAS_REMOTE_API) return demoCreateSale(input);
  return (async () => {
    const idempotencyKey = newIdempotencyKey('pos');
    const customerId =
      input.customerId && !input.customerId.startsWith('c_') ? input.customerId : undefined;
    const result = await apiRequest<{ order: Order; payment?: Payment }>('/pos/sales/', {
      method: 'POST',
      idempotencyKey,
      body: {
        customerId,
        location: input.location,
        method: input.method,
        items: input.items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        idempotencyKey,
      },
    });
    if (!result.payment) {
      throw new Error('The API recorded the sale without returning its payment.');
    }
    return synced(`Sale ${result.order.code}`, { order: result.order, payment: result.payment });
  })();
}

export function createCustomInquiry(input: InquiryInput): Order | Promise<Order> {
  if (!HAS_REMOTE_API) return demoCreateCustomInquiry(input);
  return (async () => {
    const order = await apiRequest<Order>('/orders/inquiries/', {
      method: 'POST',
      auth: false,
      body: {
        contact: input.contact,
        type: input.type,
        description: input.description,
        deliveryDate: input.deliveryDate || undefined,
        occasion: input.occasion,
        servings: input.servings,
        budget: input.budget,
        notes: input.notes,
      },
    });
    return synced(`Enquiry ${order.code}`, order);
  })();
}

export function createOrder(draft: OrderDraft): Order | Promise<Order> {
  if (!HAS_REMOTE_API) return demoCreateOrder(draft);
  return (async () => {
    const order = await apiRequest<Order>('/orders/create/', {
      method: 'POST',
      body: {
        type: draft.type,
        customerId: draft.customerId,
        items: draft.items.map((line) => ({
          productId: line.productId || undefined,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
        location: draft.location,
        deliveryLocation: draft.deliveryLocation || undefined,
        deliveryDate: draft.deliveryDate || undefined,
        notes: draft.notes,
        status: draft.status,
      },
    });
    return synced(`Order ${order.code}`, order);
  })();
}

export function saveQuotation(orderId: string, input: QuotationInput): Order | Promise<Order> {
  if (!HAS_REMOTE_API) return demoSaveQuotation(orderId, input);
  return (async () => {
    const order = await apiRequest<Order>(`/orders/${orderId}/quotation/`, {
      method: 'POST',
      body: {
        items: input.items.map((line) => ({
          productId: line.productId || undefined,
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
        deliveryDate: input.deliveryDate || undefined,
        notes: input.notes,
      },
    });
    return synced(`Quotation for ${order.code}`, order);
  })();
}

export function transitionOrder(orderId: string, next: OrderStatus): Order | Promise<Order> {
  if (!HAS_REMOTE_API) return demoTransitionOrder(orderId, next);
  return (async () => {
    const order = await apiRequest<Order>(`/orders/${orderId}/transition/`, {
      method: 'POST',
      body: { status: next },
    });
    return synced(`${order.code} status`, order);
  })();
}

export function cancelOrder(orderId: string): Order | Promise<Order> {
  if (!HAS_REMOTE_API) return demoCancelOrder(orderId);
  return (async () => {
    const order = await apiRequest<Order>(`/orders/${orderId}/cancel/`, { method: 'POST' });
    return synced(`${order.code} cancellation`, order);
  })();
}
