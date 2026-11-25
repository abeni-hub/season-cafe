import { HAS_REMOTE_API } from '@/config/brand';
import type { Expense } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import { recordExpense as demoRecordExpense, type ExpenseInput } from '../expenseService';

export * from '../expenseService';

export function recordExpense(input: ExpenseInput): Expense | Promise<Expense> {
  if (!HAS_REMOTE_API) return demoRecordExpense(input);
  return (async () => {
    const expense = await apiRequest<Expense>('/expenses/create/', {
      method: 'POST',
      body: input,
    });
    return synced('Expense', expense);
  })();
}
