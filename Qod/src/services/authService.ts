import type { Employee } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { setSessionUser } from './session';
import { uid } from '@/utils/id';
import { nowIso } from '@/utils/date';

export const DEMO_PASSWORD = 'seasoncake';

export function listDemoAccounts(): Employee[] {
  return getDb().employees.filter((employee) => employee.isActive);
}

export function login(email: string, password: string): Employee {
  const employee = getDb().employees.find(
    (entry) => entry.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!employee || !employee.isActive || employee.password !== password) {
    throw new AppError('Incorrect email or password.');
  }
  setSessionUser({
    employeeId: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
  });
  mutateDb(
    (draft) => {
      draft.activity.unshift({
        id: uid('act'),
        message: `${employee.name} signed in.`,
        actor: employee.name,
        createdAt: nowIso(),
      });
    },
    undefined,
  );
  return employee;
}

export function logout(): void {
  setSessionUser(null);
}
