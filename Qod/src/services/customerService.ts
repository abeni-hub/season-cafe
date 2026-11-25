import type { Customer, CustomerKind } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requireNonEmpty } from './helpers';
import { uid } from '@/utils/id';
import { nowIso } from '@/utils/date';
import { customerOutstanding } from './orderMath';

export interface CustomerInput {
  kind: CustomerKind;
  name: string;
  organization?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export function listCustomers(): Customer[] {
  return [...getDb().customers]
    .filter((customer) => !customer.isWalkIn)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCustomer(id: string): Customer | undefined {
  return getDb().customers.find((customer) => customer.id === id);
}

export function customerName(id: string): string {
  return getCustomer(id)?.name ?? 'Unknown customer';
}

export function customerBalance(id: string): number {
  return customerOutstanding(getDb(), id);
}

export function createCustomer(input: CustomerInput): Customer {
  requirePermission('customers.manage');
  return persistNewCustomer(input);
}

export function updateCustomer(id: string, input: CustomerInput): Customer {
  requirePermission('customers.manage');
  return mutateDb(
    (draft) => {
      const customer = draft.customers.find((entry) => entry.id === id);
      if (!customer) throw new AppError('Customer not found.');
      const name = requireNonEmpty(input.name, 'Customer name is required.');
      customer.kind = input.kind;
      customer.name = name;
      customer.organization = input.organization?.trim() || undefined;
      customer.phone = input.phone?.trim() || undefined;
      customer.email = input.email?.trim() || undefined;
      customer.address = input.address?.trim() || undefined;
      customer.notes = input.notes?.trim() || undefined;
      return customer;
    },
    undefined,
  );
}

/**
 * Public-facing helper used by the website and POS. It deliberately does not
 * require a session because it represents an anonymous customer submission.
 */
export function findOrCreateCustomer(input: CustomerInput): Customer {
  const match = findCustomerMatch(input);
  if (match) return match;
  return persistNewCustomer(input);
}

function findCustomerMatch(input: CustomerInput): Customer | undefined {
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();
  return getDb().customers.find((customer) => {
    if (customer.isWalkIn) return false;
    if (email && customer.email?.toLowerCase() === email) return true;
    if (phone && customer.phone === phone) return true;
    return (
      customer.kind === input.kind &&
      customer.name.toLowerCase() === input.name.trim().toLowerCase() &&
      (customer.organization ?? '') === (input.organization ?? '')
    );
  });
}

function persistNewCustomer(input: CustomerInput): Customer {
  const name = requireNonEmpty(input.name, 'Customer name is required.');
  const customer: Customer = {
    id: uid('c'),
    kind: input.kind,
    name,
    organization: input.organization?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    email: input.email?.trim() || undefined,
    address: input.address?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: nowIso(),
  };
  return mutateDb(
    (draft) => {
      draft.customers.push(customer);
      draft.activity.unshift({
        id: uid('act'),
        message: `Customer ${customer.name} added.`,
        actor: 'System',
        createdAt: nowIso(),
      });
      return customer;
    },
    undefined,
  );
}
