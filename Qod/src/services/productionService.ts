import type {
  BatchStatus,
  LocationId,
  ProductionBatch,
  Recipe,
  RecipeLine,
} from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { nextCode, requirePositive, roundQty } from './helpers';
import { addMovement, finishedItemIdForProduct, requireStock, stockQty } from './inventoryLedger';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_production: 'In production',
  quality_check: 'Quality check',
  completed: 'Completed',
  ready: 'Ready for fulfilment',
  cancelled: 'Cancelled',
};

export const BATCH_FLOW: Record<BatchStatus, BatchStatus[]> = {
  pending: ['scheduled', 'cancelled'],
  scheduled: ['in_production', 'cancelled'],
  in_production: ['quality_check', 'cancelled'],
  quality_check: ['completed', 'cancelled'],
  completed: ['ready'],
  ready: [],
  cancelled: [],
};

export function listRecipes(): Recipe[] {
  return [...getDb().recipes];
}

export function recipeForProduct(productId: string): Recipe | undefined {
  return getDb().recipes.find((recipe) => recipe.productId === productId);
}

export interface RecipeCost {
  ingredientCents: number;
  packagingCents: number;
  batchTotalCents: number;
  perUnitCents: number;
  priceCents: number;
  marginCents: number;
  marginPct: number;
}

export function calculateRecipeCost(recipe: Recipe): RecipeCost | null {
  const db = getDb();
  const product = db.products.find((entry) => entry.id === recipe.productId);
  if (!product) return null;
  let ingredientCents = 0;
  let packagingCents = 0;
  recipe.lines.forEach((line) => {
    const item = db.inventoryItems.find((entry) => entry.id === line.itemId);
    if (!item) return;
    const cost = line.quantity * item.costPerUnitCents;
    if (item.kind === 'packaging') packagingCents += cost;
    else ingredientCents += cost;
  });
  const batchTotalCents = Math.round(ingredientCents + packagingCents);
  const perUnitCents = recipe.yieldQuantity > 0 ? Math.round(batchTotalCents / recipe.yieldQuantity) : 0;
  const marginCents = product.priceCents - perUnitCents;
  const marginPct = product.priceCents > 0 ? (marginCents / product.priceCents) * 100 : 0;
  return {
    ingredientCents: Math.round(ingredientCents),
    packagingCents: Math.round(packagingCents),
    batchTotalCents,
    perUnitCents,
    priceCents: product.priceCents,
    marginCents,
    marginPct,
  };
}

export interface RecipeInput {
  productId: string;
  yieldQuantity: number;
  lines: RecipeLine[];
  notes?: string;
}

export function upsertRecipe(input: RecipeInput): Recipe {
  const actor = requirePermission('recipes.manage');
  requirePositive(roundQty(input.yieldQuantity), 'Yield must be greater than zero.');
  if (!input.lines.length) throw new AppError('Add at least one recipe line.');
  return mutateDb(
    (draft) => {
      const product = draft.products.find((entry) => entry.id === input.productId);
      if (!product) throw new AppError('Product not found.');
      const lines: RecipeLine[] = input.lines
        .filter((line) => line.itemId && line.quantity > 0)
        .map((line) => {
          const item = draft.inventoryItems.find((entry) => entry.id === line.itemId);
          if (!item) throw new AppError('A recipe ingredient no longer exists.');
          if (item.kind === 'finished') throw new AppError('Finished goods cannot be recipe ingredients.');
          return { itemId: line.itemId, quantity: roundQty(line.quantity) };
        });
      if (!lines.length) throw new AppError('Add at least one recipe line.');

      let recipe = draft.recipes.find((entry) => entry.productId === input.productId);
      if (!recipe) {
        recipe = {
          id: uid('r'),
          productId: product.id,
          yieldQuantity: roundQty(input.yieldQuantity),
          lines,
          notes: input.notes?.trim() || undefined,
          updatedAt: nowIso(),
        };
        draft.recipes.push(recipe);
      } else {
        recipe.yieldQuantity = roundQty(input.yieldQuantity);
        recipe.lines = lines;
        recipe.notes = input.notes?.trim() || recipe.notes;
        recipe.updatedAt = nowIso();
      }
      draft.activity.unshift({
        id: uid('act'),
        message: `Recipe for ${product.name} updated.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return recipe;
    },
    undefined,
  );
}

export function listBatches(): ProductionBatch[] {
  return [...getDb().batches].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export interface BatchInput {
  title?: string;
  productId?: string;
  recipeId?: string;
  orderId?: string;
  quantity: number;
  location: LocationId;
  scheduledFor?: string;
  assignedEmployeeId?: string;
  notes?: string;
}

export function createBatch(input: BatchInput): ProductionBatch {
  const actor = requirePermission('production.manage');
  requirePositive(roundQty(input.quantity), 'Batch quantity must be greater than zero.');
  return mutateDb(
    (draft) => {
      let title = input.title?.trim() || '';
      let productName = '';
      if (input.productId) {
        const product = draft.products.find((entry) => entry.id === input.productId);
        if (!product) throw new AppError('Product not found.');
        productName = product.name;
        title = title || `${product.name} — batch`;
        if (input.recipeId) {
          const recipe = draft.recipes.find((entry) => entry.id === input.recipeId);
          if (!recipe || recipe.productId !== product.id) {
            throw new AppError('The selected recipe does not belong to this product.');
          }
        }
      } else if (!title) {
        throw new AppError('Provide a title for a custom production batch.');
      }

      if (input.orderId) {
        const order = draft.orders.find((entry) => entry.id === input.orderId);
        if (!order) throw new AppError('Linked customer order not found.');
        if (['fulfilled', 'cancelled'].includes(order.status)) {
          throw new AppError('Production cannot be scheduled for a fulfilled or cancelled order.');
        }
        if (order.status === 'confirmed') {
          order.status = 'in_production';
          order.updatedAt = nowIso();
        }
      }

      const batch: ProductionBatch = {
        id: uid('batch'),
        code: nextCode(draft, 'batch', 'BATCH'),
        title: title || productName,
        productId: input.productId,
        recipeId: input.recipeId,
        orderId: input.orderId,
        quantity: roundQty(input.quantity),
        location: input.location,
        status: 'scheduled',
        scheduledFor: input.scheduledFor || undefined,
        assignedEmployeeId: input.assignedEmployeeId || undefined,
        notes: input.notes?.trim() || undefined,
        createdAt: nowIso(),
      };
      draft.batches.push(batch);
      draft.activity.unshift({
        id: uid('act'),
        message: `${batch.code} scheduled — ${batch.quantity} × ${batch.title}.`,
        actor: actor.name,
        createdAt: batch.createdAt,
      });
      return batch;
    },
    undefined,
  );
}

function completeBatch(draft: ReturnType<typeof getDb>, batch: ProductionBatch, actor: string): void {
  if (batch.productId && batch.recipeId) {
    const recipe = draft.recipes.find((entry) => entry.id === batch.recipeId);
    if (!recipe) throw new AppError('Recipe missing for this batch.');
    const multiplier = batch.quantity / recipe.yieldQuantity;
    const alreadyOutput = draft.movements.some(
      (movement) => movement.refId === batch.id && movement.reason === 'production_output',
    );
    if (alreadyOutput) throw new AppError('This batch has already created finished goods.');
    recipe.lines.forEach((line) => {
      const itemName = draft.inventoryItems.find((entry) => entry.id === line.itemId)?.name ?? 'item';
      requireStock(draft, line.itemId, batch.location, roundQty(line.quantity * multiplier), itemName);
    });
    recipe.lines.forEach((line) => {
      addMovement(draft, {
        itemId: line.itemId,
        location: batch.location,
        quantityDelta: -roundQty(line.quantity * multiplier),
        reason: 'production_consumption',
        refId: batch.id,
        note: `Consumption for ${batch.code}`,
        createdBy: actor,
      });
    });
    const finishedId = finishedItemIdForProduct(draft, batch.productId);
    if (!finishedId) throw new AppError('Finished-goods record missing for the batch product.');
    addMovement(draft, {
      itemId: finishedId,
      location: batch.location,
      quantityDelta: batch.quantity,
      reason: 'production_output',
      refId: batch.id,
      note: `Output of ${batch.code}`,
      createdBy: actor,
    });
  } else if (batch.productId && !batch.recipeId) {
    const finishedId = finishedItemIdForProduct(draft, batch.productId);
    if (!finishedId) throw new AppError('Finished-goods record missing for the batch product.');
    const alreadyOutput = draft.movements.some(
      (movement) => movement.refId === batch.id && movement.reason === 'production_output',
    );
    if (!alreadyOutput) {
      addMovement(draft, {
        itemId: finishedId,
        location: batch.location,
        quantityDelta: batch.quantity,
        reason: 'production_output',
        refId: batch.id,
        note: `Output of ${batch.code} (no recipe attached)`,
        createdBy: actor,
      });
    }
  }

  if (batch.orderId) {
    const order = draft.orders.find((entry) => entry.id === batch.orderId);
    if (order && order.status === 'in_production') {
      order.status = 'ready';
      order.updatedAt = nowIso();
    }
  }
}

export function advanceBatch(batchId: string, next: BatchStatus): ProductionBatch {
  const actor = requirePermission('production.manage');
  return mutateDb(
    (draft) => {
      const batch = draft.batches.find((entry) => entry.id === batchId);
      if (!batch) throw new AppError('Production batch not found.');
      if (!BATCH_FLOW[batch.status].includes(next)) {
        throw new AppError(
          `${batch.code} cannot move from ${BATCH_STATUS_LABELS[batch.status]} to ${BATCH_STATUS_LABELS[next]}.`,
        );
      }
      if (next === 'in_production') batch.startedAt = nowIso();
      if (next === 'completed') {
        completeBatch(draft, batch, actor.name);
        batch.completedAt = nowIso();
      }
      batch.status = next;
      draft.activity.unshift({
        id: uid('act'),
        message: `${batch.code} moved to ${BATCH_STATUS_LABELS[next]}.`,
        actor: actor.name,
        createdAt: nowIso(),
      });
      return batch;
    },
    undefined,
  );
}

export function ingredientAvailability(batch: ProductionBatch): Array<{ name: string; required: number; available: number; unit: string; short: boolean }> {
  const db = getDb();
  if (!batch.recipeId || !batch.productId) return [];
  const recipe = db.recipes.find((entry) => entry.id === batch.recipeId);
  if (!recipe) return [];
  const multiplier = batch.quantity / recipe.yieldQuantity;
  return recipe.lines.map((line) => {
    const item = db.inventoryItems.find((entry) => entry.id === line.itemId);
    const required = roundQty(line.quantity * multiplier);
    const available = stockQty(db, line.itemId, batch.location);
    return {
      name: item?.name ?? 'Unknown',
      required,
      available,
      unit: item?.unit ?? '',
      short: available + 1e-9 < required,
    };
  });
}
