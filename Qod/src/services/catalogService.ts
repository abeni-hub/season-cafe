import type { Product } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requireNonEmpty } from './helpers';

export function listProducts(): Product[] {
  return [...getDb().products].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function listPublishedProducts(): Product[] {
  return listProducts().filter((product) => product.isPublished);
}

export function getProductById(id: string): Product | undefined {
  return getDb().products.find((product) => product.id === id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return getDb().products.find((product) => product.slug === slug);
}

export interface ProductUpdate {
  description?: string;
  tagline?: string;
  priceCents?: number;
  isPublished?: boolean;
  isAvailable?: boolean;
}

export function updateProduct(id: string, input: ProductUpdate): Product {
  const actor = requirePermission('products.manage');
  return mutateDb(
    (draft) => {
      const product = draft.products.find((entry) => entry.id === id);
      if (!product) throw new AppError('Product not found.');
      if (input.description !== undefined) product.description = requireNonEmpty(input.description, 'Description cannot be empty.');
      if (input.tagline !== undefined) product.tagline = requireNonEmpty(input.tagline, 'Tagline cannot be empty.');
      if (input.priceCents !== undefined) {
        if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) {
          throw new AppError('Price must be a positive amount.');
        }
        product.priceCents = input.priceCents;
      }
      if (input.isPublished !== undefined) product.isPublished = input.isPublished;
      if (input.isAvailable !== undefined) product.isAvailable = input.isAvailable;
      draft.activity.unshift({
        id: `act_${Date.now().toString(36)}`,
        message: `${product.name} updated by ${actor.name}.`,
        actor: actor.name,
        createdAt: new Date().toISOString(),
      });
      return product;
    },
    undefined,
  );
}
