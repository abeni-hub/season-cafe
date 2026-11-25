import { HAS_REMOTE_API } from '@/config/brand';
import type { Customer } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import {
  createCustomer as demoCreateCustomer,
  updateCustomer as demoUpdateCustomer,
  type CustomerInput,
} from '../customerService';

export * from '../customerService';

export function createCustomer(input: CustomerInput): Customer | Promise<Customer> {
  if (!HAS_REMOTE_API) return demoCreateCustomer(input);
  return (async () => {
    const customer = await apiRequest<Customer>('/customers/', {
      method: 'POST',
      body: input,
    });
    return synced(`Customer ${customer.name}`, customer);
  })();
}

export function updateCustomer(id: string, input: CustomerInput): Customer | Promise<Customer> {
  if (!HAS_REMOTE_API) return demoUpdateCustomer(id, input);
  return (async () => {
    const customer = await apiRequest<Customer>(`/customers/${id}/`, {
      method: 'PATCH',
      body: input,
    });
    return synced(`Customer ${customer.name}`, customer);
  })();
}
