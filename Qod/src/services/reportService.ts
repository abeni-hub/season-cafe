import type { Order, Payment } from '@/types/domain';
import { getDb } from './demo/store';
import { customerOutstanding, orderTotals } from './orderMath';
import { listLowStock } from './inventoryService';
import { stockQty } from './inventoryLedger';
import { formatDayLabel, isoDate, lastNDays, startOfDayMs } from '@/utils/date';

function netCollected(payments: Payment[], fromMs: number, toMs = Date.now()): number {
  return payments
    .filter((payment) => {
      const at = new Date(payment.createdAt).getTime();
      return at >= fromMs && at <= toMs;
    })
    .reduce((sum, payment) => sum + (payment.kind === 'payment' ? payment.amountCents : -payment.amountCents), 0);
}

function openOrders(orders: Order[]): Order[] {
  return orders.filter((order) =>
    ['inquiry', 'quoted', 'confirmed', 'in_production', 'ready'].includes(order.status),
  );
}

export interface DashboardSummary {
  todayCollectedCents: number;
  last30CollectedCents: number;
  outstandingCents: number;
  pendingOrders: number;
  todayOrdersCount: number;
  activeBatches: number;
  lowStockCount: number;
  recentOrders: Order[];
  recentActivity: Array<{ id: string; message: string; actor: string; createdAt: string }>;
}

export function dashboardSummary(): DashboardSummary {
  const db = getDb();
  const startToday = startOfDayMs();
  const start30 = startOfDayMs(new Date(Date.now() - 29 * 86400000));
  const outstandingCents = db.orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Math.max(0, orderTotals(db, order).balanceCents), 0);

  return {
    todayCollectedCents: netCollected(db.payments, startToday),
    last30CollectedCents: netCollected(db.payments, start30),
    outstandingCents,
    pendingOrders: openOrders(db.orders).length,
    todayOrdersCount: db.orders.filter(
      (order) => new Date(order.createdAt).getTime() >= startToday,
    ).length,
    activeBatches: db.batches.filter((batch) =>
      ['pending', 'scheduled', 'in_production', 'quality_check'].includes(batch.status),
    ).length,
    lowStockCount: listLowStock().length,
    recentOrders: [...db.orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6),
    recentActivity: db.activity.slice(0, 7),
  };
}

export interface SalesPoint {
  date: string;
  label: string;
  collectedCents: number;
  ordersCount: number;
}

export function salesSeries(days: number): SalesPoint[] {
  const db = getDb();
  const dates = lastNDays(days);
  return dates.map((date) => ({
    date,
    label: formatDayLabel(date),
    collectedCents: netCollected(
      db.payments.filter((payment) => isoDate(payment.createdAt) === date),
      0,
    ),
    ordersCount: db.orders.filter(
      (order) => isoDate(order.createdAt) === date && order.status !== 'inquiry',
    ).length,
  }));
}

export interface ProductPerformanceRow {
  name: string;
  quantity: number;
  revenueCents: number;
}

export function productPerformance(days: number, limit = 7): ProductPerformanceRow[] {
  const db = getDb();
  const cutoff = startOfDayMs(new Date(Date.now() - (days - 1) * 86400000));
  const map = new Map<string, ProductPerformanceRow>();
  db.orders
    .filter(
      (order) =>
        order.status === 'fulfilled' && new Date(order.createdAt).getTime() >= cutoff,
    )
    .forEach((order) => {
      order.items.forEach((line) => {
        const key = line.productId ?? line.description;
        const current = map.get(key) ?? { name: line.description, quantity: 0, revenueCents: 0 };
        current.quantity += line.quantity;
        current.revenueCents += line.quantity * line.unitPriceCents;
        map.set(key, current);
      });
    });
  return Array.from(map.values())
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit);
}

export function expensesByCategory(days: number): Array<{ category: string; totalCents: number }> {
  const db = getDb();
  const cutoff = startOfDayMs(new Date(Date.now() - (days - 1) * 86400000));
  const map = new Map<string, number>();
  db.expenses
    .filter((expense) => new Date(expense.incurredAt).getTime() >= cutoff)
    .forEach((expense) => {
      map.set(expense.category, (map.get(expense.category) ?? 0) + expense.amountCents);
    });
  return Array.from(map.entries())
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export function totalExpenses(days: number): number {
  const db = getDb();
  const cutoff = startOfDayMs(new Date(Date.now() - (days - 1) * 86400000));
  return db.expenses
    .filter((expense) => new Date(expense.incurredAt).getTime() >= cutoff)
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}

export interface ValuationRow {
  itemId: string;
  name: string;
  kind: string;
  unit: string;
  homeBakery: number;
  cafe: number;
  total: number;
  costPerUnitCents: number;
  valueCents: number;
}

export function inventoryValuation(): { rows: ValuationRow[]; totalCents: number } {
  const db = getDb();
  const rows = db.inventoryItems.map((item) => {
    const homeBakery = stockQty(db, item.id, 'home_bakery');
    const cafe = stockQty(db, item.id, 'cafe');
    const total = Math.round((homeBakery + cafe) * 1000) / 1000;
    return {
      itemId: item.id,
      name: item.name,
      kind: item.kind,
      unit: item.unit,
      homeBakery,
      cafe,
      total,
      costPerUnitCents: item.costPerUnitCents,
      valueCents: Math.round(total * item.costPerUnitCents),
    };
  });
  return {
    rows: rows.sort((a, b) => b.valueCents - a.valueCents),
    totalCents: rows.reduce((sum, row) => sum + row.valueCents, 0),
  };
}

export interface CustomerBalanceRow {
  customerId: string;
  name: string;
  kind: string;
  openOrders: number;
  balanceCents: number;
}

export function customerBalances(): CustomerBalanceRow[] {
  const db = getDb();
  return db.customers
    .filter((customer) => !customer.isWalkIn)
    .map((customer) => {
      const orders = db.orders.filter(
        (order) => order.customerId === customer.id && order.status !== 'cancelled',
      );
      return {
        customerId: customer.id,
        name: customer.name,
        kind: customer.kind,
        openOrders: orders.filter((order) => order.status !== 'fulfilled').length,
        balanceCents: customerOutstanding(db, customer.id),
      };
    })
    .filter((row) => row.balanceCents > 0)
    .sort((a, b) => b.balanceCents - a.balanceCents);
}
