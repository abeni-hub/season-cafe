import type { Database, Order } from '@/types/domain';
import { roundQty } from './helpers';

export interface OrderTotals {
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  balanceCents: number;
}

export function orderTotalCents(order: Pick<Order, 'items'>): number {
  return order.items.reduce(
    (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
    0,
  );
}

export function orderTotals(db: Database, order: Order): OrderTotals {
  const related = db.payments.filter((payment) => payment.orderId === order.id);
  const paidCents = related
    .filter((payment) => payment.kind === 'payment')
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const refundedCents = related
    .filter((payment) => payment.kind === 'refund')
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const totalCents = orderTotalCents(order);
  return {
    totalCents,
    paidCents,
    refundedCents,
    balanceCents: totalCents - (paidCents - refundedCents),
  };
}

export function customerOutstanding(db: Database, customerId: string): number {
  return db.orders
    .filter((order) => order.customerId === customerId && order.status !== 'cancelled')
    .reduce((sum, order) => {
      const totals = orderTotals(db, order);
      return sum + Math.max(0, totals.balanceCents);
    }, 0);
}

export function summarizeBatchQuantity(quantity: number): string {
  return roundQty(quantity).toString();
}
