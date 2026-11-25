import type { Employee, Role } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requireNonEmpty } from './helpers';
import { getSessionUser } from './session';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export function listEmployees(): Employee[] {
  return [...getDb().employees].sort((a, b) => a.name.localeCompare(b.name));
}

export interface EmployeeInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export function createEmployee(input: EmployeeInput): Employee {
  requirePermission('employees.manage');
  const name = requireNonEmpty(input.name, 'Employee name is required.');
  const email = requireNonEmpty(input.email, 'Email is required.').toLowerCase();
  if (!email.includes('@')) throw new AppError('Enter a valid email address.');
  if (input.password.trim().length < 6) throw new AppError('Passwords must be at least 6 characters.');
  return mutateDb(
    (draft) => {
      const exists = draft.employees.some((entry) => entry.email.toLowerCase() === email);
      if (exists) throw new AppError('An account with this email already exists.');
      const employee: Employee = {
        id: uid('emp'),
        name,
        email,
        password: input.password,
        role: input.role,
        isActive: true,
        createdAt: nowIso(),
      };
      draft.employees.push(employee);
      draft.activity.unshift({
        id: uid('act'),
        message: `${employee.name} added as ${employee.role}.`,
        actor: getSessionUser()?.name ?? 'System',
        createdAt: nowIso(),
      });
      return employee;
    },
    undefined,
  );
}

export interface EmployeeUpdate {
  name?: string;
  role?: Role;
  isActive?: boolean;
}

export function updateEmployee(id: string, input: EmployeeUpdate): Employee {
  requirePermission('employees.manage');
  const actor = getSessionUser();
  return mutateDb(
    (draft) => {
      const employee = draft.employees.find((entry) => entry.id === id);
      if (!employee) throw new AppError('Employee not found.');
      if (actor?.employeeId === id && input.isActive === false) {
        throw new AppError('You cannot deactivate your own account.');
      }
      if (input.name !== undefined) employee.name = requireNonEmpty(input.name, 'Name is required.');
      if (input.role !== undefined) employee.role = input.role;
      if (input.isActive !== undefined) employee.isActive = input.isActive;
      draft.activity.unshift({
        id: uid('act'),
        message: `${employee.name}'s account updated.`,
        actor: actor?.name ?? 'System',
        createdAt: nowIso(),
      });
      return employee;
    },
    undefined,
  );
}
