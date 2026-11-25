import { HAS_REMOTE_API } from '@/config/brand';
import type { Payment } from '@/types/domain';
import { apiRequest } from '../api/client';
import { newIdempotencyKey, synced } from '../api/session';
import {
  recordPayment as demoRecordPayment,
  recordRefund as demoRecordRefund,
  type PaymentInput,
  type RefundInput,
} from '../paymentService';

export * from '../paymentService';

export function recordPayment(input: PaymentInput): Payment | Promise<Payment> {
  if (!HAS_REMOTE_API) return demoRecordPayment(input);
  return (async () => {
    const idempotencyKey = newIdempotencyKey('pay');
    const payment = await apiRequest<Payment>('/payments/record/', {
      method: 'POST',
      idempotencyKey,
      body: {
        orderId: input.orderId,
        amountCents: input.amountCents,
        method: input.method,
        note: input.note,
        location: input.location,
        idempotencyKey,
      },
    });
    return synced('Payment', payment);
  })();
}

export function recordRefund(input: RefundInput): Payment | Promise<Payment> {
  if (!HAS_REMOTE_API) return demoRecordRefund(input);
  return (async () => {
    const idempotencyKey = newIdempotencyKey('refund');
    const payment = await apiRequest<Payment>('/payments/refund/', {
      method: 'POST',
      idempotencyKey,
      body: {
        orderId: input.orderId,
        amountCents: input.amountCents,
        method: input.method,
        note: input.note,
        reason: input.reason,
        location: input.location,
        idempotencyKey,
      },
    });
    return synced('Refund', payment);
  })();
}
