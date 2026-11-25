import type {
  Customer,
  Database,
  LocationId,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  Payment,
  PaymentMethod,
  ProductionBatch,
} from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { nextCode, requireNonEmpty, requirePositive, roundQty } from './helpers';
import { addMovement, finishedItemIdForProduct, requireStock, stockQty } from './inventoryLedger';
import { findOrCreateCustomer } from './customerService';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';
import { formatCents } from '@/utils/money';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  inquiry: 'Inquiry',
  quoted: 'Quoted',
  confirmed: 'Confirmed',
  in_production: 'In production',
  ready: 'Ready',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  regular: 'Regular sale',
  custom: 'Custom cake',
  bulk: 'Bulk order',
  organizational: 'Organizational',
};

export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  inquiry: ['quoted', 'cancelled'],
  quoted: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['fulfilled', 'cancelled'],
  fulfilled: ['cancelled'],
  cancelled: [],
};

export function listOrders(): Order[] {
  return [...getDb().orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getOrder(id: string): Order | undefined {
  return getDb().orders.find((order) => order.id === id);
}

export function listOrderPayments(id: string): Payment[] {
  return getDb()
    .payments.filter((payment) => payment.orderId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function listOrderBatches(id: string): ProductionBatch[] {
  return getDb().batches.filter((batch) => batch.orderId === id);
}

function makeOrderItem(
  description: string,
  quantity: number,
  unitPriceCents: number,
  productId?: string,
): OrderItem {
  return { id: uid('oi'), productId, description, quantity: roundQty(quantity), unitPriceCents };
}

export interface SaleLineInput {
  productId: string;
  quantity: number;
}

export interface SaleInput {
  customerId?: string;
  location: LocationId;
  method: PaymentMethod;
  items: SaleLineInput[];
}

export interface SaleResult {
  order: Order;
  payment: Payment;
}

export function createSale(input: SaleInput): SaleResult {
  const actor = requirePermission('pos.use');
  if (!input.items.length) throw new AppError('Add at least one product to the sale.');
  const location = input.location;
  const customerId = input.customerId?.trim() || 'c_walkin';

  return mutateDb(
    (draft) => {
      const customer = draft.customers.find((entry) => entry.id === customerId);
      if (!customer) throw new AppError('Select a valid customer or use the walk-in record.');

      const seen = new Set<string>();
      const lines: OrderItem[] = input.items.map((line) => {
        if (seen.has(line.productId)) throw new AppError('A product can only appear once in the cart.');
        seen.add(line.productId);
        const product = draft.products.find((entry) => entry.id === line.productId);
        if (!product) throw new AppError('A selected product no longer exists.');
        if (!product.isAvailable) throw new AppError(`${product.name} is marked unavailable.`);
        requirePositive(line.quantity, `Quantity for ${product.name} must be greater than zero.`);
        const itemId = finishedItemIdForProduct(draft, product.id);
        if (!itemId) throw new AppError(`${product.name} has no finished-goods record.`);
        requireStock(draft, itemId, location, line.quantity, product.name);
        return makeOrderItem(product.name, line.quantity, product.priceCents, product.id);
      });

      const totalCents = lines.reduce(
        (sum, line) => sum + Math.round(line.quantity * line.unitPriceCents),
        0,
      );
      if (totalCents <= 0) throw new AppError('The sale total must be greater than zero.');

      const createdAt = nowIso();
      const order: Order = {
        id: uid('ord'),
        code: nextCode(draft, 'pos', 'POS'),
        type: 'regular',
        status: 'fulfilled',
        source: 'pos',
        customerId: customer.id,
        items: lines,
        location,
        createdAt,
        updatedAt: createdAt,
      };
      draft.orders.push(order);

      lines.forEach((line) => {
        const itemId = finishedItemIdForProduct(draft, line.productId as string);
        if (itemId) {
          addMovement(draft, {
            itemId,
            location,
            quantityDelta: -line.quantity,
            reason: 'sale',
            refId: order.id,
            note: `POS sale ${order.code}`,
            createdBy: actor.name,
          });
        }
      });

      const payment: Payment = {
        id: uid('pay'),
        orderId: order.id,
        customerId: customer.id,
        kind: 'payment',
        role: 'final',
        method: input.method,
        amountCents: totalCents,
        location,
        createdAt,
      };
      draft.payments.push(payment);

      draft.activity.unshift({
        id: uid('act'),
        message: `${order.code} recorded at ${location === 'cafe' ? 'the Café' : 'the Home Bakery'} — stock deducted once at sale.`,
        actor: actor.name,
        createdAt,
      });

      return { order, payment };
    },
    undefined,
  );
}

export interface InquiryInput {
  contact: {
    name: string;
    kind: 'individual' | 'organization';
    organization?: string;
    phone?: string;
    email?: string;
  };
  type: 'custom' | 'organizational' | 'bulk';
  description: string;
  deliveryDate?: string;
  occasion?: string;
  servings?: string;
  budget?: string;
  notes?: string;
}

export function createCustomInquiry(input: InquiryInput): Order {
  const name = requireNonEmpty(input.contact.name, 'Please provide a contact name.');
  const description = requireNonEmpty(input.description, 'Please describe the cake you need.');
  if (!input.contact.phone?.trim() && !input.contact.email?.trim()) {
    throw new AppError('Please provide a phone number or email address so the bakery can respond.');
  }

  const customer = findOrCreateCustomer({
    kind: input.contact.kind,
    name,
    organization: input.contact.organization,
    phone: input.contact.phone,
    email: input.contact.email,
    notes: 'Created from a public custom-order enquiry.',
  });

  const notes = [
    input.occasion?.trim() ? `Occasion: ${input.occasion.trim()}` : '',
    input.servings?.trim() ? `Servings: ${input.servings.trim()}` : '',
    input.budget?.trim() ? `Budget guide: ${input.budget.trim()}` : '',
    input.notes?.trim() ? input.notes.trim() : '',
  ]
    .filter(Boolean)
    .join('\n');

  return mutateDb(
    (draft) => {
      const createdAt = nowIso();
      const order: Order = {
        id: uid('ord'),
        code: nextCode(draft, 'inquiry', 'INQ'),
        type: input.type,
        status: 'inquiry',
        source: 'website',
        customerId: customer.id,
        items: [makeOrderItem(description, 1, 0)],
        location: 'home_bakery',
        deliveryDate: input.deliveryDate || undefined,
        notes: notes || undefined,
        createdAt,
        updatedAt: createdAt,
      };
      draft.orders.push(order);
      draft.activity.unshift({
        id: uid('act'),
        message: `Website enquiry ${order.code} received from ${customer.name}.`,
        actor: 'Website',
        createdAt,
      });
      return order;
    },
    undefined,
  );
}

export interface OrderDraftLine {
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderDraft {
  type: OrderType;
  customerId: string;
  items: OrderDraftLine[];
  location: LocationId;
  deliveryLocation?: LocationId;
  deliveryDate?: string;
  notes?: string;
  status: 'quoted' | 'confirmed';
}

export function createOrder(draft: OrderDraft): Order {
  const actor = requirePermission('orders.manage');
  if (!draft.items.length) throw new AppError('Add at least one order line.');
  return mutateDb(
    (db) => {
      const customer = db.customers.find((entry) => entry.id === draft.customerId);
      if (!customer) throw new AppError('Select a valid customer.');
      const items = draft.items.map((line, index) => {
        const description = requireNonEmpty(
          line.description,
          `Line ${index + 1}: a description is required.`,
        );
        requirePositive(line.quantity, `Line ${index + 1}: quantity must be greater than zero.`);
        if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
          throw new AppError(`Line ${index + 1}: price is invalid.`);
        }
        return makeOrderItem(description, line.quantity, line.unitPriceCents, line.productId);
      });
      const total = items.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
      if (total <= 0) throw new AppError('The order total must be greater than zero.');

      const createdAt = nowIso();
      const order: Order = {
        id: uid('ord'),
        code: nextCode(db, 'order', 'ORD'),
        type: draft.type,
        status: draft.status,
        source: 'bms',
        customerId: customer.id,
        items,
        location: draft.location,
        deliveryLocation: draft.deliveryLocation,
        deliveryDate: draft.deliveryDate || undefined,
        notes: draft.notes?.trim() || undefined,
        createdAt,
        updatedAt: createdAt,
      };
      db.orders.push(order);
      db.activity.unshift({
        id: uid('act'),
        message: `${order.code} created (${ORDER_TYPE_LABELS[order.type]}) for ${customer.name}.`,
        actor: actor.name,
        createdAt,
      });
      return order;
    },
    undefined,
  );
}

export interface QuotationInput {
  items: Array<{ description: string; quantity: number; unitPriceCents: number; productId?: string }>;
  deliveryDate?: string;
  notes?: string;
}

export function saveQuotation(orderId: string, input: QuotationInput): Order {
  const actor = requirePermission('orders.manage');
  if (!input.items.length) throw new AppError('Add at least one quotation line.');
  return mutateDb(
    (draft) => {
      const order = draft.orders.find((entry) => entry.id === orderId);
      if (!order) throw new AppError('Order not found.');
      if (order.status !== 'inquiry' && order.status !== 'quoted') {
        throw new AppError('Quotations can only be prepared for enquiries and quoted orders.');
      }
      const items = input.items.map((line, index) => {
        const description = requireNonEmpty(
          line.description,
          `Line ${index + 1}: a description is required.`,
        );
        requirePositive(line.quantity, `Line ${index + 1}: quantity must be greater than zero.`);
        if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
          throw new AppError(`Line ${index + 1}: price is invalid.`);
        }
        return makeOrderItem(description, line.quantity, line.unitPriceCents, line.productId);
      });
      const total = items.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
      if (total <= 0) throw new AppError('The quotation total must be greater than zero.');

      order.items = items;
      order.deliveryDate = input.deliveryDate || order.deliveryDate;
      order.notes = input.notes?.trim() || order.notes;
      order.status = 'quoted';
      order.updatedAt = nowIso();
      draft.activity.unshift({
        id: uid('act'),
        message: `Quotation prepared for ${order.code} at ${formatCents(total, draft.settings.currency)}.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return order;
    },
    undefined,
  );
}

function deductFulfilmentStock(draft: Database, order: Order, actor: string): void {
  const productLines = order.items.filter((line) => line.productId && line.quantity > 0);
  if (!productLines.length) return;
  const alreadyDeducted = draft.movements.some(
    (movement) => movement.refId === order.id && movement.reason === 'sale',
  );
  if (alreadyDeducted) return;
  productLines.forEach((line) => {
    const itemId = finishedItemIdForProduct(draft, line.productId as string);
    if (!itemId) throw new AppError(`${line.description} has no finished-goods record.`);
    requireStock(draft, itemId, order.location, line.quantity, line.description);
  });
  productLines.forEach((line) => {
    const itemId = finishedItemIdForProduct(draft, line.productId as string);
    if (!itemId) return;
    addMovement(draft, {
      itemId,
      location: order.location,
      quantityDelta: -line.quantity,
      reason: 'sale',
      refId: order.id,
      note: `Fulfilment of ${order.code}`,
      createdBy: actor,
    });
  });
}

function reverseStockForOrder(draft: Database, order: Order, actor: string): void {
  const saleMovements = draft.movements.filter(
    (movement) => movement.refId === order.id && movement.reason === 'sale',
  );
  const alreadyReturned = draft.movements.some(
    (movement) => movement.refId === order.id && movement.reason === 'return',
  );
  if (!saleMovements.length || alreadyReturned) return;
  saleMovements.forEach((movement) => {
    addMovement(draft, {
      itemId: movement.itemId,
      location: movement.location,
      quantityDelta: -movement.quantityDelta,
      reason: 'return',
      refId: order.id,
      note: `Stock reversal for cancelled ${order.code}`,
      createdBy: actor,
    });
  });
}

export function transitionOrder(orderId: string, next: OrderStatus): Order {
  const actor = requirePermission('orders.manage');
  return mutateDb(
    (draft) => {
      const order = draft.orders.find((entry) => entry.id === orderId);
      if (!order) throw new AppError('Order not found.');
      if (!ORDER_FLOW[order.status].includes(next)) {
        throw new AppError(
          `${order.code} cannot move from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[next]}.`,
        );
      }
      if (next === 'quoted') {
        const total = order.items.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
        if (total <= 0) throw new AppError('Prepare a quotation with a value before marking it quoted.');
      }
      if (next === 'fulfilled') {
        deductFulfilmentStock(draft, order, actor.name);
      }
      if (next === 'cancelled') {
        reverseStockForOrder(draft, order, actor.name);
        draft.batches
          .filter(
            (batch) =>
              batch.orderId === order.id &&
              !['completed', 'ready', 'cancelled'].includes(batch.status),
          )
          .forEach((batch) => {
            batch.status = 'cancelled';
          });
      }
      order.status = next;
      order.updatedAt = nowIso();
      draft.activity.unshift({
        id: uid('act'),
        message: `${order.code} moved to ${ORDER_STATUS_LABELS[next]}.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return order;
    },
    undefined,
  );
}

export function cancelOrder(orderId: string): Order {
  return transitionOrder(orderId, 'cancelled');
}

export function availableProductStock(productId: string, location: LocationId): number {
  const db = getDb();
  const itemId = finishedItemIdForProduct(db, productId);
  if (!itemId) return 0;
  return stockQty(db, itemId, location);
}

export function walkInCustomer(): Customer | undefined {
  return getDb().customers.find((customer) => customer.isWalkIn);
}
