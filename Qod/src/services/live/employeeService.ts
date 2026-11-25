import { HAS_REMOTE_API } from '@/config/brand';
import type { Employee } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import {
  createEmployee as demoCreateEmployee,
  updateEmployee as demoUpdateEmployee,
  type EmployeeInput,
  type EmployeeUpdate,
} from '../employeeService';

export * from '../employeeService';

export function createEmployee(input: EmployeeInput): Employee | Promise<Employee> {
  if (!HAS_REMOTE_API) return demoCreateEmployee(input);
  return (async () => {
    const employee = await apiRequest<Employee>('/employees/', {
      method: 'POST',
      body: input,
    });
    return synced(`Account for ${employee.name}`, employee);
  })();
}

export function updateEmployee(id: string, input: EmployeeUpdate): Employee | Promise<Employee> {
  if (!HAS_REMOTE_API) return demoUpdateEmployee(id, input);
  return (async () => {
    const employee = await apiRequest<Employee>(`/employees/${id}/`, {
      method: 'PATCH',
      body: input,
    });
    return synced(`Account for ${employee.name}`, employee);
  })();
}
