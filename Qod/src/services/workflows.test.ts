import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDemoDatabase } from './demo/store';
import { DEMO_PASSWORD, login, logout } from './authService';
import { stockQty } from './inventoryLedger';
import { createSale, createOrder, createCustomInquiry, saveQuotation, transitionOrder } from './orderService';
import { orderTotals } from './orderMath';
import { recordPayment, recordRefund } from './paymentService';
import { adjustStock, stockAt } from './inventoryService';
import {
  createPurchaseOrder,
  receivePurchaseOrder,
} from './purchasingService';
import { advanceBatch, createBatch } from './productionService';
import {
  approveTransfer,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
} from './transferService';
import { createEmployee } from './employeeService';
import { recordExpense } from './expenseService';
import { customerOutstanding } from './orderMath';

function signIn(email: string) {
  logout();
  login(email, DEMO_PASSWORD);
}

function movementCount(refId: string, reason: string): number {
  return getDb().movements.filter((movement) => movement.refId === refId && movement.reason === reason).length;
}

beforeEach(() => {
  logout();
  resetDemoDatabase();
});

describe('POS journey', () => {
  it('records a sale, deducts finished stock once and keeps the payment final', () => {
    signIn('cashier@seasonscake.demo');
    const before = stockQty(getDb(), 'fin_mocha', 'cafe');
    const puffsBefore = stockQty(getDb(), 'fin_creampuff', 'cafe');

    const result = createSale({
      location: 'cafe',
      method: 'pos',
      items: [
        { productId: 'p_mocha', quantity: 2 },
        { productId: 'p_creampuff', quantity: 1 },
      ],
    });

    expect(result.order.status).toBe('fulfilled');
    expect(result.order.type).toBe('regular');
    expect(result.payment.amountCents).toBe(2 * 500_000 + 380_000);
    expect(result.payment.role).toBe('final');
    expect(stockQty(getDb(), 'fin_mocha', 'cafe')).toBe(before - 2);
    expect(stockQty(getDb(), 'fin_creampuff', 'cafe')).toBe(puffsBefore - 1);
    expect(movementCount(result.order.id, 'sale')).toBe(2);
    expect(orderTotals(getDb(), result.order).balanceCents).toBe(0);
  });

  it('refuses to sell more finished stock than is on hand at the chosen location', () => {
    signIn('cashier@seasonscake.demo');
    expect(() =>
      createSale({ location: 'home_bakery', method: 'cash', items: [{ productId: 'p_mille', quantity: 99 }] }),
    ).toThrow(/not enough/i);
  });

  it('rejects duplicate cart lines for the same product', () => {
    signIn('cashier@seasonscake.demo');
    expect(() =>
      createSale({
        location: 'cafe',
        method: 'cash',
        items: [
          { productId: 'p_mocha', quantity: 1 },
          { productId: 'p_mocha', quantity: 1 },
        ],
      }),
    ).toThrow(/once/);
  });
});

describe('custom order journey', () => {
  it('moves inquiry → quotation → deposit → production → ready → fulfilment → final payment', () => {
    signIn('manager@seasonscake.demo');

    const inquiry = createCustomInquiry({
      contact: { name: 'Journey Guest', kind: 'individual', email: 'journey@example.test' },
      type: 'custom',
      description: 'Two-tier celebration cake',
      deliveryDate: '2026-12-24',
    });
    expect(inquiry.status).toBe('inquiry');
    expect(inquiry.code.startsWith('INQ-')).toBe(true);

    saveQuotation(inquiry.id, {
      items: [{ description: 'Two-tier celebration cake', quantity: 1, unitPriceCents: 12_000_000 }],
      deliveryDate: '2026-12-24',
    });
    transitionOrder(inquiry.id, 'confirmed');

    const finishedBefore = stockQty(getDb(), 'fin_vanilla', 'home_bakery');
    const milkBefore = stockQty(getDb(), 'ing_milk', 'home_bakery');

    recordPayment({ orderId: inquiry.id, amountCents: 4_000_000, method: 'transfer' });
    expect(stockQty(getDb(), 'fin_vanilla', 'home_bakery')).toBe(finishedBefore);
    expect(stockQty(getDb(), 'ing_milk', 'home_bakery')).toBe(milkBefore);

    const batch = createBatch({
      productId: 'p_vanilla',
      recipeId: 'r_vanilla',
      orderId: inquiry.id,
      quantity: 8,
      location: 'home_bakery',
    });
    expect(batch.status).toBe('scheduled');
    expect(getDb().orders.find((entry) => entry.id === inquiry.id)?.status).toBe('in_production');

    advanceBatch(batch.id, 'in_production');
    advanceBatch(batch.id, 'quality_check');
    advanceBatch(batch.id, 'completed');

    expect(stockQty(getDb(), 'ing_milk', 'home_bakery')).toBeCloseTo(milkBefore - 2, 6);
    expect(stockQty(getDb(), 'fin_vanilla', 'home_bakery')).toBe(finishedBefore + 8);
    expect(movementCount(batch.id, 'production_output')).toBe(1);
    expect(movementCount(batch.id, 'production_consumption')).toBe(6);
    expect(getDb().orders.find((entry) => entry.id === inquiry.id)?.status).toBe('ready');

    transitionOrder(inquiry.id, 'fulfilled');
    const totalsBeforeFinal = orderTotals(getDb(), getDb().orders.find((entry) => entry.id === inquiry.id)!);
    expect(totalsBeforeFinal.balanceCents).toBe(8_000_000);

    const finalPayment = recordPayment({
      orderId: inquiry.id,
      amountCents: totalsBeforeFinal.balanceCents,
      method: 'card',
    });
    expect(finalPayment.role).toBe('final');
    const settled = getDb().orders.find((entry) => entry.id === inquiry.id)!;
    expect(orderTotals(getDb(), settled).balanceCents).toBe(0);
    expect(customerOutstanding(getDb(), inquiry.customerId)).toBe(0);
  });
});

describe('inventory journey', () => {
  it('receives goods, consumes ingredients, creates finished goods, transfers and sells without losing stock', () => {
    signIn('owner@seasonscake.demo');

    const flourBefore = stockAt('ing_flour', 'home_bakery');
    const purchase = createPurchaseOrder({
      supplierId: 'sup_aurora',
      lines: [{ itemId: 'ing_flour', quantity: 10, unitCostCents: 125_000 }],
    });
    expect(stockAt('ing_flour', 'home_bakery')).toBe(flourBefore);

    receivePurchaseOrder(purchase.id, { location: 'home_bakery', lines: [{ itemId: 'ing_flour', quantity: 10 }] });
    expect(stockAt('ing_flour', 'home_bakery')).toBeCloseTo(flourBefore + 10, 6);
    expect(movementCount(purchase.id, 'purchase_receipt')).toBe(1);
    expect(getDb().purchaseOrders.find((order) => order.id === purchase.id)?.status).toBe('received');

    const milkBefore = stockAt('ing_milk', 'home_bakery');
    const vanillaBefore = stockAt('fin_vanilla', 'home_bakery');
    const batch = createBatch({
      productId: 'p_vanilla',
      recipeId: 'r_vanilla',
      quantity: 8,
      location: 'home_bakery',
    });
    advanceBatch(batch.id, 'in_production');
    advanceBatch(batch.id, 'quality_check');
    advanceBatch(batch.id, 'completed');
    expect(stockAt('ing_milk', 'home_bakery')).toBeCloseTo(milkBefore - 2, 6);
    expect(stockAt('fin_vanilla', 'home_bakery')).toBe(vanillaBefore + 8);

    const transfer = createTransfer({
      from: 'home_bakery',
      to: 'cafe',
      lines: [{ itemId: 'fin_creampuff', quantity: 2 }],
    });
    const homePuffs = stockAt('fin_creampuff', 'home_bakery');
    const cafePuffs = stockAt('fin_creampuff', 'cafe');
    approveTransfer(transfer.id);
    dispatchTransfer(transfer.id);
    receiveTransfer(transfer.id);
    expect(stockAt('fin_creampuff', 'home_bakery')).toBe(homePuffs - 2);
    expect(stockAt('fin_creampuff', 'cafe')).toBe(cafePuffs + 2);
    expect(stockAt('fin_creampuff', 'home_bakery') + stockAt('fin_creampuff', 'cafe')).toBe(homePuffs + cafePuffs);
    expect(movementCount(transfer.id, 'transfer_out')).toBe(1);
    expect(movementCount(transfer.id, 'transfer_in')).toBe(1);
    expect(() => receiveTransfer(transfer.id)).toThrow();

    const vanillaCafe = stockAt('fin_vanilla', 'cafe');
    createSale({ location: 'cafe', method: 'card', items: [{ productId: 'p_vanilla', quantity: 2 }] });
    expect(stockAt('fin_vanilla', 'cafe')).toBe(vanillaCafe - 2);
  });

  it('conserves stock when a transfer is cancelled before dispatch', () => {
    signIn('inventory@seasonscake.demo');
    const before = stockAt('ing_strawberry', 'home_bakery');
    const transfer = createTransfer({
      from: 'home_bakery',
      to: 'cafe',
      lines: [{ itemId: 'ing_strawberry', quantity: 3 }],
    });
    expect(stockAt('ing_strawberry', 'home_bakery')).toBe(before);
    expect(() =>
      dispatchTransfer(transfer.id),
    ).toThrow(/approve/i);
    expect(stockAt('ing_strawberry', 'home_bakery')).toBe(before);
  });
});

describe('payment journey', () => {
  it('calculates deposit, partial, final payments and outstanding balance from order total', () => {
    signIn('manager@seasonscake.demo');
    const order = createOrder({
      type: 'custom',
      customerId: 'c_demo_ind',
      items: [{ description: 'Corporate gift cake', quantity: 1, unitPriceCents: 1_000_000, productId: 'p_vanilla' }],
      location: 'home_bakery',
      status: 'quoted',
    });
    const vanillaBefore = stockAt('fin_vanilla', 'home_bakery');

    const deposit = recordPayment({ orderId: order.id, amountCents: 300_000, method: 'transfer' });
    expect(deposit.role).toBe('deposit');
    expect(stockAt('fin_vanilla', 'home_bakery')).toBe(vanillaBefore);

    const partial = recordPayment({ orderId: order.id, amountCents: 300_000, method: 'cash' });
    expect(partial.role).toBe('partial');
    let totals = orderTotals(getDb(), getDb().orders.find((entry) => entry.id === order.id)!);
    expect(totals.balanceCents).toBe(400_000);

    expect(() => recordPayment({ orderId: order.id, amountCents: 500_000, method: 'cash' })).toThrow(/exceed/);

    const final = recordPayment({ orderId: order.id, amountCents: 400_000, method: 'card' });
    expect(final.role).toBe('final');
    totals = orderTotals(getDb(), getDb().orders.find((entry) => entry.id === order.id)!);
    expect(totals.balanceCents).toBe(0);

    expect(() => recordPayment({ orderId: order.id, amountCents: 1, method: 'cash' })).toThrow(/fully paid/);

    const refund = recordRefund({ orderId: order.id, amountCents: 100_000, method: 'transfer', reason: 'Goodwill' });
    expect(refund.kind).toBe('refund');
    totals = orderTotals(getDb(), getDb().orders.find((entry) => entry.id === order.id)!);
    expect(totals.refundedCents).toBe(100_000);
    expect(totals.balanceCents).toBe(100_000);
    expect(stockAt('fin_vanilla', 'home_bakery')).toBe(vanillaBefore);
  });

  it('reverses deducted stock exactly once when a fulfilled order is cancelled', () => {
    signIn('owner@seasonscake.demo');
    const order = createOrder({
      type: 'regular',
      customerId: 'c_demo_ind',
      items: [{ description: 'Mocha', quantity: 2, unitPriceCents: 500_000, productId: 'p_mocha' }],
      location: 'cafe',
      status: 'confirmed',
    });
    const before = stockAt('fin_mocha', 'cafe');
    transitionOrder(order.id, 'in_production');
    transitionOrder(order.id, 'ready');
    transitionOrder(order.id, 'fulfilled');
    expect(stockAt('fin_mocha', 'cafe')).toBe(before - 2);
    expect(movementCount(order.id, 'sale')).toBe(1);

    transitionOrder(order.id, 'cancelled');
    expect(stockAt('fin_mocha', 'cafe')).toBe(before);
    expect(movementCount(order.id, 'return')).toBe(1);
    expect(() => transitionOrder(order.id, 'cancelled')).toThrow();
    expect(movementCount(order.id, 'return')).toBe(1);
  });
});

describe('permission journey', () => {
  it('restricts cashiers from purchasing, inventory and staff administration', () => {
    signIn('cashier@seasonscake.demo');
    expect(() =>
      createPurchaseOrder({
        supplierId: 'sup_aurora',
        lines: [{ itemId: 'ing_flour', quantity: 1, unitCostCents: 120_000 }],
      }),
    ).toThrow(/does not allow/i);
    expect(() => adjustStock({ itemId: 'ing_flour', location: 'home_bakery', mode: 'add', quantity: 1, note: 'x' })).toThrow(/does not allow/i);
    expect(() =>
      recordExpense({
        category: 'other',
        amountCents: 1000,
        location: 'cafe',
        note: 'x',
        incurredAt: '2026-11-24',
      }),
    ).toThrow(/does not allow/i);
    expect(() =>
      createEmployee({ name: 'X', email: 'x@example.test', password: 'secret1', role: 'cashier' }),
    ).toThrow(/does not allow/i);

    expect(() =>
      createSale({ location: 'cafe', method: 'cash', items: [{ productId: 'p_mocha', quantity: 1 }] }),
    ).not.toThrow();
  });

  it('lets production staff advance batches but not sell or purchase', () => {
    signIn('production@seasonscake.demo');
    const batch = getDb().batches.find((entry) => entry.id === 'batch_7003')!;
    advanceBatch(batch.id, 'in_production');
    expect(getDb().batches.find((entry) => entry.id === batch.id)?.status).toBe('in_production');

    expect(() =>
      createSale({ location: 'cafe', method: 'cash', items: [{ productId: 'p_mocha', quantity: 1 }] }),
    ).toThrow(/does not allow/i);
    expect(() =>
      createPurchaseOrder({
        supplierId: 'sup_aurora',
        lines: [{ itemId: 'ing_flour', quantity: 1, unitCostCents: 120_000 }],
      }),
    ).toThrow(/does not allow/i);
  });

  it('lets inventory staff receive purchase orders but not create orders', () => {
    signIn('inventory@seasonscake.demo');
    const before = stockAt('ing_flour', 'home_bakery');
    receivePurchaseOrder('po_5001', { location: 'home_bakery', lines: [{ itemId: 'ing_flour', quantity: 50 }] });
    expect(stockAt('ing_flour', 'home_bakery')).toBeCloseTo(before + 50, 6);

    expect(() =>
      createOrder({
        type: 'regular',
        customerId: 'c_demo_ind',
        items: [{ description: 'Cake', quantity: 1, unitPriceCents: 1000 }],
        location: 'home_bakery',
        status: 'quoted',
      }),
    ).toThrow(/does not allow/i);
  });

  it('requires authentication before mutating data', () => {
    logout();
    expect(() =>
      recordPayment({ orderId: 'ord_bulk_2003', amountCents: 1000, method: 'cash' }),
    ).toThrow(/sign in/i);
  });
});
