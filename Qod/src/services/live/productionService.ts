import { HAS_REMOTE_API } from '@/config/brand';
import type { BatchStatus, ProductionBatch, Recipe } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import {
  advanceBatch as demoAdvanceBatch,
  createBatch as demoCreateBatch,
  upsertRecipe as demoUpsertRecipe,
  type BatchInput,
  type RecipeInput,
} from '../productionService';

export * from '../productionService';

export function upsertRecipe(input: RecipeInput): Recipe | Promise<Recipe> {
  if (!HAS_REMOTE_API) return demoUpsertRecipe(input);
  return (async () => {
    const recipe = await apiRequest<Recipe>('/recipes/upsert/', {
      method: 'POST',
      body: input,
    });
    return synced('Recipe', recipe);
  })();
}

export function createBatch(input: BatchInput): ProductionBatch | Promise<ProductionBatch> {
  if (!HAS_REMOTE_API) return demoCreateBatch(input);
  return (async () => {
    const batch = await apiRequest<ProductionBatch>('/batches/create/', {
      method: 'POST',
      body: {
        title: input.title,
        productId: input.productId || undefined,
        recipeId: input.recipeId || undefined,
        orderId: input.orderId || undefined,
        quantity: input.quantity,
        location: input.location,
        scheduledFor: input.scheduledFor || undefined,
        assignedEmployeeId: input.assignedEmployeeId || undefined,
        notes: input.notes,
      },
    });
    return synced(`Batch ${batch.code}`, batch);
  })();
}

export function advanceBatch(
  batchId: string,
  next: BatchStatus,
): ProductionBatch | Promise<ProductionBatch> {
  if (!HAS_REMOTE_API) return demoAdvanceBatch(batchId, next);
  return (async () => {
    const batch = await apiRequest<ProductionBatch>(`/batches/${batchId}/transition/`, {
      method: 'POST',
      body: { status: next },
    });
    return synced(`${batch.code} status`, batch);
  })();
}
