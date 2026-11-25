export type Permission =
  | 'dashboard.view'
  | 'finance.view'
  | 'pos.use'
  | 'orders.view'
  | 'orders.manage'
  | 'customers.manage'
  | 'payments.view'
  | 'payments.manage'
  | 'expenses.manage'
  | 'inventory.view'
  | 'inventory.manage'
  | 'purchasing.manage'
  | 'recipes.manage'
  | 'production.view'
  | 'production.manage'
  | 'transfers.manage'
  | 'reports.view'
  | 'employees.manage'
  | 'products.manage'
  | 'cms.manage';

import type { Role } from '@/types/domain';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'dashboard.view',
    'finance.view',
    'pos.use',
    'orders.view',
    'orders.manage',
    'customers.manage',
    'payments.view',
    'payments.manage',
    'expenses.manage',
    'inventory.view',
    'inventory.manage',
    'purchasing.manage',
    'recipes.manage',
    'production.view',
    'production.manage',
    'transfers.manage',
    'reports.view',
    'employees.manage',
    'products.manage',
    'cms.manage',
  ],
  admin: [
    'dashboard.view',
    'finance.view',
    'pos.use',
    'orders.view',
    'orders.manage',
    'customers.manage',
    'payments.view',
    'payments.manage',
    'expenses.manage',
    'inventory.view',
    'inventory.manage',
    'purchasing.manage',
    'recipes.manage',
    'production.view',
    'production.manage',
    'transfers.manage',
    'reports.view',
    'employees.manage',
    'products.manage',
    'cms.manage',
  ],
  manager: [
    'dashboard.view',
    'finance.view',
    'pos.use',
    'orders.view',
    'orders.manage',
    'customers.manage',
    'payments.view',
    'payments.manage',
    'expenses.manage',
    'inventory.view',
    'inventory.manage',
    'purchasing.manage',
    'recipes.manage',
    'production.view',
    'production.manage',
    'transfers.manage',
    'reports.view',
    'products.manage',
    'cms.manage',
  ],
  cashier: [
    'dashboard.view',
    'pos.use',
    'orders.view',
    'customers.manage',
    'payments.view',
    'payments.manage',
  ],
  production: [
    'dashboard.view',
    'orders.view',
    'production.view',
    'production.manage',
    'inventory.view',
    'recipes.manage',
  ],
  inventory: [
    'dashboard.view',
    'inventory.view',
    'inventory.manage',
    'purchasing.manage',
    'transfers.manage',
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Administrator',
  manager: 'Manager',
  cashier: 'Cashier',
  production: 'Production staff',
  inventory: 'Inventory staff',
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
