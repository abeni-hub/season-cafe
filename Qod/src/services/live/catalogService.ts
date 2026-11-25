import { HAS_REMOTE_API } from '@/config/brand';
import type { Product } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import { updateProduct as demoUpdateProduct, type ProductUpdate } from '../catalogService';

export * from '../catalogService';

export function updateProduct(id: string, input: ProductUpdate): Product | Promise<Product> {
  if (!HAS_REMOTE_API) return demoUpdateProduct(id, input);
  return (async () => {
    const product = await apiRequest<Product>(`/products/${id}/update/`, {
      method: 'PATCH',
      body: input,
    });
    return synced(`${product.name}`, product);
  })();
}
