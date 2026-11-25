import type { InventoryItem, ItemKind, LocationId, StockLevel, StockMovement, Unit } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requireNonEmpty, requirePositive, roundQty } from './helpers';
import { addMovement, stockQty } from './inventoryLedger';
import { uid } from '@/utils/id';
import { nowIso } from '@/utils/date';

export interface StockRow {
  item: InventoryItem;
  byLocation: Record<LocationId, number>;
  total: number;
  low: boolean;
}

export function listInventoryItems(): InventoryItem[] {
  const order: Record<ItemKind, number> = { raw: 0, packaging: 1, finished: 2 };
  return [...getDb().inventoryItems].sort(
    (a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name),
  );
}

export function getInventoryItem(id: string): InventoryItem | undefined {
  return getDb().inventoryItems.find((item) => item.id === id);
}

export function stockAt(itemId: string, location: LocationId): number {
  return stockQty(getDb(), itemId, location);
}

export function listStockRows(): StockRow[] {
  const db = getDb();
  return listInventoryItems().map((item) => {
    const byLocation = {
      home_bakery: stockQty(db, item.id, 'home_bakery'),
      cafe: stockQty(db, item.id, 'cafe'),
    };
    const total = roundQty(byLocation.home_bakery + byLocation.cafe);
    return { item, byLocation, total, low: total < item.reorderLevel };
  });
}

export function listLowStock(): StockRow[] {
  return listStockRows().filter((row) => row.low);
}

export function listStockLevels(): StockLevel[] {
  return getDb().stock;
}

export function listMovements(limit = 200): StockMovement[] {
  return [...getDb().movements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export interface NewInventoryItemInput {
  name: string;
  kind: Exclude<ItemKind, 'finished'>;
  unit: Unit;
  costPerUnitCents: number;
  reorderLevel: number;
}

export function createInventoryItem(input: NewInventoryItemInput): InventoryItem {
  const actor = requirePermission('inventory.manage');
  const name = requireNonEmpty(input.name, 'Material name is required.');
  if (!Number.isInteger(input.costPerUnitCents) || input.costPerUnitCents < 0) {
    throw new AppError('Unit cost is invalid.');
  }
  if (input.reorderLevel < 0) throw new AppError('Reorder level cannot be negative.');
  const prefix = input.kind === 'packaging' ? 'PK' : 'RM';
  return mutateDb(
    (draft) => {
      const seq = draft.inventoryItems.filter((entry) => entry.kind === input.kind).length + 1;
      const item: InventoryItem = {
        id: uid('inv'),
        sku: `${prefix}-${String(seq).padStart(3, '0')}`,
        name,
        kind: input.kind,
        unit: input.unit,
        costPerUnitCents: input.costPerUnitCents,
        reorderLevel: input.reorderLevel,
      };
      draft.inventoryItems.push(item);
      draft.activity.unshift({
        id: uid('act'),
        message: `Inventory material ${item.name} added.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return item;
    },
    undefined,
  );
}

export interface AdjustmentInput {
  itemId: string;
  location: LocationId;
  mode: 'add' | 'remove' | 'wastage';
  quantity: number;
  note?: string;
}

export function adjustStock(input: AdjustmentInput): void {
  const actor = requirePermission('inventory.manage');
  requirePositive(roundQty(input.quantity), 'Quantity must be greater than zero.');
  const qty = roundQty(input.quantity);
  const reason = input.mode === 'wastage' ? 'wastage' : 'adjustment';
  mutateDb(
    (draft) => {
      const item = draft.inventoryItems.find((entry) => entry.id === input.itemId);
      if (!item) throw new AppError('Inventory item not found.');
      const current = stockQty(draft, item.id, input.location);
      if (input.mode !== 'add' && current + 1e-9 < qty) {
        throw new AppError(
          `Cannot remove ${qty} ${item.unit} of ${item.name}; only ${roundQty(current)} available.`,
        );
      }
      addMovement(draft, {
        itemId: item.id,
        location: input.location,
        quantityDelta: input.mode === 'add' ? qty : -qty,
        reason,
        note: input.note?.trim() || (input.mode === 'wastage' ? 'Wastage recorded' : 'Manual adjustment'),
        createdBy: actor.name,
      });
      draft.activity.unshift({
        id: uid('act'),
        message: `${input.mode === 'add' ? 'Stock added' : input.mode === 'wastage' ? 'Wastage recorded' : 'Stock removed'}: ${qty} ${item.unit} ${item.name} at ${input.location === 'cafe' ? 'Café' : 'Home Bakery'}.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
    },
    undefined,
  );
}
