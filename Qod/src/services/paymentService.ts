import type { LocationId, Payment, PaymentKind, PaymentMethod, PaymentRole } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requirePositive } from './helpers';
import { orderTotals } from './orderMath';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export interface PaymentInput {
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  note?: string;
  location?: LocationId;
}

export interface RefundInput extends PaymentInput {
  reason?: string;
}

export function listPayments(): Payment[] {
  return [...getDb().payments].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function listPaymentsForOrder(orderId: string): Payment[] {
  return listPayments().filter((payment) => payment.orderId === orderId);
}

function insertPayment(
  kind: PaymentKind,
  role: PaymentRole,
  input: PaymentInput,
  message: string,
): Payment {
  const actor = requirePermission('payments.manage');
  requirePositive(input.amountCents, 'Enter an amount greater than zero.');
  if (!Number.isInteger(input.amountCents)) throw new AppError('Amounts must be recorded in whole minor units.');

  return mutateDb(
    (draft) => {
      const order = draft.orders.find((entry) => entry.id === input.orderId);
      if (!order) throw new AppError('Order not found.');
      if (order.status === 'cancelled') throw new AppError('Payments cannot be recorded on a cancelled order.');

      const totals = orderTotals(draft, order);
      if (totals.totalCents <= 0) {
        throw new AppError('Prepare a quotation before recording payments.');
      }
      if (kind === 'payment') {
        if (totals.balanceCents <= 0) throw new AppError('This order is already fully paid.');
        if (input.amountCents > totals.balanceCents) {
          throw new AppError('The payment cannot exceed the outstanding balance.');
        }
      } else {
        const netPaid = totals.paidCents - totals.refundedCents;
        if (netPaid <= 0) throw new AppError('There are no payments to refund.');
        if (input.amountCents > netPaid) {
          throw new AppError('The refund cannot exceed the net amount paid on this order.');
        }
      }

      const payment: Payment = {
        id: uid('pay'),
        orderId: order.id,
        customerId: order.customerId,
        kind,
        role,
        method: input.method,
        amountCents: input.amountCents,
        location: input.location ?? order.location,
        note: input.note?.trim() || undefined,
        createdAt: nowIso(),
      };
      draft.payments.push(payment);
      draft.activity.unshift({
        id: uid('act'),
        message: `${message} on ${order.code}. Financial event only — no stock movement.`,
        actor: actor.name,
        createdAt: payment.createdAt,
      });
      return payment;
    },
    undefined,
  );
}

export function recordPayment(input: PaymentInput): Payment {
  const totals = (() => {
    const order = getDb().orders.find((entry) => entry.id === input.orderId);
    return order ? orderTotals(getDb(), order) : null;
  })();
  if (!totals) throw new AppError('Order not found.');
  const netPaid = totals.paidCents - totals.refundedCents;
  let role: PaymentRole = 'partial';
  if (netPaid <= 0) role = 'deposit';
  else if (input.amountCents >= totals.balanceCents) role = 'final';
  return insertPayment('payment', role, input, `${role === 'deposit' ? 'Deposit' : 'Payment'} recorded`);
}

export function recordRefund(input: RefundInput): Payment {
  return insertPayment(
    'refund',
    'refund',
    { ...input, note: input.reason ?? input.note },
    'Refund recorded',
  );
}

export function paymentSummary(orderId: string): { paid: number; refunded: number; balance: number } {
  const order = getDb().orders.find((entry) => entry.id === orderId);
  if (!order) return { paid: 0, refunded: 0, balance: 0 };
  const totals = orderTotals(getDb(), order);
  return { paid: totals.paidCents, refunded: totals.refundedCents, balance: totals.balanceCents };
}
