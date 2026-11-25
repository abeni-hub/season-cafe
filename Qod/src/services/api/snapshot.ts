import { BRAND } from '@/config/brand';
import type { Database } from '@/types/domain';

/** Shape returned by GET /api/v1/bootstrap/ (already camelCased by Django). */
export type RemoteSnapshot = Partial<Omit<Database, 'version'>> & { version?: number };

export function emptyDatabase(): Database {
  return {
    version: 1,
    products: [],
    customers: [],
    orders: [],
    payments: [],
    inventoryItems: [],
    stock: [],
    movements: [],
    suppliers: [],
    purchaseOrders: [],
    purchaseReceipts: [],
    supplierPayments: [],
    recipes: [],
    batches: [],
    transfers: [],
    expenses: [],
    employees: [],
    messages: [],
    siteContent: {
      heroEyebrow: '',
      heroTitle: '',
      heroLead: '',
      aboutTitle: '',
      aboutLead: '',
      aboutBody: '',
      customOrderNote: '',
      contactPhone: '',
      contactEmail: '',
      contactAddress: '',
      openingHours: '',
      galleryCaptions: [],
    },
    settings: {
      businessName: BRAND.name,
      currency: 'NGN',
      tagline: BRAND.tagline,
      locations: [
        { id: 'home_bakery', name: 'Home Bakery', kind: 'Production & collection' },
        { id: 'cafe', name: 'Café', kind: 'Retail counter' },
      ],
    },
    activity: [],
    counters: {},
  };
}

/**
 * Fills absent collections explicitly so a role-filtered snapshot never leaks
 * demo records or crashes a page that expects a collection to exist.
 */
export function toDatabase(snapshot: RemoteSnapshot): Database {
  const base = emptyDatabase();
  const pick = <K extends keyof Database>(key: K): Database[K] =>
    (snapshot as Record<string, unknown>)[key] as Database[K] ?? base[key];
  return {
    version: 1,
    products: pick('products'),
    customers: pick('customers'),
    orders: pick('orders'),
    payments: pick('payments'),
    inventoryItems: pick('inventoryItems'),
    stock: pick('stock'),
    movements: pick('movements'),
    suppliers: pick('suppliers'),
    purchaseOrders: pick('purchaseOrders'),
    purchaseReceipts: pick('purchaseReceipts'),
    supplierPayments: pick('supplierPayments'),
    recipes: pick('recipes'),
    batches: pick('batches'),
    transfers: pick('transfers'),
    expenses: pick('expenses'),
    employees: pick('employees'),
    messages: pick('messages'),
    siteContent: pick('siteContent'),
    settings: pick('settings'),
    activity: pick('activity'),
    counters: pick('counters'),
  };
}
