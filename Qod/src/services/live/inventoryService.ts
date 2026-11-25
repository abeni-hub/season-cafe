import { HAS_REMOTE_API } from '@/config/brand';
import type { InventoryItem } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import {
  adjustStock as demoAdjustStock,
  createInventoryItem as demoCreateInventoryItem,
  type AdjustmentInput,
  type NewInventoryItemInput,
} from '../inventoryService';

export * from '../inventoryService';

export function createInventoryItem(
  input: NewInventoryItemInput,
): InventoryItem | Promise<InventoryItem> {
  if (!HAS_REMOTE_API) return demoCreateInventoryItem(input);
  return (async () => {
    const item = await apiRequest<InventoryItem>('/inventory/items/create/', {
      method: 'POST',
      body: input,
    });
    return synced(`Material ${item.name}`, item);
  })();
}

export function adjustStock(input: AdjustmentInput): void | Promise<void> {
  if (!HAS_REMOTE_API) return demoAdjustStock(input);
  return (async () => {
    await apiRequest('/inventory/adjustments/', { method: 'POST', body: input });
    await synced('Stock adjustment', undefined);
  })();
}
