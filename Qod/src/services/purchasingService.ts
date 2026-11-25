import type {
  LocationId,
  PaymentMethod,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseReceipt,
  PurchaseReceiptLine,
  Supplier,
  SupplierPayment,
} from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { nextCode, requireNonEmpty, requirePositive, roundQty } from './helpers';
import { addMovement, itemName } from './inventoryLedger';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export function listSuppliers(): Supplier[] {
  return [...getDb().suppliers].sort((a, b) => a.name.localeCompare(b.name));
}

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export function createSupplier(input: SupplierInput): Supplier {
  const actor = requirePermission('purchasing.manage');
  const name = requireNonEmpty(input.name, 'Supplier name is required.');
  return mutateDb(
    (draft) => {
      const supplier: Supplier = {
        id: uid('sup'),
        name,
        contactName: input.contactName?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        email: input.email?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        createdAt: nowIso(),
      };
      draft.suppliers.push(supplier);
      draft.activity.unshift({
        id: uid('act'),
        message: `Supplier ${supplier.name} added.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return supplier;
    },
    undefined,
  );
}

export function listPurchaseOrders(): PurchaseOrder[] {
  return [...getDb().purchaseOrders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getPurchaseOrder(id: string): PurchaseOrder | undefined {
  return getDb().purchaseOrders.find((order) => order.id === id);
}

export function listReceipts(): PurchaseReceipt[] {
  return [...getDb().purchaseReceipts].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
}

export function receivedQuantities(poId: string): Record<string, number> {
  const result: Record<string, number> = {};
  getDb()
    .purchaseReceipts.filter((receipt) => receipt.purchaseOrderId === poId)
    .forEach((receipt) => {
      receipt.lines.forEach((line) => {
        result[line.itemId] = roundQty((result[line.itemId] ?? 0) + line.quantity);
      });
    });
  return result;
}

export interface PurchaseOrderInput {
  supplierId: string;
  lines: PurchaseOrderLine[];
  expectedAt?: string;
  notes?: string;
}

export function createPurchaseOrder(input: PurchaseOrderInput): PurchaseOrder {
  const actor = requirePermission('purchasing.manage');
  if (!input.lines.length) throw new AppError('Add at least one purchase order line.');
  return mutateDb(
    (draft) => {
      const supplier = draft.suppliers.find((entry) => entry.id === input.supplierId);
      if (!supplier) throw new AppError('Select a valid supplier.');
      const lines = input.lines.map((line, index) => {
        const item = draft.inventoryItems.find((entry) => entry.id === line.itemId);
        if (!item) throw new AppError(`Line ${index + 1}: select a valid material.`);
        if (item.kind === 'finished') throw new AppError('Finished goods are produced, not purchased.');
        requirePositive(roundQty(line.quantity), `Line ${index + 1}: quantity must be greater than zero.`);
        if (!Number.isInteger(line.unitCostCents) || line.unitCostCents < 0) {
          throw new AppError(`Line ${index + 1}: unit cost is invalid.`);
        }
        return { itemId: line.itemId, quantity: roundQty(line.quantity), unitCostCents: line.unitCostCents };
      });
      const order: PurchaseOrder = {
        id: uid('po'),
        code: nextCode(draft, 'po', 'PO'),
        supplierId: supplier.id,
        status: 'ordered',
        lines,
        expectedAt: input.expectedAt || undefined,
        notes: input.notes?.trim() || undefined,
        createdAt: nowIso(),
      };
      draft.purchaseOrders.push(order);
      draft.activity.unshift({
        id: uid('act'),
        message: `${order.code} raised with ${supplier.name}. Ordered goods do not increase stock until received.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return order;
    },
    undefined,
  );
}

export interface ReceiveInput {
  location: LocationId;
  lines: Array<{ itemId: string; quantity: number }>;
}

export function receivePurchaseOrder(poId: string, input: ReceiveInput): PurchaseReceipt {
  const actor = requirePermission('purchasing.manage');
  return mutateDb(
    (draft) => {
      const order = draft.purchaseOrders.find((entry) => entry.id === poId);
      if (!order) throw new AppError('Purchase order not found.');
      if (order.status === 'received') throw new AppError('This purchase order is already fully received.');
      if (order.status === 'cancelled') throw new AppError('Cancelled purchase orders cannot be received.');

      const previous: Record<string, number> = {};
      draft.purchaseReceipts
        .filter((receipt) => receipt.purchaseOrderId === poId)
        .forEach((receipt) => {
          receipt.lines.forEach((line) => {
            previous[line.itemId] = roundQty((previous[line.itemId] ?? 0) + line.quantity);
          });
        });

      const receiptLines: PurchaseReceiptLine[] = [];
      input.lines.forEach((line) => {
        const poLine = order.lines.find((entry) => entry.itemId === line.itemId);
        if (!poLine) throw new AppError(`${itemName(draft, line.itemId)} is not on this purchase order.`);
        const qty = roundQty(line.quantity);
        if (qty <= 0) return;
        const remaining = roundQty(poLine.quantity - (previous[line.itemId] ?? 0));
        if (qty > remaining + 1e-9) {
          throw new AppError(
            `Cannot receive ${qty} of ${itemName(draft, line.itemId)}; only ${remaining} remains on ${order.code}.`,
          );
        }
        receiptLines.push({ itemId: line.itemId, quantity: qty, unitCostCents: poLine.unitCostCents });
      });

      if (!receiptLines.length) throw new AppError('Enter at least one quantity to receive.');

      const receivedAt = nowIso();
      const receipt: PurchaseReceipt = {
        id: uid('rcp'),
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        location: input.location,
        lines: receiptLines,
        receivedAt,
        receivedBy: actor.name,
      };

      receiptLines.forEach((line) => {
        const item = draft.inventoryItems.find((entry) => entry.id === line.itemId);
        if (!item) throw new AppError('Inventory item missing.');
        const existingQty = draft.stock
          .filter((level) => level.itemId === item.id)
          .reduce((sum, level) => sum + level.quantity, 0);
        const newQty = existingQty + line.quantity;
        if (newQty > 0) {
          const weighted =
            (existingQty * item.costPerUnitCents + line.quantity * line.unitCostCents) / newQty;
          item.costPerUnitCents = Math.round(weighted);
        }
        addMovement(draft, {
          itemId: line.itemId,
          location: input.location,
          quantityDelta: line.quantity,
          reason: 'purchase_receipt',
          refId: order.id,
          note: `${order.code} receipt`,
          at: receivedAt,
          createdBy: actor.name,
        });
      });

      draft.purchaseReceipts.push(receipt);

      const totalsByItem: Record<string, number> = { ...previous };
      receiptLines.forEach((line) => {
        totalsByItem[line.itemId] = roundQty((totalsByItem[line.itemId] ?? 0) + line.quantity);
      });
      const fullyReceived = order.lines.every(
        (line) => (totalsByItem[line.itemId] ?? 0) + 1e-9 >= line.quantity,
      );
      order.status = fullyReceived ? 'received' : 'partially_received';

      draft.activity.unshift({
        id: uid('act'),
        message: `${receiptLines.length} line(s) received against ${order.code} at ${input.location === 'cafe' ? 'Café' : 'Home Bakery'}. Stock and weighted costs updated.`,
        actor: actor.name,
        createdAt: receivedAt,
      });
      return receipt;
    },
    undefined,
  );
}

export function cancelPurchaseOrder(poId: string): PurchaseOrder {
  const actor = requirePermission('purchasing.manage');
  return mutateDb(
    (draft) => {
      const order = draft.purchaseOrders.find((entry) => entry.id === poId);
      if (!order) throw new AppError('Purchase order not found.');
      const hasReceipts = draft.purchaseReceipts.some((receipt) => receipt.purchaseOrderId === poId);
      if (hasReceipts) throw new AppError('Purchase orders with receipts cannot be cancelled.');
      if (order.status === 'cancelled') throw new AppError('This purchase order is already cancelled.');
      order.status = 'cancelled';
      draft.activity.unshift({
        id: uid('act'),
        message: `${order.code} cancelled.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return order;
    },
    undefined,
  );
}

export interface SupplierPaymentInput {
  supplierId: string;
  amountCents: number;
  method: PaymentMethod;
  note?: string;
}

export function recordSupplierPayment(input: SupplierPaymentInput): SupplierPayment {
  const actor = requirePermission('purchasing.manage');
  requirePositive(input.amountCents, 'Enter a payment amount greater than zero.');
  if (!Number.isInteger(input.amountCents)) throw new AppError('Amount is invalid.');
  return mutateDb(
    (draft) => {
      const supplier = draft.suppliers.find((entry) => entry.id === input.supplierId);
      if (!supplier) throw new AppError('Supplier not found.');
      const payment: SupplierPayment = {
        id: uid('spay'),
        supplierId: supplier.id,
        amountCents: input.amountCents,
        method: input.method,
        note: input.note?.trim() || undefined,
        createdAt: nowIso(),
      };
      draft.supplierPayments.push(payment);
      draft.activity.unshift({
        id: uid('act'),
        message: `Supplier payment recorded for ${supplier.name}.`,
        actor: actor.name,
        createdAt: payment.createdAt,
      });
      return payment;
    },
    undefined,
  );
}

export interface SupplierBalanceRow {
  supplier: Supplier;
  receivedCents: number;
  paidCents: number;
  balanceCents: number;
}

export function supplierBalances(): SupplierBalanceRow[] {
  const db = getDb();
  return db.suppliers
    .map((supplier) => {
      const receivedCents = db.purchaseReceipts
        .filter((receipt) => receipt.supplierId === supplier.id)
        .reduce(
          (sum, receipt) =>
            sum +
            receipt.lines.reduce((lineSum, line) => lineSum + line.quantity * line.unitCostCents, 0),
          0,
        );
      const paidCents = db.supplierPayments
        .filter((payment) => payment.supplierId === supplier.id)
        .reduce((sum, payment) => sum + payment.amountCents, 0);
      return {
        supplier,
        receivedCents,
        paidCents,
        balanceCents: receivedCents - paidCents,
      };
    })
    .sort((a, b) => b.balanceCents - a.balanceCents);
}
