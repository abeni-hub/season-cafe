import type { Database, LocationId, MovementReason, StockMovement } from '@/types/domain';
import { roundQty } from './helpers';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';
import { AppError } from './errors';

export interface MovementInput {
  itemId: string;
  location: LocationId;
  quantityDelta: number;
  reason: MovementReason;
  refId?: string;
  note?: string;
  at?: string;
  createdBy: string;
}

export function stockQty(db: Database, itemId: string, location: LocationId): number {
  return db.stock
    .filter((level) => level.itemId === itemId && level.location === location)
    .reduce((total, level) => total + level.quantity, 0);
}

export function finishedItemIdForProduct(db: Database, productId: string): string | undefined {
  return db.inventoryItems.find((item) => item.productId === productId)?.id;
}

export function addMovement(db: Database, input: MovementInput): StockMovement {
  if (input.quantityDelta === 0) {
    throw new AppError('A stock movement must change the quantity.');
  }
  const movement: StockMovement = {
    id: uid('mv'),
    itemId: input.itemId,
    location: input.location,
    quantityDelta: roundQty(input.quantityDelta),
    reason: input.reason,
    refId: input.refId,
    note: input.note,
    createdAt: input.at ?? nowIso(),
    createdBy: input.createdBy,
  };
  db.movements.push(movement);
  const level = db.stock.find(
    (entry) => entry.itemId === input.itemId && entry.location === input.location,
  );
  if (level) {
    level.quantity = roundQty(level.quantity + movement.quantityDelta);
  } else {
    db.stock.push({
      itemId: input.itemId,
      location: input.location,
      quantity: roundQty(movement.quantityDelta),
    });
  }
  return movement;
}

export function requireStock(
  db: Database,
  itemId: string,
  location: LocationId,
  quantity: number,
  label: string,
): void {
  const available = stockQty(db, itemId, location);
  if (available + 1e-9 < quantity) {
    throw new AppError(
      `Not enough ${label} at this location. Available: ${roundQty(available)}, requested: ${roundQty(quantity)}.`,
    );
  }
}

export function itemName(db: Database, itemId: string): string {
  return db.inventoryItems.find((item) => item.id === itemId)?.name ?? 'Unknown item';
}

export function locationLabel(value: LocationId): string {
  return value === 'home_bakery' ? 'Home Bakery' : 'Café';
}
